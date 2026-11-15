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
        <Chat />
      </main>
    </div>
  );
}
