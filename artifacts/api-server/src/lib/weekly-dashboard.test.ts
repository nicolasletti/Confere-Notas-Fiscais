import assert from "node:assert/strict";
import { test } from "node:test";
import { monthlyDashboard } from "./monthly-dashboard";
import type { DashboardConference, DashboardInvoice } from "./monthly-dashboard";
import { validWeekStart, weekBounds, weeklyCsv, weeklyDashboard } from "./weekly-dashboard";

function invoice(id: number, issuedAt: string, total = "15.50", quantity = "2.5"): DashboardInvoice {
  return {
    id, identity: `weekly-test-${id}`, issuer: "Fornecedor da semana", issuedAt,
    hasCompleteIbsCbs: id % 2 === 0,
    invoice: {
      issuer: "Fornecedor da semana", number: String(id), issuedAt, hasCompleteIbsCbs: id % 2 === 0,
      items: [{ description: "Arroz", unit: "KG", quantity, unitPrice: "6.20", total }],
    },
  };
}

function conference(id: number, issuedAt: string, total: string): DashboardConference {
  return {
    invoiceId: id, identity: `weekly-test-${id}`, issuedAt, totalExtraChargeCents: total,
    savedAt: new Date("2026-11-20T12:00:00Z"),
  };
}

test("weeks start Monday and end Sunday across month, year and leap boundaries", () => {
  assert.deepEqual(weekBounds("2025-12-29"), {
    weekStart: "2025-12-29", weekEnd: "2026-01-04", previousWeekStart: "2025-12-22",
    previousWeekEnd: "2025-12-28", endExclusive: "2026-01-05",
  });
  assert.equal(weekBounds("2024-02-26").weekEnd, "2024-03-03");
  assert.equal(weekBounds("2018-10-29").weekEnd, "2018-11-04");
});

test("reject invalid dates, missing leading zero, non-Mondays and unsafe ranges", () => {
  for (const date of ["", "invalid", "2026-02-30", "2026-11-17", "2026-11-22", "2026-11-1", "0000-01-01"]) {
    assert.equal(validWeekStart(date), false, date);
    assert.throws(() => weekBounds(date));
  }
  assert.equal(validWeekStart("2026-11-16"), true);
});

test("Monday and Sunday are included fully by XML date, adjacent weeks excluded", () => {
  const data = weeklyDashboard("2026-11-16", [
    invoice(1, "2026-11-15T23:59:59-03:00"),
    invoice(2, "2026-11-16T00:00:00+14:00"),
    invoice(3, "2026-11-22T23:59:59-03:00"),
    invoice(4, "2026-11-23T00:00:00-03:00"),
  ], []);
  assert.equal(data.current.invoiceCount, 2);
  assert.equal(data.current.purchasedCents, "3100");
  assert.equal(data.previous.invoiceCount, 1);
  assert.equal(data.items[0].quantity, "5");
  assert.equal(data.unverifiedInvoiceCount, 2);
});

test("previous week, saved positive divergences, favorable results and legacy summaries", () => {
  const data = weeklyDashboard("2026-11-16", [
    invoice(1, "2026-11-10"), invoice(2, "2026-11-16"), invoice(3, "2026-11-22"),
  ], [
    conference(1, "2026-11-10", "100"),
    conference(2, "2026-11-16", "350"),
    conference(3, "2026-11-22", "-50"),
    conference(999, "2026-11-18", "100000"),
  ]);
  assert.equal(data.previous.extraChargeCents, "100");
  assert.equal(data.current.extraChargeCents, "350");
  assert.equal(data.current.divergentInvoiceCount, 1);
  assert.equal(data.unverifiedInvoiceCount, 0);
  assert.equal(data.excludedLegacyConferenceCount, 1);
  assert.equal(data.suppliers[0].hasCompleteIbsCbs, false);
});

test("weekly arithmetic equals monthly arithmetic for identical invoice set", () => {
  const rows = [invoice(1, "2026-11-16", "0.10", "0.1"), invoice(2, "2026-11-22", "0.20", "0.2")];
  const conferences = [conference(1, "2026-11-16", "3")];
  const week = weeklyDashboard("2026-11-16", rows, conferences);
  const month = monthlyDashboard("2026-11", rows, conferences);
  assert.deepEqual(week.current, month.current);
  assert.deepEqual(week.items, month.items);
  assert.equal(week.items[0].quantity, "0.3");
  assert.equal(week.items[0].averagePriceCents, "100");
});

test("empty weeks retain zero-valued summaries and previous-week data", () => {
  const data = weeklyDashboard("2026-11-16", [invoice(1, "2026-11-10")], []);
  assert.equal(data.current.purchasedCents, "0");
  assert.equal(data.current.invoiceCount, 0);
  assert.equal(data.previous.purchasedCents, "1550");
  assert.deepEqual(data.items, []);
});

test("CSV uses monthly sections, exact figures, both week ranges and safe escaping", () => {
  const row = invoice(1, "2026-11-16");
  row.invoice.items[0].description = '=HYPERLINK("teste")';
  const csv = weeklyCsv(weeklyDashboard("2026-11-16", [row], [conference(1, "2026-11-16", "250")]));
  assert.ok(csv.startsWith("\uFEFF"));
  for (const text of [
    "coNFere — Relatório da semana", "2026-11-16 a 2026-11-22", "2026-11-09 a 2026-11-15",
    "Segunda a domingo", '"15,50"', '"2,50"', "Itens mais comprados", "Compras por fornecedor / Fornecedores",
    "\"'=HYPERLINK(\"\"teste\"\")\"",
  ]) assert.ok(csv.includes(text), text);
  assert.ok(!csv.includes("Relatório do mês"));
});
