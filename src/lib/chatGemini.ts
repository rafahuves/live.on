// Chat de Análises pelo Gemini (fase de testes, quando não há ANTHROPIC_API_KEY). Mesmo comportamento do chat da
// Claude: conversa, mostra o resumo, e só depois do "sim" chama salvar_analise. O histórico continua no formato
// da Claude (só texto), para o mesmo cliente servir aos dois.
import type Anthropic from "@anthropic-ai/sdk";
import { DIAS, TIPOS, addAnalise, validarAnalise, type Analise } from "./analises";
import { geminiGenerate, type GeminiContent } from "./gemini";

type Msg = Anthropic.Beta.BetaMessageParam;

const FUNCAO = {
  name: "salvar_analise",
  description: "Grava uma análise personalizada para as câmeras do cliente. Só chame depois que o cliente confirmar o resumo.",
  parameters: {
    type: "OBJECT",
    required: ["nome", "cameras", "tipo", "area", "horario_inicio", "horario_fim", "dias", "limite", "periodo", "mensagem_alerta"],
    properties: {
      nome: { type: "STRING", description: "Nome curto da análise" },
      cameras: { type: "ARRAY", items: { type: "STRING" }, description: "Ex.: ['cam13']. Vazio = todas." },
      tipo: { type: "STRING", enum: [...TIPOS] },
      area: { type: "STRING", nullable: true, description: "Porta ou área da imagem, em palavras. null = imagem toda." },
      horario_inicio: { type: "STRING", nullable: true, description: "HH:MM ou null (o dia todo)" },
      horario_fim: { type: "STRING", nullable: true, description: "HH:MM ou null (o dia todo)" },
      dias: { type: "ARRAY", items: { type: "STRING", enum: [...DIAS] }, description: "Vazio = todos." },
      limite: { type: "INTEGER", nullable: true, description: "Quantidade que dispara o alerta, ou null" },
      periodo: { type: "STRING", nullable: true, enum: ["hora", "dia"], description: "Janela do limite, ou null" },
      mensagem_alerta: { type: "STRING", description: "Texto do alerta que chega ao cliente" },
    },
  },
};

function texto(m: Msg): string {
  if (typeof m.content === "string") return m.content;
  return (m.content ?? [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

export async function chatGemini(
  userId: string,
  system: string,
  history: Msg[],
): Promise<{ messages: Msg[]; saved: Analise[] } | null> {
  const contents: GeminiContent[] = history
    .map((m) => ({ role: m.role === "assistant" ? ("model" as const) : ("user" as const), parts: [{ text: texto(m) }] }))
    .filter((c) => c.parts[0].text);
  const saved: Analise[] = [];

  for (let volta = 0; volta < 4; volta++) {
    const parts = await geminiGenerate({
      systemInstruction: { parts: [{ text: `${system}\nEscreva em texto simples, sem markdown (sem asteriscos nem #).` }] },
      contents,
      tools: [{ functionDeclarations: [FUNCAO] }],
      generationConfig: { temperature: 0.3 },
    });
    if (!parts) return null;
    const chamadas = parts.filter((p) => p.functionCall?.name === "salvar_analise");
    if (!chamadas.length) {
      const resposta = parts.map((p) => p.text ?? "").join("").trim() || "Pode repetir, por favor?";
      return { messages: [...history, { role: "assistant", content: [{ type: "text", text: resposta }] }], saved };
    }
    contents.push({ role: "model", parts }); // devolve as partes como vieram (inclui a assinatura do raciocínio)
    const respostas = [];
    for (const c of chamadas) {
      const a = { area: null, horario_inicio: null, horario_fim: null, limite: null, periodo: null, dias: [], cameras: [], ...c.functionCall!.args };
      const valido = validarAnalise(a);
      if (typeof valido === "string") {
        respostas.push({ functionResponse: { name: "salvar_analise", response: { erro: `Dados inválidos: ${valido}` } } });
        continue;
      }
      const nova = await addAnalise(userId, valido);
      saved.push(nova);
      respostas.push({ functionResponse: { name: "salvar_analise", response: { resultado: `Análise salva com id ${nova.id}.` } } });
    }
    contents.push({ role: "user", parts: respostas });
  }
  return { messages: [...history, { role: "assistant", content: [{ type: "text", text: "Análise salva." }] }], saved };
}
