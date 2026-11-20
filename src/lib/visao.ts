// IA de visão: olha UMA imagem da câmera e responde se ela atende ao objetivo do cliente, com as palavras dele
// ("pessoa passeando com cachorro na calçada"). É a confirmação da precisão "Máxima": o YOLO só dispara o gatilho;
// quem decide se conta/avisa é esta IA. Claude (ANTHROPIC_API_KEY) ou, nos testes, Gemini (GEMINI_API_KEY).
import Anthropic from "@anthropic-ai/sdk";
import { geminiConfigured, geminiGenerate } from "./gemini";

export type Veredito = { atende: boolean; confianca: number; quantidade: number; descricao: string; motivo: string };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["atende", "confianca", "quantidade", "descricao", "motivo"],
  properties: {
    atende: { type: "boolean", description: "A imagem mostra claramente o que o objetivo pede?" },
    confianca: { type: "number", description: "0 a 1: quão certo você está." },
    quantidade: { type: "integer", description: "Quantas ocorrências do objetivo aparecem (0 se não atende)." },
    descricao: { type: "string", description: "Uma frase curta em pt-BR do que se vê, sem identificar ninguém." },
    motivo: { type: "string", description: "Por que atende ou não, em poucas palavras." },
  },
} as const;

function instrucoes(objetivo: string) {
  return `Você confere imagens de câmeras de segurança para a Live.On. Seja rigoroso: diga que atende só quando a imagem mostra claramente o que foi pedido. Na dúvida (imagem escura, objeto cortado, ambíguo), responda que não atende.
Nunca identifique pessoas (sem nomes, sem reconhecimento facial); descreva só roupas, objetos e ações.
Objetivo do cliente: "${objetivo}"
Responda só com o JSON pedido.`;
}

export const visaoConfigurada = () => !!process.env.ANTHROPIC_API_KEY || geminiConfigured();

/** null = nenhuma IA respondeu (sem chave, sem internet, limite do plano grátis). */
export async function verificarImagem(jpgBase64: string, objetivo: string): Promise<Veredito | null> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic();
      const r = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 2000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpgBase64 } },
              { type: "text", text: instrucoes(objetivo) },
            ],
          },
        ],
      });
      if (r.stop_reason !== "refusal") {
        const t = r.content.find((b) => b.type === "text");
        if (t && t.type === "text") return JSON.parse(t.text) as Veredito;
      }
    } catch (e) {
      console.warn("[visão] Claude não respondeu:", e instanceof Error ? e.message : e);
    }
  }
  if (geminiConfigured()) {
    const parts = await geminiGenerate({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: jpgBase64 } }, { text: instrucoes(objetivo) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          required: ["atende", "confianca", "quantidade", "descricao", "motivo"],
          properties: {
            atende: { type: "BOOLEAN" },
            confianca: { type: "NUMBER" },
            quantidade: { type: "INTEGER" },
            descricao: { type: "STRING" },
            motivo: { type: "STRING" },
          },
        },
      },
    });
    try {
      const txt = parts?.map((p) => p.text ?? "").join("");
      if (txt) return JSON.parse(txt) as Veredito;
    } catch {}
  }
  return null;
}
