import { dinero } from "./api";

export const conSigno = (n, formatear = dinero) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatear(Math.abs(n))}`;

export const colorResultado = (n) =>
  n > 0 ? "text-green-600 dark:text-green-400" : n < 0 ? "text-red-600 dark:text-red-400" : "text-suave";

export const fechaHora = (iso, lang) =>
  new Date(iso).toLocaleString(lang, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

// "hace 5 minutos", "yesterday", "há 2 horas"… según el idioma.
export function hace(iso, lang) {
  const seg = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const abs = Math.abs(seg);
  if (abs < 60) return rtf.format(seg, "second");
  if (abs < 3600) return rtf.format(Math.round(seg / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), "hour");
  return rtf.format(Math.round(seg / 86400), "day");
}