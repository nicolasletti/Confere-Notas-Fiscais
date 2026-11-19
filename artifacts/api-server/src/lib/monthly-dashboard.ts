import type { MonthlyDashboard, MonthlyMetrics } from "@workspace/api-zod";
import type { StoredInvoice } from "@workspace/db";

export interface DashboardInvoice {
  id: number;
  identity: string;
  issuer: string;
  issuedAt: string;
  hasCompleteIbsCbs: boolean;
  invoice: StoredInvoice;
}

export interface DashboardConference {
  invoiceId: number | null;
  identity: string;
  issuedAt: string;
  totalExtraChargeCents: string;
  savedAt: Date;
}

type Decimal = { value: bigint; scale: bigint };

function decimal(raw: string): Decimal {
  const normalized = raw.trim().replace(",", ".");
  if (normalized.length > 80 || !/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error("Valor decimal inválido nos dados da nota.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return { value: BigInt(whole + fraction), scale: 10n ** BigInt(fraction.length) };
}

function rounded(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (2n * denominator);
}

function cents(raw: string): bigint {
  const parsed = decimal(raw);
  return rounded(parsed.value * 100n, parsed.scale);
}

function add(a: Decimal, b: Decimal): Decimal {
  // Decimal scales are powers of ten, so their maximum is a common denominator.
  const scale = a.scale > b.scale ? a.scale : b.scale;
  return { value: a.value * (scale / a.scale) + b.value * (scale / b.scale), scale };
}

function decimalString(value: Decimal): string {
  if (value.scale === 1n) return value.value.toString();
  const places = value.scale.toString().length - 1;
  const text = value.value.toString().padStart(places + 1, "0");
  return `${text.slice(0, -places)}.${text.slice(-places)}`.replace(/\.?0+$/, "") || "0";
}

function normalize(text: string): string {
  return text.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function previousMonth(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return number === 1 ? `${String(year - 1).padStart(4, "0")}-12`
    : `${year}-${String(number - 1).padStart(2, "0")}`;
}

export function validMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 1;
}

function normalizeCharge(value: string): bigint {
  if (!/^-?\d+$/.test(value)) throw new Error("Valor de conferência inválido.");
  const parsed = BigInt(value);
  return parsed > 0n ? parsed : 0n;
}

export function summarizeDateRange(
  start: string,
  endExclusive: string,
  invoices: DashboardInvoice[],
  conferences: DashboardConference[],
) {
  // Compare the calendar date as written in the XML, without converting its offset to UTC.
  const inPeriod = (issuedAt: string) => {
    const date = issuedAt.slice(0, 10);
    return date >= start && date < endExclusive;
  };
  const periodInvoices = invoices.filter((row) => inPeriod(row.issuedAt));
  const byId = new Map(invoices.map((row) => [row.id, row]));
  const byIdentity = new Map(invoices.map((row) => [row.identity, row]));
  const conferenceByInvoice = new Map<number, DashboardConference>();
  let excludedLegacyConferenceCount = 0;
  for (const conference of conferences) {
    const invoice = (conference.invoiceId === null ? undefined : byId.get(conference.invoiceId))
      ?? byIdentity.get(conference.identity);
    if (!invoice) {
      if (inPeriod(conference.issuedAt)) excludedLegacyConferenceCount += 1;
      continue;
    }
    const previous = conferenceByInvoice.get(invoice.id);
    if (!previous || conference.savedAt.getTime() > previous.savedAt.getTime()) {
      conferenceByInvoice.set(invoice.id, conference);
    }
  }

  const suppliers = new Map<string, {
    name: string; purchased: bigint; extra: bigint; count: number;
    latest: DashboardInvoice;
  }>();
  const items = new Map<string, {
    description: string; unit: string; quantity: Decimal; total: bigint;
  }>();
  let purchased = 0n;
  let extra = 0n;
  let divergentInvoiceCount = 0;
  let unverifiedInvoiceCount = 0;
  for (const row of periodInvoices) {
    const supplierKey = normalize(row.issuer);
    let supplier = suppliers.get(supplierKey);
    if (!supplier) {
      supplier = { name: row.issuer, purchased: 0n, extra: 0n, count: 0, latest: row };
      suppliers.set(supplierKey, supplier);
    }
    supplier.count++;
    const rowTime = Date.parse(row.issuedAt);
    const latestTime = Date.parse(supplier.latest.issuedAt);
    if (rowTime > latestTime || (rowTime === latestTime && row.id > supplier.latest.id)) {
      supplier.latest = row;
      supplier.name = row.issuer;
    }
    for (const product of row.invoice.items) {
      const total = cents(product.total);
      purchased += total;
      supplier.purchased += total;
      const key = JSON.stringify([normalize(product.description), normalize(product.unit)]);
      const existing = items.get(key);
      const quantity = decimal(product.quantity);
      if (existing) {
        existing.quantity = add(existing.quantity, quantity);
        existing.total += total;
      } else {
        items.set(key, {
          description: product.description, unit: product.unit.trim().toUpperCase(),
          quantity, total,
        });
      }
    }
    const conference = conferenceByInvoice.get(row.id);
    if (!conference) {
      unverifiedInvoiceCount++;
    } else {
      const charge = normalizeCharge(conference.totalExtraChargeCents);
      extra += charge;
      supplier.extra += charge;
      if (charge > 0n) divergentInvoiceCount++;
    }
  }

  const metrics: MonthlyMetrics = {
    purchasedCents: purchased.toString(), invoiceCount: periodInvoices.length,
    extraChargeCents: extra.toString(), divergentInvoiceCount,
  };
  return {
    metrics, unverifiedInvoiceCount, excludedLegacyConferenceCount,
    suppliers: [...suppliers.values()]
      .sort((a, b) => a.purchased === b.purchased
        ? a.name.localeCompare(b.name, "pt-BR") : a.purchased > b.purchased ? -1 : 1)
      .map((row) => ({
        name: row.name, purchasedCents: row.purchased.toString(), extraChargeCents: row.extra.toString(),
        invoiceCount: row.count, hasCompleteIbsCbs: row.latest.hasCompleteIbsCbs,
        latestIssuedAt: row.latest.issuedAt,
      })),
    items: [...items.values()]
      .sort((a, b) => {
        const difference = a.quantity.value * b.quantity.scale - b.quantity.value * a.quantity.scale;
        return difference === 0n ? a.description.localeCompare(b.description, "pt-BR") : difference > 0n ? -1 : 1;
      })
      .map((row) => ({
        description: row.description, unit: row.unit,
        quantity: decimalString(row.quantity), totalCents: row.total.toString(),
        averagePriceCents: row.quantity.value === 0n ? null
          : rounded(row.total * row.quantity.scale, row.quantity.value).toString(),
      })),
  };
}

export function monthlyDashboard(
  month: string, invoices: DashboardInvoice[], conferences: DashboardConference[],
): MonthlyDashboard {
  if (!validMonth(month)) throw new Error("Mês inválido.");
  const previous = previousMonth(month);
  const [year, number] = month.split("-").map(Number);
  const next = `${String(number === 12 ? year + 1 : year).padStart(4, "0")}-${String(number === 12 ? 1 : number + 1).padStart(2, "0")}`;
  const current = summarizeDateRange(`${month}-01`, `${next}-01`, invoices, conferences);
  return {
    month, previousMonth: previous, current: current.metrics,
    previous: summarizeDateRange(`${previous}-01`, `${month}-01`, invoices, conferences).metrics,
    suppliers: current.suppliers, items: current.items,
    unverifiedInvoiceCount: current.unverifiedInvoiceCount,
    excludedLegacyConferenceCount: current.excludedLegacyConferenceCount,
  };
}

function money(raw: string): string {
  const value = BigInt(raw).toString().padStart(3, "0");
  return `${value.slice(0, -2)},${value.slice(-2)}`;
}

function csvCell(value: string | number): string {
  let text = String(value);
  // Supplier names and descriptions are untrusted XML: prevent spreadsheet formulas.
  if (/^[\s]*[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

interface ReportPeriod {
  title: string;
  label: string;
  previousLabel: string;
  criterion: string;
  sealLabel: string;
}

export function monthlyCsv(data: MonthlyDashboard, period?: ReportPeriod): string {
  const rows: (string | number)[][] = [
    [period?.title ?? "coNFere — Relatório do mês", period?.label ?? data.month],
    ["Critério", period?.criterion ?? "Mês de emissão da nota; compras = soma dos valores dos produtos (vProd), sem frete e outros acréscimos."],
    ["Divergências", "Somente conferências salvas vinculadas a notas importadas; valores favoráveis não reduzem cobranças a mais."],
    ["Indicador", period?.label ?? data.month, period?.previousLabel ?? data.previousMonth],
    ["Total comprado (R$)", money(data.current.purchasedCents), money(data.previous.purchasedCents)],
    ["Número de notas", data.current.invoiceCount, data.previous.invoiceCount],
    ["Total cobrado a mais (R$)", money(data.current.extraChargeCents), money(data.previous.extraChargeCents)],
    ["Notas com divergência", data.current.divergentInvoiceCount, data.previous.divergentInvoiceCount],
    ["Notas sem conferência salva", data.unverifiedInvoiceCount],
    ["Resumos antigos sem XML excluídos", data.excludedLegacyConferenceCount],
    [],
    ["Compras por fornecedor / Fornecedores"],
    ["Fornecedor", "Total comprado (R$)", "Total cobrado a mais (R$)", "Número de notas", period?.sealLabel ?? "Reforma da última nota no mês", "Emissão da última nota"],
    ...data.suppliers.map((row) => [
      row.name, money(row.purchasedCents), money(row.extraChargeCents), row.invoiceCount,
      row.hasCompleteIbsCbs ? "Pronto para a reforma tributária" : "Atenção: nota sem os campos de IBS/CBS",
      row.latestIssuedAt,
    ]),
    [],
    ["Itens mais comprados"],
    ["Item", "Unidade", "Quantidade total", "Valor total (R$)", "Preço médio ponderado (R$)"],
    ...data.items.map((row) => [
      row.description, row.unit, row.quantity.replace(".", ","), money(row.totalCents),
      row.averagePriceCents === null ? "Sem quantidade para calcular" : money(row.averagePriceCents),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
