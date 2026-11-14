# live.on

Aplicação web que acessa a câmera do cliente pelo navegador, analisa o vídeo
e emite um alerta quando detecta algo que não deveria aparecer.

## Status
Protótipo: página `/camera` liga a webcam, detecta objetos no navegador e
alerta (borda vermelha, som e lista) quando aparece uma classe marcada como proibida.
Alertas ainda não são enviados a um servidor.

## Stack
- **TypeScript + Next.js** (App Router) + Tailwind CSS
- **Detecção no navegador**: TensorFlow.js + modelo COCO-SSD (o vídeo não sai da máquina do cliente)
- Planejado: **Supabase** (login, banco, alertas em tempo real) e deploy na **Vercel**

## Requisitos
- Node.js 20+
- Navegador moderno com suporte a `getUserMedia`
- HTTPS em produção (o navegador bloqueia a câmera fora de HTTPS/localhost)

## Rodando localmente
```bash
npm install
npm run dev
```
Abra http://localhost:3000/camera e autorize a câmera.

> Não coloque o projeto numa pasta sincronizada pelo iCloud/Dropbox
> (ex.: `~/Documents` com iCloud): arquivos somem do disco e o Next quebra.

## Estrutura
- `src/app/page.tsx`: página inicial
- `src/app/camera/page.tsx`: página do monitor
- `src/components/CameraMonitor.tsx`: câmera, loop de detecção e alertas
- `src/lib/detection-config.ts`: classes proibidas, confiança mínima, intervalos

## Arquivos de referência
- `CLAUDE.md`: contexto para agentes de IA (Claude). Não é documentação para devs.
- `AGENTS.md`: gerado automaticamente pelo `next dev`.
