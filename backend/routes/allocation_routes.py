"""
Allocation API routes.
"""

from fastapi import APIRouter, Query
from typing import Optional

from services.regime_pipeline import run_current_pipeline, run_historical_pipeline
from services.allocation_service import get_allocation, get_allocation_transitions, get_rebalance_plan
from schema.regime import AllocationCurrentResponse, TransitionsResponse

router = APIRouter()


@router.get(
    "/current",
    response_model=AllocationCurrentResponse,
    summary="Current portfolio allocation based on regime",
)
def get_current_allocation():
    data = run_current_pipeline()
    return {
        "regime": data["regime"],
        "allocation": data["allocation"],
        "etf_mapping": data["etf_mapping"],
    }


@router.get(
    "/transitions",
    response_model=TransitionsResponse,
    summary="Historical regime transitions and allocation changes",
)
def get_transitions(
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
):
    # Use pipeline to get historical regime DataFrame (cached)
    from services.regime_pipeline import _get_historical_df
    import pandas as pd

    df = _get_historical_df()

    if start:
        df = df[df.index >= pd.Timestamp(start)]
    if end:
        df = df[df.index <= pd.Timestamp(end)]

    transitions = get_allocation_transitions(df)
    return {"count": len(transitions), "data": transitions}


@router.get(
    "/rebalance-plan",
    summary="Concrete buy list and 6-holding Sharpe model portfolio",
)
def get_rebalance_plan_endpoint(
    risk_tolerance: str = Query("moderate", description="conservative|moderate|aggressive"),
):
    data = run_current_pipeline()
    regime = data.get("regime", "Neutral")
    return get_rebalance_plan(regime=regime, risk_tolerance=risk_tolerance)
