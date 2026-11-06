"""API REST de InverSim (FastAPI) — v2 con autenticación, mentor IA y progreso."""
import config  # noqa: F401  (debe ir primero: carga las variables de .env)

import asyncio
import math
import random
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

import auth_routes
import cuenta
import mentor
import progreso
import simulator
import tasa_cambio
from auth import usuario_actual
from database import Base, SessionLocal, engine, get_db
from models import (
    Accion, MovimientoBilletera, PrecioHistorico, SnapshotPatrimonio, Transaccion, Usuario,
)
from servicios import calcular_posiciones, iso, registrar_movimiento, registrar_snapshot, resumen_portafolio


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    migrar_saldo_inicial()
    with SessionLocal() as db:
        simulator.sembrar_mercado(db)
    tareas = [
        asyncio.create_task(simulator.bucle_mercado()),
        asyncio.create_task(progreso.bucle_snapshots()),  # NUEVO
    ]
    yield
    for t in tareas:
        t.cancel()


app = FastAPI(title="InverSim API", version="2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],  # incluye Authorization
)

# NUEVO: routers de los módulos
app.include_router(auth_routes.router)
app.include_router(cuenta.router)  # NUEVO
app.include_router(mentor.router)
app.include_router(progreso.router)
app.include_router(tasa_cambio.router)


def migrar_saldo_inicial(db_engine=engine) -> None:
    if "saldo_inicial" not in {col["name"] for col in inspect(db_engine).get_columns("usuarios")}:
        with db_engine.begin() as conn:
            conn.exec_driver_sql(
                "ALTER TABLE usuarios ADD COLUMN saldo_inicial FLOAT NOT NULL DEFAULT 10000.0"
            )

    clave_migracion = "capital-inicial-3000000-cop-v1"
    descripcion_ajuste = "Ajuste único del capital inicial a 3.000.000 COP"
    with Session(db_engine) as db:
        db.execute(text(
            "CREATE TABLE IF NOT EXISTS migraciones_aplicadas ("
            "clave VARCHAR(100) PRIMARY KEY, "
            "fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ))
        fecha_migracion = db.execute(
            text("SELECT fecha FROM migraciones_aplicadas WHERE clave = :clave"),
            {"clave": clave_migracion},
        ).scalar_one_or_none()
        if fecha_migracion is None:
            fecha_limite = datetime.now(timezone.utc).replace(tzinfo=None)
        elif isinstance(fecha_migracion, str):
            fecha_limite = datetime.fromisoformat(fecha_migracion)
        else:
            fecha_limite = fecha_migracion

        usuarios = db.scalars(
            select(Usuario)
            .where(Usuario.creado_en <= fecha_limite)
            .with_for_update()
        ).all()
        for usuario in usuarios:
            ya_ajustado = db.scalar(
                select(MovimientoBilletera.id)
                .where(
                    MovimientoBilletera.id_usuario == usuario.id,
                    MovimientoBilletera.descripcion == descripcion_ajuste,
                )
                .limit(1)
            )
            if ya_ajustado:
                continue

            movimiento_inicial = db.scalar(
                select(MovimientoBilletera)
                .where(
                    MovimientoBilletera.id_usuario == usuario.id,
                    MovimientoBilletera.tipo == "inicial",
                )
                .order_by(MovimientoBilletera.id)
                .limit(1)
            )
            capital_anterior = (
                movimiento_inicial.monto if movimiento_inicial else usuario.saldo_inicial
            )
            capital_nuevo = round(capital_anterior * 3, 2)
            aumento = round(capital_nuevo - capital_anterior, 2)
            usuario.saldo_inicial = capital_nuevo
            usuario.saldo_ficticio = round(usuario.saldo_ficticio + aumento, 2)
            db.add(MovimientoBilletera(
                id_usuario=usuario.id,
                tipo="recarga",
                monto=aumento,
                saldo_posterior=usuario.saldo_ficticio,
                descripcion=descripcion_ajuste,
            ))
            resumen = resumen_portafolio(db, usuario)
            db.add(SnapshotPatrimonio(
                id_usuario=usuario.id,
                saldo=resumen["saldo_ficticio"],
                valor_inversiones=resumen["valor_inversiones"],
                patrimonio=resumen["patrimonio_total"],
            ))

        if fecha_migracion is None:
            db.execute(
                text("INSERT INTO migraciones_aplicadas (clave) VALUES (:clave)"),
                {"clave": clave_migracion},
            )
        db.commit()


# ---------- Esquemas ----------
class TransaccionCrear(BaseModel):
    # CAMBIO: ya no se envía id_usuario; el servidor lo saca del token.
    id_accion: int
    tipo_operacion: Literal["compra", "venta"]
    cantidad: int = Field(gt=0, le=1_000_000)


# ---------- Datos del usuario autenticado ----------
@app.get("/api/me/portafolio")
def portafolio(usuario: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)):
    return resumen_portafolio(db, usuario)


@app.get("/api/me/transacciones")
def historial_transacciones(
    limite: int = 20, usuario: Usuario = Depends(usuario_actual), db: Session = Depends(get_db)
):
    filas = db.execute(
        select(Transaccion, Accion.ticker)
        .join(Accion, Accion.id == Transaccion.id_accion)
        .where(Transaccion.id_usuario == usuario.id)
        .order_by(Transaccion.id.desc())
        .limit(min(limite, 100))
    ).all()
    return [
        {
            "id": t.id, "ticker": ticker, "tipo_operacion": t.tipo_operacion,
            "cantidad": t.cantidad, "precio_historico": t.precio_historico,
            "total": round(t.cantidad * t.precio_historico, 2), "fecha": iso(t.fecha),
        }
        for t, ticker in filas
    ]


# ---------- Mercado (público) ----------
def _accion_dict(a: Accion, anterior: float | None = None) -> dict:
    cambio = None
    if anterior:
        cambio = round((a.precio_actual - anterior) / anterior * 100, 2)
    return {
        "id": a.id,
        "nombre_empresa": a.nombre_empresa,
        "ticker": a.ticker,
        "precio_actual": a.precio_actual,
        "cambio_pct": cambio,
    }


@app.get("/api/acciones")
def listar_acciones(db: Session = Depends(get_db)):
    resultado = []
    for a in db.scalars(select(Accion).order_by(Accion.id)).all():
        ref = db.scalar(
            select(PrecioHistorico.precio)
            .where(PrecioHistorico.id_accion == a.id)
            .order_by(PrecioHistorico.id.desc())
            .offset(100)
            .limit(1)
        )
        if ref is None:
            ref = db.scalar(
                select(PrecioHistorico.precio)
                .where(PrecioHistorico.id_accion == a.id)
                .order_by(PrecioHistorico.id)
                .limit(1)
            )
        resultado.append(_accion_dict(a, ref))
    return resultado


@app.get("/api/acciones/{id_accion}/historial")
def historial_precios(id_accion: int, limite: int = 80, db: Session = Depends(get_db)):
    if not db.get(Accion, id_accion):
        raise HTTPException(404, "Acción no encontrada")
    filas = db.execute(
        select(PrecioHistorico.precio, PrecioHistorico.fecha)
        .where(PrecioHistorico.id_accion == id_accion)
        .order_by(PrecioHistorico.id.desc())
        .limit(min(limite, 500))
    ).all()
    return [{"precio": p, "fecha": iso(f)} for p, f in reversed(filas)]


@app.get("/api/acciones/{id_accion}/historial-simulado")
def historial_simulado(
    id_accion: int,
    periodo: Literal["1w", "1m", "1y"],
    db: Session = Depends(get_db),
):
    accion = db.get(Accion, id_accion)
    if not accion:
        raise HTTPException(404, "Acción no encontrada")

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    inicio = datetime(2020, 1, 1)
    dias = (ahora.date() - inicio.date()).days
    rng = random.Random(f"{accion.ticker}:historial-comun")
    precios_diarios = [max(1.0, accion.precio_base)]

    for _ in range(dias):
        anterior = precios_diarios[-1]
        reversion = min(0.08, simulator.REVERSION_K * 24) * math.log(
            max(1.0, accion.precio_base) / anterior
        )
        retorno = (
            (accion.deriva - 0.5 * accion.volatilidad**2) * 24
            + reversion
            + accion.volatilidad * math.sqrt(24) * rng.gauss(0, 1)
        )
        retorno = max(-0.15, min(0.15, retorno))
        precios_diarios.append(max(1.0, anterior * math.exp(retorno)))

    def precio_en(fecha: datetime) -> float:
        indice = min(max((fecha.date() - inicio.date()).days, 0), dias)
        return precios_diarios[indice]

    if periodo == "1w":
        fechas = [
            ahora - timedelta(weeks=12 - indice)
            for indice in range(13)
        ]
    elif periodo == "1m":
        mes_actual = ahora.year * 12 + ahora.month - 1
        fechas = [
            datetime((mes_actual - desplazamiento) // 12, (mes_actual - desplazamiento) % 12 + 1, 1)
            for desplazamiento in range(11, -1, -1)
        ]
        fechas[-1] = ahora
    else:
        fechas = [datetime(anio, 1, 1) for anio in range(2020, ahora.year)]
        fechas.append(ahora)

    precios = [precio_en(fecha) for fecha in fechas]
    escala = accion.precio_actual / precios_diarios[-1]
    return {
        "simulado": True,
        "puntos": [
            {
                "precio": round(precio * escala, 2),
                "fecha": iso(fecha),
            }
            for fecha, precio in zip(fechas[:-1], precios[:-1])
        ] + [
            {"precio": round(accion.precio_actual, 2), "fecha": iso(ahora)}
        ],
    }


# ---------- Transacciones (protegido) ----------
@app.post("/api/transacciones", status_code=201)
def operar(
    datos: TransaccionCrear,
    usuario: Usuario = Depends(usuario_actual),
    db: Session = Depends(get_db),
):
    accion = db.get(Accion, datos.id_accion)
    if not accion:
        raise HTTPException(404, "Acción no encontrada")

    precio = accion.precio_actual  # precio al momento de la orden
    total = round(precio * datos.cantidad, 2)
    posicion = calcular_posiciones(db, usuario.id).get(accion.id, {"cantidad": 0, "costo_total": 0.0})
    resultado = None  # ganancia/pérdida realizada (solo ventas)

    if datos.tipo_operacion == "compra":
        if usuario.saldo_ficticio < total:
            raise HTTPException(
                400,
                f"Saldo insuficiente: necesitas ${total:,.2f} y tienes ${usuario.saldo_ficticio:,.2f}.",
            )
        usuario.saldo_ficticio = round(usuario.saldo_ficticio - total, 2)
    else:
        if posicion["cantidad"] < datos.cantidad:
            raise HTTPException(
                400,
                f"No tienes suficientes acciones: quieres vender {datos.cantidad} "
                f"y tienes {posicion['cantidad']} de {accion.ticker}.",
            )
        promedio = posicion["costo_total"] / posicion["cantidad"]
        resultado = round((precio - promedio) * datos.cantidad, 2)
        usuario.saldo_ficticio = round(usuario.saldo_ficticio + total, 2)

    trx = Transaccion(
        id_usuario=usuario.id, id_accion=accion.id, tipo_operacion=datos.tipo_operacion,
        cantidad=datos.cantidad, precio_historico=precio,
    )
    db.add(trx)
    db.flush()  # autoflush está desactivado: hace falta trx.id para enlazar el movimiento
    es_compra = datos.tipo_operacion == "compra"
    registrar_movimiento(
        db, usuario, datos.tipo_operacion,
        monto=-total if es_compra else total,
        descripcion=f"{'Compra' if es_compra else 'Venta'} de {datos.cantidad} × {accion.ticker} a ${precio:,.2f}",
        id_transaccion=trx.id,
    )
    db.commit()
    registrar_snapshot(db, usuario)

    return {
        "mensaje": f"{'Compraste' if datos.tipo_operacion == 'compra' else 'Vendiste'} "
                   f"{datos.cantidad} × {accion.ticker} a ${precio:,.2f}",
        "tipo_operacion": datos.tipo_operacion,
        "ticker": accion.ticker,
        "cantidad": datos.cantidad,
        "precio": precio,
        "total": total,
        "ganancia_realizada": resultado,
        "saldo_ficticio": usuario.saldo_ficticio,
    }
