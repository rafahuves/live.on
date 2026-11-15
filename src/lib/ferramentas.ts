// Ferramentas do assistente (site e Telegram). Ver src/lib/assistente.ts.
import { DIAS, TIPOS, addAnalise, validarAnalise, type Analise } from "./analises";
import { activeChannels, loadDvr } from "./dvr";
import { fotoDaCamera } from "./fotos";
import type { Ferramenta } from "./assistente";
import { alertaDeTeste } from "./alertaTeste";
import { empresaDaConta, salvarEmpresa } from "./perfil";
import { ajustarNomeDoRobo, nomeDoRobo, registrarCodigo, telegramStatus, telegramTexto } from "./telegram";

export function salvarAnalise(userId: string, aposSalvar: (id: string) => Promise<string>, onSaved?: (a: Analise) => void): Ferramenta {
  return {
    name: "salvar_analise",
    description: "Grava uma análise personalizada para as câmeras do cliente. Só chame depois que o cliente confirmar o resumo da análise.",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["nome", "cameras", "tipo", "area", "horario_inicio", "horario_fim", "dias", "limite", "periodo", "mensagem_alerta"],
      properties: {
        nome: { type: "string", description: "Nome curto da análise, ex.: 'Passagens pela porta do estoque'" },
        cameras: { type: "array", items: { type: "string" }, description: "Câmeras onde roda, ex.: ['cam2']. Lista vazia = todas." },
        tipo: { type: "string", enum: [...TIPOS] },
        area: { type: ["string", "null"], description: "Porta ou área da imagem a observar, em palavras. null se for a imagem toda." },
        horario_inicio: { type: ["string", "null"], description: "HH:MM. null = o dia todo." },
        horario_fim: { type: ["string", "null"], description: "HH:MM. null = o dia todo." },
        dias: { type: "array", items: { type: "string", enum: [...DIAS] }, description: "Dias em que vale. Lista vazia = todos." },
        limite: { type: ["integer", "null"], description: "Quantidade que dispara o alerta (ex.: 5 passagens). null se não houver." },
        periodo: { type: ["string", "null"], enum: ["hora", "dia", null], description: "Janela do limite. null se não houver limite." },
        mensagem_alerta: { type: "string", description: "Texto do alerta que chega ao cliente." },
      },
    },
    async run(args) {
      const a = { ...args, cameras: args.cameras ?? [], dias: args.dias ?? [] };
      const valido = validarAnalise(a);
      if (typeof valido === "string") return `Dados inválidos: ${valido}`;
      const nova = await addAnalise(userId, valido);
      onSaved?.(nova);
      return aposSalvar(nova.id);
    },
  };
}

/** Manda a foto do momento de uma câmera (Telegram). `enviar` entrega a imagem no canal da conversa. */
export function fotoCamera(userId: string, enviar: (jpg: ArrayBuffer, legenda: string) => Promise<void>): Ferramenta {
  return {
    name: "foto_camera",
    description: "Manda para o cliente a foto de agora de uma câmera (ex.: 'me manda a foto do portão'). Uma câmera por chamada.",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["camera"],
      properties: { camera: { type: "string", description: "Código da câmera, ex.: 'cam7'" } },
    },
    async run(args) {
      const dvr = await loadDvr(userId);
      if (!dvr) return "Nenhum gravador conectado.";
      const ch = Number(String(args.camera ?? "").replace(/\D/g, ""));
      if (!activeChannels(dvr).includes(ch)) return `Não existe a câmera ${args.camera}.`;
      const jpg = await fotoDaCamera(userId, dvr, ch, 5_000);
      if (!jpg) return "O gravador não deu imagem agora (pode estar descansando). Tente de novo em instantes.";
      const hora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
      await enviar(jpg, `📷 cam${ch} · ${hora}`);
      return "Foto enviada ao cliente. Não repita a foto; comente em uma frase se quiser.";
    },
  };
}

/** Telegram pelo chat: situação + link do robô, alerta de teste e nome da empresa no robô. */
export function ferramentasTelegram(userId: string, cliente: string | null, doCadastro: string | null, canal: "site" | "telegram"): Ferramenta[] {
  const vazio = { type: "object" as const, additionalProperties: false as const, properties: {}, required: [] as string[] };
  const lista: Ferramenta[] = [
    {
      name: "alerta_teste",
      description: "Manda um alerta de TESTE no Telegram do cliente, com a foto de agora de uma câmera. Use quando ele pedir para testar.",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["camera"],
        properties: { camera: { type: ["string", "null"], description: "Código da câmera (ex.: 'cam7') ou null para a principal" } },
      },
      async run(args) {
        const ch = args.camera ? Number(String(args.camera).replace(/\D/g, "")) : undefined;
        const r = await alertaDeTeste(userId, ch);
        if (!r.enviado) return `Não enviei: o Telegram ainda não está ligado. ${telegramTexto(await telegramStatus(userId, await empresaDaConta(userId, doCadastro), cliente))}`;
        return r.comFoto ? "Alerta de teste enviado no Telegram, com a foto da câmera." : "Alerta de teste enviado, mas sem foto (o gravador não deu imagem agora).";
      },
    },
    {
      name: "nome_da_empresa",
      description: 'Troca o nome da empresa do cliente. O robô do Telegram passa a se chamar "Live.On - <empresa>".',
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["empresa"],
        properties: { empresa: { type: "string", description: "Nome da empresa, ex.: 'VS Transporte'" } },
      },
      async run(args) {
        const empresa = String(args.empresa ?? "").trim().slice(0, 50);
        if (!empresa) return "Nome vazio.";
        await salvarEmpresa(userId, empresa);
        await ajustarNomeDoRobo(empresa);
        await registrarCodigo(userId, empresa, cliente);
        return `Pronto: o robô agora se chama "${nomeDoRobo(empresa)}" (o Telegram pode levar alguns minutos para mostrar o nome novo).`;
      },
    },
  ];
  if (canal === "site") {
    lista.unshift({
      name: "situacao_telegram",
      description: "Confere se o Telegram do cliente já está ligado e devolve o link do robô se não estiver. Use quando ele quiser ligar/configurar o Telegram ou perguntar se já ligou.",
      schema: vazio,
      async run() {
        return telegramTexto(await telegramStatus(userId, await empresaDaConta(userId, doCadastro), cliente));
      },
    });
  }
  return lista;
}
