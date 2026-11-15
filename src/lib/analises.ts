// Análises personalizadas criadas pelo chat. Fase de teste: um arquivo local por conta (data/analises/<id>.json, fora do Git).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DIAS, TIPOS, type Analise, type AnaliseInput } from "./analises-tipos";

export * from "./analises-tipos";

function fileFor(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("id de usuário inválido");
  return path.join(process.cwd(), "data", "analises", `${userId}.json`);
}

export async function listAnalises(userId: string): Promise<Analise[]> {
  try {
    return JSON.parse(await readFile(fileFor(userId), "utf8")) as Analise[];
  } catch {
    return [];
  }
}

async function saveAll(userId: string, list: Analise[]) {
  const file = fileFor(userId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(list, null, 2));
}

export async function addAnalise(userId: string, input: AnaliseInput): Promise<Analise> {
  const list = await listAnalises(userId);
  const nova: Analise = { ...input, id: crypto.randomUUID(), criada_em: new Date().toISOString(), ativa: true };
  await saveAll(userId, [...list, nova]);
  return nova;
}

// Troca as análises criadas pela configuração inicial (mantém as que o cliente fez no chat).
export async function replaceConfigAnalises(userId: string, inputs: AnaliseInput[]) {
  const keep = (await listAnalises(userId)).filter((a) => a.origem !== "configuracao");
  const criadas = new Date().toISOString();
  const novas: Analise[] = inputs.map((i) => ({ ...i, id: crypto.randomUUID(), criada_em: criadas, ativa: true, origem: "configuracao" }));
  await saveAll(userId, [...keep, ...novas]);
}

/** Edita uma análise (os campos que vierem). Devolve a análise nova, ou um texto de erro. */
export async function updateAnalise(userId: string, id: string, patch: Partial<AnaliseInput> & { ativa?: boolean }): Promise<Analise | string> {
  const list = await listAnalises(userId);
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return "análise não encontrada";
  const { ativa, ...campos } = patch;
  const junta = { ...list[i], ...campos };
  const valido = validarAnalise(junta);
  if (typeof valido === "string") return valido;
  list[i] = { ...list[i], ...valido, ...(ativa === undefined ? {} : { ativa }) };
  await saveAll(userId, list);
  return list[i];
}

/** Apaga várias análises de uma vez. Devolve quantas apagou. */
export async function removeAnalises(userId: string, ids: string[]): Promise<number> {
  const list = await listAnalises(userId);
  const next = list.filter((a) => !ids.includes(a.id));
  if (next.length !== list.length) await saveAll(userId, next);
  return list.length - next.length;
}

export async function removeAnalise(userId: string, id: string): Promise<boolean> {
  const list = await listAnalises(userId);
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  await saveAll(userId, next);
  return true;
}

// Confere o que o modelo mandou antes de gravar (a ferramenta usa strict, mas validamos mesmo assim).
export function validarAnalise(x: unknown): AnaliseInput | string {
  if (!x || typeof x !== "object") return "entrada vazia";
  const a = x as Record<string, unknown>;
  const hhmm = (v: unknown) => v === null || (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v));
  if (typeof a.nome !== "string" || !a.nome.trim()) return "nome inválido";
  if (!Array.isArray(a.cameras) || !a.cameras.every((c) => typeof c === "string" && /^cam\d+$/.test(c))) return "cameras inválidas";
  if (!TIPOS.includes(a.tipo as (typeof TIPOS)[number])) return "tipo inválido";
  if (!(a.area === null || typeof a.area === "string")) return "area inválida";
  if (!hhmm(a.horario_inicio) || !hhmm(a.horario_fim)) return "horário inválido (use HH:MM)";
  if (!Array.isArray(a.dias) || !a.dias.every((d) => DIAS.includes(d as (typeof DIAS)[number]))) return "dias inválidos";
  if (!(a.limite === null || (Number.isInteger(a.limite) && (a.limite as number) > 0))) return "limite inválido";
  if (!(a.periodo === null || a.periodo === "hora" || a.periodo === "dia")) return "período inválido";
  if (typeof a.mensagem_alerta !== "string" || !a.mensagem_alerta.trim()) return "mensagem inválida";
  return a as unknown as AnaliseInput;
}
