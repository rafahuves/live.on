// Conversas do chat de Análises, salvas por conta: data/conversas/<conta>/<id>.json (fora do Git).
// Guardam o histórico completo (com os blocos de raciocínio da IA), para continuar de onde parou.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { textoDe, type Msg } from "./assistente";

export type ResumoConversa = { id: string; titulo: string; atualizada: string };
type Conversa = ResumoConversa & { criada: string; messages: Msg[] };

const UUID = /^[0-9a-f-]{36}$/i;
function pasta(userId: string) {
  if (!UUID.test(userId)) throw new Error("id de usuário inválido");
  return path.join(process.cwd(), "data", "conversas", userId);
}
const arquivo = (userId: string, id: string) => {
  if (!UUID.test(id)) throw new Error("id de conversa inválido");
  return path.join(pasta(userId), `${id}.json`);
};

export async function listConversas(userId: string): Promise<ResumoConversa[]> {
  const nomes = await readdir(pasta(userId)).catch(() => [] as string[]);
  const out: ResumoConversa[] = [];
  for (const n of nomes) {
    if (!n.endsWith(".json")) continue;
    try {
      const c = JSON.parse(await readFile(path.join(pasta(userId), n), "utf8")) as Conversa;
      out.push({ id: c.id, titulo: c.titulo, atualizada: c.atualizada });
    } catch {}
  }
  return out.sort((a, b) => b.atualizada.localeCompare(a.atualizada));
}

export async function loadConversa(userId: string, id: string): Promise<Conversa | null> {
  try {
    return JSON.parse(await readFile(arquivo(userId, id), "utf8")) as Conversa;
  } catch {
    return null;
  }
}

/** Salva (ou cria) a conversa. Título = começo da primeira mensagem do cliente. Devolve o id. */
export async function saveConversa(userId: string, id: string | null, messages: Msg[]): Promise<string> {
  const agora = new Date().toISOString();
  const antiga = id ? await loadConversa(userId, id) : null;
  const novoId = antiga?.id ?? crypto.randomUUID();
  const primeira = textoDe(messages.find((m) => m.role === "user") ?? { role: "user", content: "" });
  const titulo = antiga?.titulo ?? (primeira.length > 48 ? primeira.slice(0, 46).trimEnd() + "…" : primeira || "Nova conversa");
  const c: Conversa = { id: novoId, titulo, criada: antiga?.criada ?? agora, atualizada: agora, messages };
  await mkdir(pasta(userId), { recursive: true });
  await writeFile(arquivo(userId, novoId), JSON.stringify(c));
  return novoId;
}

export async function deleteConversa(userId: string, id: string) {
  await rm(arquivo(userId, id), { force: true });
}
