"use client";

import { useEffect, useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { TIPO_LABEL, type Analise } from "@/lib/analises-tipos";

type Msg = Anthropic.Beta.BetaMessageParam;

const EXEMPLOS = [
  "Quero saber se alguém entra na loja depois das 22h",
  "Quantas pessoas passam pela porta da frente por dia?",
  "Me avise se a câmera do estoque ficar tampada",
];

// Só o texto visível de cada mensagem (o histórico completo, com ferramentas e thinking, fica guardado intacto).
function visibleText(m: Msg): string {
  if (typeof m.content === "string") return m.content;
  if (!m.content) return "";
  return m.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

function resumo(a: Analise) {
  const partes = [TIPO_LABEL[a.tipo]];
  partes.push(a.cameras.length ? a.cameras.map((c) => c.replace("cam", "Câmera ")).join(", ") : "Todas as câmeras");
  if (a.area) partes.push(a.area);
  if (a.horario_inicio && a.horario_fim) partes.push(`${a.horario_inicio}–${a.horario_fim}`);
  if (a.limite) partes.push(`mais de ${a.limite} por ${a.periodo ?? "dia"}`);
  return partes.join(" · ");
}

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/analises", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { analises?: Analise[] }) => setAnalises(d.analises ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy]);

  async function send(content: string) {
    const msg = content.trim();
    if (!msg || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setText("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { messages?: Msg[]; analises?: Analise[]; error?: string };
      if (!res.ok || !data.messages) throw new Error(data.error ?? "Erro desconhecido.");
      setMessages(data.messages);
      if (data.analises) setAnalises(data.analises);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar.");
      setMessages(messages); // volta ao histórico anterior; a mensagem fica na caixa para reenviar
      setText(msg);
    } finally {
      setBusy(false);
    }
  }

  async function remover(id: string) {
    const res = await fetch(`/api/analises?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = (await res.json()) as { analises?: Analise[] };
    if (data.analises) setAnalises(data.analises);
  }

  const visiveis = messages.map((m, i) => ({ i, role: m.role, text: visibleText(m) })).filter((m) => m.text);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex min-h-[480px] flex-col rounded-2xl border border-line bg-white">
        <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {visiveis.length === 0 && (
            <div className="text-sm text-muted">
              <p>Exemplos do que você pode pedir:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {EXEMPLOS.map((e) => (
                  <button
                    key={e}
                    onClick={() => send(e)}
                    className="rounded-full border border-line px-3 py-1.5 text-left hover:border-brand hover:text-brand"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
          {visiveis.map((m) => (
            <div key={m.i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-brand text-white" : "bg-soft"
                }`}
              >
                {m.text}
              </p>
            </div>
          ))}
          {busy && <p className="text-sm text-muted">A IA está pensando…</p>}
          <div ref={endRef} />
        </div>
        {error && (
          <p role="alert" className="mx-4 mb-2 rounded-xl bg-crit/10 px-4 py-2 text-sm text-crit">
            {error}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex gap-2 border-t border-line p-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex.: quero saber quantas vezes abrem a porta do estoque"
            aria-label="Mensagem para a IA"
            className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm outline-none focus:border-brand"
          />
          <button
            disabled={busy || !text.trim()}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </section>

      <aside className="rounded-2xl border border-line bg-white p-4">
        <h2 className="font-semibold">Análises salvas</h2>
        {analises.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenhuma ainda. Converse com a IA para criar a primeira.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {analises.map((a) => (
              <li key={a.id} className="rounded-xl border border-line p-3">
                <p className="text-sm font-semibold">{a.nome}</p>
                <p className="mt-1 text-xs text-muted">{resumo(a)}</p>
                <p className="mt-1 text-xs">Alerta: “{a.mensagem_alerta}”</p>
                <button onClick={() => remover(a.id)} className="mt-2 text-xs font-semibold text-crit hover:underline">
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">
          Fase de teste: as análises ficam salvas no seu computador. A detecção nas câmeras ainda vai ser ligada a elas.
        </p>
      </aside>
    </div>
  );
}
