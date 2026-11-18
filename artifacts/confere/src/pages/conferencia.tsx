import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, FileCheck2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNfe } from "@/lib/nfe-context";
import { readPedido, type PedidoItem } from "@/lib/pedido-store";
import IbsCbsSeal from "@/components/ibs-cbs-seal";
import {
  calculateItem,
  formatBRL,
  formatBRLDecimal,
  formatDecimal,
  sumChargeCents,
  type ItemCalculation,
} from "@/lib/reconciliation";
import type { NfeInvoice } from "@/lib/nfe";

const NOT_IN_ORDER = "__nao-estava-no-pedido__";

interface ConferenceRow {
  orderItemId: string;
  receivedQuantity: string;
}

function initialRows(invoice: NfeInvoice): ConferenceRow[] {
  return invoice.items.map((item) => ({
    orderItemId: "",
    receivedQuantity: item.quantity,
  }));
}

function Badge({ children, tone }: { children: string; tone: "green" | "red" | "neutral" }) {
  const colors = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    neutral: "border-border bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}>{children}</span>;
}

function partDisplay(cents: bigint) {
  if (cents < 0n) {
    return <span className="font-mono font-medium text-emerald-800">{formatBRL(-cents)} a seu favor</span>;
  }
  if (cents > 0n) {
    return <span className="font-mono font-medium text-red-800">{formatBRL(cents)} a mais</span>;
  }
  return <span className="font-mono font-medium text-foreground">{formatBRL(0n)}</span>;
}

function Result({
  calculation,
  isNotInOrder,
  invoiceQuantity,
  receivedQuantity,
  invoiceUnitPrice,
  agreedUnitPrice,
}: {
  calculation: ItemCalculation | null;
  isNotInOrder: boolean;
  invoiceQuantity: string;
  receivedQuantity: string;
  invoiceUnitPrice: string;
  agreedUnitPrice?: string;
}) {
  if (!calculation) {
    return <p className="text-sm text-muted-foreground">Escolha o item do pedido ou marque que não estava no pedido.</p>;
  }

  if (calculation.kind === "invalid" || calculation.totalCents === null) {
    return <p className="text-sm font-medium text-destructive" role="alert">Confira a quantidade recebida e os valores salvos no pedido.</p>;
  }

  if (isNotInOrder) {
    if (calculation.totalCents > 0n) {
      return (
        <div className="flex flex-wrap items-center gap-2" data-testid="result-not-in-order">
          <Badge tone="red">Fora do pedido</Badge>
          <span className="font-mono text-sm font-semibold tabular-nums text-red-800">
            {formatBRL(calculation.totalCents)}
          </span>
          <span className="text-xs text-muted-foreground">valor total do item na nota</span>
        </div>
      );
    }
    if (calculation.totalCents < 0n) {
      return (
        <div className="flex flex-wrap items-center gap-2" data-testid="result-not-in-order-favorable">
          <Badge tone="green">Sem cobrança a mais</Badge>
          <span className="text-sm font-semibold text-emerald-800">{formatBRL(-calculation.totalCents)} a seu favor</span>
        </div>
      );
    }
    return <Badge tone="green">OK</Badge>;
  }

  const quantityPart = calculation.quantityPartCents ?? 0n;
  const pricePart = calculation.pricePartCents ?? 0n;
  const favorable = calculation.kind === "favorable";
  const noDifference = calculation.kind === "ok";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" data-testid="status-line-result">
        {noDifference ? (
          <Badge tone="green">OK</Badge>
        ) : favorable ? (
          <>
            <Badge tone="green">Sem cobrança a mais</Badge>
            <span className="text-sm font-semibold text-emerald-800">
              {formatBRL(-calculation.totalCents)} a seu favor
            </span>
          </>
        ) : (
          <>
            <Badge tone="red">Cobrança a mais</Badge>
            <span className="font-mono text-sm font-semibold tabular-nums text-red-800">
              {formatBRL(calculation.totalCents)}
            </span>
          </>
        )}
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p className="rounded-lg bg-background/70 px-3 py-2" data-testid="text-quantity-part">
          <span className="font-semibold text-foreground">Quantidade:</span>{" "}
          ({formatDecimal(invoiceQuantity)} − {formatDecimal(receivedQuantity)}) × R$ {formatDecimal(invoiceUnitPrice)} ={" "}
          {partDisplay(quantityPart)}
        </p>
        <p className="rounded-lg bg-background/70 px-3 py-2" data-testid="text-price-part">
          <span className="font-semibold text-foreground">Preço:</span>{" "}
          ({formatDecimal(invoiceUnitPrice)} − {formatDecimal(agreedUnitPrice ?? "")}) × {formatDecimal(receivedQuantity)} ={" "}
          {partDisplay(pricePart)}
        </p>
      </div>
    </div>
  );
}

function ConferenceResults({ invoice, version }: { invoice: NfeInvoice; version: number }) {
  const [pedido] = useState(readPedido);
  const [rows, setRows] = useState(() => initialRows(invoice));

  function updateRow(index: number, update: Partial<ConferenceRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...update } : row));
  }

  const resolved = invoice.items.map((item, index) => {
    const row = rows[index] ?? { orderItemId: "", receivedQuantity: item.quantity };
    const isNotInOrder = row.orderItemId === NOT_IN_ORDER;
    const matchedOrderItem: PedidoItem | null = pedido.items.find((orderItem) => orderItem.id === row.orderItemId) ?? null;
    const calculation = !row.orderItemId
      ? null
      : isNotInOrder
        ? calculateItem(item, null, row.receivedQuantity)
        : matchedOrderItem
          ? calculateItem(item, matchedOrderItem, row.receivedQuantity)
          : { kind: "invalid" as const, totalCents: null, quantityPartCents: null, pricePartCents: null };
    return { item, row, isNotInOrder, matchedOrderItem, calculation };
  });
  const totalCents = sumChargeCents(
    resolved.flatMap(({ calculation }) => calculation ? [calculation] : []),
  );
  const pendingCount = resolved.filter(
    ({ calculation }) => !calculation || calculation.kind === "invalid",
  ).length;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      <section className="rise">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary">Revisão da entrega</p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Conferência</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Relacione cada produto da nota ao que foi pedido e informe quanto chegou.
            </p>
          </div>
          <Link href="/" className="inline-flex min-h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-back-invoice">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Nota fiscal
          </Link>
        </div>

        <div className="mt-7 rounded-2xl border border-red-200 bg-red-50 px-5 py-5 sm:px-7 sm:py-6" data-testid="summary-extra-charge">
          <p className="text-sm font-semibold uppercase tracking-[0.1em] text-red-800">Total cobrado a mais</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-red-900 sm:text-4xl" data-testid="text-total-extra-charge">
            {formatBRL(totalCents)}
          </p>
          <p className="mt-1 text-xs text-red-800/80" data-testid="status-total-scope">
            {pendingCount > 0
              ? `Total parcial: ${pendingCount} ${pendingCount === 1 ? "item aguarda" : "itens aguardam"} correspondência ou quantidade válida.`
              : "Itens com diferença favorável não aumentam este total."}
          </p>
        </div>

        {pedido.warning && (
          <p role="status" className="mt-5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950" data-testid="status-pedido-warning">
            {pedido.warning}
          </p>
        )}

        {pedido.items.length === 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-4">
            <p className="text-sm text-muted-foreground">Cadastre os itens combinados para relacioná-los à nota.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/pedido" data-testid="link-create-pedido">Abrir Pedido</Link>
            </Button>
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Itens da nota</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              NF-e nº {invoice.number} · {invoice.issuer}
            </p>
          </div>
          <IbsCbsSeal ready={invoice.hasCompleteIbsCbs} />
          <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {invoice.items.length} {invoice.items.length === 1 ? "item" : "itens"}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          {resolved.map(({ item, row, isNotInOrder, matchedOrderItem, calculation }, index) => (
            <article key={`${version}-${index}`} className="rounded-2xl border bg-card p-4 sm:p-6" data-testid={`card-conference-item-${index}`}>
              <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Descrição da nota</p>
                  <h3 className="mt-1 font-display text-lg font-bold leading-snug" data-testid={`text-invoice-description-${index}`}>
                    {item.description}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Na nota: {formatDecimal(item.quantity)} {item.unit} × R$ {formatDecimal(item.unitPrice)}
                  </p>
                  <label htmlFor={`received-${index}`} className="mt-4 block text-sm font-semibold">
                    Quantidade recebida
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id={`received-${index}`}
                      value={row.receivedQuantity}
                      inputMode="decimal"
                      onChange={(event) => updateRow(index, { receivedQuantity: event.target.value })}
                      aria-describedby={`received-help-${index}`}
                      data-testid={`input-received-${index}`}
                      className="max-w-44 font-mono"
                    />
                    <span className="text-sm text-muted-foreground">{item.unit}</span>
                  </div>
                  <p id={`received-help-${index}`} className="mt-1 text-xs text-muted-foreground">
                    Use vírgula ou ponto nos decimais.
                  </p>
                </div>

                <div className="space-y-3">
                  <label htmlFor={`order-item-${index}`} className="block text-sm font-semibold">
                    Item correspondente do pedido
                  </label>
                  <select
                    id={`order-item-${index}`}
                    value={row.orderItemId}
                    onChange={(event) => updateRow(index, { orderItemId: event.target.value })}
                    data-testid={`select-order-item-${index}`}
                    className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Selecione um item do pedido</option>
                    <option value={NOT_IN_ORDER}>Não estava no pedido</option>
                    {pedido.items.map((orderItem) => (
                      <option key={orderItem.id} value={orderItem.id}>
                        {orderItem.descricao} — {formatDecimal(orderItem.quantidade)} {orderItem.unidade} — R$ {formatDecimal(orderItem.precoUnitario)}
                      </option>
                    ))}
                  </select>
                  {isNotInOrder && (
                    <p className="text-xs text-muted-foreground">
                      Para este item, o cálculo considera o valor total lançado na nota ({formatBRLDecimal(item.total)}) e não usa o item do pedido.
                    </p>
                  )}
                  {matchedOrderItem && (
                    <p className="text-xs text-muted-foreground">
                      Pedido: {formatDecimal(matchedOrderItem.quantidade)} {matchedOrderItem.unidade} a R$ {formatDecimal(matchedOrderItem.precoUnitario)} por unidade.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 border-t pt-4">
                {isNotInOrder && calculation && calculation.kind !== "invalid" && (
                  <Result
                    calculation={calculation}
                    isNotInOrder
                    invoiceQuantity={item.quantity}
                    receivedQuantity={row.receivedQuantity}
                    invoiceUnitPrice={item.unitPrice}
                  />
                )}
                {!isNotInOrder && (
                  <Result
                    calculation={calculation}
                    isNotInOrder={false}
                    invoiceQuantity={item.quantity}
                    receivedQuantity={row.receivedQuantity}
                    invoiceUnitPrice={item.unitPrice}
                    agreedUnitPrice={matchedOrderItem?.precoUnitario}
                  />
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p>Confira as correspondências selecionadas. Os cálculos usam os valores desta nota e os preços combinados salvos no pedido.</p>
        </div>
        <p className="sr-only" aria-live="polite" data-testid="status-conference-updated">
          Total atualizado: {formatBRL(totalCents)}
        </p>
        <FileCheck2 className="sr-only" aria-hidden="true" />
      </section>
    </main>
  );
}

export default function Conferencia() {
  const { invoice, version } = useNfe();

  if (!invoice) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
        <section className="rounded-2xl border bg-card p-6 text-center sm:p-10">
          <FileCheck2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 font-display text-3xl font-bold">Carregue uma nota fiscal</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            A conferência usa os itens da NF-e aberta. Volte à tela Nota fiscal e selecione um XML.
          </p>
          <Button asChild className="mt-6">
            <Link href="/" data-testid="link-load-invoice">Ir para Nota fiscal</Link>
          </Button>
        </section>
      </main>
    );
  }

  return <ConferenceResults key={version} invoice={invoice} version={version} />;
}
