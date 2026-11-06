import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

function Cargando() {
  return <div className="cargando">Cargando…</div>;
}

// Envuelve las páginas del simulador: sin sesión iniciada, redirige a /login.
export function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion }} />;
  return children;
}

// Para /login: si ya hay sesión, no tiene sentido mostrarlo.
export function SoloInvitados({ children }) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();
  if (cargando) return <Cargando />;
  if (usuario) return <Navigate to={ubicacion.state?.desde?.pathname || "/"} replace />;
  return children;
}
