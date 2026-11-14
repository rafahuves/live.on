import type { Metadata } from "next";
import Link from "next/link";
import CameraMonitor from "@/components/CameraMonitor";

export const metadata: Metadata = { title: "Monitor | live.on" };

export default function CameraPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Monitor de câmera</h1>
        <Link href="/" className="text-sm underline">
          Início
        </Link>
      </header>
      <p className="text-sm text-zinc-500">
        A análise acontece no seu navegador. O vídeo não é enviado para nenhum servidor.
      </p>
      <CameraMonitor />
    </main>
  );
}
