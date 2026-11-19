import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { ReformTaxSummary } from "@workspace/api-zod";

export interface ReformTaxInvoice {
  issuer: string;
  issuedAt: string;
  originalXml: string;
}

type XmlNode = Record<string, unknown>;
type XmlPath = readonly string[];

const MAX_XML_BYTES = 10 * 1024 * 1024;
const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  processEntities: false,
});

function node(value: unknown): XmlNode | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as XmlNode : undefined;
}

function list(value: unknown): unknown[] {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPath(root: unknown, path: XmlPath): { present: boolean; value?: unknown } {
  let current: unknown = root;
  for (const part of path) {
    const currentNode = node(current);
    if (!currentNode || !Object.hasOwn(currentNode, part)) return { present: false };
    current = currentNode[part];
  }
  return { present: true, value: current };
}

function amountToCents(value: unknown): bigint {
  const raw = text(value);
  if (!raw || raw.length > 80 || !/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error("Invalid IBS/CBS amount in NF-e XML.");
  }
  const [whole, fraction = ""] = raw.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function firstAmount(root: unknown, paths: XmlPath[]): bigint | undefined {
  for (const path of paths) {
    const result = readPath(root, path);
    if (result.present) return amountToCents(result.value);
  }
  return undefined;
}

function addItemAmounts(
  details: unknown[],
  paths: XmlPath[],
): bigint {
  let sum = 0n;
  for (const detailValue of details) {
    const taxes = node(node(detailValue)?.imposto);
    for (const groupValue of list(taxes?.IBSCBS)) {
      const amount = firstAmount(groupValue, paths);
      if (amount !== undefined) sum += amount;
    }
  }
  return sum;
}

function hasCompleteItemTaxFields(details: unknown[]): boolean {
  return details.length > 0 && details.every((detailValue) => {
    const taxes = node(node(detailValue)?.imposto);
    return list(taxes?.IBSCBS).some((groupValue) => {
      const group = node(groupValue);
      return Boolean(text(group?.CST) && text(group?.cClassTrib));
    });
  });
}

function parseInvoice(xml: string): { ibsCents: bigint; cbsCents: bigint; complete: boolean } {
  if (!xml.trim() || Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error("Unreadable NF-e XML.");
  }
  const source = xml.replace(/^\uFEFF/, "");
  if (XMLValidator.validate(source) !== true) throw new Error("Malformed NF-e XML.");
  const parsed = node(parser.parse(source));
  const nfeProc = node(parsed?.nfeProc);
  const nfe = node(nfeProc?.NFe) ?? node(parsed?.NFe) ?? parsed;
  const info = node(nfe?.infNFe);
  if (!info) throw new Error("NF-e XML has no infNFe.");

  const details = list(info.det);
  const totals = node(info.total)?.IBSCBSTot;
  const totalIbs = firstAmount(totals, [["gIBS", "vIBS"], ["vIBS"]]);
  const totalCbs = firstAmount(totals, [["gCBS", "vCBS"], ["vCBS"]]);
  const ibsCents = totalIbs ?? addItemAmounts(details, [["gIBSCBS", "vIBS"], ["vIBS"]]);
  const cbsCents = totalCbs ?? addItemAmounts(details, [
    ["gIBSCBS", "gCBS", "vCBS"],
    ["gCBS", "vCBS"],
    ["vCBS"],
  ]);

  return {
    ibsCents,
    cbsCents,
    complete: hasCompleteItemTaxFields(details),
  };
}

function normalizeSupplier(name: string): string {
  return name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function monthlyReformTaxSummary(
  month: string,
  invoices: ReformTaxInvoice[],
): ReformTaxSummary {
  const periodInvoices = invoices.filter((invoice) => invoice.issuedAt.slice(0, 7) === month);
  let ibsCents = 0n;
  let cbsCents = 0n;
  let completeInvoiceCount = 0;
  let unreadableInvoiceCount = 0;
  const incompleteSuppliers = new Map<string, string>();

  for (const invoice of periodInvoices) {
    let parsed: ReturnType<typeof parseInvoice> | undefined;
    try {
      parsed = parseInvoice(invoice.originalXml);
      ibsCents += parsed.ibsCents;
      cbsCents += parsed.cbsCents;
    } catch {
      unreadableInvoiceCount++;
    }
    if (parsed?.complete) {
      completeInvoiceCount++;
    } else {
      const supplier = invoice.issuer.trim() || "Fornecedor não identificado";
      const supplierKey = normalizeSupplier(supplier);
      if (!incompleteSuppliers.has(supplierKey)) incompleteSuppliers.set(supplierKey, supplier);
    }
  }

  const invoiceCount = periodInvoices.length;
  const totalCents = ibsCents + cbsCents;
  return {
    ibsCents: ibsCents.toString(),
    cbsCents: cbsCents.toString(),
    totalCents: totalCents.toString(),
    invoiceCount,
    completeInvoiceCount,
    completePercentage: invoiceCount === 0
      ? null
      : Math.round((completeInvoiceCount * 1000) / invoiceCount) / 10,
    suppliersMissingFields: [...incompleteSuppliers.values()]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    unreadableInvoiceCount,
  };
}
