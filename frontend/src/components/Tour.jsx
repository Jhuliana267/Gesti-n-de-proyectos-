import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "../CurrencyContext";

// Pasos del recorrido. `selector` apunta a un elemento con data-tour="..."; sin selector = modal centrado.
export const PASOS_TUTORIAL = [
  {
    titulo: "tour.bienvenida.titulo",
    texto: "tour.bienvenida.texto",
  },
  {
    selector: "saldo",
    titulo: "tour.dinero.titulo",
    texto: "tour.dinero.texto",
  },
  {
    selector: "mercado",
    titulo: "tour.empresas.titulo",
    texto: "tour.empresas.texto",
  },
  {
    selector: "grafico",
    titulo: "tour.grafico.titulo",
    texto: "tour.grafico.texto",
  },
  {
    selector: "operar",
    titulo: "tour.operar.titulo",
    texto: "tour.operar.texto",
  },
  {
    selector: "portafolio",
    titulo: "tour.portafolio.titulo",
    texto: "tour.portafolio.texto",
  },
  {
    selector: "mentor",
    titulo: "tour.mentor.titulo",
    texto: "tour.mentor.texto",
  },
  {
    selector: "progreso",
    titulo: "tour.progreso.titulo",
    texto: "tour.progreso.texto",
  },
];

const RELLENO = 8;
const ALTO_TIP = 250; // espacio mínimo necesario para colocar el globo arriba o abajo del elemento

export default function Tour({ pasos = PASOS_TUTORIAL, onTerminar }) {
  const { t } = useTranslation();
  const { formatCapitalInicial } = useCurrency();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;

  const medir = useCallback(() => {
    const el = paso.selector && document.querySelector(`[data-tour="${paso.selector}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [paso]);

  useEffect(() => {
    const el = paso.selector && document.querySelector(`[data-tour="${paso.selector}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    medir();
    const t = setTimeout(medir, 400); // tras el scroll suave
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [i, medir, paso.selector]);

  // Posición del globo: debajo del elemento, o encima, o anclado abajo si no cabe.
  let estiloTip = {};
  let clase = "tour-tip";
  if (!rect) {
    clase += " centrado";
  } else {
    const ancho = Math.min(340, window.innerWidth - 32);
    const izq = Math.max(16, Math.min(rect.left, window.innerWidth - ancho - 16));
    const espacioAbajo = window.innerHeight - (rect.top + rect.height + RELLENO);
    const espacioArriba = rect.top - RELLENO;
    if (espacioAbajo >= ALTO_TIP) estiloTip = { top: rect.top + rect.height + RELLENO + 12, left: izq, width: ancho };
    else if (espacioArriba >= ALTO_TIP) estiloTip = { bottom: window.innerHeight - rect.top + RELLENO + 12, left: izq, width: ancho };
    else estiloTip = { bottom: 16, left: "50%", transform: "translateX(-50%)", width: ancho };
  }

  return (
    <div className="tour-capa" role="dialog" aria-modal="true" aria-label={t("tour.aria")}>
      {rect ? (
        <div
          className="tour-foco"
          style={{
            top: rect.top - RELLENO,
            left: rect.left - RELLENO,
            width: rect.width + RELLENO * 2,
            height: rect.height + RELLENO * 2,
          }}
        />
      ) : (
        <div className="tour-fondo" />
      )}

      <div className={clase} style={estiloTip}>
        <div className="tour-contador">{t("tour.paso", { actual: i + 1, total: pasos.length })}</div>
        <h3>{t(paso.titulo)}</h3>
        <p>{t(paso.texto, { capital: formatCapitalInicial() })}</p>
        <div className="tour-puntos">
          {pasos.map((_, n) => (
            <span key={n} className={n === i ? "activo" : ""} />
          ))}
        </div>
        <div className="tour-botones">
          <button className="link" onClick={onTerminar}>{t("tour.saltar")}</button>
          <div className="tour-nav">
            {i > 0 && <button className="btn mini" onClick={() => setI(i - 1)}>{t("tour.atras")}</button>}
            <button className="btn primario" onClick={() => (ultimo ? onTerminar() : setI(i + 1))}>
              {ultimo ? t("tour.entendido") : t("tour.siguiente")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
