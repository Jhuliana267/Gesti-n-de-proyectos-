import { useCurrency } from "../CurrencyContext";
import { useTranslation } from "react-i18next";

function Tarjeta({ titulo, valor, detalle, clase = "", ayuda }) {
  return (
    <div className={`card resumen ${clase}`} title={ayuda}>
      <span className="etiqueta">{titulo}</span>
      <span className="valor">{valor}</span>
      {detalle && <span className="detalle">{detalle}</span>}
    </div>
  );
}

// v2: el nombre de usuario y "cerrar sesión" ahora viven en <NavBar />.
export default function BalanceBar({ portafolio }) {
  const { t } = useTranslation();
  const { formatCurrency, formatCapitalInicial } = useCurrency();
  const p = portafolio;
  const gan = p?.ganancia_total ?? 0;
  const signo = gan > 0 ? "+" : "";

  return (
    <header className="topbar">
      <div className="resumenes" data-tour="saldo">
        <Tarjeta
          titulo={t("simulador.balance.capital")}
          valor={formatCurrency(p?.saldo_ficticio)}
          detalle={t("simulador.balance.capitalAyuda")}
          ayuda={t("simulador.balance.capitalDetalle")}
        />
        <Tarjeta
          titulo={t("simulador.balance.inversiones")}
          valor={formatCurrency(p?.valor_inversiones)}
          detalle={t("simulador.balance.inversionesDetalle")}
        />
        <Tarjeta
          titulo={t("simulador.balance.patrimonio")}
          valor={formatCurrency(p?.patrimonio_total)}
          detalle={t("simulador.balance.patrimonioDetalle", { cantidad: `${signo}${formatCurrency(gan)}` })}
          clase={gan > 0 ? "sube" : gan < 0 ? "baja" : ""}
          ayuda={t("simulador.balance.patrimonioDetalleAyuda", { capital: formatCapitalInicial() })}
        />
      </div>
    </header>
  );
}
