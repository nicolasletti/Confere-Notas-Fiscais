import { useState } from "react";
import { ArrowRight, BadgeCheck, FileCheck2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useAppAuth } from "@/lib/auth-context";

function Wordmark() {
  return (
    <span className="font-display text-[1.55rem] font-bold tracking-[-0.07em] text-[#242744]">
      co<span className="text-[#4d58b3]">NF</span>ere
    </span>
  );
}

export default function Cadastro() {
  const { isLoading, isAuthenticated, signup } = useAppAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup() {
    setError("");
    setIsRedirecting(true);
    try {
      await signup("/minha-empresa");
    } catch {
      setError("Não foi possível iniciar seu cadastro. Tente novamente.");
      setIsRedirecting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f8f6f0] text-[#242744]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="coNFere — início" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3]">
          <Wordmark />
        </Link>
        <Link href="/entrar" className="text-sm font-semibold text-[#62647c] transition-colors hover:text-[#4d58b3]" data-testid="link-login">
          Já tenho conta
        </Link>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-80px)] max-w-7xl items-center gap-12 px-5 pb-12 pt-6 sm:px-8 lg:grid-cols-[0.9fr_1fr] lg:gap-20 lg:px-12 lg:pb-20">
        <section className="relative order-2 hidden min-h-[500px] items-center justify-center lg:order-1 lg:flex" aria-label="Resumo dos benefícios da coNFere">
          <div className="absolute left-[12%] top-[9%] h-[390px] w-[390px] rounded-full border border-[#dedbd2]" />
          <div className="absolute left-[19%] top-[16%] h-[335px] w-[335px] rounded-full border border-dashed border-[#c9c7d9]" />
          <div className="relative w-[78%] -rotate-[2deg] rounded-[1.5rem] border border-[#e4e0d5] bg-[#fffefa] p-7 shadow-[0_30px_80px_-36px_rgba(39,43,79,.34)]">
            <div className="flex items-center justify-between border-b border-dashed border-[#e2dfd6] pb-5">
              <div>
                <span className="text-[0.62rem] font-bold uppercase tracking-[0.17em] text-[#9696a0]">Primeira conferência</span>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">Mais segurança na compra.</h2>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef0fa] text-[#4d58b3]"><FileCheck2 className="h-5 w-5" /></span>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-[#f5f3ec] p-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e9e8f4] text-[#4d58b3]"><span className="font-mono text-xs font-bold">01</span></span>
                <div><span className="block text-sm font-bold">Pedido do fornecedor</span><span className="text-xs text-[#77798b]">O combinado, sem retrabalho</span></div>
                <BadgeCheck className="ml-auto h-4 w-4 text-[#537247]" />
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-[#f5f3ec] p-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e9e8f4] text-[#4d58b3]"><span className="font-mono text-xs font-bold">02</span></span>
                <div><span className="block text-sm font-bold">Nota fiscal</span><span className="text-xs text-[#77798b]">O que realmente chegou</span></div>
                <BadgeCheck className="ml-auto h-4 w-4 text-[#537247]" />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-[#e6dfcf] bg-[#fbf7ed] p-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f1e5ce] text-[#8c6332]"><Sparkles className="h-4 w-4" /></span>
                <div><span className="block text-sm font-bold">Diferenças claras</span><span className="text-xs text-[#77798b]">Com valor e histórico guardado</span></div>
                <ArrowRight className="ml-auto h-4 w-4 text-[#8c6332]" />
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 right-2 rounded-full border border-[#d69c57] bg-[#f8f1e4] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8c6332]">
            Feito para o balcão
          </div>
        </section>

        <section className="order-1 max-w-xl py-8 lg:order-2 lg:py-16" aria-labelledby="signup-title">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dedbd2] bg-[#fffefa] px-3.5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#62647c] sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#bc7650]" />
            Comece sem complicar
          </p>
          <h1 id="signup-title" className="font-display text-[clamp(2.8rem,6vw,5rem)] font-bold leading-[0.97] tracking-[-0.075em]">
            Seu dinheiro merece <span className="text-[#4d58b3]">conferência.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#62647c] sm:text-lg sm:leading-8">
            Crie seu acesso e compare o pedido do fornecedor com a NF-e. Sem certificado digital, sem mudar o jeito de cuidar da loja.
          </p>

          <div className="mt-9 max-w-md rounded-[1.5rem] border border-[#e4e0d5] bg-[#fffefa] p-5 shadow-[0_20px_50px_-35px_rgba(39,43,79,.3)] sm:p-7">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f8f1e4] text-[#8c6332]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold tracking-[-0.035em]">Conta pronta para começar</h2>
                <p className="mt-1.5 text-sm leading-6 text-[#77798b]">
                  No próximo passo, escolha criar seu acesso com e-mail e senha ou com Google.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-7 h-14 w-full animate-pulse rounded-full bg-[#eeece4]" aria-label="Verificando seu acesso" />
            ) : isAuthenticated ? (
              <Link href="/painel" className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#4d58b3] px-6 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3] focus-visible:ring-offset-4" data-testid="link-continue-app">
                Ir para minha conta <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleSignup}
                disabled={isRedirecting}
                className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#4d58b3] px-6 text-sm font-bold text-white shadow-[0_12px_24px_-12px_rgba(54,62,143,.55)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3] focus-visible:ring-offset-4"
                data-testid="button-signup"
              >
                {isRedirecting ? "Abrindo cadastro seguro…" : "Criar minha conta grátis"}
                {!isRedirecting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
            {error && <p role="alert" className="mt-3 text-sm font-medium text-[#a44339]" data-testid="status-signup-error">{error}</p>}
            <p className="mt-4 text-center text-xs leading-5 text-[#77798b]">
              Ao continuar, você poderá comparar seus pedidos e notas com clareza.
            </p>
          </div>
          <p className="mt-6 max-w-md text-center text-sm text-[#77798b] sm:text-left">
            Já tem acesso?{" "}
            <Link href="/entrar" className="font-bold text-[#4d58b3] hover:text-[#343d91]" data-testid="link-signin">
              Entre na sua conta
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
