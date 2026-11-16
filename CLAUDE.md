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
- Página inicial `/` = **landing page** (`src/app/page.tsx`; desde 2026-11-16 visual escuro "câmera à noite" com painéis de vidro, estilo em `src/app/landing.css` todo dentro de `.lp`, efeitos em `src/components/LandingFx.tsx`: câmeras simuladas em canvas e o "Como funciona" que se monta ao rolar; seção de pitch "Por que a Live.On"; as outras páginas seguem claras), no modelo novo desde 2026-11-14: hero, como funciona
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
  O `CameraGrid` sempre usa `/api/cam?src=` (MJPEG via ffmpeg, só a dona da conta; go2rtc segue em 127.0.0.1).
  O Mac precisa ficar ligado, na tomada, tampa aberta e no Wi-Fi do gravador.
- **REGRA: o Live.On NUNCA pode sobrecarregar/travar o gravador do cliente** (em 2026-11-15 um DVR Intelbras travou
  depois de 16 câmeras abertas de uma vez). Todo vídeo passa por `/api/cam` + `src/lib/dvrGuard.ts`: no máximo
  `LIVEON_MAX_CAMS` (padrão 4) câmeras ao vivo por conta, teste leve (RTSP OPTIONS) antes de abrir, e pausa crescente
  (30 s → 10 min) quando o gravador não responde. A tela (`CameraGrid`) liga uma câmera por vez e não tenta de novo
  sozinha; o HD pausa a grade. Não criar caminho de vídeo que pule essas travas.
  **Escudo (`src/lib/dvrShield.ts`)**: nada conecta direto no gravador. As URLs RTSP no go2rtc apontam para
  `127.0.0.1:<porta do escudo>` e só o escudo fala com o DVR: máx. (canais + 2) conexões juntas, ritmo de 1 conexão
  nova a cada 300 ms (rajada vira fila), (2×canais + 4) novas/min, bloqueio crescente se o gravador não responde.
- **Dashboard (`/cameras`)**: mostra TODAS as câmeras com câmera ligada (canais vazios "VAZIO" são descobertos um
  por vez e escondidos; `Dvr.active`). Liga uma câmera a cada 1,5 s, sem tentar de novo sozinha; aba escondida
  30 s desliga tudo. Grade: 480 px, 2 imagens/s (filtro em `/api/cam`); HD: 1280 px. Conversor limitado a
  10 imagens/s (`ffmpeg.mjpeg` em `scripts/cameras.mjs`). Teste de 2026-11-15 no DVR de casa: 11 câmeras abertas,
  gravador respondendo em ~20 ms, CPU ~60% de 1 núcleo.
  A análise em Python (futura) também deve ler do go2rtc, nunca do gravador.
- **Detector (`scripts/detector.py`, Python 3.12 em `.venv-detector`, YOLO `models/yolo11n.pt`, CPU — MPS trava no
  macOS 14):** lê o `_mjpeg` de cada câmera que tem análise pelo go2rtc (1 conexão contínua, abre 1 a cada 1,5 s,
  backoff 30 s→5 min), aplica as análises (horário/24h, contagem, permanência, passagens, tampada/sem sinal) e manda
  alerta com print (pessoa marcada) via `POST /api/interno/alerta` (só 127.0.0.1 + `LIVEON_LOCAL_KEY`) → Telegram.
  1 alerta/5 min por análise e câmera. Eventos em `data/eventos/<id>.jsonl` (ferramenta `relatorio`). Só 1 detector
  por vez (lock). O escudo e as câmeras sobem no início do servidor (`src/instrumentation.ts`).
- **Assistente único (`src/lib/assistente.ts`)**: Claude (ANTHROPIC_API_KEY) ou Gemini grátis (GEMINI_API_KEY, testes),
  com ferramentas em `src/lib/ferramentas.ts` (salvar_analise, foto_camera, relatorio, situacao_telegram, alerta_teste,
  nome_da_empresa) e instruções em `src/lib/prompt.ts`. Usado pelo chat do site e pelo robô do Telegram
  (`src/lib/telegramBot.ts`, long polling; `/start <código>` liga a conta e manda boas-vindas; foto de perfil
  `assets/robo-telegram.jpg`). Fase de teste: 1 robô = 1 empresa ("Live.On - <empresa>").
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
