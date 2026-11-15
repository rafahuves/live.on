"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp } from "./actions";

const field = "mt-1 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-brand";

export default function AuthForm({ mode }: { mode: "entrar" | "criar" }) {
  const [state, action, pending] = useActionState(mode === "entrar" ? signIn : signUp, null);
  const next = useSearchParams().get("next") ?? "/cameras";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {mode === "criar" && (
        <>
          <label className="block">
            <span className="text-sm font-medium">Nome</span>
            <input name="name" autoComplete="name" required className={field} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Empresa que trabalha</span>
            <input name="company" autoComplete="organization" required className={field} />
          </label>
        </>
      )}
      <label className="block">
        <span className="text-sm font-medium">E-mail</span>
        <input name="email" type="email" autoComplete="email" required className={field} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Senha</span>
        <input
          name="password"
          type="password"
          autoComplete={mode === "entrar" ? "current-password" : "new-password"}
          minLength={mode === "criar" ? 8 : undefined}
          required
          className={field}
        />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-crit/10 px-4 py-3 text-sm text-crit">
          {state.error}
        </p>
      )}
      {state?.info && <p className="rounded-xl bg-soft px-4 py-3 text-sm">{state.info}</p>}
      <button
        disabled={pending}
        className="w-full rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar conta"}
      </button>
    </form>
  );
}
