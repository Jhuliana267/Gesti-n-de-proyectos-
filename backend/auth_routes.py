"""Rutas de autenticación: /api/registro, /api/login, /api/me."""
import hashlib
import logging
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from fastapi import BackgroundTasks
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import crear_token, hashear_password, usuario_actual, verificar_password
import config
from database import get_db
from models import PasswordResetToken, Usuario
from servicios import registrar_movimiento, registrar_snapshot
from tasa_cambio import obtener_trm

router = APIRouter(prefix="/api", tags=["auth"])
logger = logging.getLogger(__name__)

MENSAJE_RECUPERACION = (
    "Si el correo está registrado, recibirás un enlace para cambiar tu contraseña."
)
CAPITAL_INICIAL_COP = 3_000_000.0


def _saldo_inicial_usd() -> float:
    """Convierte el capital de bienvenida usando la TRM oficial vigente."""
    return round(CAPITAL_INICIAL_COP / obtener_trm()["valor_cop_por_usd"], 2)


def _enviar_correo_restauracion(destinatario: str, enlace: str) -> None:
    mensaje = EmailMessage()
    mensaje["Subject"] = "Restablece tu contraseña de InverSim"
    mensaje["From"] = config.SMTP_FROM
    mensaje["To"] = destinatario
    mensaje.set_content(
        "Recibimos una solicitud para cambiar la contraseña de tu cuenta de InverSim.\n\n"
        f"Usa este enlace antes de {config.PASSWORD_RESET_MINUTOS} minutos:\n{enlace}\n\n"
        "Si no solicitaste este cambio, ignora este correo. Tu contraseña no cambiará."
    )
    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as servidor:
            servidor.starttls(context=ssl.create_default_context())
            servidor.login(config.SMTP_USER, config.SMTP_PASSWORD)
            servidor.send_message(mensaje)
    except Exception:
        logger.exception("No se pudo enviar el correo de restablecimiento de contraseña")


class RecuperarPasswordIn(BaseModel):
    correo: EmailStr


class RestablecerPasswordIn(BaseModel):
    token: str = Field(min_length=32, max_length=200)
    password: str = Field(min_length=8, max_length=64)

    @field_validator("password")
    @classmethod
    def _limite_bcrypt(cls, v: str) -> str:
        if len(v.encode()) > 72:
            raise ValueError("La contraseña es demasiado larga")
        return v


class RegistroIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    correo: EmailStr
    password: str = Field(min_length=8, max_length=64)

    @field_validator("password")
    @classmethod
    def _limite_bcrypt(cls, v: str) -> str:
        if len(v.encode()) > 72:  # bcrypt solo usa los primeros 72 bytes
            raise ValueError("La contraseña es demasiado larga")
        return v


class LoginIn(BaseModel):
    correo: str = Field(max_length=120)
    password: str = Field(max_length=200)


@router.post("/recuperar-password")
def recuperar_password(
    datos: RecuperarPasswordIn,
    tareas: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not (config.SMTP_USER and config.SMTP_PASSWORD and config.SMTP_FROM):
        raise HTTPException(503, "El servicio de correo no está configurado.")

    correo = str(datos.correo).strip().lower()
    usuario = db.scalar(select(Usuario).where(Usuario.correo == correo))
    if usuario:
        ahora = datetime.now(timezone.utc).replace(tzinfo=None)
        db.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.id_usuario == usuario.id,
                PasswordResetToken.usado_en.is_(None),
            )
            .values(usado_en=ahora)
        )
        token = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(
            id_usuario=usuario.id,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            expira_en=ahora + timedelta(minutes=config.PASSWORD_RESET_MINUTOS),
        ))
        db.commit()
        enlace = f"{config.FRONTEND_URL}/restablecer?{urlencode({'token': token})}"
        tareas.add_task(_enviar_correo_restauracion, usuario.correo, enlace)

    return {"mensaje": MENSAJE_RECUPERACION}


@router.post("/restablecer-password")
def restablecer_password(datos: RestablecerPasswordIn, db: Session = Depends(get_db)):
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    token_hash = hashlib.sha256(datos.token.encode()).hexdigest()
    resultado = db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.usado_en.is_(None),
            PasswordResetToken.expira_en > ahora,
        )
        .values(usado_en=ahora)
    )
    if resultado.rowcount != 1:
        db.rollback()
        raise HTTPException(400, "El enlace no es válido o ya expiró. Solicita uno nuevo.")

    reset = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    usuario = db.get(Usuario, reset.id_usuario) if reset else None
    if usuario is None:
        db.rollback()
        raise HTTPException(400, "El enlace no es válido o ya expiró. Solicita uno nuevo.")

    usuario.password_hash = hashear_password(datos.password)
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.id_usuario == usuario.id,
            PasswordResetToken.usado_en.is_(None),
        )
        .values(usado_en=ahora)
    )
    db.commit()
    return {"mensaje": "Tu contraseña se actualizó. Ya puedes iniciar sesión."}


def usuario_publico(u: Usuario) -> dict:
    return {
        "id": u.id,
        "nombre": u.nombre,
        "correo": u.correo,
        "saldo_ficticio": round(u.saldo_ficticio, 2),
        "capital_inicial": round(u.saldo_inicial, 2),
        "tutorial_completado": u.tutorial_completado,
        "foto_url": u.foto_url,
        "idioma": u.idioma,
        "tema": u.tema,
    }


@router.post("/registro", status_code=201)
def registro(datos: RegistroIn, db: Session = Depends(get_db)):
    correo = datos.correo.strip().lower()
    if db.scalar(select(Usuario.id).where(Usuario.correo == correo)):
        raise HTTPException(409, "Ese correo ya está registrado. Prueba iniciando sesión.")
    saldo_inicial = _saldo_inicial_usd()
    usuario = Usuario(
        nombre=datos.nombre.strip(),
        correo=correo,
        password_hash=hashear_password(datos.password),
        saldo_ficticio=saldo_inicial,
        saldo_inicial=saldo_inicial,
    )
    db.add(usuario)
    try:
        db.flush()
        registrar_movimiento(db, usuario, "inicial", saldo_inicial, "Saldo inicial de bienvenida")
        db.commit()
    except IntegrityError:  # dos registros simultáneos con el mismo correo
        db.rollback()
        raise HTTPException(409, "Ese correo ya está registrado. Prueba iniciando sesión.")
    registrar_snapshot(db, usuario)
    return {"token": crear_token(usuario.id), "usuario": usuario_publico(usuario)}


@router.post("/login")
def login(datos: LoginIn, db: Session = Depends(get_db)):
    usuario = db.scalar(select(Usuario).where(Usuario.correo == datos.correo.strip().lower()))
    # Mismo mensaje y mismo tiempo de respuesta si el correo no existe o la clave es errónea.
    if not verificar_password(datos.password, usuario.password_hash if usuario else None):
        raise HTTPException(401, "Correo o contraseña incorrectos.")
    return {"token": crear_token(usuario.id), "usuario": usuario_publico(usuario)}


@router.get("/me")
def me(usuario: Usuario = Depends(usuario_actual)):
    return usuario_publico(usuario)


@router.post("/me/tutorial-completado")
def tutorial_completado(usuario: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)):
    usuario.tutorial_completado = True
    db.commit()
    return usuario_publico(usuario)
