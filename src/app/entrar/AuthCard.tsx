import { Suspense } from "react";
import Link from "next/link";
import AuthForm from "./AuthForm";
import SocialButtons from "./SocialButtons";
import { supabaseConfigured } from "@/lib/supabase/server";

export default function AuthCard({ mode }: { mode: "entrar" | "criar" }) {
  const entrar = mode === "entrar";
  return (
    <main className="flex flex-1 items-center justify-center bg-soft px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-8">
        <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm font-extrabold text-white">
            L
          </span>
          Live.On
        </Link>
        <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">{entrar ? "Entrar" : "Criar conta"}</h1>
        <p className="mt-1 text-sm text-muted">
          {entrar ? "Acesse as suas câmeras." : "Teste grátis. Depois você conecta o seu gravador Intelbras."}
        </p>
        {!supabaseConfigured() && (
          <p role="alert" className="mt-6 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">
            As contas ainda não estão ativadas: falta configurar o Supabase no arquivo .env.local.
          </p>
        )}
        <Suspense>
          <div className="mt-6">
            <SocialButtons />
          </div>
          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            ou com e-mail
            <span className="h-px flex-1 bg-line" />
          </div>
          <AuthForm mode={mode} />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted">
          {entrar ? (
            <>
              Ainda não tem conta?{" "}
              <Link href="/criar-conta" className="font-semibold text-brand hover:underline">
                Criar conta
              </Link>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <Link href="/entrar" className="font-semibold text-brand hover:underline">
                Entrar
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
