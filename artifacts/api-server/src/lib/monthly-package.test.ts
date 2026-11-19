import assert from "node:assert/strict";
import { test } from "node:test";
import { unzipSync } from "fflate";
import type { StoredConferenceResult, StoredInvoice } from "@workspace/db";
import {
  generateMonthlyPackage,
  MAX_MONTHLY_PACKAGE_INVOICES,
  MAX_MONTHLY_PACKAGE_XML_BYTES,
  MonthlyPackageLimitError,
  type MonthlyPackageConference,
  type MonthlyPackageInvoice,
} from "./monthly-package";

function taxXml(ibs?: string, cbs?: string): string {
  return `<NFe xmlns="urn:nfe"><infNFe><det><imposto><IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS>${ibs === undefined ? "" : `<vIBS>${ibs}</vIBS>`}<gCBS>${cbs === undefined ? "" : `<vCBS>${cbs}</vCBS>`}</gCBS></gIBSCBS></IBSCBS></imposto></det></infNFe></NFe>`;
}

function invoice(
  id: number,
  issuedAt: string,
  originalXml: string,
  overrides: Partial<MonthlyPackageInvoice> = {},
): MonthlyPackageInvoice {
  const invoiceData: StoredInvoice = {
    issuer: "Fornecedor",
    number: "42",
    issuedAt,
    hasCompleteIbsCbs: true,
    items: [{ description: "Arroz", quantity: "2", unit: "KG", unitPrice: "5.125", total: "10.25" }],
  };
  return {
    id,
    identity: `invoice-${id}`,
    issuer: "Fornecedor",
    invoiceNumber: "42",
    issuedAt,
    invoice: invoiceData,
    originalXml,
    ...overrides,
  };
}

function conference(
  invoiceId: number,
  totalExtraChargeCents: string,
  results: StoredConferenceResult[] = [],
): MonthlyPackageConference {
  return { invoiceId, identity: `invoice-${invoiceId}`, totalExtraChargeCents, results };
}

function packageFiles(content: Uint8Array) {
  const files = unzipSync(content);
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, decoder.decode(bytes)]));
}

test("ZIP preserves original XMLs, uses unique safe paths, and summarizes the selected month", () => {
  const originals = [
    `<?xml version="1.0" encoding="UTF-8"?>${taxXml("0.05", "0.10").replace("</infNFe>", "<obs>Nota &quot;um&quot;; café</obs></infNFe>")}`,
    "<NFe><infNFe>Sem IBS/CBS</infNFe></NFe>",
    "<NFe><infNFe>XML ilegível</infNFe>",
  ];
  const rows = [
    invoice(1, "2026-11-01T00:01:00-03:00", originals[0], {
      issuer: '=HYPERLINK("fornecedor")',
      invoiceNumber: "=../42;1",
      invoice: {
        issuer: "Fornecedor",
        number: "42",
        issuedAt: "2026-11-01T00:01:00-03:00",
        hasCompleteIbsCbs: true,
        items: [{ description: "Arroz; \"tipo especial\"", quantity: "2", unit: "KG", unitPrice: "5.125", total: "10.25" }],
      },
    }),
    invoice(2, "2026-11-15T12:00:00-03:00", originals[1]),
    invoice(3, "2026-11-30T23:59:59-03:00", originals[2], {
      invoiceNumber: "42",
      invoice: {
        issuer: "Fornecedor",
        number: "42",
        issuedAt: "2026-11-30T23:59:59-03:00",
        hasCompleteIbsCbs: false,
        items: [{ description: "Açúcar", quantity: "1", unit: "KG", unitPrice: "3.40", total: "3.40" }],
      },
    }),
    invoice(4, "2026-10-31T23:59:59-03:00", taxXml("99.00", "99.00")),
    invoice(5, "2026-12-01T00:00:00-03:00", taxXml("99.00", "99.00")),
  ];
  const results: StoredConferenceResult[] = [
    {
      invoiceItemIndex: 0,
      description: "Arroz; \"tipo especial\"",
      orderItemId: "1",
      matchedOrderDescription: "Arroz",
      receivedQuantity: "2",
      kind: "charge",
      totalCents: "300",
      quantityPartCents: "100",
      pricePartCents: "200",
    },
    {
      invoiceItemIndex: 1,
      description: "Leite",
      orderItemId: "2",
      matchedOrderDescription: "Leite",
      receivedQuantity: "1",
      kind: "favorable",
      totalCents: "-100",
      quantityPartCents: "-100",
      pricePartCents: "0",
    },
  ];
  const result = generateMonthlyPackage("2026-11", rows, [
    conference(1, "300", results),
    conference(3, "0"),
  ]);
  assert.ok(result);
  assert.equal(result.filename, "confere-pacote-2026-11.zip");

  const files = packageFiles(result.content);
  const xmlNames = Object.keys(files).filter((name) => name.endsWith(".xml"));
  assert.equal(xmlNames.length, 3);
  assert.equal(new Set(xmlNames).size, 3);
  assert.ok(xmlNames.every((name) => name.startsWith("xml/") && !name.includes("../")));
  assert.deepEqual(xmlNames.map((name) => files[name]), originals);

  const csv = files["resumo.csv"];
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Fornecedor";"Número da nota";"Data de emissão"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""fornecedor"")"'));
  assert.ok(csv.includes('"\'=../42;1"'));
  assert.ok(csv.includes('"01/11/2026"'));
  assert.ok(csv.includes('"R$ 10,25"'));
  assert.ok(csv.includes('"R$ 0,05";"R$ 0,10";"R$ 0,15"'));
  assert.ok(csv.includes('Cobrado a mais: R$ 3,00. Itens registrados: Arroz; ""tipo especial"": R$ 3,00 (quantidade R$ 1,00; preço R$ 2,00)'));
  assert.ok(csv.includes('"Sem conferência salva"'));
  assert.ok(csv.includes('"Sem cobrança a mais"'));
  assert.ok(csv.includes('"XML ilegível";"XML ilegível";"XML ilegível"'));
  assert.ok(!csv.includes("99,00"));
});

test("readable XML with no tax highlight is distinct from an unreadable XML", () => {
  const result = generateMonthlyPackage("2026-11", [
    invoice(1, "2026-11-05T12:00:00-03:00", "<NFe><infNFe><det><prod/></det></infNFe></NFe>"),
    invoice(2, "2026-11-06T12:00:00-03:00", "<NFe><infNFe>"),
  ], []);
  assert.ok(result);
  const csv = packageFiles(result.content)["resumo.csv"];
  assert.ok(csv.includes('"Sem destaque no XML";"Sem destaque no XML";"Sem destaque no XML"'));
  assert.ok(csv.includes('"XML ilegível";"XML ilegível";"XML ilegível"'));
});

test("empty month returns no package and explicit invoice and XML limits reject without truncating", () => {
  assert.equal(generateMonthlyPackage("2026-11", [
    invoice(1, "2026-10-31T23:59:59-03:00", taxXml()),
  ], []), null);

  const tooMany = Array.from({ length: MAX_MONTHLY_PACKAGE_INVOICES + 1 }, (_, index) =>
    invoice(index + 1, "2026-11-01T12:00:00-03:00", "<NFe/>"),
  );
  assert.throws(
    () => generateMonthlyPackage("2026-11", tooMany, []),
    MonthlyPackageLimitError,
  );

  assert.throws(
    () => generateMonthlyPackage("2026-11", [
      invoice(1, "2026-11-01T12:00:00-03:00", "x".repeat(MAX_MONTHLY_PACKAGE_XML_BYTES + 1)),
    ], []),
    MonthlyPackageLimitError,
  );
});
