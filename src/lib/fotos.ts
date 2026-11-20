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

/** Por que não veio imagem? Testa se o gravador responde (1 conexão rápida, só abre e fecha). */
export async function motivoSemImagem(dvr: Dvr): Promise<string> {
  const net = await import("node:net");
  const alcanca = await new Promise<boolean>((ok) => {
    const s = net.connect({ host: dvr.host, port: dvr.port });
    const fim = (v: boolean) => {
      s.destroy();
      ok(v);
    };
    s.setTimeout(3000, () => fim(false));
    s.on("connect", () => fim(true));
    s.on("error", () => fim(false));
  });
  if (!alcanca) {
    return "Não consigo falar com o gravador agora. O computador onde o Live.On roda está fora da rede das câmeras (por exemplo, o Mac saiu de casa) ou o gravador está desligado. Assim que ele voltar para a rede do gravador, as fotos e os alertas voltam sozinhos.";
  }
  return "O gravador respondeu, mas não mandou a imagem desta câmera agora (ela pode estar sem sinal). Tente de novo em 1 minuto.";
}
