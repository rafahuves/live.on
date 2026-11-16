// O que a IA vê agora em cada câmera (publicado pelo detector em data/ao-vivo/<id>.json) e os avisos recentes
// (data/eventos/<id>.jsonl). Lido pelo dashboard a cada ~1 s. Só a dona da conta.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/supabase/server";

type Evento = { ts: string; cam: string; tipo: string; analise?: string; enviado?: boolean; pessoas?: number };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  const dir = path.join(process.cwd(), "data");

  let ao = { ts: 0, cams: {} as Record<string, unknown> };
  try {
    ao = JSON.parse(await readFile(path.join(dir, "ao-vivo", `${user.id}.json`), "utf8"));
  } catch {}
  const ligado = Date.now() / 1000 - ao.ts < 15; // detector rodando?

  let eventos: Evento[] = [];
  let hoje = { passagens: 0, alertas: 0 };
  try {
    const linhas = (await readFile(path.join(dir, "eventos", `${user.id}.jsonl`), "utf8")).trim().split("\n").slice(-2000);
    const dia = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const todos = linhas.flatMap((l) => {
      try {
        return [JSON.parse(l) as Evento];
      } catch {
        return [];
      }
    });
    for (const e of todos) {
      if (!e.ts.startsWith(dia)) continue;
      if (e.tipo === "passagem") hoje.passagens++;
      if (e.tipo === "alerta") hoje.alertas++;
    }
    // Alertas iguais no mesmo segundo (várias análises) viram um aviso só.
    const vistos = new Set<string>();
    eventos = todos
      .reverse()
      .filter((e) => {
        const k = `${e.ts}|${e.cam}|${e.tipo}`;
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      })
      .slice(0, 25);
  } catch {
    hoje = { passagens: 0, alertas: 0 };
  }

  return Response.json({ ligado, cams: ligado ? ao.cams : {}, eventos, hoje }, { headers: { "Cache-Control": "no-store" } });
}
