"""Rutas de cuenta: ajustes de perfil, historial de la billetera y feedback."""
from datetime import timedelta
from typing import Annotated, Literal
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from auth import usuario_actual
from auth_routes import usuario_publico
from database import get_db
from models import (
    Evaluacion, Feedback, MovimientoBilletera, SnapshotPatrimonio, Transaccion, Usuario, ahora,
)
from servicios import iso, repasar, resumen_portafolio

router = APIRouter(prefix="/api", tags=["cuenta"])

LIMITE_FEEDBACK = 5                       # comentarios máximos...
VENTANA_FEEDBACK = timedelta(minutes=10)  # ...dentro de esta ventana, por usuario


# ---------- Ajustes ----------
class AjustesIn(BaseModel):
    """Actualización parcial: solo se modifican los campos que vengan en la petición."""

    model_config = ConfigDict(extra="forbid")

    nombre: str | None = Field(default=None, min_length=1, max_length=50)  # NUEVO
    foto_url: str | None = Field(default=None, max_length=500)  # null = quitar la foto
    idioma: Literal["es", "en", "pt"] | None = None  # CAMBIO: se agrega "pt"
    tema: Literal["claro", "oscuro"] | None = None

    @field_validator("nombre")  # NUEVO
    @classmethod
    def _nombre_limpio(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío.")
        return v

    @field_validator("foto_url")
    @classmethod
    def _url_valida(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        p = urlparse(v)
        if p.scheme not in ("http", "https") or not p.netloc:
            raise ValueError("La foto debe ser una URL http(s) válida.")
        return v

@router.patch("/me/ajustes")
def actualizar_ajustes(
    datos: AjustesIn,
    usuario: Usuario = Depends(usuario_actual),
    db: Session = Depends(get_db),
):
    enviados = datos.model_dump(exclude_unset=True)
    if not enviados:
        raise HTTPException(400, "No enviaste ningún ajuste para cambiar.")
    for campo, valor in enviados.items():
        if valor is None and campo != "foto_url":
            raise HTTPException(422, f"El ajuste '{campo}' no puede ser nulo.")
        setattr(usuario, campo, valor)
    db.commit()
    return usuario_publico(usuario)


@router.post("/me/reiniciar-simulacion")
def reiniciar_simulacion(
    usuario: Usuario = Depends(usuario_actual),
    db: Session = Depends(get_db),
):
    try:
        db.execute(delete(MovimientoBilletera).where(MovimientoBilletera.id_usuario == usuario.id))
        db.execute(delete(Transaccion).where(Transaccion.id_usuario == usuario.id))
        db.execute(delete(SnapshotPatrimonio).where(SnapshotPatrimonio.id_usuario == usuario.id))
        db.execute(delete(Evaluacion).where(Evaluacion.id_usuario == usuario.id))
        usuario.saldo_ficticio = usuario.saldo_inicial
        db.flush()
        db.add(MovimientoBilletera(
            id_usuario=usuario.id,
            tipo="inicial",
            monto=usuario.saldo_inicial,
            saldo_posterior=usuario.saldo_inicial,
            descripcion="Saldo inicial restaurado al reiniciar la simulación",
        ))
        db.add(SnapshotPatrimonio(
            id_usuario=usuario.id,
            saldo=usuario.saldo_inicial,
            valor_inversiones=0,
            patrimonio=usuario.saldo_inicial,
        ))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {
        "mensaje": "La simulación se reinició con tu capital inicial.",
        "usuario": usuario_publico(usuario),
    }


# ---------- Historial de la billetera ----------
@router.get("/me/billetera/historial")
def historial_billetera(
    limite: int = Query(20, ge=1, le=100),
    antes_id: int | None = Query(None, ge=1),  # paginación: pide los anteriores a este id
    usuario: Usuario = Depends(usuario_actual),
    db: Session = Depends(get_db),
):
    consulta = select(MovimientoBilletera).where(MovimientoBilletera.id_usuario == usuario.id)
    if antes_id:
        consulta = consulta.where(MovimientoBilletera.id < antes_id)
    filas = db.scalars(consulta.order_by(MovimientoBilletera.id.desc()).limit(limite + 1)).all()
    hay_mas = len(filas) > limite
    filas = filas[:limite]
    return {
        "saldo": round(usuario.saldo_ficticio, 2),
        "movimientos": [
            {
                "id": m.id, "tipo": m.tipo, "monto": m.monto,
                "saldo_posterior": m.saldo_posterior, "descripcion": m.descripcion,
                "id_transaccion": m.id_transaccion, "fecha": iso(m.fecha),
            }
            for m in filas
        ],
        "siguiente_antes_id": filas[-1].id if hay_mas else None,
    }


# ---------- Feedback (solo escritura: no existe ningún GET) ----------
Comentario = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1000)]


class FeedbackIn(BaseModel):
    comentario: Comentario


@router.post("/feedback", status_code=201)
def enviar_feedback(
    datos: FeedbackIn,
    usuario: Usuario = Depends(usuario_actual),
    db: Session = Depends(get_db),
):
    desde = (ahora() - VENTANA_FEEDBACK).replace(tzinfo=None)
    recientes = db.scalar(
        select(func.count()).select_from(Feedback)
        .where(Feedback.id_usuario == usuario.id, Feedback.fecha >= desde)
    )
    if recientes >= LIMITE_FEEDBACK:
        raise HTTPException(429, "Has enviado varios comentarios seguidos. Espera unos minutos e inténtalo de nuevo.")
    db.add(Feedback(id_usuario=usuario.id, comentario=datos.comentario))
    db.commit()
    return {"mensaje": "¡Gracias! Recibimos tu comentario."}


    # ---------- Panel de la billetera ----------
def calcular_resumen_billetera(eventos: list[dict], port: dict) -> dict:
    """Ganancia realizada/abierta por acción, total invertido y la acción más rentable."""
    por_ticker: dict[str, dict] = {}
    for e in eventos:
        d = por_ticker.setdefault(e["ticker"], {
            "ticker": e["ticker"], "empresa": e["empresa"],
            "comprado": 0.0, "realizada": 0.0, "abierta": 0.0,
        })
        if e["tipo"] == "compra":
            d["comprado"] += e["cantidad"] * e["precio"]
        elif e["ganancia_realizada"] is not None:
            d["realizada"] += e["ganancia_realizada"]
    for p in port["posiciones"]:
        por_ticker[p["ticker"]]["abierta"] = p["ganancia"]

    # Más rentable = mayor % de ganancia total (ventas + posición abierta) sobre lo que compraste de ella.
    mejor = None
    for d in por_ticker.values():
        if d["comprado"] <= 0:
            continue
        ganancia = d["realizada"] + d["abierta"]
        pct = ganancia / d["comprado"] * 100
        if mejor is None or pct > mejor["ganancia_pct"]:
            mejor = {
                "ticker": d["ticker"], "empresa": d["empresa"],
                "ganancia": round(ganancia, 2), "ganancia_pct": round(pct, 2),
            }

    return {
        # costo de adquisición de lo que tienes hoy (valor de mercado - ganancia abierta)
        "invertido": round(sum(p["valor_mercado"] - p["ganancia"] for p in port["posiciones"]), 2),
        "ganancia_realizada": round(sum(d["realizada"] for d in por_ticker.values()), 2),
        "ganancia_no_realizada": round(sum(p["ganancia"] for p in port["posiciones"]), 2),
        "mejor_accion": mejor,
    }


@router.get("/me/billetera/resumen")
def resumen_billetera(
    limite: int = Query(100, ge=1, le=500),
    usuario: Usuario = Depends(usuario_actual),
    db: Session = Depends(get_db),
):
    eventos, _ = repasar(db, usuario.id)
    port = resumen_portafolio(db, usuario)
    return {
        "saldo": port["saldo_ficticio"],
        "valor_inversiones": port["valor_inversiones"],
        "patrimonio": port["patrimonio_total"],
        "ganancia_historica": port["ganancia_total"],
        "ganancia_historica_pct": round(port["ganancia_total"] / usuario.saldo_inicial * 100, 2),
        **calcular_resumen_billetera(eventos, port),
        "composicion": [{"ticker": p["ticker"], "valor": p["valor_mercado"]} for p in port["posiciones"]],
        "total_transacciones": len(eventos),
        "transacciones": [  # más recientes primero; "resultado" solo existe en las ventas
            {
                "id": e["id"], "fecha": iso(e["fecha"]), "ticker": e["ticker"], "tipo": e["tipo"],
                "cantidad": e["cantidad"], "precio": e["precio"],
                "total": round(e["cantidad"] * e["precio"], 2), "resultado": e["ganancia_realizada"],
            }
            for e in reversed(eventos[-limite:])
        ],
    }