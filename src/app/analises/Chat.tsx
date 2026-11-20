"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { PRECISAO_DICA, PRECISAO_LABEL, PRECISOES, TIPO_LABEL, type Analise, type Precisao } from "@/lib/analises-tipos";

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

// Texto com links clicáveis (ex.: o link do robô do Telegram).
function ComLinks({ text }: { text: string }) {
  return text.split(/(https?:\/\/\S+)/g).map((parte, i) =>
    /^https?:\/\//.test(parte) ? (
      <a key={i} href={parte} target="_blank" rel="noreferrer" className="font-semibold underline break-all">
        {parte}
      </a>
    ) : (
      parte
    ),
  );
}

type Tg = { configurado: boolean; nomeRobo?: string; url?: string; conectado?: boolean; nome?: string | null };

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
  // Depois de salvar a configuração (?configurado=1): aviso do chat com o link do robô do Telegram.
  const configurado = useSearchParams().get("configurado") === "1";
  const [tg, setTg] = useState<Tg | null>(null);
  useEffect(() => {
    if (!configurado) return;
    fetch("/api/telegram", { cache: "no-store" })
      .then((r) => r.json())
      .then(setTg)
      .catch(() => {});
  }, [configurado]);
  const aviso = !configurado
    ? null
    : !tg
      ? "Configuração salva! Conferindo o seu Telegram…"
      : !tg.configurado
        ? "Configuração salva! As análises já estão na lista ao lado. (O robô do Telegram ainda não foi configurado neste computador.)"
        : tg.conectado
          ? `Configuração salva! Os alertas vão chegar no Telegram, na conversa com o robô "${tg.nomeRobo}", com a foto da câmera.`
          : `Configuração salva! Agora ligue o Telegram para receber os alertas com foto. Abra o robô "${tg.nomeRobo}" por este link e toque em "Começar":\n${tg.url}`;

  useEffect(() => {
    fetch("/api/analises", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { analises?: Analise[] }) => setAnalises(d.analises ?? []))
      .catch(() => {});
  }, []);

  // Rola só a lista de mensagens (dentro da caixa), nunca a página: o chat fica parado no lugar.
  useEffect(() => {
    const el = endRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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

  async function mudar(id: string, campos: { precisao?: Precisao; objetivo?: string; ativa?: boolean }) {
    const res = await fetch("/api/analises", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...campos }),
    });
    const data = (await res.json()) as { analises?: Analise[]; error?: string };
    if (data.analises) setAnalises(data.analises);
    else setError(data.error ?? "Não deu certo.");
  }

  async function remover(id: string) {
    const res = await fetch(`/api/analises?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = (await res.json()) as { analises?: Analise[] };
    if (data.analises) setAnalises(data.analises);
  }

  const visiveis = messages.map((m, i) => ({ i, role: m.role, text: visibleText(m) })).filter((m) => m.text);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex h-[min(640px,70vh)] min-h-[420px] flex-col rounded-2xl border border-line bg-white">
        <div ref={endRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">
          {aviso && (
            <div className="flex justify-start">
              <p className="max-w-[85%] rounded-2xl bg-soft px-4 py-2.5 text-sm whitespace-pre-wrap">
                <ComLinks text={aviso} />
              </p>
            </div>
          )}
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
                <ComLinks text={m.text} />
              </p>
            </div>
          ))}
          {busy && <p className="text-sm text-muted">A IA está pensando…</p>}
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
              <li key={a.id} className={`rounded-xl border border-line p-3 ${a.ativa ? "" : "opacity-60"}`}>
                <p className="text-sm font-semibold">{a.nome}</p>
                <p className="mt-1 text-xs text-muted">{resumo(a)}</p>
                <p className="mt-1 text-xs">Alerta: “{a.mensagem_alerta}”</p>
                <Objetivo valor={a.objetivo ?? ""} onSalvar={(objetivo) => mudar(a.id, { objetivo })} />
                <div className="mt-2" role="group" aria-label="Precisão">
                  <span className="text-[11px] font-semibold text-muted">Precisão</span>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {PRECISOES.map((p) => {
                      const on = (a.precisao ?? "equilibrada") === p;
                      return (
                        <button
                          key={p}
                          title={PRECISAO_DICA[p]}
                          aria-pressed={on}
                          onClick={() => !on && mudar(a.id, { precisao: p })}
                          className={`rounded-full border px-2 py-1.5 text-center text-xs font-semibold ${on ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}
                        >
                          {PRECISAO_LABEL[p]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{PRECISAO_DICA[a.precisao ?? "equilibrada"]}</p>
                </div>
                <div className="mt-2 flex gap-4">
                  <button onClick={() => mudar(a.id, { ativa: !a.ativa })} className="text-xs font-semibold text-brand hover:underline">
                    {a.ativa ? "Desligar" : "Ligar"}
                  </button>
                  <button onClick={() => remover(a.id)} className="text-xs font-semibold text-crit hover:underline">
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">
          Fase de teste: as análises ficam salvas no seu computador, e o detector segue a precisão de cada uma.
        </p>
      </aside>
    </div>
  );
}

// Objetivo da análise: o que o cliente quer saber, com as palavras dele. Edita no lugar.
function Objetivo({ valor, onSalvar }: { valor: string; onSalvar: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  if (!editando) {
    return (
      <p className="mt-1 text-xs">
        <span className="font-semibold">Objetivo:</span> {valor ? `“${valor}”` : <span className="text-muted">não definido</span>}{" "}
        <button
          onClick={() => {
            setTexto(valor);
            setEditando(true);
          }}
          className="font-semibold text-brand hover:underline"
        >
          {valor ? "editar" : "definir"}
        </button>
      </p>
    );
  }
  return (
    <form
      className="mt-1 flex gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar(texto);
        setEditando(false);
      }}
    >
      <input
        value={texto}
        maxLength={300}
        autoFocus
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ex.: saber se alguém mexe nos pallets à noite"
        aria-label="Objetivo da análise"
        className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-brand"
      />
      <button className="rounded-lg bg-brand px-2 text-xs font-semibold text-white">Salvar</button>
    </form>
  );
}
