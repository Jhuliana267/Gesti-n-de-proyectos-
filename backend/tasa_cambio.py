"""Consulta tasas oficiales de la Superintendencia Financiera y del Banco Central Europeo."""
import logging
import math
import threading
import time
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api", tags=["tasas"])
logger = logging.getLogger(__name__)

API_TRM = "https://www.datos.gov.co/resource/mcec-87by.json"
FUENTE_TRM = "https://www.datos.gov.co/Econom-a-y-Finanzas/Tasa-de-Cambio-Representativa-del-Mercado-Historic/mcec-87by"
API_ECB = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
FUENTE_ECB = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"
CODIGOS_ECB = ("USD", "CNY", "MXN", "BRL", "GBP", "JPY", "CAD", "CHF", "AUD")
CACHE_SEGUNDOS = 3600
ESPERA_ENTRE_ACTUALIZACIONES_MANUALES = 60
ZONA_COLOMBIA = timezone(timedelta(hours=-5))
_cache: tuple[dict, float] | None = None
_cache_lock = threading.Lock()
_ultimo_refresco_manual: float | None = None


def _consultar_tasas_ecb() -> tuple[dict[str, float], str]:
    respuesta = httpx.get(API_ECB, timeout=12.0)
    respuesta.raise_for_status()
    raiz = ElementTree.fromstring(respuesta.content)
    tasas_eur: dict[str, float] = {}
    fecha = next((element.attrib["time"] for element in raiz.iter() if "time" in element.attrib), None)
    for elemento in raiz.iter():
        codigo = elemento.attrib.get("currency")
        valor_texto = elemento.attrib.get("rate")
        try:
            valor = float(valor_texto)
        except (TypeError, ValueError):
            continue
        if codigo in CODIGOS_ECB and math.isfinite(valor) and valor > 0:
            tasas_eur[codigo] = valor

    if set(tasas_eur) != set(CODIGOS_ECB) or fecha is None:
        raise ValueError("La respuesta del BCE no incluye todas las monedas requeridas.")
    fecha_ecb = fecha
    fecha_dato = datetime.fromisoformat(fecha_ecb).date()
    hoy = datetime.now(ZONA_COLOMBIA).date()
    if (hoy - fecha_dato).days > 7 or fecha_dato > hoy:
        raise ValueError("Las tasas de referencia del BCE están vencidas.")

    usd_por_eur = tasas_eur["USD"]
    tasas_por_usd = {
        codigo: round(valor / usd_por_eur, 8)
        for codigo, valor in tasas_eur.items()
    }
    tasas_por_usd["USD"] = 1.0
    tasas_por_usd["EUR"] = round(1 / usd_por_eur, 8)
    return tasas_por_usd, fecha_ecb


def obtener_trm(forzar: bool = False) -> dict:
    """Devuelve todas las conversiones oficiales que estén disponibles."""
    global _cache, _ultimo_refresco_manual
    ahora = time.monotonic()
    hoy = datetime.now(ZONA_COLOMBIA).date()
    with _cache_lock:
        if forzar and _ultimo_refresco_manual is not None:
            espera_restante = ESPERA_ENTRE_ACTUALIZACIONES_MANUALES - (ahora - _ultimo_refresco_manual)
            if espera_restante > 0:
                raise HTTPException(
                    429,
                    f"Espera {math.ceil(espera_restante)} segundos antes de volver a actualizar la TRM.",
                )
        if _cache and ahora < _cache[1]:
            if not forzar:
                return _cache[0]

        if forzar:
            _ultimo_refresco_manual = ahora
        fecha = hoy.isoformat()
        tasas_por_usd = {"USD": 1.0}
        desde = None
        hasta = None
        fecha_ecb = None
        try:
            respuesta = httpx.get(
                API_TRM,
                params={
                    "$select": "valor,unidad,vigenciadesde,vigenciahasta",
                    "$where": (
                        f"vigenciadesde <= '{fecha}T00:00:00' "
                        f"AND vigenciahasta >= '{fecha}T00:00:00'"
                    ),
                    "$order": "vigenciadesde DESC",
                    "$limit": "1",
                },
                timeout=8.0,
            )
            respuesta.raise_for_status()
            filas = respuesta.json()
            if not isinstance(filas, list) or not filas:
                raise ValueError("No hay una TRM vigente para la fecha actual.")
            fila = filas[0]
            valor = float(fila["valor"])
            desde = datetime.fromisoformat(fila["vigenciadesde"][:10]).date()
            hasta = datetime.fromisoformat(fila["vigenciahasta"][:10]).date()
            if (
                fila["unidad"] != "COP"
                or not math.isfinite(valor)
                or valor <= 0
                or not desde <= hoy <= hasta
            ):
                raise ValueError("La fuente devolvió una TRM inválida o no vigente.")
        except (httpx.HTTPError, ElementTree.ParseError, ValueError, TypeError, KeyError) as exc:
            logger.warning("No se pudo consultar la TRM oficial de Colombia: %s", exc)
        else:
            tasas_por_usd["COP"] = valor

        try:
            tasas_ecb, fecha_ecb = _consultar_tasas_ecb()
        except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
            logger.warning("No se pudieron consultar las tasas oficiales del BCE: %s", exc)
        else:
            tasas_por_usd.update(tasas_ecb)

        if len(tasas_por_usd) == 1:
            logger.error("No se pudo consultar ninguna fuente oficial de tasas")
            raise HTTPException(
                503, "No se pudo consultar ninguna fuente oficial de tasas. Intenta de nuevo más tarde."
            )

        dato = {
            "base_code": "USD",
            "tasas_por_usd": tasas_por_usd,
            "valor_cop_por_usd": tasas_por_usd.get("COP"),
            "vigencia_desde": desde.isoformat() if desde else None,
            "vigencia_hasta": hasta.isoformat() if hasta else None,
            "vigencia_ecb": fecha_ecb,
            "fuente_trm": "Superintendencia Financiera de Colombia",
            "url_fuente_trm": FUENTE_TRM,
            "fuente_ecb": "Banco Central Europeo",
            "url_fuente_ecb": FUENTE_ECB,
        }
        _cache = (dato, ahora + CACHE_SEGUNDOS)
        return dato


@router.get("/tasa-cambio")
def tasa_cambio():
    return obtener_trm()


@router.post("/tasa-cambio/actualizar")
def actualizar_tasa_cambio():
    return obtener_trm(forzar=True)
