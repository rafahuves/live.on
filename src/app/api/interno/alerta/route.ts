// Rota interna: o detector (scripts/detector.py, no mesmo computador) manda um alerta com foto e o site entrega
// no Telegram da conta. Só aceita chamadas de 127.0.0.1 com a chave local (LIVEON_LOCAL_KEY).
import { timingSafeEqual } from "node:crypto";
import { enviarAlerta } from "@/lib/telegram";

function chaveOk(recebida: string | null) {
  const certa = process.env.LIVEON_LOCAL_KEY ?? "";
  if (!certa || !recebida || recebida.length !== certa.length) return false;
  return timingSafeEqual(Buffer.from(recebida), Buffer.from(certa));
}

export async function POST(request: Request) {
  const host = new URL(request.url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) || request.headers.has("x-forwarded-for")) {
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
