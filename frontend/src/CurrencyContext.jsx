import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "./api";

const CLAVE_MONEDA = "inversim_moneda";
const CODIGOS = ["USD", "COP", "EUR", "CNY", "MXN", "BRL", "GBP", "JPY", "CAD", "CHF", "AUD"];

function leerMoneda() {
  try {
    const moneda = localStorage.getItem(CLAVE_MONEDA);
    return CODIGOS.includes(moneda) ? moneda : "USD";
  } catch {
    return "USD";
  }
}

function tasasValidas(datos) {
  const tasas = datos?.tasas_por_usd;
  return datos?.base_code === "USD" &&
    tasas?.USD === 1 &&
    Object.entries(tasas).every(([codigo, valor]) =>
      CODIGOS.includes(codigo) && Number.isFinite(valor) && valor > 0
    ) &&
    CODIGOS.some((codigo) => codigo !== "USD" && Number.isFinite(tasas[codigo]) && tasas[codigo] > 0);
}

function guardarMoneda(codigo) {
  try {
    localStorage.setItem(CLAVE_MONEDA, codigo);
  } catch {
    // La moneda elegida se conserva durante esta sesión aunque el navegador bloquee el almacenamiento.
  }
}

const CurrencyContext = createContext(null);

export function useCurrency() {
  const contexto = useContext(CurrencyContext);
  if (!contexto) throw new Error("useCurrency debe usarse dentro de CurrencyProvider");
  return contexto;
}

export function CurrencyProvider({ children }) {
  const { i18n } = useTranslation();
  const [moneda, setMoneda] = useState(leerMoneda);
  const [tasa, setTasa] = useState(null);
  const [estado, setEstado] = useState("cargando");
  const [actualizando, setActualizando] = useState(false);
  const [errorActualizacion, setErrorActualizacion] = useState("");

  const actualizarTasa = useCallback(async () => {
    if (actualizando) return;
    setActualizando(true);
    setErrorActualizacion("");
    try {
      const datos = await api.actualizarTasaCambio();
      if (!tasasValidas(datos)) {
        throw new Error("La respuesta de las tasas oficiales está incompleta");
      }
      setTasa(datos);
      setEstado(CODIGOS.every((codigo) => Number.isFinite(datos.tasas_por_usd[codigo])) ? "lista" : "parcial");
      setMoneda((actual) => {
        if (Number.isFinite(datos.tasas_por_usd[actual])) return actual;
        guardarMoneda("USD");
        return "USD";
      });
    } catch (error) {
      console.error("No se pudieron actualizar las tasas oficiales:", error);
      setErrorActualizacion(error.message || "No se pudieron actualizar las tasas oficiales.");
      return false;
    } finally {
      setActualizando(false);
    }
  }, [actualizando]);

  useEffect(() => {
    let activa = true;
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), 25_000);
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/tasa-cambio`, { signal: controlador.signal })
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status} al consultar las tasas`);
        return respuesta.json();
      })
      .then((datos) => {
        if (!tasasValidas(datos)) {
          throw new Error("La respuesta de las tasas oficiales está incompleta");
        }
        if (!activa) return;
        setTasa(datos);
        setEstado(CODIGOS.every((codigo) => Number.isFinite(datos.tasas_por_usd[codigo])) ? "lista" : "parcial");
        setMoneda((actual) => {
          if (Number.isFinite(datos.tasas_por_usd[actual])) return actual;
          guardarMoneda("USD");
          return "USD";
        });
      })
      .catch((error) => {
        if (error.name !== "AbortError") console.error("No se pudieron cargar las tasas oficiales:", error);
        if (activa) {
          setEstado("error");
          setMoneda((actual) => {
            if (actual === "USD") return actual;
            guardarMoneda("USD");
            return "USD";
          });
        }
      })
      .finally(() => {
        clearTimeout(limite);
      });
    return () => {
      activa = false;
      clearTimeout(limite);
      controlador.abort();
    };
  }, []);

  const elegirMoneda = useCallback((codigo) => {
    if (!CODIGOS.includes(codigo) || !Number.isFinite(tasa?.tasas_por_usd?.[codigo])) return;
    setMoneda(codigo);
    guardarMoneda(codigo);
  }, [tasa]);

  const formatCurrency = useCallback((valor, opciones = {}) => {
    const tasaConversion = moneda === "USD" ? 1 : tasa?.tasas_por_usd?.[moneda];
    if (!tasaConversion || !Number.isFinite(valor)) return "—";
    const locale = { es: "es-CO", en: "en-US", pt: "pt-BR" }[i18n.resolvedLanguage] ?? "es-CO";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: moneda,
      ...opciones,
    }).format(valor * tasaConversion);
  }, [i18n.resolvedLanguage, moneda, tasa]);

  const formatCapitalInicial = useCallback(() => {
    const tasaCop = tasa?.tasas_por_usd?.COP;
    if (tasaCop) return formatCurrency(3_000_000 / tasaCop);
    const locale = { es: "es-CO", en: "en-US", pt: "pt-BR" }[i18n.resolvedLanguage] ?? "es-CO";
    return new Intl.NumberFormat(locale, { style: "currency", currency: "COP" }).format(3_000_000);
  }, [formatCurrency, i18n.resolvedLanguage, tasa]);

  const valor = useMemo(() => ({
    moneda,
    monedas: CODIGOS,
    monedasDisponibles: Object.keys(tasa?.tasas_por_usd ?? {}),
    estado,
    tasasDisponibles: Boolean(tasa),
    vigenciaDesde: tasa?.vigencia_desde ?? null,
    vigenciaEcb: tasa?.vigencia_ecb ?? null,
    fuenteTrm: tasa?.url_fuente_trm ?? null,
    fuenteEcb: tasa?.url_fuente_ecb ?? null,
    actualizando,
    errorActualizacion,
    elegirMoneda,
    actualizarTasa,
    formatCurrency,
    formatCapitalInicial,
  }), [
    actualizarTasa, actualizando, elegirMoneda, errorActualizacion, estado,
    formatCapitalInicial, formatCurrency, moneda, tasa,
  ]);

  return <CurrencyContext.Provider value={valor}>{children}</CurrencyContext.Provider>;
}
