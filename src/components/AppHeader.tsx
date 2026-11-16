import Link from "next/link";
import { logout } from "@/app/entrar/actions";

// Cabeçalho da área logada.
export default function AppHeader({ active }: { active: "cameras" | "analises" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${on ? "bg-soft text-brand" : "text-muted hover:text-brand"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="app-header sticky top-7 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm font-extrabold text-white">
              L
            </span>
            <span className="hidden sm:inline">Live.On</span>
          </Link>
          <nav className="flex gap-1">
            {tab("/cameras", "Câmeras", active === "cameras")}
            {tab("/analises", "Análises", active === "analises")}
          </nav>
        </div>
        <form action={logout}>
          <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
