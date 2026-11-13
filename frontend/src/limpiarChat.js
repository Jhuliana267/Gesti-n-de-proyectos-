// Guarda y restaura la conversación de Botpress por cuenta de InverSim (en este navegador).
const PREFIJO = "inversim_chat_";
const DUENO = "inversim_chatdueno";

const esBotpress = (k) => k.toLowerCase().startsWith("bp") || k.toLowerCase().includes("botpress");
const clavesBotpress = () => Object.keys(localStorage).filter(esBotpress);

function guardar(id) {
  const datos = {};
  clavesBotpress().forEach((k) => (datos[k] = localStorage.getItem(k)));
  localStorage.setItem(PREFIJO + id, JSON.stringify(datos));
}

function limpiar() {
  clavesBotpress().forEach((k) => localStorage.removeItem(k));
}

// Llamar cuando se sabe quién inició sesión.
export function cambiarChatA(id) {
  try {
    const dueno = localStorage.getItem(DUENO);
    if (dueno === String(id)) return;
    if (dueno) guardar(dueno);
    limpiar();
    const guardado = localStorage.getItem(PREFIJO + id);
    if (guardado) {
      Object.entries(JSON.parse(guardado)).forEach(([k, v]) => localStorage.setItem(k, v));
    }
    localStorage.setItem(DUENO, String(id));
    window.location.reload();
  } catch (e) {}
}

// Llamar al cerrar sesión.
export function liberarChat() {
  try {
    const dueno = localStorage.getItem(DUENO);
    if (dueno) guardar(dueno);
    limpiar();
    localStorage.removeItem(DUENO);
    window.location.reload();
  } catch (e) {}
}