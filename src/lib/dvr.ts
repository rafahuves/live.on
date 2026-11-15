// Gravador (DVR/NVR) de cada conta. A senha fica SÓ neste computador (o da mesma rede das câmeras),
// criptografada com AES-256-GCM (chave LIVEON_LOCAL_KEY no .env.local). Nunca vai para o Supabase.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureShield, shieldPort } from "./dvrShield";

// active: canais que têm câmera (descobertos testando um canal por vez). Sem a lista = todos.
export type Dvr = { host: string; port: number; user: string; pass: string; channels: number; active?: number[] };

export const activeChannels = (d: Dvr) => d.active ?? Array.from({ length: d.channels }, (_, i) => i + 1);

const DIR = path.join(process.cwd(), "data", "dvr");
const GO2RTC = "http://127.0.0.1:1984";

function key(): Buffer {
  const hex = process.env.LIVEON_LOCAL_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("LIVEON_LOCAL_KEY ausente ou inválida no .env.local");
  return Buffer.from(hex, "hex");
}

function fileFor(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("id de usuário inválido");
  return path.join(DIR, `${userId}.json`);
}

// Prefixo dos nomes no go2rtc, para separar as câmeras de cada conta.
export function streamPrefix(userId: string) {
  return `u${userId.replace(/-/g, "").slice(0, 12)}_`;
}

export async function saveDvr(userId: string, dvr: Dvr) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(dvr), "utf8"), cipher.final()]);
  const payload = { v: 1, iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("hex") };
  await mkdir(DIR, { recursive: true });
  await writeFile(fileFor(userId), JSON.stringify(payload), { mode: 0o600 });
}

export async function loadDvr(userId: string): Promise<Dvr | null> {
  try {
    const p = JSON.parse(await readFile(fileFor(userId), "utf8")) as { iv: string; tag: string; data: string };
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(p.iv, "hex"));
    decipher.setAuthTag(Buffer.from(p.tag, "hex"));
    const plain = Buffer.concat([decipher.update(Buffer.from(p.data, "hex")), decipher.final()]).toString("utf8");
    return JSON.parse(plain) as Dvr;
  } catch {
    return null;
  }
}

export async function deleteDvr(userId: string) {
  await rm(fileFor(userId), { force: true });
  await removeStreams(userId);
}

// Padrão RTSP Intelbras/Dahua: subtype=1 é o stream leve; subtype=0 o principal (HD).
// O endereço aponta para o ESCUDO (127.0.0.1), nunca direto para o gravador: ver src/lib/dvrShield.ts.
function rtspUrl(d: Dvr, ch: number, sub: 0 | 1) {
  const auth = `${encodeURIComponent(d.user)}:${encodeURIComponent(d.pass)}`;
  return `rtsp://${auth}@127.0.0.1:${shieldPort(d.host, d.port)}/cam/realmonitor?channel=${ch}&subtype=${sub}`;
}

export async function go2rtcOnline(): Promise<boolean> {
  try {
    await fetch(`${GO2RTC}/api/streams`, { cache: "no-store", signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

type Streams = Record<string, { producers?: { url?: string }[] | null }>;

async function streams(): Promise<Streams> {
  const res = await fetch(`${GO2RTC}/api/streams`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
  return (await res.json()) as Streams;
}

async function streamNames(): Promise<string[]> {
  return Object.keys(await streams());
}

async function deleteStream(name: string) {
  await fetch(`${GO2RTC}/api/streams?src=${encodeURIComponent(name)}`, { method: "DELETE", signal: AbortSignal.timeout(2000) });
}

// O go2rtc roda sem arquivo de configuração: as câmeras ficam só na memória dele (a senha não vai para disco).
// Por isso o PUT responde 400 ("config file disabled") mesmo tendo adicionado a câmera.
async function putStream(name: string, src: string) {
  const q = new URLSearchParams({ name, src });
  await fetch(`${GO2RTC}/api/streams?${q}`, { method: "PUT", signal: AbortSignal.timeout(2000) });
}

async function removeStreams(userId: string) {
  if (!(await go2rtcOnline())) return;
  const prefix = streamPrefix(userId);
  for (const n of await streamNames()) {
    if (n.startsWith(prefix)) await deleteStream(n);
  }
}

// Garante que as câmeras desta conta estão no go2rtc (ele perde tudo quando reinicia). Devolve os nomes, em ordem.
export async function ensureStreams(userId: string, dvr: Dvr): Promise<string[]> {
  await ensureShield(dvr.host, dvr.port, dvr.channels);
  const prefix = streamPrefix(userId);
  const current = await streams();
  // Só aceita câmera que passa pelo escudo; qualquer uma apontando direto para o gravador é refeita.
  const ok = (name: string, url: string) => current[name]?.producers?.some((p) => p.url === url);
  const names: string[] = [];
  for (const ch of activeChannels(dvr)) {
    const name = `${prefix}cam${ch}`;
    for (const [n, url] of [[name, rtspUrl(dvr, ch, 1)], [`${name}_hd`, rtspUrl(dvr, ch, 0)]]) {
      if (ok(n, url)) continue;
      if (current[n]) await deleteStream(n);
      if (current[`${n}_mjpeg`]) await deleteStream(`${n}_mjpeg`);
      await putStream(n, url);
    }
    names.push(name);
  }
  return names;
}

// Testa usuário/senha/IP pegando uma imagem do canal 1. Com dados errados o go2rtc devolve imagem vazia.
// Pega UMA imagem de um canal (1 conexão, aberta e fechada). Devolve o tamanho em bytes (0 = sem imagem).
async function frameSize(dvr: Dvr, ch: number): Promise<number> {
  const name = `teste_${randomBytes(4).toString("hex")}`;
  await putStream(name, rtspUrl(dvr, ch, 1));
  try {
    const res = await fetch(`${GO2RTC}/api/frame.jpeg?src=${name}`, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    return res.ok ? (await res.arrayBuffer()).byteLength : 0;
  } catch {
    return 0;
  } finally {
    await deleteStream(name).catch(() => {});
  }
}

// Testa usuário/senha/IP pegando uma imagem do canal 1. Com dados errados o go2rtc devolve imagem vazia.
export async function testDvr(dvr: Dvr): Promise<boolean> {
  await ensureShield(dvr.host, dvr.port, dvr.channels);
  return (await frameSize(dvr, 1)) > 1000;
}

// Descobre quais canais têm câmera: testa UM canal por vez, com pausa entre eles (nunca em rajada).
// Canal sem câmera vem como tela preta escrita "VAZIO" (~5 KB); câmera de verdade passa de 10 KB.
// Devolve null se o gravador não respondeu (aí não dá para concluir nada).
export async function detectActive(dvr: Dvr): Promise<number[] | null> {
  await ensureShield(dvr.host, dvr.port, dvr.channels);
  const active: number[] = [];
  let answered = 0;
  for (let ch = 1; ch <= dvr.channels; ch++) {
    const size = await frameSize(dvr, ch);
    if (size > 0) answered++;
    if (size > 10_000) active.push(ch);
    await new Promise((r) => setTimeout(r, 700));
  }
  return answered ? active : null;
}

// Procura gravadores e câmeras na rede (ONVIF, pelo go2rtc). Devolve os IPs encontrados.
export async function discoverDvrs(): Promise<string[]> {
  try {
    const res = await fetch(`${GO2RTC}/api/onvif`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    const ips = new Set<string>();
    for (const m of text.matchAll(/(\d{1,3}(?:\.\d{1,3}){3})/g)) ips.add(m[1]);
    return [...ips];
  } catch {
    return [];
  }
}
