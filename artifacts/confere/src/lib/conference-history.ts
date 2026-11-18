import { z } from "zod";

export const CONFERENCE_HISTORY_STORAGE_KEY = "confere-fornecedores-history-v1";

export interface ConferenceHistoryRecord {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  issuedAt: string;
  totalExtraChargeCents: string;
  hasCompleteIbsCbs: boolean;
  savedAt: string;
}

export type NewConferenceHistoryRecord = Omit<
  ConferenceHistoryRecord,
  "id" | "savedAt"
>;

const dateString = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const savedRecordSchema = z.object({
  id: z.string().min(1),
  supplierName: z.string().trim().min(1),
  invoiceNumber: z.string().trim().min(1),
  issuedAt: dateString,
  totalExtraChargeCents: z.string().regex(/^\d+$/),
  hasCompleteIbsCbs: z.boolean(),
  savedAt: dateString,
});
const savedRecordsSchema = z.array(savedRecordSchema);

export function normalizeSupplierName(name: string): string {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function conferenceIdentity(record: Pick<
  ConferenceHistoryRecord,
  "supplierName" | "invoiceNumber" | "issuedAt"
>): string {
  return JSON.stringify([
    normalizeSupplierName(record.supplierName),
    record.invoiceNumber.trim(),
    record.issuedAt,
  ]);
}

export function readConferenceHistory(): {
  records: ConferenceHistoryRecord[];
  warning: string | null;
} {
  try {
    const stored = window.localStorage.getItem(CONFERENCE_HISTORY_STORAGE_KEY);
    if (!stored) return { records: [], warning: null };

    const parsed: unknown = JSON.parse(stored);
    const result = savedRecordsSchema.safeParse(parsed);
    if (!result.success) {
      return {
        records: [],
        warning: "O histórico salvo não pôde ser reconhecido. Os dados existentes foram preservados.",
      };
    }
    return { records: result.data, warning: null };
  } catch {
    return {
      records: [],
      warning: "Não foi possível acessar o histórico local neste navegador.",
    };
  }
}

export function saveConferenceHistoryRecord(
  input: NewConferenceHistoryRecord,
):
  | { ok: true; updated: boolean }
  | { ok: false; message: string } {
  const current = readConferenceHistory();
  if (current.warning) {
    return { ok: false, message: current.warning };
  }

  const id = conferenceIdentity(input);
  const existing = current.records.some((record) => record.id === id);
  const record: ConferenceHistoryRecord = {
    ...input,
    id,
    savedAt: new Date().toISOString(),
  };
  const next = existing
    ? current.records.map((saved) => saved.id === id ? record : saved)
    : [...current.records, record];

  try {
    window.localStorage.setItem(CONFERENCE_HISTORY_STORAGE_KEY, JSON.stringify(next));
    return { ok: true, updated: existing };
  } catch {
    return {
      ok: false,
      message: "Não foi possível salvar no armazenamento local. Libere espaço e tente novamente.",
    };
  }
}
