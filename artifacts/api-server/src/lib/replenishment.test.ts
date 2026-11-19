import assert from "node:assert/strict";
import { test } from "node:test";
import { replenishment, todaySaoPaulo, type ReplenishmentInvoice } from "./replenishment";
import { extractReplenishmentIdentity } from "./replenishment-identity";

const CNPJ = "01234567000189";
function invoice(id: number, date: string, quantity = "10", options: {
  code?: string; cnpj?: string; description?: string; unit?: string; legacy?: boolean; xml?: string;
} = {}): ReplenishmentInvoice {
  return {
    id, originalXml: options.xml ?? "",
    invoice: {
      issuer: "Fornecedor", number: String(id), issuedAt: `${date}T23:00:00-03:00`,
      ...(options.legacy ? {} : { issuerCnpj: options.cnpj ?? CNPJ }),
      hasCompleteIbsCbs: true,
      items: [{
        ...(options.legacy ? {} : { productCode: options.code ?? "001" }),
        description: options.description ?? "Leite integral", quantity, unit: options.unit ?? "UN",
        unitPrice: "5", total: "50",
      }],
    },
  };
}

test("specified average interval, quantity, daily consumption, stock and next purchase formulas", () => {
  const data = replenishment([
    invoice(1, "2026-11-01", "10"), invoice(2, "2026-11-11", "20"), invoice(3, "2026-11-21", "30"),
  ], "2026-11-25");
  const item = data.items[0];
  assert.equal(item.averageIntervalDays, "10");
  assert.equal(item.averageQuantity, "20");
  assert.equal(item.dailyConsumption, "2");
  assert.equal(item.lastPurchaseQuantity, "30");
  assert.equal(item.daysSinceLastPurchase, 4);
  assert.equal(item.estimatedStock, "22");
  assert.equal(item.nextPurchaseDate, "2026-12-01");
  assert.equal(item.status, "ok");
  assert.equal(item.purchasedThisMonth, "60");
  assert.equal(item.consumedThisMonth, "48");
});

test("red for overdue, due today or zero stock; yellow within three calendar days; green after", () => {
  const rows = [invoice(1, "2026-11-01"), invoice(2, "2026-11-11")];
  for (const [today, status] of [
    ["2026-11-17", "ok"], ["2026-11-18", "soon"], ["2026-11-20", "soon"],
    ["2026-11-21", "buy-now"], ["2026-11-25", "buy-now"],
  ]) assert.equal(replenishment(rows, today).items[0].status, status, today);
  assert.equal(replenishment(rows, "2026-11-25").items[0].estimatedStock, "0");
  const shrinking = [invoice(1, "2026-11-01", "100"), invoice(2, "2026-11-11", "1")];
  assert.equal(replenishment(shrinking, "2026-11-12").items[0].status, "buy-now");
});

test("same cProd plus supplier CNPJ matches changed descriptions, other codes/suppliers never merge", () => {
  const data = replenishment([
    invoice(1, "2026-11-01"), invoice(2, "2026-11-11", "10", { description: "LEITE UHT" }),
    invoice(3, "2026-11-11", "10", { code: "002" }),
    invoice(4, "2026-11-11", "10", { cnpj: "11234567000189" }),
  ], "2026-11-15");
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].purchaseCount, 2);
  assert.equal(data.items[0].description, "LEITE UHT");
  assert.equal(data.items[0].identification, "code-supplier");
  assert.equal(data.insufficientHistoryItems, 2);
});

test("normalized-description fallback works but units never mix", () => {
  const data = replenishment([
    invoice(1, "2026-11-01", "0.1", { legacy: true, description: " Café  integral " }),
    invoice(2, "2026-11-11", "0.2", { legacy: true, description: "CAFE INTEGRAL" }),
    invoice(3, "2026-11-11", "2", { legacy: true, description: "cafe integral", unit: "CX" }),
  ], "2026-11-12");
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].identification, "description");
  assert.equal(data.items[0].averageQuantity, "0.15");
  assert.equal(data.items[0].dailyConsumption, "0.015");
  assert.equal(data.items[0].estimatedStock, "0.185");
  assert.equal(data.insufficientHistoryItems, 1);
});

test("duplicate product lines in one XML are one purchase; same-day-only data needs history", () => {
  const a = invoice(1, "2026-11-01", "4");
  a.invoice.items.push({ ...a.invoice.items[0], quantity: "6" });
  const data = replenishment([a, invoice(2, "2026-11-11", "20")], "2026-11-11");
  assert.equal(data.items[0].purchaseCount, 2);
  assert.equal(data.items[0].averageQuantity, "15");
  const sameDay = replenishment([a, invoice(2, "2026-11-01")], "2026-11-11");
  assert.equal(sameDay.items.length, 0);
  assert.equal(sameDay.sameDayOnlyItems, 1);
});

test("fractional interval uses exact formulas and rounds the predicted calendar date up", () => {
  const data = replenishment([
    invoice(1, "2026-11-01"), invoice(2, "2026-11-04"), invoice(3, "2026-11-08"),
  ], "2026-11-08").items[0];
  assert.equal(data.averageIntervalDays, "3.5");
  assert.equal(data.nextPurchaseDate, "2026-11-12");
  assert.equal(data.status, "ok");
  assert.equal(data.estimatedStock, "10");
});

test("month purchased vs consumed uses elapsed month days, not whole-month projections", () => {
  const rows = [invoice(1, "2026-10-22"), invoice(2, "2026-11-01")];
  const item = replenishment(rows, "2026-11-05").items[0];
  assert.equal(item.purchasedThisMonth, "10");
  assert.equal(item.consumedThisMonth, "4");
  assert.equal(replenishment(rows, "2026-11-01").items[0].consumedThisMonth, "0");
  const lateStart = replenishment([
    invoice(1, "2026-11-05"), invoice(2, "2026-11-15"),
  ], "2026-11-17").items[0];
  assert.equal(lateStart.consumedThisMonth, "12");
});

test("future invoices excluded; date math handles leap years and year rollover", () => {
  const rows = [
    invoice(1, "2024-02-19"), invoice(2, "2024-02-29"), invoice(3, "2024-03-11", "9999"),
  ];
  const data = replenishment(rows, "2024-03-01");
  assert.equal(data.futureInvoices, 1);
  assert.equal(data.items[0].nextPurchaseDate, "2024-03-10");
  assert.equal(data.items[0].estimatedStock, "9");
  const year = replenishment([invoice(1, "2026-12-20"), invoice(2, "2026-12-30")], "2027-01-01");
  assert.equal(year.items[0].nextPurchaseDate, "2027-01-09");
  assert.equal(year.items[0].purchasedThisMonth, "0");
});

test("today is a São Paulo calendar date even just after UTC midnight", () => {
  assert.equal(todaySaoPaulo(new Date("2026-11-19T01:00:00Z")), "2026-11-18");
});

function xml(prefix = "") {
  const p = prefix ? `${prefix}:` : "";
  return `<${p}nfeProc xmlns${prefix ? `:${prefix}` : ""}="http://www.portalfiscal.inf.br/nfe"><${p}NFe><${p}infNFe><${p}emit><${p}CNPJ>${CNPJ}</${p}CNPJ></${p}emit><${p}det><${p}prod><${p}cProd>001</${p}cProd></${p}prod></${p}det></${p}infNFe></${p}NFe></${p}nfeProc>`;
}
test("recover historical XML identifiers with default and prefixed namespaces, preserving leading zeros", () => {
  for (const source of [xml(), xml("n")]) {
    assert.deepEqual(extractReplenishmentIdentity(source, 1), { issuerCnpj: CNPJ, productCodes: ["001"] });
    const data = replenishment([
      invoice(1, "2026-11-01", "10", { legacy: true, xml: source }),
      invoice(2, "2026-11-11"),
    ], "2026-11-12");
    assert.equal(data.items[0].purchaseCount, 2);
    assert.equal(data.unreadableIdentityInvoices, 0);
  }
});

test("malformed or unsafe XML never executes entities or misaligns item identities", () => {
  for (const source of ["<not-xml>", '<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a/>', xml()]) {
    assert.equal(extractReplenishmentIdentity(source, 2), null);
  }
  const data = replenishment([
    invoice(1, "2026-11-01", "10", { legacy: true }),
    invoice(2, "2026-11-11", "10", { legacy: true }),
  ], "2026-11-12");
  assert.equal(data.unreadableIdentityInvoices, 2);
  assert.equal(data.items[0].identification, "description");
});

test("results ordered by next purchase; zero and empty histories remain safe", () => {
  assert.equal(replenishment([], "2026-11-15").items.length, 0);
  const data = replenishment([
    invoice(1, "2026-11-01", "10", { code: "long" }), invoice(2, "2026-11-11", "10", { code: "long" }),
    invoice(3, "2026-11-08", "0", { code: "short" }), invoice(4, "2026-11-13", "0", { code: "short" }),
  ], "2026-11-15");
  assert.deepEqual(data.items.map((i) => i.nextPurchaseDate), ["2026-11-18", "2026-11-21"]);
  assert.equal(data.items[0].dailyConsumption, "0");
  assert.equal(data.items[0].status, "buy-now");
});
