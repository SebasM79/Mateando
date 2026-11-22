from pydantic import BaseModel, Field
from typing import List, Optional, Any


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    age: Optional[int] = Field(None, ge=1, le=120)
    username: str = Field(..., min_length=2, max_length=50)
    auth_provider: str = Field("local")


class GoogleLoginRequest(BaseModel):
    name: Optional[str] = "Usuario Google"
    email: Optional[str] = "cebador@gmail.com"


class MemberModel(BaseModel):
    name: str
    is_cebador: bool = False
    frequency: int = 1  # 1 = toma siempre, 2 = saltea 1 vuelta, 3 = saltea 2 vueltas
    position: Optional[int] = 0


class SaveGroupRequest(BaseModel):
    group_name: str
    members: List[MemberModel]
    user_id: Optional[int] = None


class HistoryCreateRequest(BaseModel):
    group_name: str
    cebador_name: str
    total_rounds: int
    total_mates: int
    duration_seconds: int
    participants_data: Any
