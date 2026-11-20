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
// exemplo = só para mostrar como fica; aparece na lista com a etiqueta "Exemplo" e o detector ignora.
export type Analise = AnaliseInput & { id: string; criada_em: string; ativa: boolean; origem?: "configuracao" | "chat"; exemplo?: boolean };

// ---- Frase simples do que a análise faz (o cliente entende sem termos técnicos) ----
const ALVO_PLURAL: Record<Alvo, string> = {
  pessoa: "pessoas",
  pessoa_com_cachorro: "pessoas com cachorro",
  cachorro: "cachorros",
  gato: "gatos",
  carro: "carros",
  moto: "motos",
  bicicleta: "bicicletas",
  caminhao: "caminhões ou ônibus",
};
const ALVO_UM: Record<Alvo, string> = {
  pessoa: "alguém",
  pessoa_com_cachorro: "alguém com cachorro",
  cachorro: "um cachorro",
  gato: "um gato",
  carro: "um carro",
  moto: "uma moto",
  bicicleta: "uma bicicleta",
  caminhao: "um caminhão ou ônibus",
};

// "em" + artigo vira contração: "a área da piscina" -> "na área da piscina".
function emArea(area: string) {
  const t = area.trim();
  const m = /^(a|o|as|os)\s+(.*)$/i.exec(t);
  if (!m) return `em ${t}`;
  const c = { a: "na", o: "no", as: "nas", os: "nos" }[m[1].toLowerCase() as "a" | "o" | "as" | "os"];
  return `${c} ${m[2]}`;
}

function quandoVale(a: AnaliseInput) {
  const dias = a.dias?.length && a.dias.length < 7 ? ` (${a.dias.join(", ")})` : "";
  if (a.horario_inicio && a.horario_fim) return `das ${a.horario_inicio} às ${a.horario_fim}${dias}`;
  return `24 horas${dias}`;
}

/** Ex.: "Conta cada pessoa que passa com cachorro, 24 horas. O número sai no relatório." */
export function descreverAnalise(a: AnaliseInput): string {
  const alvo = (a.alvo ?? "pessoa") as Alvo;
  const onde = a.area ? ` ${emArea(a.area)}` : "";
  const q = quandoVale(a);
  switch (a.tipo) {
    case "passagens_por_area":
      return a.limite
        ? `Conta ${ALVO_PLURAL[alvo]} que passam${onde}, ${q}, e avisa se passar de ${a.limite} por ${a.periodo ?? "dia"}.`
        : `Conta ${ALVO_PLURAL[alvo]} que passam${onde}, ${q}. O número sai no relatório.`;
    case "pessoa_fora_do_horario":
      return `Avisa com foto quando aparece ${ALVO_UM[alvo]}${onde}, ${q}.`;
    case "invasao_de_area":
      return `Avisa com foto quando ${ALVO_UM[alvo]} entra${onde || " na área marcada"}, ${q}.`;
    case "permanencia_em_area":
      return `Avisa quando ${ALVO_UM[alvo]} fica parado${onde} por mais de ${a.limite ?? 1} min, ${q}.`;
    case "contagem_de_pessoas":
      return `Avisa quando há mais de ${a.limite ?? 5} ${ALVO_PLURAL[alvo]} ao mesmo tempo${onde}, ${q}.`;
    case "camera_sem_sinal_ou_tampada":
      return "Avisa se a câmera for tampada ou ficar sem imagem.";
  }
}
