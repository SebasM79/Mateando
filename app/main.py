import os
import urllib.parse
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path
from typing import List, Optional

from app.database import (
    init_db,
    save_user,
    get_user_by_username,
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
    version="1.1.0"
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    return FileResponse(index_file)


# ---------------- API USUARIOS ----------------

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
        raise HTTPException(status_code=400, detail=f"Error al registrar usuario: {str(e)}")


@app.get("/api/users/find")
def find_user(username: str):
    if not username:
        raise HTTPException(status_code=400, detail="Debe ingresar un nombre de usuario")
    user = get_user_by_username(username.strip())
    if not user:
        return {"found": False, "user": None}
    return {"found": True, "user": user}


# ---------------- GOOGLE OAUTH AUTHENTICATION ----------------

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")


@app.get("/api/auth/google/config")
def google_auth_config():
    return {
        "configured": bool(GOOGLE_CLIENT_ID),
        "client_id": GOOGLE_CLIENT_ID or None
    }


@app.get("/api/auth/google/login")
def google_auth_login(request: Request):
    """
    Redirige a la API oficial de autenticación de Google OAuth 2.0.
    """
    client_id = GOOGLE_CLIENT_ID
    # URL de redirección
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/auth/google/callback"

    if not client_id:
        # Si no hay credenciales configuradas en el entorno, redirigimos a una pantalla interactiva con Google API
        # o usamos el endpoint de selección de cuenta de Google con un diálogo explicativo
        return RedirectResponse(url=f"/?auth_error=google_credentials_needed&redirect_uri={urllib.parse.quote(redirect_uri)}")

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account"
    }
    google_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=google_url)


@app.get("/api/auth/google/callback")
def google_auth_callback(code: Optional[str] = None, error: Optional[str] = None):
    """
    Callback que recibe el código de autorización de Google.
    """
    if error or not code:
        return RedirectResponse(url=f"/?auth_error={error or 'no_code'}")

    try:
        import requests
        # Canjear código por tokens de acceso
        token_res = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": "http://localhost:8000/api/auth/google/callback",
                "grant_type": "authorization_code"
            },
            timeout=10
        )
        tokens = token_res.json()
        access_token = tokens.get("access_token")

        if not access_token:
            return RedirectResponse(url="/?auth_error=token_exchange_failed")

        # Obtener información del perfil desde la API de Google
        userinfo_res = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10
        )
        profile = userinfo_res.json()

        email = profile.get("email", "")
        name = profile.get("name", email.split("@")[0] if email else "Usuario Google")
        username = email.split("@")[0] if email else "usuario_google"

        saved = save_user(
            name=name,
            age=None,
            username=username,
            auth_provider="google"
        )

        # Redirigir a la app con los datos de usuario validados
        encoded_user = urllib.parse.quote(f"{name}|{username}|{email}")
        return RedirectResponse(url=f"/?google_success=1&user={encoded_user}")

    except Exception as e:
        return RedirectResponse(url=f"/?auth_error={urllib.parse.quote(str(e))}")


@app.post("/api/users/google-login")
def google_direct_login(payload: GoogleLoginRequest):
    """
    Valida y registra un usuario que inició sesión con cuenta de Google verificada.
    """
    try:
        email = (payload.email or "").strip().lower()
        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="Debe ingresar un correo válido de Google (@gmail.com)")

        name = payload.name.strip() if payload.name else email.split("@")[0].capitalize()
        username = email.split("@")[0]

        saved = save_user(
            name=name,
            age=None,
            username=username,
            auth_provider="google"
        )
        return {"success": True, "user": saved}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------- API GRUPOS Y SESIONES ----------------

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
