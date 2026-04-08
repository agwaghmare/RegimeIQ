from fastapi import APIRouter
from schema.signals import SignalRequest

router = APIRouter()

@router.post("/")
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