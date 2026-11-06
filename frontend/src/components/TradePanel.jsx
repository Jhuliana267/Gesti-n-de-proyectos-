import { useState } from "react";
import { api } from "../api";
import { useTranslation } from "react-i18next";
import { useCurrency } from "../CurrencyContext";

export default function TradePanel({ accion, portafolio, onOperacion }) {
  const { t } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [cantidad, setCantidad] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, texto }

  if (!accion) return null;

  const posicion = portafolio?.posiciones.find((p) => p.id_accion === accion.id);
  const tengo = posicion?.cantidad ?? 0;
  const saldo = portafolio?.saldo_ficticio ?? 0;
  const n = Math.max(0, Math.floor(Number(cantidad) || 0));
  const total = n * accion.precio_actual;
  const maxComprar = Math.floor(saldo / accion.precio_actual);

  const ejecutar = async (tipo) => {
    if (n < 1) return setResultado({ ok: false, texto: t("simulador.operar.cantidadMinima") });
    setEnviando(true);
    try {
      const r = await api.operar({
        id_accion: accion.id,
        tipo_operacion: tipo,
        cantidad: n,
      });
      let texto = `${t(`simulador.operar.resultado.${tipo}`, {
        cantidad: n,
        ticker: accion.ticker,
        precio: formatCurrency(r.precio),
        total: formatCurrency(r.total),
      })}`;
      if (tipo === "venta") {
        const g = r.ganancia_realizada;
        texto += g >= 0
          ? ` ${t("simulador.operar.ganaste", { cantidad: formatCurrency(g) })}`
          : ` ${t("simulador.operar.perdiste", { cantidad: formatCurrency(Math.abs(g)) })}`;
      }
      setResultado({ ok: true, texto });
      onOperacion();
    } catch (err) {
      setResultado({ ok: false, texto: err.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="card" data-tour="operar">
      <h2>{t("simulador.operar.titulo", { ticker: accion.ticker })}</h2>

      <div className="datos-trade">
        <div><span>{t("simulador.operar.precioAccion")}</span><strong>{formatCurrency(accion.precio_actual)}</strong></div>
        <div><span>{t("simulador.operar.tienes")}</span><strong>{t("simulador.operar.numeroAcciones", { cantidad: tengo })}</strong></div>
        <div><span>{t("simulador.operar.maximoCompra")}</span><strong>{maxComprar}</strong></div>
      </div>

      <label htmlFor="cantidad">{t("simulador.operar.cuantas")}</label>
      <div className="cantidad-row">
        <button className="btn mini" onClick={() => setCantidad(Math.max(1, n - 1))}>−</button>
        <input
          id="cantidad"
          type="number"
          min="1"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
        <button className="btn mini" onClick={() => setCantidad(n + 1)}>+</button>
      </div>
      <div className="atajos">
        <button className="link" onClick={() => setCantidad(Math.max(1, maxComprar))}>{t("simulador.operar.maximoAtajo")}</button>
        <button className="link" onClick={() => setCantidad(Math.max(1, tengo))}>{t("simulador.operar.venderTodo")}</button>
      </div>

      <p className="total">{t("simulador.operar.totalEstimado")} <strong>{formatCurrency(total)}</strong></p>

      <div className="botones-trade">
        <button className="btn comprar" disabled={enviando} onClick={() => ejecutar("compra")}>
          {t("simulador.tipoOperacion.compra")}
        </button>
        <button className="btn vender" disabled={enviando} onClick={() => ejecutar("venta")}>
          {t("simulador.tipoOperacion.venta")}
        </button>
      </div>

      {resultado && <p className={`msg ${resultado.ok ? "ok" : "error"}`}>{resultado.texto}</p>}
      <p className="ayuda">
        💡 {t("simulador.operar.consejo")}
      </p>
    </section>
  );
}
