// Chat do site que transforma o pedido do cliente numa análise personalizada.
// O navegador guarda o histórico completo e reenvia a cada mensagem, sem editar nada: o histórico só cresce
// (necessário para os blocos de "thinking" da Claude continuarem válidos). O cérebro é src/lib/assistente.ts,
// o mesmo do robô do Telegram.
import { getCurrentUser } from "@/lib/supabase/server";
import { listAnalises, type Analise } from "@/lib/analises";
import { empresaDaConta } from "@/lib/perfil";
import { conversar, iaConfigurada, type Msg } from "@/lib/assistente";
import { configuracoes, ferramentasTelegram, gerenciarAnalises, relatorio, salvarAnalise } from "@/lib/ferramentas";
import { systemPrompt } from "@/lib/prompt";
import { telegramStatus, telegramTexto } from "@/lib/telegram";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  if (!iaConfigurada()) {
    return Response.json({ error: "Falta ANTHROPIC_API_KEY (ou GEMINI_API_KEY, para testes) no .env.local." }, { status: 500 });
  }
  const body = (await request.json()) as { messages?: Msg[] };
  const history = Array.isArray(body.messages) ? body.messages : [];
  if (!history.length || history[0].role !== "user") {
    return Response.json({ error: "Histórico inválido." }, { status: 400 });
  }

  const empresa = await empresaDaConta(user.id, user.company);
  const tg = await telegramStatus(user.id, empresa, user.name);
  const system = await systemPrompt(user.id, { canal: "site", robo: tg.nomeRobo ?? "Live.On", telegram: telegramTexto(tg), cliente: user.name });
  // Depois de salvar: confere de novo (a pessoa pode ter acabado de tocar em "Começar").
  const aposSalvar = async (id: string) =>
    `Análise salva com id ${id}. Telegram: ${telegramTexto(await telegramStatus(user.id, empresa, user.name))}`;
  const saved: Analise[] = [];

  try {
    const messages = await conversar(system, history, [
      salvarAnalise(user.id, aposSalvar, (a) => saved.push(a)),
      ...ferramentasTelegram(user.id, user.name, user.company, "site"),
      relatorio(user.id),
      ...gerenciarAnalises(user.id),
      ...configuracoes(user.id),
    ]);
    return Response.json({ messages, saved, analises: await listAnalises(user.id) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erro da IA." }, { status: 502 });
  }
}
