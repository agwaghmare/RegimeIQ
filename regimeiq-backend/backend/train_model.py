"""
train_model.py
──────────────
Standalone script to (re)train the LightGBM regime scoring model.

Usage:
    cd regimeiq-backend/backend
    python train_model.py
"""

import sys
import os
import json

# Ensure services/ is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.data_merge_service import get_master_dataset
from services.signals_engine import compute_signals_historical
from services.scoring_engine import compute_scores_historical, TOTAL_MAX_RAW
from services.model_service import train_model, MODEL_PATH


def main():
    print("Loading master dataset...")
    master = get_master_dataset()
    print(f"  {len(master)} rows, {master.index[0].date()} to {master.index[-1].date()}")

    print("Computing signals...")
    signals_df = compute_signals_historical(master)

    print("Computing raw scores...")
    scores_df = compute_scores_historical(signals_df)

    print(f"Training LightGBM model (raw max={TOTAL_MAX_RAW}, target scale=0-10)...")
    metrics = train_model(signals_df, scores_df)

    print("\n=== Training Complete ===")
    print(json.dumps(metrics, indent=2))
    print(f"\nModel saved to: {MODEL_PATH}")


if __name__ == "__main__":
    main()
