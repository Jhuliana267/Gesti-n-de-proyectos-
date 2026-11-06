"""Lógica de negocio compartida: posiciones, portafolio y snapshots de patrimonio."""
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

import config
from models import (
    TIPOS_MOVIMIENTO, Accion, MovimientoBilletera,
    SnapshotPatrimonio, Transaccion, Usuario,
)

def registrar_movimiento(
    db: Session, usuario: Usuario, tipo: str, monto: float,
    descripcion: str, id_transaccion: int | None = None,
) -> None:
    """Anota un asiento en la billetera. No hace commit: quien la llama confirma,
    así el saldo y su asiento se guardan juntos o no se guarda ninguno."""
    if tipo not in TIPOS_MOVIMIENTO:
        raise ValueError(f"Tipo de movimiento desconocido: {tipo}")
    db.add(MovimientoBilletera(
        id_usuario=usuario.id, tipo=tipo, monto=round(monto, 2),
        saldo_posterior=round(usuario.saldo_ficticio, 2),
        descripcion=descripcion[:200], id_transaccion=id_transaccion,
    ))

def iso(dt) -> str:
    return dt.isoformat() + "Z"


def repasar(db: Session, id_usuario: int):
    """Reproduce el historial del usuario operación por operación.

    Devuelve (eventos, posiciones):
      - eventos: una fila por transacción, con el costo promedio previo y la
        ganancia realizada (solo en ventas).
      - posiciones: {id_accion: {cantidad, costo_total}} con lo que tiene hoy.
    """
    filas = db.execute(
        select(Transaccion, Accion.ticker, Accion.nombre_empresa)
        .join(Accion, Accion.id == Transaccion.id_accion)
        .where(Transaccion.id_usuario == id_usuario)
        .order_by(Transaccion.id)
    ).all()
    posiciones: dict[int, dict] = {}
    eventos = []
    for t, ticker, empresa in filas:
        p = posiciones.setdefault(t.id_accion, {"cantidad": 0, "costo_total": 0.0})
        promedio = p["costo_total"] / p["cantidad"] if p["cantidad"] else 0.0
        ganancia = None
        if t.tipo_operacion == "compra":
            p["cantidad"] += t.cantidad
            p["costo_total"] += t.cantidad * t.precio_historico
        else:
            ganancia = round((t.precio_historico - promedio) * t.cantidad, 2)
            p["cantidad"] -= t.cantidad
            p["costo_total"] -= promedio * t.cantidad
            if p["cantidad"] == 0:
                p["costo_total"] = 0.0
        eventos.append({
            "id": t.id, "id_accion": t.id_accion, "ticker": ticker, "empresa": empresa,
            "tipo": t.tipo_operacion, "cantidad": t.cantidad, "precio": t.precio_historico,
            "costo_promedio_previo": round(promedio, 2), "ganancia_realizada": ganancia,
            "fecha": t.fecha,
        })
    return eventos, posiciones


def calcular_posiciones(db: Session, id_usuario: int) -> dict[int, dict]:
    return repasar(db, id_usuario)[1]


def resumen_portafolio(db: Session, usuario: Usuario) -> dict:
    acciones = {a.id: a for a in db.scalars(select(Accion)).all()}
    posiciones, valor_total = [], 0.0
    for id_accion, p in calcular_posiciones(db, usuario.id).items():
        if p["cantidad"] <= 0:
            continue
        a = acciones[id_accion]
        valor = p["cantidad"] * a.precio_actual
        promedio = p["costo_total"] / p["cantidad"]
        ganancia = valor - p["costo_total"]
        valor_total += valor
        posiciones.append({
            "id_accion": id_accion,
            "ticker": a.ticker,
            "nombre_empresa": a.nombre_empresa,
            "cantidad": p["cantidad"],
            "precio_promedio": round(promedio, 2),
            "precio_actual": a.precio_actual,
            "valor_mercado": round(valor, 2),
            "ganancia": round(ganancia, 2),
            "ganancia_pct": round(ganancia / p["costo_total"] * 100, 2) if p["costo_total"] else 0.0,
        })
    patrimonio = usuario.saldo_ficticio + valor_total
    return {
        "saldo_ficticio": round(usuario.saldo_ficticio, 2),
        "valor_inversiones": round(valor_total, 2),
        "patrimonio_total": round(patrimonio, 2),
        "ganancia_total": round(patrimonio - usuario.saldo_inicial, 2),
        "posiciones": posiciones,
    }


def registrar_snapshot(db: Session, usuario: Usuario, resumen: dict | None = None) -> None:
    """Guarda una foto del patrimonio del usuario y conserva solo las más recientes."""
    r = resumen or resumen_portafolio(db, usuario)
    db.add(SnapshotPatrimonio(
        id_usuario=usuario.id, saldo=r["saldo_ficticio"],
        valor_inversiones=r["valor_inversiones"], patrimonio=r["patrimonio_total"],
    ))
    db.commit()
    total = db.scalar(select(func.count()).select_from(SnapshotPatrimonio)
                      .where(SnapshotPatrimonio.id_usuario == usuario.id))
    if total and total > config.SNAPSHOTS_MAXIMOS_POR_USUARIO:
        corte = db.scalar(
            select(SnapshotPatrimonio.id).where(SnapshotPatrimonio.id_usuario == usuario.id)
            .order_by(SnapshotPatrimonio.id.desc()).offset(config.SNAPSHOTS_MAXIMOS_POR_USUARIO).limit(1)
        )
        if corte:
            db.execute(delete(SnapshotPatrimonio).where(
                SnapshotPatrimonio.id_usuario == usuario.id, SnapshotPatrimonio.id <= corte))
            db.commit()
