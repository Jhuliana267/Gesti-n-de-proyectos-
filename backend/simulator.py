"""Simulador de mercado.

Modelo: Movimiento Browniano Geométrico (GBM) con reversión suave a la media.

    S(t+1) = S(t) * exp( (mu + k*ln(S_base/S(t)) - sigma²/2) + sigma * Z ),   Z ~ N(0,1)

- sigma (volatilidad): tamaño típico del movimiento por tick acelerado; cada tick representa
  aproximadamente una hora de mercado simulado y cada empresa tiene su propia volatilidad.
- mu (deriva): tendencia de fondo (muy pequeña).
- k (reversión): jala el precio hacia su valor base para que no se dispare ni colapse.
- Se limita el cambio máximo por tick (±MAX_CAMBIO) para mantener la volatilidad "controlada".
"""
import asyncio
import math
import random

from sqlalchemy import delete, func, select

from database import SessionLocal
from models import Accion, PrecioHistorico

INTERVALO_SEGUNDOS = 3.0
REVERSION_K = 0.02
MAX_CAMBIO = 0.025  # ±2.5 % por tick
PRECIO_MINIMO = 1.0
HISTORIAL_MAXIMO = 500  # puntos conservados por acción
_ticks = 0

ACCIONES_INICIALES = [
    # nombre, ticker, precio, sigma, mu
    ("TechCorp", "TECH", 150.0, 0.0035, 0.00002),
    ("EcoEnergy", "ECOE", 80.0, 0.0045, 0.00001),
    ("BioSalud", "BIOS", 45.0, 0.0075, 0.00000),
    ("AgroFuturo", "AGRO", 30.0, 0.0020, 0.00000),
    ("GameVerse", "GAME", 120.0, 0.0090, 0.00003),
]


def siguiente_precio(precio: float, base: float, sigma: float, mu: float) -> float:
    z = random.gauss(0.0, 1.0)
    reversion = REVERSION_K * math.log(base / precio)
    retorno = (mu + reversion - 0.5 * sigma**2) + sigma * z
    retorno = max(-MAX_CAMBIO, min(MAX_CAMBIO, retorno))
    return round(max(PRECIO_MINIMO, precio * math.exp(retorno)), 2)


def sembrar_mercado(db) -> None:
    """Crea el mercado o actualiza sus parámetros sin alterar precios ni historial."""
    if db.scalar(select(func.count()).select_from(Accion)):
        for _, ticker, precio, sigma, mu in ACCIONES_INICIALES:
            accion = db.scalar(select(Accion).where(Accion.ticker == ticker))
            if accion:
                accion.precio_base = precio
                accion.volatilidad = sigma
                accion.deriva = mu
        db.commit()
        return
    for nombre, ticker, precio, sigma, mu in ACCIONES_INICIALES:
        accion = Accion(
            nombre_empresa=nombre, ticker=ticker, precio_actual=precio,
            precio_base=precio, volatilidad=sigma, deriva=mu,
        )
        db.add(accion)
        db.flush()
        p = precio
        for _ in range(60):  # historia previa para que el gráfico no empiece vacío
            p = siguiente_precio(p, precio, sigma, mu)
            db.add(PrecioHistorico(id_accion=accion.id, precio=p))
        accion.precio_actual = p
    db.commit()


def ejecutar_tick() -> None:
    """Un paso del mercado: actualiza todos los precios y guarda el historial."""
    global _ticks
    _ticks += 1
    with SessionLocal() as db:
        for a in db.scalars(select(Accion)).all():
            a.precio_actual = siguiente_precio(a.precio_actual, a.precio_base, a.volatilidad, a.deriva)
            db.add(PrecioHistorico(id_accion=a.id, precio=a.precio_actual))
        db.commit()
        if _ticks % 100 == 0:
            _podar_historial(db)


def _podar_historial(db) -> None:
    for (id_accion,) in db.execute(select(Accion.id)).all():
        corte = db.scalar(
            select(PrecioHistorico.id)
            .where(PrecioHistorico.id_accion == id_accion)
            .order_by(PrecioHistorico.id.desc())
            .offset(HISTORIAL_MAXIMO)
            .limit(1)
        )
        if corte:
            db.execute(
                delete(PrecioHistorico).where(
                    PrecioHistorico.id_accion == id_accion, PrecioHistorico.id <= corte
                )
            )
    db.commit()


async def bucle_mercado() -> None:
    while True:
        await asyncio.sleep(INTERVALO_SEGUNDOS)
        try:
            await asyncio.to_thread(ejecutar_tick)
        except Exception as exc:  # el mercado nunca debe morir por un error puntual
            print(f"[simulador] error: {exc}")
