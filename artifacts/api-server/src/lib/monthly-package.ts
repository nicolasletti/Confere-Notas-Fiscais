import { strToU8, zipSync } from "fflate";
import type { StoredConferenceResult, StoredInvoice } from "@workspace/db";
import { amountToCents } from "./monthly-dashboard";
import { extractInvoiceReformTax } from "./monthly-reform-tax";

export interface MonthlyPackageInvoice {
  id: number;
  identity: string;
  issuer: string;
  invoiceNumber: string;
  issuedAt: string;
  invoice: StoredInvoice;
  originalXml: string;
}

export interface MonthlyPackageConference {
  invoiceId: number | null;
  identity: string;
  totalExtraChargeCents: string;
  results: StoredConferenceResult[];
}

export interface GeneratedMonthlyPackage {
  filename: string;
  content: Uint8Array;
}

export class MonthlyPackageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonthlyPackageLimitError";
  }
}

export const MAX_MONTHLY_PACKAGE_INVOICES = 500;
export const MAX_MONTHLY_PACKAGE_XML_BYTES = 20 * 1024 * 1024;

function formatCents(raw: string | bigint): string {
  const value = typeof raw === "bigint" ? raw : BigInt(raw);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = String(absolute % 100n).padStart(2, "0");
  return `R$ ${negative ? "-" : ""}${whole},${fraction}`;
}

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(issuedAt: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(issuedAt);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : issuedAt;
}

function safeFilePart(raw: string, fallback: string, maxLength: number): string {
  const safe = raw.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, maxLength);
  return safe || fallback;
}

function safeCents(raw: string | null): bigint | null {
  if (raw === null || !/^-?\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function savedDivergenceSummary(conference: MonthlyPackageConference | undefined): string {
  if (!conference) return "Sem conferência salva";
  if (!/^-?\d+$/.test(conference.totalExtraChargeCents)) {
    return "Conferência salva; valor total indisponível";
  }
  const savedTotal = BigInt(conference.totalExtraChargeCents);
  if (savedTotal <= 0n) return "Sem cobrança a mais";

  const details = conference.results.flatMap((result) => {
    if (result.kind !== "charge" && result.kind !== "not-in-order") return [];
    const itemTotal = safeCents(result.totalCents);
    if (itemTotal === null || itemTotal <= 0n) return [];
    const parts: string[] = [];
    const quantityPart = safeCents(result.quantityPartCents);
    const pricePart = safeCents(result.pricePartCents);
    if (quantityPart !== null) parts.push(`quantidade ${formatCents(quantityPart)}`);
    if (pricePart !== null) parts.push(`preço ${formatCents(pricePart)}`);
    const breakdown = parts.length ? ` (${parts.join("; ")})` : "";
    return [`${result.description}: ${formatCents(itemTotal)}${breakdown}`];
  });

  return details.length
    ? `Cobrado a mais: ${formatCents(savedTotal)}. Itens registrados: ${details.join(" | ")}`
    : `Cobrado a mais: ${formatCents(savedTotal)}. Detalhes por item indisponíveis.`;
}

function formatTaxAmounts(originalXml: string): {
  ibs: string;
  cbs: string;
  total: string;
} {
  try {
    const tax = extractInvoiceReformTax(originalXml);
    const ibs = BigInt(tax.ibsCents);
    const cbs = BigInt(tax.cbsCents);
    return {
      ibs: tax.ibsAmountPresent ? formatCents(ibs) : "Sem destaque no XML",
      cbs: tax.cbsAmountPresent ? formatCents(cbs) : "Sem destaque no XML",
      total: tax.ibsAmountPresent || tax.cbsAmountPresent
        ? formatCents(ibs + cbs) : "Sem destaque no XML",
    };
  } catch {
    return {
      ibs: "XML ilegível",
      cbs: "XML ilegível",
      total: "XML ilegível",
    };
  }
}

function monthlyCsv(
  month: string,
  invoices: MonthlyPackageInvoice[],
  conferences: Map<number, MonthlyPackageConference>,
): string {
  const rows: (string | number)[][] = [
    ["coNFere — Pacote mensal para o contador", month],
    ["Fornecedor", "Número da nota", "Data de emissão", "Valor da compra (R$)", "IBS destacado (R$)", "CBS destacado (R$)", "Total IBS/CBS (R$)", "Divergências encontradas"],
    ...invoices.map((row) => {
      const productTotalCents = row.invoice.items
        .reduce((sum, item) => sum + amountToCents(item.total), 0n);
      const tax = formatTaxAmounts(row.originalXml);
      return [
        row.issuer,
        row.invoiceNumber,
        formatDate(row.issuedAt),
        formatCents(productTotalCents),
        tax.ibs,
        tax.cbs,
        tax.total,
        savedDivergenceSummary(conferences.get(row.id)),
      ];
    }),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

function matchedConferences(
  invoices: MonthlyPackageInvoice[],
  conferences: MonthlyPackageConference[],
): Map<number, MonthlyPackageConference> {
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const byIdentity = new Map(invoices.map((invoice) => [invoice.identity, invoice]));
  const matched = new Map<number, MonthlyPackageConference>();
  for (const conference of conferences) {
    const invoice = (conference.invoiceId === null ? undefined : byId.get(conference.invoiceId))
      ?? byIdentity.get(conference.identity);
    if (invoice) matched.set(invoice.id, conference);
  }
  return matched;
}

export function generateMonthlyPackage(
  month: string,
  allInvoices: MonthlyPackageInvoice[],
  allConferences: MonthlyPackageConference[],
): GeneratedMonthlyPackage | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mês inválido.");
  const invoices = allInvoices
    .filter((row) => row.issuedAt.slice(0, 7) === month)
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt)
      || a.invoiceNumber.localeCompare(b.invoiceNumber, "pt-BR")
      || a.id - b.id);
  if (invoices.length === 0) return null;
  if (invoices.length > MAX_MONTHLY_PACKAGE_INVOICES) {
    throw new MonthlyPackageLimitError(
      `O mês tem mais de ${MAX_MONTHLY_PACKAGE_INVOICES} notas. Nenhum ZIP parcial foi criado; peça ajuda para exportar esse volume.`,
    );
  }
  const xmlBytes = invoices.reduce((sum, row) => sum + Buffer.byteLength(row.originalXml, "utf8"), 0);
  if (xmlBytes > MAX_MONTHLY_PACKAGE_XML_BYTES) {
    throw new MonthlyPackageLimitError(
      `Os XMLs deste mês ultrapassam o limite de ${MAX_MONTHLY_PACKAGE_XML_BYTES / (1024 * 1024)} MB. Nenhum ZIP parcial foi criado; peça ajuda para exportar esse volume.`,
    );
  }

  const conferences = matchedConferences(invoices, allConferences);
  const files: Record<string, Uint8Array> = {
    "resumo.csv": strToU8(monthlyCsv(month, invoices, conferences)),
  };
  for (const invoice of invoices) {
    const supplier = safeFilePart(invoice.issuer, "fornecedor", 36);
    const number = safeFilePart(invoice.invoiceNumber, "nota", 24);
    files[`xml/${supplier}-${number}-id${invoice.id}.xml`] = strToU8(invoice.originalXml);
  }
  return {
    filename: `confere-pacote-${month}.zip`,
    content: zipSync(files, { level: 6 }),
  };
}
