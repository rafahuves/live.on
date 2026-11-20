// Rota interna: o detector manda UMA imagem + o objetivo do cliente; a IA de visão diz se atende.
// Só aceita chamadas deste computador (não pelo túnel) com a chave local (LIVEON_LOCAL_KEY).
import { timingSafeEqual } from "node:crypto";
import { verificarImagem } from "@/lib/visao";

function chaveOk(recebida: string | null) {
  const certa = process.env.LIVEON_LOCAL_KEY ?? "";
  if (!certa || !recebida || recebida.length !== certa.length) return false;
  return timingSafeEqual(Buffer.from(recebida), Buffer.from(certa));
}

export async function POST(request: Request) {
  if (request.headers.has("cf-connecting-ip") || request.headers.has("cf-ray")) return new Response("Não encontrado.", { status: 404 });
  if (!chaveOk(request.headers.get("x-liveon-key"))) return new Response("Não autorizado.", { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { objetivo?: string; foto?: string };
  if (!body.objetivo || !body.foto) return new Response("Dados inválidos.", { status: 400 });
  const v = await verificarImagem(body.foto, body.objetivo.slice(0, 300));
  if (!v) return Response.json({ erro: "IA de visão indisponível" }, { status: 503 });
  return Response.json(v);
}
