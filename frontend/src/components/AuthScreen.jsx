import { useState } from "react";
import { useAuth } from "../AuthContext";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useCurrency } from "../CurrencyContext";

export default function AuthScreen() {
  const { t } = useTranslation();
  const { formatCapitalInicial } = useCurrency();
  const { iniciarSesion, registrarse } = useAuth();
  const [modo, setModo] = useState("login"); // "login" | "registro"
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const esRegistro = modo === "registro";

  const cambiarModo = (m) => {
    setModo(m);
    setError("");
    setMensaje("");
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    if (modo === "recuperar") {
      setCargando(true);
      try {
        const respuesta = await api.solicitarRestablecimiento(correo.trim());
        setMensaje(respuesta.mensaje);
      } catch (err) {
        setError(err.status === undefined ? t("auth.errorConexion") : err.message);
      } finally {
        setCargando(false);
      }
      return;
    }
    if (esRegistro && password !== confirmar) return setError(t("auth.contrasenasNoCoinciden"));
    setCargando(true);
    try {
      if (esRegistro) await registrarse(nombre.trim(), correo.trim(), password);
      else await iniciarSesion(correo.trim(), password);
      // La redirección la hace <SoloInvitados> cuando cambia el usuario.
    } catch (err) {
      setError(err.status === undefined ? t("auth.errorConexion") : err.message);
      setCargando(false);
    }
  };

  return (
    <div className="bienvenida">
      <form className="card bienvenida-card" onSubmit={enviar}>
        <h1 className="auth-brand">
          <img src="/inversim-icon.png" alt="" />
          InverSim
        </h1>
        <p className="sub">
          {t("auth.descripcionAntes")} <strong>{t("auth.dineroFicticio")}</strong>{t("auth.descripcionDespues")}
        </p>

        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!esRegistro && modo !== "recuperar"} className={!esRegistro && modo !== "recuperar" ? "activa" : ""} onClick={() => cambiarModo("login")}>
            {t("auth.iniciarSesion")}
          </button>
          <button type="button" role="tab" aria-selected={esRegistro} className={esRegistro ? "activa" : ""} onClick={() => cambiarModo("registro")}>
            {t("auth.crearCuenta")}
          </button>
        </div>

        {esRegistro && (
          <>
            <label htmlFor="nombre">{t("auth.nombre")}</label>
            <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={50} required autoFocus />
          </>
        )}

        <label htmlFor="correo">{t("auth.correo")}</label>
        <input id="correo" type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required autoFocus={!esRegistro} />

        {modo !== "recuperar" && (
          <>
            <label htmlFor="password">{t("auth.contrasena")}</label>
            <input
              id="password"
              type="password"
              autoComplete={esRegistro ? "new-password" : "current-password"}
              minLength={esRegistro ? 8 : undefined}
              maxLength={64}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {esRegistro && <p className="ayuda">{t("auth.minimoContrasena")}</p>}
          </>
        )}

        {esRegistro && (
          <>
            <label htmlFor="confirmar">{t("auth.repiteContrasena")}</label>
            <input id="confirmar" type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
          </>
        )}

        {modo === "login" && (
          <p className="ayuda">
            <button type="button" className="link" onClick={() => cambiarModo("recuperar")}>
              {t("auth.olvidoPassword")}
            </button>
          </p>
        )}

        {error && <p className="msg error" role="alert">{error}</p>}
        {mensaje && <p className="msg ok" role="status">{mensaje}</p>}

        <button className="btn primario grande" disabled={cargando}>
          {cargando
            ? t("auth.espera")
            : modo === "recuperar"
              ? t("auth.enviarEnlace")
              : esRegistro
                ? t("auth.crearCuentaEmpezar", { capital: formatCapitalInicial() })
                : t("auth.entrar")}
        </button>

        <p className="ayuda centro">
          {modo === "recuperar"
            ? ""
            : esRegistro
              ? `${t("auth.yaTienesCuenta")} `
              : `${t("auth.primeraVez")} `}
          <button
            type="button"
            className="link"
            onClick={() => cambiarModo(modo === "recuperar" || esRegistro ? "login" : "registro")}
          >
            {modo === "recuperar"
              ? t("auth.volverLogin")
              : esRegistro
                ? t("auth.iniciaSesion")
                : t("auth.creaCuenta")}
          </button>
        </p>
      </form>
    </div>
  );
}
