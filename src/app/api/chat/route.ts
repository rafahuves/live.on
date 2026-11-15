// Chat que transforma o pedido do cliente numa análise personalizada.
// O cliente guarda o histórico completo (Anthropic.Beta.BetaMessageParam[]) e reenvia a cada mensagem, sem editar nada:
// o histórico só cresce (necessário para os blocos de "thinking" continuarem válidos).
import Anthropic from "@anthropic-ai/sdk";
import { DIAS, TIPOS, TIPO_LABEL, addAnalise, listAnalises, validarAnalise } from "@/lib/analises";
import { getCurrentUser } from "@/lib/supabase/server";
import { activeChannels, loadDvr } from "@/lib/dvr";
import { loadPerfil } from "@/lib/perfil";
import { geminiConfigured } from "@/lib/gemini";
import { chatGemini } from "@/lib/chatGemini";
import { telegramStatus, type TelegramStatus } from "@/lib/telegram";

const client = new Anthropic();
const MODEL = "claude-opus-5-5";

const TOOL: Anthropic.Beta.BetaTool = {
  name: "salvar_analise",
  description:
    "Grava uma análise personalizada para as câmeras do cliente. Só chame depois que o cliente confirmar o resumo da análise.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["nome", "cameras", "tipo", "area", "horario_inicio", "horario_fim", "dias", "limite", "periodo", "mensagem_alerta"],
    properties: {
      nome: { type: "string", description: "Nome curto da análise, ex.: 'Passagens pela porta do estoque'" },
      cameras: {
        type: "array",
        items: { type: "string" },
        description: "Câmeras onde roda, ex.: ['cam2']. Lista vazia = todas as câmeras.",
      },
      tipo: { type: "string", enum: [...TIPOS] },
      area: { type: ["string", "null"], description: "Porta ou área da imagem a observar, em palavras. null se for a imagem toda." },
      horario_inicio: { type: ["string", "null"], description: "HH:MM. null = o dia todo." },
      horario_fim: { type: ["string", "null"], description: "HH:MM. null = o dia todo." },
      dias: { type: "array", items: { type: "string", enum: [...DIAS] }, description: "Dias em que vale. Lista vazia = todos." },
      limite: { type: ["integer", "null"], description: "Quantidade que dispara o alerta (ex.: 5 passagens). null se não houver." },
      periodo: { type: ["string", "null"], enum: ["hora", "dia", null], description: "Janela do limite. null se não houver limite." },
      mensagem_alerta: { type: "string", description: "Texto do alerta que chega ao cliente." },
    },
  },
};

function systemPrompt(cameras: string[], robo = "Live.On Alertas", telegram = "não configurado") {
  const tipos = TIPOS.map((t) => `- ${t}: ${TIPO_LABEL[t]}`).join("\n");
  return `Você é o assistente da Live.On, um sistema que analisa as câmeras de segurança que o cliente já tem e avisa quando algo importante acontece.
Converse em português do Brasil, com frases curtas e simples. O cliente não é técnico.

Seu trabalho: entender o que o cliente quer vigiar e transformar isso numa análise, usando a ferramenta salvar_analise.
IMPORTANTE: este chat é o site da Live.On, NÃO é o Telegram. Os alertas não chegam aqui: chegam no Telegram, numa conversa com o robô "${robo}", com a foto da câmera no momento (WhatsApp ainda não existe).
Situação do Telegram desta conta agora: ${telegram}
Depois de salvar uma análise, siga a orientação sobre o Telegram que vem no resultado da ferramenta (se vier um link, mande o link completo, sem encurtar).

Tipos de análise que o sistema sabe fazer:
${tipos}

Câmeras do cliente: ${cameras.length ? cameras.join(", ") : "nenhuma detectada agora (aceite os nomes cam1, cam2... que o cliente disser)"}.
Na ferramenta, use só o código da câmera (ex.: "cam7"), sem o nome entre parênteses.

Como conduzir:
1. Descubra o necessário: qual câmera, qual porta ou área da imagem, horários e dias, e o limite (ex.: mais de 5 vezes por dia). Pergunte uma ou duas coisas por vez.
2. Quando tiver tudo, mostre um resumo curto da análise e peça confirmação.
3. Só depois do "sim" chame salvar_analise. Em seguida confirme em uma frase que a análise foi salva.

Limites que você deve explicar com gentileza quando aparecerem:
- O sistema conta pessoas e passagens, mas não reconhece quem é a pessoa (não há reconhecimento facial). Se o cliente pedir para seguir "o funcionário X", proponha contar as passagens pela porta ou área, sem identificar ninguém.
- Câmera dentro de banheiro ou vestiário não é permitida. Dá no máximo para contar passagens pela porta, filmada do lado de fora, e vale lembrar que vigiar idas ao banheiro de um funcionário pode gerar problema trabalhista.
- Lembre que é preciso aviso de monitoramento no local (LGPD).
Se o pedido não couber em nenhum tipo, diga o que é possível hoje e ofereça a alternativa mais próxima.`;
}

// Texto curto da situação do Telegram, para o prompt e para o resultado de salvar_analise.
function telegramTexto(t: TelegramStatus) {
  if (!t.configurado || t.erro) return "o robô do Telegram ainda não está configurado neste computador.";
  if (t.conectado) return `conectado (${t.nome || "cliente"}). Os alertas desta análise já vão chegar no robô "${t.nomeRobo}".`;
  return `NÃO conectado. Mande este link para o cliente e diga para tocar em "Começar" no robô "${t.nomeRobo}": ${t.url}`;
}

// Câmeras da conta (só canais com câmera), com o nome dado na configuração: "cam7 (Portão)".
async function cameraNames(userId: string): Promise<string[]> {
  const dvr = await loadDvr(userId);
  if (!dvr) return [];
  const perfil = await loadPerfil(userId);
  return activeChannels(dvr).map((ch) => {
    const nome = perfil?.cameras.find((c) => c.ch === ch)?.nome;
    return nome && nome !== `Câmera ${ch}` ? `cam${ch} (${nome})` : `cam${ch}`;
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY && !geminiConfigured()) {
    return Response.json({ error: "Falta ANTHROPIC_API_KEY (ou GEMINI_API_KEY, para testes) no .env.local." }, { status: 500 });
  }
  const body = (await request.json()) as { messages?: Anthropic.Beta.BetaMessageParam[] };
  const messages = Array.isArray(body.messages) ? [...body.messages] : [];
  if (!messages.length || messages[0].role !== "user") {
    return Response.json({ error: "Histórico inválido." }, { status: 400 });
  }

  const perfil = await loadPerfil(user.id);
  const empresa = perfil?.empresa || user.company;
  const tg = await telegramStatus(user.id, empresa);
  const system = systemPrompt(await cameraNames(user.id), tg.nomeRobo, telegramTexto(tg));
  // Depois de salvar: confere de novo (a pessoa pode ter acabado de tocar em "Começar").
  const aposSalvar = async (id: string) => `Análise salva com id ${id}. Telegram: ${telegramTexto(await telegramStatus(user.id, empresa))}`;

  // Fase de testes sem chave da Claude: Gemini (plano grátis). Ver src/lib/chatGemini.ts.
  if (!process.env.ANTHROPIC_API_KEY) {
    const out = await chatGemini(user.id, system, messages, aposSalvar);
    if (!out) return Response.json({ error: "A IA (Gemini) está ocupada agora. Tente de novo em instantes." }, { status: 503 });
    return Response.json({ messages: out.messages, saved: out.saved, analises: await listAnalises(user.id) });
  }

  const saved: Awaited<ReturnType<typeof addAnalise>>[] = [];

  try {
    // Laço de ferramenta: no máximo 4 voltas por mensagem do cliente.
    for (let turn = 0; turn < 4; turn++) {
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system,
        tools: [TOOL],
        messages,
      });
      const response = await stream.finalMessage();
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "refusal") break;
      if (response.stop_reason !== "tool_use") break;

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        if (block.name !== TOOL.name) {
          results.push({ type: "tool_result", tool_use_id: block.id, content: "Ferramenta desconhecida.", is_error: true });
          continue;
        }
        const valid = validarAnalise(block.input);
        if (typeof valid === "string") {
          results.push({ type: "tool_result", tool_use_id: block.id, content: `Dados inválidos: ${valid}`, is_error: true });
          continue;
        }
        const nova = await addAnalise(user.id, valid);
        saved.push(nova);
        results.push({ type: "tool_result", tool_use_id: block.id, content: await aposSalvar(nova.id) });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Chave da API inválida (ANTHROPIC_API_KEY)." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Muitas mensagens seguidas. Tente de novo em instantes." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `Erro da IA (${error.status}). Tente de novo.` }, { status: 502 });
    }
    return Response.json({ error: "Não consegui falar com a IA. Confira a internet." }, { status: 502 });
  }

  return Response.json({ messages, saved, analises: await listAnalises(user.id) });
}
