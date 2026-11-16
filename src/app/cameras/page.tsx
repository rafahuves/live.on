import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/supabase/server";
import { detectActive, ensureStreams, go2rtcOnline, loadDvr, saveDvr } from "@/lib/dvr";
import { loadPerfil } from "@/lib/perfil";
import CameraGrid from "./CameraGrid";
import ConnectDvr from "./ConnectDvr";
import { disconnectDvr, rescanChannels } from "./actions";

export const metadata = { title: "Minhas câmeras | Live.On" };

export default function CamerasPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader active="cameras" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">Minhas câmeras</h1>
        <p className="mt-1 text-muted">Ao vivo, direto do seu gravador.</p>
        <div className="mt-8">
          <Suspense
            fallback={
              <p className="text-muted">
                Carregando… Na primeira vez o Live.On procura quais canais têm câmera, um de cada vez (uns 20 s).
              </p>
            }
          >
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

  let dvr = await loadDvr(user.id);
  if (!dvr) return <ConnectDvr />;

  // Primeira vez: descobre quais canais têm câmera (um por vez) e guarda.
  if (!dvr.active) {
    const active = await detectActive(dvr);
    if (active) {
      dvr = { ...dvr, active };
      await saveDvr(user.id, dvr);
    }
  }
  const empty = dvr.active ? Array.from({ length: dvr.channels }, (_, i) => i + 1).filter((c) => !dvr.active!.includes(c)) : [];

  const names = await ensureStreams(user.id, dvr);
  const perfilCams = (await loadPerfil(user.id))?.cameras ?? [];
  const nomesDasCameras = Object.fromEntries(
    perfilCams.filter((c) => c.nome && c.nome !== `Câmera ${c.ch}`).map((c) => [`cam${c.ch}`, c.nome]),
  );
  const perfil = await loadPerfil(user.id);
  return (
    <>
      {!perfil && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-soft p-4">
          <span className="text-sm">
            <b>Próximo passo:</b> escolha o que o Live.On deve analisar em cada câmera (2 minutos).
          </span>
          <Link href="/configurar" className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Configurar análises
          </Link>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>
          Gravador {dvr.host} · {names.length} câmeras · usuário {dvr.user}
          {empty.length > 0 && <> · canais sem câmera: {empty.join(", ")}</>}
        </span>
        <span className="flex gap-4">
          <form action={rescanChannels}>
            <button className="font-semibold text-brand hover:underline">Procurar câmeras de novo</button>
          </form>
          <form action={disconnectDvr}>
            <button className="font-semibold text-brand hover:underline">Trocar gravador</button>
          </form>
        </span>
      </div>
      <CameraGrid cams={names} nomes={nomesDasCameras} />
    </>
  );
}
