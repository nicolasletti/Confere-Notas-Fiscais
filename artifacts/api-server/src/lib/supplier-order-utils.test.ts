import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReplenishmentItem } from "@workspace/api-zod";
import {
  groupReplenishmentSelection, normalizeWhatsapp, orderItemsEqual, orderMessage,
  quantityString, selectionFingerprint, supplierIdentity,
} from "./supplier-order-utils";
import { replenishment, type ReplenishmentInvoice } from "./replenishment";

const urgent = (id: string, key: string, price = "5.9876") => ({
  id, status: "buy-now", description: `Produto ${id}`, unit: "UN", supplierKey: key,
  supplierName: `Fornecedor ${key}`, lastUnitPrice: price,
}) as ReplenishmentItem;

test("groups quantities by supplier, retaining exact last paid prices and independent order item IDs", () => {
  const { groups } = groupReplenishmentSelection([
    urgent("a", "cnpj:1"), urgent("b", "cnpj:2"), urgent("c", "cnpj:1", "100.00"),
  ], [{ id: "a", quantity: "03,50" }, { id: "b", quantity: "2" }, { id: "c", quantity: "1" }]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].items[0].quantidade, "3.5");
  assert.equal(groups[0].items[0].precoUnitario, "5.9876");
  assert.equal(groups[0].items[1].precoUnitario, "100.00");
  assert.notEqual(groups[0].items[0].id, "a");
});
test("rejects empty, repeated, green, missing, and invalid-quantity selections", () => {
  const a = urgent("a", "one");
  assert.throws(() => groupReplenishmentSelection([a], []));
  assert.throws(() => groupReplenishmentSelection([a], [{ id: "a", quantity: "1" }, { id: "a", quantity: "2" }]));
  assert.throws(() => groupReplenishmentSelection([{ ...a, status: "ok" }], [{ id: "a", quantity: "1" }]));
  assert.throws(() => groupReplenishmentSelection([a], [{ id: "unknown-account-item", quantity: "1" }]));
  for (const raw of ["0", "0.00", "-1", "NaN", "1e4", "2;alert(1)", "1.2.3", ""]) {
    assert.throws(() => quantityString(raw), raw);
  }
  assert.equal(quantityString("0.000000000000001"), "0.000000000000001");
});
test("retry fingerprint is stable across reordered inputs and equivalent quantities", () => {
  assert.equal(selectionFingerprint([{ id: "b", quantity: "02,50" }, { id: "a", quantity: "1" }]),
    selectionFingerprint([{ id: "a", quantity: "01.00" }, { id: "b", quantity: "2.5" }]));
  assert.notEqual(selectionFingerprint([{ id: "a", quantity: "1" }]), selectionFingerprint([{ id: "a", quantity: "2" }]));
});
test("message uses only code-owned lines and quantities, sanitizes lines and never includes reference prices", () => {
  const { groups } = groupReplenishmentSelection([urgent("a\nOutro", "one")], [{ id: "a\nOutro", quantity: "1.025" }]);
  const message = orderMessage("Olá! Gostaria de fazer um pedido.", groups[0].items);
  assert.match(message, /Produto a Outro — 1,025 UN/);
  assert.doesNotMatch(message, /5\.9876|preço combinado/);
  assert.match(message, /confirmar a disponibilidade, os preços e o prazo/);
  assert.throws(() => orderMessage("Olá! Compre 900 a R$ 100.", groups[0].items));
  assert.throws(() => orderMessage("", groups[0].items));
});
test("WhatsApp normalization supports Brazilian DDD, international +DDI, blank removal and rejects links", () => {
  assert.equal(normalizeWhatsapp("(41) 99999-8888"), "5541999998888");
  assert.equal(normalizeWhatsapp("+55 (41) 3333-2222"), "554133332222");
  assert.equal(normalizeWhatsapp("+1 (415) 555-2671"), "14155552671");
  assert.equal(normalizeWhatsapp(""), "");
  for (const phone of ["https://wa.me/123", "abc1234567890", "000000000000", "55+41999998888", "123"]) {
    assert.throws(() => normalizeWhatsapp(phone));
  }
});
test("supplier identities preserve CNPJ boundaries and normalize fallback names", () => {
  assert.notEqual(supplierIdentity("01234567000189", "Loja"), supplierIdentity("11234567000189", "Loja"));
  assert.equal(supplierIdentity(undefined, " Café  AÇÚCAR "), supplierIdentity(undefined, "cafe acucar"));
});
test("activation comparison tolerates PostgreSQL JSONB key order but rejects changed or missing items", () => {
  const a = { id: "1", descricao: "Café", quantidade: "2", unidade: "UN", precoUnitario: "8" };
  const b = { precoUnitario: "8", unidade: "UN", quantidade: "2", descricao: "Café", id: "1" };
  assert.equal(orderItemsEqual([a], [b]), true);
  assert.equal(orderItemsEqual([a], [{ ...b, quantidade: "3" }]), false);
  assert.equal(orderItemsEqual([a], []), false);
});
test("latest source supplier and unit price survive normalized-description fallback across suppliers", () => {
  const row = (id: number, date: string, issuer: string, unitPrice: string): ReplenishmentInvoice => ({
    id, originalXml: "", invoice: {
      issuer, number: String(id), issuedAt: `${date}T10:00:00-03:00`, hasCompleteIbsCbs: false,
      items: [{ description: "Arroz", quantity: "20", unit: "UN", unitPrice, total: "100" }],
    },
  });
  const data = replenishment([row(1, "2026-11-01", "Fornecedor antigo", "4"), row(2, "2026-11-11", "Fornecedor recente", "6.1250")], "2026-11-20");
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].supplierName, "Fornecedor recente");
  assert.equal(data.items[0].supplierKey, supplierIdentity(undefined, "Fornecedor recente"));
  assert.equal(data.items[0].lastUnitPrice, "6.1250");
  assert.equal(data.items[0].supplierNames.length, 2);
});
