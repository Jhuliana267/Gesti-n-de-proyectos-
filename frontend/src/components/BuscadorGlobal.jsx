import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useCurrency } from "../CurrencyContext";
import { colorResultado } from "../formato";

const SECCIONES = [
  { clave: "simulador", ruta: "/" },
  { clave: "progreso", ruta: "/progreso" },
  { clave: "billetera", ruta: "/billetera" },
  { clave: "ajustes", ruta: "/ajustes" },
  { clave: "perfil", ruta: "/perfil" },
];

// "Apple" y "ápple" coinciden: sin tildes ni mayúsculas.
const normalizar = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function BuscadorGlobal() {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const idLista = useId();
  const raiz = useRef(null);
  const entrada = useRef(null);
  const cargadoEn = useRef(0);
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [acciones, setAcciones] = useState([]);
  const [error, setError] = useState(false);
  const [activo, setActivo] = useState(0);

  // Las acciones se piden al enfocar la barra (no en cada carga de página) y se reutilizan 30 s.
  const cargar = async () => {
    if (Date.now() - cargadoEn.current < 30_000) return;
    try {
      setAcciones(await api.acciones());
      cargadoEn.current = Date.now();
      setError(false);
    } catch {
      setError(true);
    }
  };

  const resultados = useMemo(() => {
    const q = normalizar(consulta);
    if (!q) return [];
    const deAcciones = acciones
      .map((a) => ({ a, tk: normalizar(a.ticker), em: normalizar(a.nombre_empresa) }))
      .filter(({ tk, em }) => tk.includes(q) || em.includes(q))
      .sort((x, y) => Number(y.tk.startsWith(q)) - Number(x.tk.startsWith(q))) // el ticker exacto va primero
      .slice(0, 6)
      .map(({ a }) => ({ tipo: "accion", id: `a-${a.id}`, accion: a, ruta: `/?accion=${a.id}` }));
    const deSecciones = SECCIONES.filter((s) => normalizar(t(`nav.${s.clave}`)).includes(q))
      .slice(0, 3)
      .map((s) => ({ tipo: "seccion", id: `s-${s.clave}`, etiqueta: t(`nav.${s.clave}`), ruta: s.ruta }));
    return [...deAcciones, ...deSecciones];
  }, [consulta, acciones, t]);

  const visible = abierto && consulta.trim() !== "";
  const sinDatos = error && acciones.length === 0;

  const ir = (r) => {
    navigate(r.ruta);
    setConsulta("");
    setAbierto(false);
    entrada.current?.blur();
  };

  const alTeclear = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (resultados.length ? (i + 1) % resultados.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (resultados.length ? (i - 1 + resultados.length) % resultados.length : 0));
    } else if (e.key === "Enter" && resultados[activo]) {
      e.preventDefault();
      ir(resultados[activo]);
    } else if (e.key === "Escape") {
      if (consulta) setConsulta("");
      else {
        setAbierto(false);
        entrada.current?.blur();
      }
    }
  };

  useEffect(() => {
    const fuera = (e) => {
      if (!raiz.current?.contains(e.target)) setAbierto(false);
    };
    // "/" o Ctrl/⌘+K enfocan la búsqueda desde cualquier pantalla.
    const atajo = (e) => {
      const el = document.activeElement;
      const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable;
      if ((e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !escribiendo)) {
        e.preventDefault();
        entrada.current?.focus();
      }
    };
    document.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", atajo);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("keydown", atajo);
    };
  }, []);

  return (
    <div ref={raiz} role="search" className="relative w-full">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave"
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        ref={entrada}
        type="search"
        role="combobox"
        value={consulta}
        placeholder={t("busqueda.placeholder")}
        aria-label={t("busqueda.etiqueta")}
        aria-expanded={visible}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={visible && resultados.length ? `${idLista}-${activo}` : undefined}
        autoComplete="off"
        onFocus={() => {
          setAbierto(true);
          cargar();
        }}
        onChange={(e) => {
          setConsulta(e.target.value);
          setActivo(0);
          setAbierto(true);
        }}
        onKeyDown={alTeclear}
        className="w-full rounded-full py-2 pl-9 pr-10 text-sm"
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-solid border-borde px-1.5 text-[11px] text-suave sm:block"
      >
        /
      </kbd>

      {visible && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={t("busqueda.etiqueta")}
          className="absolute left-0 top-full z-50 m-0 mt-2 max-h-80 w-full min-w-[18rem] list-none overflow-y-auto rounded-2xl border border-solid border-borde bg-tarjeta p-1 shadow-xl xl:w-[24rem]"
        >
          {sinDatos && (
            <li role="presentation" className="px-3 py-3 text-sm text-suave">{t("busqueda.error")}</li>
          )}
          {!sinDatos && resultados.length === 0 && (
            <li role="presentation" className="px-3 py-3 text-sm text-suave">
              {t("busqueda.sinResultados", { q: consulta.trim() })}
            </li>
          )}
          {resultados.map((r, i) => {
            const cambio = r.accion?.cambio_pct ?? 0;
            return (
              <Fragment key={r.id}>
                {(i === 0 || resultados[i - 1].tipo !== r.tipo) && (
                  <li role="presentation" className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-suave">
                    {t(r.tipo === "accion" ? "busqueda.acciones" : "busqueda.secciones")}
                  </li>
                )}
                <li
                  id={`${idLista}-${i}`}
                  role="option"
                  aria-selected={i === activo}
                  onMouseEnter={() => setActivo(i)}
                  onMouseDown={(e) => e.preventDefault()} // evita que el input pierda el foco antes del clic
                  onClick={() => ir(r)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
                    i === activo ? "bg-indigo-50 dark:bg-white/10" : ""
                  }`}
                >
                  {r.tipo === "accion" ? (
                    <>
                      <span className="min-w-0 truncate">
                        <strong>{r.accion.ticker}</strong>{" "}
                        <span className="text-suave">{r.accion.nombre_empresa}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        <span className="block font-semibold">{formatCurrency(r.accion.precio_actual)}</span>
                        <span className={colorResultado(cambio)}>
                          {cambio > 0 ? "▲" : cambio < 0 ? "▼" : "•"} {Math.abs(cambio).toFixed(2)}%
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>{r.etiqueta}</span>
                      <span aria-hidden="true" className="text-suave">↵</span>
                    </>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}