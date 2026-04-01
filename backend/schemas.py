from datetime import datetime
from typing import Dict
from pydantic import BaseModel


class CorrectionRequest(BaseModel):
    text: str


class MistakeResponse(BaseModel):
    id: int
    original_text: str
    corrected_text: str
    mistake_type: str
    explanation: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StatsResponse(BaseModel):
    total: int
    by_type: Dict[str, int]
