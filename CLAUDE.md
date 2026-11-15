# live.on — contexto do projeto

> Arquivo lido no início de todo chat. Mantenha curto e atualizado.
> Ao terminar uma tarefa importante, atualize a seção "Estado atual".

## Ideia
Live.On é um serviço **B2B** que liga **IA às câmeras de segurança dos negócios**
(ex.: Intelbras) e **avisa no celular do responsável** quando algo foge da regra:
falta de EPI, pessoa em área de risco, mesa sem atendimento, cliente que saiu sem pagar,
porta da câmara fria aberta, posto de trabalho vazio, etc.

- Segmentos: logística, restaurante, varejo, indústria, escritório.
- Planos/mês: Essencial R$ 199 (até 4 câmeras), Profissional R$ 590, Negócio R$ 2.490,
  Corporativo a partir de R$ 9.900.
- Tudo na web.

## Stack
- **TypeScript + Next.js 16** (App Router, `src/`) + **Tailwind 4**.
- Next 16 tem mudanças: ler `AGENTS.md` e `node_modules/next/dist/docs/` antes de usar APIs novas.
- A definir: backend de análise de vídeo (provavelmente servidor lendo RTSP das câmeras),
  banco/login, canal de alertas (a demo mostra notificação tipo ntfy/WhatsApp), deploy.

## Estado atual (2026-11-14)
- Pasta: `~/Developer/live.on`. **Nunca** em `~/Documents`/`~/Desktop` (iCloud tira arquivos do disco e quebra o Next/git).
- Repo: https://github.com/rafahuves/live.on (branch `main`). Push é feito pelo usuário no GitHub Desktop.
- Site principal `/` = **Central de Simulações** (`public/simulacoes.html`), HTML único,
  cópia fiel do artifact claude.ai/artifact/2SfWBDAyu9W8qCLCMNefwB, servido via rewrite em `next.config.ts`.
  Vídeos são simulados em canvas; dados fictícios.
- Identidade visual: branco + roxo `#7C3AED`, fontes Inter / Inter Tight / IBM Plex Mono.
- Removido em 2026-11-14: protótipo `/camera` (webcam + TensorFlow.js). Não recriar sem pedido.

## Plano
- Roteiro completo em `docs/PLANO.md` (fases, arquitetura, decisões). Ler antes de começar trabalho novo.
- Arquitetura alvo: câmeras Intelbras → RTSP → caixinha no cliente (Python + YOLO + regras)
  → Supabase → alerta no celular (Telegram/ntfy) + painel no site Next.js.
- MiroFish: `~/MiroFish` configurado para Gemini grátis, mas sem chaves (usuário desistiu). Não insistir.
  Semente pronta em `docs/mirofish/seed-liveon.md`.

## Pontos em aberto
- Como conectar às câmeras reais (RTSP/NVR Intelbras) e onde roda a IA.
- Canal de alerta definitivo (WhatsApp, push, ntfy...).
- Privacidade/LGPD: consentimento, retenção de imagens.

## Convenções
- Conversa com o usuário em português; textos da interface em pt-BR.
- Rodar: `npm run dev` → http://localhost:3000. Checar com `npm run lint` e `npm run build`.
