import { useEffect } from "react";
import { Link } from "wouter";
import {
  getGetReplenishmentQueryKey,
  useGetReplenishment,
  type ReplenishmentItem,
  type ReplenishmentSummary,
} from "@workspace/api-client-react";
import { AlertTriangle, CalendarClock, FileUp, Info, PackageSearch, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDecimal } from "@/lib/reconciliation";
import ReplenishmentOrderBuilder from "@/components/replenishment-order-builder";

function brDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

// Rounds a decimal string to `places` (half-up) without float math; tiny nonzero values show "< 0,001".
function est(raw: string, places = 3): string {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw.trim());
  if (!m) return formatDecimal(raw);
  const [, sign, int, frac = ""] = m;
  const padded = (frac + "0".repeat(places + 1)).slice(0, places + 1);
  let scaled = BigInt(int + padded.slice(0, places));
  if (Number(padded[places]) >= 5) scaled += 1n;
  const nonzero = /[1-9]/.test(int + frac);
  if (scaled === 0n && nonzero) return `${sign ? "> −" : "< "}0,${"0".repeat(places - 1)}1`;
  const s = scaled.toString().padStart(places + 1, "0");
  const out = `${s.slice(0, -places)}.${s.slice(-places)}`;
  return formatDecimal(`${sign && scaled !== 0n ? "-" : ""}${out}`);
}

const STATUS = {
  "buy-now": { label: "Comprar agora", cls: "border-red-300 bg-red-50 text-red-800", bar: "bg-red-600" },
  soon: { label: "Comprar nos próximos 3 dias", cls: "border-amber-300 bg-amber-50 text-amber-900", bar: "bg-amber-500" },
  ok: { label: "Ok", cls: "border-emerald-300 bg-emerald-50 text-emerald-800", bar: "bg-emerald-600" },
} as const;

function Stat({ label, value, unit, testId, strong }: { label: string; value: string; unit?: string; testId: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd data-testid={testId} className={`mt-0.5 font-mono tabular-nums ${strong ? "text-base font-semibold" : "text-sm"}`}>
        {value}{unit && <span className="ml-1 text-muted-foreground">{unit}</span>}
      </dd>
    </div>
  );
}

function ItemCard({ item, i }: { item: ReplenishmentItem; i: number }) {
  const st = STATUS[item.status];
  return (
    <li data-testid={`card-replenishment-${item.id}`} className="rise relative overflow-hidden rounded-xl border bg-card p-4 pl-5 sm:p-5 sm:pl-6" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${st.bar}`} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-tight" data-testid={`text-item-description-${item.id}`}>{item.description}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Unidade: <span className="font-mono">{item.unit || "—"}</span>
            {item.productCode && <> · Código <span className="font-mono">{item.productCode}</span></>}
            {" · "}{item.supplierNames.length ? item.supplierNames.join(", ") : "Fornecedor não identificado"}
          </p>
          {item.identification === "description" && (
            <p className="mt-1 text-xs text-amber-800">Agrupado pela descrição: itens parecidos podem ter sido somados juntos.</p>
          )}
        </div>
        <div className="shrink-0 sm:text-right">
          <span data-testid={`status-item-${item.id}`} className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${st.cls}`}>{st.label}</span>
          <p className="mt-1.5 text-sm">
            Próxima compra prevista: <strong data-testid={`text-next-purchase-${item.id}`} className="font-mono">{brDate(item.nextPurchaseDate)}</strong>
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Estoque estimado" value={est(item.estimatedStock)} unit={item.unit} testId={`text-stock-${item.id}`} strong />
        <Stat label="Consumo por dia (est.)" value={est(item.dailyConsumption)} unit={item.unit} testId={`text-daily-${item.id}`} />
        <Stat label="Intervalo médio" value={est(item.averageIntervalDays, 1)} unit="dias" testId={`text-interval-${item.id}`} />
        <Stat label="Qtd. média por compra" value={est(item.averageQuantity)} unit={item.unit} testId={`text-avg-qty-${item.id}`} />
        <Stat label="Última compra" value={`${brDate(item.lastPurchaseDate)} · ${est(item.lastPurchaseQuantity)}`} unit={item.unit} testId={`text-last-${item.id}`} />
        <Stat label="Compras no histórico" value={`${item.purchaseCount} notas`} unit={`há ${item.daysSinceLastPurchase} dia${item.daysSinceLastPurchase === 1 ? "" : "s"}`} testId={`text-count-${item.id}`} />
      </dl>
      <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm" data-testid={`text-month-${item.id}`}>
        <span className="text-muted-foreground">Comprado no mês x consumido estimado no mês: </span>
        <span className="font-mono font-semibold tabular-nums">{est(item.purchasedThisMonth)}</span>
        <span className="text-muted-foreground"> x </span>
        <span className="font-mono font-semibold tabular-nums">{est(item.consumedThisMonth)}</span>
        <span className="text-muted-foreground"> {item.unit}</span>
      </div>
    </li>
  );
}

function Notices({ data }: { data: ReplenishmentSummary }) {
  const notes: { id: string; text: string; warn?: boolean }[] = [];
  const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (data.insufficientHistoryItems > 0) notes.push({ id: "insufficient", text: `${pl(data.insufficientHistoryItems, "produto ficou", "produtos ficaram")} de fora porque ${data.insufficientHistoryItems === 1 ? "foi comprado" : "foram comprados"} só uma vez. É preciso ao menos 2 notas com o item.` });
  if (data.sameDayOnlyItems > 0) notes.push({ id: "same-day", text: `${pl(data.sameDayOnlyItems, "produto ficou", "produtos ficaram")} de fora porque todas as compras são do mesmo dia, então não dá para calcular um intervalo entre compras.` });
  if (data.unreadableIdentityInvoices > 0) notes.push({ id: "identity", warn: true, text: `Em ${pl(data.unreadableIdentityInvoices, "nota", "notas")} não conseguimos recuperar identificadores do XML original. Quando faltam código ou CNPJ nos dados salvos, usamos a descrição, o que pode juntar ou separar produtos de forma aproximada.` });
  if (data.futureInvoices > 0) notes.push({ id: "future", text: `${pl(data.futureInvoices, "nota com data de emissão futura foi ignorada", "notas com data de emissão futura foram ignoradas")}.` });
  if (!notes.length) return null;
  return (
    <div className="space-y-2" role="note">
      {notes.map((n) => (
        <div key={n.id} data-testid={`text-notice-${n.id}`} className={`flex gap-3 rounded-xl border p-3.5 text-sm ${n.warn ? "border-amber-300 bg-amber-50 text-amber-950" : "bg-muted/60 text-muted-foreground"}`}>
          {n.warn ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          <p>{n.text}</p>
        </div>
      ))}
    </div>
  );
}

export default function Reposicao() {
  const query = useGetReplenishment({
    query: { queryKey: getGetReplenishmentQueryKey(), staleTime: 300000, refetchOnMount: "always", refetchOnWindowFocus: false },
  });
  useEffect(() => { document.title = "Reposição de estoque estimada · coNFere"; }, []);
  const data = query.data;
  const counts = data ? { now: data.items.filter((i) => i.status === "buy-now").length, soon: data.items.filter((i) => i.status === "soon").length } : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="rise">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary sm:text-sm">Reposição · estimativa pelo histórico de notas</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Quando comprar de novo</h1>
        <div className="mt-3 flex gap-3 rounded-xl border border-primary/20 bg-accent p-3.5 text-sm text-accent-foreground" data-testid="text-estimate-disclaimer">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <strong>Tudo aqui é estimativa, não é seu estoque real nem suas vendas.</strong> A conta usa só as datas e quantidades das notas que você enviou, sem IA: o intervalo médio entre compras, a quantidade média por compra e o consumo por dia que isso indica. Cada nota diferente conta como uma compra; linhas repetidas do mesmo produto na mesma nota são somadas. Unidades diferentes ficam separadas, sem conversão. O consumido no mês vai do início do mês (ou da primeira compra registrada, se for depois) até {data ? brDate(data.asOf) : "hoje"}, não é previsão do mês inteiro. Datas previstas são arredondadas para o dia seguinte quando o intervalo não é inteiro.
          </p>
        </div>
      </header>

      <div className="mt-6 space-y-4">
        {query.isLoading ? (
          <div aria-busy="true" aria-label="Carregando estimativas" className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-5"><div className="skel h-5 w-1/3" /><div className="skel mt-2 h-3 w-1/2" /><div className="skel mt-5 h-10 w-full" /></div>
            ))}
          </div>
        ) : query.isError || !data ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
            <p className="font-display text-lg font-bold">Não foi possível carregar as estimativas.</p>
            <p className="mt-1 text-sm text-muted-foreground">Verifique sua conexão e tente de novo.</p>
            <Button variant="outline" className="mt-4" data-testid="button-replenishment-retry" onClick={() => query.refetch()}><RotateCcw className="mr-2 h-4 w-4" />Tentar de novo</Button>
          </div>
        ) : (
          <div className={`space-y-4 transition-opacity ${query.isFetching ? "opacity-60" : ""}`} aria-busy={query.isFetching}>
            <p className="text-sm text-muted-foreground" data-testid="text-replenishment-summary">
              Calculado em <span className="font-mono">{brDate(data.asOf)}</span> · mês desde <span className="font-mono">{brDate(data.monthStart)}</span>
              {counts && data.items.length > 0 && <> · <strong className="text-red-700">{counts.now} para comprar agora</strong> · <strong className="text-amber-800">{counts.soon} nos próximos 3 dias</strong> · ordenado pela próxima compra</>}
            </p>
            <Notices data={data} />
            {data.items.length === 0 ? (
              <div className="paper-lines rounded-xl border bg-card px-6 py-14 text-center" data-testid="status-replenishment-empty">
                <PackageSearch className="mx-auto h-9 w-9 text-primary" aria-hidden />
                <p className="mt-3 font-display text-xl font-bold">Ainda não há histórico suficiente.</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Um produto aparece aqui depois de ser comprado em pelo menos 2 notas, em dias diferentes. Envie mais XMLs dos seus fornecedores.</p>
                <Button asChild className="mt-5"><Link href="/nota-fiscal" data-testid="link-replenishment-upload"><FileUp className="mr-2 h-4 w-4" />Enviar XML da nota</Link></Button>
              </div>
            ) : (
              <>
                <ReplenishmentOrderBuilder items={data.items} />
                <ul className="space-y-3">{data.items.map((item, i) => <ItemCard key={item.id} item={item} i={i} />)}</ul>
                <p className="text-center text-sm text-muted-foreground">
                  Quanto mais notas, melhor a estimativa. <Link href="/nota-fiscal" data-testid="link-replenishment-more" className="font-semibold text-primary underline underline-offset-2">Enviar mais XMLs</Link>
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
