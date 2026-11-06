import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El proxy reenvía /api al backend (FastAPI en el puerto 8000): no hay problemas de CORS en desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
