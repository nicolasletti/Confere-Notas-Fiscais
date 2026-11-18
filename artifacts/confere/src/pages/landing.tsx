import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Boxes,
  CircleDollarSign,
  FileCheck2,
  FileUp,
  MessageSquareText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";

const problems = [
  { icon: CircleDollarSign, label: "preço acima do combinado", mark: "R$" },
  { icon: Boxes, label: "quantidade cobrada que não chegou", mark: "×" },
  { icon: ShoppingBag, label: "item que você não pediu", mark: "?" },
];

const steps = [
  { icon: MessageSquareText, number: "01", label: "cole seu pedido do WhatsApp" },
  { icon: FileUp, number: "02", label: "suba o XML da nota" },
  { icon: FileCheck2, number: "03", label: "veja quanto foi cobrado a mais e envie a cobrança" },
];

const benefits = [
  { icon: MessageSquareText, label: "funciona com pedido feito pelo WhatsApp" },
  { icon: ShieldCheck, label: "sem certificado digital e sem ERP" },
  { icon: CircleDollarSign, label: "mostra o prejuízo em reais" },
  { icon: BadgeCheck, label: "prepara você para a reforma tributária (IBS/CBS)" },
  { icon: ShoppingBag, label: "avisa quando comprar de novo" },
];

function Wordmark() {
  return (
    <span className="font-display text-[1.55rem] font-bold tracking-[-0.07em] text-[#242744]">
      co<span className="text-[#4d58b3]">NF</span>ere
    </span>
  );
}

export default function Landing() {
  return (
    <div className="landing min-h-[100dvh] overflow-hidden bg-[#f8f6f0] text-[#242744]">
      <header className="landing-header mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3]" aria-label="coNFere — início">
          <Wordmark />
        </Link>
        <nav aria-label="Acesso" className="flex items-center gap-2 sm:gap-3">
          <Link href="/entrar" className="inline-flex min-h-10 items-center rounded-full px-3 text-xs font-semibold transition-colors hover:text-[#4d58b3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3] sm:px-4 sm:text-sm" data-testid="link-login">
            Entrar
          </Link>
          <Link href="/cadastro" className="inline-flex min-h-10 items-center rounded-full border border-[#d8d6cf] px-4 text-xs font-semibold transition-colors hover:border-[#4d58b3] hover:text-[#4d58b3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3] sm:px-5 sm:text-sm" data-testid="link-create-account">
            Criar conta grátis
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-14 lg:grid-cols-[1fr_0.95fr] lg:gap-16 lg:px-12 lg:pt-16">
          <div className="landing-reveal relative z-10 max-w-2xl">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dedbd2] bg-[#fffefa] px-3.5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#62647c] sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#bc7650]" />
              Conferência de notas para pequenos comércios
            </p>
            <h1 className="font-display text-[clamp(3.2rem,8.2vw,6.65rem)] font-bold leading-[0.94] tracking-[-0.075em]">
              Toda nota conferida,
              <span className="relative mt-1 block text-[#4d58b3]">
                nenhum real perdido.
                <svg className="landing-underline absolute -bottom-3 left-0 w-[84%]" viewBox="0 0 520 18" fill="none" aria-hidden="true">
                  <path d="M3 12C111 3 256 3 517 10" stroke="#d69c57" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-8 max-w-lg text-base leading-7 text-[#62647c] sm:text-lg sm:leading-8">
              Suba a nota do fornecedor e descubra em segundos se você foi cobrado errado.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href="/cadastro" className="landing-cta group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#4d58b3] px-7 text-base font-bold text-white shadow-[0_12px_24px_-12px_rgba(54,62,143,.55)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3] focus-visible:ring-offset-4 sm:w-auto" data-testid="link-start-upload">
                Começar agora
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
              <span className="text-xs font-medium text-[#77798b]">Sem complicar a rotina do balcão.</span>
            </div>
            <a href="#como-funciona" className="mt-11 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#77798b] transition-colors hover:text-[#4d58b3]">
              Entenda em 3 passos <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          <div className="landing-art relative mx-auto w-full max-w-[570px] lg:ml-auto" aria-label="Ilustração de conferência de uma nota fiscal">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />
            <div className="landing-art-sticker"><span>co</span><b>NF</b><span>ere</span></div>
            <div className="invoice-paper relative z-10 mx-auto w-[86%] max-w-[410px] rotate-[2deg] rounded-[1.35rem] border border-[#e4e0d5] bg-[#fffefa] p-5 shadow-[0_28px_70px_-32px_rgba(39,43,79,.38)] sm:p-7">
              <div className="flex items-start justify-between border-b border-dashed border-[#e2dfd6] pb-5">
                <div>
                  <span className="text-[0.62rem] font-bold uppercase tracking-[0.17em] text-[#9696a0]">Nota fiscal</span>
                  <p className="mt-1 font-display text-xl font-bold tracking-tight">Recebimento de mercadoria</p>
                </div>
                <span className="rounded-lg bg-[#f1f0fa] px-2.5 py-1.5 font-mono text-xs font-bold text-[#4d58b3]">NF-e</span>
              </div>
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#9696a0]">
                  <span>Item</span><span>Pedido</span><span>Nota</span>
                </div>
                <div className="invoice-line">
                  <span className="text-sm font-semibold">Produto combinado</span>
                  <span className="font-mono text-xs text-[#77798b]">12 un.</span>
                  <span className="invoice-check">12 un.</span>
                </div>
                <div className="invoice-line">
                  <span className="text-sm font-semibold">Valor unitário</span>
                  <span className="font-mono text-xs text-[#77798b]">R$ ···</span>
                  <span className="invoice-flag">Conferir</span>
                </div>
                <div className="invoice-line">
                  <span className="text-sm font-semibold">Outro item</span>
                  <span className="font-mono text-xs text-[#77798b]">—</span>
                  <span className="invoice-flag">Conferir</span>
                </div>
              </div>
              <div className="mt-6 rounded-xl bg-[#f5f3ec] px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#77798b]">Resumo da conferência</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e5e7f6] text-[#4d58b3]"><FileCheck2 className="h-3.5 w-3.5" /></span>
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="h-1.5 flex-1 rounded-full bg-[#4d58b3]" />
                  <span className="h-1.5 flex-1 rounded-full bg-[#d69c57]" />
                  <span className="h-1.5 flex-1 rounded-full bg-[#d69c57]" />
                </div>
              </div>
            </div>
            <div className="floating-note absolute -bottom-5 left-0 z-20 flex items-center gap-3 rounded-2xl border border-[#e4e0d5] bg-[#fffefa] px-4 py-3 shadow-[0_18px_40px_-25px_rgba(39,43,79,.4)] sm:-left-2 sm:px-5 sm:py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef0fa] text-[#4d58b3]"><Sparkles className="h-4 w-4" /></span>
              <span><b className="block text-xs font-bold">Diferenças à vista</b><small className="mt-0.5 block text-[0.65rem] text-[#77798b]">Pedido e nota lado a lado</small></span>
            </div>
            <div className="landing-stamp absolute -right-1 top-7 z-20 grid h-[82px] w-[82px] -rotate-12 place-items-center rounded-full border border-[#d69c57] bg-[#f8f1e4] text-center text-[0.58rem] font-bold uppercase leading-tight tracking-[0.11em] text-[#8c6332] sm:-right-3 sm:h-[96px] sm:w-[96px]">
              Feito para<br />o balcão
            </div>
          </div>
        </section>

        <section className="relative bg-[#eeece4] py-16 sm:py-24" aria-labelledby="problema-title">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="max-w-xl">
              <p className="landing-kicker">O problema</p>
              <h2 id="problema-title" className="mt-3 font-display text-3xl font-bold leading-tight tracking-[-0.045em] sm:text-5xl">
                A nota chega. E junto, a dúvida.
              </h2>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-3 sm:gap-4">
              {problems.map(({ icon: Icon, label, mark }, index) => (
                <article key={label} className="problem-tile group min-h-[170px] rounded-2xl border border-[#ddd9ce] bg-[#f8f6f0] p-5 transition-transform hover:-translate-y-1 sm:p-6" data-testid={`problem-${index}`}>
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e9e8f4] text-[#4d58b3]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                    <span className="font-mono text-sm font-bold text-[#c1bdb2]">{mark}</span>
                  </div>
                  <h3 className="mt-7 max-w-[14rem] font-display text-xl font-bold leading-snug tracking-[-0.03em]">{label}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-8 py-20 sm:py-28" aria-labelledby="steps-title">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <div className="max-w-md">
                <p className="landing-kicker">Sem mudar seu jeito de trabalhar</p>
                <h2 id="steps-title" className="mt-3 font-display text-4xl font-bold leading-[1.02] tracking-[-0.055em] sm:text-5xl">
                  Como funciona
                </h2>
                <p className="mt-5 text-base leading-7 text-[#62647c]">
                  Do combinado no WhatsApp à nota que chegou na loja: confira cada etapa com clareza.
                </p>
                <Link href="/cadastro" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#4d58b3] transition-colors hover:text-[#343d91]">
                  Começar agora <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <ol className="step-list">
                {steps.map(({ icon: Icon, number, label }) => (
                  <li key={number} className="step-row">
                    <span className="step-number">{number}</span>
                    <span className="step-icon"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                    <h3 className="font-display text-xl font-bold leading-snug tracking-[-0.025em] sm:text-2xl">{label}</h3>
                    <ArrowRight className="step-arrow hidden h-4 w-4 sm:block" aria-hidden="true" />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="benefit-band relative overflow-hidden bg-[#333b83] py-16 text-[#fffefa] sm:py-24" aria-labelledby="benefits-title">
          <div className="benefit-graphic" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16 lg:px-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d4d6ef]">Diferenciais</p>
              <h2 id="benefits-title" className="mt-4 max-w-sm font-display text-4xl font-bold leading-[1.02] tracking-[-0.055em] sm:text-5xl">
                Mais clareza entre o pedido e a nota.
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-6 text-[#d5d7ed]">
                Uma conferência que cabe na rotina de quem cuida de tudo na loja.
              </p>
            </div>
            <ul className="benefit-list">
              {benefits.map(({ icon: Icon, label }, index) => (
                <li key={label} className="benefit-item" data-testid={`benefit-${index}`}>
                  <span className="benefit-icon"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                  <span>{label}</span>
                  <BadgeCheck className="ml-auto h-4 w-4 shrink-0 text-[#d9bd86]" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="closing-wrap px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div className="closing-panel relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#e8e7f2] px-6 py-11 sm:px-12 sm:py-14 lg:px-16">
            <div className="closing-ornament" aria-hidden="true">NF</div>
            <div className="relative max-w-2xl">
              <p className="landing-kicker">A próxima nota pode esperar menos</p>
              <h2 className="mt-3 font-display text-4xl font-bold leading-[1.02] tracking-[-0.055em] sm:text-5xl">
                Confira antes de guardar.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#62647c]">Comece pela nota fiscal que chegou hoje.</p>
              <Link href="/cadastro" className="landing-cta group mt-7 inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-[#4d58b3] px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3] focus-visible:ring-offset-4" data-testid="link-final-upload">
                Começar agora <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer mx-auto flex max-w-7xl flex-col gap-3 border-t border-[#e1ded5] px-5 py-6 text-xs text-[#77798b] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Link href="/" className="w-fit" aria-label="coNFere — início"><Wordmark /></Link>
        <p>Projeto desenvolvido no Desafio Replit PUCPR 2026</p>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.12em]">coNFere · 2026</span>
      </footer>
    </div>
  );
}
