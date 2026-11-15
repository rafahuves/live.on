// Robô do Telegram sempre ouvindo (long polling), ligado quando o site inicia (src/instrumentation.ts).
// - "/start <código>": liga a conta e manda a mensagem de boas-vindas.
// - Qualquer outra mensagem de quem já está ligado: responde com o assistente (o mesmo do site), que pode
//   criar análises e mandar a foto de uma câmera.
// O histórico da conversa fica em data/telegram/<id>-conversa.json (só texto, últimas mensagens).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { conversar, iaConfigurada, textoDe, type Msg } from "./assistente";
import { ferramentasTelegram, fotoCamera, salvarAnalise } from "./ferramentas";
import { empresaDaConta } from "./perfil";
import { systemPrompt } from "./prompt";
import { listAnalises } from "./analises";
import { cameraNames } from "./prompt";
import {
  ajustarNomeDoRobo,
  call,
  contaDoChat,
  garantirFotoDoRobo,
  donoDoCodigo,
  nomeDoRobo,
  salvarLink,
  sendPhoto,
  sendText,
  telegramConfigured,
  type Codigo,
} from "./telegram";

type Update = {
  update_id: number;
  message?: { text?: string; chat: { id: number; type: string; first_name?: string; last_name?: string; username?: string } };
};

const g = globalThis as unknown as { __liveonRobo?: boolean };

export function iniciarRobo() {
  if (g.__liveonRobo || !telegramConfigured()) return;
  g.__liveonRobo = true;
  void garantirFotoDoRobo();
  void ouvir();
  console.log("[robô do Telegram] ouvindo mensagens.");
}

async function ouvir() {
  let offset = 0;
  let espera = 1000;
  for (;;) {
    try {
      const updates = await call<Update[]>("getUpdates", { offset, timeout: 15, allowed_updates: ["message"] }).catch((e) => {
        throw e;
      });
      espera = 1000;
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message?.text) void tratar(u.message).catch((e) => console.warn("[robô do Telegram]", e));
      }
    } catch (e) {
      // 409 = outro processo ouvindo o mesmo robô; rede fora; etc. Espera e tenta de novo, cada vez mais devagar.
      console.warn("[robô do Telegram] sem conexão:", e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, espera));
      espera = Math.min(espera * 2, 60_000);
    }
  }
}

// ---------- boas-vindas ----------
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function boasVindas(chatId: number, c: Codigo, primeiroNome: string) {
  const nome = c.nome || primeiroNome || "tudo bem";
  const cameras = (await cameraNames(c.userId)).length;
  const analises = (await listAnalises(c.userId)).length;
  const texto = `Olá, <b>${esc(nome)}</b>! 👋

Que bom ter você aqui. Vi que você está usando o <b>Live.On</b>${c.empresa ? ` na <b>${esc(c.empresa)}</b>` : ""} 💜
A partir de agora, esta conversa é o seu canal oficial com as suas câmeras.

${cameras ? `📹 <b>${cameras} câmeras</b> conectadas` : "📹 Câmeras: conecte o seu gravador no site"}${analises ? ` · <b>${analises} análises</b> ativas` : ""}

🔔 <b>Alertas com foto</b>
Quando algo importante acontecer, eu te aviso aqui na hora, com o print da câmera.

💬 <b>É só conversar comigo</b>, do seu jeito:
• "me manda a foto do portão"
• "quais análises estão ligadas?"
• "me avise se alguém entrar no estoque depois das 22h"

📊 <b>Relatórios</b>
Contagens e resumos do dia estão chegando em breve.

Pode começar: me manda uma mensagem! 🚀`;
  await sendText(chatId, texto, true);
}

// ---------- mensagens ----------
async function tratar(m: NonNullable<Update["message"]>) {
  if (m.chat.type !== "private") return; // só conversas diretas com o robô
  const chatId = m.chat.id;
  const texto = (m.text ?? "").trim();
  const primeiroNome = m.chat.first_name ?? m.chat.username ?? "";

  if (texto.startsWith("/start")) {
    const code = texto.split(/\s+/)[1];
    const c = code ? await donoDoCodigo(code) : null;
    if (c) {
      await salvarLink(c.userId, chatId, [m.chat.first_name, m.chat.last_name].filter(Boolean).join(" ") || primeiroNome);
      const empresa = await empresaDaConta(c.userId, c.empresa);
      await ajustarNomeDoRobo(empresa);
      return boasVindas(chatId, { ...c, empresa }, primeiroNome);
    }
    const dono = await contaDoChat(chatId);
    if (dono) return sendText(chatId, "Você já está conectado ✅ Pode me mandar uma mensagem.");
    return sendText(chatId, "Olá! 👋 Para usar o Live.On aqui, abra o link do robô pelo site do Live.On (Configurar → passo 3).");
  }

  const userId = await contaDoChat(chatId);
  if (!userId) {
    return sendText(chatId, "Ainda não sei de qual conta você é 🙂 Abra o link do robô pelo site do Live.On (Configurar → passo 3).");
  }
  if (!iaConfigurada()) return sendText(chatId, "A IA ainda não foi configurada neste computador.");

  await call("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  const robo = nomeDoRobo(await empresaDaConta(userId));
  const system = await systemPrompt(userId, { canal: "telegram", robo, telegram: "conectado (esta conversa)", cliente: primeiroNome });
  const historico = await lerConversa(userId);
  const comPergunta: Msg[] = [...historico, { role: "user", content: texto }];
  try {
    const out = await conversar(system, comPergunta, [
      salvarAnalise(userId, async (id) => `Análise salva com id ${id}. Os alertas vão chegar aqui no Telegram, com foto.`),
      fotoCamera(userId, (jpg, legenda) => sendPhoto(chatId, jpg, legenda)),
      ...ferramentasTelegram(userId, primeiroNome, null, "telegram"),
    ]);
    const resposta = textoDe(out[out.length - 1]) || "Feito ✅";
    await sendText(chatId, resposta);
    await salvarConversa(userId, [...comPergunta, { role: "assistant", content: resposta }]);
  } catch (e) {
    await sendText(chatId, e instanceof Error ? e.message : "Não consegui responder agora. Tente de novo.");
  }
}

// ---------- histórico (só texto, últimas 30 mensagens, começando por uma do cliente) ----------
const conversaFile = (userId: string) => path.join(process.cwd(), "data", "telegram", `${userId}-conversa.json`);

async function lerConversa(userId: string): Promise<Msg[]> {
  try {
    return JSON.parse(await readFile(conversaFile(userId), "utf8")) as Msg[];
  } catch {
    return [];
  }
}

async function salvarConversa(userId: string, msgs: Msg[]) {
  let ultimas = msgs.slice(-30);
  while (ultimas.length && ultimas[0].role !== "user") ultimas = ultimas.slice(1);
  await mkdir(path.dirname(conversaFile(userId)), { recursive: true });
  await writeFile(conversaFile(userId), JSON.stringify(ultimas, null, 2));
}
