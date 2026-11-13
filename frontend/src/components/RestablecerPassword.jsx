import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";

export default function RestablecerPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [completado, setCompletado] = useState(false);
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmar) {
      setError(t("auth.contrasenasNoCoinciden"));
      return;
    }
    setCargando(true);
    try {
      await api.restablecerPassword(token, password);
      setCompletado(true);
    } catch (err) {
      setError(err.status === undefined ? t("auth.errorConexion") : err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bienvenida">
      <form className="card bienvenida-card" onSubmit={enviar}>
        <h1 className="auth-brand">
          <img src={`${import.meta.env.BASE_URL}inversim-icon.png`} alt="" />
          InverSim
        </h1>
        <h2>{t("auth.restablecerTitulo")}</h2>
        {completado ? (
          <>
            <p className="msg ok" role="status">{t("auth.passwordActualizado")}</p>
            <Link className="btn primario grande" to="/login">{t("auth.entrar")}</Link>
          </>
        ) : !token ? (
          <>
            <p className="msg error" role="alert">{t("auth.enlaceInvalido")}</p>
            <Link className="link" to="/login">{t("auth.volverLogin")}</Link>
          </>
        ) : (
          <>
            <label htmlFor="password">{t("auth.nuevaContrasena")}</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={64}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="ayuda">{t("auth.minimoContrasena")}</p>
            <label htmlFor="confirmar">{t("auth.repiteContrasena")}</label>
            <input
              id="confirmar"
              type="password"
              autoComplete="new-password"
              maxLength={64}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
            />
            {error && <p className="msg error" role="alert">{error}</p>}
            <button className="btn primario grande" disabled={cargando}>
              {cargando ? t("auth.espera") : t("auth.guardarNuevaContrasena")}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
