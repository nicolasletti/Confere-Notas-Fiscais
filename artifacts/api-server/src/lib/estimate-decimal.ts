/** Rational decimal arithmetic: estimates never accumulate binary floating-point error. */
export interface Ratio { n: bigint; d: bigint }

function ratio(n: bigint, d: bigint): Ratio {
  if (d <= 0n) throw new Error("Divisor inválido na estimativa.");
  let a = n < 0n ? -n : n, b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
export function decimalRatio(raw: string): Ratio {
  if (!/^\d+(?:\.\d+)?$/.test(raw) || raw.length > 80) throw new Error("Quantidade inválida no histórico de compras.");
  const [whole, digits = ""] = raw.split(".");
  return ratio(BigInt(whole + digits), 10n ** BigInt(digits.length));
}
export function addRatio(a: Ratio, b: Ratio): Ratio {
  return ratio(a.n * b.d + b.n * a.d, a.d * b.d);
}
export function subtractRatio(a: Ratio, b: Ratio): Ratio {
  return ratio(a.n * b.d - b.n * a.d, a.d * b.d);
}
export function multiplyRatio(a: Ratio, b: Ratio): Ratio {
  return ratio(a.n * b.n, a.d * b.d);
}
export function divideRatio(a: Ratio, b: Ratio): Ratio {
  if (b.n <= 0n) throw new Error("Intervalo inválido na estimativa.");
  return ratio(a.n * b.d, a.d * b.n);
}
export function integerRatio(n: number): Ratio {
  return { n: BigInt(n), d: 1n };
}
export function ratioString(a: Ratio): string {
  if (a.n <= 0n) return "0";
  // Six decimal places for API/display only; status and formulas use the exact rational.
  let scaled = (a.n * 1_000_000n * 2n + a.d) / (a.d * 2n);
  if (scaled === 0n) scaled = 1n;
  const text = scaled.toString().padStart(7, "0");
  return `${text.slice(0, -6)}.${text.slice(-6)}`.replace(/\.?0+$/, "");
}
