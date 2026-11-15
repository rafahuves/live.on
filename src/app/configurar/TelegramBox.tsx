"use client";

import { useEffect, useState } from "react";

type Status = { configurado: boolean; bot?: string; url?: string; conectado?: boolean; nome?: string | null; erro?: string };

// Alertas pelo Telegram (fase de testes): conectar a conta e mandar um alerta de teste com a foto da câmera.
export default function TelegramBox({ ch }: { ch?: number }) {
  const [s, setS] = useState<Status | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/telegram", { cache: "no-store" })
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ configurado: false }));
  }, []);

  async function acao(acao: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, ch }),
      });
      const d = (await r.json()) as { error?: string; conectado?: boolean; nome?: string; enviado?: boolean; comFoto?: boolean };
      if (!r.ok) return setMsg(d.error ?? "Não deu certo.");
      if (acao === "teste") setMsg(d.comFoto ? "Enviado! Olhe o seu Telegram (com a foto da câmera)." : "Enviado, mas sem foto (o gravador não deu imagem agora).");
      else setS((x) => (x ? { ...x, conectado: !!d.conectado, nome: d.nome ?? null } : x));
    } catch {
      setMsg("Não deu certo. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const btn = "rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60";
  return (
    <div className="mt-4 rounded-xl border border-line p-4">
      <h3 className="text-sm font-semibold">Alertas no Telegram (teste) · com foto da câmera</h3>
      {!s ? (
        <p className="mt-2 text-sm text-muted">Carregando…</p>
      ) : !s.configurado ? (
        <p className="mt-2 text-sm text-muted">O bot do Telegram ainda não foi configurado neste computador (TELEGRAM_BOT_TOKEN).</p>
      ) : s.erro ? (
        <p className="mt-2 text-sm text-crit">{s.erro}</p>
      ) : s.conectado ? (
        <div className="mt-2 text-sm">
          <p>✅ Conectado{s.nome ? ` (${s.nome})` : ""}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => acao("teste")} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>
              {busy ? "Enviando…" : "Enviar alerta de teste"}
            </button>
            <button disabled={busy} onClick={() => acao("desconectar")} className={`${btn} border border-line`}>
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>Toque em &quot;Abrir o Telegram&quot; e depois em <b>Começar</b> (ou Start) no bot.</li>
            <li>Volte aqui e toque em &quot;Já toquei em Começar&quot;.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={s.url} target="_blank" rel="noreferrer" className={`${btn} bg-[#229ED9] text-white`}>
              Abrir o Telegram
            </a>
            <button disabled={busy} onClick={() => acao("verificar")} className={`${btn} border border-line`}>
              {busy ? "Verificando…" : "Já toquei em Começar"}
            </button>
          </div>
        </div>
      )}
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  );
}
