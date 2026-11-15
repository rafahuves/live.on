import { getCurrentUser } from "@/lib/supabase/server";
import { streamPrefix } from "@/lib/dvr";

// Vídeo ao vivo de uma câmera em MJPEG, para quem abre o site de fora do computador do go2rtc
// (ex.: celular pelo link público). Só a dona da conta vê as próprias câmeras; o go2rtc continua
// fechado em 127.0.0.1 e nunca fica exposto direto.
const GO2RTC = "http://127.0.0.1:1984";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Faça login de novo.", { status: 401 });

  const src = new URL(request.url).searchParams.get("src") ?? "";
  const prefix = streamPrefix(user.id);
  if (!src.startsWith(prefix) || !/^[a-z0-9_]+$/i.test(src)) {
    return new Response("Câmera não encontrada.", { status: 404 });
  }

  // O gravador manda H.264; o celular recebe MJPEG. Um stream extra no go2rtc faz a conversão (ffmpeg),
  // menor no normal (640) e maior no HD (1280). Criado só na memória do go2rtc, na primeira vez.
  const mjpeg = `${src}_mjpeg`;
  const width = src.endsWith("_hd") ? 1280 : 640;
  let upstream: Response;
  try {
    const q = new URLSearchParams({ name: mjpeg, src: `ffmpeg:${src}#video=mjpeg#width=${width}` });
    await fetch(`${GO2RTC}/api/streams?${q}`, { method: "PUT", signal: AbortSignal.timeout(2000) });
    upstream = await fetch(`${GO2RTC}/api/stream.mjpeg?src=${encodeURIComponent(mjpeg)}`, {
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return new Response("O conversor de vídeo está desligado.", { status: 503 });
  }
  if (!upstream.ok || !upstream.body) return new Response("Câmera sem imagem.", { status: 502 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "multipart/x-mixed-replace; boundary=frame",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
