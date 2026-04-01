from fastapi import APIRouter
from schema.signals import SignalRequest
from schema.regime import SignalsResponse, ScoresResponse
from services.data_merge_service import get_master_dataset
from services.signals_engine import compute_signals_latest
from services.scoring_engine import compute_scores

router = APIRouter()


# ─── legacy endpoint (kept for backward compat) ─────────────────────

@router.post("/", deprecated=True, summary="[DEPRECATED] Use GET /signals/current")
def generate_signal(request: SignalRequest):

    if request.risk_level == "low":
        allocation = {"equities": 0.3, "bonds": 0.6, "gold": 0.1}
    elif request.risk_level == "high":
        allocation = {"equities": 0.8, "bonds": 0.1, "gold": 0.1}
    else:
        allocation = {"equities": 0.6, "bonds": 0.3, "gold": 0.1}

    return {
        "risk_level": request.risk_level,
        "horizon_days": request.horizon_days,
        "allocation": allocation
    }


# ─── new GET endpoints ───────────────────────────────────────────────

@router.get(
    "/current",
    response_model=SignalsResponse,
    summary="All signal values for the latest date",
)
def get_signals_current():
    master = get_master_dataset()
    return compute_signals_latest(master)


@router.get(
    "/scores",
    response_model=ScoresResponse,
    summary="Score breakdown for the latest date",
)
def get_signals_scores():
    master = get_master_dataset()
    signals = compute_signals_latest(master)
    scores = compute_scores(signals)
    return {
        "total_score": scores["total_score"],
        "breakdown": {
            "growth": {"score": scores["growth_score"], "max": 3},
            "inflation": {"score": scores["inflation_score"], "max": 3},
            "financial": {"score": scores["financial_score"], "max": 3},
            "market": {"score": scores["market_score"], "max": 4},
        },
    }