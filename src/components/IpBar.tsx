"use client";

import { useEffect, useState } from "react";

// Faixa fixa no topo com o IP do visitante. Pedido do usuário: não pode sair da tela.
export default function IpBar() {
  const [ip, setIp] = useState("carregando…");

  useEffect(() => {
    fetch("/api/ip", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ip: string; local: boolean }) => setIp(d.ip + (d.local ? " (local)" : "")))
      .catch(() => setIp("indisponível"));
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex h-7 items-center overflow-hidden bg-brand px-4 font-mono text-xs whitespace-nowrap text-white"
    >
      IP do Usuário: <b className="ml-0.5 font-semibold">{ip}</b>
    </div>
  );
}
