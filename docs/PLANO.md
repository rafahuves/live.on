# Live.On: planejamento

> Do site de demonstração até clientes pagando. Atualizar a cada fase concluída.
> Regra geral: **gastar o mínimo possível** até ter cliente pagando.

## Onde estamos (14/11/2026)
- ✅ Site de demonstração (Central de Simulações) no ar na Vercel e no GitHub.
- ✅ Visão do produto, segmentos e planos definidos (R$ 199 / 590 / 2.490 / 9.900+).
- ❌ Nenhuma câmera real conectada, nenhuma IA rodando, nenhum cliente.

---

## Como o site vai funcionar de verdade
Hoje o site só **simula**. Para funcionar com câmeras reais, são 4 peças:

```
[Câmeras Intelbras] → [Gravador DVR/NVR] → [Caixinha Live.On no cliente] → [Nuvem] → [Celular + Site]
                                               (IA olha o vídeo)          (alertas)
```

1. **Câmeras + gravador (o cliente já tem).** O gravador Intelbras entrega o vídeo
   de cada câmera por um endereço RTSP (ex.: `rtsp://usuario:senha@IP:554/...`).
2. **Caixinha Live.On (no cliente).** Um computador pequeno ligado na mesma rede do
   gravador. Roda um programa em **Python** que:
   - pega o vídeo de cada câmera (RTSP),
   - roda a IA (**YOLO**) para achar pessoas, objetos, EPI,
   - aplica as **regras** do negócio ("mesa sem garçom há 5 min"),
   - quando uma regra dispara, manda **só o alerta com a foto** para a nuvem.
3. **Nuvem (Supabase, grátis no início).** Guarda clientes, câmeras, regras e alertas,
   e avisa o celular (Telegram/ntfy no começo, WhatsApp depois).
4. **Site (este projeto, Next.js na Vercel).** Deixa de ser só a demo e ganha:
   login do cliente, lista de alertas com foto, câmeras e regras para ligar/desligar.
   A Central de Simulações continua como página de vendas.

O vídeo **nunca sai da empresa do cliente**: só alertas e fotos sobem. Isso deixa
tudo mais barato (sem servidor de vídeo) e ajuda com a LGPD.

### Ordem de construção
1. Programa Python que lê **uma** câmera e detecta pessoas (testando no seu Mac).
2. Uma regra simples + alerta no **Telegram** do seu celular.
3. Supabase + tela de alertas no site.
4. Login, várias câmeras, várias regras, vários clientes.

---

## Fase 1: Validar antes de construir (2 a 3 semanas, custo R$ 0)
O objetivo é descobrir **quem paga e por qual alerta**, antes de escrever o produto.

1. **Deixar o link da demo público** (Vercel → Deployment Protection) para mostrar a clientes.
2. **Simulação local das 10.000 empresas** (Python, sem IA paga): estimar adoção,
   plano escolhido e receita por segmento, para decidir por onde começar.
3. **Conversar com 10 a 15 negócios reais**, começando por restaurantes e varejo
   (decisão rápida, dono decide sozinho). Perguntas-chave:
   - Qual problema da lista mais dói? (furto, saída sem pagar, EPI, atendimento...)
   - Que câmera e gravador usam? (marca, modelo, quantas, têm internet estável?)
   - Pagariam R$ 199 ou R$ 590 por mês? Quanto pagam hoje de segurança?
4. **Escolher 1 segmento e 2 ou 3 alertas** para o primeiro produto.

**Pronto quando:** 3 negócios disserem "se funcionar, eu pago" e topar um piloto.

## Fase 2: Prova técnica com 1 câmera (3 a 4 semanas, custo baixo)
Fazer **um alerta real funcionar** numa câmera Intelbras.

- **Conexão:** ler o vídeo do gravador Intelbras (DVR/NVR) pelo protocolo **RTSP**.
- **Onde roda a IA:** num **computador pequeno no próprio cliente** (mini PC usado,
  ou o próprio Mac para o teste). Vídeo não sobe para a nuvem: mais barato e melhor
  para a LGPD. Só o alerta (texto + foto) sai do local.
- **IA:** Python + modelo **YOLO** (gratuito, open source) para pessoas e objetos;
  modelos prontos de EPI (capacete, colete) quando for indústria/logística.
- **Regras:** "pessoa na zona X por mais de N minutos", "mesa sem garçom há 5 min" etc.
- **Alerta no celular, grátis:** Telegram ou ntfy (WhatsApp oficial é pago; fica para depois).

**Pronto quando:** um alerta com foto chega no celular a partir de uma câmera real,
com poucos alarmes falsos.

## Fase 3: Piloto com 3 a 5 clientes (1 a 2 meses)
- Instalar nos negócios da Fase 1 (de graça ou com desconto, em troca de feedback).
- **Painel web** (Next.js, já no projeto): login, câmeras do cliente, lista de alertas
  com foto, ligar/desligar regras.
- **Banco e login:** Supabase (plano grátis).
- Medir: alertas úteis vs. falsos, quanto o cliente usa, o que ele pediria a mais.
- Termo de uso e **aviso de monitoramento (LGPD)** para funcionários e clientes.

**Pronto quando:** pelo menos 2 pilotos aceitarem virar clientes pagantes.

## Fase 4: Primeiros clientes pagantes (contínuo)
- **Cobrança recorrente:** Asaas ou Pagar.me (Pix e boleto, comuns no Brasil).
- **Instalação em escala:** parceria com técnicos/integradores Intelbras da região
  (eles já têm os clientes e fazem a visita).
- WhatsApp oficial para alertas, quando houver receita para pagar.
- Abrir o segundo segmento, reaproveitando a mesma base.

## Fase 5: Escala
- Planos Negócio e Corporativo (logística e indústria): várias unidades, relatórios,
  integrações com PDV, portaria e parada de máquina.
- Treinar modelos próprios com os dados dos clientes (com consentimento).

---

## Decisões em aberto
| Decisão | Opções | Quando decidir |
|---|---|---|
| Primeiro segmento | Restaurante ou varejo (mais rápidos) | Fim da Fase 1 |
| Hardware no cliente | Mini PC, Raspberry Pi 5, NVIDIA Jetson | Fase 2 |
| Canal de alerta | Telegram/ntfy (grátis) → WhatsApp (pago) | Fase 2 / Fase 4 |
| Cobrança | Asaas, Pagar.me, Stripe | Fase 4 |

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
- **Preço e simplicidade para o pequeno negócio brasileiro** (R$ 199 / 590), em português, alerta no celular.
- **Canal:** instaladores e integradores Intelbras locais, que já têm os clientes.
- **Foco:** um segmento e 2 ou 3 dores muito bem resolvidas no começo.
- Na Fase 1, perguntar aos negócios se já conhecem ou usam algum desses.

## Riscos principais
- **LGPD e funcionários** se sentindo vigiados → aviso claro, foco em segurança e não em punição.
- **Alarmes falsos** irritam o cliente → começar com poucas regras e bem calibradas.
- **Câmeras antigas ou internet ruim** → checar na conversa da Fase 1.
- **Concorrência** (a própria Intelbras, integradores) → vender pelo resultado (furto
  evitado, multa evitada), não pela tecnologia.
