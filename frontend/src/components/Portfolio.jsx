import { useTranslation } from "react-i18next";
import { useCurrency } from "../CurrencyContext";

export default function Portfolio({ portafolio, transacciones }) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const posiciones = portafolio?.posiciones ?? [];

  return (
    <section className="card" data-tour="portafolio">
      <h2>{t("simulador.portafolio.titulo")}</h2>
      {posiciones.length === 0 ? (
        <p className="ayuda">{t("simulador.portafolio.vacio")}</p>
      ) : (
        <div className="tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("simulador.portafolio.accion")}</th><th>{t("simulador.portafolio.cantidad")}</th><th>{t("simulador.portafolio.costoPromedio")}</th><th>{t("simulador.portafolio.precioActual")}</th><th>{t("simulador.portafolio.valor")}</th><th>{t("simulador.portafolio.ganancia")}</th>
              </tr>
            </thead>
            <tbody>
              {posiciones.map((p) => (
                <tr key={p.id_accion}>
                  <td><strong>{p.ticker}</strong></td>
                  <td>{p.cantidad}</td>
                  <td>{formatCurrency(p.precio_promedio)}</td>
                  <td>{formatCurrency(p.precio_actual)}</td>
                  <td>{formatCurrency(p.valor_mercado)}</td>
                  <td className={p.ganancia >= 0 ? "sube" : "baja"}>
                    {p.ganancia >= 0 ? "+" : "−"}{formatCurrency(Math.abs(p.ganancia))} ({p.ganancia_pct.toFixed(2)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>{t("simulador.portafolio.ultimasOperaciones")}</h3>
      {transacciones.length === 0 ? (
        <p className="ayuda">{t("simulador.portafolio.sinOperaciones")}</p>
      ) : (
        <ul className="historial">
          {transacciones.slice(0, 6).map((tx) => (
            <li key={tx.id}>
              <span className={`pill ${tx.tipo_operacion}`}>{t("simulador.tipoOperacion." + tx.tipo_operacion)}</span>
              {tx.cantidad} × {tx.ticker} {t("simulador.portafolio.a")} {formatCurrency(tx.precio_historico)}
              <span className="hora">
                {new Date(tx.fecha).toLocaleTimeString(i18n.resolvedLanguage, { hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
