import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../AuthContext";
import Avatar from "./Avatar";
import BuscadorGlobal from "./BuscadorGlobal";
import CampanaAlertas from "./CampanaAlertas";

export default function NavBar({ onTutorial }) {
  const { t } = useTranslation();
  const { usuario, cerrarSesion } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-main-row">
        <div className="navbar-brand-nav">
          <NavLink to="/" end className="logo" aria-label="InverSim">
            <span className="logo-icon" aria-hidden="true">
              <img src={`${import.meta.env.BASE_URL}inversim-icon.png`} alt="" />
            </span>
            <span>InverSim</span>
          </NavLink>
          <div className="nav-links" aria-label={t("nav.navegacion")}>
            <NavLink to="/" end className="nav-link">
              <span className="nav-link-icon" aria-hidden="true">▦</span>
              {t("nav.simulador")}
            </NavLink>
            <NavLink to="/progreso" className="nav-link" data-tour="progreso">
              <span className="nav-link-icon" aria-hidden="true">↗</span>
              {t("nav.progreso")}
            </NavLink>
            <NavLink to="/billetera" className="nav-link">
              <span className="nav-link-icon" aria-hidden="true">▤</span>
              {t("nav.billetera")}
            </NavLink>
            <NavLink to="/ajustes" className="nav-link">
              <span className="nav-link-icon" aria-hidden="true">⚙</span>
              {t("nav.ajustes")}
            </NavLink>
          </div>
        </div>
        <div className="navbar-actions">
          <div className="navbar-alertas"><CampanaAlertas /></div>
          <NavLink to="/perfil" aria-label={t("nav.perfil")} className="profile-link">
            <Avatar usuario={usuario} className="h-9 w-9 text-xs" />
            <span className="profile-greeting">{t("nav.hola", { nombre: usuario?.nombre })}</span>
          </NavLink>
          <button
            type="button"
            className="logout-button"
            onClick={cerrarSesion}
            aria-label={t("nav.cerrarSesion")}
            title={t("nav.cerrarSesion")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v9" />
              <path d="M7.05 5.95a8 8 0 1 0 9.9 0" />
            </svg>
            <span className="logout-label" aria-hidden="true">{t("nav.cerrarSesion")}</span>
          </button>
        </div>
      </div>
      <div className="navbar-tools-row">
        <div className="navbar-search">
          <BuscadorGlobal />
        </div>
        {onTutorial && (
          <button type="button" className="tutorial-button" onClick={onTutorial}>
            {t("nav.tutorial")}
          </button>
        )}
      </div>
    </nav>
  );
}
