import { useTranslation } from "react-i18next";

// Mensaje de estado. `estado` = { tipo: "ok" | "error", clave?: string, texto?: string }.
// Las claves se traducen al renderizar, así el mensaje cambia si cambias de idioma.
export default function Aviso({ estado }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="w-full">
      {estado && (
        <p
          className={`mx-0 mb-0 mt-3 rounded-xl px-3 py-2 text-sm ${
            estado.tipo === "ok"
              ? "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200"
              : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200"
          }`}
        >
          {estado.clave ? t(estado.clave) : estado.texto}
        </p>
      )}
    </div>
  );
}