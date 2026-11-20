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

// Alvo: o que a análise procura na imagem (o detector YOLO reconhece estes).
export const ALVOS = ["pessoa", "pessoa_com_cachorro", "cachorro", "gato", "carro", "moto", "bicicleta", "caminhao"] as const;
export type Alvo = (typeof ALVOS)[number];
export const ALVO_LABEL: Record<Alvo, string> = {
  pessoa: "Pessoa",
  pessoa_com_cachorro: "Pessoa com cachorro",
  cachorro: "Cachorro",
  gato: "Gato",
  carro: "Carro",
  moto: "Moto",
  bicicleta: "Bicicleta",
  caminhao: "Caminhão ou ônibus",
};

// Precisão: o quanto a IA precisa ter certeza antes de avisar (o detector segue isso em cada análise).
export const PRECISOES = ["sensivel", "equilibrada", "rigorosa", "maxima"] as const;
export type Precisao = (typeof PRECISOES)[number];
export const PRECISAO_LABEL: Record<Precisao, string> = {
  sensivel: "Sensível",
  equilibrada: "Equilibrada",
  rigorosa: "Rigorosa",
  maxima: "Máxima",
};
export const PRECISAO_DICA: Record<Precisao, string> = {
  sensivel: "Avisa rápido (pessoa por ~2 s). Pode ter alguns alarmes falsos.",
  equilibrada: "Pessoa por ~3 s e confirmada pelo modelo preciso. Bom para o dia a dia.",
  rigorosa: "Pessoa por ~4 s e confirmação forte. Quase nenhum alarme falso; pode demorar um pouco mais.",
  maxima: "Uma IA de visão confere cada caso com o seu objetivo, nas suas palavras. A mais precisa; leva alguns segundos.",
};

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
  /** O que procurar na imagem (padrão: pessoa). */
  alvo?: Alvo;
  /** Precisão do alerta (padrão: equilibrada). */
  precisao?: Precisao;
  /** O que o cliente quer saber, com as palavras dele (aparece no alerta e orienta a IA). */
  objetivo?: string | null;
};

// origem "configuracao" = criada pela tela de configuração inicial (é refeita quando ela é salva de novo).
export type Analise = AnaliseInput & { id: string; criada_em: string; ativa: boolean; origem?: "configuracao" | "chat" };
