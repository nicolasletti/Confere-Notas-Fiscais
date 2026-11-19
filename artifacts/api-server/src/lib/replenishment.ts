import type { ReplenishmentItem, ReplenishmentSummary } from "@workspace/api-zod";
import type { StoredInvoice } from "@workspace/db";
import { extractReplenishmentIdentity } from "./replenishment-identity";
import {
  addRatio, decimalRatio, divideRatio, integerRatio, multiplyRatio,
  ratioString, subtractRatio, type Ratio,
} from "./estimate-decimal";

export interface ReplenishmentInvoice {
  id: number;
  invoice: StoredInvoice;
  originalXml: string;
}
const DAY_MS = 86_400_000;

function dayNumber(value: string): number {
  const date = value.slice(0, 10);
  const result = Date.parse(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(result) ||
    new Date(result).toISOString().slice(0, 10) !== date) {
    throw new Error("Data inválida no histórico de compras.");
  }
  return Math.floor(result / DAY_MS);
}
function dateString(day: number): string {
  const date = new Date(day * DAY_MS);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) {
    throw new Error("A data prevista ultrapassa o calendário suportado.");
  }
  return date.toISOString().slice(0, 10);
}
function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}
export function todaySaoPaulo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
interface Purchase { day: number; quantity: Ratio; description: string }
interface Product {
  id: string; unit: string; code: string | null; suppliers: Set<string>;
  identification: "code-supplier" | "description"; purchases: Map<number, Purchase>;
}

export function replenishment(
  invoices: ReplenishmentInvoice[], asOf = todaySaoPaulo(),
): ReplenishmentSummary {
  const today = dayNumber(asOf);
  const monthStart = `${asOf.slice(0, 7)}-01`;
  const monthDay = dayNumber(monthStart);
  const groups = new Map<string, Product>();
  let futureInvoices = 0, unreadableIdentityInvoices = 0;
  for (const row of invoices) {
    const invoice = row.invoice;
    const day = dayNumber(invoice.issuedAt);
    if (day > today) { futureInvoices++; continue; }
    const needsRecovery = !invoice.issuerCnpj || invoice.items.some((item) => !item.productCode);
    const recovered = needsRecovery ? extractReplenishmentIdentity(row.originalXml, invoice.items.length) : null;
    if (needsRecovery && !recovered) unreadableIdentityInvoices++;
    const rawCnpj = invoice.issuerCnpj ?? recovered?.issuerCnpj;
    const cnpj = rawCnpj?.replace(/\D/g, "");
    invoice.items.forEach((item, index) => {
      const code = item.productCode?.trim() || recovered?.productCodes[index]?.trim();
      const complete = Boolean(code && cnpj?.length === 14);
      const unit = item.unit.trim().replace(/\s+/g, " ").toUpperCase();
      const key = JSON.stringify(complete
        ? ["code-supplier", cnpj, code, normalize(unit)]
        : ["description", normalize(item.description), normalize(unit)]);
      let product = groups.get(key);
      if (!product) {
        product = {
          id: key, unit, code: complete ? code! : null,
          identification: complete ? "code-supplier" : "description",
          suppliers: new Set(), purchases: new Map(),
        };
        groups.set(key, product);
      }
      product.suppliers.add(invoice.issuer);
      const quantity = decimalRatio(item.quantity);
      const existing = product.purchases.get(row.id);
      // One NF-e is one purchase, even when its product appears on several lines.
      product.purchases.set(row.id, {
        day, description: item.description,
        quantity: existing ? addRatio(existing.quantity, quantity) : quantity,
      });
    });
  }
  const items: ReplenishmentItem[] = [];
  let insufficientHistoryItems = 0, sameDayOnlyItems = 0;
  for (const product of groups.values()) {
    const purchases = [...product.purchases.entries()]
      .sort(([idA, a], [idB, b]) => a.day - b.day || idA - idB)
      .map(([, purchase]) => purchase);
    const count = purchases.length;
    if (count < 2) { insufficientHistoryItems++; continue; }
    const first = purchases[0]!, last = purchases[count - 1]!;
    const span = last.day - first.day;
    if (span === 0) { sameDayOnlyItems++; continue; }
    const interval = divideRatio(integerRatio(span), integerRatio(count - 1));
    const total = purchases.reduce((sum, p) => addRatio(sum, p.quantity), integerRatio(0));
    const averageQuantity = divideRatio(total, integerRatio(count));
    const daily = divideRatio(averageQuantity, interval);
    const elapsed = today - last.day;
    const stock = subtractRatio(last.quantity, multiplyRatio(daily, integerRatio(elapsed)));
    // Fractional expected dates are rounded upward to a whole calendar day, only for display.
    const nextDay = last.day + Math.ceil(span / (count - 1));
    const due = interval.n <= BigInt(elapsed) * interval.d;
    const soon = interval.n <= BigInt(elapsed + 3) * interval.d;
    const purchasedThisMonth = purchases.filter((p) => p.day >= monthDay)
      .reduce((sum, p) => addRatio(sum, p.quantity), integerRatio(0));
    const consumedThisMonth = multiplyRatio(daily, integerRatio(today - Math.max(monthDay, first.day)));
    items.push({
      id: product.id, description: last.description, unit: product.unit,
      supplierNames: [...product.suppliers].sort(), productCode: product.code,
      identification: product.identification, purchaseCount: count,
      averageIntervalDays: ratioString(interval), averageQuantity: ratioString(averageQuantity),
      dailyConsumption: ratioString(daily), estimatedStock: ratioString(stock),
      lastPurchaseDate: dateString(last.day), lastPurchaseQuantity: ratioString(last.quantity),
      daysSinceLastPurchase: elapsed, nextPurchaseDate: dateString(nextDay),
      purchasedThisMonth: ratioString(purchasedThisMonth), consumedThisMonth: ratioString(consumedThisMonth),
      status: stock.n <= 0n || due ? "buy-now" : soon ? "soon" : "ok",
    });
  }
  items.sort((a, b) => a.nextPurchaseDate.localeCompare(b.nextPurchaseDate) ||
    a.description.localeCompare(b.description, "pt-BR") || a.id.localeCompare(b.id));
  return { asOf, monthStart, items, insufficientHistoryItems, sameDayOnlyItems, unreadableIdentityInvoices, futureInvoices };
}
