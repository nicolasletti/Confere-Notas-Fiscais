import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListGeneratedOrdersQueryKey,
  useGenerateReplenishmentOrders,
  useListGeneratedOrders,
  useListSupplierContacts,
  type ReplenishmentItem,
} from "@workspace/api-client-react";
import { AlertTriangle, ArrowRight, ClipboardList, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import GeneratedOrderCard, { fmtPrice } from "@/components/generated-order-card";

const QTY = /^\d+([.,]\d+)?$/;
const validQty = (q: string) => QTY.test(q.trim()) && Number(q.trim().replace(",", ".")) > 0;

function defaultQty(avg: string): string {
  return validQty(avg) ? avg.replace(".", ",") : "";
}

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}

type Sel = Record<string, { on: boolean; qty: string }>;

export default function ReplenishmentOrderBuilder({ items }: { items: ReplenishmentItem[] }) {
  const queryClient = useQueryClient();
  const urgent = useMemo(() => items.filter((i) => i.status !== "ok"), [items]);
  const idsKey = urgent.map((i) => i.id).join("|");
  const [sel, setSel] = useState<Sel>({});
  const requestId = useRef(uuid());
  const generate = useGenerateReplenishmentOrders();
  const saved = useListGeneratedOrders();
  const contacts = useListSupplierContacts();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    requestId.current = uuid();
    setSel((cur) => {
      const next: Sel = {};
      for (const i of urgent) next[i.id] = cur[i.id] ?? { on: true, qty: defaultQty(i.averageQuantity) };
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  function change(id: string, patch: Partial<{ on: boolean; qty: string }>) {
    requestId.current = uuid();
    setError("");
    setSuccess("");
    setSel((cur) => ({ ...cur, [id]: { ...cur[id]!, ...patch } }));
  }

  const groups = useMemo(() => {
    const m = new Map<string, ReplenishmentItem[]>();
    for (const i of urgent) m.set(i.supplierKey, [...(m.get(i.supplierKey) ?? []), i]);
    return [...m.entries()].sort((a, b) => a[1][0]!.supplierName.localeCompare(b[1][0]!.supplierName, "pt-BR"));
  }, [urgent]);

  const chosen = urgent.filter((i) => sel[i.id]?.on);
  const invalid = chosen.filter((i) => !validQty(sel[i.id]?.qty ?? ""));
  const blocked = chosen.length < 1 || chosen.length > 100 || invalid.length > 0;
  const busy = generate.isPending;

  async function onGenerate() {
    if (blocked || busy) return;
    setError("");
    setSuccess("");
    try {
      const res = await generate.mutateAsync({ data: { requestId: requestId.current, items: chosen.map((i) => ({ id: i.id, quantity: sel[i.id]!.qty.trim() })) } });
      await queryClient.invalidateQueries({ queryKey: getListGeneratedOrdersQueryKey() });
      setSuccess(`${res.length} ${res.length === 1 ? "pedido salvo" : "pedidos salvos"}, um por fornecedor. Seu pedido ativo não foi alterado.`);
    } catch (e) {
      const s = (e as { status?: number }).status;
      if (s === 400) setError("Algum item não pode mais ser pedido ou a quantidade é inválida. Atualize a página e revise a seleção.");
      else if (s === 409) { requestId.current = uuid(); setError("Esta solicitação já foi usada com outros dados. Confira a seleção e toque em Gerar pedido de novo."); }
      else if (s === 502) setError("Não conseguimos montar as mensagens agora. Nenhum pedido foi salvo. Tente de novo.");
      else setError("Não foi possível gerar os pedidos. Tente de novo; não haverá pedido duplicado.");
    }
  }

  const phoneOf = (key: string) => contacts.data?.find((c) => c.key === key)?.whatsapp ?? "";
  const savedRepl = (saved.data ?? []).filter((o) => o.kind === "replenishment");

  return (
    <section className="rise rounded-2xl border bg-card p-4 sm:p-6" aria-labelledby="builder-title">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" aria-hidden /></span>
        <div>
          <h2 id="builder-title" className="font-display text-xl font-bold">Montar pedido dos urgentes</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Só entram itens em vermelho e amarelo. Desmarque o que não quer e ajuste as quantidades. Os pedidos são salvos por fornecedor e <strong>não substituem seu pedido ativo</strong>.</p>
        </div>
      </div>

      {urgent.length === 0 ? (
        <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground" data-testid="empty-urgent">Nenhum item urgente agora.</p>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map(([supplierKey, list]) => (
            <fieldset key={supplierKey} disabled={busy} className="rounded-xl border">
              <legend className="ml-3 px-1.5 font-display text-sm font-bold">
                {list[0]!.supplierName || "Fornecedor não identificado"}
                {supplierKey.startsWith("cnpj:") && <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">CNPJ {supplierKey.slice(5)}</span>}
              </legend>
              <ul className="divide-y">
                {list.map((i) => {
                  const s = sel[i.id] ?? { on: false, qty: "" };
                  const bad = s.on && !validQty(s.qty);
                  return (
                    <li key={i.id} className={`grid gap-3 p-3 sm:grid-cols-[auto_1fr_10rem] sm:items-center ${s.on ? "" : "opacity-60"}`} data-testid={`row-order-item-${i.id}`}>
                      <Checkbox id={`pick-${i.id}`} checked={s.on} onCheckedChange={(v) => change(i.id, { on: v === true })} aria-label={`Incluir ${i.description} no pedido`} data-testid={`checkbox-order-item-${i.id}`} className="mt-1 sm:mt-0" />
                      <label htmlFor={`pick-${i.id}`} className="min-w-0 cursor-pointer">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${i.status === "buy-now" ? "bg-red-600" : "bg-amber-500"}`} aria-hidden />
                          <span className="font-semibold">{i.description}</span>
                          <span className="sr-only">{i.status === "buy-now" ? "comprar agora" : "comprar em breve"}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Último preço pago: <span className="font-mono">R$ {fmtPrice(i.lastUnitPrice)}</span>/{i.unit || "un"} · referência, não é preço combinado
                        </span>
                        {i.supplierNames.length > 1 && (
                          <span className="mt-1 flex items-start gap-1 text-xs text-amber-800"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />Comprado de {i.supplierNames.length} fornecedores; usamos o da última compra.</span>
                        )}
                      </label>
                      <div>
                        <label htmlFor={`qty-${i.id}`} className="sr-only">Quantidade de {i.description}</label>
                        <div className="flex items-center gap-2">
                          <Input id={`qty-${i.id}`} value={s.qty} inputMode="decimal" disabled={!s.on || busy} onChange={(e) => change(i.id, { qty: e.target.value })} aria-invalid={bad} className={`font-mono ${bad ? "border-amber-500 bg-amber-50" : ""}`} data-testid={`input-order-qty-${i.id}`} />
                          <span className="text-xs text-muted-foreground">{i.unit}</span>
                        </div>
                        {bad && <p className="mt-1 text-xs text-amber-800">Quantidade maior que zero.</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" data-testid="text-selected-count">
              {chosen.length} {chosen.length === 1 ? "item selecionado" : "itens selecionados"}
              {chosen.length > 100 && <span className="text-destructive"> · máximo de 100</span>}
              {invalid.length > 0 && <span className="text-amber-800"> · corrija {invalid.length} quantidade(s)</span>}
            </p>
            <Button type="button" size="lg" onClick={onGenerate} disabled={blocked || busy} data-testid="button-generate-orders">
              {busy ? "Gerando..." : "Gerar pedido"}
            </Button>
          </div>
          {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" data-testid="error-generate-orders">{error}</p>}
          {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" data-testid="status-generate-orders">{success}</p>}
        </div>
      )}

      <div className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="font-display text-lg font-bold">Pedidos gerados</h3>
          <Link href="/pedido" className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-2" data-testid="link-to-pedido">Ver em Pedido <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
        </div>
        {saved.isLoading ? (
          <div className="mt-3 rounded-2xl border p-5" aria-busy="true"><div className="skel h-5 w-1/3" /><div className="skel mt-3 h-14 w-full" /></div>
        ) : saved.isError ? (
          <div role="alert" className="mt-3 text-sm">
            Não foi possível carregar os pedidos gerados.
            <Button variant="outline" size="sm" className="ml-2" onClick={() => void saved.refetch()} data-testid="button-saved-retry"><RotateCcw aria-hidden /> Tentar de novo</Button>
          </div>
        ) : savedRepl.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground" data-testid="empty-saved-orders">Nenhum pedido gerado ainda.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {savedRepl.map((o) => <GeneratedOrderCard key={o.id} order={o} savedWhatsapp={phoneOf(o.supplierKey)} />)}
            <p className="text-xs text-muted-foreground">Para conferir uma nota com um destes pedidos, abra Pedido e toque em "Usar este pedido".</p>
          </div>
        )}
      </div>
    </section>
  );
}
