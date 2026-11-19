import { XMLParser, XMLValidator } from "fast-xml-parser";

interface XmlNode { [key: string]: unknown }
function node(value: unknown): XmlNode | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as XmlNode : undefined;
}
function field(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Recover identifiers from historical original XML, without modifying saved financial data. */
export function extractReplenishmentIdentity(
  xml: string, expectedItems: number,
): { issuerCnpj?: string; productCodes: (string | undefined)[] } | null {
  if (!xml.trim() || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) return null;
  try {
    const parsed = node(new XMLParser({
      ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false,
      trimValues: true, processEntities: false,
    }).parse(xml));
    const nfe = node(node(parsed?.nfeProc)?.NFe) ?? node(parsed?.NFe);
    const info = node(nfe?.infNFe) ?? node(parsed?.infNFe);
    if (!info) return null;
    const details = Array.isArray(info.det) ? info.det : info.det ? [info.det] : [];
    if (details.length !== expectedItems) return null;
    const cnpj = field(node(info.emit)?.CNPJ);
    return {
      issuerCnpj: cnpj && /^\d{14}$/.test(cnpj) ? cnpj : undefined,
      productCodes: details.map((detail) => field(node(node(detail)?.prod)?.cProd)),
    };
  } catch {
    return null;
  }
}
