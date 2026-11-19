import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  getMonthlyReport,
  getGetMonthlyDashboardQueryKey,
  useGetMonthlyDashboard,
  type MonthlyDashboard,
  type MonthlyMetrics,
  type MonthlySupplier,
} from "@workspace/api-client-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, FileUp, Info, Loader2, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import IbsCbsSeal from "@/components/ibs-cbs-seal";
import { formatBRL, formatDecimal } from "@/lib/reconciliation";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function currentMonthSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2025";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1] ?? "?"} de ${y}`;
}

const brl = (cents: string) => {
  try { return formatBRL(BigInt(cents)); } catch { return "R$ —"; }
};
const big = (cents: string) => { try { return BigInt(cents); } catch { return 0n; } };

type Delta = { kind: "none" } | { kind: "same" } | { kind: "up" | "down"; label: string };
function compare(current: bigint, previous: bigint): Delta {
  if (previous <= 0n) return { kind: "none" };
  const diff = current - previous;
  if (diff === 0n) return { kind: "same" };
  const abs = diff < 0n ? -diff : diff;
  const tenths = (abs * 1000n + previous / 2n) / previous; // rounded tenths of percent
  const txt = `${(tenths / 10n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${tenths % 10n}%`;
  return { kind: diff > 0n ? "up" : "down", label: `${diff > 0n ? "+" : "−"}${txt}` };
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

function DeltaBadge({ delta, unit, testId }: { delta: Delta; unit: string; testId: string }) {
  if (delta.kind === "none")
    return <span data-testid={testId} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" aria-hidden />sem base no mês anterior</span>;
  if (delta.kind === "same")
    return <span data-testid={testId} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" aria-hidden />igual ao mês anterior</span>;
  const Icon = delta.kind === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span data-testid={testId} className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
      <span className="font-mono">{delta.label}</span>
      <span className="font-normal text-muted-foreground">{unit} vs. mês anterior</span>
    </span>
  );
}

function MetricCard({ label, value, delta, unit, tone, testId, hint }: {
  label: string; value: string; delta: Delta; unit: string; tone?: "alert"; testId: string; hint?: string;
}) {
  return (
    <div className={`rise rounded-xl border bg-card p-4 sm:p-5 ${tone === "alert" ? "border-destructive/30 bg-destructive/[0.03]" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p data-testid={testId} className={`mt-1 font-display text-2xl font-bold tracking-tight sm:text-[1.7rem] ${tone === "alert" ? "text-destructive" : "text-foreground"}`}>{value}</p>
      <div className="mt-2"><DeltaBadge delta={delta} unit={unit} testId={`${testId}-delta`} /></div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Metrics({ data }: { data: MonthlyDashboard }) {
  const c: MonthlyMetrics = data.current, p: MonthlyMetrics = data.previous;
  return (
    <section aria-label="Resumo do mês" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Total comprado no mês" value={brl(c.purchasedCents)} delta={compare(big(c.purchasedCents), big(p.purchasedCents))} unit="em compras" testId="text-metric-purchased" hint={`Mês anterior: ${brl(p.purchasedCents)}`} />
      <MetricCard label="Número de notas" value={String(c.invoiceCount)} delta={compare(BigInt(c.invoiceCount), BigInt(p.invoiceCount))} unit="em notas" testId="text-metric-invoices" hint={`Mês anterior: ${p.invoiceCount}`} />
      <MetricCard label="Total cobrado a mais encontrado" value={brl(c.extraChargeCents)} delta={compare(big(c.extraChargeCents), big(p.extraChargeCents))} unit="cobrado a mais" tone={big(c.extraChargeCents) > 0n ? "alert" : undefined} testId="text-metric-extra" hint={`Mês anterior: ${brl(p.extraChargeCents)}`} />
      <MetricCard label="Notas com divergência" value={String(c.divergentInvoiceCount)} delta={compare(BigInt(c.divergentInvoiceCount), BigInt(p.divergentInvoiceCount))} unit="em notas" tone={c.divergentInvoiceCount > 0 ? "alert" : undefined} testId="text-metric-divergent" hint="Conferências salvas com cobrança a mais" />
    </section>
  );
}

function Notices({ data }: { data: MonthlyDashboard }) {
  if (!data.unverifiedInvoiceCount && !data.excludedLegacyConferenceCount) return null;
  return (
    <div className="space-y-2" role="note">
      {data.unverifiedInvoiceCount > 0 && (
        <div data-testid="text-unverified-notice" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <strong>{data.unverifiedInvoiceCount} nota{data.unverifiedInvoiceCount === 1 ? " ainda não foi conferida" : "s ainda não foram conferidas"}.</strong>{" "}
            Elas entram no total comprado, mas não no valor cobrado a mais. Isso não quer dizer que estão certas: a conferência ainda não foi salva.{" "}
            <Link href="/conferencia" data-testid="link-conferir" className="font-semibold underline underline-offset-2">Conferir agora</Link>
          </p>
        </div>
      )}
      {data.excludedLegacyConferenceCount > 0 && (
        <div data-testid="text-legacy-notice" className="flex gap-3 rounded-xl border bg-muted/60 p-3.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {data.excludedLegacyConferenceCount} conferência{data.excludedLegacyConferenceCount === 1 ? " antiga ficou" : "s antigas ficaram"} de fora deste painel porque {data.excludedLegacyConferenceCount === 1 ? "foi salva" : "foram salvas"} sem o XML da nota. Elas continuam no histórico de Fornecedores.
          </p>
        </div>
      )}
    </div>
  );
}

function SupplierChart({ suppliers }: { suppliers: MonthlySupplier[] }) {
  const rows = useMemo(() => [...suppliers]
    .sort((a, b) => (big(b.purchasedCents) > big(a.purchasedCents) ? 1 : big(b.purchasedCents) < big(a.purchasedCents) ? -1 : 0))
    .map((s) => ({ name: s.name, value: Number(big(s.purchasedCents)) / 100, label: brl(s.purchasedCents) })), [suppliers]);
  const height = Math.max(160, rows.length * 52 + 40);
  return (
    <figure className="rounded-xl border bg-card p-4 sm:p-5">
      <figcaption className="mb-3">
        <h2 className="font-display text-lg font-bold">Compras por fornecedor</h2>
        <p className="text-xs text-muted-foreground">Soma dos produtos das notas (sem frete e outras despesas). Valores e nomes completos na tabela abaixo.</p>
      </figcaption>
      <div role="img" aria-label={`Gráfico de barras: ${rows.map((r) => `${r.name}, ${r.label}`).join("; ")}`}>
        <ResponsiveContainer width="100%" height={height} debounce={0}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={14}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(36 18% 86%)" />
            <XAxis type="number" domain={[0, "auto"]} hide />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              isAnimationActive={false}
              cursor={{ fill: "hsl(230 60% 95%)" }}
              content={({ active, payload }) => {
                const row = active && payload?.[0]?.payload as { name: string; label: string } | undefined;
                if (!row) return null;
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-[13px] shadow-sm">
                    <p className="font-semibold">{row.name}</p>
                    <p className="font-mono">{row.label}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" fill="#61A9BD" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
              <LabelList dataKey="name" position="insideTopLeft" content={({ x, y, value }) => (
                <text x={Number(x)} y={Number(y) - 6} fontSize={13} fontWeight={600} fill="hsl(226 30% 14%)">{String(value).length > 15 ? `${String(value).slice(0, 15)}…` : String(value)}</text>
              )} />
              <LabelList dataKey="label" position="insideTopRight" content={({ y, value }) => (
                <text x="100%" dx={-10} y={Number(y) - 6} textAnchor="end" fontSize={12} fontFamily="JetBrains Mono, monospace" fill="hsl(226 10% 42%)">{String(value)}</text>
              )} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function SupplierTable({ suppliers }: { suppliers: MonthlySupplier[] }) {
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 font-display text-lg font-bold sm:px-5">Fornecedores</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Fornecedores do mês com total comprado, cobrado a mais e selo da última nota</caption>
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold sm:px-5">Fornecedor</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Total comprado</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Cobrado a mais</th>
              <th scope="col" className="px-4 py-2.5 font-semibold sm:px-5">Selo (última nota)</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s, i) => {
              const extra = big(s.extraChargeCents) > 0n;
              return (
                <tr key={`${s.name}-${i}`} data-testid={`row-supplier-${i}`} className="border-t align-middle">
                  <th scope="row" className="px-4 py-3 text-left font-semibold sm:px-5">
                    {s.name}
                    <span className="block text-xs font-normal text-muted-foreground">{s.invoiceCount} nota{s.invoiceCount === 1 ? "" : "s"} · última em {formatDate(s.latestIssuedAt)}</span>
                  </th>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{brl(s.purchasedCents)}</td>
                  <td className={`px-3 py-3 text-right font-mono tabular-nums ${extra ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{brl(s.extraChargeCents)}</td>
                  <td className="px-4 py-3 sm:px-5"><IbsCbsSeal ready={s.hasCompleteIbsCbs} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ItemsTable({ data }: { data: MonthlyDashboard }) {
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 font-display text-lg font-bold sm:px-5">Itens mais comprados</h2>
      {data.items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum item nas notas deste mês.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <caption className="sr-only">Itens mais comprados no mês</caption>
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold sm:px-5">Item</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Quantidade total</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Valor total</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold sm:px-5">Preço médio</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={`${item.description}-${item.unit}-${i}`} data-testid={`row-item-${i}`} className="border-t">
                  <th scope="row" className="px-4 py-3 text-left font-medium sm:px-5">{item.description}</th>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{formatDecimal(item.quantity)} <span className="text-muted-foreground">{item.unit}</span></td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{brl(item.totalCents)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums sm:px-5">
                    {item.averagePriceCents === null ? <span className="text-muted-foreground" title="Quantidade zero, sem preço médio">—</span> : <>{brl(item.averagePriceCents)}<span className="text-muted-foreground">/{item.unit}</span></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando painel" className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="rounded-xl border bg-card p-5"><div className="skel h-4 w-2/3" /><div className="skel mt-3 h-8 w-1/2" /><div className="skel mt-3 h-3 w-3/4" /></div>)}
      </div>
      <div className="skel h-64 w-full rounded-xl" />
      <div className="skel h-48 w-full rounded-xl" />
    </div>
  );
}

export default function PainelMensal() {
  const maxMonth = useMemo(currentMonthSaoPaulo, []);
  const [month, setMonth] = useState(maxMonth);
  const params = { month };
  const query = useGetMonthlyDashboard(params, {
    query: { queryKey: getGetMonthlyDashboardQueryKey(params), staleTime: 300000, refetchOnMount: "always", refetchOnWindowFocus: false },
  });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => { document.title = `Painel de compras · ${monthLabel(month)} · coNFere`; }, [month]);
  useEffect(() => setDownloadError(null), [month]);

  const data = query.data;
  const isEmpty = data && data.current.invoiceCount === 0 && data.suppliers.length === 0;

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const report = await getMonthlyReport({ month });
      const url = URL.createObjectURL(new Blob([report.content], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = report.filename || `relatorio-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setDownloadError("Não conseguimos gerar o relatório. Tente de novo.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <header className="rise flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary sm:text-sm">Painel do mês</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">Compras de <span className="text-primary">{monthLabel(month)}</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">Pela data de emissão escrita em cada nota. Comparado com {monthLabel(shiftMonth(month, -1))}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-card">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" data-testid="button-prev-month" disabled={month <= "1900-01"} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <label className="sr-only" htmlFor="painel-month">Escolher mês</label>
            <input
              id="painel-month" type="month" value={month} min="1900-01" max={maxMonth} data-testid="input-month"
              onChange={(e) => { if (MONTH_RE.test(e.target.value) && e.target.value >= "1900-01" && e.target.value <= maxMonth) setMonth(e.target.value); }}
              className="h-9 w-[9.5rem] bg-transparent px-1 text-center font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            />
            <Button variant="ghost" size="icon" aria-label="Próximo mês" data-testid="button-next-month" disabled={month >= maxMonth} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button onClick={download} disabled={downloading || !data || query.isFetching || query.isError} data-testid="button-download-report">
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {downloading ? "Gerando..." : "Baixar relatório do mês"}
          </Button>
        </div>
      </header>
      {downloadError && <p role="alert" data-testid="text-download-error" className="mt-3 text-right text-sm font-medium text-destructive">{downloadError}</p>}

      <div className="mt-6 space-y-4">
        {query.isLoading ? <Skeleton /> : query.isError || !data ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
            <p className="font-display text-lg font-bold">Não foi possível carregar o painel.</p>
            <p className="mt-1 text-sm text-muted-foreground">Verifique sua conexão e tente de novo.</p>
            <Button variant="outline" className="mt-4" data-testid="button-retry" onClick={() => query.refetch()}><RotateCcw className="mr-2 h-4 w-4" />Tentar de novo</Button>
          </div>
        ) : (
          <div className={`space-y-4 transition-opacity ${query.isFetching ? "opacity-60" : ""}`} aria-busy={query.isFetching}>
            <Metrics data={data} />
            <Notices data={data} />
            {isEmpty ? (
          <div className="paper-lines rounded-xl border bg-card px-6 py-14 text-center" data-testid="status-empty">
            <FileUp className="mx-auto h-9 w-9 text-primary" aria-hidden />
            <p className="mt-3 font-display text-xl font-bold">Nenhuma nota em {monthLabel(month)}.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Envie o XML das notas dos seus fornecedores e o painel mostra quanto você comprou e quanto foi cobrado a mais.</p>
            <Button asChild className="mt-5"><Link href="/nota-fiscal" data-testid="link-upload-xml">Enviar XML da nota</Link></Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-2">{data.suppliers.length > 0 && <SupplierChart suppliers={data.suppliers} />}</div>
              <div className="lg:col-span-3"><ItemsTable data={data} /></div>
            </div>
            <SupplierTable suppliers={data.suppliers} />
          </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
