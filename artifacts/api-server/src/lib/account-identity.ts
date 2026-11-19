import type { StoredInvoice } from "@workspace/db";

function normalizeSupplierName(name: string): string {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function accountConferenceIdentity(record: {
  supplierName: string;
  invoiceNumber: string;
  issuedAt: string;
}): string {
  return JSON.stringify([
    normalizeSupplierName(record.supplierName),
    record.invoiceNumber.trim(),
    record.issuedAt,
  ]);
}

export function accountInvoiceIdentity(invoice: StoredInvoice): string {
  return accountConferenceIdentity({
    supplierName: invoice.issuer,
    invoiceNumber: invoice.number,
    issuedAt: invoice.issuedAt,
  });
}
