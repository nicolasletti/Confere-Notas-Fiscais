import { FileCheck2, FileText, ListChecks, ShieldCheck, Store } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function AppHeader() {
  const [location] = useLocation();

  const links = [
    { href: "/pedido", label: "Pedido", icon: ListChecks },
    { href: "/nota-fiscal", label: "Nota fiscal", icon: FileText },
    { href: "/conferencia", label: "Conferência", icon: FileCheck2 },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-5 sm:py-4">
        <Link href="/nota-fiscal" aria-label="coNFere — nota fiscal" className="group flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-testid="link-home">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/15 bg-primary/10 font-display text-lg font-bold text-primary transition-transform group-hover:-rotate-3" aria-hidden="true">c</span>
          <span className="font-display text-[1.35rem] font-bold tracking-[-0.055em] text-foreground">
            co<span className="text-primary">NF</span>ere
          </span>
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

        <p className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground lg:flex">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          O arquivo é lido só no seu navegador
        </p>
      </div>
    </header>
  );
}
