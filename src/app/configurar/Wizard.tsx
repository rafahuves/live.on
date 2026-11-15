"use client";

import { useState, useTransition } from "react";
import { DIAS } from "@/lib/analises-tipos";
import { LOCAIS, MOSTRA, sugestoes, type Local, type Mostra, type Perfil, type PerfilCamera } from "@/lib/perfil-tipos";
import { salvarConfiguracao } from "./actions";

const DIA_LABEL: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };
const input = "mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-brand";

function padrao(canais: number[]): Perfil {
  return {
    local: "comercio",
    cameras: canais.map((ch) => ({ ch, nome: `Câmera ${ch}`, mostra: "outro", tipos: sugestoes("outro", "comercio").map((s) => s.tipo) })),
    inicio: "08:00",
    fim: "18:00",
    dias: ["seg", "ter", "qua", "qui", "sex", "sab"],
    contato_nome: "",
    contato_whatsapp: "",
  };
}

export default function Wizard({ canais, inicial }: { canais: number[]; inicial: Perfil | null }) {
  const [passo, setPasso] = useState(inicial ? 2 : 1);
  const [p, setP] = useState<Perfil>(() => {
    if (!inicial) return padrao(canais);
    // Mantém o que já foi salvo e acrescenta câmeras novas.
    const base = padrao(canais);
    return { ...inicial, cameras: base.cameras.map((c) => inicial.cameras.find((x) => x.ch === c.ch) ?? c) };
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, start] = useTransition();
  // Fotos carregam uma de cada vez (cuidado com o gravador): só mostra a foto i depois que a anterior terminou.
  const [fotos, setFotos] = useState(1);

  function escolherLocal(local: Local) {
    const casa = local === "residencia";
    setP((x) => ({
      ...x,
      local,
      ...(x.local !== local && (casa || x.local === "residencia")
        ? casa
          ? { inicio: "23:00", fim: "06:00", dias: [...DIAS] }
          : { inicio: "08:00", fim: "18:00", dias: ["seg", "ter", "qua", "qui", "sex", "sab"] }
        : {}),
      cameras: x.cameras.map((c) => ({ ...c, tipos: sugestoes(c.mostra, local).map((s) => s.tipo) })),
    }));
    setPasso(2);
  }

  const setCam = (ch: number, patch: Partial<PerfilCamera>) =>
    setP((x) => ({ ...x, cameras: x.cameras.map((c) => (c.ch === ch ? { ...c, ...patch } : c)) }));

  function setMostra(ch: number, mostra: Mostra) {
    setCam(ch, { mostra, tipos: sugestoes(mostra, p.local).map((s) => s.tipo) });
  }

  function toggleTipo(c: PerfilCamera, tipo: PerfilCamera["tipos"][number]) {
    setCam(c.ch, { tipos: c.tipos.includes(tipo) ? c.tipos.filter((t) => t !== tipo) : [...c.tipos, tipo] });
  }

  const casa = p.local === "residencia";
  const total = p.cameras.reduce((n, c) => n + c.tipos.length, 0);

  return (
    <div>
      <ol className="mb-8 flex gap-2 text-sm">
        {["Tipo de lugar", "Câmeras", "Horário e alertas"].map((t, i) => (
          <li key={t}>
            <button
              onClick={() => setPasso(i + 1)}
              className={`rounded-full px-3 py-1.5 font-semibold ${passo === i + 1 ? "bg-brand text-white" : "bg-soft text-muted"}`}
            >
              {i + 1}. {t}
            </button>
          </li>
        ))}
      </ol>

      {passo === 1 && (
        <section>
          <h1 className="font-display text-3xl font-bold tracking-tight">Que tipo de lugar é?</h1>
          <p className="mt-1 text-muted">Assim o Live.On já sugere o que vale a pena analisar.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LOCAIS.map((l) => (
              <button
                key={l.id}
                onClick={() => escolherLocal(l.id)}
                className={`rounded-2xl border p-5 text-left hover:border-brand ${p.local === l.id ? "border-brand bg-soft" : "border-line"}`}
              >
                <span className="block font-semibold">{l.label}</span>
                <span className="text-sm text-muted">{l.desc}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {passo === 2 && (
        <section>
          <h1 className="font-display text-3xl font-bold tracking-tight">O que cada câmera mostra?</h1>
          <p className="mt-1 text-muted">Dê um nome e escolha o que aparece na imagem. As análises sugeridas já vêm marcadas.</p>
          <div className="mt-6 space-y-4">
            {p.cameras.map((c, i) => (
              <article key={c.ch} className="grid gap-4 rounded-2xl border border-line p-4 md:grid-cols-[240px_1fr]">
                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black text-xs text-white/50">
                  {i < fotos ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/cam/foto?ch=${c.ch}`}
                      alt={c.nome}
                      className="h-full w-full object-cover"
                      onLoad={() => setFotos((f) => Math.max(f, i + 2))}
                      onError={() => setFotos((f) => Math.max(f, i + 2))}
                    />
                  ) : (
                    "Carregando foto…"
                  )}
                </div>
                <div>
                  <label className="block">
                    <span className="text-xs font-semibold text-muted">Nome da câmera {c.ch}</span>
                    <input value={c.nome} maxLength={40} onChange={(e) => setCam(c.ch, { nome: e.target.value })} className={input} />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {MOSTRA.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMostra(c.ch, m.id)}
                        className={`rounded-full border px-3 py-1 text-sm ${c.mostra === m.id ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {sugestoes(c.mostra, p.local).map((s) => (
                      <li key={s.tipo}>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={c.tipos.includes(s.tipo)} onChange={() => toggleTipo(c, s.tipo)} className="h-4 w-4 accent-[#7C3AED]" />
                          {s.texto}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setPasso(3)} className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark">
              Continuar
            </button>
          </div>
        </section>
      )}

      {passo === 3 && (
        <section>
          <h1 className="font-display text-3xl font-bold tracking-tight">Horário e quem recebe os alertas</h1>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-line p-5">
              <h2 className="font-semibold">{casa ? "Quando ninguém deve circular?" : "Horário de funcionamento"}</h2>
              <p className="mt-1 text-sm text-muted">
                {casa ? "Pessoa vista nesse período gera alerta." : "Pessoa vista fora desse horário gera alerta."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label>
                  <span className="text-xs font-semibold text-muted">{casa ? "Das" : "Abre"}</span>
                  <input type="time" value={p.inicio} onChange={(e) => setP({ ...p, inicio: e.target.value })} className={input} />
                </label>
                <label>
                  <span className="text-xs font-semibold text-muted">{casa ? "Até" : "Fecha"}</span>
                  <input type="time" value={p.fim} onChange={(e) => setP({ ...p, fim: e.target.value })} className={input} />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DIAS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setP({ ...p, dias: p.dias.includes(d) ? p.dias.filter((x) => x !== d) : [...p.dias, d] })}
                    className={`rounded-full border px-3 py-1 text-sm ${p.dias.includes(d) ? "border-brand bg-brand text-white" : "border-line"}`}
                  >
                    {DIA_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-line p-5">
              <h2 className="font-semibold">Quem recebe os alertas</h2>
              <label className="mt-3 block">
                <span className="text-xs font-semibold text-muted">Nome</span>
                <input value={p.contato_nome} onChange={(e) => setP({ ...p, contato_nome: e.target.value })} className={input} />
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-semibold text-muted">WhatsApp (com DDD)</span>
                <input
                  value={p.contato_whatsapp}
                  inputMode="tel"
                  placeholder="(47) 99999-9999"
                  onChange={(e) => setP({ ...p, contato_whatsapp: e.target.value })}
                  className={input}
                />
              </label>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-soft p-5 text-sm">
            <b>Resumo:</b> {LOCAIS.find((l) => l.id === p.local)?.label} · {p.cameras.filter((c) => c.tipos.length).length} câmeras ·{" "}
            {total} análises ativas. Sem reconhecimento facial: o Live.On vê pessoas, não identifica quem é. Lembre de manter o aviso de
            &quot;ambiente monitorado&quot; no local.
          </div>
          {erro && <p className="mt-4 rounded-xl bg-crit/10 px-4 py-3 text-sm text-crit">{erro}</p>}
          <div className="mt-6 flex justify-end">
            <button
              disabled={salvando}
              onClick={() =>
                start(async () => {
                  setErro(null);
                  const r = await salvarConfiguracao(p);
                  if (r?.error) setErro(r.error);
                })
              }
              className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar e ativar análises"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
