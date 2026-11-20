// Relatórios a partir dos eventos do detector (data/eventos/<id>.jsonl): passagens por alvo e câmera, alertas.
// Usado pela ferramenta "relatorio" (chat e Telegram) e pelo relatório diário automático no Telegram.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ALVO_LABEL, listAnalises, type Alvo } from "./analises";
import { loadPerfil } from "./perfil";

type Evento = { ts: string; cam: string; tipo: string; alvo?: string; analise?: string; analise_id?: string; descricao?: string };
export type Periodo = "hoje" | "ontem" | "7dias";

const EMOJI: Partial<Record<Alvo, string>> = {
  pessoa: "👤",
  pessoa_com_cachorro: "🐕",
  cachorro: "🐶",
  gato: "🐈",
  carro: "🚗",
  moto: "🏍️",
  bicicleta: "🚲",
  caminhao: "🚚",
};

const dia = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD

async function eventos(userId: string): Promise<Evento[]> {
  try {
    const txt = await readFile(path.join(process.cwd(), "data", "eventos", `${userId}.jsonl`), "utf8");
    return txt
      .trim()
      .split("\n")
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as Evento];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

/** Texto do relatório. camera = "cam5" ou null (todas); alvo = "pessoa_com_cachorro" etc. ou null (todos). */
export async function montarRelatorio(userId: string, periodo: Periodo, camera: string | null = null, alvo: string | null = null) {
  const todos = await eventos(userId);
  const hoje = new Date();
  const alvoDia = periodo === "ontem" ? dia(new Date(hoje.getTime() - 86_400_000)) : dia(hoje);
  const desde = dia(new Date(hoje.getTime() - 7 * 86_400_000));
  const noPeriodo = (ts: string) => (periodo === "7dias" ? ts.slice(0, 10) >= desde : ts.slice(0, 10) === alvoDia);

  const perfil = await loadPerfil(userId);
  const nomeCam = (c: string) => perfil?.cameras.find((x) => `cam${x.ch}` === c)?.nome || c.replace("cam", "Câmera ");

  // passagens[alvo][cam] = { n, horas }
  const passagens: Record<string, Record<string, { n: number; horas: Record<string, number> }>> = {};
  // contagens confirmadas de cada análise: porAnalise[id] = { n, horas, ultima descrição }
  const porAnalise: Record<string, { n: number; horas: Record<string, number>; desc: string }> = {};
  let descartados = 0;
  let alertas = 0;
  let primeiro = "";
  for (const e of todos) {
    primeiro ||= e.ts;
    if (!noPeriodo(e.ts) || (camera && e.cam !== camera)) continue;
    if (e.tipo === "alerta") {
      alertas++;
      continue;
    }
    if (e.tipo === "descartado_ia") {
      descartados++;
      continue;
    }
    if (e.tipo === "contagem" && e.analise_id) {
      const c = (porAnalise[e.analise_id] ??= { n: 0, horas: {}, desc: "" });
      c.n++;
      const h = e.ts.slice(11, 13) + "h";
      c.horas[h] = (c.horas[h] ?? 0) + 1;
      if (e.descricao) c.desc = e.descricao;
      continue;
    }
    if (e.tipo !== "passagem") continue;
    const a = e.alvo || "pessoa";
    if (alvo && a !== alvo) continue;
    const c = ((passagens[a] ??= {})[e.cam] ??= { n: 0, horas: {} });
    c.n++;
    const h = e.ts.slice(11, 13) + "h";
    c.horas[h] = (c.horas[h] ?? 0) + 1;
  }

  const titulo = periodo === "hoje" ? "hoje" : periodo === "ontem" ? "ontem" : "dos últimos 7 dias";
  const linhas: string[] = [`📊 Relatório ${titulo}`];

  // 1) As análises de contagem do cliente (o que ele pediu), com o número confirmado.
  const minhas = (await listAnalises(userId)).filter((x) => x.ativa && x.tipo === "passagens_por_area" && (!camera || !x.cameras.length || x.cameras.includes(camera)));
  if (minhas.length) {
    linhas.push("", "📌 Suas contagens");
    for (const x of minhas) {
      const c = porAnalise[x.id];
      const pico = c ? Object.entries(c.horas).sort((a, b) => b[1] - a[1])[0] : undefined;
      const onde = x.cameras.length ? ` · ${x.cameras.map(nomeCam).join(", ")}` : "";
      const conf = x.precisao === "maxima" ? " (cada uma conferida pela IA de visão)" : "";
      linhas.push(`• ${x.nome}${onde}: ${c?.n ?? 0}${pico && (c?.n ?? 0) > 1 ? ` · mais às ${pico[0]}` : ""}${conf}`);
      if (c?.desc) linhas.push(`   última: ${c.desc}`);
    }
  }
  linhas.push("", "🎥 Movimento nas câmeras");
  // alvos especiais primeiro (cachorro, veículos), depois pessoas
  const ordem = Object.keys(passagens).sort((a, b) => (a === "pessoa" ? 1 : b === "pessoa" ? -1 : a.localeCompare(b)));
  for (const a of ordem) {
    const porCam = Object.entries(passagens[a]).sort((x, y) => y[1].n - x[1].n);
    const total = porCam.reduce((s, [, v]) => s + v.n, 0);
    linhas.push("");
    linhas.push(`${EMOJI[a as Alvo] ?? "•"} ${ALVO_LABEL[a as Alvo] ?? a}: ${total} passage${total === 1 ? "m" : "ns"}`);
    for (const [c, v] of porCam.slice(0, 6)) {
      const pico = Object.entries(v.horas).sort((x, y) => y[1] - x[1])[0];
      linhas.push(`   ${nomeCam(c)}: ${v.n}${pico && v.n > 1 ? ` (mais às ${pico[0]})` : ""}`);
    }
  }
  if (!ordem.length) linhas.push("", "Nenhuma passagem registrada neste período.");
  linhas.push("", `🔔 Alertas enviados: ${alertas}`);
  if (descartados) linhas.push(`🛡️ Casos que a IA de visão conferiu e descartou (não eram o pedido): ${descartados}`);

  if (primeiro) linhas.push("", `Contando desde ${primeiro.slice(8, 10)}/${primeiro.slice(5, 7)} às ${primeiro.slice(11, 16)}.`);
  linhas.push("Passagem = o alvo aparece na câmera depois de a imagem ficar sem ele por alguns segundos.");
  return linhas.join("\n");
}
