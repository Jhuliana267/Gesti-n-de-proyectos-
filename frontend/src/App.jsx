import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertasProvider } from "./AlertasContext";
import { AuthProvider, useAuth } from "./AuthContext";
import { CurrencyProvider } from "./CurrencyContext";
import { ThemeProvider } from "./ThemeContext";
import { RutaProtegida, SoloInvitados } from "./RutaProtegida";
import AuthScreen from "./components/AuthScreen";
import Simulador from "./components/Simulador";
import Progreso from "./components/Progreso";
import Perfil from "./components/Perfil";
import Ajustes from "./components/Ajustes";
import WalletDashboard from "./components/WalletDashboard";
import RestablecerPassword from "./components/RestablecerPassword";

// Al iniciar sesión, el idioma guardado en la cuenta manda sobre el del navegador.
function SincronizarIdioma() {
  const { usuario } = useAuth();
  const { i18n } = useTranslation();
  useEffect(() => {
    if (usuario?.idioma && usuario.idioma !== i18n.resolvedLanguage) i18n.changeLanguage(usuario.idioma);
  }, [usuario?.idioma]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <AlertasProvider>
              <SincronizarIdioma />
              <Routes>
                <Route path="/login" element={<SoloInvitados><AuthScreen /></SoloInvitados>} />
                <Route path="/restablecer" element={<RestablecerPassword />} />
                <Route path="/" element={<RutaProtegida><Simulador /></RutaProtegida>} />
                <Route path="/progreso" element={<RutaProtegida><Progreso /></RutaProtegida>} />
                <Route path="/billetera" element={<RutaProtegida><WalletDashboard /></RutaProtegida>} />
                <Route path="/perfil" element={<RutaProtegida><Perfil /></RutaProtegida>} />
                <Route path="/ajustes" element={<RutaProtegida><Ajustes /></RutaProtegida>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AlertasProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </AuthProvider>
    </HashRouter>
  );
}