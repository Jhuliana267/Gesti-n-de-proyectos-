import { useLocation, useSearchParams } from "react-router-dom"; // <-- NUEVO IMPORT AQUÍ
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { usePolling } from "../usePolling";
import NavBar from "./NavBar";
import BalanceBar from "./BalanceBar";
import StockList from "./StockList";
import StockChart from "./StockChart";
import TradePanel from "./TradePanel";
import Portfolio from "./Portfolio";
import MentorChat from "./MentorChat";
import Tour from "./Tour";

// Antes era App.jsx: la pantalla principal del simulador. Ahora vive detrás de <RutaProtegida>.
export default function Simulador() {
  const { t } = useTranslation();
  const { usuario, marcarTutorialVisto } = useAuth();
  const [acciones, setAcciones] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [portafolio, setPortafolio] = useState(null);
  const [transacciones, setTransacciones] = useState([]);
  const [verTutorial, setVerTutorial] = useState(false);

  const ubicacion = useLocation();
  const [params] = useSearchParams();

  // Llegada desde la búsqueda global (/?accion=3): selecciona esa acción.
  useEffect(() => {
    const id = Number(params.get("accion"));
    if (id) setSeleccionada(id);
  }, [ubicacion.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const refrescarCuenta = async () => {
    const [p, t] = await Promise.all([api.portafolio(), api.transacciones()]);
    setPortafolio(p);
    setTransacciones(t);
  };

  // Precios y patrimonio "en vivo": se consultan cada 3 s.
  usePolling(
    async () => {
      const lista = await api.acciones();
      setAcciones(lista);
      setSeleccionada((actual) => actual ?? lista[0]?.id ?? null);
    },
    3000,
    []
  );
  usePolling(refrescarCuenta, 3000, []);

  // Onboarding: la primera vez (tutorial_completado = false) se abre solo, cuando ya hay datos en pantalla.
  const datosListos = acciones.length > 0 && portafolio !== null;
  useEffect(() => {
    if (datosListos && usuario && !usuario.tutorial_completado) {
      const t = setTimeout(() => setVerTutorial(true), 500);
      return () => clearTimeout(t);
    }
  }, [datosListos, usuario?.tutorial_completado]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrarTutorial = () => {
    setVerTutorial(false);
    if (!usuario.tutorial_completado) marcarTutorialVisto();
  };

  const accion = acciones.find((a) => a.id === seleccionada);

  return (
    <div className="app">
      <NavBar onTutorial={() => setVerTutorial(true)} />
      <BalanceBar portafolio={portafolio} />
      <main className="grid">
        <div className="col-izq">
          <StockList
            acciones={acciones}
            seleccionada={seleccionada}
            onSeleccionar={setSeleccionada}
            accionesEnCartera={portafolio?.posiciones.filter((p) => p.cantidad > 0).map((p) => p.id_accion) ?? []}
          />
        </div>
        <div className="col-centro">
          <StockChart accion={accion} />
          <Portfolio portafolio={portafolio} transacciones={transacciones} />
        </div>
        <div className="col-der">
          <TradePanel accion={accion} portafolio={portafolio} onOperacion={refrescarCuenta} />
          <MentorChat hayOperaciones={transacciones.length > 0} />
        </div>
      </main>
      <footer>{t("simulador.pie")}</footer>

      {verTutorial && <Tour onTerminar={cerrarTutorial} />}
    </div>
  );
}
