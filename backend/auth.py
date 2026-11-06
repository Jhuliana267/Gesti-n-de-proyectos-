"""Autenticación: hash de contraseñas (bcrypt) y sesiones con JWT."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import config
from database import get_db
from models import Usuario

bearer = HTTPBearer(auto_error=False)

# Hash de relleno: se compara cuando el correo no existe, para que la respuesta
# tarde lo mismo y no se pueda averiguar qué correos están registrados.
_HASH_FALSO = bcrypt.hashpw(b"relleno", bcrypt.gensalt())


def hashear_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verificar_password(password: str, password_hash: str | None) -> bool:
    objetivo = password_hash.encode() if password_hash else _HASH_FALSO
    try:
        valido = bcrypt.checkpw(password.encode()[:72], objetivo)
    except ValueError:
        return False
    return valido and password_hash is not None


def crear_token(id_usuario: int) -> str:
    payload = {
        "sub": str(id_usuario),
        "exp": datetime.now(timezone.utc) + timedelta(hours=config.TOKEN_HORAS),
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")


def usuario_actual(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    """Dependencia: exige sesión iniciada y devuelve el usuario de la base de datos."""
    no_autorizado = HTTPException(
        status_code=401,
        detail="Inicia sesión para continuar.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if cred is None:
        raise no_autorizado
    try:
        datos = jwt.decode(cred.credentials, config.SECRET_KEY, algorithms=["HS256"])
        id_usuario = int(datos["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Tu sesión expiró o no es válida. Inicia sesión de nuevo.",
                            headers={"WWW-Authenticate": "Bearer"})
    usuario = db.get(Usuario, id_usuario)
    if usuario is None:  # token válido pero el usuario ya no existe en la BD → no entra
        raise no_autorizado
    return usuario
