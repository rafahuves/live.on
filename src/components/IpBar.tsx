import { Suspense } from "react";
import { headers } from "next/headers";

// Faixa fixa no topo com o IP do visitante. Pedido do usuário: não pode sair da tela.
// O IP é lido no servidor (sem depender do JavaScript do navegador).
export default function IpBar() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex h-7 items-center overflow-hidden bg-brand px-4 font-mono text-xs whitespace-nowrap text-white"
    >
      IP do Usuário:{" "}
      <b className="ml-0.5 font-semibold">
        <Suspense fallback="carregando…">
          <IpValue />
        </Suspense>
      </b>
    </div>
  );
}

const LOCAL = ["::1", "127.0.0.1", "::ffff:127.0.0.1"];

async function IpValue() {
  const h = await headers();
  // Na Vercel o IP real vem em x-forwarded-for (primeiro da lista) ou x-real-ip.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "::1";
  if (!LOCAL.includes(ip)) return ip;

  // No localhost o servidor só vê "::1". O IP de internet deste computador é o mesmo do visitante.
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    const { ip: pub } = (await res.json()) as { ip: string };
    return `${pub} (local)`;
  } catch {
    return `${ip} (local)`;
  }
}
