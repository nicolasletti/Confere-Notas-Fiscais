import type { StoredConferenceResult, StoredInvoice } from "@workspace/db";
import { calculateItem, sumChargeCents } from "@workspace/reconciliation";
import { accountInvoiceIdentity } from "./account-identity";
import { extractInvoiceReformTax } from "./monthly-reform-tax";
import { todaySaoPaulo } from "./replenishment";

type ProductCode = "LEITE-1L" | "CAFE-500G" | "ACUCAR-1KG" | "OLEO-900ML" | "ARROZ-5KG" | "FARINHA-1KG" | "REFRI-2L";

interface ProductDefinition {
  code: ProductCode;
  description: string;
  orderDescription: string;
  unit: string;
  usualQuantity: number;
}

interface DemoSupplier {
  name: string;
  cnpj: string;
  offsets: number[];
  coreProducts: ProductCode[];
  optionalProducts: ProductCode[];
  pricesCents: Record<ProductCode, number>;
}

export interface DemoConferenceSeed {
  identity: string;
  supplierName: string;
  invoiceNumber: string;
  issuedAt: string;
  totalExtraChargeCents: string;
  hasCompleteIbsCbs: boolean;
  results: StoredConferenceResult[];
  savedAt: Date;
}

export interface DemoInvoiceSeed {
  identity: string;
  originalFileName: string;
  issuer: string;
  invoiceNumber: string;
  issuedAt: string;
  hasCompleteIbsCbs: boolean;
  invoice: StoredInvoice;
  originalXml: string;
  createdAt: Date;
  conference: DemoConferenceSeed;
}

const DAY_MS = 86_400_000;

const PRODUCTS: Record<ProductCode, ProductDefinition> = {
  "LEITE-1L": {
    code: "LEITE-1L",
    description: "Leite UHT integral 1L",
    orderDescription: "Leite integral 1L",
    unit: "CX",
    usualQuantity: 8,
  },
  "CAFE-500G": {
    code: "CAFE-500G",
    description: "Café torrado e moído 500g",
    orderDescription: "Café moído 500g",
    unit: "PCT",
    usualQuantity: 6,
  },
  "ACUCAR-1KG": {
    code: "ACUCAR-1KG",
    description: "Açúcar refinado 1kg",
    orderDescription: "Açúcar refinado 1kg",
    unit: "PCT",
    usualQuantity: 10,
  },
  "OLEO-900ML": {
    code: "OLEO-900ML",
    description: "Óleo de soja 900ml",
    orderDescription: "Óleo de soja 900ml",
    unit: "UN",
    usualQuantity: 8,
  },
  "ARROZ-5KG": {
    code: "ARROZ-5KG",
    description: "Arroz tipo 1 5kg",
    orderDescription: "Arroz tipo 1 5kg",
    unit: "PCT",
    usualQuantity: 5,
  },
  "FARINHA-1KG": {
    code: "FARINHA-1KG",
    description: "Farinha de trigo 1kg",
    orderDescription: "Farinha de trigo 1kg",
    unit: "PCT",
    usualQuantity: 7,
  },
  "REFRI-2L": {
    code: "REFRI-2L",
    description: "Refrigerante cola 2L",
    orderDescription: "Refrigerante 2L",
    unit: "UN",
    usualQuantity: 6,
  },
};

const SUPPLIERS: DemoSupplier[] = [
  {
    name: "Demonstração · Laticínios do Bairro",
    cnpj: "00000000000001",
    offsets: [59, 49, 39, 29, 19, 9],
    coreProducts: ["LEITE-1L", "CAFE-500G", "ACUCAR-1KG"],
    optionalProducts: ["OLEO-900ML", "ARROZ-5KG", "FARINHA-1KG"],
    pricesCents: {
      "LEITE-1L": 489,
      "CAFE-500G": 1290,
      "ACUCAR-1KG": 510,
      "OLEO-900ML": 699,
      "ARROZ-5KG": 2490,
      "FARINHA-1KG": 590,
      "REFRI-2L": 799,
    },
  },
  {
    name: "Demonstração · Armazém de Bairro",
    cnpj: "00000000000002",
    offsets: [57, 47, 37, 27, 17],
    coreProducts: ["ARROZ-5KG", "FARINHA-1KG", "REFRI-2L"],
    optionalProducts: ["CAFE-500G", "OLEO-900ML", "ACUCAR-1KG"],
    pricesCents: {
      "LEITE-1L": 499,
      "CAFE-500G": 1320,
      "ACUCAR-1KG": 525,
      "OLEO-900ML": 720,
      "ARROZ-5KG": 2550,
      "FARINHA-1KG": 620,
      "REFRI-2L": 830,
    },
  },
  {
    name: "Demonstração · Atacado da Praça",
    cnpj: "00000000000003",
    offsets: [55, 45, 35, 25, 15],
    coreProducts: ["ACUCAR-1KG", "LEITE-1L", "OLEO-900ML"],
    optionalProducts: ["ARROZ-5KG", "REFRI-2L", "CAFE-500G"],
    pricesCents: {
      "LEITE-1L": 505,
      "CAFE-500G": 1280,
      "ACUCAR-1KG": 495,
      "OLEO-900ML": 710,
      "ARROZ-5KG": 2520,
      "FARINHA-1KG": 605,
      "REFRI-2L": 840,
    },
  },
];

// These are static illustrative values in the fictional XML, not calculated tax rates.
const DEMO_TAX_AMOUNTS = [
  { ibs: "0.04", cbs: "0.09" },
  { ibs: "0.07", cbs: "0.13" },
  { ibs: "0.05", cbs: "0.11" },
  { ibs: "0.08", cbs: "0.15" },
] as const;

function centsToDecimal(cents: number | bigint): string {
  const value = typeof cents === "bigint" ? cents : BigInt(cents);
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

function decimalToCents(value: string): bigint {
  const match = /^(\d+)\.(\d{2})$/.exec(value);
  if (!match) throw new Error("A demonstração gerou um valor monetário inválido.");
  return BigInt(match[1]!) * 100n + BigInt(match[2]!);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dateForOffset(today: string, offset: number): string {
  const midnight = Date.parse(`${today}T12:00:00.000Z`);
  return new Date(midnight - offset * DAY_MS).toISOString().slice(0, 10);
}

function orderScenario(supplierIndex: number, noteIndex: number, itemIndex: number): number {
  if (noteIndex === 0) return 4;
  return (supplierIndex * 3 + noteIndex + itemIndex) % 6;
}

function taxMode(serial: number): "complete" | "partial" | "missing" {
  const remainder = serial % 4;
  return remainder === 0 || remainder === 3
    ? "complete"
    : remainder === 1
      ? "missing"
      : "partial";
}

function makeItemXml(
  item: StoredInvoice["items"][number],
  itemIndex: number,
  mode: "complete" | "partial" | "missing",
): string {
  let taxXml = "<imposto/>";
  if (mode !== "missing") {
    const amounts = DEMO_TAX_AMOUNTS[itemIndex % DEMO_TAX_AMOUNTS.length]!;
    const classTag = mode === "partial" && itemIndex === 0
      ? ""
      : "<cClassTrib>000001</cClassTrib>";
    taxXml = `<imposto><IBSCBS><CST>000</CST>${classTag}<gIBSCBS><vIBS>${amounts.ibs}</vIBS><gCBS><vCBS>${amounts.cbs}</vCBS></gCBS></gIBSCBS></IBSCBS></imposto>`;
  }
  return `<det nItem="${itemIndex + 1}"><prod><cProd>${xmlEscape(item.productCode ?? "")}</cProd><xProd>${xmlEscape(item.description)}</xProd><NCM>00000000</NCM><CFOP>5102</CFOP><uCom>${xmlEscape(item.unit)}</uCom><qCom>${xmlEscape(item.quantity)}</qCom><vUnCom>${xmlEscape(item.unitPrice)}</vUnCom><vProd>${xmlEscape(item.total)}</vProd></prod>${taxXml}</det>`;
}

function makeXml(
  invoice: StoredInvoice,
  mode: "complete" | "partial" | "missing",
): string {
  const serial = Number(invoice.number);
  const itemXml = invoice.items.map((item, index) => makeItemXml(item, index, mode)).join("");
  const productsTotalCents = invoice.items.reduce(
    (sum, item) => sum + decimalToCents(item.total),
    0n,
  );
  const productsTotal = centsToDecimal(productsTotalCents);
  const additionalInfo = [
    "DOCUMENTO FICTÍCIO PARA APRESENTAÇÃO DO coNFere.",
    "SEM VALIDADE FISCAL.",
    "Valores de IBS/CBS são exemplos estáticos e não representam cálculo tributário.",
  ].join(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00" demonstracao="true">
  <NFe>
    <infNFe versao="4.00" Id="NFeDEMO${serial}">
      <ide><cUF>99</cUF><natOp>DEMONSTRACAO_SEM_VALIDADE_FISCAL</natOp><mod>55</mod><serie>999</serie><nNF>${invoice.number}</nNF><dhEmi>${invoice.issuedAt}</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>9999999</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>0</cDV><tpAmb>2</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>9</indPres><procEmi>0</procEmi><verProc>coNFere-demo</verProc></ide>
      <emit><CNPJ>${invoice.issuerCnpj}</CNPJ><xNome>${xmlEscape(invoice.issuer)}</xNome></emit>
      ${itemXml}
      <total><ICMSTot><vProd>${productsTotal}</vProd><vNF>${productsTotal}</vNF></ICMSTot></total>
      <transp><modFrete>9</modFrete></transp>
      <infAdic><infCpl>${xmlEscape(additionalInfo)}</infCpl></infAdic>
    </infNFe>
  </NFe>
</nfeProc>`;
}

export function createDemoDataset(now = new Date()): DemoInvoiceSeed[] {
  const today = todaySaoPaulo(now);
  let serial = 0;
  const dataset: DemoInvoiceSeed[] = [];

  SUPPLIERS.forEach((supplier, supplierIndex) => {
    supplier.offsets.forEach((offset, noteIndex) => {
      const issuedDay = dateForOffset(today, offset);
      const invoiceNumber = String(990000000 + serial + 1);
      const issuedAt = `${issuedDay}T09:15:00-03:00`;
      const productKeys = [
        ...supplier.coreProducts,
        ...supplier.optionalProducts.slice(0, noteIndex % 4),
      ];
      const items = productKeys.map((code, itemIndex) => {
        const product = PRODUCTS[code];
        const trendCents = supplierIndex === 0 && code === "LEITE-1L"
          ? noteIndex * 15
          : 0;
        const unitPriceCents = supplier.pricesCents[code] + trendCents;
        const quantity = product.usualQuantity + ((supplierIndex + noteIndex + itemIndex) % 4);
        const totalCents = unitPriceCents * quantity;
        return {
          productCode: code,
          description: product.description,
          quantity: String(quantity),
          unit: product.unit,
          unitPrice: centsToDecimal(unitPriceCents),
          total: centsToDecimal(totalCents),
        };
      });
      const invoice: StoredInvoice = {
        issuerCnpj: supplier.cnpj,
        issuer: supplier.name,
        number: invoiceNumber,
        issuedAt,
        hasCompleteIbsCbs: false,
        items,
      };
      const mode = taxMode(serial);
      const originalXml = makeXml(invoice, mode);
      const reformTax = extractInvoiceReformTax(originalXml);
      invoice.hasCompleteIbsCbs = reformTax.complete;
      const identity = accountInvoiceIdentity(invoice);
      const results: StoredConferenceResult[] = invoice.items.map((item, itemIndex) => {
        const product = PRODUCTS[item.productCode as ProductCode];
        const scenario = orderScenario(supplierIndex, noteIndex, itemIndex);
        let agreedPriceCents = decimalToCents(item.unitPrice);
        let received = Number(item.quantity);
        if (scenario === 0) agreedPriceCents -= 25n;
        if (scenario === 1) {
          agreedPriceCents -= 12n;
          received -= 1;
        }
        if (scenario === 2) received -= 1;
        if (scenario === 3) agreedPriceCents += 15n;
        if (scenario === 5) received += 1;

        const isNotInOrder =
          supplierIndex === 2 && noteIndex === 3 && itemIndex === supplier.coreProducts.length;
        const orderItem = isNotInOrder
          ? null
          : { descricao: product.orderDescription, precoUnitario: centsToDecimal(agreedPriceCents) };
        const calculation = calculateItem(item, orderItem, String(received));
        if (calculation.kind === "invalid" || calculation.totalCents === null) {
          throw new Error("A demonstração gerou um valor inválido para a conferência.");
        }
        return {
          invoiceItemIndex: itemIndex,
          description: item.description,
          orderItemId: isNotInOrder ? null : `demo-order-${supplierIndex}-${product.code}`,
          matchedOrderDescription: isNotInOrder ? null : product.orderDescription,
          receivedQuantity: String(received),
          kind: calculation.kind,
          totalCents: calculation.totalCents.toString(),
          quantityPartCents: calculation.quantityPartCents?.toString() ?? null,
          pricePartCents: calculation.pricePartCents?.toString() ?? null,
        };
      });
      const totalExtraChargeCents = sumChargeCents(
        results.map((result) => ({
          kind: result.kind,
          totalCents: result.totalCents === null ? null : BigInt(result.totalCents),
          quantityPartCents: result.quantityPartCents === null ? null : BigInt(result.quantityPartCents),
          pricePartCents: result.pricePartCents === null ? null : BigInt(result.pricePartCents),
        })),
      );
      const savedAt = new Date(`${issuedDay}T17:30:00-03:00`);
      dataset.push({
        identity,
        originalFileName: `DEMONSTRACAO_SEM_VALIDADE_NF-e_${invoiceNumber}.xml`,
        issuer: supplier.name,
        invoiceNumber,
        issuedAt,
        hasCompleteIbsCbs: reformTax.complete,
        invoice,
        originalXml,
        createdAt: new Date(issuedAt),
        conference: {
          identity,
          supplierName: supplier.name,
          invoiceNumber,
          issuedAt,
          totalExtraChargeCents: totalExtraChargeCents.toString(),
          hasCompleteIbsCbs: reformTax.complete,
          results,
          savedAt,
        },
      });
      serial += 1;
    });
  });

  return dataset;
}
