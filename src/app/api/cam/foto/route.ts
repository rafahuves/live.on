import { getCurrentUser } from "@/lib/supabase/server";
import { activeChannels, ensureStreams, loadDvr, streamPrefix } from "@/lib/dvr";
import { pausedFor } from "@/lib/dvrGuard";
import { shieldBlockedFor } from "@/lib/dvrShield";

// Foto (1 imagem) de uma câmera, para a tela de configuração.
// Cuidado com o gravador: as fotos são pedidas UMA de cada vez (fila), passam pelo escudo e ficam guardadas
// 10 min na memória — abrir a tela de novo não reabre conexão.
const GO2RTC = "http://127.0.0.1:1984";
const CACHE_MS = 10 * 60_000;

const g = globalThis as unknown as { __liveonFotos?: Map<string, { at: number; jpg: ArrayBuffer }>; __liveonFila?: Promise<unknown> };
const cache = (g.__liveonFotos ??= new Map());

function naFila<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__liveonFila ?? Promise.resolve()).then(fn, fn);
  g.__liveonFila = run.then(
    () => new Promise((r) => setTimeout(r, 500)),
    () => new Promise((r) => setTimeout(r, 500)),
  );
  return run;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Faça login de novo.", { status: 401 });
  const dvr = await loadDvr(user.id);
  if (!dvr) return new Response("Nenhum gravador conectado.", { status: 404 });

  const ch = Number(new URL(request.url).searchParams.get("ch"));
  if (!activeChannels(dvr).includes(ch)) return new Response("Câmera não encontrada.", { status: 404 });

  const key = `${user.id}:${ch}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return jpeg(hit.jpg);

  if (pausedFor(user.id) > 0 || shieldBlockedFor(dvr.host, dvr.port) > 0) {
    return new Response("O gravador está descansando.", { status: 503 });
  }

  const jpg = await naFila(async () => {
    const again = cache.get(key);
    if (again && Date.now() - again.at < CACHE_MS) return again.jpg;
    await ensureStreams(user.id, dvr);
    const res = await fetch(`${GO2RTC}/api/frame.jpeg?src=${streamPrefix(user.id)}cam${ch}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
    const buf = res?.ok ? await res.arrayBuffer() : null;
    if (buf && buf.byteLength > 1000) cache.set(key, { at: Date.now(), jpg: buf });
    return buf && buf.byteLength > 1000 ? buf : null;
  });
  return jpg ? jpeg(jpg) : new Response("Sem imagem.", { status: 502 });
}

function jpeg(buf: ArrayBuffer) {
  return new Response(buf, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=600" } });
}
