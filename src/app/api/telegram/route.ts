import { getCurrentUser } from "@/lib/supabase/server";
import { activeChannels, loadDvr } from "@/lib/dvr";
import { fotoDaCamera } from "@/lib/fotos";
import { loadPerfil } from "@/lib/perfil";
import { enviarAlerta, removeLink, telegramConfigured, telegramStatus, verifyLink } from "@/lib/telegram";

// Telegram da conta (fase de testes): status, ligar (verificar), alerta de teste com foto, desligar.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  const perfil = await loadPerfil(user.id);
  return Response.json(await telegramStatus(user.id, perfil?.empresa || user.company, user.name));
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
      const dvr = await loadDvr(user.id);
      const canais = dvr ? activeChannels(dvr) : [];
      const canal = canais.includes(Number(ch)) ? Number(ch) : canais[0];
      const perfil = await loadPerfil(user.id);
      const nome = perfil?.cameras.find((c) => c.ch === canal)?.nome || (canal ? `Câmera ${canal}` : "");
      const foto = dvr && canal ? await fotoDaCamera(user.id, dvr, canal, 5_000) : null; // print do momento
      const hora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
      const texto = `🔔 Live.On — alerta de TESTE\n📷 ${nome || "sem câmera"}\n🕒 ${hora}\n\nAssim vão chegar os seus alertas, com a foto do momento.`;
      if (!(await enviarAlerta(user.id, texto, foto))) {
        return Response.json({ error: "Conecte o Telegram primeiro." }, { status: 400 });
      }
      return Response.json({ enviado: true, comFoto: !!foto });
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch {
    return Response.json({ error: "O Telegram não respondeu. Tente de novo." }, { status: 502 });
  }
}
