// Cliente de la API (v2: envía el token de sesión en cada petición).
// En desarrollo, Vite reenvía /api -> http://127.0.0.1:8000
const BASE = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "inversim_token";

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && t) {
      token.clear();
      window.dispatchEvent(new Event("inversim:logout"));
    }
    const esAuth = path === "/api/registro" || path === "/api/login";
    let detalle = "Algo salió mal. Intenta de nuevo.";
    if (typeof data.detail === "string") {
      detalle = data.detail;
    } else if (Array.isArray(data.detail)) {
      const msg = data.detail[0]?.msg;
      if (typeof msg === "string" && msg.startsWith("Value error, ")) {
        detalle = msg.slice("Value error, ".length); // mensajes propios del backend
      } else {
        detalle = esAuth
          ? "Revisa los datos ingresados (correo válido y contraseña de 8 a 64 caracteres)."
          : "Revisa los datos ingresados.";
      }
    }
    const err = new Error(detalle);
    err.status = res.status;
    throw err;
  }
  return data;
}

const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body ?? {}) });

export const api = {
  // --- Autenticación ---
  registro: (nombre, correo, password) => post("/api/registro", { nombre, correo, password }),
  login: (correo, password) => post("/api/login", { correo, password }),
  solicitarRestablecimiento: (correo) => post("/api/recuperar-password", { correo }),
  restablecerPassword: (token, password) =>
    post("/api/restablecer-password", { token, password }),
  me: () => request("/api/me"),
  tutorialCompletado: () => post("/api/me/tutorial-completado"),
  actualizarAjustes: (cambios) =>
    request("/api/me/ajustes", { method: "PATCH", body: JSON.stringify(cambios) }),
  reiniciarSimulacion: () => post("/api/me/reiniciar-simulacion"),

  // --- Mercado (público) ---
  tasaCambio: () => request("/api/tasa-cambio"),
  actualizarTasaCambio: () => post("/api/tasa-cambio/actualizar"),
  acciones: () => request("/api/acciones"),
  historial: (idAccion, limite = 80) => request(`/api/acciones/${idAccion}/historial?limite=${limite}`),
  historialSimulado: (idAccion, periodo) =>
    request(`/api/acciones/${idAccion}/historial-simulado?periodo=${periodo}`),

  // --- Cuenta del usuario autenticado ---
  portafolio: () => request("/api/me/portafolio"),
  transacciones: () => request("/api/me/transacciones"),
  operar: async (payload) => {
    const r = await post("/api/transacciones", payload);
    // Aviso global: el sistema de alertas escucha este evento cuando se vende.
    if (r.tipo_operacion === "venta") {
      window.dispatchEvent(new CustomEvent("inversim:venta", { detail: r }));
    }
    return r;
  },
  billeteraResumen: () => request("/api/me/billetera/resumen"),
  // --- Mentor IA ---
  analisisIA: (pregunta, chat) => post("/api/analisis-ia", { pregunta: pregunta || null, chat: chat || [] }),

  // --- Progreso y evaluación ---
  progreso: () => request("/api/me/progreso"),
  evaluacion: () => request("/api/me/evaluacion"),
  responderEvaluacion: (id, respuestas) => post(`/api/me/evaluacion/${id}/responder`, { respuestas }),
};

export const dinero = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);
