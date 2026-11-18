import { FileCheck2, FileText, ListChecks, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function AppHeader() {
  const [location] = useLocation();

  const links = [
    { href: "/pedido", label: "Pedido", icon: ListChecks },
    { href: "/", label: "Nota fiscal", icon: FileText },
    { href: "/conferencia", label: "Conferência", icon: FileCheck2 },
  ];

  return (
    <header className="border-b bg-card/70">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground">C</span>
          <span className="font-display text-xl font-bold tracking-tight">Confere</span>
        </Link>

        <nav aria-label="Navegação principal" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
          {links.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                data-testid={`link-${href === "/" ? "nota-fiscal" : href.slice(1)}`}
                className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <p className="hidden items-center gap-1.5 text-sm text-muted-foreground lg:flex">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          O arquivo é lido só no seu navegador
        </p>
      </div>
    </header>
  );
}
