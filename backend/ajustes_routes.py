from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

# Importaciones basadas en la estructura de tu proyecto
from database import get_db
from auth import usuario_actual
from models import Usuario

# Se define el router (que luego importas en main.py)
router = APIRouter(prefix="/api/me/ajustes", tags=["ajustes"])

# Modelo de Pydantic para validar los datos que llegan desde el frontend
class AjustesUpdate(BaseModel):
    nombre: Optional[str] = None
    foto_url: Optional[str] = None
    idioma: Optional[str] = None
    tema: Optional[str] = None

@router.patch("/")
def actualizar_ajustes(
    cambios: AjustesUpdate, 
    db: Session = Depends(get_db), 
    usuario: Usuario = Depends(usuario_actual)
):
    # Se actualizan solo los campos que el frontend haya enviado
    if cambios.nombre is not None:
        usuario.nombre = cambios.nombre
    if cambios.foto_url is not None:
        usuario.foto_url = cambios.foto_url
    if cambios.idioma is not None:
        usuario.idioma = cambios.idioma
    if cambios.tema is not None:
        usuario.tema = cambios.tema
        
    db.commit()
    db.refresh(usuario)
    
    return usuario