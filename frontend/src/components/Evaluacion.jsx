import { useState } from "react";
import { api } from "../api";
import { useTranslation } from "react-i18next";

export default function Evaluacion({ ciclo, onCompletada }) {
  const { t } = useTranslation();
  const [fase, setFase] = useState("inicio"); // inicio | respondiendo | resultado
  const [evaluacion, setEvaluacion] = useState(null);
  const [respuestas, setRespuestas] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const faltan = Math.max(0, ciclo.meta - ciclo.operaciones);
  const porcentaje = Math.min(100, (ciclo.operaciones / ciclo.meta) * 100);

  const empezar = async () => {
    setCargando(true);
    setError("");
    try {
      const ev = await api.evaluacion();
      setEvaluacion(ev);
      setRespuestas(Array(ev.preguntas.length).fill(null));
      setFase("respondiendo");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const enviar = async () => {
    setCargando(true);
    setError("");
    try {
      setResultado(await api.responderEvaluacion(evaluacion.id, respuestas));
      setFase("resultado");
      onCompletada?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const reiniciar = () => {
    setFase("inicio");
    setEvaluacion(null);
    setResultado(null);
  };

  return (
    <section className="card">
      <h2>📝 {t("evaluacion.titulo")}</h2>

      {fase === "inicio" && (
        <>
          <p className="ayuda">
            {t("evaluacion.descripcion", { cantidad: ciclo.meta })}
          </p>
          <div className="barra" aria-label={t("evaluacion.progresoCiclo")}>
            <div className="barra-relleno" style={{ width: `${porcentaje}%` }} />
          </div>
          <p className="ciclo-texto">
            {ciclo.listo
              ? `🎉 ${t("evaluacion.lista")}`
              : t("evaluacion.operacionesCiclo", { realizadas: Math.min(ciclo.operaciones, ciclo.meta), meta: ciclo.meta, faltan })}
          </p>
          <button className="btn primario" disabled={!ciclo.listo || cargando} onClick={empezar}>
            {ciclo.evaluacion_pendiente ? t("evaluacion.continuar") : t("evaluacion.empezar")}
          </button>
        </>
      )}

      {fase === "respondiendo" && evaluacion && (
        <>
          {evaluacion.preguntas.map((p, qi) => (
            <fieldset key={qi} className="pregunta">
              <legend>{qi + 1}. {p.texto}</legend>
              {p.opciones.map((op, oi) => (
                <label key={oi} className={`opcion ${respuestas[qi] === oi ? "elegida" : ""}`}>
                  <input
                    type="radio"
                    name={`q${qi}`}
                    checked={respuestas[qi] === oi}
                    onChange={() => setRespuestas((r) => r.map((v, k) => (k === qi ? oi : v)))}
                  />
                  {op}
                </label>
              ))}
            </fieldset>
          ))}
          <button className="btn primario grande" disabled={cargando || respuestas.includes(null)} onClick={enviar}>
            {respuestas.includes(null)
              ? t("evaluacion.respondeTodo", { respondidas: respuestas.filter((r) => r !== null).length, total: respuestas.length })
              : t("evaluacion.entregar")}
          </button>
        </>
      )}

      {fase === "resultado" && resultado && (
        <>
          <div className="nota">
            <span className="nota-num">{resultado.puntaje}/{resultado.total}</span>
            <span>{resultado.mensaje}</span>
          </div>
          {resultado.detalle.map((d, qi) => (
            <div key={qi} className={`revision ${d.acerto ? "bien" : "mal"}`}>
              <strong>{d.acerto ? "✅" : "❌"} {qi + 1}. {d.texto}</strong>
              <div>
                {t("evaluacion.tuRespuesta")} {d.elegida === null ? "—" : d.opciones[d.elegida]}
                {!d.acerto && <> · {t("evaluacion.correcta")}: <strong>{d.opciones[d.correcta]}</strong></>}
              </div>
              <div className="explicacion">💡 {d.explicacion}</div>
            </div>
          ))}
          <button className="btn primario" onClick={reiniciar}>{t("evaluacion.volver")}</button>
        </>
      )}

      {error && <p className="msg error">{error}</p>}
    </section>
  );
}
