import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, token } from "./api";
import { cambiarChatA, liberarChat } from "./limpiarChat";
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Si hay un token guardado, hay que verificarlo con el servidor antes de decidir a dónde ir.
  const [cargando, setCargando] = useState(Boolean(token.get()));

  useEffect(() => {
    if (!token.get()) return;
    api.me()
      .then(setUsuario)
      .catch(() => token.clear())
      .finally(() => setCargando(false));
  }, []);

    // Cuando se sabe quién es el usuario, carga su conversación del chat.
  useEffect(() => {
    if (usuario?.id) cambiarChatA(usuario.id);
  }, [usuario?.id]);

  // El cliente de la API avisa cuando el servidor rechaza el token (401).
  useEffect(() => {
    const alCerrar = () => {
      setUsuario(null);
      liberarChat();
    };
    window.addEventListener("inversim:logout", alCerrar);
    return () => window.removeEventListener("inversim:logout", alCerrar);
  }, []);

  const iniciarSesion = useCallback(async (correo, password) => {
    const r = await api.login(correo, password);
    token.set(r.token);
    setUsuario(r.usuario);
  }, []);

  const registrarse = useCallback(async (nombre, correo, password) => {
    const r = await api.registro(nombre, correo, password);
    token.set(r.token);
    setUsuario(r.usuario);
  }, []);

  const cerrarSesion = useCallback(() => {
    token.clear();
    setUsuario(null);
    liberarChat();
  }, []);

  const marcarTutorialVisto = useCallback(async () => {
    setUsuario((u) => (u ? { ...u, tutorial_completado: true } : u));
    try {
      await api.tutorialCompletado();
    } catch {
      /* si falla, el tutorial volverá a aparecer la próxima vez: no es grave */
    }
  }, []);
const actualizarAjustes = useCallback(async (cambios) => {
    const actualizado = await api.actualizarAjustes(cambios);
    setUsuario(actualizado);
    return actualizado;
  }, []);
const reiniciarSimulacion = useCallback(async () => {
  const resultado = await api.reiniciarSimulacion();
  setUsuario(resultado.usuario);
  return resultado;
}, []);
return (
  <AuthCtx.Provider value={{ usuario, cargando, iniciarSesion, registrarse, cerrarSesion, marcarTutorialVisto, actualizarAjustes, reiniciarSimulacion }}>
      {children}
    </AuthCtx.Provider>
  );
}
