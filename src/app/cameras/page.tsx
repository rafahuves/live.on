import { Suspense } from "react";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureStreams, go2rtcOnline, loadDvr } from "@/lib/dvr";
import CameraGrid from "./CameraGrid";
import ConnectDvr from "./ConnectDvr";
import { disconnectDvr } from "./actions";

export const metadata = { title: "Minhas câmeras | Live.On" };

export default function CamerasPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader active="cameras" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">Minhas câmeras</h1>
        <p className="mt-1 text-muted">Ao vivo, direto do seu gravador. Fase de teste: funciona no computador da mesma rede.</p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-muted">Carregando…</p>}>
            <Cameras />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function Cameras() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/cameras");

  if (!(await go2rtcOnline())) {
    return (
      <div className="max-w-lg rounded-2xl border border-line bg-soft p-6">
        <h2 className="font-semibold">O conversor de vídeo está desligado</h2>
        <p className="mt-2 text-sm text-muted">
          Num Terminal, na pasta do projeto, rode <code className="font-mono">npm run cameras</code>, deixe aberto e recarregue
          esta página.
        </p>
      </div>
    );
  }

  const dvr = await loadDvr(user.id);
  if (!dvr) return <ConnectDvr />;

  const names = await ensureStreams(user.id, dvr);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>
          Gravador {dvr.host} · {dvr.channels} câmeras · usuário {dvr.user}
        </span>
        <form action={disconnectDvr}>
          <button className="font-semibold text-brand hover:underline">Trocar gravador</button>
        </form>
      </div>
      <CameraGrid cams={names} />
    </>
  );
}
