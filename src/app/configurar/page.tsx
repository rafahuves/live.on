import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/supabase/server";
import { activeChannels, loadDvr } from "@/lib/dvr";
import { loadPerfil } from "@/lib/perfil";
import Wizard from "./Wizard";

export const metadata = { title: "O que analisar | Live.On" };

export default function ConfigurarPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader active="analises" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <Suspense fallback={<p className="text-muted">Carregando…</p>}>
          <Conteudo />
        </Suspense>
      </main>
    </div>
  );
}

async function Conteudo() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/configurar");
  const dvr = await loadDvr(user.id);
  if (!dvr) {
    return (
      <div className="max-w-lg rounded-2xl border border-line bg-soft p-6">
        <h1 className="font-semibold">Conecte o seu gravador primeiro</h1>
        <p className="mt-2 text-sm text-muted">Depois disso a gente escolhe, câmera por câmera, o que analisar.</p>
        <Link href="/cameras" className="mt-4 inline-block font-semibold text-brand hover:underline">
          Ir para Câmeras
        </Link>
      </div>
    );
  }
  return <Wizard canais={activeChannels(dvr)} inicial={await loadPerfil(user.id)} empresa={user.company ?? ""} />;
}
