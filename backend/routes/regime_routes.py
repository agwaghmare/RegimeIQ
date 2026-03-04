"""
Regime API routes.
All data flows through regime_pipeline – no direct service imports.
"""

from fastapi import APIRouter, Query
from typing import Optional

from services.regime_pipeline import (
    run_current_pipeline,
    run_historical_pipeline,
    run_summary_pipeline,
)
from services.signals_engine import compute_signals_latest
from services.data_merge_service import get_master_dataset
from schema.regime import (
    RegimeCurrentResponse,
    RegimeHistoryResponse,
    RegimeSummaryResponse,
    SignalsResponse,
)

router = APIRouter()


@router.get(
    "/current",
    response_model=RegimeCurrentResponse,
    summary="Current regime classification with allocation and signals",
)
def get_current_regime():
    return run_current_pipeline()


@router.get(
    "/history",
    response_model=RegimeHistoryResponse,
    summary="Historical regime classifications",
)
def get_regime_history(
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    sample: Optional[str] = Query(None, description="'monthly' to downsample"),
):
    data = run_historical_pipeline(start=start, end=end, sample=sample)
    return {"count": len(data), "data": data}


@router.get(
    "/summary",
    response_model=RegimeSummaryResponse,
    summary="Regime distribution and current streak",
)
def get_regime_summary_endpoint():
    return run_summary_pipeline()


@router.get(
    "/signals",
    response_model=SignalsResponse,
    summary="Current signal values across all groups",
)
def get_current_signals():
    master = get_master_dataset()
    return compute_signals_latest(master)
