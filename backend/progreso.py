"""Módulo 4: "Mi progreso" (evolución del capital) y evaluación (quiz) por ciclos."""
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

import config
import evaluacion as ev_svc
from auth import usuario_actual
from database import SessionLocal, get_db
from models import Evaluacion, SnapshotPatrimonio, Transaccion, Usuario, ahora
from servicios import iso, registrar_snapshot, repasar, resumen_portafolio

router = APIRouter(prefix="/api", tags=["progreso"])


# ---------- Tarea en segundo plano: foto periódica del patrimonio ----------
def _tomar_snapshots() -> None:
    with SessionLocal() as db:
        for usuario in db.scalars(select(Usuario)).all():
            registrar_snapshot(db, usuario)


async def bucle_snapshots() -> None:
    while True:
        await asyncio.sleep(config.SNAPSHOT_INTERVALO_SEGUNDOS)
        try:
            await asyncio.to_thread(_tomar_snapshots)
        except Exception as exc:
            print(f"[snapshots] error: {exc}")


# ---------- Progreso ----------
@router.get("/me/progreso")
def progreso(usuario: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)):
    filas = db.scalars(
        select(SnapshotPatrimonio)
        .where(SnapshotPatrimonio.id_usuario == usuario.id)
        .order_by(SnapshotPatrimonio.id.desc())
        .limit(300)
    ).all()
    serie = [
        {"fecha": iso(s.fecha), "patrimonio": s.patrimonio, "saldo": s.saldo, "valor_inversiones": s.valor_inversiones}
        for s in reversed(filas)
    ]
    r = resumen_portafolio(db, usuario)
    serie.append({"fecha": iso(ahora().replace(tzinfo=None)), "patrimonio": r["patrimonio_total"],
                  "saldo": r["saldo_ficticio"], "valor_inversiones": r["valor_inversiones"]})

    eventos, _ = repasar(db, usuario.id)
    ventas = [e for e in eventos if e["tipo"] == "venta"]
    mejor = max(ventas, key=lambda e: e["ganancia_realizada"], default=None)
    peor = min(ventas, key=lambda e: e["ganancia_realizada"], default=None)
    fmt = lambda e: {"ticker": e["ticker"], "ganancia": e["ganancia_realizada"]} if e else None

    en_ciclo = ev_svc.operaciones_en_ciclo(db, usuario.id)
    pendiente = ev_svc.evaluacion_pendiente(db, usuario.id)
    historial = db.scalars(
        select(Evaluacion)
        .where(Evaluacion.id_usuario == usuario.id, Evaluacion.completada_en.is_not(None))
        .order_by(Evaluacion.id.desc()).limit(10)
    ).all()
    return {
        "capital_inicial": usuario.saldo_inicial,
        "serie": serie,
        "resumen": {
            "patrimonio_actual": r["patrimonio_total"],
            "rendimiento": r["ganancia_total"],
            "rendimiento_pct": round(r["ganancia_total"] / usuario.saldo_inicial * 100, 2),
            "operaciones": len(eventos),
            "mejor_operacion": fmt(mejor),
            "peor_operacion": fmt(peor),
        },
        "ciclo": {
            "operaciones": en_ciclo,
            "meta": config.OPS_POR_CICLO,
            "listo": pendiente is not None or en_ciclo >= config.OPS_POR_CICLO,
            "evaluacion_pendiente": pendiente.id if pendiente else None,
        },
        "evaluaciones": [
            {"id": e.id, "fecha": iso(e.completada_en), "puntaje": e.puntaje, "total": e.total} for e in historial
        ],
    }


# ---------- Evaluación ----------
class RespuestasIn(BaseModel):
    respuestas: list[int | None] = Field(max_length=20)


@router.get("/me/evaluacion")
def obtener_evaluacion(usuario: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)):
    """Devuelve la evaluación pendiente o genera una nueva si el ciclo está completo."""
    ev = ev_svc.evaluacion_pendiente(db, usuario.id)
    if ev is None:
        faltan = config.OPS_POR_CICLO - ev_svc.operaciones_en_ciclo(db, usuario.id)
        if faltan > 0:
            raise HTTPException(409, f"Te faltan {faltan} operación(es) para desbloquear tu evaluación.")
        ev = ev_svc.crear_evaluacion(db, usuario)
    return {"id": ev.id, "preguntas": ev_svc.preguntas_publicas(ev)}


@router.post("/me/evaluacion/{id_evaluacion}/responder")
def responder_evaluacion(
    id_evaluacion: int, datos: RespuestasIn,
    usuario: Usuario = Depends(usuario_actual), db: Session = Depends(get_db),
):
    ev = db.get(Evaluacion, id_evaluacion)
    if ev is None or ev.id_usuario != usuario.id:
        raise HTTPException(404, "Evaluación no encontrada")
    if ev.completada_en is not None:
        raise HTTPException(409, "Esta evaluación ya fue respondida.")
    if len(datos.respuestas) != ev.total:
        raise HTTPException(400, f"Debes enviar {ev.total} respuestas (usa null si dejas alguna en blanco).")
    return ev_svc.calificar(db, ev, datos.respuestas)
