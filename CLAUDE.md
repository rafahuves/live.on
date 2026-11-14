# live.on — contexto do projeto

> Arquivo lido no início de todo chat. Mantenha curto e atualizado.
> Ao terminar uma tarefa importante, atualize a seção "Estado atual".

## Ideia
Aplicação **web** que acessa a câmera dos clientes, analisa a imagem e
**avisa (alerta) quando detecta algo que não deveria estar ali**.

- Roda no navegador (sem app nativo).
- Câmera via `getUserMedia`, exige HTTPS (ou localhost).
- Fluxo: cliente abre a página → autoriza a câmera → vídeo analisado → alerta.

## Stack (decidida em 2026-11-14)
- **TypeScript + Next.js 16** (App Router, `src/`) + **Tailwind 4**.
- **Detecção no navegador**: `@tensorflow/tfjs` + `@tensorflow-models/coco-ssd`
  (import dinâmico, só no cliente). Vídeo nunca vai para o servidor.
- Planejado: **Supabase** (auth, Postgres, realtime para alertas) e **Vercel** (deploy/HTTPS).
- Se precisar de modelo próprio/pesado: servidor Python + YOLO depois.
- Next 16 tem mudanças: ler `AGENTS.md` e `node_modules/next/dist/docs/` antes de usar APIs novas.

## Estado atual (2026-11-14)
- Pasta: `~/Developer/live.on`. **Nunca** em `~/Documents` (iCloud tira arquivos do disco e quebra o Next/git).
- Repo: https://github.com/rafahuves/live.on (branch `main`).
- Feito: `/camera` liga a webcam, detecta objetos (COCO-SSD lite), desenha caixas,
  alerta com borda vermelha + bipe + lista quando aparece classe proibida.
- Config em `src/lib/detection-config.ts` (classes, `MIN_SCORE`, cooldown, intervalo).
- Falta: enviar alertas ao backend (há `TODO` em `CameraMonitor.tsx`), login, deploy.

## Pontos em aberto
- O que conta como "algo que não é pra ver" (hoje: classes COCO marcáveis na tela).
- Quem recebe o alerta e por onde (tela, e-mail, WhatsApp, push...).
- Privacidade: consentimento do cliente; hoje nenhuma imagem é salva.

## Convenções
- Conversa com o usuário em português; textos da interface em pt-BR.
- Rodar: `npm run dev` → http://localhost:3000/camera. Checar com `npm run lint` e `npm run build`.
