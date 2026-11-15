// Foto (1 imagem) de uma câmera — para a configuração e para os alertas.
// Cuidado com o gravador: uma foto de cada vez (fila), sempre pelo escudo (go2rtc → escudo → DVR),
// e guardada na memória por `maxAgeMs` para não reabrir conexão à toa.
import { ensureStreams, streamPrefix, type Dvr } from "./dvr";
import { pausedFor } from "./dvrGuard";
import { shieldBlockedFor } from "./dvrShield";

const GO2RTC = "http://127.0.0.1:1984";

const g = globalThis as unknown as { __liveonFotos?: Map<string, { at: number; jpg: ArrayBuffer }>; __liveonFila?: Promise<unknown> };
const cache = (g.__liveonFotos ??= new Map());

function naFila<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__liveonFila ?? Promise.resolve()).then(fn, fn);
  const pausa = () => new Promise((r) => setTimeout(r, 500));
  g.__liveonFila = run.then(pausa, pausa);
  return run;
}

/** null = sem imagem (gravador descansando, sem sinal ou canal vazio). */
export async function fotoDaCamera(userId: string, dvr: Dvr, ch: number, maxAgeMs = 10 * 60_000): Promise<ArrayBuffer | null> {
  const key = `${userId}:${ch}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.jpg;
  if (pausedFor(userId) > 0 || shieldBlockedFor(dvr.host, dvr.port) > 0) return null;

  return naFila(async () => {
    const again = cache.get(key);
    if (again && Date.now() - again.at < maxAgeMs) return again.jpg;
    await ensureStreams(userId, dvr);
    const res = await fetch(`${GO2RTC}/api/frame.jpeg?src=${streamPrefix(userId)}cam${ch}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
    const buf = res?.ok ? await res.arrayBuffer() : null;
    if (!buf || buf.byteLength <= 1000) return null;
    cache.set(key, { at: Date.now(), jpg: buf });
    return buf;
  });
}
