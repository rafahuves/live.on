// Ferramentas do assistente (site e Telegram). Ver src/lib/assistente.ts.
import { DIAS, TIPOS, addAnalise, validarAnalise, type Analise } from "./analises";
import { activeChannels, loadDvr } from "./dvr";
import { fotoDaCamera } from "./fotos";
import type { Ferramenta } from "./assistente";

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
