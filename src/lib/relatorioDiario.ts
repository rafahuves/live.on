// Relatório diário automático no Telegram. Por conta: data/relatorio/<id>.json = { hora: "20:00" | null, ultimo }.
// Padrão: todo dia às 20:00 para quem ligou o Telegram. O cliente muda pelo robô ("manda o relatório às 7h").
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { montarRelatorio } from "./relatorios";
import { loadLink, sendText, telegramConfigured } from "./telegram";

export type ConfigRelatorio = { hora: string | null; ultimo?: string };
const PADRAO = "20:00";
const arquivo = (uid: string) => path.join(process.cwd(), "data", "relatorio", `${uid}.json`);

export async function lerConfigRelatorio(uid: string): Promise<ConfigRelatorio> {
  try {
    return JSON.parse(await readFile(arquivo(uid), "utf8")) as ConfigRelatorio;
  } catch {
    return { hora: PADRAO };
  }
}

export async function salvarConfigRelatorio(uid: string, cfg: ConfigRelatorio) {
  await mkdir(path.dirname(arquivo(uid)), { recursive: true });
  await writeFile(arquivo(uid), JSON.stringify(cfg, null, 2));
}

const agoraSP = () => {
  const d = new Date();
  return {
    dia: d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
    hora: d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }),
  };
};

async function rodada() {
  if (!telegramConfigured()) return;
  const dir = path.join(process.cwd(), "data", "telegram");
  const arquivos = await readdir(dir).catch(() => [] as string[]);
  const { dia, hora } = agoraSP();
  for (const f of arquivos) {
    const m = /^([0-9a-f-]{36})\.json$/i.exec(f);
    if (!m) continue;
    const uid = m[1];
    const cfg = await lerConfigRelatorio(uid);
    if (!cfg.hora || hora < cfg.hora || cfg.ultimo === dia) continue;
    const link = await loadLink(uid);
    if (!link) continue;
    try {
      await sendText(link.chat_id, `${await montarRelatorio(uid, "hoje")}\n\n(Relatório automático das ${cfg.hora}. Para mudar o horário, é só me pedir.)`);
      await salvarConfigRelatorio(uid, { ...cfg, ultimo: dia });
      console.log(`[relatório diário] enviado para ${uid.slice(0, 8)}…`);
    } catch (e) {
      console.warn("[relatório diário] não enviado:", e instanceof Error ? e.message : e);
    }
  }
}

const g = globalThis as unknown as { __liveonRelatorio?: boolean };
export function iniciarRelatorioDiario() {
  if (g.__liveonRelatorio) return;
  g.__liveonRelatorio = true;
  setInterval(() => void rodada().catch(() => {}), 60_000);
}
