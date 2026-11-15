// Rota interna: o detector (scripts/detector.py, no mesmo computador) manda um alerta com foto e o site entrega
// no Telegram da conta. Só aceita chamadas deste computador (não pelo túnel) com a chave local (LIVEON_LOCAL_KEY).
import { timingSafeEqual } from "node:crypto";
import { enviarAlerta } from "@/lib/telegram";

function chaveOk(recebida: string | null) {
  const certa = process.env.LIVEON_LOCAL_KEY ?? "";
  if (!certa || !recebida || recebida.length !== certa.length) return false;
  return timingSafeEqual(Buffer.from(recebida), Buffer.from(certa));
}

export async function POST(request: Request) {
  // Pedido vindo de fora (pelo túnel da Cloudflare) traz estes cabeçalhos: recusa. A proteção principal é a chave.
  if (request.headers.has("cf-connecting-ip") || request.headers.has("cf-ray")) {
    return new Response("Não encontrado.", { status: 404 });
  }
  if (!chaveOk(request.headers.get("x-liveon-key"))) return new Response("Não autorizado.", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { userId?: string; texto?: string; foto?: string };
  if (!body.userId || !/^[0-9a-f-]{36}$/i.test(body.userId) || !body.texto) return new Response("Dados inválidos.", { status: 400 });
  const foto = body.foto ? Buffer.from(body.foto, "base64") : null;
  const jpg = foto ? foto.buffer.slice(foto.byteOffset, foto.byteOffset + foto.byteLength) : null;
  try {
    const enviado = await enviarAlerta(body.userId, body.texto.slice(0, 1000), jpg as ArrayBuffer | null);
    return Response.json({ enviado });
  } catch {
    return Response.json({ enviado: false, erro: "Telegram não respondeu." }, { status: 502 });
  }
}
