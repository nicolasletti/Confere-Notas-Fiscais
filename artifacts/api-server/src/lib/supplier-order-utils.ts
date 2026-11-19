import type { ReplenishmentItem, ReplenishmentOrderSelection } from "@workspace/api-zod";
import type { StoredOrderItem } from "@workspace/db";
import { randomUUID } from "node:crypto";

export function supplierIdentity(cnpj: string | undefined, name: string): string {
  const digits = cnpj?.replace(/\D/g, "");
  return digits?.length === 14 ? `cnpj:${digits}` : `name:${name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")}`;
}
export function normalizeWhatsapp(value: string): string {
  if (!value.trim()) return "";
  if (!/^\+?[\d\s().-]+$/.test(value.trim())) throw new Error("Digite um WhatsApp válido, com DDD e número.");
  let digits = value.replace(/\D/g, "");
  if (!value.trim().startsWith("+") && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error("Use DDD e número, ou +DDI para um telefone internacional.");
  return digits;
}
export function quantityString(raw: string): string {
  const value = raw.trim().replace(",", ".");
  if (value.length > 50 || !/^\d+(?:\.\d+)?$/.test(value) || !/[1-9]/.test(value)) {
    throw new Error("Preencha uma quantidade maior que zero para cada item.");
  }
  const [whole, fraction = ""] = value.split(".");
  const canonical = `${BigInt(whole)}${fraction.replace(/0+$/, "") ? "." + fraction.replace(/0+$/, "") : ""}`;
  return canonical;
}
export interface SupplierOrderDraft {
  supplierKey: string; supplierName: string; items: StoredOrderItem[];
}
export function selectionFingerprint(selected: ReplenishmentOrderSelection[]): string {
  return JSON.stringify(selected.map((s) => ({ id: s.id, quantity: quantityString(s.quantity) }))
    .sort((a, b) => a.id.localeCompare(b.id)));
}
export function orderItemsEqual(a: StoredOrderItem[], b: StoredOrderItem[]): boolean {
  return a.length === b.length && a.every((item, i) => {
    const other = b[i];
    return item.id === other.id && item.descricao === other.descricao &&
      item.quantidade === other.quantidade && item.unidade === other.unidade &&
      item.precoUnitario === other.precoUnitario;
  });
}
export function groupReplenishmentSelection(
  available: ReplenishmentItem[], selected: ReplenishmentOrderSelection[],
): { fingerprint: string; groups: SupplierOrderDraft[] } {
  if (!selected.length || selected.length > 100 || new Set(selected.map((s) => s.id)).size !== selected.length) {
    throw new Error("Selecione de 1 a 100 itens, sem repetições.");
  }
  const index = new Map(available.map((item) => [item.id, item]));
  const groups = new Map<string, SupplierOrderDraft>();
  const normalized = selected.map((s) => ({ id: s.id, quantity: quantityString(s.quantity) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const selection of normalized) {
    const item = index.get(selection.id);
    if (!item || item.status === "ok") throw new Error("A seleção mudou. Atualize a Reposição e escolha itens vermelhos ou amarelos.");
    if (!/^\d+(?:\.\d+)?$/.test(item.lastUnitPrice)) throw new Error("Preço de referência inválido no histórico.");
    let group = groups.get(item.supplierKey);
    if (!group) {
      group = { supplierKey: item.supplierKey, supplierName: item.supplierName, items: [] };
      groups.set(group.supplierKey, group);
    }
    group.items.push({
      id: randomUUID(), descricao: item.description, quantidade: selection.quantity,
      unidade: item.unit, precoUnitario: item.lastUnitPrice,
    });
  }
  return { fingerprint: selectionFingerprint(selected), groups: [...groups.values()] };
}
function clean(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}
export function orderMessage(introduction: string, items: StoredOrderItem[]): string {
  const greeting = clean(introduction);
  if (greeting.length < 4 || greeting.length > 180 || /[\d$€£]/u.test(greeting)) {
    throw new Error("A introdução gerada não está no formato esperado.");
  }
  return [
    greeting, "",
    ...items.map((item) => `• ${clean(item.descricao)} — ${item.quantidade.replace(".", ",")} ${clean(item.unidade)}`),
    "", "Pode confirmar a disponibilidade, os preços e o prazo de entrega, por favor? Obrigado(a)!",
  ].join("\n");
}
