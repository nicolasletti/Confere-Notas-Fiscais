import { useRef, useState } from "react";
import type { GeneratedOrder } from "@workspace/api-client-react";
import { Check, Copy, History, PackagePlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import SupplierContactEditor from "@/components/supplier-contact-editor";

export function fmtQty(value: string): string {
  const m = /^(\d+)(?:[.,](\d+))?$/.exec(value.trim());
  if (!m) return value || "—";
  const int = m[1]!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const dec = m[2]?.replace(/0+$/, "");
  return `${int}${dec ? `,${dec}` : ""}`;
}

export function fmtPrice(value: string): string {
  const m = /^(\d+)(?:[.,](\d+))?$/.exec(value.trim());
  if (!m) return value || "—";
  const int = m[1]!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${int},${(m[2] ?? "").replace(/0+$/, "").padEnd(2, "0")}`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

interface Props {
  order: GeneratedOrder;
  savedWhatsapp: string;
  onUse?: (order: GeneratedOrder) => void;
  useDisabled?: boolean;
}

export default function GeneratedOrderCard({ order, savedWhatsapp, onUse, useDisabled }: Props) {
  const isBackup = order.kind === "backup";
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const sfx = String(order.id);

  async function copy() {
    if (copyState === "copying") return;
    setCopyState("copying");
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(order.message);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("failed");
      textRef.current?.focus();
      textRef.current?.select();
    }
  }

  return (
    <article className="rise relative overflow-hidden rounded-2xl border bg-card p-4 pl-5 sm:p-5 sm:pl-6" data-testid={`card-generated-order-${sfx}`}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${isBackup ? "bg-muted-foreground/40" : "bg-primary"}`} />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {isBackup ? <History className="h-3.5 w-3.5" aria-hidden /> : <PackagePlus className="h-3.5 w-3.5 text-primary" aria-hidden />}
            {isBackup ? "Pedido anterior" : "Pedido de reposição"} · <span className="font-mono normal-case tracking-normal">{fmtWhen(order.createdAt)}</span>
          </p>
          <h3 className="mt-1 break-words font-display text-lg font-bold leading-tight" data-testid={`text-generated-supplier-${sfx}`}>
            {isBackup ? "Cópia de segurança do pedido ativo" : order.supplierName}
          </h3>
          <p className="text-xs text-muted-foreground">{order.items.length} {order.items.length === 1 ? "item" : "itens"}</p>
        </div>
        {onUse && (
          <Button type="button" onClick={() => onUse(order)} disabled={useDisabled} aria-label={`Usar este pedido: ${isBackup ? "pedido anterior" : order.supplierName}`} data-testid={`button-use-order-${sfx}`}>
            <Upload aria-hidden /> Usar este pedido
          </Button>
        )}
      </header>

      <ul className="mt-3 divide-y rounded-xl border bg-background/50 text-sm">
        {order.items.map((it) => (
          <li key={it.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="min-w-0 break-words">{it.descricao}</span>
            <span className="shrink-0 text-right font-mono tabular-nums">
              {fmtQty(it.quantidade)} {it.unidade}
              <span className="block text-xs text-muted-foreground">ref. R$ {fmtPrice(it.precoUnitario)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-muted-foreground">Preços são referência do último valor pago, não preço combinado.</p>

      {!isBackup && (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor={`msg-${sfx}`} className="text-sm font-semibold">Mensagem para o fornecedor</label>
            <Textarea id={`msg-${sfx}`} ref={textRef} readOnly value={order.message} rows={Math.min(10, order.message.split("\n").length + 1)} className="mt-1 resize-y bg-background font-mono text-xs" data-testid={`text-generated-message-${sfx}`} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copy} disabled={copyState === "copying"} aria-label={`Copiar mensagem do pedido de ${order.supplierName}`} data-testid={`button-copy-message-${sfx}`}>
                {copyState === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copyState === "copied" ? "Copiado" : "Copiar"}
              </Button>
              <span role="status" className="text-xs">
                {copyState === "copied" && <span className="text-emerald-800">Mensagem copiada.</span>}
                {copyState === "failed" && <span className="text-amber-800">Não deu para copiar automaticamente. O texto foi selecionado: copie manualmente.</span>}
              </span>
            </div>
          </div>
          <SupplierContactEditor supplierKey={order.supplierKey} supplierName={order.supplierName} savedWhatsapp={savedWhatsapp} message={order.message} testIdSuffix={`order-${sfx}`} />
        </div>
      )}
    </article>
  );
}
