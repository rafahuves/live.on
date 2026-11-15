"use client";

import { useEffect, useRef, useState } from "react";

// Simulador em versão compacta (public/simulacoes.html?mini=1) dentro da landing.
// O iframe avisa a própria altura por postMessage, para não ter barra de rolagem.
export default function SimEmbed() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(560);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== ref.current?.contentWindow) return;
      const h = (e.data as { liveonSimHeight?: number })?.liveonSimHeight;
      if (typeof h === "number" && h > 100) setHeight(h);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={ref}
      src="/simulacoes.html?mini=1#restaurante"
      title="Demonstração: câmeras simuladas com alertas da IA"
      loading="lazy"
      style={{ height }}
      className="block w-full border-0"
    />
  );
}
