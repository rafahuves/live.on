import { getCurrentUser } from "@/lib/supabase/server";
import { alertaDeTeste } from "@/lib/alertaTeste";
import { empresaDaConta } from "@/lib/perfil";
import { removeLink, telegramConfigured, telegramStatus, verifyLink } from "@/lib/telegram";

// Telegram da conta (fase de testes): status, ligar (verificar), alerta de teste com foto, desligar.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  return Response.json(await telegramStatus(user.id, await empresaDaConta(user.id, user.company), user.name));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  if (!telegramConfigured()) return Response.json({ error: "Falta TELEGRAM_BOT_TOKEN no .env.local." }, { status: 500 });
  const { acao, ch } = (await request.json().catch(() => ({}))) as { acao?: string; ch?: number };

  try {
    if (acao === "verificar") {
      const link = await verifyLink(user.id);
      if (!link) return Response.json({ error: "Ainda não achei. Abra o bot pelo botão e toque em \"Começar\" (ou \"Start\")." }, { status: 404 });
      return Response.json({ conectado: true, nome: link.nome });
    }
    if (acao === "desconectar") {
      await removeLink(user.id);
      return Response.json({ conectado: false });
    }
    if (acao === "teste") {
      const r = await alertaDeTeste(user.id, ch);
      if (!r.enviado) return Response.json({ error: "Conecte o Telegram primeiro." }, { status: 400 });
      return Response.json(r);
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch {
    return Response.json({ error: "O Telegram não respondeu. Tente de novo." }, { status: 502 });
  }
}
