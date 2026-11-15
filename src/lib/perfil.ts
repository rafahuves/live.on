// Perfil de análise da conta (configuração inicial). Fase de teste: arquivo local data/perfil/<id>.json (fora do Git).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DIAS, TIPOS, type AnaliseInput } from "./analises-tipos";
import { LOCAIS, MOSTRA, sugestoesDa, type Perfil } from "./perfil-tipos";

export * from "./perfil-tipos";

function fileFor(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("id de usuário inválido");
  return path.join(process.cwd(), "data", "perfil", `${userId}.json`);
}

export async function loadPerfil(userId: string): Promise<Perfil | null> {
  try {
    return JSON.parse(await readFile(fileFor(userId), "utf8")) as Perfil;
  } catch {
    return null;
  }
}

export async function savePerfil(userId: string, perfil: Perfil) {
  const file = fileFor(userId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ ...perfil, salvo_em: new Date().toISOString() }, null, 2));
}

const hhmm = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

// Confere o que veio do navegador antes de gravar.
export function validarPerfil(x: unknown, canais: number[]): Perfil | string {
  if (!x || typeof x !== "object") return "Dados vazios.";
  const p = x as Record<string, unknown>;
  if (!LOCAIS.some((l) => l.id === p.local)) return "Escolha o tipo de lugar.";
  if (!hhmm(p.inicio) || !hhmm(p.fim)) return "Horário inválido (use HH:MM).";
  if (!Array.isArray(p.dias) || !p.dias.every((d) => DIAS.includes(d as (typeof DIAS)[number]))) return "Dias inválidos.";
  if (typeof p.contato_nome !== "string" || typeof p.contato_whatsapp !== "string") return "Contato inválido.";
  const zap = p.contato_whatsapp.replace(/\D/g, "");
  if (zap && (zap.length < 10 || zap.length > 13)) return "WhatsApp inválido (DDD + número).";
  if (!Array.isArray(p.cameras)) return "Câmeras inválidas.";
  for (const c of p.cameras as Record<string, unknown>[]) {
    if (!canais.includes(c.ch as number)) return "Câmera desconhecida.";
    if (typeof c.nome !== "string" || c.nome.length > 40) return "Nome de câmera inválido.";
    if (!MOSTRA.some((m) => m.id === c.mostra)) return "Escolha o que cada câmera mostra.";
    if (!Array.isArray(c.tipos) || !c.tipos.every((t) => TIPOS.includes(t as (typeof TIPOS)[number]))) return "Análise inválida.";
    if (c.descricao !== undefined && (typeof c.descricao !== "string" || c.descricao.length > 300)) return "Descrição muito longa.";
    if (
      c.sugeridas !== undefined &&
      (!Array.isArray(c.sugeridas) ||
        !(c.sugeridas as Record<string, unknown>[]).every(
          (s) => TIPOS.includes(s.tipo as (typeof TIPOS)[number]) && typeof s.texto === "string" && s.texto.length <= 120,
        ))
    )
      return "Sugestão inválida.";
  }
  return { ...(p as unknown as Perfil), contato_whatsapp: zap };
}

// Transforma o perfil em análises (uma por câmera e por tipo marcado).
export function analisesDoPerfil(p: Perfil): AnaliseInput[] {
  const casa = p.local === "residencia";
  const out: AnaliseInput[] = [];
  for (const c of p.cameras) {
    const nomeCam = c.nome.trim() || `Câmera ${c.ch}`;
    for (const tipo of c.tipos) {
      const texto = sugestoesDa(c, p.local).find((s) => s.tipo === tipo)?.texto ?? tipo;
      const fora = tipo === "pessoa_fora_do_horario";
      out.push({
        nome: `${texto} · ${nomeCam}`,
        cameras: [`cam${c.ch}`],
        tipo,
        area: null,
        // Comércio: alerta do fechamento até a abertura. Residência: no período informado.
        horario_inicio: fora ? (casa ? p.inicio : p.fim) : null,
        horario_fim: fora ? (casa ? p.fim : p.inicio) : null,
        dias: fora ? (p.dias as AnaliseInput["dias"]) : [],
        limite: tipo === "contagem_de_pessoas" ? 5 : null,
        periodo: tipo === "passagens_por_area" ? "dia" : null,
        mensagem_alerta: `${texto} — ${nomeCam}`,
      });
    }
  }
  return out;
}
