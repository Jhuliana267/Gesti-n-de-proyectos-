/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class", // el modo oscuro se activa con <html class="dark">
  corePlugins: { preflight: false }, // no pisa los estilos existentes de styles.css
  theme: {
    extend: {
      // Mismos colores que styles.css: así Tailwind y el CSS actual comparten una sola paleta.
      colors: {
        
        fondo: "var(--bg)",
        tarjeta: "var(--card)",
        texto: "var(--texto)",
        suave: "var(--suave)",
        borde: "var(--borde)",
        primario: "var(--primario)",
      },
            keyframes: {
        barra: { from: { transform: "scaleX(1)" }, to: { transform: "scaleX(0)" } },
        entrar: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        barra: "barra 6000ms linear forwards",
        entrar: "entrar 0.25s ease-out",
      },
    },
  },
  plugins: [],
};