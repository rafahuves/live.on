# Live.On: planejamento

> Do site de demonstração até clientes pagando. Atualizar a cada fase concluída.
> Regra geral: **gastar o mínimo possível** até ter cliente pagando.
> Visão do produto e o porquê de cada decisão: cofre Obsidian `~/Developer/Memoria Live.On`
> (`Live.On/` e `Decisões/`). Este arquivo guarda o roteiro técnico.

## Onde estamos (14/11/2026)
- ✅ Site de demonstração (Central de Simulações) no ar na Vercel e no GitHub.
- ✅ Modelo do produto definido em 14/11/2026: programa no PC do cliente, vídeo ao vivo
  por WebRTC, assinatura **por câmera** com teste grátis, venda 100% online.
- ❌ Nenhuma câmera real conectada, nenhuma IA rodando, nenhum cliente.
- ⚠️ A landing page ainda mostra os planos fixos antigos (R$ 199 / 590 / 2.490 / 9.900+) e os segmentos B2B antigos.

---

## Como vai funcionar de verdade
Três partes:

```
[Câmeras / DVR] --RTSP--> [Programa no PC do cliente] --eventos--> [Servidor + painel web]
  (rede do cliente)        (ONVIF, YOLO, go2rtc)    --WebRTC ao vivo--> [Navegador do cliente]
```

1. **Câmeras ou DVR (o cliente já tem).** Intelbras, Hikvision, Dahua etc. entregam o vídeo
   por RTSP (ex.: `rtsp://usuario:senha@IP:554/...`), sem nenhuma alteração.
2. **Programa instalável (PC Windows do cliente).** Roda como serviço do Windows e:
   - descobre as câmeras da rede via **ONVIF**;
   - lê cada câmera por **RTSP** (stream leve, poucos quadros por segundo);
   - roda a IA (**YOLO + OpenCV**) e manda ao servidor **só o evento** (tipo, horário, câmera, foto);
   - serve o vídeo ao vivo por **WebRTC** (go2rtc) direto ao navegador;
   - abre a conexão de dentro da rede: funciona com CGNAT, sem abrir portas no roteador.
3. **Servidor + painel web (este projeto, Next.js).** Cadastro, login, autorização do
   computador, câmeras ao vivo, eventos e alertas, status "computador online/offline" e
   "câmera sem sinal". Banco e login no Supabase (grátis).

### Segurança (regras do projeto)
- Senha do DVR fica **só no PC do cliente**, criptografada; nunca vai ao servidor.
- Senha da conta nunca fica no programa: autorização pelo navegador gera uma **chave por
  computador**, revogável no painel.
- Recomendar ao cliente um usuário do DVR **só de visualização**.

---

## Ordem de construção
1. **Prova de conceito:** script que conecta numa câmera por RTSP e detecta pessoas
   (sem câmera para testar → usar vídeos gravados).
2. **Programa local:** descoberta das câmeras, análise e vídeo ao vivo no navegador, na mesma rede.
3. **Servidor e painel:** contas, login, autorização do computador e recebimento de eventos.
4. **Vídeo ao vivo remoto:** WebRTC do PC do cliente até o painel, pela internet.
5. **Instalador:** serviço do Windows, atualização automática e tutorial com prints.
6. **Venda:** página do produto, pagamento e período de teste.

## Ferramentas (custo zero no início)
| Peça | Ferramenta |
|---|---|
| Servidor | Oracle Cloud (nível grátis) ou PC em casa com Cloudflare Tunnel |
| Banco e login | Supabase (grátis) ou PostgreSQL no servidor |
| Vídeo ao vivo | go2rtc + WebRTC |
| Análise | YOLO + OpenCV, no PC do cliente |
| Instalador | Sem assinatura digital + tutorial; depois, Microsoft Store |
| Domínio | Subdomínio grátis; domínio próprio (~R$ 40/ano) quando for vender |

---

## Decisões em aberto
| Decisão | Opções | Quando decidir |
|---|---|---|
| Análises da 1ª versão | Sugestão: só "pessoa fora do horário". Depois: contagem, área marcada, câmera tampada | Antes da etapa 1 |
| Câmera/DVR para teste | Câmera real ou vídeos gravados | Antes da etapa 1 |
| Valor da assinatura por câmera | A definir (conversar com clientes) | Antes da etapa 6 |
| Canal de alerta no celular | Push do painel, Telegram/ntfy (grátis), WhatsApp (pago) | Etapa 3 |
| Cobrança | Asaas, Pagar.me, Stripe | Etapa 6 |
| Hospedagem do painel | Vercel (atual) ou o mesmo servidor do backend | Etapa 3 |

## Concorrentes (pesquisa de 14/11/2026)
A ideia está validada: há várias empresas fazendo IA sobre câmeras já instaladas,
algumas com muito investimento. Valores vêm da imprensa e não foram conferidos.

| Empresa | Onde | Foco | Observação |
|---|---|---|---|
| **Intelbras** (Defense IA, IAX, Mibo) | Brasil | Fabricante colocando IA nos próprios gravadores e câmeras | **Maior risco**: dona do hardware dos nossos clientes |
| Emilia AI | Brasil/LatAm | Restaurantes: câmeras + PDV, vendas e antifraude | Investimento da Prosus (valor diverge: US$ 1,5M ou 15M) |
| Riverdata | Brasil | Varejo físico: câmeras viram ferramenta de gestão | — |
| Noleak (Agatha) | Brasil | Alertas quando o padrão do ambiente muda | ~R$ 3,8M de receita prevista em 2025 |
| Solink | EUA/Canadá | Varejo, restaurantes, armazéns, IA no local (edge) | +US$ 100M (out/2026); quase igual ao Live.On |
| Coram AI | EUA | Investigação com IA em câmeras IP existentes | US$ 35M Série B (jun/2026) |
| Spot AI | EUA | Pequenas e grandes empresas | Milhares de locais instalados |
| Veesion | França | Furto no varejo, alerta no celular | Captou ~R$ 243M |
| Ailytics, Conntour | Ásia / EUA | Operações maiores | US$ 7,4M e US$ 7M |

**Onde o Live.On pode ganhar** (não na tecnologia, que todos têm):
- **Preço e simplicidade** para o pequeno cliente brasileiro: assinatura por câmera, teste grátis, em português.
- **Sem visita e sem hardware:** compra, instala e configura sozinho, com qualquer marca de câmera.
- **Foco:** poucas análises muito bem resolvidas no começo.

## Riscos principais
- **LGPD e pessoas se sentindo vigiadas** → termos claros (imagens são do cliente) e aviso de monitoramento no local.
- **Alarmes falsos** irritam o cliente → começar com uma análise só e bem calibrada.
- **Instalação sozinha travar** (aviso do Windows, senha do DVR, ONVIF desligado) → tutorial com prints e descoberta automática.
- **PC do cliente desligado** → status online/offline no painel e aviso ao cliente.
- **Câmeras antigas ou internet ruim** → stream leve e reconexão automática.
- **Concorrência** (a própria Intelbras) → vender pelo resultado e pela simplicidade, não pela tecnologia.
