import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const ThemeCtx = createContext(null);
export const useTema = () => useContext(ThemeCtx);

const CLAVE = "inversim_tema";

function temaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "claro" || guardado === "oscuro") return guardado;
  } catch {
    /* sin almacenamiento disponible */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

// Debe ir dentro de <AuthProvider>: sincroniza el tema con la cuenta del usuario.
export function ThemeProvider({ children }) {
  const { usuario, actualizarAjustes } = useAuth();
  const [tema, setTema] = useState(temaInicial);

  // Aplica el tema al <html> (Tailwind y styles.css leen la clase "dark").
  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "oscuro");
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      /* no pasa nada */
    }
  }, [tema]);

  // Al iniciar sesión manda la preferencia guardada en la cuenta (p. ej. desde otro dispositivo).
  useEffect(() => {
    if (usuario?.tema) setTema(usuario.tema);
  }, [usuario?.tema]);

  // Se aplica al instante; si el servidor falla, vuelve al valor anterior.
  const cambiarTema = useCallback(
    async (nuevo) => {
      const anterior = tema;
      setTema(nuevo);
      if (!usuario) return;
      try {
        await actualizarAjustes({ tema: nuevo });
      } catch (e) {
        setTema(anterior);
        throw e;
      }
    },
    [tema, usuario, actualizarAjustes]
  );

  return (
    <ThemeCtx.Provider value={{ tema, esOscuro: tema === "oscuro", cambiarTema }}>
      {children}
    </ThemeCtx.Provider>
  );
}