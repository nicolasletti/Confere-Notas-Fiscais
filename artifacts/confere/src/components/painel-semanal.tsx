import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  getWeeklyReport,
  getGetWeeklyDashboardQueryKey,
  useGetWeeklyDashboard,
  type WeeklyDashboard,
} from "@workspace/api-client-react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, FileUp, Info, Loader2, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDecimal } from "@/lib/reconciliation";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_DAY = "1900-01-01";

// UTC calendar helpers: dates are calendar days, never local times (no DST issues).
function parseDay(s: string): Date | null {
  if (!DAY_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
}
function fmtDay(d: Date): string {
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function addDays(s: string, n: number): string {
  const d = parseDay(s);
  if (!d) return s;
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDay(d);
}
function mondayOf(s: string): string | null {
  const d = parseDay(s);
  if (!d) return null;
  const offset = (d.getUTCDay() + 6) % 7; // Monday=0
  d.setUTCDate(d.getUTCDate() - offset);
  return fmtDay(d);
}
function todaySaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function shortDay(s: string): string {
  const d = parseDay(s);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "—";
}
function rangeLabel(start: string, end: string): string {
  return `seg., ${shortDay(start)} a dom., ${shortDay(end)}`;
}
function brDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

const brl = (cents: string) => { try { return formatBRL(BigInt(cents)); } catch { return "R$ —"; } };
const big = (cents: string) => { try { return BigInt(cents); } catch { return 0n; } };

type Delta = { kind: "none" } | { kind: "same" } | { kind: "up" | "down"; label: string };
function compare(current: bigint, previous: bigint): Delta {
  if (previous <= 0n) return { kind: "none" };
  const diff = current - previous;
  if (diff === 0n) return { kind: "same" };
  const abs = diff < 0n ? -diff : diff;
  const tenths = (abs * 1000n + previous / 2n) / previous;
  const txt = `${(tenths / 10n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${tenths % 10n}%`;
  return { kind: diff > 0n ? "up" : "down", label: `${diff > 0n ? "+" : "−"}${txt}` };
}

function DeltaBadge({ delta, testId }: { delta: Delta; testId: string }) {
  if (delta.kind === "none")
    return <span data-testid={testId} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" aria-hidden />sem base na semana anterior</span>;
  if (delta.kind === "same")
    return <span data-testid={testId} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" aria-hidden />igual à semana anterior</span>;
  const Icon = delta.kind === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span data-testid={testId} className="inline-flex items-center gap-1 text-xs font-semibold">
      <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
      <span className="font-mono">{delta.label}</span>
      <span className="font-normal text-muted-foreground">vs. semana anterior</span>
    </span>
  );
}

function Card({ label, value, delta, prev, alert, testId, hint }: { label: string; value: string; delta: Delta; prev: string; alert?: boolean; testId: string; hint?: string }) {
  return (
    <div className={`rise rounded-xl border bg-card p-4 sm:p-5 ${alert ? "border-destructive/30 bg-destructive/[0.03]" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p data-testid={testId} className={`mt-1 font-display text-2xl font-bold tracking-tight sm:text-[1.7rem] ${alert ? "text-destructive" : ""}`}>{value}</p>
      <div className="mt-2"><DeltaBadge delta={delta} testId={`${testId}-delta`} /></div>
      <p className="mt-1.5 text-xs text-muted-foreground">Semana anterior: {prev}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Metrics({ data }: { data: WeeklyDashboard }) {
  const c = data.current, p = data.previous;
  const extra = big(c.extraChargeCents) > 0n;
  return (
    <section aria-label="Resumo da semana" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Total comprado na semana" value={brl(c.purchasedCents)} delta={compare(big(c.purchasedCents), big(p.purchasedCents))} prev={brl(p.purchasedCents)} testId="text-week-purchased" />
      <Card label="Notas recebidas" value={String(c.invoiceCount)} delta={compare(BigInt(c.invoiceCount), BigInt(p.invoiceCount))} prev={String(p.invoiceCount)} testId="text-week-invoices" hint="Pela data de emissão da nota, não pelo dia do envio." />
      <Card label="Divergências encontradas" value={brl(c.extraChargeCents)} delta={compare(big(c.extraChargeCents), big(p.extraChargeCents))} prev={brl(p.extraChargeCents)} alert={extra} testId="text-week-extra" hint="Cobrança a mais em conferências salvas." />
      <Card label="Notas com divergência" value={String(c.divergentInvoiceCount)} delta={compare(BigInt(c.divergentInvoiceCount), BigInt(p.divergentInvoiceCount))} prev={String(p.divergentInvoiceCount)} alert={c.divergentInvoiceCount > 0} testId="text-week-divergent" />
    </section>
  );
}

function Notices({ data }: { data: WeeklyDashboard }) {
  if (!data.unverifiedInvoiceCount && !data.excludedLegacyConferenceCount) return null;
  const u = data.unverifiedInvoiceCount, l = data.excludedLegacyConferenceCount;
  return (
    <div className="space-y-2" role="note">
      {u > 0 && (
        <div data-testid="text-week-unverified-notice" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <strong>{u} nota{u === 1 ? " desta semana ainda não foi conferida" : "s desta semana ainda não foram conferidas"}.</strong>{" "}
            Elas entram no total comprado, mas não nas divergências. Isso não quer dizer que estão certas.{" "}
            <Link href="/conferencia" data-testid="link-week-conferir" className="font-semibold underline underline-offset-2">Conferir agora</Link>
          </p>
        </div>
      )}
      {l > 0 && (
        <div data-testid="text-week-legacy-notice" className="flex gap-3 rounded-xl border bg-muted/60 p-3.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{l} conferência{l === 1 ? " antiga ficou" : "s antigas ficaram"} de fora deste painel porque {l === 1 ? "foi salva" : "foram salvas"} sem o XML da nota. Elas continuam no histórico de Fornecedores.</p>
        </div>
      )}
    </div>
  );
}

function ItemsTable({ data }: { data: WeeklyDashboard }) {
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 font-display text-lg font-bold sm:px-5">Itens comprados na semana</h2>
      {data.items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum item nas notas desta semana.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <caption className="sr-only">Itens comprados na semana com quantidade e valor</caption>
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold sm:px-5">Item</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Quantidade</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Valor total</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold sm:px-5">Preço médio</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={`${item.description}-${item.unit}-${i}`} data-testid={`row-week-item-${i}`} className="border-t">
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

function SupplierList({ data }: { data: WeeklyDashboard }) {
  if (data.suppliers.length === 0) return null;
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 font-display text-lg font-bold sm:px-5">Fornecedores da semana</h2>
      <ul>
        {data.suppliers.map((s, i) => (
          <li key={`${s.name}-${i}`} data-testid={`row-week-supplier-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t px-4 py-3 first:border-t-0 sm:px-5">
            <div className="min-w-0">
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.invoiceCount} nota{s.invoiceCount === 1 ? "" : "s"} · última em {brDate(s.latestIssuedAt)}</p>
            </div>
            <div className="text-right font-mono text-sm tabular-nums">
              <p>{brl(s.purchasedCents)}</p>
              {big(s.extraChargeCents) > 0n && <p className="text-xs font-semibold text-destructive">{brl(s.extraChargeCents)} a mais</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PainelSemanal() {
  const maxWeek = useMemo(() => mondayOf(todaySaoPaulo()) ?? "2025-01-06", []);
  const [weekStart, setWeekStart] = useState(maxWeek);
  const weekEnd = addDays(weekStart, 6);
  const params = { weekStart };
  const query = useGetWeeklyDashboard(params, {
    query: { queryKey: getGetWeeklyDashboardQueryKey(params), staleTime: 300000, refetchOnMount: "always", refetchOnWindowFocus: false },
  });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  useEffect(() => setDownloadError(null), [weekStart]);
  useEffect(() => {
    document.title = `Painel semanal · ${brDate(weekStart)} a ${brDate(weekEnd)} · coNFere`;
  }, [weekStart, weekEnd]);

  const data = query.data;
  const isEmpty = data && data.current.invoiceCount === 0 && data.suppliers.length === 0;
  const minWeek = mondayOf(addDays(MIN_DAY, 6)) ?? MIN_DAY;

  function pick(value: string) {
    const m = mondayOf(value);
    if (m && m >= minWeek && m <= maxWeek) setWeekStart(m);
  }

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const report = await getWeeklyReport({ weekStart });
      const url = URL.createObjectURL(new Blob([report.content], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = report.filename || `relatorio-semana-${weekStart}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setDownloadError("Não conseguimos gerar o relatório da semana. Tente de novo.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <header className="rise flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary sm:text-sm">Painel da semana · segunda a domingo</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-week-range">
            <span className="text-primary">{shortDay(weekStart)}</span> a <span className="text-primary">{shortDay(weekEnd)}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rangeLabel(weekStart, weekEnd)}, dias inclusos. Notas contadas pela data de emissão, não pelo dia em que o XML foi enviado. Comparado com {rangeLabel(data?.previousWeekStart ?? addDays(weekStart, -7), data?.previousWeekEnd ?? addDays(weekStart, -1))}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-card">
            <Button variant="ghost" size="icon" aria-label="Semana anterior" data-testid="button-prev-week" disabled={weekStart <= minWeek} onClick={() => pick(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <label className="sr-only" htmlFor="painel-week">Escolher um dia; o painel mostra a semana de segunda a domingo desse dia</label>
            <input
              id="painel-week" type="date" value={weekStart} min={minWeek} max={addDays(maxWeek, 6)} data-testid="input-week"
              onChange={(e) => pick(e.target.value)}
              className="h-9 w-[10rem] rounded bg-transparent px-1 text-center font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button variant="ghost" size="icon" aria-label="Próxima semana" data-testid="button-next-week" disabled={weekStart >= maxWeek} onClick={() => pick(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button onClick={download} disabled={downloading || !data || query.isFetching || query.isError} data-testid="button-download-week-report">
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {downloading ? "Gerando..." : "Baixar relatório da semana"}
          </Button>
        </div>
      </header>
      <p className="sr-only" aria-live="polite">Semana selecionada: {rangeLabel(weekStart, weekEnd)}</p>
      {downloadError && <p role="alert" data-testid="text-week-download-error" className="mt-3 text-right text-sm font-medium text-destructive">{downloadError}</p>}

      <div className="mt-6 space-y-4">
        {query.isLoading ? (
          <div aria-busy="true" aria-label="Carregando semana" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <div key={i} className="rounded-xl border bg-card p-5"><div className="skel h-4 w-2/3" /><div className="skel mt-3 h-8 w-1/2" /><div className="skel mt-3 h-3 w-3/4" /></div>)}
            </div>
            <div className="skel h-48 w-full rounded-xl" />
          </div>
        ) : query.isError || !data ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
            <p className="font-display text-lg font-bold">Não foi possível carregar a semana.</p>
            <p className="mt-1 text-sm text-muted-foreground">Verifique sua conexão e tente de novo.</p>
            <Button variant="outline" className="mt-4" data-testid="button-week-retry" onClick={() => query.refetch()}><RotateCcw className="mr-2 h-4 w-4" />Tentar de novo</Button>
          </div>
        ) : (
          <div className={`space-y-4 transition-opacity ${query.isFetching ? "opacity-60" : ""}`} aria-busy={query.isFetching}>
            <Metrics data={data} />
            <Notices data={data} />
            {isEmpty ? (
              <div className="paper-lines rounded-xl border bg-card px-6 py-14 text-center" data-testid="status-week-empty">
                <FileUp className="mx-auto h-9 w-9 text-primary" aria-hidden />
                <p className="mt-3 font-display text-xl font-bold">Nenhuma nota emitida nesta semana.</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Envie o XML das notas dos seus fornecedores. Elas aparecem na semana da data de emissão.</p>
                <Button asChild className="mt-5"><Link href="/nota-fiscal" data-testid="link-week-upload-xml">Enviar XML da nota</Link></Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3"><ItemsTable data={data} /></div>
                <div className="lg:col-span-2"><SupplierList data={data} /></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
