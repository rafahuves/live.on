// Telegram (fase de testes): alertas com foto e chat oficial com o assistente. O robô é criado no @BotFather e o
// token vai em TELEGRAM_BOT_TOKEN no .env.local. Para ligar uma conta: a pessoa abre t.me/<bot>?start=<código> e
// toca em "Começar"; o robô (src/lib/telegramBot.ts, sempre ouvindo) recebe isso e guarda o chat em
// data/telegram/<id>.json (fora do Git). Os códigos ficam em data/telegram/codigos.json.
import { createHmac } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.telegram.org";

export const telegramConfigured = () => /^\d+:[\w-]{30,}$/.test(process.env.TELEGRAM_BOT_TOKEN ?? "");

export async function call<T>(method: string, body?: Record<string, unknown> | FormData): Promise<T> {
  const res = await fetch(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    ...(body instanceof FormData
      ? { body }
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) throw new Error(data.description ?? `Telegram ${method} falhou`);
  return data.result;
}

let botName: string | null = null;
export async function botUsername(): Promise<string> {
  botName ??= (await call<{ username: string }>("getMe")).username;
  return botName;
}

// Código de ligação fixo por conta (não precisa guardar): HMAC do id com a chave local.
export function linkCode(userId: string) {
  const key = process.env.LIVEON_LOCAL_KEY ?? "liveon";
  return "lo" + createHmac("sha256", key).update(userId).digest("hex").slice(0, 16);
}

type Link = { chat_id: number; nome: string; ligado_em: string };

function fileFor(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("id de usuário inválido");
  return path.join(process.cwd(), "data", "telegram", `${userId}.json`);
}

export async function loadLink(userId: string): Promise<Link | null> {
  try {
    return JSON.parse(await readFile(fileFor(userId), "utf8")) as Link;
  } catch {
    return null;
  }
}

export async function removeLink(userId: string) {
  await rm(fileFor(userId), { force: true });
}

const DIR = () => path.join(process.cwd(), "data", "telegram");
const CODIGOS = () => path.join(DIR(), "codigos.json");
export type Codigo = { userId: string; empresa: string | null; nome: string | null };

async function lerCodigos(): Promise<Record<string, Codigo>> {
  try {
    return JSON.parse(await readFile(CODIGOS(), "utf8")) as Record<string, Codigo>;
  } catch {
    return {};
  }
}

/** Guarda quem é o dono de cada código de ligação (para o robô saber quem tocou em "Começar"). */
export async function registrarCodigo(userId: string, empresa: string | null | undefined, nome: string | null | undefined) {
  const codigos = await lerCodigos();
  const code = linkCode(userId);
  const novo: Codigo = { userId, empresa: empresa?.trim() || null, nome: nome?.trim() || null };
  if (JSON.stringify(codigos[code]) === JSON.stringify(novo)) return;
  codigos[code] = novo;
  await mkdir(DIR(), { recursive: true });
  await writeFile(CODIGOS(), JSON.stringify(codigos, null, 2));
}

export async function donoDoCodigo(code: string): Promise<Codigo | null> {
  return (await lerCodigos())[code] ?? null;
}

/** Liga um chat do Telegram a uma conta (chamado pelo robô ao receber "/start <código>"). */
export async function salvarLink(userId: string, chatId: number, nome: string): Promise<Link> {
  const link: Link = { chat_id: chatId, nome, ligado_em: new Date().toISOString() };
  const file = fileFor(userId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(link, null, 2));
  return link;
}

/** Qual conta está ligada a este chat do Telegram (null = ninguém). */
export async function contaDoChat(chatId: number): Promise<string | null> {
  const arquivos = await readdir(DIR()).catch(() => [] as string[]);
  for (const f of arquivos) {
    const m = /^([0-9a-f-]{36})\.json$/i.exec(f);
    if (m && (await loadLink(m[1]))?.chat_id === chatId) return m[1];
  }
  return null;
}

/** Já ligado? (quem liga é o robô quando a pessoa toca em "Começar"). */
export async function verifyLink(userId: string): Promise<Link | null> {
  return loadLink(userId);
}

export async function sendText(chatId: number, text: string, html = false) {
  // O Telegram aceita até 4096 caracteres por mensagem.
  for (let i = 0; i < text.length; i += 4000) {
    await call("sendMessage", { chat_id: chatId, text: text.slice(i, i + 4000), ...(html ? { parse_mode: "HTML" } : {}) });
  }
}

export async function sendPhoto(chatId: number, jpg: ArrayBuffer, caption: string) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("photo", new Blob([jpg], { type: "image/jpeg" }), "camera.jpg");
  await call("sendPhoto", form);
}

/** Envia um alerta para a conta (foto opcional). Usado pelo teste e, depois, pelo detector. */
export async function enviarAlerta(userId: string, texto: string, foto?: ArrayBuffer | null): Promise<boolean> {
  if (!telegramConfigured()) return false;
  const link = (await loadLink(userId)) ?? (await verifyLink(userId).catch(() => null));
  if (!link) return false;
  if (foto) await sendPhoto(link.chat_id, foto, texto);
  else await sendText(link.chat_id, texto);
  return true;
}

// ---- Nome do robô por empresa e situação da conta ----

/** Nome que aparece no Telegram: "Live.On - VS Transporte". */
export const nomeDoRobo = (empresa: string | null | undefined) =>
  empresa?.trim() ? `Live.On - ${empresa.trim()}`.slice(0, 64) : "Live.On Alertas";

let nomeAtual: string | null = null;
/** Põe o nome da empresa no robô (só chama o Telegram quando muda). Fase de teste: 1 robô = 1 empresa. */
export async function ajustarNomeDoRobo(empresa: string | null | undefined) {
  const nome = nomeDoRobo(empresa);
  if (nomeAtual === nome) return;
  try {
    nomeAtual ??= (await call<{ name: string }>("getMyName")).name;
    if (nomeAtual !== nome) {
      await call("setMyName", { name: nome });
      nomeAtual = nome;
    }
  } catch {
    // Telegram limita trocas de nome; tenta de novo numa próxima vez.
  }
}

export type TelegramStatus = { configurado: boolean; bot?: string; nomeRobo?: string; url?: string; conectado?: boolean; nome?: string | null; erro?: string };

/** Situação do Telegram da conta. Se ainda não está ligado, confere se a pessoa já tocou em "Começar". */
export async function telegramStatus(
  userId: string,
  empresa: string | null | undefined,
  nome?: string | null,
): Promise<TelegramStatus> {
  if (!telegramConfigured()) return { configurado: false };
  try {
    await registrarCodigo(userId, empresa, nome);
    await ajustarNomeDoRobo(empresa);
    const bot = await botUsername();
    const link = await loadLink(userId);
    return {
      configurado: true,
      bot,
      nomeRobo: nomeDoRobo(empresa),
      url: `https://t.me/${bot}?start=${linkCode(userId)}`,
      conectado: !!link,
      nome: link?.nome ?? null,
    };
  } catch {
    return { configurado: true, erro: "Não consegui falar com o Telegram. Confira o token do robô." };
  }
}

/** Texto curto da situação do Telegram, para as instruções da IA e para o resultado de salvar_analise. */
export function telegramTexto(t: TelegramStatus) {
  if (!t.configurado || t.erro) return "o robô do Telegram ainda não está configurado neste computador.";
  if (t.conectado) return `conectado (${t.nome || "cliente"}). Os alertas já vão chegar no robô "${t.nomeRobo}".`;
  return `NÃO conectado. Mande este link para o cliente e diga para tocar em "Começar" no robô "${t.nomeRobo}": ${t.url}`;
}

/** Foto de perfil do robô (logo Live.On, assets/robo-telegram.jpg). Se o perfil estiver sem foto, coloca. */
export async function garantirFotoDoRobo() {
  try {
    const { id } = await call<{ id: number }>("getMe");
    const fotos = await call<{ total_count: number }>("getUserProfilePhotos", { user_id: id, limit: 1 });
    if (fotos.total_count > 0) return;
    const jpg = await readFile(path.join(process.cwd(), "assets", "robo-telegram.jpg"));
    const form = new FormData();
    form.append("photo", JSON.stringify({ type: "static", photo: "attach://avatar" }));
    form.append("avatar", new Blob([new Uint8Array(jpg)], { type: "image/jpeg" }), "robo.jpg");
    await call("setMyProfilePhoto", form);
    console.log("[robô do Telegram] foto de perfil colocada.");
  } catch (e) {
    console.warn("[robô do Telegram] não consegui conferir a foto de perfil:", e instanceof Error ? e.message : e);
  }
}
