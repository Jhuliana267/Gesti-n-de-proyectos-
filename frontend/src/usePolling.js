import { useEffect, useRef } from "react";

// Ejecuta `fn` al montar y luego cada `ms` milisegundos. Siempre usa la versión más reciente de `fn`.
export function usePolling(fn, ms, deps = []) {
  const guardada = useRef(fn);
  guardada.current = fn;

  useEffect(() => {
    let vivo = true;
    const ejecutar = async () => {
      try {
        if (vivo) await guardada.current();
      } catch {
        /* errores de red transitorios: se reintenta en el próximo ciclo */
      }
    };
    ejecutar();
    const id = setInterval(ejecutar, ms);
    return () => {
      vivo = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}
