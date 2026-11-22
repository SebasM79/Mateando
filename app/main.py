from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from typing import List

from app.database import (
    init_db,
    save_user,
    get_latest_user,
    save_group,
    get_all_groups,
    delete_group,
    save_session_history
)
from app.models import UserCreate, GoogleLoginRequest, SaveGroupRequest, HistoryCreateRequest

# Inicializar Base de Datos SQLite
init_db()

app = FastAPI(
    title="Mateando - Gestor Inteligente de Rondas de Mate",
    description="Aplicación web para coordinar rondas de mate, tiempos de cebado y avisos.",
    version="1.0.0"
)

STATIC_DIR = Path(__file__).resolve().parent / "static"

# Servir archivos estáticos
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    return FileResponse(index_file)


# ---------------- API ENDPOINTS ----------------

@app.post("/api/users")
def create_user(user: UserCreate):
    try:
        saved = save_user(
            name=user.name.strip(),
            age=user.age,
            username=user.username.strip(),
            auth_provider=user.auth_provider
        )
        return {"success": True, "user": saved}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/users/google-login")
def google_login(payload: GoogleLoginRequest):
    try:
        name = payload.name or "Cebador Google"
        username = payload.email.split("@")[0] if payload.email else "cebador_google"
        saved = save_user(
            name=name,
            age=None,
            username=username,
            auth_provider="google"
        )
        return {"success": True, "user": saved}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/users/current")
def get_current_user():
    user = get_latest_user()
    if not user:
        return {"user": None}
    return {"user": user}


@app.get("/api/groups")
def list_groups():
    groups = get_all_groups()
    return {"groups": groups}


@app.post("/api/groups")
def create_group(data: SaveGroupRequest):
    if not data.group_name.strip():
        raise HTTPException(status_code=400, detail="El nombre del grupo es obligatorio")
    if not data.members:
        raise HTTPException(status_code=400, detail="El grupo debe tener al menos un integrante")
    
    group_id = save_group(
        group_name=data.group_name.strip(),
        members=[m.dict() for m in data.members],
        user_id=data.user_id
    )
    return {"success": True, "group_id": group_id}


@app.delete("/api/groups/{group_id}")
def remove_group(group_id: int):
    success = delete_group(group_id)
    if not success:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return {"success": True}


@app.post("/api/history")
def record_history(data: HistoryCreateRequest):
    history_id = save_session_history(
        group_name=data.group_name,
        cebador_name=data.cebador_name,
        total_rounds=data.total_rounds,
        total_mates=data.total_mates,
        duration_seconds=data.duration_seconds,
        participants_data=data.participants_data
    )
    return {"success": True, "history_id": history_id}
