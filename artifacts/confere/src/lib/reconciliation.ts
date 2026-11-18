import type { NfeItem } from "@/lib/nfe";
import type { PedidoItem } from "@/lib/pedido-store";

interface Decimal {
  coefficient: bigint;
  scale: number;
}

export interface ItemCalculation {
  kind: "charge" | "favorable" | "ok" | "invalid" | "not-in-order";
  totalCents: bigint | null;
  quantityPartCents: bigint | null;
  pricePartCents: bigint | null;
}

const powerOfTen = (exponent: number) => 10n ** BigInt(exponent);

function parseDecimal(raw: string): Decimal | null {
  const value = raw.trim().replace(",", ".");
  if (value.length > 80) return null;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  const fraction = match[2] ?? "";
  return {
    coefficient: BigInt(`${match[1]}${fraction}`),
    scale: fraction.length,
  };
}

function align(left: Decimal, right: Decimal): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * powerOfTen(scale - left.scale),
    right.coefficient * powerOfTen(scale - right.scale),
    scale,
  ];
}

function subtract(left: Decimal, right: Decimal): Decimal {
  const [a, b, scale] = align(left, right);
  return { coefficient: a - b, scale };
}

function multiply(left: Decimal, right: Decimal): Decimal {
  return {
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  };
}

function add(left: Decimal, right: Decimal): Decimal {
  const [a, b, scale] = align(left, right);
  return { coefficient: a + b, scale };
}

/** Round an exact decimal half away from zero to Brazilian currency cents. */
function toCents(value: Decimal): bigint {
  if (value.scale <= 2) return value.coefficient * powerOfTen(2 - value.scale);
  const divisor = powerOfTen(value.scale - 2);
  const absolute = value.coefficient < 0n ? -value.coefficient : value.coefficient;
  const rounded = (absolute + divisor / 2n) / divisor;
  return value.coefficient < 0n ? -rounded : rounded;
}

function classify(cents: bigint): ItemCalculation["kind"] {
  return cents > 0n ? "charge" : cents < 0n ? "favorable" : "ok";
}

export function calculateItem(
  invoiceItem: NfeItem,
  selectedOrderItem: PedidoItem | null,
  receivedQuantity: string,
): ItemCalculation {
  if (!selectedOrderItem) {
    const total = parseDecimal(invoiceItem.total);
    if (!total) {
      return { kind: "invalid", totalCents: null, quantityPartCents: null, pricePartCents: null };
    }
    const totalCents = toCents(total);
    return {
      kind: "not-in-order",
      totalCents,
      quantityPartCents: null,
      pricePartCents: null,
    };
  }

  const invoicedQuantity = parseDecimal(invoiceItem.quantity);
  const received = parseDecimal(receivedQuantity);
  const invoiceUnitPrice = parseDecimal(invoiceItem.unitPrice);
  const agreedUnitPrice = parseDecimal(selectedOrderItem.precoUnitario);
  if (
    !invoicedQuantity ||
    !received ||
    !invoiceUnitPrice ||
    !agreedUnitPrice ||
    received.coefficient < 0n
  ) {
    return { kind: "invalid", totalCents: null, quantityPartCents: null, pricePartCents: null };
  }

  const quantityPart = multiply(subtract(invoicedQuantity, received), invoiceUnitPrice);
  const pricePart = multiply(subtract(invoiceUnitPrice, agreedUnitPrice), received);
  const exactTotal = add(quantityPart, pricePart);
  const totalCents = toCents(exactTotal);
  const quantityPartCents = toCents(quantityPart);
  // Keep the displayed parts additive even when separate cent rounding differs by one cent.
  const pricePartCents = totalCents - quantityPartCents;

  return {
    kind: classify(totalCents),
    totalCents,
    quantityPartCents,
    pricePartCents,
  };
}

export function sumChargeCents(calculations: ItemCalculation[]): bigint {
  return calculations.reduce(
    (sum, calculation) =>
      calculation.totalCents !== null && calculation.totalCents > 0n
        ? sum + calculation.totalCents
        : sum,
    0n,
  );
}

export function formatBRL(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const integer = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  const prefix = negative ? "− " : "";
  const amount = `${prefix}R$ ${integer},${fraction}`;
  return amount;
}

export function formatBRLDecimal(raw: string): string {
  const value = parseDecimal(raw);
  return value ? formatBRL(toCents(value)) : "R$ —";
}

export function formatDecimal(raw: string): string {
  const decimal = parseDecimal(raw);
  if (!decimal) return raw || "—";
  const negative = decimal.coefficient < 0n;
  const absolute = negative ? -decimal.coefficient : decimal.coefficient;
  const digits = absolute.toString().padStart(decimal.scale + 1, "0");
  const integerRaw = decimal.scale ? digits.slice(0, -decimal.scale) : digits;
  const fractionRaw = decimal.scale ? digits.slice(-decimal.scale).replace(/0+$/, "") : "";
  const integer = integerRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "−" : ""}${integer}${fractionRaw ? `,${fractionRaw}` : ""}`;
}
