// Alertas pelo Telegram (fase de testes). O bot é criado pelo dono no @BotFather e o token vai em
// TELEGRAM_BOT_TOKEN no .env.local. Para ligar uma conta: a pessoa abre t.me/<bot>?start=<código> e toca em
// "Começar"; o site acha essa mensagem (getUpdates) e guarda o chat em data/telegram/<id>.json (fora do Git).
import { createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.telegram.org";

export const telegramConfigured = () => /^\d+:[\w-]{30,}$/.test(process.env.TELEGRAM_BOT_TOKEN ?? "");

async function call<T>(method: string, body?: Record<string, unknown> | FormData): Promise<T> {
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

/** Procura o "/start <código>" da pessoa nas mensagens recentes do bot e liga a conta. */
export async function verifyLink(userId: string): Promise<Link | null> {
  const code = linkCode(userId);
  type Update = { message?: { text?: string; chat: { id: number; first_name?: string; username?: string } } };
  const updates = await call<Update[]>("getUpdates", { allowed_updates: ["message"] });
  const msg = updates.reverse().find((u) => u.message?.text?.trim() === `/start ${code}`)?.message;
  if (!msg) return null;
  const link: Link = { chat_id: msg.chat.id, nome: msg.chat.first_name ?? msg.chat.username ?? "", ligado_em: new Date().toISOString() };
  const file = fileFor(userId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(link, null, 2));
  await sendText(link.chat_id, "✅ Pronto! Os alertas do Live.On vão chegar aqui.").catch(() => {});
  return link;
}

export async function sendText(chatId: number, text: string) {
  await call("sendMessage", { chat_id: chatId, text });
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
export async function telegramStatus(userId: string, empresa: string | null | undefined): Promise<TelegramStatus> {
  if (!telegramConfigured()) return { configurado: false };
  try {
    await ajustarNomeDoRobo(empresa);
    const bot = await botUsername();
    const link = (await loadLink(userId)) ?? (await verifyLink(userId).catch(() => null));
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
