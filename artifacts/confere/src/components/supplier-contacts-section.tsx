import { useListSupplierContacts } from "@workspace/api-client-react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import SupplierContactEditor from "@/components/supplier-contact-editor";

export default function SupplierContactsSection() {
  const q = useListSupplierContacts();
  return (
    <section className="mt-10" aria-labelledby="contacts-title">
      <h2 id="contacts-title" className="font-display text-xl font-bold sm:text-2xl">WhatsApp dos fornecedores</h2>
      <p className="mt-1 text-sm text-muted-foreground">Usado para abrir a conversa com os pedidos gerados. Nada é enviado sem você.</p>
      {q.isLoading ? (
        <div className="mt-4 space-y-2" aria-busy="true">{[0, 1].map((i) => <div key={i} className="skel h-20 w-full" />)}</div>
      ) : q.isError ? (
        <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          Não foi possível carregar os contatos.
          <Button variant="outline" size="sm" className="ml-2" onClick={() => void q.refetch()} data-testid="button-contacts-retry"><RotateCcw aria-hidden /> Tentar de novo</Button>
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <p className="mt-4 rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground" data-testid="empty-contacts">Os fornecedores aparecem aqui depois das primeiras notas enviadas.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2" data-testid="list-contacts">
          {q.data!.map((c, i) => <SupplierContactEditor key={c.key} supplierKey={c.key} supplierName={c.name} savedWhatsapp={c.whatsapp} testIdSuffix={`contact-${i}`} />)}
        </div>
      )}
    </section>
  );
}
