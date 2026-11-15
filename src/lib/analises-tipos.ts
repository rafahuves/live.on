// Tipos e rótulos das análises (sem dependências do servidor: podem ir para o navegador).

export const TIPOS = [
  "pessoa_fora_do_horario",
  "contagem_de_pessoas",
  "passagens_por_area",
  "invasao_de_area",
  "permanencia_em_area",
  "camera_sem_sinal_ou_tampada",
] as const;

export const TIPO_LABEL: Record<(typeof TIPOS)[number], string> = {
  pessoa_fora_do_horario: "Pessoa fora do horário",
  contagem_de_pessoas: "Contagem de pessoas",
  passagens_por_area: "Passagens por uma porta ou área",
  invasao_de_area: "Invasão de área marcada",
  permanencia_em_area: "Permanência em área",
  camera_sem_sinal_ou_tampada: "Câmera sem sinal ou tampada",
};

export const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;

export type AnaliseInput = {
  nome: string;
  cameras: string[];
  tipo: (typeof TIPOS)[number];
  area: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  dias: (typeof DIAS)[number][];
  limite: number | null;
  periodo: "hora" | "dia" | null;
  mensagem_alerta: string;
};

export type Analise = AnaliseInput & { id: string; criada_em: string; ativa: boolean };
