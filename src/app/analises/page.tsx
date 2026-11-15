import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import Chat from "./Chat";

export const metadata = { title: "Análises | Live.On" };

export default function AnalisesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader active="analises" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">Análises personalizadas</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Conte para a IA o que você quer vigiar, do seu jeito. Ela faz as perguntas que faltarem e monta a análise.
        </p>
        <Link
          href="/configurar"
          className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-line p-4 hover:border-brand"
        >
          <span className="text-sm">
            <b>Configuração rápida:</b> escolher, câmera por câmera, o que analisar (com a foto de cada uma).
          </span>
          <span className="font-semibold text-brand">Abrir →</span>
        </Link>
        <Chat />
      </main>
    </div>
  );
}
