import Link from "next/link";
import SimEmbed from "@/components/SimEmbed";

// TODO: trocar pelo link real de contato (WhatsApp, formulário ou e-mail).
const CONTACT_URL = "#contato";

const STEPS = [
  {
    n: "1",
    title: "Assine e baixe o programa",
    text: "Crie a conta no site e instale o programa num computador que fique ligado no local das câmeras.",
  },
  {
    n: "2",
    title: "Ele encontra suas câmeras",
    text: "Informe o usuário e a senha do gravador. O programa acha as câmeras da rede sozinho, sem mexer no roteador.",
  },
  {
    n: "3",
    title: "Veja ao vivo e receba alertas",
    text: "As câmeras aparecem no painel, de qualquer lugar, e a IA avisa na hora quando algo importante acontece.",
  },
];

const SEGMENTS = [
  {
    name: "Comércio",
    alerts: ["Pessoa na loja fora do horário", "Contagem de quem entrou", "Alguém atrás do balcão", "Câmera sem sinal ou tampada"],
  },
  {
    name: "Escritório",
    alerts: ["Movimento depois do expediente", "Alguém na sala restrita", "Contagem de visitantes", "Câmera sem sinal ou tampada"],
  },
  {
    name: "Condomínio",
    alerts: ["Pessoa na garagem de madrugada", "Alguém na área da piscina fechada", "Movimento no muro", "Câmera sem sinal ou tampada"],
  },
  {
    name: "Residência",
    alerts: ["Pessoa no quintal à noite", "Alguém no portão com a casa vazia", "Movimento na área marcada", "Câmera sem sinal ou tampada"],
  },
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
    a: "Não. A Live.On funciona com as câmeras e o gravador que você já tem, de marcas como Intelbras, Hikvision e Dahua.",
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

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Cabeçalho */}
      <header className="sticky top-7 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm font-extrabold text-white">
              L
            </span>
            Live.On
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#como-funciona" className="hover:text-brand">Como funciona</a>
            <a href="#demonstracao" className="hover:text-brand">Demonstração</a>
            <a href="#preco" className="hover:text-brand">Preço</a>
            <a href="#duvidas" className="hover:text-brand">Dúvidas</a>
          </nav>
          <a
            href={CONTACT_URL}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Testar grátis
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 md:pt-24">
          <p className="text-sm font-semibold text-brand">Monitoramento inteligente de câmeras</p>
          <h1 className="mt-3 max-w-4xl font-display text-[clamp(38px,6.5vw,72px)] leading-[1.02] font-extrabold tracking-tight text-balance">
            Suas câmeras viram olhos que avisam.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Quase ninguém assiste às próprias câmeras. A Live.On mostra as suas ao vivo, de qualquer lugar, e avisa na
            hora quando algo importante acontece, como uma pessoa fora do horário ou uma câmera tampada.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={CONTACT_URL} className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark">
              Quero testar grátis
            </a>
            <a href="#demonstracao" className="rounded-full border border-line px-6 py-3 font-semibold hover:border-brand hover:text-brand">
              Ver demonstração
            </a>
          </div>
          <dl className="mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["0", "câmeras para trocar"],
              ["0", "visitas técnicas"],
              ["100%", "online, do cadastro à instalação"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-line p-4">
                <dt className="font-display text-3xl font-bold tracking-tight">{v}</dt>
                <dd className="text-sm text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="border-y border-line bg-soft">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Como funciona</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-2xl border border-line bg-white p-6">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand font-display font-bold text-white">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Demonstração (simulador compacto) */}
        <section id="demonstracao" className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Veja a IA trabalhando</h2>
              <p className="mt-2 max-w-2xl text-muted">
                Câmeras simuladas e o alerta chegando no celular do responsável. Vídeos gerados por computador; dados
                fictícios.
              </p>
            </div>
            <a href="/simulacoes.html" className="text-sm font-semibold text-brand hover:underline">
              Abrir simulação completa →
            </a>
          </div>
          <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-white p-3 sm:p-5">
            <SimEmbed />
          </div>
        </section>

        {/* Para quem */}
        <section className="border-y border-line bg-soft">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Para quem já tem câmera</h2>
            <p className="mt-2 max-w-2xl text-muted">Se você tem um gravador (DVR) ou câmeras IP, a Live.On funciona com eles.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SEGMENTS.map((s) => (
                <div key={s.name} className="rounded-2xl border border-line bg-white p-5">
                  <h3 className="font-semibold">{s.name}</h3>
                  <ul className="mt-3 space-y-1.5 text-sm text-muted">
                    {s.alerts.map((a) => (
                      <li key={a} className="flex gap-2">
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preço */}
        <section id="preco" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Preço</h2>
          <p className="mt-2 text-muted">Você paga só pelas câmeras que quiser monitorar. Sem comprar equipamento.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col rounded-2xl border border-brand bg-brand p-6 text-white">
              <h3 className="font-semibold">Assinatura por câmera</h3>
              <p className="mt-3 font-display text-4xl font-bold tracking-tight">
                Em breve
                <span className="text-base font-medium text-white/80"> por câmera/mês</span>
              </p>
              <p className="mt-2 text-sm text-white/80">O valor será anunciado no lançamento.</p>
              <ul className="mt-5 space-y-2 text-sm">
                {PRICE_ITEMS.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col rounded-2xl border border-line bg-white p-6">
              <h3 className="font-semibold">Teste grátis</h3>
              <p className="mt-3 font-display text-4xl font-bold tracking-tight">R$ 0</p>
              <p className="mt-2 text-sm text-muted">
                Conecte suas câmeras e veja a Live.On funcionando antes de pagar qualquer coisa.
              </p>
              <a
                href={CONTACT_URL}
                className="mt-auto rounded-full bg-brand px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Quero testar grátis
              </a>
            </div>
          </div>
        </section>

        {/* Dúvidas */}
        <section id="duvidas" className="border-y border-line bg-soft">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Dúvidas comuns</h2>
            <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white">
              {FAQ.map((f) => (
                <details key={f.q} className="group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {f.q}
                    <span aria-hidden className="text-brand transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Contato */}
        <section id="contato" className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-balance md:text-5xl">
            Estamos abrindo as primeiras contas de teste.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Teste grátis com as suas câmeras, em troca do seu retorno sincero.
          </p>
          <a
            href={CONTACT_URL}
            className="mt-8 inline-block rounded-full bg-brand px-8 py-3.5 font-semibold text-white hover:bg-brand-dark"
          >
            Quero participar
          </a>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
          <span>© 2026 Live.On</span>
          <span>Intelbras, Hikvision e Dahua são marcas de seus respectivos donos. A Live.On não é afiliada a esses fabricantes.</span>
        </div>
      </footer>
    </div>
  );
}
