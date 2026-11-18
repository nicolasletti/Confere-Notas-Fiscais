import { useListAccountConferences, type ConferenceRecord } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Building2, FileText, History, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import IbsCbsSeal from "@/components/ibs-cbs-seal";
import {
  normalizeSupplierName,
} from "@/lib/conference-history";
import { formatBRL } from "@/lib/reconciliation";

interface SupplierSummary {
  key: string;
  name: string;
  invoiceCount: number;
  totalExtraChargeCents: bigint;
  latestInvoice: ConferenceRecord;
}

function summarizeSuppliers(records: ConferenceRecord[]): SupplierSummary[] {
  const bySupplier = new Map<string, ConferenceRecord[]>();
  for (const record of records) {
    const key = normalizeSupplierName(record.supplierName);
    const supplierRecords = bySupplier.get(key) ?? [];
    supplierRecords.push(record);
    bySupplier.set(key, supplierRecords);
  }

  return Array.from(bySupplier, ([key, supplierRecords]) => {
    const sorted = [...supplierRecords].sort((left, right) =>
      Date.parse(right.issuedAt) - Date.parse(left.issuedAt) ||
      Date.parse(right.savedAt) - Date.parse(left.savedAt),
    );
    const latestInvoice = sorted[0]!;
    return {
      key,
      name: latestInvoice.supplierName,
      invoiceCount: sorted.length,
      totalExtraChargeCents: sorted.reduce(
        (total, record) => total + BigInt(record.totalExtraChargeCents),
        0n,
      ),
      latestInvoice,
    };
  }).sort((left, right) => left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }));
}

function formatInvoiceDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

export default function Fornecedores() {
  const historyQuery = useListAccountConferences();
  const suppliers = summarizeSuppliers(historyQuery.data ?? []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-10">
      <section className="rise">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary sm:text-sm">
          Histórico da conta
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Fornecedores
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Acompanhe as notas conferidas, os valores cobrados a mais e o selo da nota mais recente.
          As conferências ficam salvas na sua conta.
        </p>

        {historyQuery.isLoading && (
          <p className="mt-6 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground" role="status">
            Carregando seu histórico...
          </p>
        )}

        {historyQuery.isError && (
          <div
            className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive"
            role="alert"
            data-testid="warning-supplier-history"
          >
            <p>Não foi possível carregar o histórico.</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void historyQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {!historyQuery.isLoading && !historyQuery.isError && (
          suppliers.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-border/80 bg-card px-5 py-10 text-center shadow-sm sm:px-8">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <History className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-display text-xl font-bold">Nenhuma conferência salva</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Depois de revisar todos os itens de uma nota, salve a conferência para incluir o fornecedor neste histórico.
              </p>
              <Button asChild className="mt-6">
                <Link href="/nota-fiscal" data-testid="link-start-conference">
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                  Abrir nota fiscal
                </Link>
              </Button>
            </div>
          ) : <div className="mt-8 space-y-4" data-testid="list-suppliers">
            {suppliers.map((supplier, index) => (
              <article
                key={supplier.key}
                className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
                data-testid={`card-supplier-${index}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <h2 className="break-words font-display text-xl font-bold leading-snug sm:text-2xl">
                        {supplier.name}
                      </h2>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground" data-testid={`text-latest-invoice-${index}`}>
                      Última nota: nº {supplier.latestInvoice.invoiceNumber} · {formatInvoiceDate(supplier.latestInvoice.issuedAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-1.5 sm:items-end">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Selo da última nota
                    </span>
                    <IbsCbsSeal ready={supplier.latestInvoice.hasCompleteIbsCbs} />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-muted/60 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Notas conferidas
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold tabular-nums" data-testid={`text-invoice-count-${index}`}>
                      {supplier.invoiceCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-red-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
                      Total cobrado a mais
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold tracking-tight tabular-nums text-red-900" data-testid={`text-supplier-extra-charge-${index}`}>
                      {formatBRL(supplier.totalExtraChargeCents)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
