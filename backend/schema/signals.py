from pydantic import BaseModel

class SignalRequest(BaseModel):
    risk_level: str
    horizon_days: int