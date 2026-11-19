import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, FileCheck2, Save, ShieldAlert, Sparkles } from "lucide-react";
import {
  getGetLatestAccountInvoiceQueryKey,
  getGetMonthlyDashboardQueryKey,
  getGetWeeklyDashboardQueryKey,
  getListAccountConferencesQueryKey,
  useGetAccountOrder,
  useGetLatestAccountInvoice,
  useGenerateChargeMessage,
  useSaveAccountConference,
  useSuggestOrderMatches,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNfe } from "@/lib/nfe-context";
import type { PedidoItem } from "@/lib/pedido-store";
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
const MINIMUM_SUGGESTION_CONFIDENCE = 0.82;

interface OrderMatchSuggestion {
  invoiceIndex: number;
  orderIndex: number | null;
  confidence: number;
}

interface ConferenceRow {
  orderItemId: string;
  receivedQuantity: string;
  suggestedByAi: boolean;
  orderItemTouched: boolean;
}

const orderMatchCache = new Map<string, OrderMatchSuggestion[]>();

function initialRows(invoice: NfeInvoice): ConferenceRow[] {
  return invoice.items.map((item) => ({
    orderItemId: "",
    receivedQuantity: item.quantity,
    suggestedByAi: false,
    orderItemTouched: false,
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

function messagePart(cents: bigint): string {
  if (cents < 0n) return `${formatBRL(-cents)} a seu favor`;
  if (cents > 0n) return `${formatBRL(cents)} a mais`;
  return formatBRL(0n);
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
  const queryClient = useQueryClient();
  const orderQuery = useGetAccountOrder();
  const pedido = {
    items: orderQuery.data?.items ?? [],
    warning: orderQuery.isError ? "Não foi possível carregar o pedido salvo na sua conta." : null,
  };
  const [rows, setRows] = useState(() => initialRows(invoice));
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const messageMutation = useGenerateChargeMessage();
  const saveConferenceMutation = useSaveAccountConference();
  const suggestionMutation = useSuggestOrderMatches();
  const editRevision = useRef(0);

  function updateRow(index: number, update: Partial<ConferenceRow>) {
    editRevision.current += 1;
    setGeneratedMessage("");
    setGenerationError("");
    setCopied(false);
    setSaveStatus(null);
    setRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      return {
        ...row,
        ...update,
        ...(update.orderItemId !== undefined
          ? { suggestedByAi: false, orderItemTouched: true }
          : {}),
      };
    }));
  }

  useEffect(() => {
    if (orderQuery.isLoading || pedido.items.length === 0 || invoice.items.length === 0) return;

    const invoiceDescriptions = invoice.items.map((item) => item.description);
    const orderDescriptions = pedido.items.map((item) => item.descricao);
    const cacheKey = JSON.stringify([
      invoiceDescriptions,
      pedido.items.map((item) => [item.id, item.descricao]),
    ]);
    const applySuggestions = (suggestions: OrderMatchSuggestion[]) => {
      setRows((current) => current.map((row, invoiceIndex) => {
        if (row.orderItemTouched || row.orderItemId) return row;
        const suggestion = suggestions.find((entry) => entry.invoiceIndex === invoiceIndex);
        if (
          !suggestion ||
          suggestion.confidence < MINIMUM_SUGGESTION_CONFIDENCE ||
          suggestion.orderIndex === null
        ) {
          return row;
        }
        const orderItem = pedido.items[suggestion.orderIndex];
        if (!orderItem) return row;
        return { ...row, orderItemId: orderItem.id, suggestedByAi: true };
      }));
    };

    const cached = orderMatchCache.get(cacheKey);
    if (cached) {
      applySuggestions(cached);
      setSuggestionStatus("ready");
      return;
    }

    let cancelled = false;
    setSuggestionStatus("loading");
    suggestionMutation.mutateAsync({
      data: { invoiceDescriptions, orderDescriptions },
    }).then((result) => {
      if (cancelled) return;
      const suggestions = result.suggestions.map((entry) => ({
        invoiceIndex: entry.invoiceIndex,
        orderIndex: entry.orderIndex,
        confidence: entry.confidence,
      }));
      if (orderMatchCache.size >= 8) {
        const oldestKey = orderMatchCache.keys().next().value;
        if (oldestKey) orderMatchCache.delete(oldestKey);
      }
      orderMatchCache.set(cacheKey, suggestions);
      applySuggestions(suggestions);
      setSuggestionStatus("ready");
    }).catch(() => {
      if (!cancelled) setSuggestionStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [invoice, orderQuery.isLoading, pedido.items]);

  const resolved = invoice.items.map((item, index) => {
    const row = rows[index] ?? {
      orderItemId: "",
      receivedQuantity: item.quantity,
      suggestedByAi: false,
      orderItemTouched: false,
    };
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
  const chargeItems = resolved.flatMap(({ item, isNotInOrder, calculation }) => {
    if (!calculation || calculation.totalCents === null || calculation.totalCents <= 0n) {
      return [];
    }
    return [{
      description: item.description,
      kind: isNotInOrder ? "notInOrder" as const : "matched" as const,
      itemAmount: formatBRL(calculation.totalCents),
      quantityDifference: isNotInOrder
        ? null
        : messagePart(calculation.quantityPartCents ?? 0n),
      priceDifference: isNotInOrder
        ? null
        : messagePart(calculation.pricePartCents ?? 0n),
    }];
  });

  async function generateChargeMessage() {
    const requestRevision = editRevision.current;
    setGeneratedMessage("");
    setGenerationError("");
    setCopied(false);
    try {
      const result = await messageMutation.mutateAsync({
        data: {
          invoiceNumber: invoice.number,
          totalAmount: formatBRL(totalCents),
          partial: pendingCount > 0,
          items: chargeItems,
        },
      });
      if (requestRevision === editRevision.current) {
        setGeneratedMessage(result.message);
      }
    } catch {
      if (requestRevision === editRevision.current) {
        setGenerationError("Não foi possível gerar a mensagem agora. Tente novamente.");
      }
    }
  }

  async function copyChargeMessage() {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setGenerationError("");
    } catch {
      setCopied(false);
      setGenerationError("Não foi possível copiar. Selecione e copie o texto manualmente.");
    }
  }

  async function saveConference() {
    if (invoice.id === undefined) {
      setSaveStatus({
        tone: "error",
        message: "Esta nota ainda não foi salva na sua conta. Volte à tela Nota fiscal e envie o XML novamente.",
      });
      return;
    }
    const results = resolved.map(({ item, row, matchedOrderItem, calculation }, invoiceItemIndex) => ({
      invoiceItemIndex,
      description: item.description,
      orderItemId: row.orderItemId && row.orderItemId !== NOT_IN_ORDER ? row.orderItemId : null,
      matchedOrderDescription: matchedOrderItem?.descricao ?? null,
      receivedQuantity: row.receivedQuantity,
      kind: calculation?.kind ?? "invalid" as const,
      totalCents: calculation?.totalCents?.toString() ?? null,
      quantityPartCents: calculation?.quantityPartCents?.toString() ?? null,
      pricePartCents: calculation?.pricePartCents?.toString() ?? null,
    }));

    try {
      await saveConferenceMutation.mutateAsync({
        data: {
          invoiceId: invoice.id,
          supplierName: invoice.issuer,
          invoiceNumber: invoice.number,
          issuedAt: invoice.issuedAt,
          totalExtraChargeCents: totalCents.toString(),
          hasCompleteIbsCbs: invoice.hasCompleteIbsCbs,
          results,
        },
      });
      void queryClient.invalidateQueries({ queryKey: getGetMonthlyDashboardQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetWeeklyDashboardQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getListAccountConferencesQueryKey() });
      setSaveStatus({
        tone: "success",
        message: "Conferência salva no histórico da sua conta.",
      });
    } catch {
      setSaveStatus({
        tone: "error",
        message: "Não foi possível salvar a conferência. Tente novamente.",
      });
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-10">
      <section className="rise">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary sm:text-sm">Etapa 3 · revisão da entrega</p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Conferência</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Relacione cada produto da nota ao que foi pedido e informe quanto chegou.
            </p>
          </div>
          <Link href="/nota-fiscal" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-testid="link-back-invoice">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Nota fiscal
          </Link>
        </div>

        <div className="relative mt-6 overflow-hidden rounded-2xl border border-red-200 bg-red-50 px-5 py-5 shadow-sm sm:mt-8 sm:px-8 sm:py-7" data-testid="summary-extra-charge">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-red-700" aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-red-800 sm:text-sm">Total cobrado a mais</p>
          <p className="mt-2 break-words font-display text-[clamp(2.25rem,11vw,4.5rem)] font-bold leading-none tracking-[-0.055em] tabular-nums text-red-900" data-testid="text-total-extra-charge">
            {formatBRL(totalCents)}
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-red-900/80 sm:text-sm" data-testid="status-total-scope">
            {pendingCount > 0
              ? `Total parcial: ${pendingCount} ${pendingCount === 1 ? "item aguarda" : "itens aguardam"} correspondência ou quantidade válida.`
              : "Itens com diferença favorável não aumentam este total."}
          </p>
        </div>

        {totalCents > 0n && (
          <section className="mt-5 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5" data-testid="section-charge-message">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Mensagem para o fornecedor</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A IA escreve a introdução; descrições e valores calculados são inseridos pelo Confere.
                </p>
              </div>
              <Button
                type="button"
                onClick={generateChargeMessage}
                disabled={messageMutation.isPending}
                data-testid="button-generate-charge-message"
              >
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                {messageMutation.isPending ? "Gerando mensagem..." : "Gerar mensagem de cobrança"}
              </Button>
            </div>

            {pendingCount > 0 && (
              <p className="mt-3 text-xs text-amber-800" role="note">
                A mensagem indicará que o total é parcial e incluirá apenas as divergências já calculadas.
              </p>
            )}

            {generationError && (
              <p className="mt-3 text-sm text-destructive" role="alert" data-testid="error-charge-message">
                {generationError}
              </p>
            )}

            {generatedMessage && (
              <div className="mt-4 space-y-3">
                <label htmlFor="charge-message-draft" className="block text-sm font-semibold">
                  Revise e edite a mensagem antes de enviar
                </label>
                <Textarea
                  id="charge-message-draft"
                  value={generatedMessage}
                  onChange={(event) => {
                    setGeneratedMessage(event.target.value);
                    setCopied(false);
                  }}
                  rows={8}
                  className="min-h-40 resize-y"
                  data-testid="textarea-charge-message"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyChargeMessage}
                    disabled={!generatedMessage.trim()}
                    data-testid="button-copy-charge-message"
                  >
                    {copied
                      ? <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                      : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

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

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
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

        {pedido.items.length > 0 && (
          <p
            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
              suggestionStatus === "error"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-border bg-card text-muted-foreground"
            }`}
            role="status"
            aria-live="polite"
            data-testid="status-ai-order-suggestions"
          >
            {suggestionStatus === "loading"
              ? "A IA está sugerindo correspondências. Você pode editar qualquer seleção."
              : suggestionStatus === "error"
                ? "Não foi possível sugerir correspondências agora. Escolha os itens manualmente."
                : "A IA pré-seleciona apenas correspondências de alta confiança. Confira e altere as sugestões se necessário."}
          </p>
        )}

        <div className="mt-4 space-y-4">
          {resolved.map(({ item, row, isNotInOrder, matchedOrderItem, calculation }, index) => (
            <article key={`${version}-${index}`} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6" data-testid={`card-conference-item-${index}`}>
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor={`order-item-${index}`} className="block text-sm font-semibold">
                      Item correspondente do pedido
                    </label>
                    {row.suggestedByAi && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-medium text-primary"
                        data-testid={`badge-ai-suggestion-${index}`}
                      >
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        sugerido pela IA
                      </span>
                    )}
                  </div>
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

        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5" data-testid="section-save-conference">
          <div className="max-w-2xl">
            <h2 className="font-display text-lg font-bold">Salvar no histórico de fornecedores</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Guarda os itens conferidos, os valores calculados, a nota e o selo na sua conta.
            </p>
            {pendingCount > 0 && (
              <p className="mt-2 text-xs font-medium text-amber-800" role="note">
                Conclua a correspondência e confira a quantidade de todos os itens para salvar.
              </p>
            )}
            {saveStatus && (
              <p
                className={`mt-2 text-sm font-medium ${saveStatus.tone === "success" ? "text-emerald-800" : "text-destructive"}`}
                role={saveStatus.tone === "success" ? "status" : "alert"}
                aria-live="polite"
                data-testid="status-save-conference"
              >
                {saveStatus.message}
              </p>
            )}
          </div>
          <Button
            type="button"
            onClick={saveConference}
            disabled={pendingCount > 0 || saveConferenceMutation.isPending}
            className="w-full shrink-0 sm:w-auto"
            data-testid="button-save-conference"
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {saveConferenceMutation.isPending ? "Salvando..." : "Salvar conferência"}
          </Button>
        </section>

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
  const { invoice, version, setInvoice } = useNfe();
  const latestInvoiceQuery = useGetLatestAccountInvoice({
    query: {
      enabled: !invoice,
      queryKey: getGetLatestAccountInvoiceQueryKey(),
    },
  });

  useEffect(() => {
    const latest = latestInvoiceQuery.data?.invoice;
    if (!invoice && latest) setInvoice({ ...latest.invoice, id: latest.id });
  }, [invoice, latestInvoiceQuery.data, setInvoice]);

  if (!invoice) {
    if (latestInvoiceQuery.isLoading) {
      return (
        <main className="mx-auto max-w-3xl px-5 py-16" aria-busy="true">
          <p className="text-center text-sm text-muted-foreground">Carregando sua última nota...</p>
        </main>
      );
    }
    if (latestInvoiceQuery.isError) {
      return (
        <main className="mx-auto max-w-3xl px-5 py-16">
          <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center" role="alert">
            <h1 className="font-display text-2xl font-bold">Não foi possível carregar a nota</h1>
            <p className="mt-2 text-sm text-muted-foreground">Tente novamente ou abra a tela Nota fiscal.</p>
            <Button type="button" className="mt-5" onClick={() => void latestInvoiceQuery.refetch()}>
              Tentar novamente
            </Button>
          </section>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
        <section className="rounded-2xl border bg-card p-6 text-center sm:p-10">
          <FileCheck2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 font-display text-3xl font-bold">Carregue uma nota fiscal</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            A conferência usa os itens da NF-e aberta. Volte à tela Nota fiscal e selecione um XML.
          </p>
          <Button asChild className="mt-6">
            <Link href="/nota-fiscal" data-testid="link-load-invoice">Ir para Nota fiscal</Link>
          </Button>
        </section>
      </main>
    );
  }

  return <ConferenceResults key={version} invoice={invoice} version={version} />;
}
