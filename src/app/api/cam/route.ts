import { getCurrentUser } from "@/lib/supabase/server";
import { loadDvr, streamPrefix } from "@/lib/dvr";
import { acquire, dvrHealthy, liveCount, MAX_LIVE, pausedFor, reportFailure, reportSuccess } from "@/lib/dvrGuard";
import { ensureShield, shieldBlockedFor } from "@/lib/dvrShield";

// Vídeo ao vivo de uma câmera em MJPEG. TODO vídeo passa por aqui, e aqui ficam as travas que
// protegem o gravador do cliente (src/lib/dvrGuard.ts): limite de câmeras ao mesmo tempo, teste leve
// antes de abrir, e pausa automática quando o gravador não responde. Só a dona da conta vê as próprias
// câmeras; o go2rtc continua fechado em 127.0.0.1.
const GO2RTC = "http://127.0.0.1:1984";
const FIRST_FRAME_MS = 12_000;

function fail(status: number, msg: string, retry?: number) {
  const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
  if (retry) headers["Retry-After"] = String(retry);
  return new Response(msg, { status, headers });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail(401, "Faça login de novo.");

  const params = new URL(request.url).searchParams;

  // Situação atual, para a tela explicar por que uma câmera não abriu.
  if (params.has("status")) {
    const d = await loadDvr(user.id);
    const blocked = d ? shieldBlockedFor(d.host, d.port) : 0;
    return Response.json(
      { live: liveCount(user.id), max: MAX_LIVE, pausedFor: Math.max(pausedFor(user.id), blocked) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const src = params.get("src") ?? "";
  if (!src.startsWith(streamPrefix(user.id)) || !/^[a-z0-9_]+$/i.test(src)) return fail(404, "Câmera não encontrada.");

  // Trava 3: gravador em pausa depois de falhar.
  const wait = pausedFor(user.id);
  if (wait > 0) return fail(503, `O gravador não respondeu. Nova tentativa em ${wait} s.`, wait);

  // Trava 1: limite de câmeras ao vivo ao mesmo tempo.
  const release = acquire(user.id, src);
  if (!release) return fail(429, `Limite de ${MAX_LIVE} câmeras ao vivo ao mesmo tempo.`, 5);

  try {
    // Trava 2: teste leve antes de pedir vídeo.
    const dvr = await loadDvr(user.id);
    if (!dvr) {
      release();
      return fail(404, "Nenhum gravador conectado.");
    }
    // Escudo: toda conexão com o gravador passa por ele (src/lib/dvrShield.ts).
    const shield = await ensureShield(dvr.host, dvr.port);
    const blocked = shieldBlockedFor(dvr.host, dvr.port);
    if (blocked > 0) {
      release();
      return fail(503, `O gravador não respondeu. Nova tentativa em ${blocked} s.`, blocked);
    }
    if (!(await dvrHealthy(user.id, "127.0.0.1", shield))) {
      release();
      return fail(503, "O gravador não respondeu. O Live.On vai esperar antes de tentar de novo.", pausedFor(user.id));
    }

    // O gravador manda H.264; o navegador recebe MJPEG (conversão no go2rtc com ffmpeg).
    const mjpeg = `${src}_mjpeg`;
    const width = src.endsWith("_hd") ? 1280 : 640;
    const q = new URLSearchParams({ name: mjpeg, src: `ffmpeg:${src}#video=mjpeg#width=${width}` });
    await fetch(`${GO2RTC}/api/streams?${q}`, { method: "PUT", signal: AbortSignal.timeout(2000) });

    const ctrl = new AbortController();
    request.signal.addEventListener("abort", () => ctrl.abort());
    const upstream = await fetch(`${GO2RTC}/api/stream.mjpeg?src=${encodeURIComponent(mjpeg)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!upstream.ok || !upstream.body) {
      ctrl.abort();
      release();
      reportFailure(user.id);
      return fail(502, "Câmera sem imagem.");
    }

    // Espera a primeira imagem. Sem imagem a tempo = falha, e o Live.On entra em pausa.
    const reader = upstream.body.getReader();
    const timer = setTimeout(() => ctrl.abort(), FIRST_FRAME_MS);
    let first: ReadableStreamReadResult<Uint8Array>;
    try {
      first = await reader.read();
    } catch {
      first = { done: true, value: undefined };
    } finally {
      clearTimeout(timer);
    }
    if (first.done) {
      ctrl.abort();
      release();
      reportFailure(user.id);
      return fail(502, "Câmera sem imagem.");
    }
    reportSuccess(user.id);

    // Repassa o vídeo e libera a vaga quando a pessoa fecha a câmera ou a conexão cai.
    request.signal.addEventListener("abort", release);
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(first.value);
      },
      async pull(c) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            release();
            c.close();
          } else c.enqueue(value);
        } catch (e) {
          release();
          c.error(e);
        }
      },
      cancel() {
        release();
        ctrl.abort();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "multipart/x-mixed-replace; boundary=frame",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    release();
    return fail(503, "O conversor de vídeo está desligado.");
  }
}
