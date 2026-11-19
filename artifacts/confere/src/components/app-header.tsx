import { Building2, FileCheck2, FileText, LayoutDashboard, ListChecks, LogOut, PackageSearch, Store } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAppAuth } from "@/lib/auth-context";
import { useGetAccountCompany } from "@workspace/api-client-react";

export default function AppHeader() {
  const [location] = useLocation();
  const { user, isLoading, logout } = useAppAuth();
  const companyQuery = useGetAccountCompany();
  const company = companyQuery.data?.profile;
  const accountLabel = company?.name?.trim() || user?.email || "Minha conta";
  const basePath = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  const logoSrc = company?.hasLogo
    ? `${basePath}api/account/company/logo?updated=${encodeURIComponent(company.updatedAt)}`
    : null;

  const links = [
    { href: "/pedido", label: "Pedido", icon: ListChecks },
    { href: "/nota-fiscal", label: "Nota fiscal", icon: FileText },
    { href: "/conferencia", label: "Conferência", icon: FileCheck2 },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-5 sm:py-4">
        <Link href="/painel" aria-label="coNFere — painel" className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-testid="link-home">
          <span className="font-display text-[1.35rem] font-bold tracking-[-0.055em] text-foreground">
            co<span className="text-primary">NF</span>ere
          </span>
        </Link>

        <Link
          href="/painel"
          aria-current={location === "/painel" ? "page" : undefined}
          data-testid="link-painel"
          className={`order-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:order-none ${
            location === "/painel" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Painel
        </Link>

        <Link
          href="/reposicao"
          aria-current={location === "/reposicao" ? "page" : undefined}
          data-testid="link-reposicao"
          className={`order-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:order-none ${
            location === "/reposicao" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <PackageSearch className="h-4 w-4" aria-hidden="true" />
          Reposição
        </Link>

        <Link
          href="/fornecedores"
          aria-current={location === "/fornecedores" ? "page" : undefined}
          data-testid="link-fornecedores"
          className={`order-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:order-none ${
            location === "/fornecedores"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <Store className="h-4 w-4" aria-hidden="true" />
          Fornecedores
        </Link>

        <Link
          href="/minha-empresa"
          aria-current={location === "/minha-empresa" ? "page" : undefined}
          data-testid="link-minha-empresa"
          className={`order-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:order-none ${
            location === "/minha-empresa"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Minha empresa
        </Link>

        <nav aria-label="Etapas do Confere" className="order-3 grid w-full grid-cols-3 gap-1 rounded-xl border border-border/80 bg-muted/60 p-1 sm:order-none sm:w-auto sm:min-w-[390px]">
          {links.map(({ href, label, icon: Icon }, index) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                data-testid={`link-${href === "/nota-fiscal" ? "nota-fiscal" : href.slice(1)}`}
                className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 text-center text-[0.7rem] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:justify-start sm:gap-2 sm:px-3 sm:text-sm ${
                  active
                    ? "bg-card text-primary shadow-sm ring-1 ring-border/70"
                    : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                }`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.65rem] font-bold sm:h-6 sm:w-6 ${active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`} aria-hidden="true">{index + 1}</span>
                <span className="truncate">{label}</span>
                <Icon className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
              </Link>
            );
          })}
        </nav>

        <div className="order-1 ml-auto flex min-w-0 items-center gap-2 sm:order-none sm:ml-0 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-border/80 bg-card/80 py-1.5 pl-1.5 pr-3">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="h-8 w-8 shrink-0 rounded-full border border-border/70 bg-background object-contain p-0.5" data-testid="img-company-logo-header" />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary" aria-hidden="true">
                {isLoading ? "…" : accountLabel.charAt(0).toLocaleUpperCase()}
              </span>
            )}
            <span className="max-w-[112px] truncate text-xs font-semibold text-foreground sm:max-w-[170px]" data-testid="text-account-name" title={accountLabel}>
              {isLoading ? "Carregando conta" : accountLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-3 sm:text-sm"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
