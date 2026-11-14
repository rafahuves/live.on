# live.on

Live.On conecta IA às câmeras de segurança de negócios (logística, restaurante,
varejo, indústria, escritório) e avisa no celular do responsável quando algo foge
da regra.

## Status
Fase de demonstração: o site mostra a **Central de Simulações**, com vídeos
simulados por computador, detecções da IA e alertas. Os dados são fictícios.
Ainda não há conexão com câmeras reais.

## Stack
- TypeScript + Next.js (App Router) + Tailwind CSS
- A definir: backend de análise de vídeo, banco/login, canal de alertas e deploy

## Requisitos
- Node.js 20+

## Rodando localmente
```bash
npm install
npm run dev
```
Abra http://localhost:3000.

> Não coloque o projeto numa pasta sincronizada pelo iCloud/Dropbox
> (ex.: `~/Documents` ou `~/Desktop` com iCloud): arquivos somem do disco e o Next quebra.

## Estrutura
- `public/simulacoes.html`: Central de Simulações (HTML único), servida em `/` pelo rewrite em `next.config.ts`
- `src/app/layout.tsx`, `src/app/globals.css`: base do Next.js para as próximas páginas

## Arquivos de referência
- `CLAUDE.md`: contexto para agentes de IA (Claude). Não é documentação para devs.
- `AGENTS.md`: gerado automaticamente pelo `next dev`.
