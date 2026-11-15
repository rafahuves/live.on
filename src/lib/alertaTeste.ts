// Alerta de TESTE no Telegram, com a foto de agora de uma câmera. Usado pelo botão da configuração e pela IA.
import { activeChannels, loadDvr } from "./dvr";
import { fotoDaCamera } from "./fotos";
import { loadPerfil } from "./perfil";
import { enviarAlerta } from "./telegram";

export async function alertaDeTeste(userId: string, ch?: number): Promise<{ enviado: boolean; comFoto: boolean }> {
  const dvr = await loadDvr(userId);
  const canais = dvr ? activeChannels(dvr) : [];
  const perfil = await loadPerfil(userId);
  const preferida = perfil?.cameras.find((c) => c.tipos.length)?.ch;
  const canal = canais.includes(Number(ch)) ? Number(ch) : preferida && canais.includes(preferida) ? preferida : canais[0];
  const nome = perfil?.cameras.find((c) => c.ch === canal)?.nome || (canal ? `Câmera ${canal}` : "");
  const foto = dvr && canal ? await fotoDaCamera(userId, dvr, canal, 5_000) : null; // print do momento
  const hora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const texto = `🔔 Live.On — alerta de TESTE\n📷 ${nome || "sem câmera"}\n🕒 ${hora}\n\nAssim vão chegar os seus alertas, com a foto do momento.`;
  const enviado = await enviarAlerta(userId, texto, foto);
  return { enviado, comFoto: enviado && !!foto };
}
