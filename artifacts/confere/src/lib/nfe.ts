export interface NfeItem {
  productCode?: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  total: string;
}

export interface NfeInvoice {
  issuerCnpj?: string;
  id?: number;
  issuer: string;
  number: string;
  issuedAt: string;
  hasCompleteIbsCbs: boolean;
  items: NfeItem[];
}

export interface ReadNfeFileResult {
  invoice: NfeInvoice;
  rawXml: string;
}

const NFE_NAMESPACE = "http://www.portalfiscal.inf.br/nfe";
const IBS_CBS_EXPLANATION =
  "A partir de 2027, notas sem esses campos podem trazer problemas de crédito de imposto para quem compra.";

/** Match local names, so both default and explicitly prefixed NF-e namespaces work. */
function children(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter(
    (element) =>
      element.localName === name &&
      element.namespaceURI === parent.namespaceURI,
  );
}

function requiredChild(parent: Element, name: string): Element {
  const matches = children(parent, name);
  if (matches.length !== 1) {
    throw new Error(`O XML não contém um campo ${name} único na estrutura da NF-e.`);
  }
  return matches[0]!;
}

function text(parent: Element, name: string): string {
  const value = requiredChild(parent, name).textContent?.trim();
  if (!value) {
    throw new Error(`O campo ${name} está vazio no XML da NF-e.`);
  }
  return value;
}

function decimal(parent: Element, name: string): string {
  const value = text(parent, name);
  if (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
    throw new Error(`O campo ${name} contém um número inválido no XML da NF-e.`);
  }
  // Keep the source decimal string: quantity and unit price can exceed two decimals.
  return value;
}

export function parseNfeXml(xml: string): NfeInvoice {
  if (!xml.trim()) {
    throw new Error("O arquivo está vazio. Selecione um XML de NF-e.");
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error("Este XML contém declarações não permitidas. Use o XML original da NF-e.");
  }
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (
    document.getElementsByTagName("parsererror").length ||
    document.getElementsByTagNameNS("*", "parsererror").length
  ) {
    throw new Error("Não foi possível ler o XML. O arquivo está inválido ou incompleto.");
  }
  const root = document.documentElement;
  if (
    !root ||
    !["nfeProc", "NFe", "infNFe"].includes(root.localName) ||
    (root.namespaceURI !== NFE_NAMESPACE && root.namespaceURI !== null)
  ) {
    throw new Error("Este arquivo não é um XML de NF-e. Selecione o arquivo enviado pelo fornecedor.");
  }
  const nfe = root.localName === "nfeProc" ? requiredChild(root, "NFe") : root;
  const info = nfe.localName === "infNFe" ? nfe : requiredChild(nfe, "infNFe");
  const issuer = text(requiredChild(info, "emit"), "xNome");
  const identification = requiredChild(info, "ide");
  const number = text(identification, "nNF");
  const issuedAt = text(identification, "dhEmi");
  const date = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(issuedAt);
  if (!date || Number.isNaN(Date.parse(issuedAt))) {
    throw new Error("A data de emissão (dhEmi) está inválida no XML da NF-e.");
  }
  const calendarDate = new Date(Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3])));
  if (calendarDate.toISOString().slice(0, 10) !== issuedAt.slice(0, 10)) {
    throw new Error("A data de emissão (dhEmi) está inválida no XML da NF-e.");
  }
  const details = children(info, "det");
  if (!details.length) {
    throw new Error("Esta NF-e não contém itens em det/prod.");
  }
  const items = details.map((detail): NfeItem => {
    const product = requiredChild(detail, "prod");
    return {
      ...(children(product, "cProd")[0]?.textContent?.trim()
        ? { productCode: children(product, "cProd")[0]!.textContent!.trim() } : {}),
      description: text(product, "xProd"),
      quantity: decimal(product, "qCom"),
      unit: text(product, "uCom"),
      unitPrice: decimal(product, "vUnCom"),
      total: decimal(product, "vProd"),
    };
  });
  const hasCompleteIbsCbs = details.every((detail) => {
    const taxes = children(detail, "imposto");
    return taxes.some((tax) =>
      children(tax, "IBSCBS").some((group) => {
        const cst = children(group, "CST").some((field) => Boolean(field.textContent?.trim()));
        const taxClass = children(group, "cClassTrib").some((field) => Boolean(field.textContent?.trim()));
        return cst && taxClass;
      }),
    );
  });

  const rawCnpj = children(requiredChild(info, "emit"), "CNPJ")[0]?.textContent?.trim();
  const issuerCnpj = rawCnpj && /^\d{14}$/.test(rawCnpj) ? rawCnpj : undefined;
  return { issuer, number, issuedAt, hasCompleteIbsCbs, items, ...(issuerCnpj ? { issuerCnpj } : {}) };
}

export async function readNfeFile(file: File): Promise<ReadNfeFileResult> {
  if (!/\.xml$/i.test(file.name)) {
    throw new Error("Formato não aceito. Selecione um arquivo .xml de NF-e.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("O arquivo ultrapassa 10 MB. Selecione um XML de NF-e de até 10 MB.");
  }
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new Error("Não foi possível abrir o arquivo. Selecione o XML novamente.");
  }
  const bytes = new Uint8Array(buffer);
  const header = new TextDecoder().decode(bytes.slice(0, 200));
  const encoding = /<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i.exec(header)?.[1] ?? "utf-8";
  let xml: string;
  try {
    xml = new TextDecoder(encoding, { fatal: true }).decode(buffer);
  } catch {
    throw new Error("Não foi possível ler a codificação do arquivo. Use o XML original da NF-e.");
  }
  return { invoice: parseNfeXml(xml), rawXml: xml };
}
