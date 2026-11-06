import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { dinero } from "./api";
import { useAuth } from "./AuthContext";
import { useCurrency } from "./CurrencyContext";

const AlertasCtx = createContext(null);
export const useAlertas = () => useContext(AlertasCtx);

const MAX_HISTORIAL = 30;
const MAX_TOASTS = 4;
const DURACION_TOAST = 6000; // ms; mantén sincronizado con la animación "barra" de tailwind.config.js

export const ESTILOS = {
  ganancia: { icono: "📈", caja: "border-green-500 bg-green-50 dark:bg-green-950/60", barra: "bg-green-500" },
  perdida: { icono: "📉", caja: "border-red-500 bg-red-50 dark:bg-red-950/60", barra: "bg-red-500" },
  neutro: { icono: "➖", caja: "border-gray-400 bg-gray-50 dark:bg-gray-800", barra: "bg-gray-400" },
  info: { icono: "🔔", caja: "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60", barra: "bg-indigo-500" },
  error: { icono: "⚠️", caja: "border-amber-500 bg-amber-50 dark:bg-amber-950/60", barra: "bg-amber-500" },
};

// Las alertas guardan datos crudos y el texto se traduce al mostrarlas: si cambias de idioma, se actualizan.
export function describir(alerta, t, formatear = dinero) {
  if (alerta.tipo === "venta") {
    const { ticker, cantidad, precio, resultado } = alerta.datos;
    const monto = formatear(Math.abs(resultado));
    const titulo =
      resultado > 0 ? t("alertas.venta.ganancia", { monto })
      : resultado < 0 ? t("alertas.venta.perdida", { monto })
      : t("alertas.venta.neutro");
    return {
      titulo,
      detalle: t("alertas.venta.detalle", { cantidad, ticker, precio: formatear(precio) }),
      estilo: resultado > 0 ? "ganancia" : resultado < 0 ? "perdida" : "neutro",
    };
  }
  return { titulo: alerta.texto, detalle: null, estilo: alerta.tipo };
}

const clave = (id) => `inversim_alertas_${id}`;
function leer(id) {
  try {
    const lista = JSON.parse(localStorage.getItem(clave(id)));
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
function guardar(id, lista) {
  try {
    localStorage.setItem(clave(id), JSON.stringify(lista));
  } catch {
    /* sin almacenamiento: el historial dura mientras la pestaña esté abierta */
  }
}

export function AlertasProvider({ children }) {
  const { usuario } = useAuth();
  const idUsuario = usuario?.id ?? null;
  const [historial, setHistorial] = useState([]); // lo que ve la campana
  const [toasts, setToasts] = useState([]); // lo que se ve flotando ahora mismo

  // Cada usuario tiene su propio historial.
  useEffect(() => {
    setHistorial(idUsuario ? leer(idUsuario) : []);
    setToasts([]);
  }, [idUsuario]);

  const cambiarHistorial = useCallback(
    (fn) =>
      setHistorial((previo) => {
        const nuevo = fn(previo);
        if (idUsuario) guardar(idUsuario, nuevo); // idempotente: no importa si React lo repite
        return nuevo;
      }),
    [idUsuario]
  );

  // { tipo: "venta", datos } o { tipo: "info" | "error", texto }
  const notificar = useCallback(
    (alerta) => {
      const nueva = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fecha: new Date().toISOString(),
        leida: false,
        ...alerta,
      };
      setToasts((v) => [...v, nueva].slice(-MAX_TOASTS));
      cambiarHistorial((v) => [nueva, ...v].slice(0, MAX_HISTORIAL));
    },
    [cambiarHistorial]
  );

  // api.operar() emite este evento cada vez que se completa una venta.
  useEffect(() => {
    const alVender = (e) => {
      const r = e.detail;
      notificar({
        tipo: "venta",
        datos: { ticker: r.ticker, cantidad: r.cantidad, precio: r.precio, resultado: r.ganancia_realizada ?? 0 },
      });
    };
    window.addEventListener("inversim:venta", alVender);
    return () => window.removeEventListener("inversim:venta", alVender);
  }, [notificar]);

  const cerrarToast = useCallback((id) => setToasts((v) => v.filter((a) => a.id !== id)), []);
  const marcarTodasLeidas = useCallback(
    () => cambiarHistorial((v) => (v.some((a) => !a.leida) ? v.map((a) => ({ ...a, leida: true })) : v)),
    [cambiarHistorial]
  );
  const limpiar = useCallback(() => cambiarHistorial(() => []), [cambiarHistorial]);

  const valor = useMemo(
    () => ({
      historial,
      noLeidas: historial.filter((a) => !a.leida).length,
      notificar,
      marcarTodasLeidas,
      limpiar,
    }),
    [historial, notificar, marcarTodasLeidas, limpiar]
  );

  return (
    <AlertasCtx.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-[1100] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-96">
        {toasts.map((a) => (
          <Toast key={a.id} alerta={a} onCerrar={cerrarToast} />
        ))}
      </div>
    </AlertasCtx.Provider>
  );
}

function Toast({ alerta, onCerrar }) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const { titulo, detalle, estilo } = describir(alerta, t, formatCurrency);
  const e = ESTILOS[estilo] ?? ESTILOS.info;
  const [pausado, setPausado] = useState(false);
  const restante = useRef(DURACION_TOAST);

  // Se cierra solo; al pasar el mouse (o enfocar) se pausa y conserva el tiempo que le quedaba.
  useEffect(() => {
    if (pausado) return;
    const inicio = Date.now();
    const timer = setTimeout(() => onCerrar(alerta.id), restante.current);
    return () => {
      clearTimeout(timer);
      restante.current -= Date.now() - inicio;
    };
  }, [pausado, alerta.id, onCerrar]);

  return (
    <div
      role={estilo === "error" ? "alert" : "status"}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className={`pointer-events-auto relative animate-entrar overflow-hidden rounded-xl border-0 border-l-4 border-solid p-3 pr-9 text-texto shadow-lg motion-reduce:animate-none ${e.caja}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">{e.icono}</span>
        <div className="min-w-0">
          <p className="m-0 text-sm font-bold">{titulo}</p>
          {detalle && <p className="mb-0 mt-0.5 text-xs text-suave">{detalle}</p>}
        </div>
      </div>
      <button
        type="button"
        aria-label={t("alertas.cerrar")}
        onClick={() => onCerrar(alerta.id)}
        className="absolute right-2 top-2 cursor-pointer rounded border-0 bg-transparent px-1.5 text-lg leading-none text-suave hover:text-texto"
      >
        ×
      </button>
      <span
        aria-hidden="true"
        className={`absolute bottom-0 left-0 h-1 w-full origin-left animate-barra motion-reduce:hidden ${e.barra}`}
        style={{ animationDuration: `${DURACION_TOAST}ms`, animationPlayState: pausado ? "paused" : "running" }}
      />
    </div>
  );
}