import { useTranslation } from "react-i18next";
import { useCurrency } from "../CurrencyContext";

export default function StockList({ acciones, seleccionada, onSeleccionar, accionesEnCartera }) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const idsEnCartera = new Set(accionesEnCartera);
  return (
    <section className="card" data-tour="mercado">
      <h2>{t("simulador.mercado.titulo")}</h2>
      <p className="ayuda">{t("simulador.mercado.ayuda")}</p>
      <ul className="lista-acciones">
        {acciones.map((a) => {
          const cambio = a.cambio_pct ?? 0;
          const clase = cambio > 0 ? "sube" : cambio < 0 ? "baja" : "";
          const enCartera = idsEnCartera.has(a.id);
          return (
            <li key={a.id}>
              <button
                className={`accion-item ${enCartera ? "con-posicion" : ""} ${seleccionada === a.id ? "activa" : ""}`}
                title={enCartera ? t("simulador.mercado.tienesAcciones") : undefined}
                onClick={() => onSeleccionar(a.id)}
              >
                <span className="ticker">{a.ticker}</span>
                <span className="empresa">{a.nombre_empresa}</span>
                <span className="precio">{formatCurrency(a.precio_actual)}</span>
                <span className={`cambio ${clase}`}>
                  {cambio > 0 ? "▲" : cambio < 0 ? "▼" : "•"} {Math.abs(cambio).toFixed(2)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
