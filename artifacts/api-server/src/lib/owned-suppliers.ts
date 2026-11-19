import { accountInvoicesTable, supplierContactsTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { extractReplenishmentIdentity } from "./replenishment-identity";
import { supplierIdentity } from "./supplier-order-utils";

export async function ownedPurchaseHistory(userId: string) {
  return db.select({
    id: accountInvoicesTable.id, invoice: accountInvoicesTable.invoice, originalXml: accountInvoicesTable.originalXml,
  }).from(accountInvoicesTable).where(eq(accountInvoicesTable.userId, userId));
}
export async function ownedSupplierContacts(userId: string) {
  const [invoices, contacts] = await Promise.all([
    ownedPurchaseHistory(userId),
    db.select().from(supplierContactsTable).where(eq(supplierContactsTable.userId, userId)),
  ]);
  const all = new Map(contacts.map((c) => [c.key, { key: c.key, name: c.name, whatsapp: c.whatsapp }]));
  for (const row of invoices.sort((a, b) => a.invoice.issuedAt.localeCompare(b.invoice.issuedAt))) {
    const cnpj = row.invoice.issuerCnpj ??
      extractReplenishmentIdentity(row.originalXml, row.invoice.items.length)?.issuerCnpj;
    const key = supplierIdentity(cnpj, row.invoice.issuer);
    all.set(key, { key, name: row.invoice.issuer, whatsapp: all.get(key)?.whatsapp ?? "" });
  }
  return [...all.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
