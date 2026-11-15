// "Outro": o cliente descreve com as próprias palavras o que a câmera mostra e o que quer saber,
// e a IA escolhe, da lista fixa de análises que o Live.On sabe fazer, as que servem (com um texto curto).
// Sem ANTHROPIC_API_KEY (ou se a IA falhar), um leitor de palavras-chave faz o mesmo de forma simples.
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
  if (!process.env.ANTHROPIC_API_KEY) return simples();

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: system(LOCAIS.find((l) => l.id === local)!.label),
      messages: [{ role: "user", content: texto }],
    });
    if (response.stop_reason === "refusal") return simples();
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return simples();
    const out = JSON.parse(text.text) as { sugestoes: Sugestao[]; observacao: string };
    const sugestoes = out.sugestoes.filter((s) => TIPOS.includes(s.tipo)).slice(0, 5);
    if (!sugestoes.length) return simples();
    return Response.json({ sugestoes, observacao: out.observacao ?? "", ia: true });
  } catch (error) {
    // Qualquer falha da IA (chave inválida, limite, internet): segue com o leitor de palavras.
    if (error instanceof Anthropic.APIError) console.warn(`[sugerir] IA falhou (${error.status}); usando palavras-chave.`);
    return simples();
  }
}
