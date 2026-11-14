import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">live.on</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Monitoramento por câmera direto no navegador. Avisa na hora quando aparece algo que não deveria.
      </p>
      <Link
        href="/camera"
        className="rounded-lg bg-black px-6 py-3 font-medium text-white dark:bg-white dark:text-black"
      >
        Abrir monitor
      </Link>
    </main>
  );
}
