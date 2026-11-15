// Configuração inicial ("o que analisar"): tipos e sugestões. Sem dependências do servidor (vai para o navegador).
import type { TIPOS } from "./analises-tipos";

type Tipo = (typeof TIPOS)[number];

export const LOCAIS = [
  { id: "comercio", label: "Comércio", desc: "Loja, mercado, restaurante" },
  { id: "escritorio", label: "Escritório", desc: "Empresa, consultório" },
  { id: "condominio", label: "Condomínio", desc: "Portaria, áreas comuns" },
  { id: "residencia", label: "Residência", desc: "Casa, sítio" },
  { id: "logistica", label: "Logística", desc: "Galpão, depósito, pátio" },
] as const;
export type Local = (typeof LOCAIS)[number]["id"];

export const MOSTRA = [
  { id: "portao", label: "Portão / entrada" },
  { id: "caixa", label: "Caixa / balcão" },
  { id: "estoque", label: "Estoque / depósito" },
  { id: "garagem", label: "Garagem / estacionamento" },
  { id: "interna", label: "Área interna" },
  { id: "externa", label: "Área externa / quintal" },
  { id: "rua", label: "Rua / calçada" },
  { id: "outro", label: "Outro" },
  { id: "nada", label: "Não analisar" },
] as const;
export type Mostra = (typeof MOSTRA)[number]["id"];

export type Sugestao = { tipo: Tipo; texto: string };

// O que faz sentido analisar em cada tipo de imagem. Fase de teste: tudo liberado.
export function sugestoes(mostra: Mostra, local: Local): Sugestao[] {
  const casa = local === "residencia";
  const fora: Sugestao = {
    tipo: "pessoa_fora_do_horario",
    texto: casa ? "Pessoa no horário em que ninguém deve circular" : "Pessoa fora do horário de funcionamento",
  };
  const tampada: Sugestao = { tipo: "camera_sem_sinal_ou_tampada", texto: "Câmera sem sinal ou tampada" };
  const por: Record<Mostra, Sugestao[]> = {
    portao: [fora, { tipo: "passagens_por_area", texto: "Contar quantas vezes passam pelo portão" }],
    caixa: [fora, { tipo: "contagem_de_pessoas", texto: "Fila: muita gente esperando" }, { tipo: "permanencia_em_area", texto: "Pessoa parada muito tempo no caixa" }],
    estoque: [fora, { tipo: "permanencia_em_area", texto: "Pessoa parada muito tempo no estoque" }],
    garagem: [fora, { tipo: "invasao_de_area", texto: "Alguém entrando na área da garagem" }],
    interna: [fora, { tipo: "contagem_de_pessoas", texto: "Contar pessoas no ambiente" }],
    externa: [fora, { tipo: "invasao_de_area", texto: "Alguém entrando na área marcada" }],
    rua: [{ tipo: "permanencia_em_area", texto: "Pessoa parada muito tempo em frente" }],
    outro: [fora],
    nada: [],
  };
  return [...por[mostra], tampada];
}

// Sem IA (ou se ela falhar): lê palavras do texto do cliente e escolhe as análises mais próximas.
export function sugestoesPorTexto(texto: string, local: Local): Sugestao[] {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const tem = (...ps: string[]) => ps.some((p) => t.includes(p));
  const out: Sugestao[] = [];
  const add = (tipo: Tipo, txt: string) => !out.some((s) => s.tipo === tipo) && out.push({ tipo, texto: txt });
  if (tem("porta", "portao", "entrada", "saida", "corredor", "passag", "catraca", "doca"))
    add("passagens_por_area", "Contar quantas vezes passam por ali");
  if (tem("fila", "aglomer", "lotad", "quantas pessoas", "muita gente", "movimento"))
    add("contagem_de_pessoas", "Muita gente ao mesmo tempo");
  if (tem("parad", "demora", "permanec", "fica muito", "vadi", "ronda"))
    add("permanencia_em_area", "Pessoa parada muito tempo");
  if (tem("cerca", "muro", "telhado", "proibid", "restrit", "maquina", "piscina", "patio", "area marcada", "invas"))
    add("invasao_de_area", "Alguém entrando na área marcada");
  if (!tem("dia todo", "24h", "sempre aberto")) add("pessoa_fora_do_horario", sugestoes("outro", local)[0].texto);
  add("camera_sem_sinal_ou_tampada", "Câmera sem sinal ou tampada");
  return out;
}

export type PerfilCamera = {
  ch: number;
  nome: string;
  mostra: Mostra;
  tipos: Tipo[];
  descricao?: string; // quando "Outro": o que o cliente escreveu
  sugeridas?: Sugestao[]; // quando "Outro": o que a IA (ou o leitor de palavras) sugeriu
};

/** Análises que aparecem para a câmera: as da IA quando é "Outro" e já há sugestão; senão, as prontas. */
export const sugestoesDa = (c: PerfilCamera, local: Local): Sugestao[] =>
  c.mostra === "outro" && c.sugeridas?.length ? c.sugeridas : sugestoes(c.mostra, local);

export type Perfil = {
  local: Local;
  cameras: PerfilCamera[];
  // Comércio etc.: horário de funcionamento (alerta fora dele). Residência: período em que ninguém deve circular.
  inicio: string;
  fim: string;
  dias: string[];
  contato_nome: string;
  contato_whatsapp: string;
  salvo_em?: string;
};
