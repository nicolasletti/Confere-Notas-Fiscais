import { useState } from "react";
import { ArrowRight, Check, FileCheck2, LockKeyhole } from "lucide-react";
import { Link } from "wouter";
import { useAppAuth } from "@/lib/auth-context";

function Wordmark() {
  return (
    <span className="font-display text-[1.55rem] font-bold tracking-[-0.07em] text-[#242744]">
      co<span className="text-[#4d58b3]">NF</span>ere
    </span>
  );
}

export default function Entrar() {
  const { isLoading, isAuthenticated, login } = useAppAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    setIsRedirecting(true);
    try {
      await login("/nota-fiscal");
    } catch {
      setError("Não foi possível iniciar seu acesso. Tente novamente.");
      setIsRedirecting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f8f6f0] text-[#242744]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="coNFere — início" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3]">
          <Wordmark />
        </Link>
        <Link href="/cadastro" className="text-sm font-semibold text-[#62647c] transition-colors hover:text-[#4d58b3]" data-testid="link-signup">
          Criar conta grátis <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-80px)] max-w-7xl items-center gap-12 px-5 pb-12 pt-6 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:gap-20 lg:px-12 lg:pb-20">
        <section className="relative max-w-xl py-8 lg:py-16" aria-labelledby="login-title">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dedbd2] bg-[#fffefa] px-3.5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#62647c] sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#bc7650]" />
            Seu balcão, em dia
          </p>
          <h1 id="login-title" className="font-display text-[clamp(2.8rem,6vw,5rem)] font-bold leading-[0.97] tracking-[-0.075em]">
            Bom ter você <span className="text-[#4d58b3]">de volta.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#62647c] sm:text-lg sm:leading-8">
            Entre para conferir pedidos e notas, identificar diferenças e manter o histórico da sua loja à mão.
          </p>

          <div className="mt-9 max-w-md rounded-[1.5rem] border border-[#e4e0d5] bg-[#fffefa] p-5 shadow-[0_20px_50px_-35px_rgba(39,43,79,.3)] sm:p-7">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef0fa] text-[#4d58b3]">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold tracking-[-0.035em]">Acesso seguro à sua conta</h2>
                <p className="mt-1.5 text-sm leading-6 text-[#77798b]">
                  No próximo passo, escolha entrar com e-mail e senha ou com Google.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-7 h-14 w-full animate-pulse rounded-full bg-[#eeece4]" aria-label="Verificando seu acesso" />
            ) : isAuthenticated ? (
              <Link href="/nota-fiscal" className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#4d58b3] px-6 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3] focus-visible:ring-offset-4" data-testid="link-continue-app">
                Ir para minha conta <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                disabled={isRedirecting}
                className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#4d58b3] px-6 text-sm font-bold text-white shadow-[0_12px_24px_-12px_rgba(54,62,143,.55)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d58b3] focus-visible:ring-offset-4"
                data-testid="button-login"
              >
                {isRedirecting ? "Abrindo acesso seguro…" : "Entrar na minha conta"}
                {!isRedirecting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
            {error && <p role="alert" className="mt-3 text-sm font-medium text-[#a44339]" data-testid="status-login-error">{error}</p>}
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[#77798b]">
              <Check className="h-3.5 w-3.5 text-[#537247]" aria-hidden="true" />
              Seus registros ficam associados à sua conta
            </p>
          </div>
          <p className="mt-6 max-w-md text-center text-sm text-[#77798b] sm:text-left">
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className="font-bold text-[#4d58b3] hover:text-[#343d91]" data-testid="link-create-account">
              Comece grátis
            </Link>
          </p>
        </section>

        <aside className="relative hidden min-h-[510px] items-center justify-center lg:flex" aria-label="Prévia da conferência de uma nota">
          <div className="absolute h-[440px] w-[440px] rotate-[-16deg] rounded-[48%] border border-[#dcd9d0]" />
          <div className="absolute h-[360px] w-[360px] rotate-[18deg] rounded-[48%] border border-dashed border-[#c9c7d9]" />
          <div className="relative w-[78%] rotate-[2deg] rounded-[1.4rem] border border-[#e4e0d5] bg-[#fffefa] p-7 shadow-[0_30px_80px_-36px_rgba(39,43,79,.34)]">
            <div className="flex items-start justify-between border-b border-dashed border-[#e2dfd6] pb-5">
              <div>
                <span className="text-[0.62rem] font-bold uppercase tracking-[0.17em] text-[#9696a0]">Conferência salva</span>
                <p className="mt-1 font-display text-xl font-bold tracking-tight">Distribuidora Horizonte</p>
              </div>
              <span className="rounded-lg bg-[#f1f0fa] px-2.5 py-1.5 font-mono text-xs font-bold text-[#4d58b3]">NF-e</span>
            </div>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-[#f5f3ec] p-4">
                <span className="flex items-center gap-3 text-sm font-semibold"><FileCheck2 className="h-4 w-4 text-[#4d58b3]" /> Pedido conferido</span>
                <span className="font-mono text-xs text-[#77798b]">há pouco</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#eeece5] pb-4 text-sm">
                <span className="text-[#62647c]">Itens revisados</span><span className="font-mono font-semibold">08</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#eeece5] pb-4 text-sm">
                <span className="text-[#62647c]">Diferença identificada</span><span className="rounded-full bg-[#fbf1df] px-3 py-1 font-mono text-xs font-bold text-[#8c6332]">R$ 38,40</span>
              </div>
              <div className="flex items-center gap-2 pt-1 text-xs font-semibold text-[#537247]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#edf4e9]"><Check className="h-3 w-3" /></span>
                Histórico guardado para consultar depois
              </div>
            </div>
          </div>
          <div className="absolute bottom-5 left-0 rounded-2xl border border-[#e4e0d5] bg-[#fffefa] px-5 py-4 shadow-[0_18px_40px_-25px_rgba(39,43,79,.4)]">
            <span className="block text-[0.62rem] font-bold uppercase tracking-[0.13em] text-[#9696a0]">Tudo no lugar</span>
            <span className="mt-1 block font-display text-lg font-bold">Pedido, nota e histórico.</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
