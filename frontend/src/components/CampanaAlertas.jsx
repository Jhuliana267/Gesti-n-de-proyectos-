import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { describir, ESTILOS, useAlertas } from "../AlertasContext";
import { useCurrency } from "../CurrencyContext";
import { hace } from "../formato";

export default function CampanaAlertas() {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const { historial, noLeidas, marcarTodasLeidas, limpiar } = useAlertas();
  const [abierto, setAbierto] = useState(false);
  const [top, setTop] = useState(64); // en móvil el panel es fijo y se ubica bajo el botón
  const raiz = useRef(null);
  const boton = useRef(null);

  const cerrar = () => {
    setAbierto(false);
    marcarTodasLeidas(); // al cerrar el panel, todo lo visto queda como leído
  };

  const alternar = () => {
    if (abierto) return cerrar();
    setTop((boton.current?.getBoundingClientRect().bottom ?? 56) + 8);
    setAbierto(true);
  };

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (!raiz.current?.contains(e.target)) cerrar();
    };
    const tecla = (e) => {
      if (e.key === "Escape") {
        cerrar();
        boton.current?.focus();
      }
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const etiqueta = noLeidas
    ? `${t("alertas.abrir")} (${t("alertas.noLeidas", { count: noLeidas })})`
    : t("alertas.abrir");

  return (
    <div ref={raiz} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls="panel-alertas"
        aria-label={etiqueta}
        className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-suave transition hover:bg-gray-100 hover:text-texto dark:hover:bg-white/10"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {noLeidas > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white"
          >
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          id="panel-alertas"
          role="dialog"
          aria-label={t("alertas.titulo")}
          style={{ "--top": `${top}px` }}
          className="fixed inset-x-3 top-[var(--top)] z-50 overflow-hidden rounded-2xl border border-solid border-borde bg-tarjeta shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-0 border-b border-solid border-borde px-4 py-3">
            <h2 className="m-0 text-sm font-bold">{t("alertas.titulo")}</h2>
            {historial.length > 0 && (
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={marcarTodasLeidas} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-primario">
                  {t("alertas.marcarLeidas")}
                </button>
                <button type="button" onClick={limpiar} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-suave hover:text-texto">
                  {t("alertas.borrar")}
                </button>
              </div>
            )}
          </div>

          {historial.length === 0 ? (
            <p className="m-0 px-4 py-8 text-center text-sm text-suave">{t("alertas.vacio")}</p>
          ) : (
            <ul className="m-0 max-h-80 list-none overflow-y-auto p-0">
              {historial.map((a) => {
                const { titulo, detalle, estilo } = describir(a, t, formatCurrency);
                const e = ESTILOS[estilo] ?? ESTILOS.info;
                return (
                  <li
                    key={a.id}
                    className={`flex gap-3 border-0 border-b border-solid border-borde px-4 py-3 ${
                      a.leida ? "" : "bg-indigo-50/70 dark:bg-indigo-950/30"
                    }`}
                  >
                    <span aria-hidden="true" className="text-xl leading-none">{e.icono}</span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm font-semibold">{titulo}</p>
                      {detalle && <p className="mb-0 mt-0.5 text-xs text-suave">{detalle}</p>}
                      <p className="mb-0 mt-1 text-[11px] text-suave">{hace(a.fecha, i18n.resolvedLanguage)}</p>
                    </div>
                    {!a.leida && <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primario" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}