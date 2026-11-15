# live.on

Live.On conecta IA às câmeras de segurança de negócios (logística, restaurante,
varejo, indústria, escritório) e avisa no celular do responsável quando algo foge
da regra.

## Status
Fase de demonstração: o site é uma **landing page** com uma versão compacta da
**Central de Simulações** (vídeos simulados por computador, detecções da IA e
alertas; dados fictícios). Ainda não há conexão com câmeras reais.

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
- `src/app/page.tsx`: landing page (`/`)
- `src/app/layout.tsx`, `src/app/globals.css`: fontes, cores da marca e faixa de IP
- `src/components/IpBar.tsx`: faixa fixa "IP do Usuário" no topo
- `src/components/SimEmbed.tsx`: simulador compacto embutido na landing
- `src/app/api/ip/route.ts`: devolve o IP do visitante
- `public/simulacoes.html`: Central de Simulações completa (`/simulacoes.html`); `?mini=1` = versão compacta

## Arquivos de referência
- `CLAUDE.md`: contexto para agentes de IA (Claude). Não é documentação para devs.
- `AGENTS.md`: gerado automaticamente pelo `next dev`.
