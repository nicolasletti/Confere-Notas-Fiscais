import assert from "node:assert/strict";
import test from "node:test";
import { XMLParser } from "fast-xml-parser";
import { calculateItem, sumChargeCents } from "@workspace/reconciliation";
import { extractInvoiceReformTax } from "./monthly-reform-tax";
import { createDemoDataset } from "./demo-data";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

test("creates a repeatable 16-invoice history for three fictional suppliers", () => {
  const now = new Date("2026-11-19T12:00:00.000Z");
  const dataset = createDemoDataset(now);
  const duplicate = createDemoDataset(now);
  assert.deepEqual(dataset, duplicate);
  assert.equal(dataset.length, 16);

  const bySupplier = new Map<string, typeof dataset>();
  for (const invoice of dataset) {
    const rows = bySupplier.get(invoice.issuer) ?? [];
    rows.push(invoice);
    bySupplier.set(invoice.issuer, rows);
    assert.match(invoice.issuer, /^Demonstração · /);
    assert.match(invoice.originalFileName, /^DEMONSTRACAO_SEM_VALIDADE_NF-e_/);
    assert.equal(invoice.invoice.items.length >= 3 && invoice.invoice.items.length <= 6, true);
    assert.ok(invoice.originalXml.includes("DOCUMENTO FICTÍCIO"));
    assert.ok(invoice.originalXml.includes("SEM VALIDADE FISCAL"));
    assert.ok(invoice.originalXml.includes("não representam cálculo tributário"));

    const parsed = parser.parse(invoice.originalXml);
    const details = parsed.nfeProc.NFe.infNFe.det as unknown[];
    const parsedDetails = Array.isArray(details) ? details : [details];
    assert.equal(parsedDetails.length, invoice.invoice.items.length);
    for (const [index, detail] of parsedDetails.entries()) {
      const product = (detail as { prod: { cProd: string; xProd: string; qCom: string; uCom: string; vUnCom: string; vProd: string } }).prod;
      const expected = invoice.invoice.items[index]!;
      assert.equal(product.cProd, expected.productCode);
      assert.equal(product.xProd, expected.description);
      assert.equal(product.qCom, expected.quantity);
      assert.equal(product.uCom, expected.unit);
      assert.equal(product.vUnCom, expected.unitPrice);
      assert.equal(product.vProd, expected.total);
    }

    const calculatedTotal = sumChargeCents(invoice.conference.results.map((result) => ({
      kind: result.kind,
      totalCents: result.totalCents === null ? null : BigInt(result.totalCents),
      quantityPartCents: result.quantityPartCents === null ? null : BigInt(result.quantityPartCents),
      pricePartCents: result.pricePartCents === null ? null : BigInt(result.pricePartCents),
    })));
    assert.equal(invoice.conference.totalExtraChargeCents, calculatedTotal.toString());
    for (const result of invoice.conference.results) {
      if (result.kind === "not-in-order") {
        assert.equal(result.totalCents, invoice.invoice.items[result.invoiceItemIndex]!.total
          .replace(".", ""));
        assert.equal(result.quantityPartCents, null);
        assert.equal(result.pricePartCents, null);
      } else {
        assert.equal(
          BigInt(result.quantityPartCents!) + BigInt(result.pricePartCents!),
          BigInt(result.totalCents!),
        );
      }
    }

    const tax = extractInvoiceReformTax(invoice.originalXml);
    assert.equal(tax.complete, invoice.hasCompleteIbsCbs);
    assert.equal(tax.complete, invoice.conference.hasCompleteIbsCbs);
  }

  assert.equal(bySupplier.size, 3);
  assert.deepEqual([...bySupplier.values()].map((rows) => rows.length).sort(), [5, 5, 6]);
  const complete = dataset.filter((row) => row.hasCompleteIbsCbs);
  const incomplete = dataset.filter((row) => !row.hasCompleteIbsCbs);
  assert.equal(complete.length, 8);
  assert.equal(incomplete.length, 8);
  assert.equal(dataset.filter((row) => extractInvoiceReformTax(row.originalXml).ibsAmountPresent).length, 12);
  assert.ok(dataset.some((row) => row.invoice.items.some((item) => item.productCode === "ARROZ-5KG")));
  assert.ok(dataset.some((row) => row.invoice.items.some((item) => item.productCode === "REFRI-2L")));
});

test("uses 5–10 day replenishment intervals and shows a gradual milk price increase", () => {
  const dataset = createDemoDataset(new Date("2026-11-19T12:00:00.000Z"));
  const supplier = "Demonstração · Laticínios do Bairro";
  const milk = dataset
    .filter((row) => row.issuer === supplier)
    .map((row) => ({
      day: Date.parse(`${row.issuedAt.slice(0, 10)}T12:00:00Z`),
      price: BigInt(row.invoice.items.find((item) => item.productCode === "LEITE-1L")!.unitPrice.replace(".", "")),
      offset: Math.round((Date.parse("2026-11-19T12:00:00Z") - Date.parse(`${row.issuedAt.slice(0, 10)}T12:00:00Z`)) / 86_400_000),
    }))
    .sort((left, right) => left.day - right.day);
  assert.equal(milk.length, 6);
  for (let index = 1; index < milk.length; index++) {
    assert.equal((milk[index]!.day - milk[index - 1]!.day) / 86_400_000, 10);
    assert.ok(milk[index]!.price > milk[index - 1]!.price);
  }
  assert.ok(milk.every((purchase) => purchase.offset >= 0 && purchase.offset <= 59));
});

test("the shared reconciliation code produces positive, favorable, zero and not-in-order examples", () => {
  const dataset = createDemoDataset(new Date("2026-11-19T12:00:00.000Z"));
  const results = dataset.flatMap((row) => row.conference.results);
  assert.ok(results.some((result) => result.kind === "charge"));
  assert.ok(results.some((result) => result.kind === "favorable"));
  assert.ok(results.some((result) => result.kind === "ok"));
  assert.ok(results.some((result) => result.kind === "not-in-order"));

  const check = calculateItem(
    { description: "Arroz", quantity: "10", unit: "PCT", unitPrice: "25.50", total: "255.00" },
    { descricao: "Arroz tipo 1 5kg", precoUnitario: "25.25" },
    "9",
  );
  assert.equal(check.kind, "charge");
  assert.equal(check.totalCents, check.quantityPartCents! + check.pricePartCents!);
});
