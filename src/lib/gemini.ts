// Gemini (Google AI Studio, plano grátis) — SÓ para a fase de testes, quando não há ANTHROPIC_API_KEY.
// No plano grátis o Google pode usar o que é enviado para treinar os modelos dele: não usar com dados de
// clientes reais. O plano grátis às vezes fica sobrecarregado (503): tenta o modelo reserva antes de desistir.

export const geminiConfigured = () => !!process.env.GEMINI_API_KEY;

export type GeminiPart = {
  text?: string;
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

const MODELOS = () => [process.env.GEMINI_MODEL || "gemini-3.5-flash", "gemini-flash-lite-latest"];

/** Chama o Gemini (generateContent). Devolve as partes da resposta, ou null se todos os modelos falharem. */
export async function geminiGenerate(body: Record<string, unknown>): Promise<GeminiPart[] | null> {
  for (const model of MODELOS()) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.warn(`[gemini] ${model} respondeu ${res.status}.`);
        continue;
      }
      const data = (await res.json()) as { candidates?: { content?: { parts?: GeminiPart[] } }[] };
      const parts = data.candidates?.[0]?.content?.parts;
      if (parts?.length) return parts;
    } catch {
      console.warn(`[gemini] ${model} não respondeu.`);
    }
  }
  return null;
}
