"use client";

import { useEffect, useState } from "react";

// IA ao vivo no dashboard (como na simulação): etiquetas sobre o vídeo, resumo e avisos.
// Lê /api/ao-vivo a cada 1 s (só com a aba visível). Quem calcula é o detector (scripts/detector.py),
// que já está olhando as câmeras: o dashboard não abre nenhuma conexão a mais com o gravador.
export type Pessoa = { id: number; b: [number, number, number, number]; c: number; desde: number };
export type CamAoVivo = { n: number; pessoas: Pessoa[]; w: number; h: number; ts: number };
export type Evento = { ts: string; cam: string; tipo: string; analise?: string; enviado?: boolean; pessoas?: number };
export type AoVivo = { ligado: boolean; cams: Record<string, CamAoVivo>; eventos: Evento[]; hoje: { passagens: number; alertas: number } };

export function useAoVivo(): AoVivo | null {
  const [d, setD] = useState<AoVivo | null>(null);
  useEffect(() => {
    let parar = false;
    let t: ReturnType<typeof setTimeout>;
    const buscar = async () => {
      if (!document.hidden) {
        try {
          const r = await fetch("/api/ao-vivo", { cache: "no-store" });
          if (r.ok && !parar) setD((await r.json()) as AoVivo);
        } catch {}
      }
      if (!parar) t = setTimeout(buscar, 1000);
    };
    buscar();
    return () => {
      parar = true;
      clearTimeout(t);
    };
  }, []);
  return d;
}

const TILE = 16 / 9;

/** Quadrados da IA sobre o vídeo (a imagem usa object-contain: o desenho acompanha a área real dela). */
export function Etiquetas({ cam }: { cam?: CamAoVivo }) {
  if (!cam) return null;
  const r = cam.w / cam.h;
  const area =
    r <= TILE
      ? { height: "100%", width: `${(r / TILE) * 100}%`, left: `${((1 - r / TILE) / 2) * 100}%`, top: 0 }
      : { width: "100%", height: `${(TILE / r) * 100}%`, top: `${((1 - TILE / r) / 2) * 100}%`, left: 0 };
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute" style={area}>
        {cam.pessoas.map((p) => (
          <div
            key={p.id}
            className="ia-box absolute"
            style={{
              left: `${p.b[0] * 100}%`,
              top: `${p.b[1] * 100}%`,
              width: `${(p.b[2] - p.b[0]) * 100}%`,
              height: `${(p.b[3] - p.b[1]) * 100}%`,
            }}
          >
            <i className="tl" />
            <i className="tr" />
            <i className="bl" />
            <i className="br" />
            <span className="ia-tag">
              Pessoa {p.id} · {Math.round(p.c * 100)}%
            </span>
          </div>
        ))}
      </div>
      <span className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-1 font-mono text-[11px] text-white">
        IA · {cam.n} {cam.n === 1 ? "pessoa" : "pessoas"}
      </span>
    </div>
  );
}

export function Resumo({ d, total }: { d: AoVivo | null; total: number }) {
  const comIa = d ? Object.keys(d.cams).length : 0;
  const agora = d ? Object.values(d.cams).reduce((s, c) => s + c.n, 0) : 0;
  const itens: [string, string][] = [
    ["Câmeras com IA", `${comIa} de ${total}`],
    ["Pessoas agora", String(agora)],
    ["Passagens hoje", String(d?.hoje.passagens ?? 0)],
    ["Alertas hoje", String(d?.hoje.alertas ?? 0)],
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold md:col-span-1 col-span-2">
        <span className={`h-2.5 w-2.5 rounded-full ${d?.ligado ? "animate-pulse bg-emerald-500" : "bg-crit"}`} />
        {d == null ? "Conferindo a IA…" : d.ligado ? "IA ligada" : "IA desligada"}
      </div>
      {itens.map(([k, v]) => (
        <div key={k} className="rounded-2xl border border-line bg-white px-4 py-3">
          <div className="font-display text-2xl font-bold tracking-tight tabular-nums">{v}</div>
          <div className="text-xs text-muted">{k}</div>
        </div>
      ))}
    </div>
  );
}

export function Avisos({ d, nomes }: { d: AoVivo | null; nomes: Record<string, string> }) {
  const eventos = d?.eventos ?? [];
  return (
    <aside className="rounded-2xl border border-line bg-white p-4 xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Avisos ao vivo</h2>
        <span className="font-mono text-[11px] text-muted">Telegram</span>
      </div>
      {eventos.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhum aviso ainda. Quando a IA vir alguém, aparece aqui na hora.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {eventos.map((e) => {
            const alerta = e.tipo === "alerta";
            return (
              <li key={`${e.ts}${e.cam}${e.tipo}`} className="flex gap-3 rounded-xl bg-soft px-3 py-2.5 text-sm">
                <span className={`mt-0.5 w-1.5 shrink-0 rounded-full ${alerta ? "bg-crit" : "bg-emerald-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{alerta ? e.analise || "Alerta" : "Passagem de pessoa"}</div>
                  <div className="text-xs text-muted">
                    {nomes[e.cam] || e.cam.replace("cam", "Câmera ")}
                    {alerta ? (e.enviado ? " · enviado no Telegram" : " · não enviado") : ""}
                  </div>
                </div>
                <time className="shrink-0 font-mono text-xs text-muted">{e.ts.slice(11, 19)}</time>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
