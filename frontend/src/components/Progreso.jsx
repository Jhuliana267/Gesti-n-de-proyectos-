import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { usePolling } from "../usePolling";
import NavBar from "./NavBar";
import Evaluacion from "./Evaluacion";
import { useCurrency } from "../CurrencyContext";

const fechaCorta = (iso, locale) =>
  new Date(iso).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function Dato({ titulo, valor, clase = "", detalle }) {
  return (
    <div className="card resumen">
      <span className="etiqueta">{titulo}</span>
      <span className={`valor ${clase}`}>{valor}</span>
      {detalle && <span className="detalle">{detalle}</span>}
    </div>
  );
}

export default function Progreso() {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  const cargar = async () => {
    try {
      setDatos(await api.progreso());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  usePolling(cargar, 10000, []);

  if (!datos) {
    return (
      <div className="app">
        <NavBar />
        <p className="ayuda">{error || t("progreso.cargando")}</p>
      </div>
    );
  }

  const { resumen, serie, ciclo, evaluaciones, capital_inicial } = datos;
  const puntos = serie.map((s) => ({ t: fechaCorta(s.fecha, i18n.resolvedLanguage), patrimonio: s.patrimonio }));
  const valores = puntos.map((p) => p.patrimonio).concat(capital_inicial);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const margen = (max - min) * 0.2 || 50;
  const sube = resumen.rendimiento >= 0;
  const color = sube ? "#16a34a" : "#dc2626";
  const signo = sube ? "+" : "−";

  return (
    <div className="app">
      <NavBar />
      <h2 className="titulo-pagina">{t("progreso.titulo")}</h2>

      <div className="resumenes fila">
        <Dato titulo={t("progreso.patrimonioActual")} valor={formatCurrency(resumen.patrimonio_actual)} />
        <Dato
          titulo={t("progreso.resultadoTotal")}
          valor={`${signo}${formatCurrency(Math.abs(resumen.rendimiento))}`}
          clase={sube ? "sube" : "baja"}
          detalle={t("progreso.desdeInicio", { porcentaje: `${signo}${Math.abs(resumen.rendimiento_pct).toFixed(2)}%` })}
        />
        <Dato titulo={t("progreso.operaciones")} valor={resumen.operaciones} />
        <Dato
          titulo={t("progreso.mejorVenta")}
          valor={resumen.mejor_operacion ? formatCurrency(resumen.mejor_operacion.ganancia) : "—"}
          detalle={resumen.mejor_operacion?.ticker || t("progreso.sinVentas")}
        />
        <Dato
          titulo={t("progreso.peorVenta")}
          valor={resumen.peor_operacion ? formatCurrency(resumen.peor_operacion.ganancia) : "—"}
          detalle={resumen.peor_operacion?.ticker || t("progreso.sinVentas")}
        />
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t("progreso.evolucion")}</h2>
        <p className="ayuda">{t("progreso.evolucionAyuda")}</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={puntos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rellenoProgreso" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} minTickGap={60} />
              <YAxis
                domain={[min - margen, max + margen]}
                tickFormatter={(v) => formatCurrency(v, { maximumFractionDigits: 0 })}
                tick={{ fontSize: 11 }}
                width={70}
              />
              <Tooltip formatter={(v) => [formatCurrency(v), t("progreso.patrimonio")]} />
              <ReferenceLine y={capital_inicial} stroke="#6b7280" strokeDasharray="4 4" label={{ value: t("progreso.capitalInicial"), fontSize: 11, fill: "#6b7280", position: "insideTopLeft" }} />
              <Area type="monotone" dataKey="patrimonio" stroke={color} strokeWidth={2.5} fill="url(#rellenoProgreso)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid-dos">
        <Evaluacion ciclo={ciclo} onCompletada={cargar} />
        <section className="card">
          <h2>🏅 {t("progreso.evaluaciones")}</h2>
          {evaluaciones.length === 0 ? (
            <p className="ayuda">{t("progreso.sinEvaluaciones")}</p>
          ) : (
            <ul className="historial">
              {evaluaciones.map((e) => (
                <li key={e.id}>
                  <span className="pill compra">{e.puntaje}/{e.total}</span>
                  {t("progreso.evaluacionNumero", { id: e.id })}
                  <span className="hora">{fechaCorta(e.fecha, i18n.resolvedLanguage)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
