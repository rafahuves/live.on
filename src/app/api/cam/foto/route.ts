import { getCurrentUser } from "@/lib/supabase/server";
import { activeChannels, loadDvr } from "@/lib/dvr";
import { fotoDaCamera } from "@/lib/fotos";

// Foto (1 imagem) de uma câmera, para a tela de configuração. Ver src/lib/fotos.ts (fila, escudo, cache).
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Faça login de novo.", { status: 401 });
  const dvr = await loadDvr(user.id);
  if (!dvr) return new Response("Nenhum gravador conectado.", { status: 404 });

  const ch = Number(new URL(request.url).searchParams.get("ch"));
  if (!activeChannels(dvr).includes(ch)) return new Response("Câmera não encontrada.", { status: 404 });

  const jpg = await fotoDaCamera(user.id, dvr, ch);
  if (!jpg) return new Response("Sem imagem agora.", { status: 503 });
  return new Response(jpg, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=600" } });
}
