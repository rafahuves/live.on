// Ferramentas do assistente (site e Telegram). Ver src/lib/assistente.ts.
import { ALVOS, DIAS, TIPOS, TIPO_LABEL, addAnalise, listAnalises, removeAnalises, updateAnalise, validarAnalise, type Analise, type AnaliseInput } from "./analises";
import { activeChannels, loadDvr } from "./dvr";
import { fotoDaCamera } from "./fotos";
import type { Ferramenta } from "./assistente";
import { alertaDeTeste } from "./alertaTeste";
import { montarRelatorio, type Periodo } from "./relatorios";
import { lerConfigRelatorio, salvarConfigRelatorio } from "./relatorioDiario";
import { loadPerfil, savePerfil, type Perfil } from "./perfil";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { empresaDaConta, salvarEmpresa } from "./perfil";
import { ajustarNomeDoRobo, nomeDoRobo, registrarCodigo, telegramStatus, telegramTexto } from "./telegram";

export function salvarAnalise(userId: string, aposSalvar: (id: string) => Promise<string>, onSaved?: (a: Analise) => void): Ferramenta {
  return {
    name: "salvar_analise",
    description: "Grava uma análise personalizada para as câmeras do cliente. Só chame depois que o cliente confirmar o resumo da análise.",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["nome", "cameras", "tipo", "area", "horario_inicio", "horario_fim", "dias", "limite", "periodo", "mensagem_alerta", "objetivo", "alvo"],
      properties: {
        nome: { type: "string", description: "Nome curto da análise, ex.: 'Passagens pela porta do estoque'" },
        objetivo: { type: ["string", "null"], description: "O que o cliente quer saber, com as palavras dele (ex.: 'saber se mexem nos pallets à noite'). É a pergunta que a IA de visão confere em cada caso." },
        alvo: { type: "string", enum: [...ALVOS], description: "O gatilho que o detector procura: pessoa, pessoa_com_cachorro, cachorro, gato, carro, moto, bicicleta, caminhao." },
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

/** Relatório real do detector (passagens por alvo e câmera, alertas). Texto em src/lib/relatorios.ts. */
export function relatorio(userId: string): Ferramenta {
  return {
    name: "relatorio",
    description:
      "Relatório real do detector: quantas passagens (de pessoas, pessoas com cachorro, veículos...) e alertas houve, por câmera e hora. Use para 'quantas pessoas passaram com cachorro hoje na câmera 5'. Mande o texto ao cliente como veio.",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["periodo", "camera", "alvo"],
      properties: {
        periodo: { type: "string", enum: ["hoje", "ontem", "7dias"] },
        camera: { type: ["string", "null"], description: "Código da câmera (ex.: 'cam5') ou null para todas" },
        alvo: { type: ["string", "null"], enum: [...ALVOS, null], description: "O que contar, ou null para tudo" },
      },
    },
    async run(args) {
      const cam = args.camera ? `cam${String(args.camera).replace(/\D/g, "")}` : null;
      return montarRelatorio(userId, (args.periodo as Periodo) ?? "hoje", cam, (args.alvo as string | null) ?? null);
    },
  };
}

/** Gerenciar as análises (listar, editar, ligar/desligar, apagar). O robô do Telegram tem autonomia total. */
export function gerenciarAnalises(userId: string): Ferramenta[] {
  const opc = (t: string, d: string) => ({ type: [t, "null"], description: d });
  return [
    {
      name: "listar_analises",
      description: "Lista TODAS as análises da conta com id, câmeras, tipo, horário, limite e se está ligada. Use antes de editar ou apagar.",
      schema: { type: "object", additionalProperties: false, properties: {}, required: [] },
      async run() {
        const lista = await listAnalises(userId);
        if (!lista.length) return "Nenhuma análise.";
        return lista
          .map((a) =>
            [
              `id=${a.id}`,
              a.ativa ? "LIGADA" : "DESLIGADA",
              `"${a.nome}"`,
              TIPO_LABEL[a.tipo],
              a.cameras.length ? a.cameras.join(",") : "todas as câmeras",
              a.area ? `área: ${a.area}` : "",
              a.horario_inicio && a.horario_fim ? `${a.horario_inicio}-${a.horario_fim}` : "o dia todo",
              a.dias.length ? a.dias.join(",") : "todos os dias",
              a.limite ? `limite ${a.limite}${a.periodo ? "/" + a.periodo : ""}` : "",
              `alvo: ${a.alvo ?? "pessoa"}`,
              a.objetivo ? `objetivo: "${a.objetivo}"` : "",
              `alerta: "${a.mensagem_alerta}"`,
            ]
              .filter(Boolean)
              .join(" | "),
          )
          .join("\n");
      },
    },
    {
      name: "editar_analise",
      description:
        "Muda uma análise existente. Em cada campo: null = não mexer. Para voltar ao 'dia todo' mande horario_inicio e horario_fim como \"\"; para a imagem toda, area \"\"; para tirar o limite, limite 0. ativa=false desliga sem apagar.",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["id", "nome", "cameras", "tipo", "area", "horario_inicio", "horario_fim", "dias", "limite", "periodo", "mensagem_alerta", "ativa", "objetivo", "alvo"],
        properties: {
          id: { type: "string", description: "id da análise (veja listar_analises)" },
          nome: opc("string", "novo nome"),
          cameras: { type: ["array", "null"], items: { type: "string" }, description: "ex.: ['cam13']; [] = todas" },
          tipo: { type: ["string", "null"], enum: [...TIPOS, null] },
          area: opc("string", "porta ou área; \"\" = imagem toda"),
          horario_inicio: opc("string", "HH:MM; \"\" = dia todo"),
          horario_fim: opc("string", "HH:MM; \"\" = dia todo"),
          dias: { type: ["array", "null"], items: { type: "string", enum: [...DIAS] }, description: "[] = todos os dias" },
          limite: opc("integer", "quantidade que dispara; 0 = sem limite"),
          periodo: { type: ["string", "null"], enum: ["hora", "dia", null] },
          mensagem_alerta: opc("string", "texto do alerta"),
          ativa: opc("boolean", "true liga, false desliga"),
          alvo: { type: ["string", "null"], enum: [...ALVOS, null], description: "gatilho do detector" },
          objetivo: opc("string", "o que o cliente quer saber; \"\" = apagar o objetivo"),
        },
      },
      async run(args) {
        const patch: Partial<AnaliseInput> & { ativa?: boolean } = {};
        for (const k of ["nome", "cameras", "tipo", "dias", "periodo", "mensagem_alerta", "ativa", "alvo"] as const) {
          if (args[k] !== null && args[k] !== undefined) (patch as Record<string, unknown>)[k] = args[k];
        }
        for (const k of ["area", "horario_inicio", "horario_fim", "objetivo"] as const) {
          if (args[k] !== null && args[k] !== undefined) patch[k] = args[k] === "" ? null : String(args[k]);
        }
        if (args.limite !== null && args.limite !== undefined) {
          patch.limite = Number(args.limite) > 0 ? Number(args.limite) : null;
          if (!patch.limite) patch.periodo = null;
        }
        const r = await updateAnalise(userId, String(args.id ?? ""), patch);
        return typeof r === "string" ? `Não mudei: ${r}.` : `Análise "${r.nome}" atualizada (${r.ativa ? "ligada" : "desligada"}).`;
      },
    },
    {
      name: "apagar_analises",
      description: "Apaga de vez uma ou mais análises (ex.: as repetidas). Para só pausar, prefira editar_analise com ativa=false.",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ids"],
        properties: { ids: { type: "array", items: { type: "string" }, description: "ids das análises a apagar" } },
      },
      async run(args) {
        const ids = Array.isArray(args.ids) ? args.ids.map(String) : [];
        const n = await removeAnalises(userId, ids);
        return n ? `Apaguei ${n} análise${n > 1 ? "s" : ""}.` : "Nenhuma análise encontrada com esses ids.";
      },
    },
  ];
}

/** Configurações da conta pelo chat/robô: nomes das câmeras, relatório diário e pausa dos alertas. */
export function configuracoes(userId: string): Ferramenta[] {
  return [
    {
      name: "nomear_camera",
      description: "Dá ou troca o nome de uma câmera (ex.: cam5 = 'Calçada'). O nome aparece nos alertas, relatórios e no painel.",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["camera", "nome"],
        properties: { camera: { type: "string", description: "ex.: 'cam5'" }, nome: { type: "string", description: "ex.: 'Calçada'" } },
      },
      async run(args) {
        const ch = Number(String(args.camera ?? "").replace(/\D/g, ""));
        const nome = String(args.nome ?? "").trim().slice(0, 40);
        const dvr = await loadDvr(userId);
        const canais = dvr ? activeChannels(dvr) : [];
        if (!canais.includes(ch)) return `Não existe a câmera cam${ch}.`;
        if (!nome) return "Nome vazio.";
        const atual = await loadPerfil(userId);
        const perfil: Perfil = atual ?? {
          local: "comercio",
          cameras: canais.map((c) => ({ ch: c, nome: `Câmera ${c}`, mostra: "outro", tipos: [] })),
          inicio: "08:00",
          fim: "18:00",
          dias: ["seg", "ter", "qua", "qui", "sex", "sab"],
          dia_todo: true,
          contato_nome: "",
          contato_whatsapp: "",
        };
        const cams = perfil.cameras.some((c) => c.ch === ch)
          ? perfil.cameras.map((c) => (c.ch === ch ? { ...c, nome } : c))
          : [...perfil.cameras, { ch, nome, mostra: "outro" as const, tipos: [] }];
        await savePerfil(userId, { ...perfil, cameras: cams });
        return `Pronto: cam${ch} agora se chama "${nome}".`;
      },
    },
    {
      name: "agendar_relatorio",
      description: "Define a hora do relatório diário automático no Telegram (ex.: '20:00'), ou null para desligar.",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["hora"],
        properties: { hora: { type: ["string", "null"], description: "HH:MM (horário de Brasília) ou null para desligar" } },
      },
      async run(args) {
        const hora = args.hora == null || args.hora === "" ? null : String(args.hora);
        if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return "Horário inválido (use HH:MM).";
        const cfg = await lerConfigRelatorio(userId);
        await salvarConfigRelatorio(userId, { ...cfg, hora });
        return hora ? `Pronto: relatório diário todo dia às ${hora}, aqui no Telegram.` : "Pronto: relatório diário desligado.";
      },
    },
    {
      name: "pausar_alertas",
      description: "Pausa os alertas do Telegram por alguns minutos (a IA continua contando e registrando), ou 0 para retomar.",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["minutos"],
        properties: { minutos: { type: "integer", description: "minutos de pausa (máx. 10080 = 7 dias); 0 = retomar já" } },
      },
      async run(args) {
        const min = Math.max(0, Math.min(10080, Number(args.minutos) || 0));
        const dir = path.join(process.cwd(), "data", "pausa");
        await mkdir(dir, { recursive: true });
        const ate = min ? Date.now() / 1000 + min * 60 : 0;
        await writeFile(path.join(dir, `${userId}.json`), JSON.stringify({ ate }));
        if (!min) return "Pronto: alertas retomados.";
        const quando = new Date(ate * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
        return `Pronto: alertas pausados até ${quando}. A IA continua contando para os relatórios.`;
      },
    },
  ];
}
