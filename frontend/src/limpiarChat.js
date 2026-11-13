const PREFIJO = "inversim_bpchat_";
const DUENO = "inversim_chatdueno";
const PENDIENTE = "inversim_chat_pendiente";

const esBotpress = (k) => {
  const l = k.toLowerCase();
  return l.startsWith("bp") || l.includes("botpress");
};

function guardar(id) {
  const datos = {};
  Object.keys(localStorage).filter(esBotpress).forEach((k) => (datos[k] = localStorage.getItem(k)));
  localStorage.setItem(PREFIJO + id, JSON.stringify(datos));
}

// Se llama cuando ya se sabe quién inició sesión.
export function cambiarChatA(id) {
  try {
    const dueno = localStorage.getItem(DUENO);
    if (dueno === String(id)) return;
    if (dueno) guardar(dueno);
    localStorage.setItem(DUENO, String(id));
    localStorage.setItem(PENDIENTE, String(id));
    window.location.reload();
  } catch (e) {}
}

// Se llama al cerrar sesión.
export function liberarChat() {
  try {
    const dueno = localStorage.getItem(DUENO);
    if (dueno) guardar(dueno);
    localStorage.removeItem(DUENO);
    localStorage.setItem(PENDIENTE, "ninguno");
    window.location.reload();
  } catch (e) {}
}