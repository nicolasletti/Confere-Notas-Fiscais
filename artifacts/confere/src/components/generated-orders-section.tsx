import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAccountOrderQueryKey,
  getListGeneratedOrdersQueryKey,
  useActivateGeneratedOrder,
  useGetAccountOrder,
  useListGeneratedOrders,
  useListSupplierContacts,
  type GeneratedOrder,
  type OrderItem,
} from "@workspace/api-client-react";
import { AlertTriangle, Info, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import GeneratedOrderCard from "@/components/generated-order-card";

export default function GeneratedOrdersSection({ onActivated }: { onActivated: () => void }) {
  const queryClient = useQueryClient();
  const list = useListGeneratedOrders();
  const contacts = useListSupplierContacts();
  const active = useGetAccountOrder();
  const activate = useActivateGeneratedOrder();
  const [pending, setPending] = useState<{ order: GeneratedOrder; expectedItems: OrderItem[] } | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  const phoneOf = (key: string) => contacts.data?.find((c) => c.key === key)?.whatsapp ?? "";
  const orders = list.data ?? [];
  const repl = orders.filter((o) => o.kind === "replenishment");
  const backups = orders.filter((o) => o.kind === "backup");

  async function confirm() {
    const target = pending?.order;
    if (!target) return;
    const expectedItems = pending!.expectedItems;
    setPending(null);
    setMsg(null);
    try {
      const res = await activate.mutateAsync({ id: target.id, data: { expectedItems } });
      queryClient.setQueryData(getGetAccountOrderQueryKey(), res);
      await queryClient.invalidateQueries({ queryKey: getListGeneratedOrdersQueryKey() });
      onActivated();
      setMsg({ kind: "ok", text: "Pedido carregado. Revise as quantidades e confirme os preços acima antes de conferir a nota. Se havia outro pedido ativo diferente, ele foi guardado em \"Pedido anterior\"." });
    } catch (e) {
      if ((e as { status?: number }).status === 409) {
        await active.refetch();
        setMsg({ kind: "warn", text: "O pedido ativo mudou desde que você abriu a confirmação. Nada foi substituído. Confira o pedido atual e confirme de novo." });
      } else {
        setMsg({ kind: "err", text: "Não foi possível usar este pedido agora. Nada foi substituído. Tente novamente." });
      }
    }
  }
  function requestActivation(order: GeneratedOrder) {
    if (!active.data || active.isFetching || activate.isPending) return;
    setPending({ order, expectedItems: structuredClone(active.data.items) });
  }

  return (
    <section className="mt-10" aria-labelledby="generated-orders-title">
      <h2 id="generated-orders-title" className="font-display text-xl font-bold">Pedidos guardados</h2>
      <div className="mt-2 flex gap-3 rounded-xl border border-primary/20 bg-accent p-3.5 text-sm text-accent-foreground" data-testid="text-active-order-explainer">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>Por enquanto a Conferência usa <strong>um pedido ativo</strong>, o de cima. Gerar pedidos na Reposição não mexe nele. Quando a nota de um fornecedor chegar, escolha aqui o pedido dele e toque em "Usar este pedido". O ativo atual é guardado como "Pedido anterior" e pode voltar do mesmo jeito.</p>
      </div>

      {msg && (
        <p role={msg.kind === "ok" ? "status" : "alert"} data-testid="status-activation" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${msg.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : msg.kind === "warn" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
          {msg.text}
        </p>
      )}

      {list.isLoading ? (
        <div className="mt-4 space-y-3" aria-busy="true" aria-label="Carregando pedidos guardados">
          {[0, 1].map((i) => <div key={i} className="rounded-2xl border bg-card p-5"><div className="skel h-5 w-1/3" /><div className="skel mt-3 h-16 w-full" /></div>)}
        </div>
      ) : list.isError ? (
        <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-card p-5 text-sm">
          <p>Não foi possível carregar os pedidos guardados.</p>
          <Button variant="outline" className="mt-3" onClick={() => void list.refetch()} data-testid="button-generated-retry"><RotateCcw aria-hidden /> Tentar de novo</Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="paper-lines mt-4 rounded-2xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground" data-testid="empty-generated-orders">
          Nenhum pedido guardado ainda. Gere pedidos a partir dos itens urgentes em Reposição.
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {repl.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-primary">Gerados pela reposição</h3>
              {repl.map((o) => <GeneratedOrderCard key={o.id} order={o} savedWhatsapp={phoneOf(o.supplierKey)} onUse={requestActivation} useDisabled={activate.isPending || active.isFetching || !active.data} />)}
            </div>
          )}
          {backups.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">Pedidos anteriores</h3>
              {backups.map((o) => <GeneratedOrderCard key={o.id} order={o} savedWhatsapp="" onUse={requestActivation} useDisabled={activate.isPending || active.isFetching || !active.data} />)}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display"><AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden /> Substituir o pedido ativo?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido ativo ({pending?.expectedItems.length ?? 0} {(pending?.expectedItems.length ?? 0) === 1 ? "item" : "itens"}) será substituído por {pending?.order.kind === "backup" ? "este pedido anterior" : `o pedido de ${pending?.order.supplierName}`} ({pending?.order.items.length ?? 0} {pending?.order.items.length === 1 ? "item" : "itens"}). O pedido atual salvo fica guardado como "Pedido anterior", se houver itens diferentes.
              {" "}Edições ainda não salvas e rascunhos de importação serão descartados. Os preços de reposição são referências da última compra: confirme ou ajuste o combinado antes da conferência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-activate">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirm()} data-testid="button-confirm-activate">Sim, usar este pedido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
