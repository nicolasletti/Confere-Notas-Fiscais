import assert from "node:assert/strict";
import { test } from "node:test";
import { companyTaxRegimeGuidance } from "@workspace/api-zod";
import { monthlyReformTaxSummary, type ReformTaxInvoice } from "./monthly-reform-tax";

type TaxItem = { ibs?: string; cbs?: string; cst?: string; taxClass?: string };
type TaxTotals = { ibs?: string; cbs?: string };

function nfeXml(
  items: TaxItem[],
  totals?: TaxTotals,
  prefix = "",
): string {
  const tag = (name: string, content: string) => `<${prefix}${name}>${content}</${prefix}${name}>`;
  const ns = prefix ? ` xmlns:n="urn:nfe"` : ` xmlns="urn:nfe"`;
  const details = items.map((item) => {
    const taxGroup = tag("IBSCBS",
      `${tag("CST", item.cst ?? "000")}${tag("cClassTrib", item.taxClass ?? "000001")}` +
      tag("gIBSCBS",
        `${item.ibs === undefined ? "" : tag("vIBS", item.ibs)}` +
        tag("gCBS", item.cbs === undefined ? "" : tag("vCBS", item.cbs)),
      ),
    );
    return tag("det", tag("imposto", taxGroup));
  }).join("");
  const totalXml = totals ? tag("total", tag("IBSCBSTot",
    `${totals.ibs === undefined ? "" : tag("gIBS", tag("vIBS", totals.ibs))}` +
    `${totals.cbs === undefined ? "" : tag("gCBS", tag("vCBS", totals.cbs))}`,
  )) : "";
  return `<${prefix}NFe${ns}>${tag("infNFe", `${details}${totalXml}`)}</${prefix}NFe>`;
}

function invoice(
  issuer: string,
  originalXml: string,
  issuedAt = "2026-11-15T12:00:00-03:00",
): ReformTaxInvoice {
  return { issuer, originalXml, issuedAt };
}

test("prefers totals and never counts the item values twice in a default namespace", () => {
  const summary = monthlyReformTaxSummary("2026-11", [
    invoice("Fornecedor A", nfeXml([
      { ibs: "1.23", cbs: "4.56" },
      { ibs: "2.00", cbs: "3.00" },
    ], { ibs: "8.00", cbs: "9.00" })),
  ]);

  assert.equal(summary.ibsCents, "800");
  assert.equal(summary.cbsCents, "900");
  assert.equal(summary.totalCents, "1700");
  assert.equal(summary.completePercentage, 100);
  assert.deepEqual(summary.suppliersMissingFields, []);
});

test("falls back to precise item amounts with prefixed namespaces and deduplicates suppliers", () => {
  const summary = monthlyReformTaxSummary("2026-11", [
    invoice("Fornecedor A", nfeXml([{ ibs: "0.01", cbs: "0.02" }], undefined, "n:")),
    invoice("Fornecedor Á", nfeXml([{ ibs: "0.02", cbs: "0.03", taxClass: "" }], undefined, "n:")),
    invoice("FORNECEDOR A", nfeXml([{ ibs: "0.03", cbs: "0.04", cst: "" }], undefined, "n:")),
  ]);

  assert.equal(summary.ibsCents, "6");
  assert.equal(summary.cbsCents, "9");
  assert.equal(summary.totalCents, "15");
  assert.equal(summary.invoiceCount, 3);
  assert.equal(summary.completeInvoiceCount, 1);
  assert.equal(summary.completePercentage, 33.3);
  assert.deepEqual(summary.suppliersMissingFields, ["Fornecedor Á"]);
});

test("treats explicit zero totals as present and does not replace them with item sums", () => {
  const summary = monthlyReformTaxSummary("2026-11", [
    invoice("Fornecedor A", nfeXml([{ ibs: "3.00", cbs: "4.00" }], { ibs: "0.00", cbs: "0.00" })),
  ]);

  assert.equal(summary.ibsCents, "0");
  assert.equal(summary.cbsCents, "0");
  assert.equal(summary.totalCents, "0");
});

test("missing fields and unreadable XML are incomplete; other months are excluded", () => {
  const summary = monthlyReformTaxSummary("2026-11", [
    invoice("Fornecedor A", nfeXml([{ ibs: "0.10", cbs: "0.20", taxClass: "" }])),
    invoice("Fornecedor A", "<NFe><infNFe>"),
    invoice("Fornecedor fora do mês", nfeXml([{ ibs: "99.00", cbs: "99.00" }]), "2026-10-31T23:59:00-03:00"),
  ]);

  assert.equal(summary.invoiceCount, 2);
  assert.equal(summary.completeInvoiceCount, 0);
  assert.equal(summary.completePercentage, 0);
  assert.equal(summary.unreadableInvoiceCount, 1);
  assert.deepEqual(summary.suppliersMissingFields, ["Fornecedor A"]);
  assert.equal(summary.ibsCents, "10");
  assert.equal(summary.cbsCents, "20");
});

test("malformed monetary fields are counted as unreadable, not silently rounded", () => {
  const summary = monthlyReformTaxSummary("2026-11", [
    invoice("Fornecedor B", nfeXml([{ ibs: "0.005", cbs: "0.10" }])),
  ]);

  assert.equal(summary.unreadableInvoiceCount, 1);
  assert.equal(summary.completeInvoiceCount, 0);
  assert.equal(summary.ibsCents, "0");
  assert.deepEqual(summary.suppliersMissingFields, ["Fornecedor B"]);
});

test("empty months have no percentage and all tax-regime messages stay explicit", () => {
  const summary = monthlyReformTaxSummary("2026-11", []);
  assert.equal(summary.totalCents, "0");
  assert.equal(summary.invoiceCount, 0);
  assert.equal(summary.completePercentage, null);

  assert.equal(companyTaxRegimeGuidance("lucro_presumido"),
    "Esse valor pode virar crédito de imposto. Confirme com seu contador.");
  assert.equal(companyTaxRegimeGuidance("lucro_real"),
    "Esse valor pode virar crédito de imposto. Confirme com seu contador.");
  assert.equal(companyTaxRegimeGuidance("simples_nacional"),
    "No Simples Nacional o aproveitamento de crédito é diferente. Fale com seu contador.");
  assert.equal(companyTaxRegimeGuidance("mei"),
    "No Simples Nacional o aproveitamento de crédito é diferente. Fale com seu contador.");
  assert.equal(companyTaxRegimeGuidance("nao_sei"),
    "Confirme com seu contador qual é o regime tributário da empresa antes de considerar possíveis créditos.");
  assert.equal(companyTaxRegimeGuidance(null),
    "Confirme com seu contador qual é o regime tributário da empresa antes de considerar possíveis créditos.");
});
