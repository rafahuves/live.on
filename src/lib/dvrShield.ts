// ESCUDO DO GRAVADOR — a última barreira. Nada no Live.On fala direto com o DVR do cliente:
// o go2rtc (vídeo, HD, teste de conexão, a futura análise em Python) conecta em 127.0.0.1:<porta do escudo>,
// e só o escudo abre conexão com o gravador. Aqui valem limites que nenhum outro código consegue furar:
//  - no máximo (nº de câmeras + 2) conexões abertas ao mesmo tempo com o gravador (o resto é recusado);
//  - RITMO: nunca duas conexões novas com menos de GAP_MS entre elas. Uma rajada vira uma fila calma;
//  - no máximo (2 × câmeras + 4) conexões novas por minuto (impede tentativas sem parar);
//  - se o gravador não responde, o escudo BLOQUEIA tudo por um tempo que cresce (30 s → 10 min)
//    e derruba as conexões que estavam abertas, para o gravador descansar.
// Motivo: em 2026-11-15 um DVR Intelbras travou depois de dezenas de conexões no mesmo segundo.
import net from "node:net";
import { createHash } from "node:crypto";

const GAP_MS = 300; // ritmo mínimo entre conexões novas
const MAX_QUEUE_MS = 3_000; // fila maior que isso = recusa (quem pediu tenta mais tarde)
const FIRST_BYTE_MS = 6_000; // gravador tem 6 s para responder ao primeiro pedido
const CONNECT_MS = 5_000;
const BLOQUEIOS_MS = [30_000, 60_000, 120_000, 300_000, 600_000];

type Shield = {
  port: number;
  maxConns: number;
  maxNewPerMin: number;
  nextSlot: number;
  pending: number;
  open: Set<net.Socket>;
  recent: number[];
  failures: number;
  blockedUntil: number;
  ready: Promise<number>;
};

const g = globalThis as unknown as { __liveonShields?: Map<string, Shield> };
const shields = (g.__liveonShields ??= new Map());

/** Porta fixa do escudo para cada gravador (sobrevive a reinícios do site). */
export function shieldPort(host: string, port: number) {
  const h = createHash("sha256").update(`${host}:${port}`).digest().readUInt32BE(0);
  return 20000 + (h % 20000);
}

function log(msg: string) {
  console.warn(`[escudo do gravador] ${msg}`);
}

/** Segundos de bloqueio que faltam para este gravador (0 = liberado). */
export function shieldBlockedFor(host: string, port: number) {
  const s = shields.get(`${host}:${port}`);
  return s ? Math.max(0, Math.ceil((s.blockedUntil - Date.now()) / 1000)) : 0;
}

export const limitsFor = (channels: number) => ({
  maxConns: Math.min(66, Math.max(1, channels) + 2),
  maxNewPerMin: Math.min(132, Math.max(1, channels) * 2 + 4),
});

/** Liga o escudo deste gravador (uma vez por processo). Devolve a porta local. */
export function ensureShield(host: string, port: number, channels: number): Promise<number> {
  const key = `${host}:${port}`;
  const existing = shields.get(key);
  if (existing) {
    Object.assign(existing, limitsFor(channels));
    return existing.ready;
  }

  const s: Shield = {
    port: shieldPort(host, port),
    ...limitsFor(channels),
    nextSlot: 0,
    pending: 0,
    open: new Set(),
    recent: [],
    failures: 0,
    blockedUntil: 0,
    ready: Promise.resolve(0),
  };

  const fail = (why: string) => {
    s.failures++;
    if (s.failures >= 2) {
      const ms = BLOQUEIOS_MS[Math.min(s.failures - 2, BLOQUEIOS_MS.length - 1)];
      s.blockedUntil = Date.now() + ms;
      log(`${key} não respondeu (${why}). Bloqueado por ${ms / 1000} s; derrubando ${s.open.size} conexões.`);
      for (const c of s.open) c.destroy();
    }
  };

  const server = net.createServer((client) => {
    client.on("error", () => client.destroy());
    const now = Date.now();
    s.recent = s.recent.filter((t) => now - t < 60_000);
    if (now < s.blockedUntil) return client.destroy();
    if (s.open.size + s.pending >= s.maxConns) {
      log(`${key}: limite de ${s.maxConns} conexões ao mesmo tempo. Recusada.`);
      return client.destroy();
    }
    if (s.recent.length >= s.maxNewPerMin) {
      log(`${key}: limite de ${s.maxNewPerMin} conexões novas por minuto. Recusada.`);
      return client.destroy();
    }
    const delay = Math.max(0, s.nextSlot - now);
    if (delay > MAX_QUEUE_MS) {
      log(`${key}: fila cheia (ritmo de 1 conexão a cada ${GAP_MS} ms). Recusada.`);
      return client.destroy();
    }
    s.nextSlot = now + delay + GAP_MS;
    s.recent.push(now);
    s.pending++;
    client.pause();
    let gone = false;
    client.once("close", () => (gone = true));
    setTimeout(() => {
      s.pending--;
      if (gone || Date.now() < s.blockedUntil) return client.destroy();
      bridge(client);
    }, delay);
  });

  const bridge = (client: net.Socket) => {
    const dvr = net.connect({ host, port });
    s.open.add(dvr);
    let answered = false;
    let waiting: NodeJS.Timeout | null = null;
    const closeBoth = () => {
      if (waiting) clearTimeout(waiting);
      client.destroy();
      dvr.destroy();
    };

    dvr.setTimeout(CONNECT_MS, () => {
      if (!dvr.connecting) return;
      fail("sem conexão");
      closeBoth();
    });
    dvr.on("connect", () => dvr.setTimeout(0));
    client.on("data", () => {
      if (answered || waiting) return;
      waiting = setTimeout(() => {
        fail("sem resposta");
        closeBoth();
      }, FIRST_BYTE_MS);
    });
    dvr.once("data", () => {
      answered = true;
      if (waiting) clearTimeout(waiting);
      s.failures = 0;
    });
    dvr.on("error", () => {
      if (!answered) fail("erro de rede");
      closeBoth();
    });
    client.on("error", closeBoth);
    dvr.on("close", () => {
      s.open.delete(dvr);
      client.destroy();
    });
    client.on("close", () => dvr.destroy());
    client.pipe(dvr);
    dvr.pipe(client);
    client.resume();
  };

  s.ready = new Promise<number>((resolve, reject) => {
    server.once("error", (e) => {
      shields.delete(key);
      reject(e);
    });
    server.listen(s.port, "127.0.0.1", () => resolve(s.port));
  });
  shields.set(key, s);
  return s.ready;
}
