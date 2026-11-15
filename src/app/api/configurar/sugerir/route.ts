// "Outro": o cliente descreve com as próprias palavras o que a câmera mostra e o que quer saber,
// e a IA escolhe, da lista fixa de análises que o Live.On sabe fazer, as que servem (com um texto curto).
// Ordem: Claude (ANTHROPIC_API_KEY) → Gemini (GEMINI_API_KEY, só para a fase de testes, plano grátis)
// → leitor de palavras-chave. Se uma IA falhar, cai para o próximo.
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/supabase/server";
import { TIPOS, TIPO_LABEL } from "@/lib/analises-tipos";
import { LOCAIS, sugestoesPorTexto, type Local, type Sugestao } from "@/lib/perfil-tipos";

const MODEL = "claude-opus-5-5";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sugestoes", "observacao"],
  properties: {
    sugestoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "texto"],
        properties: {
          tipo: { type: "string", enum: [...TIPOS] },
          texto: { type: "string", description: "Frase curta em pt-BR do que será avisado, ex.: 'Pessoa no galpão depois das 22h'" },
        },
      },
    },
    observacao: { type: "string", description: "Uma frase curta se algo pedido não for possível (ou vazio)." },
  },
} as const;

function system(local: string) {
  const tipos = TIPOS.map((t) => `- ${t}: ${TIPO_LABEL[t]}`).join("\n");
  return `Você configura análises de câmeras de segurança do Live.On. O local do cliente é: ${local}.
O cliente descreve com as próprias palavras o que uma câmera mostra e/ou o que quer saber dela.
Escolha, só desta lista, as análises que fazem sentido (de 1 a 4), cada uma com uma frase curta em português do Brasil, adaptada ao que ele escreveu:
${tipos}
Sempre inclua camera_sem_sinal_ou_tampada.
Limites: não existe reconhecimento facial (não identifica quem é a pessoa); câmera em banheiro ou vestiário não é permitida. Se o pedido esbarrar nisso, ofereça a alternativa possível e explique em "observacao".`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { texto?: string; local?: string };
  const texto = String(body.texto ?? "").trim().slice(0, 300);
  const local = (LOCAIS.some((l) => l.id === body.local) ? body.local : "comercio") as Local;
  if (texto.length < 3) return Response.json({ error: "Escreva o que a câmera mostra." }, { status: 400 });

  const simples = (observacao = "") => Response.json({ sugestoes: sugestoesPorTexto(texto, local), observacao, ia: false });
  const localLabel = LOCAIS.find((l) => l.id === local)!.label;
  const responder = (out: { sugestoes: Sugestao[]; observacao: string } | null) => {
    const sugestoes = (out?.sugestoes ?? []).filter((s) => TIPOS.includes(s.tipo) && typeof s.texto === "string").slice(0, 5);
    return sugestoes.length ? Response.json({ sugestoes, observacao: out?.observacao ?? "", ia: true }) : simples();
  };
  if (!process.env.ANTHROPIC_API_KEY) {
    return process.env.GEMINI_API_KEY ? responder(await gemini(texto, localLabel)) : simples();
  }

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: system(localLabel),
      messages: [{ role: "user", content: texto }],
    });
    if (response.stop_reason === "refusal") return simples();
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return simples();
    return responder(JSON.parse(text.text) as { sugestoes: Sugestao[]; observacao: string });
  } catch (error) {
    // Qualquer falha da IA (chave inválida, limite, internet): segue com o leitor de palavras.
    if (error instanceof Anthropic.APIError) console.warn(`[sugerir] IA falhou (${error.status}); usando palavras-chave.`);
    return simples();
  }
}

// Gemini (Google AI Studio, plano grátis) — SÓ para a fase de testes. No plano grátis o Google pode usar o que é
// enviado para treinar os modelos dele: não usar com dados de clientes reais. Devolve null se falhar.
async function gemini(texto: string, local: string): Promise<{ sugestoes: Sugestao[]; observacao: string } | null> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system(local) }] },
        contents: [{ role: "user", parts: [{ text: texto }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            required: ["sugestoes", "observacao"],
            properties: {
              sugestoes: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  required: ["tipo", "texto"],
                  properties: { tipo: { type: "STRING", enum: [...TIPOS] }, texto: { type: "STRING" } },
                },
              },
              observacao: { type: "STRING" },
            },
          },
        },
      }),
    });
    if (!res.ok) {
      console.warn(`[sugerir] Gemini respondeu ${res.status}; usando palavras-chave.`);
      return null;
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    return out ? (JSON.parse(out) as { sugestoes: Sugestao[]; observacao: string }) : null;
  } catch {
    return null;
  }
}
