import sqlite3
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_PATH = Path(__file__).resolve().parent.parent / "mateando.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Tabla de Usuarios
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER,
        username TEXT UNIQUE NOT NULL,
        auth_provider TEXT DEFAULT 'local',
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Tabla de Grupos / Rondas Guardadas
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS saved_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        group_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Tabla de Integrantes de Grupos Guardados
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        is_cebador INTEGER DEFAULT 0,
        frequency INTEGER DEFAULT 1,
        position INTEGER DEFAULT 0,
        FOREIGN KEY (group_id) REFERENCES saved_groups (id) ON DELETE CASCADE
    );
    """)

    # Tabla de Historial de Mateadas
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mateada_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_name TEXT,
        cebador_name TEXT,
        total_rounds INTEGER DEFAULT 0,
        total_mates INTEGER DEFAULT 0,
        duration_seconds INTEGER DEFAULT 0,
        participants_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()


def save_user(name: str, age: Optional[int], username: str, auth_provider: str = "local") -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO users (name, age, username, auth_provider)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET
            name = excluded.name,
            age = excluded.age,
            auth_provider = excluded.auth_provider
        RETURNING id, name, age, username, auth_provider, created_at;
        """, (name, age, username, auth_provider))
        row = cursor.fetchone()
        conn.commit()
        return dict(row)
    finally:
        conn.close()


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, name, age, username, auth_provider, created_at FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_latest_user() -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, name, age, username, auth_provider, created_at FROM users ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def save_group(group_name: str, members: List[Dict[str, Any]], user_id: Optional[int] = None) -> int:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO saved_groups (user_id, group_name)
        VALUES (?, ?)
        """, (user_id, group_name))
        group_id = cursor.lastrowid

        for idx, m in enumerate(members):
            cursor.execute("""
            INSERT INTO group_members (group_id, name, is_cebador, frequency, position)
            VALUES (?, ?, ?, ?, ?)
            """, (
                group_id,
                m.get("name", f"Persona {idx+1}"),
                1 if m.get("is_cebador") else 0,
                m.get("frequency", 1),
                idx
            ))
        conn.commit()
        return group_id
    finally:
        conn.close()


def get_all_groups() -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, group_name, created_at FROM saved_groups ORDER BY id DESC")
        groups = [dict(row) for row in cursor.fetchall()]
        for g in groups:
            cursor.execute("""
            SELECT name, is_cebador, frequency, position
            FROM group_members
            WHERE group_id = ?
            ORDER BY position ASC
            """, (g["id"],))
            g["members"] = [dict(m) for m in cursor.fetchall()]
        return groups
    finally:
        conn.close()


def delete_group(group_id: int) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM saved_groups WHERE id = ?", (group_id,))
        cursor.execute("DELETE FROM group_members WHERE group_id = ?", (group_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def save_session_history(group_name: str, cebador_name: str, total_rounds: int, total_mates: int, duration_seconds: int, participants_data: Any) -> int:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO mateada_history (group_name, cebador_name, total_rounds, total_mates, duration_seconds, participants_data)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (group_name, cebador_name, total_rounds, total_mates, duration_seconds, json.dumps(participants_data, ensure_ascii=False)))
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()
