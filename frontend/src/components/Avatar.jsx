import { useEffect, useState } from "react";
import { useFotoLocal } from "../fotoSimulada";

const COLORES = ["bg-indigo-600", "bg-emerald-600", "bg-rose-600", "bg-amber-600", "bg-sky-600", "bg-violet-600"];

function iniciales(nombre = "") {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

function colorPara(nombre = "") {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) % COLORES.length;
  return COLORES[h];
}

// Muestra la foto del usuario o, si no hay (o no carga), un círculo con sus iniciales.
export default function Avatar({ usuario, className = "h-10 w-10 text-sm" }) {
  const local = useFotoLocal(usuario?.id);
  const src = local || usuario?.foto_url;
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [src]);

  if (src && !fallo) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFallo(true)}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} ${colorPara(usuario?.nombre)} inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white`}
    >
      {iniciales(usuario?.nombre)}
    </span>
  );
}