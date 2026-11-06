import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../AuthContext";
import { useCurrency } from "../CurrencyContext";
import { IDIOMAS } from "../i18n";
import { useTema } from "../ThemeContext";
import { panel } from "../ui";
import Aviso from "./Aviso";
import Avatar from "./Avatar";
import NavBar from "./NavBar";

export default function Ajustes() {
  const { t, i18n } = useTranslation();
  const { usuario, actualizarAjustes, reiniciarSimulacion: reiniciarJuego } = useAuth();
  const {
    formatCapitalInicial, moneda, monedas, monedasDisponibles, estado: estadoTasas, vigenciaDesde,
    vigenciaEcb, fuenteTrm, fuenteEcb, actualizando, errorActualizacion,
    actualizarTasa, elegirMoneda,
  } = useCurrency();
  const { esOscuro, cambiarTema } = useTema();
  const [estado, setEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarReinicio, setConfirmarReinicio] = useState(false);
  const [reiniciando, setReiniciando] = useState(false);

  // Envuelve cada cambio: muestra "guardado" o el error (los contextos ya revierten solos).
  const guardar = async (ejecutar) => {
    setGuardando(true);
    setEstado(null);
    try {
      await ejecutar();
      setEstado({ tipo: "ok", clave: "ajustes.guardado" });
    } catch {
      setEstado({ tipo: "error", clave: "ajustes.error" });
    } finally {
      setGuardando(false);
    }
  };

  const alternarTema = () => guardar(() => cambiarTema(esOscuro ? "claro" : "oscuro"));

  const reiniciarSimulacion = async () => {
    setReiniciando(true);
    setEstado(null);
    try {
      await reiniciarJuego();
      setConfirmarReinicio(false);
      setEstado({ tipo: "ok", texto: t("ajustes.reinicio.listo") });
    } catch (error) {
      setEstado({ tipo: "error", texto: error.message || t("ajustes.reinicio.error") });
    } finally {
      setReiniciando(false);
    }
  };

  const elegirIdioma = (codigo) => {
    const anterior = i18n.resolvedLanguage;
    if (codigo === anterior) return;
    return guardar(async () => {
      await i18n.changeLanguage(codigo); // se aplica al instante
      try {
        await actualizarAjustes({ idioma: codigo });
      } catch (e) {
        await i18n.changeLanguage(anterior);
        throw e;
      }
    });
  };

  const nombresMoneda = new Intl.DisplayNames([i18n.resolvedLanguage], { type: "currency" });
  const formatearFecha = (fecha) => fecha
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: "medium", timeZone: "UTC" })
      .format(new Date(`${fecha}T12:00:00Z`))
    : null;
  const fechaTrm = formatearFecha(vigenciaDesde);
  const fechaEcb = formatearFecha(vigenciaEcb);

  return (
    <div className="app">
      <NavBar />
      <main className="mx-auto w-full max-w-4xl">
        <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="m-0 text-2xl font-extrabold sm:text-3xl">{t("ajustes.titulo")}</h1>
            <p className="mb-0 mt-1 text-sm text-suave sm:text-base">{t("ajustes.subtitulo")}</p>
          </div>
          <Link
            to="/perfil"
            className="inline-flex items-center gap-3 self-start rounded-xl border border-solid border-borde bg-tarjeta px-3 py-2 text-sm font-semibold text-texto no-underline hover:border-primario sm:self-auto"
          >
            <Avatar usuario={usuario} className="h-8 w-8 text-xs" />
            <span>{t("ajustes.editarPerfil")}</span>
          </Link>
        </header>

        <section className={`${panel} mb-4 sm:mb-6`} aria-labelledby="titulo-moneda">
          <div className="mb-4 flex items-start gap-3">
            <span className="currency-icon" aria-hidden="true">¤</span>
            <div>
              <h2 id="titulo-moneda" className="m-0 text-base font-bold sm:text-lg">{t("ajustes.moneda.titulo")}</h2>
              <p className="mb-0 mt-1 text-sm text-suave">{t("ajustes.moneda.descripcion")}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(220px,320px)_1fr] md:items-start">
            <div className="settings-currency-select">
              <label htmlFor="currency-select" className="mb-2 block text-sm font-semibold">
                {t("moneda.etiqueta")}
              </label>
              <select
                id="currency-select"
                value={moneda}
                onChange={(e) => elegirMoneda(e.target.value)}
                className="w-full"
              >
                {monedas.map((codigo) => (
                  <option key={codigo} value={codigo} disabled={!monedasDisponibles.includes(codigo)}>
                    {codigo} — {nombresMoneda.of(codigo)}
                  </option>
                ))}
              </select>
            </div>
            <div className="currency-info">
              {(fechaTrm || fechaEcb) && (
                <span className="currency-validity">
                  {fechaTrm && fechaEcb
                    ? t("moneda.vigencias", { trm: fechaTrm, ecb: fechaEcb })
                    : fechaTrm
                      ? t("moneda.vigenciaTrm", { trm: fechaTrm })
                      : t("moneda.vigenciaEcb", { ecb: fechaEcb })}
                </span>
              )}
              {estadoTasas !== "lista" && (
                <span role={estadoTasas === "error" ? "status" : undefined} className={`currency-status ${estadoTasas}`}>
                  <span className="currency-status-dot" aria-hidden="true" />
                  {t(`moneda.estado.${estadoTasas}`)}
                </span>
              )}
              <div className="currency-sources">
                {fuenteTrm && (
                  <a href={fuenteTrm} target="_blank" rel="noreferrer">{t("moneda.fuenteTrm")}</a>
                )}
                {fuenteEcb && (
                  <a href={fuenteEcb} target="_blank" rel="noreferrer">{t("moneda.fuenteEcb")}</a>
                )}
                <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
                  {t("moneda.licenciaTrm")}
                </a>
                <button
                  type="button"
                  className="currency-refresh"
                  onClick={actualizarTasa}
                  disabled={actualizando || estadoTasas === "cargando"}
                  aria-busy={actualizando}
                >
                  {actualizando ? t("moneda.actualizando") : t("moneda.actualizar")}
                </button>
              </div>
              {errorActualizacion && (
                <span role="alert" className="currency-refresh-error">{errorActualizacion}</span>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {/* Apariencia */}
          <section className={panel} aria-labelledby="titulo-apariencia">
            <h2 id="titulo-apariencia" className="m-0 text-base font-bold sm:text-lg">{t("ajustes.apariencia.titulo")}</h2>
            <p className="mb-4 mt-1 text-sm text-suave">{t("ajustes.apariencia.descripcion")}</p>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-solid border-borde p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="text-2xl">{esOscuro ? "🌙" : "☀️"}</span>
                <div>
                  <span id="etiqueta-oscuro" className="block text-sm font-semibold">{t("ajustes.apariencia.modoOscuro")}</span>
                  <span className="block text-xs text-suave">
                    {esOscuro ? t("ajustes.apariencia.activado") : t("ajustes.apariencia.desactivado")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={esOscuro}
                aria-labelledby="etiqueta-oscuro"
                onClick={alternarTema}
                disabled={guardando}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-0 p-0 transition-colors disabled:cursor-wait disabled:opacity-60 ${
                  esOscuro ? "bg-primario" : "bg-gray-300"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    esOscuro ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Idioma */}
          <section className={panel} aria-labelledby="titulo-idioma">
            <h2 id="titulo-idioma" className="m-0 text-base font-bold sm:text-lg">{t("ajustes.idioma.titulo")}</h2>
            <p className="mb-4 mt-1 text-sm text-suave">{t("ajustes.idioma.descripcion")}</p>

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="sr-only">{t("ajustes.idioma.titulo")}</legend>
              <div className="language-options">
                {IDIOMAS.map(({ codigo, nombre, bandera }) => {
                  const activo = i18n.resolvedLanguage === codigo;
                  return (
                    <label
                      key={codigo}
                      className={`relative mb-0 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-solid px-2 py-2 text-sm font-semibold transition-colors ${
                        activo
                          ? "border-primario bg-indigo-50 dark:bg-indigo-950/50"
                          : "border-borde hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="radio"
                        name="idioma"
                        value={codigo}
                        checked={activo}
                        onChange={() => elegirIdioma(codigo)}
                        disabled={guardando}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primario"
                      />
                      <span aria-hidden="true" className="text-xs leading-none">{bandera}</span>
                      <span className="whitespace-nowrap text-xs sm:text-sm">{nombre}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>
        </div>

        <section className={`${panel} mt-4 border-red-300 dark:border-red-900`} aria-labelledby="titulo-reinicio">
          <h2 id="titulo-reinicio" className="m-0 text-base font-bold text-red-800 dark:text-red-300 sm:text-lg">
            {t("ajustes.reinicio.titulo")}
          </h2>
          <p className="mb-4 mt-1 text-sm text-suave">{t("ajustes.reinicio.descripcion")}</p>
          <button
            type="button"
            onClick={() => {
              setEstado(null);
              setConfirmarReinicio(true);
            }}
            disabled={reiniciando || guardando}
            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-solid border-red-700 bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
          >
            {t("ajustes.reinicio.boton")}
          </button>
        </section>

        {confirmarReinicio && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="titulo-confirmar-reinicio"
              aria-describedby="descripcion-confirmar-reinicio"
              className={`${panel} w-full max-w-lg`}
            >
              <h2 id="titulo-confirmar-reinicio" className="m-0 text-lg font-bold">
                {t("ajustes.reinicio.confirmarTitulo")}
              </h2>
              <p id="descripcion-confirmar-reinicio" className="mb-5 mt-2 text-sm text-suave">
                {t("ajustes.reinicio.confirmarDescripcion", { capital: formatCapitalInicial() })}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmarReinicio(false)}
                  disabled={reiniciando}
                  className="cursor-pointer rounded-xl border border-solid border-borde bg-tarjeta px-4 py-2 text-sm font-semibold text-texto disabled:opacity-60"
                >
                  {t("ajustes.reinicio.cancelar")}
                </button>
                <button
                  type="button"
                  onClick={reiniciarSimulacion}
                  disabled={reiniciando}
                  className="cursor-pointer rounded-xl border border-solid border-red-700 bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
                >
                  {reiniciando ? t("ajustes.reinicio.reiniciando") : t("ajustes.reinicio.confirmar")}
                </button>
              </div>
            </section>
          </div>
        )}

        <Aviso estado={estado} />
      </main>
    </div>
  );
}