"""Configuración central. Lee variables de entorno (y de backend/.env si existe)."""
import os

from dotenv import load_dotenv

load_dotenv()

# --- Autenticación ---
# En producción define INVERSIM_SECRET con un valor largo y aleatorio:
#   python -c "import secrets; print(secrets.token_urlsafe(48))"
SECRET_KEY = os.getenv("INVERSIM_SECRET", "dev-secret-cambiame-en-produccion")
TOKEN_HORAS = int(os.getenv("TOKEN_HORAS", "24"))

# --- Mentor IA ---
# AI_PROVIDER = "gemini" | "openai" (si se omite, se usa el que tenga clave)
AI_PROVIDER = os.getenv("AI_PROVIDER", "").lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
# Verifica en la documentación del proveedor cuál es el nombre de modelo vigente.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
IA_MAX_TOKENS = int(os.getenv("IA_MAX_TOKENS", "600"))
IA_SEGUNDOS_ENTRE_LLAMADAS = float(os.getenv("IA_SEGUNDOS_ENTRE_LLAMADAS", "3"))

# --- Restablecimiento de contraseña por correo (Gmail SMTP por defecto) ---
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
PASSWORD_RESET_MINUTOS = 30

# --- Progreso y evaluación ---
SNAPSHOT_INTERVALO_SEGUNDOS = int(os.getenv("SNAPSHOT_INTERVALO_SEGUNDOS", "60"))  # 86400 = diario
SNAPSHOTS_MAXIMOS_POR_USUARIO = 1000
OPS_POR_CICLO = int(os.getenv("OPS_POR_CICLO", "5"))  # operaciones para desbloquear la evaluación
