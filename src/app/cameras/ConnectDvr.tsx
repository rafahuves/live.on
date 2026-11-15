"use client";

import { useActionState, useState } from "react";
import { connectDvr, findDvrs } from "./actions";

const field = "mt-1 w-full rounded-xl border border-line px-4 py-2.5 outline-none focus:border-brand";

export default function ConnectDvr() {
  const [state, action, pending] = useActionState(connectDvr, null);
  const [host, setHost] = useState("");
  const [found, setFound] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function search() {
    setSearching(true);
    setFound(await findDvrs());
    setSearching(false);
  }

  return (
    <div className="max-w-lg rounded-2xl border border-line bg-white p-6">
      <h2 className="text-lg font-semibold">Conectar o seu gravador Intelbras</h2>
      <p className="mt-1 text-sm text-muted">
        Use o mesmo usuário e senha que você usa no app da Intelbras ou no próprio gravador. A senha fica guardada só
        neste computador, criptografada.
      </p>
      <form action={action} className="mt-5 space-y-4">
        <div>
          <label className="block">
            <span className="text-sm font-medium">Endereço do gravador na sua rede</span>
            <input
              name="host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.108"
              required
              className={field}
            />
          </label>
          <button type="button" onClick={search} disabled={searching} className="mt-2 text-sm font-semibold text-brand hover:underline">
            {searching ? "Procurando na rede…" : "Não sei o endereço: procurar na rede"}
          </button>
          {found && (
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {found.length === 0 && <span className="text-muted">Nada encontrado. Veja o endereço no menu de rede do gravador.</span>}
              {found.map((ip) => (
                <button key={ip} type="button" onClick={() => setHost(ip)} className="rounded-full border border-line px-3 py-1 hover:border-brand">
                  {ip}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Usuário Intelbras</span>
            <input name="user" autoComplete="off" defaultValue="admin" required className={field} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Senha Intelbras</span>
            <input name="pass" type="password" autoComplete="off" required className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Quantas câmeras</span>
            <input name="channels" type="number" min={1} max={64} defaultValue={4} className={field} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Porta RTSP</span>
            <input name="port" type="number" defaultValue={554} className={field} />
          </label>
        </div>
        {state?.error && (
          <p role="alert" className="rounded-xl bg-crit/10 px-4 py-3 text-sm text-crit">
            {state.error}
          </p>
        )}
        <button
          disabled={pending}
          className="w-full rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Testando a conexão…" : "Conectar câmeras"}
        </button>
        <p className="text-xs text-muted">Dica: crie no gravador um usuário só de visualização para a Live.On.</p>
      </form>
    </div>
  );
}
