// Cérebro único do assistente da Live.On: o mesmo para o chat do site e para o robô do Telegram.
// Usa a Claude (ANTHROPIC_API_KEY) e, sem ela, o Gemini (GEMINI_API_KEY, só para testes).
// As ferramentas (salvar análise, mandar foto...) são definidas uma vez e funcionam nos dois.
import Anthropic from "@anthropic-ai/sdk";
import { geminiConfigured, geminiGenerate, type GeminiContent, type GeminiPart } from "./gemini";

export type Msg = Anthropic.Beta.BetaMessageParam;

export type Ferramenta = {
  name: string;
  description: string;
  /** JSON Schema (tipos em minúsculas; campo opcional = ["string","null"]). Todos os campos em `required`. */
  schema: { type: "object"; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
  run: (args: Record<string, unknown>) => Promise<string>;
};

export const iaConfigurada = () => !!process.env.ANTHROPIC_API_KEY || geminiConfigured();

const MODEL = "claude-opus-5-5";

/** Responde à última mensagem do usuário. Devolve o histórico com a(s) resposta(s) no fim. Erro = texto amigável. */
export async function conversar(system: string, history: Msg[], ferramentas: Ferramenta[]): Promise<Msg[]> {
  if (process.env.ANTHROPIC_API_KEY) return claude(system, history, ferramentas);
  if (geminiConfigured()) return gemini(system, history, ferramentas);
  throw new Error("Falta ANTHROPIC_API_KEY (ou GEMINI_API_KEY, para testes) no .env.local.");
}

/** Só o texto visível de uma mensagem. */
export function textoDe(m: Msg): string {
  if (typeof m.content === "string") return m.content;
  return (m.content ?? [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

// ---------------- Claude ----------------
async function claude(system: string, history: Msg[], ferramentas: Ferramenta[]): Promise<Msg[]> {
  const client = new Anthropic();
  const messages = [...history];
  const tools: Anthropic.Beta.BetaTool[] = ferramentas.map((f) => ({
    name: f.name,
    description: f.description,
    strict: true,
    input_schema: f.schema as Anthropic.Beta.BetaTool["input_schema"],
  }));
  try {
    for (let volta = 0; volta < 4; volta++) {
      const response = await client.beta.messages
        .stream({
          model: MODEL,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low" },
          system,
          tools,
          messages,
        })
        .finalMessage();
      messages.push({ role: "assistant", content: response.content });
      if (response.stop_reason !== "tool_use") break;

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const f = ferramentas.find((x) => x.name === block.name);
        const content = f ? await f.run(block.input as Record<string, unknown>).catch(() => "Erro ao executar.") : "Ferramenta desconhecida.";
        results.push({ type: "tool_result", tool_use_id: block.id, content, is_error: !f });
      }
      messages.push({ role: "user", content: results });
    }
    return messages;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new Error("Chave da API inválida (ANTHROPIC_API_KEY).");
    if (error instanceof Anthropic.RateLimitError) throw new Error("Muitas mensagens seguidas. Tente de novo em instantes.");
    if (error instanceof Anthropic.APIError) throw new Error(`Erro da IA (${error.status}). Tente de novo.`);
    throw new Error("Não consegui falar com a IA. Confira a internet.");
  }
}

// ---------------- Gemini (testes) ----------------
// Converte o JSON Schema das ferramentas para o formato do Gemini (tipos em MAIÚSCULAS, nullable).
function paraGemini(s: unknown): unknown {
  if (!s || typeof s !== "object") return s;
  const o = s as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const tipos = Array.isArray(o.type) ? o.type : [o.type];
  const tipo = tipos.find((t) => t !== "null");
  if (tipo) out.type = String(tipo).toUpperCase();
  if (tipos.includes("null")) out.nullable = true;
  if (o.description) out.description = o.description;
  if (Array.isArray(o.enum)) out.enum = o.enum.filter((v) => v !== null);
  if (Array.isArray(o.required)) out.required = o.required;
  if (o.items) out.items = paraGemini(o.items);
  if (o.properties) out.properties = Object.fromEntries(Object.entries(o.properties as object).map(([k, v]) => [k, paraGemini(v)]));
  return out;
}

async function gemini(system: string, history: Msg[], ferramentas: Ferramenta[]): Promise<Msg[]> {
  const contents: GeminiContent[] = history
    .map((m) => ({ role: m.role === "assistant" ? ("model" as const) : ("user" as const), parts: [{ text: textoDe(m) }] }))
    .filter((c) => c.parts[0].text);
  const decl = ferramentas.map((f) => ({ name: f.name, description: f.description, parameters: paraGemini(f.schema) }));

  for (let volta = 0; volta < 4; volta++) {
    const parts = await geminiGenerate({
      systemInstruction: { parts: [{ text: `${system}\nEscreva em texto simples, sem markdown (sem asteriscos nem #).` }] },
      contents,
      ...(decl.length ? { tools: [{ functionDeclarations: decl }] } : {}),
      generationConfig: { temperature: 0.3 },
    });
    if (!parts) throw new Error("A IA (Gemini) está ocupada agora. Tente de novo em instantes.");
    const chamadas = parts.filter((p) => p.functionCall);
    if (!chamadas.length) {
      const resposta = parts.map((p) => p.text ?? "").join("").trim() || "Pode repetir, por favor?";
      return [...history, { role: "assistant", content: [{ type: "text", text: resposta }] }];
    }
    contents.push({ role: "model", parts }); // devolve as partes como vieram (inclui a assinatura do raciocínio)
    const respostas: GeminiPart[] = [];
    for (const c of chamadas) {
      const f = ferramentas.find((x) => x.name === c.functionCall!.name);
      // Gemini às vezes omite campos opcionais: completa com null para a validação.
      const args = { ...Object.fromEntries((f?.schema.required ?? []).map((k) => [k, null])), ...c.functionCall!.args };
      const resultado = f ? await f.run(args).catch(() => "Erro ao executar.") : "Ferramenta desconhecida.";
      respostas.push({ functionResponse: { name: c.functionCall!.name, response: { resultado } } });
    }
    contents.push({ role: "user", parts: respostas });
  }
  return [...history, { role: "assistant", content: [{ type: "text", text: "Pronto." }] }];
}
