const CNPJ_LENGTH = 14;

export function formatCnpj(value: string): string {
  const valueDigits = value.toLocaleUpperCase("pt-BR").replace(/[^A-Z0-9]/g, "").slice(0, CNPJ_LENGTH);
  const parts = [
    valueDigits.slice(0, 2),
    valueDigits.slice(2, 5),
    valueDigits.slice(5, 8),
    valueDigits.slice(8, 12),
    valueDigits.slice(12, 14),
  ].filter(Boolean);
  if (parts.length < 2) return parts.join("");
  return `${parts[0]}.${parts[1]}${parts[2] ? `.${parts[2]}` : ""}${parts[3] ? `/${parts[3]}` : ""}${parts[4] ? `-${parts[4]}` : ""}`;
}

export function isValidCnpj(value: string): boolean {
  const digits = value.toLocaleUpperCase("pt-BR").replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{12}\d{2}$/.test(digits) || /^([A-Z0-9])\1{13}$/.test(digits)) return false;

  const verifier = (base: string, weights: number[]): number => {
    // Receita Federal: character ASCII value minus 48 (A = 17, B = 18, ...).
    const sum = [...base].reduce((total, char, index) => total + (char.charCodeAt(0) - 48) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = verifier(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = verifier(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${first}${second}`);
}
