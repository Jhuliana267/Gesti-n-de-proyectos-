"""Generación y calificación del quiz, basado en lo que el usuario hizo en su ciclo."""
import json
import random
from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

import config
from models import Accion, Evaluacion, Transaccion, Usuario, ahora
from servicios import repasar, resumen_portafolio

TOTAL_PREGUNTAS = 5


# ---------- Ciclo ----------
def _ultima_completada(db: Session, id_usuario: int) -> Evaluacion | None:
    return db.scalar(
        select(Evaluacion)
        .where(Evaluacion.id_usuario == id_usuario, Evaluacion.completada_en.is_not(None))
        .order_by(Evaluacion.id.desc())
        .limit(1)
    )


def inicio_ciclo(db: Session, id_usuario: int) -> int:
    ultima = _ultima_completada(db, id_usuario)
    return ultima.hasta_transaccion_id if ultima else 0


def operaciones_en_ciclo(db: Session, id_usuario: int) -> int:
    return db.scalar(
        select(func.count()).select_from(Transaccion)
        .where(Transaccion.id_usuario == id_usuario, Transaccion.id > inicio_ciclo(db, id_usuario))
    ) or 0


def evaluacion_pendiente(db: Session, id_usuario: int) -> Evaluacion | None:
    return db.scalar(
        select(Evaluacion)
        .where(Evaluacion.id_usuario == id_usuario, Evaluacion.completada_en.is_(None))
        .order_by(Evaluacion.id.desc())
        .limit(1)
    )


# ---------- Utilidades de preguntas ----------
def _pregunta(texto, opciones, correcta, explicacion, rnd):
    opciones = list(opciones)
    rnd.shuffle(opciones)
    return {"texto": texto, "opciones": opciones, "correcta": opciones.index(correcta), "explicacion": explicacion}


def _fmt_resultado(x: float) -> str:
    if abs(x) < 0.005:
        return "Ni ganancia ni pérdida ($0.00)"
    return f"Ganancia de ${x:,.2f}" if x > 0 else f"Pérdida de ${abs(x):,.2f}"


def _opciones_numericas(correcto: float, rnd: random.Random) -> list[str]:
    base = max(abs(correcto), 10.0)
    candidatos = [round(correcto, 2)]
    for c in [-correcto, correcto * 2, correcto * 0.5, base * 0.1, -base * 0.1, base * 1.5, -base * 0.5]:
        c = round(c, 2)
        if all(abs(c - x) > 0.01 for x in candidatos):
            candidatos.append(c)
        if len(candidatos) == 4:
            break
    return [_fmt_resultado(c) for c in candidatos]


# ---------- Preguntas personalizadas ----------
def _q_posicion_abierta(resumen, rnd):
    if not resumen["posiciones"]:
        return None
    p = max(resumen["posiciones"], key=lambda x: x["valor_mercado"])
    correcto = round((p["precio_actual"] - p["precio_promedio"]) * p["cantidad"], 2)
    texto = (f"Tienes {p['cantidad']} acciones de {p['nombre_empresa']} ({p['ticker']}). Las compraste en promedio "
             f"a ${p['precio_promedio']:,.2f} y ahora cada una vale ${p['precio_actual']:,.2f}. "
             "Si las vendieras ahora, ¿cuál sería tu resultado?")
    expl = (f"Resultado = (precio actual − precio de compra) × cantidad = "
            f"({p['precio_actual']:,.2f} − {p['precio_promedio']:,.2f}) × {p['cantidad']} = {correcto:,.2f}. "
            "Mientras no vendas, es una ganancia o pérdida NO realizada: cambia cada vez que se mueve el precio.")
    return _pregunta(texto, _opciones_numericas(correcto, rnd), _fmt_resultado(correcto), expl, rnd)


def _q_ultima_venta(eventos_ciclo, rnd):
    ventas = [e for e in eventos_ciclo if e["tipo"] == "venta"]
    if not ventas:
        return None
    v = ventas[-1]
    g = v["ganancia_realizada"]
    correcto = "Ganaste dinero" if g > 0.005 else "Perdiste dinero" if g < -0.005 else "Quedaste igual"
    texto = (f"Vendiste {v['cantidad']} acciones de {v['ticker']} a ${v['precio']:,.2f}. Antes las habías "
             f"comprado en promedio a ${v['costo_promedio_previo']:,.2f}. ¿Cómo resultó esa venta?")
    expl = (f"Comparas el precio de venta (${v['precio']:,.2f}) con el de compra (${v['costo_promedio_previo']:,.2f}). "
            f"Resultado: {_fmt_resultado(g).lower()}. Ganas cuando vendes MÁS CARO de lo que compraste.")
    return _pregunta(texto, ["Ganaste dinero", "Perdiste dinero", "Quedaste igual"], correcto, expl, rnd)


def _q_mas_operada(eventos_ciclo, db, rnd):
    if not eventos_ciclo:
        return None
    cuenta = Counter(e["ticker"] for e in eventos_ciclo).most_common()
    if len(cuenta) > 1 and cuenta[0][1] == cuenta[1][1]:
        return None  # empate: pregunta ambigua
    top = cuenta[0][0]
    otros = [t for t in db.scalars(select(Accion.ticker)).all() if t != top]
    rnd.shuffle(otros)
    opciones = [top] + otros[:3]
    if len(opciones) < 2:
        return None
    expl = (f"En este ciclo operaste {cuenta[0][1]} veces con {top}. Revisar tu historial te ayuda a notar "
            "tus hábitos: ¿estás concentrando todo en una sola empresa?")
    return _pregunta("¿Con cuál acción hiciste MÁS operaciones en este ciclo?", opciones, top, expl, rnd)


def _q_resultado_global(resumen, rnd, capital_inicial):
    pat = resumen["patrimonio_total"]
    dif = pat - capital_inicial
    correcto = "Voy ganando dinero" if dif > 0.005 else "Voy perdiendo dinero" if dif < -0.005 else "Estoy exactamente igual"
    texto = (f"Empezaste con ${capital_inicial:,.2f}. Hoy tu patrimonio (efectivo + valor de tus acciones) es "
             f"${pat:,.2f}. ¿Cómo va tu simulación?")
    expl = ("El patrimonio total es efectivo + acciones a precio de hoy. "
            f"Si es mayor que ${capital_inicial:,.2f} vas ganando; si es menor, perdiendo. Tu diferencia: {dif:+,.2f}.")
    return _pregunta(texto, ["Voy ganando dinero", "Voy perdiendo dinero", "Estoy exactamente igual"], correcto, expl, rnd)


def _q_diversificacion(resumen, rnd):
    n = len(resumen["posiciones"])
    opciones = [str(n)]
    for x in [n + 1, n + 2, max(n - 1, 0), n + 3, n + 4]:
        if str(x) not in opciones:
            opciones.append(str(x))
        if len(opciones) == 4:
            break
    expl = ("Tener acciones de varias empresas se llama DIVERSIFICAR. Si una empresa cae, las otras pueden "
            f"compensar. Hoy tienes inversión en {n} empresa(s).")
    return _pregunta("¿En cuántas empresas distintas tienes acciones en este momento?", opciones, str(n), expl, rnd)


# ---------- Preguntas conceptuales (relleno) ----------
CONCEPTUALES = [
    ("Compras una acción a $50 y después vale $65. Si la vendes, ¿cuánto ganas por acción?",
     ["$15", "$65", "$50", "$115"], "$15", "Ganancia = precio de venta − precio de compra = 65 − 50 = $15."),
    ("¿Cuándo se vuelve REAL una ganancia o una pérdida?",
     ["Cuando vendes la acción", "Cuando el precio sube", "Cuando compras la acción", "Cuando termina el día"],
     "Cuando vendes la acción", "Mientras tengas la acción, la ganancia o pérdida es solo 'en papel' y puede cambiar."),
    ("¿Por qué se aconseja diversificar (no poner todo en una sola empresa)?",
     ["Para que una mala noticia de una empresa no destruya todo tu dinero",
      "Para pagar menos impuestos", "Porque así las acciones siempre suben", "Porque es obligatorio"],
     "Para que una mala noticia de una empresa no destruya todo tu dinero",
     "Diversificar reparte el riesgo, aunque no elimina la posibilidad de perder."),
    ("¿Qué significa que una acción es 'volátil'?",
     ["Que su precio sube y baja mucho y rápido", "Que nunca cambia de precio",
      "Que solo puede subir", "Que es de una empresa pequeña"],
     "Que su precio sube y baja mucho y rápido", "A mayor volatilidad, mayor oportunidad pero también mayor riesgo."),
    ("Si muchas personas quieren comprar una acción y pocas quieren venderla, ¿qué tiende a pasar con su precio?",
     ["Tiende a subir", "Tiende a bajar", "Se queda igual siempre", "Desaparece la acción"],
     "Tiende a subir", "Más demanda que oferta empuja el precio hacia arriba (y al revés)."),
]


def generar_preguntas(db: Session, usuario: Usuario, rnd: random.Random | None = None) -> list[dict]:
    rnd = rnd or random.Random()
    eventos, _ = repasar(db, usuario.id)
    corte = inicio_ciclo(db, usuario.id)
    ciclo = [e for e in eventos if e["id"] > corte]
    resumen = resumen_portafolio(db, usuario)

    candidatas = [
        _q_posicion_abierta(resumen, rnd),
        _q_ultima_venta(ciclo, rnd),
        _q_mas_operada(ciclo, db, rnd),
        _q_resultado_global(resumen, rnd, usuario.saldo_inicial),
        _q_diversificacion(resumen, rnd),
    ]
    preguntas = [q for q in candidatas if q][: TOTAL_PREGUNTAS - 1]
    pool = CONCEPTUALES[:]
    rnd.shuffle(pool)
    for texto, ops, correcta, expl in pool:
        if len(preguntas) >= TOTAL_PREGUNTAS:
            break
        preguntas.append(_pregunta(texto, ops, correcta, expl, rnd))
    return preguntas


def crear_evaluacion(db: Session, usuario: Usuario) -> Evaluacion:
    preguntas = generar_preguntas(db, usuario)
    ultima_tx = db.scalar(select(func.max(Transaccion.id)).where(Transaccion.id_usuario == usuario.id)) or 0
    ev = Evaluacion(
        id_usuario=usuario.id, hasta_transaccion_id=ultima_tx,
        preguntas_json=json.dumps(preguntas, ensure_ascii=False), total=len(preguntas),
    )
    db.add(ev)
    db.commit()
    return ev


def preguntas_publicas(ev: Evaluacion) -> list[dict]:
    """Versión para el navegador: SIN la respuesta correcta ni la explicación."""
    return [{"texto": q["texto"], "opciones": q["opciones"]} for q in json.loads(ev.preguntas_json)]


def calificar(db: Session, ev: Evaluacion, respuestas: list[int | None]) -> dict:
    preguntas = json.loads(ev.preguntas_json)
    detalle, puntaje = [], 0
    for q, r in zip(preguntas, respuestas):
        ok = r == q["correcta"]
        puntaje += ok
        detalle.append({
            "texto": q["texto"], "opciones": q["opciones"], "elegida": r,
            "correcta": q["correcta"], "acerto": ok, "explicacion": q["explicacion"],
        })
    ev.respuestas_json = json.dumps(respuestas)
    ev.puntaje = puntaje
    ev.completada_en = ahora()
    db.commit()
    pct = puntaje / ev.total if ev.total else 0
    mensaje = ("🏆 ¡Excelente! Dominas lo básico." if pct >= 0.8 else
               "👍 ¡Buen trabajo! Repasa las explicaciones para afinar." if pct >= 0.5 else
               "🌱 Vas empezando, y está bien. Lee las explicaciones y vuelve a intentarlo en el próximo ciclo.")
    return {"puntaje": puntaje, "total": ev.total, "mensaje": mensaje, "detalle": detalle}
