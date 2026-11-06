import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./locales/es.json";
import en from "./locales/en.json";
import pt from "./locales/pt.json";

export const IDIOMAS = [
  { codigo: "es", nombre: "Español", bandera: "🇪🇸" },
  { codigo: "en", nombre: "English", bandera: "🇬🇧" },
  { codigo: "pt", nombre: "Português", bandera: "🇧🇷" },
];

const CLAVE = "inversim_idioma";
const soportados = IDIOMAS.map((i) => i.codigo);

// Prioridad: lo último elegido en este navegador > idioma del navegador > español.
function idiomaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (soportados.includes(guardado)) return guardado;
  } catch {
    /* sin almacenamiento disponible */
  }
  const base = (navigator.language || "es").slice(0, 2).toLowerCase();
  return soportados.includes(base) ? base : "es";
}

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en }, pt: { translation: pt } },
  lng: idiomaInicial(),
  fallbackLng: "es",
  interpolation: { escapeValue: false }, // React ya escapa el contenido
});

document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(CLAVE, lng);
  } catch {
    /* no pasa nada */
  }
});

export default i18n;
