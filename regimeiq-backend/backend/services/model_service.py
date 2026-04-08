"""
model_service.py
────────────────
LightGBM regime scoring model: training, persistence, and prediction.

The model learns to predict a continuous risk score (0-10) from both the
13 boolean signal flags and ~18 continuous features already computed by
signals_engine.  Training target is the rule-based sum rescaled to 0-10.

Train/test split at 2022-01-01.
  - Pre-2022 (train): target = raw_sum * 10/13
  - Post-2022 (test/live): model prediction (continuous 0-10)

No other module should import lightgbm directly — all ML goes through here.
"""

from __future__ import annotations

import os
import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ─── paths & constants ───────────────────────────────────────────────

MODEL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models"
)
MODEL_PATH = os.path.join(MODEL_DIR, "regime_lgbm.txt")
TRAIN_CUTOFF = "2022-01-01"
TOTAL_MAX_RAW = 13  # old additive max

# ─── feature definitions ─────────────────────────────────────────────

BOOL_FEATURES = [
    "unemp_rising", "yield_curve_inverted", "pmi_below_50",
    "cpi_above_3", "cpi_trend_rising", "real_rate_negative",
    "credit_spread_widening", "rate_rising_sharply", "dollar_strengthening",
    "momentum_negative", "drawdown_severe", "vix_above_25", "below_200ma",
]

CONTINUOUS_FEATURES = [
    "unemp_3m_change", "yield_spread", "pmi_value", "cpi_yoy",
    "cpi_3m_change", "fed_funds_3m_change", "real_rate",
    "credit_spread", "credit_spread_3m_change", "nominal_10y_3m_change",
    "dxy_3m_pct_change", "sp500_6m_momentum", "sp500_30d_vol",
    "vix_level", "vix_1m_change", "sp500_drawdown",
    "sp500_200ma_distance", "nfci",
]

ALL_FEATURES = BOOL_FEATURES + CONTINUOUS_FEATURES

# ─── module-level cache ──────────────────────────────────────────────

_cached_model = None


# ─── feature engineering ─────────────────────────────────────────────

def _build_feature_matrix(signals_df: pd.DataFrame) -> pd.DataFrame:
    """
    Select and clean feature columns from the signals DataFrame.
    Adds interaction features that capture multi-dimensional stress —
    these let the model distinguish true crises (where multiple categories
    fire simultaneously) from moderate one-dimensional stress.
    """
    X = pd.DataFrame(index=signals_df.index)

    for col in BOOL_FEATURES:
        if col in signals_df.columns:
            X[col] = signals_df[col].fillna(False).astype(int)
        else:
            X[col] = 0

    for col in CONTINUOUS_FEATURES:
        if col in signals_df.columns:
            X[col] = pd.to_numeric(signals_df[col], errors="coerce")
        else:
            X[col] = np.nan

    # Forward-fill then zero-fill remaining NaNs for continuous features
    X[CONTINUOUS_FEATURES] = X[CONTINUOUS_FEATURES].ffill().fillna(0.0)

    # ── Interaction features ─────────────────────────────────────────
    # Per-category stress counts (how many flags fire in each group)
    growth_flags = ["unemp_rising", "yield_curve_inverted", "pmi_below_50"]
    inflation_flags = ["cpi_above_3", "cpi_trend_rising", "real_rate_negative"]
    financial_flags = ["credit_spread_widening", "rate_rising_sharply", "dollar_strengthening"]
    market_flags = ["momentum_negative", "drawdown_severe", "vix_above_25", "below_200ma"]

    X["growth_count"] = sum(X[f] for f in growth_flags)
    X["inflation_count"] = sum(X[f] for f in inflation_flags)
    X["financial_count"] = sum(X[f] for f in financial_flags)
    X["market_count"] = sum(X[f] for f in market_flags)

    # How many categories have at least 2 flags firing (broad stress)
    X["categories_stressed"] = (
        (X["growth_count"] >= 2).astype(int)
        + (X["inflation_count"] >= 2).astype(int)
        + (X["financial_count"] >= 2).astype(int)
        + (X["market_count"] >= 2).astype(int)
    )

    # Cross-category interactions — crisis signature detectors
    X["market_x_financial"] = X["market_count"] * X["financial_count"]
    X["growth_x_market"] = X["growth_count"] * X["market_count"]
    X["financial_x_growth"] = X["financial_count"] * X["growth_count"]

    # Continuous stress interactions
    X["vix_x_drawdown"] = X["vix_level"] * X["sp500_drawdown"].abs()
    X["spread_x_momentum"] = X["credit_spread"] * X["sp500_6m_momentum"].abs()
    X["vix_x_spread_change"] = X["vix_level"] * X["credit_spread_3m_change"].clip(0, None)

    return X


def _sigmoid_rescale(raw):
    """
    Rescale raw score (0-13) to 0-10 using a normalized sigmoid.

    A sigmoid compresses moderate scores downward while amplifying high
    scores — exactly the opposite of a power curve, which shifts everything
    in the same direction.

    Parameters: k=0.55 (steepness), c=6.0 (inflection point), +0.4 linear offset

    Mapping (raw → target):
      0 → 0.0   3 → 2.3   5 → 3.9   7 → 6.2   9 → 8.9   10 → 9.6   13 → 10.0
    """
    k = 0.55
    c = 6.0
    sig = 1.0 / (1.0 + np.exp(-k * (raw - c)))
    sig_0 = 1.0 / (1.0 + np.exp(-k * (0 - c)))      # anchor at raw=0
    sig_13 = 1.0 / (1.0 + np.exp(-k * (13 - c)))     # anchor at raw=13
    base = 10.0 * (sig - sig_0) / (sig_13 - sig_0)
    # Lift non-zero scores by +0.4 to push crises closer to 9+
    is_zero = (raw == 0) if isinstance(raw, (int, float)) else (raw == 0)
    result = np.where(is_zero, 0.0, base + 0.4)
    return np.clip(result, 0.0, 10.0)


def _compute_target(scores_df: pd.DataFrame) -> pd.Series:
    """Rescale raw integer total_score (0-13) to 0-10 via sigmoid."""
    col = "total_score" if "total_score" in scores_df.columns else "raw_total_score"
    raw = scores_df[col] if col in scores_df.columns else 0
    vals = _sigmoid_rescale(raw)
    return pd.Series(np.clip(vals, 0.0, 10.0), index=scores_df.index).round(2)


# ─── model I/O ───────────────────────────────────────────────────────

def _load_model():
    """Load the saved LightGBM model from disk. Returns None on failure."""
    global _cached_model
    if _cached_model is not None:
        return _cached_model

    if not os.path.exists(MODEL_PATH):
        return None

    try:
        import lightgbm as lgb
        _cached_model = lgb.Booster(model_file=MODEL_PATH)
        logger.info("LightGBM model loaded from %s", MODEL_PATH)
        return _cached_model
    except Exception as e:
        logger.warning("Failed to load LightGBM model: %s", e)
        return None


def _invalidate_cache():
    """Clear the in-memory model cache (e.g. after retraining)."""
    global _cached_model
    _cached_model = None


# ─── training ────────────────────────────────────────────────────────

def train_model(signals_df: pd.DataFrame, scores_df: pd.DataFrame) -> dict:
    """
    Train a LightGBM regressor on pre-2022 data and evaluate on post-2022.

    Returns dict with train_rmse, test_rmse, test_r2.
    """
    import lightgbm as lgb
    from sklearn.metrics import mean_squared_error, r2_score

    X = _build_feature_matrix(signals_df)
    y = _compute_target(scores_df)

    # Align indices
    common = X.index.intersection(y.index)
    X = X.loc[common]
    y = y.loc[common]

    # Train/test split at cutoff
    cutoff = pd.Timestamp(TRAIN_CUTOFF)
    train_mask = X.index < cutoff
    test_mask = X.index >= cutoff

    X_train, y_train = X[train_mask], y[train_mask]
    X_test, y_test = X[test_mask], y[test_mask]

    logger.info(
        "Training LightGBM: %d train rows, %d test rows, %d features",
        len(X_train), len(X_test), len(ALL_FEATURES),
    )

    # Sample weights: upweight high-stress periods so the model pays extra
    # attention to getting crisis scores right (not just minimising average error)
    def _make_weights(y: pd.Series) -> np.ndarray:
        w = np.ones(len(y))
        w[y >= 6.0] = 3.0   # Risk-Off gets 3x weight
        w[y >= 7.5] = 6.0   # Crisis gets 6x weight
        return w

    # Validation split from training data for early stopping
    val_size = int(len(X_train) * 0.2)
    X_tr, X_val = X_train.iloc[:-val_size], X_train.iloc[-val_size:]
    y_tr, y_val = y_train.iloc[:-val_size], y_train.iloc[-val_size:]

    w_tr = _make_weights(y_tr)
    w_val = _make_weights(y_val)

    train_data = lgb.Dataset(X_tr, label=y_tr, weight=w_tr)
    val_data = lgb.Dataset(X_val, label=y_val, weight=w_val, reference=train_data)

    params = {
        "objective": "regression",
        "metric": "rmse",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_child_samples": 20,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "verbose": -1,
    }

    model = lgb.train(
        params,
        train_data,
        num_boost_round=500,
        valid_sets=[val_data],
        callbacks=[lgb.early_stopping(50, verbose=False)],
    )

    # Save model
    os.makedirs(MODEL_DIR, exist_ok=True)
    model.save_model(MODEL_PATH)
    _invalidate_cache()
    logger.info("Model saved to %s", MODEL_PATH)

    # Evaluate
    train_pred = np.clip(model.predict(X_train), 0, 10)
    test_pred = np.clip(model.predict(X_test), 0, 10)

    metrics = {
        "train_rmse": float(np.sqrt(mean_squared_error(y_train, train_pred))),
        "test_rmse": float(np.sqrt(mean_squared_error(y_test, test_pred))),
        "test_r2": float(r2_score(y_test, test_pred)),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
    }
    logger.info("Training metrics: %s", metrics)
    return metrics


# ─── prediction ──────────────────────────────────────────────────────

def predict_scores(signals_df: pd.DataFrame) -> pd.Series:
    """
    Batch prediction for all rows in the signals DataFrame.
    Falls back to rescaled raw sum if model is unavailable.
    """
    model = _load_model()
    if model is None:
        logger.warning("No model available — falling back to rescaled raw scores")
        return pd.Series(np.nan, index=signals_df.index)

    X = _build_feature_matrix(signals_df)
    preds = model.predict(X)
    return pd.Series(np.clip(preds, 0, 10), index=signals_df.index)


def predict_score_single(signals: dict, raw_total_score: int) -> float:
    """
    Single-row prediction for the current pipeline.

    Parameters
    ----------
    signals : dict with keys "growth", "inflation", "financial", "market"
              (as returned by compute_signals_latest)
    raw_total_score : integer sum of the 13 boolean flags (0-13)

    Returns
    -------
    float score on 0-10 scale
    """
    fallback = round(float(_sigmoid_rescale(np.array(raw_total_score))), 2)

    model = _load_model()
    if model is None:
        return fallback

    # Flatten the nested signals dict into a single feature row
    flat: dict = {}
    for group in ("growth", "inflation", "financial", "market"):
        sub = signals.get(group, {})
        if isinstance(sub, dict):
            flat.update(sub)

    # Build a single-row DataFrame
    row: dict = {}
    for col in BOOL_FEATURES:
        val = flat.get(col)
        if val is None or (isinstance(val, float) and np.isnan(val)):
            row[col] = 0
        else:
            row[col] = int(bool(val))

    for col in CONTINUOUS_FEATURES:
        val = flat.get(col)
        if val is None or (isinstance(val, float) and np.isnan(val)):
            row[col] = 0.0
        else:
            row[col] = float(val)

    X = pd.DataFrame([row], columns=ALL_FEATURES)

    try:
        pred = model.predict(X)[0]
        return float(np.clip(pred, 0, 10))
    except Exception as e:
        logger.warning("Model prediction failed: %s — using fallback", e)
        return fallback


# ─── startup helper ──────────────────────────────────────────────────

def ensure_model_trained():
    """
    Check if the model file exists. If not, train from scratch.
    Called during app startup.
    """
    if os.path.exists(MODEL_PATH):
        logger.info("Model file exists at %s — skipping training", MODEL_PATH)
        return

    logger.info("No model file found — training from scratch")

    from services.data_merge_service import get_master_dataset
    from services.signals_engine import compute_signals_historical
    from services.scoring_engine import compute_scores_historical

    master = get_master_dataset()
    signals_df = compute_signals_historical(master)
    scores_df = compute_scores_historical(signals_df)
    metrics = train_model(signals_df, scores_df)
    logger.info("Auto-training complete: %s", metrics)
