import assert from "node:assert/strict";
import { test } from "node:test";
import {
  monthlyDashboard, monthlyCsv, previousMonth, validMonth,
  type DashboardConference, type DashboardInvoice,
} from "./monthly-dashboard";

function invoice(id: number, issuedAt: string, overrides: Partial<DashboardInvoice> = {}): DashboardInvoice {
  return {
    id, identity: `nf-${id}`, issuer: "Fornecedor A", issuedAt, hasCompleteIbsCbs: true,
    invoice: {
      issuer: "Fornecedor A", number: String(id), issuedAt, hasCompleteIbsCbs: true,
      items: [{ description: "Leite", quantity: "10", unit: "UN", unitPrice: "5.10", total: "51.00" }],
    },
    ...overrides,
  };
}

function conference(invoiceId: number | null, cents: string, overrides: Partial<DashboardConference> = {}): DashboardConference {
  return {
    invoiceId, identity: `nf-${invoiceId}`, issuedAt: "2026-11-10T12:00:00-03:00",
    totalExtraChargeCents: cents, savedAt: new Date("2026-11-11T12:00:00Z"),
    ...overrides,
  };
}

test("purchase totals, latest seal, saved divergences and previous-month comparison", () => {
  const result = monthlyDashboard("2026-11", [
    invoice(1, "2026-11-01T12:00:00-03:00"),
    invoice(2, "2026-11-15T12:00:00-03:00", { hasCompleteIbsCbs: false }),
    invoice(3, "2026-10-01T12:00:00-03:00"),
  ], [conference(1, "123"), conference(2, "-20"), conference(3, "50")]);
  assert.deepEqual(result.current, {
    purchasedCents: "10200", invoiceCount: 2, extraChargeCents: "123", divergentInvoiceCount: 1,
  });
  assert.equal(result.previous.purchasedCents, "5100");
  assert.equal(result.previous.extraChargeCents, "50");
  assert.equal(result.suppliers[0].hasCompleteIbsCbs, false);
  assert.equal(result.items[0].quantity, "20");
  assert.equal(result.items[0].averagePriceCents, "510");
});

test("month uses XML issue date, not UTC conversion, and counts unverified notes", () => {
  const result = monthlyDashboard("2026-11", [
    invoice(1, "2026-10-31T23:59:00-03:00"),
    invoice(2, "2026-11-30T23:59:00-03:00"),
    invoice(3, "2026-12-01T00:00:00-03:00"),
  ], []);
  assert.equal(result.current.invoiceCount, 1);
  assert.equal(result.previous.invoiceCount, 1);
  assert.equal(result.unverifiedInvoiceCount, 1);
  assert.equal(result.current.divergentInvoiceCount, 0);
});

test("weighted prices, decimal quantities, unit separation and exact cents", () => {
  const row = invoice(1, "2026-11-01");
  row.invoice.items = [
    { description: " Café ", unit: "kg", quantity: "0.1", unitPrice: "50", total: "5.00" },
    { description: "cafe", unit: "KG", quantity: "0.2", unitPrice: "65", total: "13.00" },
    { description: "Cafe", unit: "UN", quantity: "2", unitPrice: "10", total: "20.00" },
    { description: "Sem quantidade", unit: "UN", quantity: "0", unitPrice: "0", total: "0" },
    { description: "Decimal", unit: "UN", quantity: "0.1000", unitPrice: "0", total: "0.005" },
  ];
  const data = monthlyDashboard("2026-11", [row], []);
  const kg = data.items.find((item) => item.unit === "KG")!;
  assert.equal(kg.quantity, "0.3");
  assert.equal(kg.averagePriceCents, "6000");
  assert.equal(data.current.purchasedCents, "3801");
  assert.equal(data.items.length, 4);
  assert.equal(data.items.find((item) => item.description === "Sem quantidade")!.averagePriceCents, null);
  assert.equal(data.items.find((item) => item.description === "Decimal")!.quantity, "0.1");
});

test("keeps only latest saved reconciliation, never adds orphan legacy totals", () => {
  const result = monthlyDashboard("2026-11", [invoice(1, "2026-11-10")], [
    conference(1, "100"),
    conference(1, "200", { savedAt: new Date("2026-11-12") }),
    conference(null, "999999", { identity: "unknown" }),
  ]);
  assert.equal(result.current.extraChargeCents, "200");
  assert.equal(result.excludedLegacyConferenceCount, 1);
  assert.equal(result.current.divergentInvoiceCount, 1);
});

test("can match migrated summary to its original XML by identity without double counting", () => {
  const result = monthlyDashboard("2026-11", [invoice(1, "2026-11-10")], [
    conference(null, "123", { identity: "nf-1" }),
  ]);
  assert.equal(result.current.extraChargeCents, "123");
  assert.equal(result.unverifiedInvoiceCount, 0);
});

test("empty periods and January rollover are safe", () => {
  assert.equal(previousMonth("2026-01"), "2025-12");
  assert.equal(validMonth("2026-13"), false);
  assert.equal(validMonth("2026-1"), false);
  assert.equal(validMonth("0000-01"), false);
  assert.throws(() => monthlyDashboard("invalid", [], []));
  const empty = monthlyDashboard("2026-01", [], []);
  assert.equal(empty.current.purchasedCents, "0");
  assert.deepEqual(empty.suppliers, []);
});

test("CSV mirrors dashboard and escapes text/formula injection", () => {
  const row = invoice(1, "2026-11-10", { issuer: '=HYPERLINK("bad")' });
  row.invoice.items[0].description = 'Café; "Premium"\nEspecial';
  const data = monthlyDashboard("2026-11", [row], [conference(1, "123")]);
  const csv = monthlyCsv(data);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"51,00"'));
  assert.ok(csv.includes('"1,23"'));
  assert.ok(csv.includes("\"'=HYPERLINK(\"\"bad\"\")\""));
  assert.ok(csv.includes('"Café; ""Premium""\nEspecial"'));
  assert.ok(csv.includes("2026-10"));
});

test("large precise values never lose cents", () => {
  const row = invoice(1, "2026-11-10");
  row.invoice.items[0].total = "90071992547409.93";
  const data = monthlyDashboard("2026-11", [row], [conference(1, "9007199254740993")]);
  assert.equal(data.current.purchasedCents, "9007199254740993");
  assert.equal(data.current.extraChargeCents, "9007199254740993");
});
