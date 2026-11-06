import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useTranslation } from "react-i18next";

// Renderiza **negritas** y listas con "- " sin usar dangerouslySetInnerHTML (seguro ante texto de la IA).
function Texto({ texto }) {
  const linea = (l, k) => {
    const partes = l.split(/(\*\*[^*]+\*\*)/g).map((p, n) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={n}>{p.slice(2, -2)}</strong> : p
    );
    return <span key={k}>{partes}</span>;
  };
  return (
    <div className="mentor-texto">
      {texto.split("\n").map((l, k) =>
        l.trim().startsWith("- ") ? (
          <div key={k} className="vineta">• {linea(l.trim().slice(2), k)}</div>
        ) : (
          <div key={k}>{l.trim() ? linea(l, k) : <br />}</div>
        )
      )}
    </div>
  );
}

export default function MentorChat({ hayOperaciones }) {
  const { t } = useTranslation();
  const [mensajes, setMensajes] = useState([]);
  const mensajesVisibles = mensajes.length
    ? mensajes
    : [{ rol: "mentor", texto: t("simulador.mentor.bienvenida") }];
  const [pregunta, setPregunta] = useState("");
  const [pensando, setPensando] = useState(false);
  const [modoLocal, setModoLocal] = useState(false);
  const fin = useRef(null);

  useEffect(() => {
    fin.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [mensajes, pensando]);

  const consultar = async (textoPregunta) => {
    if (pensando) return;
    const historial = mensajesVisibles.slice(-4).map(({ rol, texto }) => ({ rol, texto }));
    setMensajes((m) => [...(m.length ? m : mensajesVisibles), { rol: "yo", texto: textoPregunta || t("simulador.mentor.analiza") }]);
    setPregunta("");
    setPensando(true);
    try {
      const r = await api.analisisIA(textoPregunta, historial);
      setModoLocal(r.modo === "local");
      setMensajes((m) => [...m, { rol: "mentor", texto: r.respuesta }]);
    } catch (err) {
      setMensajes((m) => [...m, { rol: "mentor", texto: `⚠️ ${err.message}`, error: true }]);
    } finally {
      setPensando(false);
    }
  };

  const enviar = (e) => {
    e.preventDefault();
    if (pregunta.trim()) consultar(pregunta.trim());
  };

  return (
    <section className="card mentor" data-tour="mentor">
      <h2>🎓 {t("simulador.mentor.titulo")}</h2>
      <p className="ayuda">{t("simulador.mentor.descripcion")}</p>

      <div className="mentor-chat" aria-live="polite">
        {mensajesVisibles.map((m, i) => (
          <div key={i} className={`burbuja ${m.rol} ${m.error ? "error" : ""}`}>
            <Texto texto={m.texto} />
          </div>
        ))}
        {pensando && <div className="burbuja mentor pensando">{t("simulador.mentor.pensando")}</div>}
        <div ref={fin} />
      </div>

      <button className="btn primario grande" disabled={pensando} onClick={() => consultar(null)}>
        {hayOperaciones ? `🔍 ${t("simulador.mentor.analiza")}` : `🔍 ${t("simulador.mentor.consejoInicial")}`}
      </button>

      <form className="mentor-form" onSubmit={enviar}>
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder={t("simulador.mentor.placeholder")}
          maxLength={500}
          disabled={pensando}
        />
        <button className="btn mini" disabled={pensando || !pregunta.trim()}>{t("simulador.mentor.enviar")}</button>
      </form>
      {modoLocal && <p className="ayuda">{t("simulador.mentor.modoDemo")}</p>}
    </section>
  );
}
