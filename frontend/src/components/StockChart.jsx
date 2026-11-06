import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { useTranslation } from "react-i18next";
import { useCurrency } from "../CurrencyContext";

const PERIODOS = ["live", "1w", "1m", "1y"];

function numeroSemanaISO(fecha) {
  const date = new Date(fecha);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const primeraSemana = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(
    ((date.getTime() - primeraSemana.getTime()) / 86400000
      - 3 + ((primeraSemana.getDay() + 6) % 7)) / 7
  );
}

export default function StockChart({ accion }) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [datos, setDatos] = useState([]);
  const [periodo, setPeriodo] = useState("live");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!accion) return undefined;
    let vigente = true;
    let temporizador;
    setDatos([]);
    setError(false);

    const cargar = async () => {
      try {
        const nuevosDatos = periodo === "live"
          ? await api.historial(accion.id, 80)
          : (await api.historialSimulado(accion.id, periodo)).puntos;
        if (vigente) {
          setDatos(nuevosDatos);
          setError(false);
        }
      } catch {
        if (vigente) setError(true);
      } finally {
        if (vigente && periodo === "live") {
          temporizador = setTimeout(cargar, 3000);
        }
      }
    };

    cargar();
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [accion?.id, periodo]);

  if (!accion) return <section className="card">{t("simulador.grafico.selecciona")}</section>;

  const primero = datos[0]?.precio ?? accion.precio_actual;
  const ultimo = datos[datos.length - 1]?.precio ?? accion.precio_actual;
  const dif = ultimo - primero;
  const pct = primero ? (dif / primero) * 100 : 0;
  const sube = dif >= 0;
  const color = sube ? "#16a34a" : "#dc2626";
  const precios = datos.map((d) => d.precio);
  const min = precios.length ? Math.min(...precios) : 0;
  const max = precios.length ? Math.max(...precios) : 1;
  const margen = (max - min) * 0.15 || 1;
  const etiquetaFecha = (fecha) => {
    const date = new Date(fecha);
    if (periodo === "1y") {
      return date.toLocaleDateString(i18n.resolvedLanguage, { year: "numeric" });
    }
    if (periodo === "1m") {
      return date.toLocaleDateString(i18n.resolvedLanguage, { month: "short", year: "2-digit" });
    }
    if (periodo === "1w") {
      return t("simulador.grafico.semanaCorta", { n: numeroSemanaISO(fecha) });
    }
    if (periodo === "live") {
      return date.toLocaleTimeString(i18n.resolvedLanguage, { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString(i18n.resolvedLanguage, { day: "2-digit", month: "short" });
  };

  return (
    <section className="card" data-tour="grafico">
      <div className="chart-header">
        <div>
          <h2>
            {accion.nombre_empresa} <span className="ticker-tag">{accion.ticker}</span>
          </h2>
          <div className="precio-grande">{formatCurrency(accion.precio_actual)}</div>
        </div>
        <div className={`variacion ${sube ? "sube" : "baja"}`}>
          {sube ? "▲" : "▼"} {formatCurrency(Math.abs(dif))} ({Math.abs(pct).toFixed(2)}%)
          <small>{t(`simulador.grafico.periodos.${periodo}`)}</small>
        </div>
      </div>

      <div className="chart-periodos" role="group" aria-label={t("simulador.grafico.selectorPeriodo")}>
        {PERIODOS.map((opcion) => (
          <button
            key={opcion}
            type="button"
            className={`chart-periodo${periodo === opcion ? " activo" : ""}`}
            aria-pressed={periodo === opcion}
            onClick={() => setPeriodo(opcion)}
          >
            {t(`simulador.grafico.periodos.${opcion}`)}
          </button>
        ))}
      </div>
      {error && <p className="error chart-error">{t("simulador.grafico.error")}</p>}
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="relleno" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="fecha"
              tickFormatter={etiquetaFecha}
              tick={{ fontSize: 11 }}
              interval={periodo === "live" ? "preserveStartEnd" : 0}
              minTickGap={periodo === "live" ? 45 : 0}
            />
            <YAxis
              domain={[min - margen, max + margen]}
              tickFormatter={(v) => formatCurrency(v, { maximumFractionDigits: 0 })}
              tick={{ fontSize: 11 }}
              width={55}
            />
            <Tooltip
              labelFormatter={(fecha) => new Date(fecha).toLocaleDateString(i18n.resolvedLanguage, {
                year: "numeric", month: "long", day: "numeric",
              })}
              formatter={(v) => [formatCurrency(v), t("simulador.grafico.precio")]}
              labelStyle={{ fontWeight: 600 }}
            />
            <ReferenceLine y={primero} stroke="#9ca3af" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="precio"
              stroke={color}
              strokeWidth={2.5}
              fill="url(#relleno)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="ayuda">
        {t(periodo === "live" ? "simulador.grafico.enVivo" : "simulador.grafico.historialSimulado")}
      </p>
    </section>
  );
}
