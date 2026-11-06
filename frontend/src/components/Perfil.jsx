import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../AuthContext";
import { useCurrency } from "../CurrencyContext";
import { borrarFoto, guardarFoto, simularSubida, validarImagen } from "../fotoSimulada";
import { botonPrimario, botonSecundario, panel } from "../ui";
import Aviso from "./Aviso";
import Avatar from "./Avatar";
import NavBar from "./NavBar";

const campo = "w-full rounded-xl text-sm sm:text-base";
const etiqueta = "mb-1 block text-sm font-semibold";

export default function Perfil() {
  const { t } = useTranslation();
  const { usuario, actualizarAjustes } = useAuth();
  const { formatCurrency } = useCurrency();
  const inputFoto = useRef(null);

  const [nombre, setNombre] = useState(usuario.nombre);
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [estadoNombre, setEstadoNombre] = useState(null);
  const [progreso, setProgreso] = useState(null); // null = no hay subida en curso
  const [estadoFoto, setEstadoFoto] = useState(null);

  const subiendo = progreso !== null;
  const limpio = nombre.trim();
  const hayCambio = limpio !== usuario.nombre;

  const guardarNombre = async (e) => {
    e.preventDefault();
    if (!limpio) return setEstadoNombre({ tipo: "error", clave: "perfil.cuenta.nombreVacio" });
    setGuardandoNombre(true);
    setEstadoNombre(null);
    try {
      await actualizarAjustes({ nombre: limpio });
      setNombre(limpio);
      setEstadoNombre({ tipo: "ok", clave: "perfil.cuenta.guardado" });
    } catch (err) {
      setEstadoNombre({ tipo: "error", texto: err.message });
    } finally {
      setGuardandoNombre(false);
    }
  };

  const elegirArchivo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    const problema = validarImagen(archivo);
    if (problema) return setEstadoFoto({ tipo: "error", clave: `perfil.foto.${problema}` });

    setEstadoFoto(null);
    setProgreso(0);
    try {
      const { url, dataUrl } = await simularSubida(archivo, usuario.id, setProgreso);
      await actualizarAjustes({ foto_url: url });
      guardarFoto(usuario.id, dataUrl);
      setEstadoFoto({ tipo: "ok", clave: "perfil.foto.listo" });
    } catch (err) {
      setEstadoFoto(err.status ? { tipo: "error", texto: err.message } : { tipo: "error", clave: "perfil.foto.error" });
    } finally {
      setProgreso(null);
    }
  };

  const quitarFoto = async () => {
    setEstadoFoto(null);
    try {
      await actualizarAjustes({ foto_url: null });
      borrarFoto(usuario.id);
      setEstadoFoto({ tipo: "ok", clave: "perfil.foto.quitada" });
    } catch (err) {
      setEstadoFoto({ tipo: "error", texto: err.message });
    }
  };

  return (
    <div className="app">
      <NavBar />
      <main className="mx-auto w-full max-w-4xl">
        <header className="mb-4 sm:mb-6">
          <h1 className="m-0 text-2xl font-extrabold sm:text-3xl">{t("perfil.titulo")}</h1>
          <p className="mb-0 mt-1 text-sm text-suave sm:text-base">{t("perfil.subtitulo")}</p>
        </header>

        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          {/* Foto de perfil */}
          <section className={`${panel} flex flex-col items-center text-center`} aria-labelledby="titulo-foto">
            <h2 id="titulo-foto" className="m-0 mb-4 text-base font-bold">{t("perfil.foto.titulo")}</h2>
            <Avatar
              usuario={usuario}
              className="h-28 w-28 text-3xl sm:h-32 sm:w-32 sm:text-4xl md:h-28 md:w-28 md:text-3xl lg:h-36 lg:w-36 lg:text-5xl"
            />

            {subiendo && (
              <div className="mt-4 w-full">
                <div
                  role="progressbar"
                  aria-label={t("perfil.foto.subiendoAria")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progreso}
                  className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
                >
                  <div className="h-full rounded-full bg-primario transition-[width] duration-150" style={{ width: `${progreso}%` }} />
                </div>
                <p className="mb-0 mt-1 text-xs text-suave">{t("perfil.foto.subiendo", { progreso })}</p>
              </div>
            )}

            <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:justify-center md:flex-col">
              <input
                ref={inputFoto}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={elegirArchivo}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => inputFoto.current?.click()}
                disabled={subiendo}
                className={`${botonPrimario} md:w-full`}
              >
                {t("perfil.foto.cambiar")}
              </button>
              {usuario.foto_url && (
                <button type="button" onClick={quitarFoto} disabled={subiendo} className={`${botonSecundario} md:w-full`}>
                  {t("perfil.foto.quitar")}
                </button>
              )}
            </div>
            <p className="mb-0 mt-3 text-xs text-suave">{t("perfil.foto.ayuda")}</p>
            <Aviso estado={estadoFoto} />
          </section>

          {/* Datos de la cuenta */}
          <section className={`${panel} md:col-span-2`} aria-labelledby="titulo-cuenta">
            <h2 id="titulo-cuenta" className="m-0 mb-4 text-base font-bold sm:text-lg">{t("perfil.cuenta.titulo")}</h2>

            <form onSubmit={guardarNombre} noValidate className="flex flex-col gap-4">
              <div>
                <label htmlFor="nombre" className={etiqueta}>{t("perfil.cuenta.nombre")}</label>
                <input
                  id="nombre"
                  type="text"
                  value={nombre}
                  maxLength={50}
                  autoComplete="nickname"
                  onChange={(e) => setNombre(e.target.value)}
                  aria-describedby="ayuda-nombre"
                  aria-invalid={estadoNombre?.tipo === "error"}
                  className={campo}
                />
                <div id="ayuda-nombre" className="mt-1 flex justify-between gap-2 text-xs text-suave">
                  <span>{t("perfil.cuenta.nombreAyuda")}</span>
                  <span>{nombre.length}/50</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="correo" className={etiqueta}>{t("perfil.cuenta.correo")}</label>
                  <input
                    id="correo"
                    type="email"
                    value={usuario.correo}
                    readOnly
                    aria-readonly="true"
                    aria-describedby="ayuda-correo"
                    className={`${campo} cursor-not-allowed opacity-70`}
                  />
                  <p id="ayuda-correo" className="mb-0 mt-1 text-xs text-suave">{t("perfil.cuenta.correoAyuda")}</p>
                </div>
                <div className="rounded-xl border border-solid border-borde p-3">
                  <span className="block text-xs uppercase tracking-wide text-suave">{t("perfil.cuenta.capital")}</span>
                  <span className="mt-1 block text-xl font-bold sm:text-2xl">{formatCurrency(usuario.saldo_ficticio)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button type="submit" disabled={!hayCambio || guardandoNombre} className={botonPrimario}>
                  {guardandoNombre ? t("perfil.cuenta.guardando") : t("perfil.cuenta.guardar")}
                </button>
              </div>
              <Aviso estado={estadoNombre} />
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}