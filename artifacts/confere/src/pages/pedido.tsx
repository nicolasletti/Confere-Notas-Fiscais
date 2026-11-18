import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useExtractOrderItems } from "@workspace/api-client-react";
import { MessageSquareText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readPedido, savePedido, type PedidoItem } from "@/lib/pedido-store";

const formSchema = z.object({
  descricao: z.string().trim().min(1, "Informe a descrição do item."),
  quantidade: z
    .string()
    .trim()
    .regex(/^\d+(?:[.,]\d+)?$/, "Informe uma quantidade válida.")
    .refine((value) => Number(value.replace(",", ".")) > 0, "A quantidade deve ser maior que zero."),
  unidade: z.string().trim().min(1, "Informe a unidade."),
  precoUnitario: z
    .string()
    .trim()
    .regex(/^\d+(?:[.,]\d+)?$/, "Informe um preço válido.")
    .refine((value) => Number(value.replace(",", ".")) >= 0, "O preço não pode ser negativo."),
});

type FormValues = z.infer<typeof formSchema>;

interface DraftOrderItem {
  id: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  precoUnitario: string;
}

function draftIssues(item: DraftOrderItem): Set<string> {
  const result = formSchema.safeParse({
    descricao: item.descricao,
    quantidade: item.quantidade,
    unidade: item.unidade,
    precoUnitario: item.precoUnitario,
  });
  return new Set(result.success ? [] : result.error.issues.map((issue) => String(issue.path[0])));
}

function draftFieldHelp(value: string, invalid: boolean, label: string): string {
  if (!invalid) return "";
  return value.trim() ? `Confira ${label}.` : `Preencha ${label}.`;
}

function formatDecimal(value: string): string {
  const normalized = value.trim().replace(",", ".");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return value || "—";
  const integer = match[1]!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = match[2]?.replace(/0+$/, "");
  return `${integer}${decimal ? `,${decimal}` : ""}`;
}

function formatPrice(value: string): string {
  const normalized = value.trim().replace(",", ".");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return value || "—";
  const integer = match[1]!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = (match[2] ?? "").replace(/0+$/, "").padEnd(2, "0");
  return `${integer},${decimal}`;
}

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Pedido() {
  const [initial] = useState(readPedido);
  const [items, setItems] = useState<PedidoItem[]>(initial.items);
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [whatsappImportOpen, setWhatsappImportOpen] = useState(false);
  const [whatsappText, setWhatsappText] = useState("");
  const [draftItems, setDraftItems] = useState<DraftOrderItem[]>([]);
  const [extractError, setExtractError] = useState("");
  const [extractNotice, setExtractNotice] = useState("");
  const extractMutation = useExtractOrderItems();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descricao: "",
      quantidade: "",
      unidade: "",
      precoUnitario: "",
    },
  });

  function commit(next: PedidoItem[]) {
    setItems(next);
    if (savePedido(next)) {
      setStorageWarning(null);
    } else {
      setStorageWarning("O pedido está disponível nesta sessão, mas não foi possível salvá-lo neste navegador.");
    }
  }

  function resetForm() {
    form.reset({
      descricao: "",
      quantidade: "",
      unidade: "",
      precoUnitario: "",
    });
    setEditingId(null);
  }

  function onSubmit(values: FormValues) {
    const cleaned = {
      descricao: values.descricao.trim(),
      quantidade: values.quantidade.trim().replace(",", "."),
      unidade: values.unidade.trim(),
      precoUnitario: values.precoUnitario.trim().replace(",", "."),
    };

    if (editingId) {
      commit(items.map((item) => item.id === editingId ? { ...item, ...cleaned } : item));
    } else {
      commit([...items, { id: createId(), ...cleaned }]);
    }
    resetForm();
  }

  function startEdit(item: PedidoItem) {
    setEditingId(item.id);
    form.reset({
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade,
      precoUnitario: item.precoUnitario,
    });
    document.getElementById("pedido-form-title")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function removeItem(id: string) {
    commit(items.filter((item) => item.id !== id));
    if (editingId === id) resetForm();
  }

  async function extractWhatsAppItems() {
    setExtractError("");
    setExtractNotice("");
    try {
      const result = await extractMutation.mutateAsync({
        data: { text: whatsappText.trim() },
      });
      setDraftItems(result.items.map((item) => ({
        id: createId(),
        descricao: item.descricao,
        quantidade: item.quantidade ?? "",
        unidade: item.unidade ?? "",
        precoUnitario: item.precoUnitario ?? "",
      })));
      setExtractNotice(
        result.items.length
          ? `${result.items.length} ${result.items.length === 1 ? "item identificado" : "itens identificados"}. Revise os campos antes de salvar.`
          : "Não identifiquei itens no texto. Você pode ajustar a mensagem e tentar novamente.",
      );
    } catch {
      setExtractError("Não foi possível interpretar a mensagem agora. Tente novamente.");
    }
  }

  function updateDraftItem(id: string, update: Partial<Omit<DraftOrderItem, "id">>) {
    setDraftItems((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
    setExtractError("");
  }

  function saveDraftItems() {
    if (draftItems.length === 0) return;
    const allValid = draftItems.every((item) => formSchema.safeParse({
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade,
      precoUnitario: item.precoUnitario,
    }).success);
    if (!allValid) {
      setExtractError("Preencha ou corrija os campos destacados antes de adicionar ao pedido.");
      return;
    }

    const additions = draftItems.map(({ id: _draftId, ...item }) => ({
      id: createId(),
      descricao: item.descricao.trim(),
      quantidade: item.quantidade.trim().replace(",", "."),
      unidade: item.unidade.trim(),
      precoUnitario: item.precoUnitario.trim().replace(",", "."),
    }));
    commit([...items, ...additions]);
    setDraftItems([]);
    setWhatsappText("");
    setExtractError("");
    setExtractNotice(`${additions.length} ${additions.length === 1 ? "item adicionado" : "itens adicionados"} ao pedido.`);
    setWhatsappImportOpen(false);
  }

  function discardDraftItems() {
    setDraftItems([]);
    setExtractError("");
    setExtractNotice("");
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      <section className="rise">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary">Antes de receber</p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Pedido ao fornecedor
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Anote o que foi combinado. O pedido fica salvo neste navegador.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setWhatsappImportOpen((open) => !open)}
            aria-expanded={whatsappImportOpen}
            aria-controls="whatsapp-order-import"
            data-testid="button-open-whatsapp-import"
          >
            <MessageSquareText aria-hidden="true" />
            {whatsappImportOpen ? "Fechar importação" : "Colar mensagem do WhatsApp"}
          </Button>
        </div>

        {storageWarning && (
          <p role="status" className="mt-6 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950" data-testid="status-storage-warning">
            {storageWarning}
          </p>
        )}

        {extractNotice && (
          <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" data-testid="status-whatsapp-extraction">
            {extractNotice}
          </p>
        )}

        {whatsappImportOpen && (
          <section
            id="whatsapp-order-import"
            className="mt-6 rounded-2xl border border-primary/20 bg-primary/[0.025] p-5 sm:p-7"
            aria-labelledby="whatsapp-import-title"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="whatsapp-import-title" className="font-display text-xl font-bold">
                  Importar pedido do WhatsApp
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Cole a conversa ou a lista de produtos. A IA prepara um rascunho; os itens só entram no pedido depois da sua revisão.
                </p>
              </div>
              {draftItems.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={discardDraftItems} data-testid="button-discard-whatsapp-review">
                  <X aria-hidden="true" />
                  Descartar revisão
                </Button>
              )}
            </div>

            <label htmlFor="whatsapp-order-text" className="mt-5 block text-sm font-semibold">
              Mensagem do pedido
            </label>
            <Textarea
              id="whatsapp-order-text"
              value={whatsappText}
              onChange={(event) => {
                setWhatsappText(event.target.value);
                setExtractError("");
              }}
              placeholder={"Ex.: Oi! Pode separar 10 kg de arroz por 25,90 o quilo e 4 caixas de leite a 6,50 cada?"}
              rows={5}
              maxLength={12000}
              disabled={draftItems.length > 0 || extractMutation.isPending}
              className="mt-2 resize-y bg-background"
              data-testid="textarea-whatsapp-order"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Se a quantidade ou o preço não estiverem claros, o campo ficará em branco para você preencher.
              </p>
              <Button
                type="button"
                onClick={extractWhatsAppItems}
                disabled={!whatsappText.trim() || draftItems.length > 0 || extractMutation.isPending}
                data-testid="button-extract-whatsapp-items"
              >
                {extractMutation.isPending ? "Lendo mensagem..." : "Extrair itens com IA"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              O texto colado é enviado à OpenAI pela integração do Replit para extração e não fica salvo pelo Confere. Cole apenas o conteúdo necessário ao pedido.
            </p>

            {extractError && (
              <p role="alert" className="mt-3 text-sm text-destructive" data-testid="error-whatsapp-extraction">
                {extractError}
              </p>
            )}

            {draftItems.length > 0 && (
              <div className="mt-6 space-y-4 border-t pt-5" data-testid="whatsapp-review-list">
                <div>
                  <h3 className="font-display text-lg font-bold">Revise os itens extraídos</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Campos destacados precisam de atenção. Edite qualquer informação antes de adicionar ao pedido.
                  </p>
                </div>

                {draftItems.map((item, index) => {
                  const issues = draftIssues(item);
                  const inputClass = (invalid: boolean) => invalid
                    ? "border-amber-500 bg-amber-50 focus-visible:ring-amber-500"
                    : "";
                  return (
                    <article key={item.id} className="rounded-xl border bg-card p-4" data-testid={`whatsapp-review-item-${index}`}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item {index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setDraftItems((current) => current.filter((draft) => draft.id !== item.id))}
                          aria-label={`Remover item ${index + 1} da revisão`}
                          data-testid={`button-remove-whatsapp-item-${index}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="sm:col-span-2 lg:col-span-1">
                          <label htmlFor={`draft-description-${item.id}`} className="block text-sm font-medium">Descrição</label>
                          <Input
                            id={`draft-description-${item.id}`}
                            value={item.descricao}
                            onChange={(event) => updateDraftItem(item.id, { descricao: event.target.value })}
                            className={`mt-1 ${inputClass(issues.has("descricao"))}`}
                            aria-invalid={issues.has("descricao")}
                            data-testid={`input-draft-description-${index}`}
                          />
                          {issues.has("descricao") && <p className="mt-1 text-xs text-amber-800">Informe a descrição.</p>}
                        </div>
                        <div>
                          <label htmlFor={`draft-quantity-${item.id}`} className="block text-sm font-medium">Quantidade</label>
                          <Input
                            id={`draft-quantity-${item.id}`}
                            value={item.quantidade}
                            onChange={(event) => updateDraftItem(item.id, { quantidade: event.target.value })}
                            inputMode="decimal"
                            placeholder="Ex.: 10"
                            className={`mt-1 ${inputClass(issues.has("quantidade"))}`}
                            aria-invalid={issues.has("quantidade")}
                            data-testid={`input-draft-quantity-${index}`}
                          />
                          {issues.has("quantidade") && <p className="mt-1 text-xs text-amber-800">{draftFieldHelp(item.quantidade, true, "a quantidade")}</p>}
                        </div>
                        <div>
                          <label htmlFor={`draft-unit-${item.id}`} className="block text-sm font-medium">Unidade</label>
                          <Input
                            id={`draft-unit-${item.id}`}
                            value={item.unidade}
                            onChange={(event) => updateDraftItem(item.id, { unidade: event.target.value })}
                            placeholder="Ex.: kg, cx, un"
                            className={`mt-1 ${inputClass(issues.has("unidade"))}`}
                            aria-invalid={issues.has("unidade")}
                            data-testid={`input-draft-unit-${index}`}
                          />
                          {issues.has("unidade") && <p className="mt-1 text-xs text-amber-800">Informe a unidade.</p>}
                        </div>
                        <div>
                          <label htmlFor={`draft-price-${item.id}`} className="block text-sm font-medium">Preço unitário</label>
                          <Input
                            id={`draft-price-${item.id}`}
                            value={item.precoUnitario}
                            onChange={(event) => updateDraftItem(item.id, { precoUnitario: event.target.value })}
                            inputMode="decimal"
                            placeholder="Ex.: 25,90"
                            className={`mt-1 ${inputClass(issues.has("precoUnitario"))}`}
                            aria-invalid={issues.has("precoUnitario")}
                            data-testid={`input-draft-price-${index}`}
                          />
                          {issues.has("precoUnitario") && <p className="mt-1 text-xs text-amber-800">{draftFieldHelp(item.precoUnitario, true, "o preço unitário")}</p>}
                        </div>
                      </div>
                    </article>
                  );
                })}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Os itens só entram no pedido depois de você confirmar abaixo.
                  </p>
                  <Button
                    type="button"
                    onClick={saveDraftItems}
                    disabled={!draftItems.every((item) => formSchema.safeParse({
                      descricao: item.descricao,
                      quantidade: item.quantidade,
                      unidade: item.unidade,
                      precoUnitario: item.precoUnitario,
                    }).success)}
                    data-testid="button-save-whatsapp-items"
                  >
                    <Plus aria-hidden="true" />
                    Adicionar itens ao pedido
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mt-8 rounded-2xl border bg-card p-5 sm:p-7" aria-labelledby="pedido-form-title">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id="pedido-form-title" className="font-display text-xl font-bold">
                {editingId ? "Editar item" : "Adicionar item"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Preencha os dados combinados com o fornecedor.</p>
            </div>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm} data-testid="button-cancel-edit">
                <X aria-hidden="true" /> Cancelar
              </Button>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" noValidate>
              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-1">
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex.: Arroz tipo 1" autoComplete="off" data-testid="input-descricao" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" placeholder="Ex.: 10" data-testid="input-quantidade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex.: kg, cx, un" autoComplete="off" data-testid="input-unidade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="precoUnitario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço unitário combinado</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" placeholder="Ex.: 25,90" data-testid="input-preco-unitario" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" data-testid="button-save-item">
                  <Plus aria-hidden="true" />
                  {editingId ? "Salvar alterações" : "Adicionar ao pedido"}
                </Button>
              </div>
            </form>
          </Form>
        </section>

        <section className="mt-8" aria-labelledby="pedido-items-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="pedido-items-title" className="font-display text-xl font-bold">Itens do pedido</h2>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="text-pedido-count">
                {items.length} {items.length === 1 ? "item cadastrado" : "itens cadastrados"}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card">
            {items.length === 0 ? (
              <div className="px-5 py-12 text-center" data-testid="empty-pedido">
                <p className="font-medium">Seu pedido ainda está vazio</p>
                <p className="mt-1 text-sm text-muted-foreground">Adicione os produtos e valores combinados acima.</p>
              </div>
            ) : (
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Itens do pedido">
                <table className="w-full min-w-[700px] text-sm">
                  <caption className="sr-only">Itens cadastrados no pedido ao fornecedor</caption>
                  <thead>
                    <tr className="border-b bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="px-5 py-3 font-medium">Descrição</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Quantidade</th>
                      <th scope="col" className="px-4 py-3 font-medium">Unidade</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Preço unitário</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0 transition-colors hover:bg-accent/40" data-testid={`row-pedido-item-${item.id}`}>
                        <td className="px-5 py-3 font-medium" data-testid={`text-descricao-${item.id}`}>{item.descricao}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{formatDecimal(item.quantidade)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.unidade}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">R$ {formatPrice(item.precoUnitario)}</td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(item)} aria-label={`Editar ${item.descricao}`} data-testid={`button-edit-${item.id}`}>
                              <Pencil aria-hidden="true" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.id)} aria-label={`Remover ${item.descricao}`} data-testid={`button-remove-${item.id}`} className="text-muted-foreground hover:text-destructive">
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
