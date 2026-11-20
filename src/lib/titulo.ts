// Título curto de uma conversa, escrito pela IA (como no Claude): resume o assunto em poucas palavras.
// Claude (ANTHROPIC_API_KEY) ou Gemini (testes). Se nenhuma responder, devolve null (fica o começo da mensagem).
import Anthropic from "@anthropic-ai/sdk";
import { geminiConfigured, geminiGenerate } from "./gemini";

const INSTRUCAO = `Escreva um título curto (3 a 6 palavras) em português do Brasil, simples e claro, que resuma o assunto desta conversa sobre câmeras de segurança.
Use as palavras que o cliente usaria (ex.: "Contagem de cachorros na calçada", "Alerta de movimento no estoque"). Sem aspas, sem ponto final, sem emoji.
Responda só com o título.`;

function limpar(t: string) {
  const s = t.replace(/["“”*#]/g, "").split("\n")[0].trim().replace(/[.!]+$/, "");
  return s ? (s.length > 60 ? s.slice(0, 58).trimEnd() + "…" : s) : null;
}

export async function tituloDaConversa(trecho: string): Promise<string | null> {
  const texto = trecho.slice(0, 3000);
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await new Anthropic().beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 1000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: INSTRUCAO,
        messages: [{ role: "user", content: texto }],
      });
      const t = r.content.find((b) => b.type === "text");
      if (t && t.type === "text") return limpar(t.text);
    } catch {}
  }
  if (geminiConfigured()) {
    const parts = await geminiGenerate({
      systemInstruction: { parts: [{ text: INSTRUCAO }] },
      contents: [{ role: "user", parts: [{ text: texto }] }],
      generationConfig: { temperature: 0.2 },
    });
    const t = parts?.map((p) => p.text ?? "").join("");
    if (t) return limpar(t);
  }
  return null;
}
