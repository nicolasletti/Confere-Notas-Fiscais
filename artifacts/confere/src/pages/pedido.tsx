import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2, X } from "lucide-react";
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

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      <section className="rise">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary">Antes de receber</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Pedido ao fornecedor
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Anote o que foi combinado. O pedido fica salvo neste navegador.
          </p>
        </div>

        {storageWarning && (
          <p role="status" className="mt-6 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950" data-testid="status-storage-warning">
            {storageWarning}
          </p>
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
