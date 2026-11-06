import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../api";
import { colorResultado, conSigno, fechaHora } from "../formato";
import { botonPrimario, panel } from "../ui";
import { usePolling } from "../usePolling";
import NavBar from "./NavBar";
import { useCurrency } from "../CurrencyContext";

const PALETA = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6", "#f97316", "#14b8a6"];
const COLOR_EFECTIVO = "#94a3b8";

function Tarjeta({ icono, titulo, nota, className = "", children }) {
  return (
    <section className={`${panel} flex flex-col gap-1 ${className}`} title={nota}>
      <h2 className="m-0 flex items-center gap-2 text-sm font-semibold text-suave">
        <span aria-hidden="true" className="text-lg">{icono}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Esqueleto() {
  return (
    <div aria-hidden="true" className="grid animate-pulse gap-4 lg:grid-cols-3">
      <div className="h-56 rounded-2xl bg-gray-200 dark:bg-white/10 lg:col-span-2" />
      <div className="h-56 rounded-2xl bg-gray-200 dark:bg-white/10" />
    </div>
  );
}

export default function WalletDashboard() {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const lang = i18n.resolvedLanguage;
  const [d, setD] = useState(null);
  const [error, setError] = useState(false);

  // Mismo ritmo que el simulador: el valor de las acciones cambia con cada tick de precios.
  usePolling(
    async () => {
      try {
        setD(await api.billeteraResumen());
        setError(false);
      } catch {
        setError(true);
      }
    },
    3000,
    []
  );

  const segmentos = d
    ? [
        { nombre: t("billetera.efectivo"), valor: d.saldo, color: COLOR_EFECTIVO },
        ...d.composicion.map((c, i) => ({ nombre: c.ticker, valor: c.valor, color: PALETA[i % PALETA.length] })),
      ].filter((s) => s.valor > 0)
    : [];
  const totalDonut = segmentos.reduce((suma, s) => suma + s.valor, 0);

  const g = d?.ganancia_historica ?? 0;
  const m = d?.mejor_accion;

  const textoResultado = (r) => (r.resultado == null ? t("billetera.historial.sinResultado") : conSigno(r.resultado, formatCurrency));
  const claseResultado = (r) => (r.resultado == null ? "text-suave" : colorResultado(r.resultado));

  return (
    <div className="app">
      <NavBar />
      <main className="mx-auto w-full max-w-6xl">
        <header className="mb-4 sm:mb-6">
          <h1 className="m-0 text-2xl font-extrabold sm:text-3xl">{t("billetera.titulo")}</h1>
          <p className="mb-0 mt-1 text-sm text-suave sm:text-base">{t("billetera.subtitulo")}</p>
        </header>

        {!d && !error && <Esqueleto />}
        {!d && error && (
          <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-900 dark:bg-red-900/40 dark:text-red-200">
            {t("billetera.error")}
          </p>
        )}

        {d && (
          <>
            {/* Saldo + composición */}
            <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
              <section className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-5 text-white shadow-lg sm:p-8 lg:col-span-2">
                <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 sm:h-60 sm:w-60" />
                <div className="relative">
                  <h2 className="m-0 text-sm font-medium text-indigo-100">💵 {t("billetera.saldo")}</h2>
                  <p className="mb-0 mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">{formatCurrency(d.saldo)}</p>
                  <p className="mb-0 mt-2 text-sm text-indigo-100">{t("billetera.saldoAyuda")}</p>
                </div>
                <dl className="relative m-0 grid grid-cols-2 gap-4 border-0 border-t border-solid border-white/20 pt-4">
                  <div>
                    <dt className="text-xs text-indigo-100">{t("billetera.patrimonio")}</dt>
                    <dd className="m-0 text-lg font-bold sm:text-xl">{formatCurrency(d.patrimonio)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-indigo-100">{t("billetera.valorAcciones")}</dt>
                    <dd className="m-0 text-lg font-bold sm:text-xl">{formatCurrency(d.valor_inversiones)}</dd>
                  </div>
                </dl>
              </section>

              <section className={panel} aria-labelledby="titulo-composicion">
                <h2 id="titulo-composicion" className="m-0 text-sm font-semibold text-suave">🥧 {t("billetera.composicion")}</h2>
                <div className="h-44 sm:h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={segmentos} dataKey="valor" nameKey="nombre" innerRadius="60%" outerRadius="90%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                        {segmentos.map((s) => (
                          <Cell key={s.nombre} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="m-0 grid list-none grid-cols-1 gap-1 p-0 text-sm sm:grid-cols-2 lg:grid-cols-1">
                  {segmentos.map((s) => (
                    <li key={s.nombre} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        {s.nombre}
                      </span>
                      <span className="text-suave">{((s.valor / totalDonut) * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* Indicadores */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:mt-6 md:gap-6 lg:grid-cols-3">
              <Tarjeta icono="📊" titulo={t("billetera.invertido")}>
                <p className="m-0 text-2xl font-extrabold sm:text-3xl">{formatCurrency(d.invertido)}</p>
                <p className="m-0 text-xs text-suave sm:text-sm">{t("billetera.invertidoAyuda", { valor: formatCurrency(d.valor_inversiones) })}</p>
              </Tarjeta>

              <Tarjeta icono={g >= 0 ? "📈" : "📉"} titulo={t("billetera.ganancia")}>
                <p className={`m-0 text-2xl font-extrabold sm:text-3xl ${colorResultado(g)}`}>{conSigno(g, formatCurrency)}</p>
                <p className={`m-0 text-sm font-semibold ${colorResultado(g)}`}>
                  {g > 0 ? "▲" : g < 0 ? "▼" : "•"} {Math.abs(d.ganancia_historica_pct).toFixed(2)}%
                </p>
                <p className="m-0 text-xs text-suave sm:text-sm">
                  {t("billetera.gananciaAyuda", {
                    realizada: conSigno(d.ganancia_realizada, formatCurrency),
                    abierta: conSigno(d.ganancia_no_realizada, formatCurrency),
                  })}
                </p>
              </Tarjeta>

              <Tarjeta icono="🏆" titulo={t("billetera.mejor")} nota={t("billetera.mejorNota")} className="sm:col-span-2 lg:col-span-1">
                {m ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="m-0 text-2xl font-extrabold sm:text-3xl">{m.ticker}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          m.ganancia_pct >= 0
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                        }`}
                      >
                        {m.ganancia_pct >= 0 ? "+" : "−"}{Math.abs(m.ganancia_pct).toFixed(2)}%
                      </span>
                    </div>
                    <p className="m-0 text-xs text-suave sm:text-sm">
                      {t("billetera.mejorAyuda", { empresa: m.empresa, monto: conSigno(m.ganancia, formatCurrency) })}
                    </p>
                  </>
                ) : (
                  <p className="m-0 text-sm text-suave">{t("billetera.mejorVacia")}</p>
                )}
              </Tarjeta>
            </div>

            {/* Historial de transacciones */}
            <section className={`${panel} mt-4 md:mt-6`} aria-labelledby="titulo-historial">
              <h2 id="titulo-historial" className="m-0 text-base font-bold sm:text-lg">{t("billetera.historial.titulo")}</h2>
              <p className="mb-3 mt-1 text-xs text-suave sm:text-sm">{t("billetera.historial.nota")}</p>

              {d.transacciones.length === 0 ? (
                <div className="flex flex-col items-start gap-3 py-4">
                  <p className="m-0 text-sm text-suave">{t("billetera.historial.vacio")}</p>
                  <Link to="/" className={`${botonPrimario} no-underline`}>{t("billetera.historial.irSimulador")}</Link>
                </div>
              ) : (
                <>
                  {/* Tabla en pantallas medianas y grandes */}
                  <div className="tabla-wrap hidden md:block">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("billetera.historial.fecha")}</th>
                          <th>{t("billetera.historial.ticker")}</th>
                          <th className="text-right">{t("billetera.historial.cantidad")}</th>
                          <th className="text-right">{t("billetera.historial.precio")}</th>
                          <th className="text-right">{t("billetera.historial.resultado")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.transacciones.map((r) => (
                          <tr key={r.id}>
                            <td className="whitespace-nowrap text-suave">{fechaHora(r.fecha, lang)}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <strong>{r.ticker}</strong>
                                <span className={`pill ${r.tipo}`}>{t(`billetera.tipo.${r.tipo}`)}</span>
                              </div>
                            </td>
                            <td className="text-right">{r.cantidad}</td>
                            <td className="text-right">{formatCurrency(r.precio)}</td>
                            <td className={`text-right font-semibold ${claseResultado(r)}`}>{textoResultado(r)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Tarjetas en móvil */}
                  <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
                    {d.transacciones.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-solid border-borde p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <strong>{r.ticker}</strong>
                            <span className={`pill ${r.tipo}`}>{t(`billetera.tipo.${r.tipo}`)}</span>
                          </div>
                          <p className="mb-0 mt-1 text-xs text-suave">
                            {fechaHora(r.fecha, lang)} · {r.cantidad} × {formatCurrency(r.precio)}
                          </p>
                        </div>
                        <span className={`shrink-0 text-sm font-bold ${claseResultado(r)}`}>{textoResultado(r)}</span>
                      </li>
                    ))}
                  </ul>

                  {d.total_transacciones > d.transacciones.length && (
                    <p className="mb-0 mt-3 text-xs text-suave">
                      {t("billetera.historial.mostrando", { n: d.transacciones.length, total: d.total_transacciones })}
                    </p>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}