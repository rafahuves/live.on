// Proteção do gravador do cliente. REGRA: o Live.On nunca pode sobrecarregar um DVR.
// Todo vídeo ao vivo passa por aqui (rota /api/cam), e aqui valem três travas por conta:
//  1. Limite de câmeras ao mesmo tempo (as câmeras do gravador + 1 HD). Cada câmera = 1 conexão no gravador.
//  2. Antes de abrir vídeo, um teste leve (RTSP OPTIONS, 1 conexão) confirma que o gravador responde.
//  3. Se o gravador não responder, o Live.On PARA de tentar por um tempo que cresce a cada falha
//     (30 s, 1 min, 2 min, 5 min, 10 min). Nada de tentar de novo sem parar.
// O estado fica na memória do servidor do site (um processo só, no computador da rede do gravador).
import net from "node:net";

const PAUSAS_MS = [30_000, 60_000, 120_000, 300_000, 600_000];
const PROBE_OK_MS = 30_000; // um teste bom vale por 30 s
const PROBE_TIMEOUT_MS = 4_000;

type State = {
  live: Map<string, number>; // stream → conexões abertas por este site
  failures: number;
  pausedUntil: number;
  probedOkAt: number;
  probing: Promise<boolean> | null;
};

const g = globalThis as unknown as { __liveonGuard?: Map<string, State> };
const states = (g.__liveonGuard ??= new Map());

function stateOf(userId: string): State {
  let s = states.get(userId);
  if (!s) {
    s = { live: new Map(), failures: 0, pausedUntil: 0, probedOkAt: 0, probing: null };
    states.set(userId, s);
  }
  return s;
}

export function liveCount(userId: string) {
  let n = 0;
  for (const v of stateOf(userId).live.values()) n += v;
  return n;
}

/** Segundos que faltam para voltar a tentar (0 = pode tentar). */
export function pausedFor(userId: string) {
  return Math.max(0, Math.ceil((stateOf(userId).pausedUntil - Date.now()) / 1000));
}

export function reportFailure(userId: string) {
  const s = stateOf(userId);
  s.pausedUntil = Date.now() + PAUSAS_MS[Math.min(s.failures, PAUSAS_MS.length - 1)];
  s.failures++;
  s.probedOkAt = 0;
}

export function reportSuccess(userId: string) {
  const s = stateOf(userId);
  s.failures = 0;
  s.pausedUntil = 0;
  s.probedOkAt = Date.now();
}

// Teste leve: abre 1 conexão, manda OPTIONS e espera "RTSP/1.0". Não pede vídeo.
function rtspAnswers(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    let done = false;
    const end = (ok: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(PROBE_TIMEOUT_MS, () => end(false));
    sock.on("error", () => end(false));
    sock.on("connect", () => sock.write(`OPTIONS rtsp://${host}:${port}/ RTSP/1.0\r\nCSeq: 1\r\n\r\n`));
    sock.on("data", (d) => end(d.toString("latin1").startsWith("RTSP/1.0")));
  });
}

/** O gravador está respondendo? Reaproveita teste recente e nunca roda dois testes juntos. */
export async function dvrHealthy(userId: string, host: string, port: number): Promise<boolean> {
  const s = stateOf(userId);
  if (Date.now() - s.probedOkAt < PROBE_OK_MS) return true;
  s.probing ??= rtspAnswers(host, port).finally(() => (s.probing = null));
  const ok = await s.probing;
  if (ok) s.probedOkAt = Date.now();
  else reportFailure(userId);
  return ok;
}

/** Reserva uma vaga de câmera ao vivo. Devolve a função que libera (ou null se está no limite). */
export function acquire(userId: string, stream: string, max: number): (() => void) | null {
  const s = stateOf(userId);
  if (liveCount(userId) >= max) return null;
  s.live.set(stream, (s.live.get(stream) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const n = (s.live.get(stream) ?? 1) - 1;
    if (n <= 0) s.live.delete(stream);
    else s.live.set(stream, n);
  };
}
