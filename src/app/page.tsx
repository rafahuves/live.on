import Link from "next/link";
import SimEmbed from "@/components/SimEmbed";
import LandingFx from "@/components/LandingFx";
import "./landing.css";

// Landing: visual escuro de "câmera à noite" com painéis de vidro (estilo em ./landing.css, só aqui).
// Botões "Testar grátis" levam ao cadastro.
const CONTACT_URL = "/criar-conta";

const STEPS = [
  {
    title: "Assine e baixe o programa",
    text: "Crie a conta no site e instale o programa num computador que fique ligado no local das câmeras.",
  },
  {
    title: "Ele encontra suas câmeras",
    text: "Informe o usuário e a senha do gravador. O programa acha as câmeras da rede sozinho, sem mexer no roteador.",
  },
  {
    title: "Veja ao vivo e receba alertas",
    text: "As câmeras aparecem no painel, de qualquer lugar, e a IA avisa na hora quando algo importante acontece.",
  },
];

const ICON = {
  comercio: "M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6",
  escritorio: "M5 21V4h14v17M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4",
  condominio: "M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5",
  residencia: "M3 11 12 4l9 7M5 10v10h14V10",
};

const SEGMENTS = [
  { name: "Comércio", icon: ICON.comercio, alerts: ["Pessoa na loja fora do horário", "Contagem de quem entrou", "Alguém atrás do balcão", "Câmera sem sinal ou tampada"] },
  { name: "Escritório", icon: ICON.escritorio, alerts: ["Movimento depois do expediente", "Alguém na sala restrita", "Contagem de visitantes", "Câmera sem sinal ou tampada"] },
  { name: "Condomínio", icon: ICON.condominio, alerts: ["Pessoa na garagem de madrugada", "Alguém na área da piscina fechada", "Movimento no muro", "Câmera sem sinal ou tampada"] },
  { name: "Residência", icon: ICON.residencia, alerts: ["Pessoa no quintal à noite", "Alguém no portão com a casa vazia", "Movimento na área marcada", "Câmera sem sinal ou tampada"] },
];

const PRICE_ITEMS = [
  "Câmeras ao vivo no painel, de qualquer lugar",
  "Alertas com foto do momento",
  "Funciona com as câmeras e o gravador que você já tem",
  "Instalação sozinho, com tutorial passo a passo",
  "Cancele quando quiser",
];

const FAQ = [
  {
    q: "Preciso trocar minhas câmeras?",
    a: "Não. A Live.On funciona com as câmeras e o gravador que você já tem. É compatível com gravadores e câmeras Intelbras, Hikvision e Dahua.",
  },
  {
    q: "Preciso de um técnico ou mexer no roteador?",
    a: "Não. Você instala um programa num computador do local, e ele encontra as câmeras sozinho. Não é preciso abrir portas no roteador, e funciona em qualquer internet.",
  },
  {
    q: "A senha do meu gravador fica com vocês?",
    a: "Não. Ela fica só no computador do local, criptografada, e nunca vai para o nosso servidor. A sua conta autoriza aquele computador pelo navegador, e você pode desautorizar quando quiser.",
  },
  {
    q: "E a LGPD?",
    a: "As imagens são suas. Os termos de uso deixam isso claro, e orientamos a colocar o aviso de monitoramento no local.",
  },
  {
    q: "E se der alarme falso?",
    a: "Começamos com poucas análises, bem ajustadas, e você escolhe quais câmeras e horários quer monitorar.",
  },
];

const FOUND = ["Portão", "Doca 1", "Doca 2", "Estoque", "Pátio", "Recepção", "Garagem", "Corredor"];

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 1080 1080" aria-hidden="true">
      <rect width="1080" height="1080" fill="#7c3aed" />
      <rect x="366" y="316" width="98" height="447" fill="#fff" />
      <rect x="366" y="665" width="296" height="98" fill="#fff" />
      <circle cx="705" cy="395" r="102" fill="none" stroke="#c4a8f5" strokeWidth="22" />
      <circle cx="705" cy="395" r="56" fill="#fff" />
    </svg>
  );
}

const mono = { fontFamily: "var(--font-plex-mono), ui-monospace, monospace", fontSize: 10 };

export default function Home() {
  return (
    <div className="lp">
      <LandingFx />
      <div className="sky" aria-hidden="true">
        <div className="glow a" />
        <div className="glow b" />
        <div className="glow c" />
      </div>

      <header className="nav wrap">
        <div className="bar glass">
          <Link className="logo" href="/" aria-label="Live.On, início">
            <Logo />
            Live.On
          </Link>
          <nav className="links" aria-label="Seções">
            <a href="#por-que">Por que</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#demonstracao">Demonstração</a>
            <a href="#preco">Preço</a>
            <a href="#duvidas">Dúvidas</a>
            <Link href="/entrar">Entrar</Link>
          </nav>
          <a className="btn btn-main" href={CONTACT_URL}>
            Testar grátis
          </a>
        </div>
      </header>

      <main>
        {/* 1. Hero */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div data-enter>
              <span className="eyebrow">
                <i className="dot" />
                Monitoramento inteligente de câmeras
              </span>
              <h1>
                Suas câmeras viram <em>olhos que avisam.</em>
              </h1>
              <p className="lead">
                Quase ninguém assiste às próprias câmeras. A Live.On mostra as suas ao vivo, de qualquer lugar, e avisa na
                hora quando algo importante acontece, como uma pessoa fora do horário ou uma câmera tampada.
              </p>
              <div className="cta">
                <a className="btn btn-main" href={CONTACT_URL}>
                  Quero testar grátis
                </a>
                <a className="btn btn-ghost" href="#demonstracao">
                  Ver demonstração
                </a>
              </div>
              <p className="compat">
                <b>Compatível com</b> Intelbras · Hikvision · Dahua
              </p>
              <dl className="stats">
                {[
                  ["0", "câmeras para trocar"],
                  ["0", "visitas técnicas"],
                  ["100%", "online, do cadastro à instalação"],
                ].map(([v, l]) => (
                  <div key={l} className="stat glass">
                    <dt>{v}</dt>
                    <dd>{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="stage" aria-label="Painel da Live.On com quatro câmeras ao vivo e um alerta">
              <div className="panel glass" data-parallax="-0.04">
                <div className="panel-top">
                  <span>Minhas câmeras · 4 de 11</span>
                  <span className="live">
                    <i />
                    AO VIVO
                  </span>
                </div>
                <div className="cams">
                  {[
                    ["portao", "PORTÃO"],
                    ["doca", "DOCA 2"],
                    ["estoque", "ESTOQUE"],
                    ["patio", "PÁTIO"],
                  ].map(([id, nome]) => (
                    <div key={id} className="cam">
                      <canvas data-cam={id} />
                      <span className="tag">{nome}</span>
                      <span className="rec">02:14:07</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="float alert glass" data-parallax="0.06">
                <span className="ic">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path
                      fill="#fff"
                      d="M21.4 4.6 2.9 11.7c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.4ZM9.3 14.3l8.7-5.5c.4-.3.8-.1.5.2l-7.2 6.5-.3 3.1-1.7-4.3Z"
                    />
                  </svg>
                </span>
                <div>
                  <b>Pessoa na doca fora do horário</b>
                  <span>Live.On - VS Transporte · agora</span>
                </div>
              </div>
              <div className="float shield glass" data-parallax="0.03">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path fill="none" stroke="#34d399" strokeWidth="2" d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3Z" />
                </svg>
                <div>
                  <div className="k">Escudo do gravador</div>
                  <div className="meter">
                    <i />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Pitch */}
        <section id="por-que">
          <div className="wrap">
            <div className="pitch-head">
              <div>
                <span className="eyebrow">Por que a Live.On</span>
                <h2 className="h2">Você já pagou pelas câmeras. Falta alguém olhando.</h2>
              </div>
              <p className="big-quote">
                Gravador que só grava serve para depois.{" "}
                <span>A Live.On serve para agora: vê, entende e avisa no seu celular.</span>
              </p>
            </div>
            <div className="pillars">
              <article className="pillar glass">
                <div className="mini">
                  <div className="brands">
                    {["Intelbras", "Hikvision", "Dahua"].map((m) => (
                      <div key={m}>
                        {m} <b>● conectado</b>
                      </div>
                    ))}
                  </div>
                </div>
                <h3>Usa o que você já tem</h3>
                <p>Nada de câmera nova ou técnico. Funciona com o gravador e as câmeras do local, em qualquer internet.</p>
              </article>
              <article className="pillar glass">
                <div className="mini">
                  <div className="toast">
                    <span className="ph" />
                    <div>
                      <b>Pessoa no portão · 02:14</b>
                      <span>com a foto do momento</span>
                    </div>
                  </div>
                </div>
                <h3>Avisa com a foto do momento</h3>
                <p>
                  A IA reconhece pessoas e manda o alerta no Telegram, com o print da câmera. Você conversa com o robô e pede
                  relatórios.
                </p>
              </article>
              <article className="pillar glass">
                <div className="mini">
                  <div className="lanes">
                    <svg viewBox="0 0 300 120" aria-hidden="true">
                      <rect x="12" y="44" width="62" height="32" rx="8" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.16)" />
                      <text x="43" y="64" fill="#a69fb8" style={mono} textAnchor="middle">
                        câmeras
                      </text>
                      <rect x="120" y="38" width="62" height="44" rx="10" fill="rgba(124,58,237,.25)" stroke="#a78bfa" />
                      <text x="151" y="64" fill="#f3effb" style={mono} textAnchor="middle">
                        escudo
                      </text>
                      <rect x="226" y="44" width="62" height="32" rx="8" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.16)" />
                      <text x="257" y="64" fill="#a69fb8" style={mono} textAnchor="middle">
                        gravador
                      </text>
                      <path d="M74 60H120M182 60H226" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
                      <path className="pulse" d="M74 60H120M182 60H226" stroke="#34d399" strokeWidth="2" fill="none" />
                      <path className="pulse d2" d="M74 60H120M182 60H226" stroke="#34d399" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                </div>
                <h3>Cuida do seu gravador</h3>
                <p>
                  Um escudo limita as conexões e o ritmo de cada pedido, para o gravador nunca travar, mesmo com o painel aberto
                  em vários celulares.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 3. Como funciona: a rolagem dentro da seção monta o painel, passo a passo */}
        <section id="como-funciona" className="how">
          <div className="how-track">
            <div className="how-sticky">
              <div className="wrap how-grid">
                <div>
                  <span className="eyebrow">Como funciona</span>
                  <h2 className="h2">Do cadastro ao primeiro alerta.</h2>
                  <ol className="steps">
                    {STEPS.map((s, i) => (
                      <li key={s.title} className={`step${i === 0 ? " on" : ""}`}>
                        <span className="n">{i + 1}</span>
                        <h3>{s.title}</h3>
                        <p>{s.text}</p>
                      </li>
                    ))}
                  </ol>
                  <div className="progress">
                    <i />
                  </div>
                </div>
                <div className="device glass">
                  <div className="dev-head">
                    <span>live.on/cameras</span>
                    <span id="devState">conectando…</span>
                  </div>
                  <div className="dev-body">
                    <div className="scene on">
                      <div className="connect">
                        <div className="dvr" />
                        <div className="field">
                          <div>
                            Endereço <b>192.168.0.68</b>
                          </div>
                          <div>
                            Usuário <b>admin</b>
                          </div>
                          <div>
                            Senha <b>••••••••</b>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="scene">
                      <div className="found">
                        {FOUND.map((n) => (
                          <div key={n} className="t" data-n={n} />
                        ))}
                      </div>
                      <p className="found-note">● 8 câmeras encontradas · canais vazios escondidos</p>
                    </div>
                    <div className="scene">
                      <div className="phone">
                        <div className="notch" />
                        <div className="msg">
                          <div className="pic" />
                          <b>🔔 Pessoa na doca fora do horário</b>
                          <span>📷 Doca 2 · 02:14</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Demonstração (simulador compacto de verdade) */}
        <section id="demonstracao">
          <div className="wrap">
            <span className="eyebrow">
              <i className="dot" />
              Demonstração
            </span>
            <h2 className="h2">Veja a IA trabalhando</h2>
            <p className="lead">
              Câmeras simuladas e o alerta chegando no celular do responsável. Vídeos gerados por computador; dados fictícios.
            </p>
            <div className="demo-frame demo-sim glass">
              <SimEmbed />
            </div>
            <a className="link-more" href="/simulacoes.html">
              Abrir simulação completa →
            </a>
          </div>
        </section>

        {/* 5. Para quem */}
        <section>
          <div className="wrap">
            <span className="eyebrow">Para quem já tem câmera</span>
            <h2 className="h2">Se você tem um gravador, a Live.On funciona com ele.</h2>
            <p className="lead">Se você tem um gravador (DVR) ou câmeras IP, a Live.On funciona com eles.</p>
            <div className="segs">
              {SEGMENTS.map((s) => (
                <article key={s.name} className="seg glass">
                  <h3>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d={s.icon} />
                    </svg>
                    {s.name}
                  </h3>
                  <ul>
                    {s.alerts.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Preço */}
        <section id="preco">
          <div className="wrap">
            <span className="eyebrow">Preço</span>
            <h2 className="h2">Você paga só pelas câmeras que monitorar.</h2>
            <p className="lead">Você paga só pelas câmeras que quiser monitorar. Sem comprar equipamento.</p>
            <div className="prices">
              <article className="price main glass">
                <h3>Assinatura por câmera</h3>
                <p className="val">
                  Em breve <small>por câmera/mês</small>
                </p>
                <p>O valor será anunciado no lançamento.</p>
                <ul>
                  {PRICE_ITEMS.map((i) => (
                    <li key={i}>
                      <Check />
                      {i}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="price glass">
                <h3>Teste grátis</h3>
                <p className="val">R$ 0</p>
                <p>Conecte suas câmeras e veja a Live.On funcionando antes de pagar qualquer coisa.</p>
                <div className="spacer" />
                <Link className="btn btn-main" href="/criar-conta">
                  Criar conta grátis
                </Link>
                <Link className="sub" href="/entrar">
                  Já tenho conta? Entrar
                </Link>
              </article>
            </div>
          </div>
        </section>

        {/* 7. Dúvidas */}
        <section id="duvidas">
          <div className="wrap">
            <span className="eyebrow">Dúvidas comuns</span>
            <h2 className="h2">O que perguntam antes de testar</h2>
            <div className="faq glass">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>
                    {f.q}
                    <span className="pl" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 8. Fechamento */}
        <section id="contato" className="close">
          <div className="wrap">
            <h2>Estamos abrindo as primeiras contas de teste.</h2>
            <p className="lead">Teste grátis com as suas câmeras, em troca do seu retorno sincero.</p>
            <a className="btn btn-main" href={CONTACT_URL}>
              Quero participar
            </a>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span>© 2026 Live.On</span>
          <span>Intelbras, Hikvision e Dahua são marcas de seus respectivos donos. A Live.On não é afiliada a esses fabricantes.</span>
        </div>
      </footer>
    </div>
  );
}
