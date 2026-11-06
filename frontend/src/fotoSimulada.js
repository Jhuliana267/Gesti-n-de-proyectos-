// Simulación de subida de foto de perfil.
// - La imagen se recorta a cuadrado, se reduce a 256 px y se guarda en este navegador (localStorage).
// - Al backend se le envía una URL ficticia (dominio .example, que nunca resuelve).
// Para una subida real, reemplaza solo el cuerpo de simularSubida(): debe devolver { url, dataUrl? }.
import { useSyncExternalStore } from "react";

const EVENTO = "inversim:foto";
const clave = (id) => `inversim_foto_${id}`;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function validarImagen(archivo) {
  if (!TIPOS.includes(archivo.type)) return "tipoInvalido";
  if (archivo.size > MAX_BYTES) return "muyGrande";
  return null;
}

function leer(id) {
  try {
    return localStorage.getItem(clave(id));
  } catch {
    return null;
  }
}

export function guardarFoto(id, dataUrl) {
  try {
    localStorage.setItem(clave(id), dataUrl);
  } catch {
    /* cuota llena: el avatar mostrará las iniciales */
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function borrarFoto(id) {
  try {
    localStorage.removeItem(clave(id));
  } catch {
    /* no pasa nada */
  }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(aviso) {
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso); // otras pestañas
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
  };
}

// Foto guardada en este navegador; el avatar se actualiza solo cuando cambia.
export function useFotoLocal(id) {
  return useSyncExternalStore(suscribir, () => (id ? leer(id) : null));
}

function reducirImagen(archivo, lado = 256) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const corte = Math.min(img.width, img.height); // recorte cuadrado centrado
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = lado;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; // las transparencias del PNG quedan en blanco
      ctx.fillRect(0, 0, lado, lado);
      ctx.drawImage(img, (img.width - corte) / 2, (img.height - corte) / 2, corte, corte, 0, 0, lado, lado);
      resolver(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error("imagen no válida"));
    };
    img.src = url;
  });
}

export async function simularSubida(archivo, idUsuario, onProgreso) {
  const dataUrl = await reducirImagen(archivo);
  let avance = 0;
  while (avance < 100) {
    await new Promise((r) => setTimeout(r, 140));
    avance = Math.min(100, avance + 8 + Math.random() * 12);
    onProgreso(Math.round(avance));
  }
  return { url: `https://cdn.inversim.example/avatares/${idUsuario}/${Date.now()}.jpg`, dataUrl };
}