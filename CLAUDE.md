# live.on — contexto do projeto

> Arquivo lido no início de todo chat. Mantenha curto e atualizado.
> Ao terminar uma tarefa importante, atualize a seção "Estado atual".

## Ideia
Live.On é um sistema web por assinatura que se conecta às câmeras que o cliente **já tem**
(Intelbras, Hikvision, Dahua...), mostra as câmeras **ao vivo** num painel web e **avisa na hora**
quando algo importante acontece (ex.: pessoa fora do horário, câmera tampada).

- Público: comércios pequenos, escritórios, condomínios e residências com DVR ou câmera IP.
- Cobrança: assinatura mensal **por câmera**, com teste grátis (valor a definir).
- Venda e instalação 100% online; sem câmera nova e sem abrir portas no roteador.
- Modelo decidido em 2026-11-14 (substitui o B2B com planos fixos R$ 199–9.900).
  Detalhes e motivos no cofre: `Live.On/Produto.md` e `Decisões/`.

## Stack
- **TypeScript + Next.js 16** (App Router, `src/`) + **Tailwind 4**.
- Next 16 tem mudanças: ler `AGENTS.md` e `node_modules/next/dist/docs/` antes de usar APIs novas.
- Programa no PC do cliente (serviço do Windows): ONVIF + RTSP + YOLO/OpenCV + go2rtc/WebRTC.
- Banco e login: Supabase. A definir: canal de alerta no celular, hospedagem do backend.

## Estado atual (2026-11-14)
- Pasta: `~/Developer/live.on`. **Nunca** em `~/Documents`/`~/Desktop` (iCloud tira arquivos do disco e quebra o Next/git).
- Repo: https://github.com/rafahuves/live.on (branch `main`). Push é feito pelo usuário no GitHub Desktop.
- Página inicial `/` = **landing page** (`src/app/page.tsx`), no modelo novo desde 2026-11-14: hero, como funciona
  (assina → programa acha as câmeras → ao vivo + alertas), demonstração, "para quem já tem câmera"
  (comércio, escritório, condomínio, residência), preço por câmera ("Em breve" + teste grátis), dúvidas, contato.
  O simulador embutido ainda mostra os segmentos antigos (restaurante, logística...). Botões de contato usam `CONTACT_URL` (ainda `#contato`:
  falta o WhatsApp/e-mail real do usuário).
- **Simulador**: `public/simulacoes.html` (HTML único, baseado no artifact
  claude.ai/artifact/2SfWBDAyu9W8qCLCMNefwB). Completo em `/simulacoes.html`; versão **compacta**
  com `?mini=1` (só abas + 1 câmera + celular), embutida na landing via `src/components/SimEmbed.tsx`
  (iframe que ajusta a altura por postMessage). Vídeos simulados em canvas; dados fictícios.
- Faixa roxa **fixa no topo** com "IP do Usuário: …" em todas as páginas: `src/components/IpBar.tsx`
  (no `layout.tsx`) e `.ipbar` no `simulacoes.html` (escondida no modo mini). IP vem de
  `src/app/api/ip/route.ts` (x-forwarded-for/x-real-ip). Pedido do usuário: não pode sair da tela.
- **Contas (Supabase Auth):** `/entrar` e `/criar-conta` com Google, Microsoft (`azure`), GitHub e e-mail/senha;
  volta do login em `/auth/callback`. Clientes em `src/lib/supabase/` (`getCurrentUser()` usa `getClaims`); `src/proxy.ts`
  renova a sessão e protege `/cameras`, `/analises`, `/api/chat`, `/api/analises`. Precisa de `NEXT_PUBLIC_SUPABASE_URL`
  e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no `.env.local` (sem elas o site avisa "contas não ativadas").
- **Câmeras por conta (fase de teste, só no computador da rede do DVR):** em `/cameras` o cliente informa IP, usuário e
  senha da Intelbras (botão procura DVR por ONVIF). A senha fica **só neste computador**, AES-256-GCM em `data/dvr/<id>.json`
  (chave `LIVEON_LOCAL_KEY`; nunca vai ao Supabase). `src/lib/dvr.ts` testa a conexão (imagem vazia = dado errado) e põe as
  câmeras no **go2rtc** só em memória (`npm run cameras` liga o go2rtc com config inline; o PUT responde 400 "config file
  disabled" mas adiciona). Nomes `u<12 hex do id>_camN` / `_camN_hd`. RTSP Intelbras `cam/realmonitor?channel=N&subtype=1|0`.
- **Ver as câmeras de longe (demo, 2026-11-15):** `scripts/ligar-online.sh` (atalho com dois cliques em
  `~/Desktop/Live.On/Ligar Live.On (almoço).command`) liga go2rtc + `next start -p 3001` + túnel Cloudflare
  (`cloudflared`, link `https://….trycloudflare.com`, muda a cada vez; salvo em `data/logs/LINK.txt`) + `caffeinate`.
  Fora do localhost o `CameraGrid` usa `/api/cam?src=` (MJPEG via ffmpeg, só a dona da conta; go2rtc segue em 127.0.0.1).
  O Mac precisa ficar ligado, na tomada, tampa aberta e no Wi-Fi do gravador.
- **Análises personalizadas** (`/analises`): chat com a Claude (`claude-opus-5-5`, effort low, `fallbacks: "default"`) em
  `src/app/api/chat/route.ts`; a ferramenta `salvar_analise` (strict) grava em `data/analises/<id da conta>.json` (local, fora do Git).
  O cliente guarda o histórico completo e só acrescenta (não editar mensagens antigas: quebra os blocos de thinking).
  A IA não identifica pessoas (sem reconhecimento facial) e recusa câmera em banheiro. Precisa de `ANTHROPIC_API_KEY` no `.env.local`.
  As análises ainda não rodam nas câmeras (falta o detector YOLO).
- Identidade visual: branco + roxo `#7C3AED`, fontes Inter / Inter Tight / IBM Plex Mono.
- Removido em 2026-11-14: protótipo `/camera` (webcam + TensorFlow.js). Não recriar sem pedido.

## Plano
- Roteiro completo em `docs/PLANO.md` (fases, arquitetura, decisões). Ler antes de começar trabalho novo.
- Arquitetura: câmeras/DVR → RTSP → **programa no PC do cliente** (descobre por ONVIF, roda YOLO,
  manda só eventos ao servidor, serve vídeo ao vivo por WebRTC via go2rtc) → servidor + painel Next.js.
  O programa abre a conexão de dentro da rede (funciona com CGNAT).
- Senha do DVR fica só no PC do cliente; o programa usa uma chave por computador, nunca a senha da conta.
- MiroFish: `~/MiroFish` configurado para Gemini grátis, mas sem chaves (usuário desistiu). Não insistir.
  Semente pronta em `docs/mirofish/seed-liveon.md`.

## Pontos em aberto
- Quais análises entram na 1ª versão (sugestão: só "pessoa fora do horário").
- Câmera/DVR para testar (sem isso, usar vídeos gravados).
- Valor por câmera; canal de alerta no celular.

## Segundo cérebro (cofre Obsidian) — LER SEMPRE
- **Antes de começar qualquer tarefa**, ler a skill `Skills/segundo-cerebro.md` do cofre
  e seguir as regras dela (ler gastando pouco, pacote de memória no fim, nada gravado sem "ok").
- **Cofre:** `~/Developer/Memoria Live.On` (fora do iCloud; nunca em `~/Documents`)
- **Dono:** o usuário (Rafa). Aprova tudo que entra, muda ou vai para o Arquivo.
- **Quem escreve:** o próprio agente desta conversa (não há equipe). Subagentes só leem.
- **Fora do cofre:** código e regras técnicas → este repositório (`CLAUDE.md`, `AGENTS.md`, `docs/`);
  histórico → Git. Não copiar isso para o cofre, só linkar se precisar.
- Roteador do cofre: `CLAUDE.md` na raiz do cofre (se não existir, seguir a seção 0 da skill).

## Convenções
- Conversa com o usuário em português; textos da interface em pt-BR.
- **Não controlar o Mac do usuário** (nada de computer-use, clicar em apps, GitHub Desktop etc.).
  Commit pode; o **push o usuário faz** no GitHub Desktop. Dar passo a passo curto quando precisar.
- Deploy: projeto Vercel `rafakessler/live.on`, ligado ao GitHub; cada push na `main` publica sozinho.
- Rodar: `npm run dev` → http://localhost:3000. Checar com `npm run lint` e `npm run build`.
