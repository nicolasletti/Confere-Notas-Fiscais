import {
  GetAccountInvoiceXmlParams,
  GetAccountInvoiceXmlResponse,
  GetAccountOrderResponse,
  GetLatestAccountInvoiceResponse,
  ImportLegacyAccountDataBody,
  ImportLegacyAccountDataResponse,
  ListAccountConferencesResponse,
  ListAccountInvoicesResponse,
  type LegacyConferenceInput,
  SaveAccountConferenceBody,
  SaveAccountConferenceResponse,
  SaveAccountInvoiceBody,
  SaveAccountInvoiceResponse,
  SaveAccountOrderBody,
} from "@workspace/api-zod";
import {
  accountConferencesTable,
  accountInvoicesTable,
  accountOrdersTable,
  db,
  type StoredConferenceResult,
  type StoredInvoice,
  type StoredOrderItem,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { lockAccountUser } from "../lib/account-lock";
import { accountConferenceIdentity, accountInvoiceIdentity } from "../lib/account-identity";

const router: IRouter = Router();

function getUserId(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return null;
  }
  return req.user.id;
}

function invoiceRecord(row: typeof accountInvoicesTable.$inferSelect) {
  return {
    id: row.id,
    originalFileName: row.originalFileName,
    invoice: row.invoice,
    createdAt: row.createdAt.toISOString(),
  };
}

function conferenceRecord(row: typeof accountConferencesTable.$inferSelect) {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    supplierName: row.supplierName,
    invoiceNumber: row.invoiceNumber,
    issuedAt: row.issuedAt,
    totalExtraChargeCents: row.totalExtraChargeCents,
    hasCompleteIbsCbs: row.hasCompleteIbsCbs,
    results: row.results,
    savedAt: row.savedAt.toISOString(),
  };
}

async function saveLegacyConference(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  input: LegacyConferenceInput,
): Promise<boolean> {
  const [saved] = await tx
    .insert(accountConferencesTable)
    .values({
      userId,
      invoiceId: null,
      identity: accountConferenceIdentity(input),
      supplierName: input.supplierName,
      invoiceNumber: input.invoiceNumber,
      issuedAt: input.issuedAt,
      totalExtraChargeCents: input.totalExtraChargeCents,
      hasCompleteIbsCbs: input.hasCompleteIbsCbs,
      results: [],
      savedAt: new Date(input.savedAt),
    })
    .onConflictDoNothing({
      target: [accountConferencesTable.userId, accountConferencesTable.identity],
    })
    .returning({ id: accountConferencesTable.id });
  return Boolean(saved);
}

router.get("/account/order", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const [row] = await db
    .select({ items: accountOrdersTable.items })
    .from(accountOrdersTable)
    .where(eq(accountOrdersTable.userId, userId));
  res.json(GetAccountOrderResponse.parse({ items: row?.items ?? [] }));
});

router.put("/account/order", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const parsed = SaveAccountOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const items = parsed.data.items satisfies StoredOrderItem[];
  const [saved] = await db
    .insert(accountOrdersTable)
    .values({ userId, items })
    .onConflictDoUpdate({
      target: accountOrdersTable.userId,
      set: { items, updatedAt: new Date() },
    })
    .returning({ items: accountOrdersTable.items });
  res.json(GetAccountOrderResponse.parse({ items: saved?.items ?? [] }));
});

router.get("/account/invoices", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const rows = await db
    .select()
    .from(accountInvoicesTable)
    .where(eq(accountInvoicesTable.userId, userId))
    .orderBy(desc(accountInvoicesTable.createdAt));
  res.json(ListAccountInvoicesResponse.parse(rows.map(invoiceRecord)));
});

router.post("/account/invoices", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const parsed = SaveAccountInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (Buffer.byteLength(parsed.data.originalXml, "utf8") > 10 * 1024 * 1024) {
    res.status(413).json({ error: "O XML ultrapassa o limite de 10 MB." });
    return;
  }

  const invoice = parsed.data.invoice as StoredInvoice;
  const saved = await db.transaction(async (tx) => {
    await lockAccountUser(tx, userId);
    const [row] = await tx
      .insert(accountInvoicesTable)
      .values({
        userId,
        identity: accountInvoiceIdentity(invoice),
        originalFileName: parsed.data.originalFileName,
        issuer: invoice.issuer,
        invoiceNumber: invoice.number,
        issuedAt: invoice.issuedAt,
        hasCompleteIbsCbs: invoice.hasCompleteIbsCbs,
        invoice,
        originalXml: parsed.data.originalXml,
        isDemo: false,
      })
      .onConflictDoUpdate({
        target: [accountInvoicesTable.userId, accountInvoicesTable.identity],
        set: {
          originalFileName: parsed.data.originalFileName,
          issuer: invoice.issuer,
          invoiceNumber: invoice.number,
          issuedAt: invoice.issuedAt,
          hasCompleteIbsCbs: invoice.hasCompleteIbsCbs,
          invoice,
          originalXml: parsed.data.originalXml,
          isDemo: false,
          createdAt: new Date(),
        },
      })
      .returning();
    return row;
  });
  res.status(201).json(SaveAccountInvoiceResponse.parse(saved && invoiceRecord(saved)));
});

router.get("/account/invoices/latest", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const [row] = await db
    .select()
    .from(accountInvoicesTable)
    .where(eq(accountInvoicesTable.userId, userId))
    .orderBy(desc(accountInvoicesTable.createdAt))
    .limit(1);
  res.json(
    GetLatestAccountInvoiceResponse.parse({ invoice: row ? invoiceRecord(row) : null }),
  );
});

router.get("/account/invoices/:id/xml", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const params = GetAccountInvoiceXmlParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ originalXml: accountInvoicesTable.originalXml })
    .from(accountInvoicesTable)
    .where(
      and(
        eq(accountInvoicesTable.id, params.data.id),
        eq(accountInvoicesTable.userId, userId),
      ),
    );
  if (!row) {
    res.status(404).json({ error: "Nota fiscal não encontrada." });
    return;
  }
  res.json(GetAccountInvoiceXmlResponse.parse(row));
});

router.get("/account/conferences", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const rows = await db
    .select()
    .from(accountConferencesTable)
    .where(eq(accountConferencesTable.userId, userId))
    .orderBy(desc(accountConferencesTable.savedAt));
  res.json(ListAccountConferencesResponse.parse(rows.map(conferenceRecord)));
});

router.post("/account/conferences", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const parsed = SaveAccountConferenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  const identity = accountConferenceIdentity(input);
  const saved = await db.transaction(async (tx) => {
    await lockAccountUser(tx, userId);
    let isDemo = false;
    if (input.invoiceId !== null) {
      const [invoice] = await tx
        .select({ id: accountInvoicesTable.id, isDemo: accountInvoicesTable.isDemo })
        .from(accountInvoicesTable)
        .where(
          and(
            eq(accountInvoicesTable.id, input.invoiceId),
            eq(accountInvoicesTable.userId, userId),
          ),
        );
      if (!invoice) return null;
      isDemo = invoice.isDemo;
    } else {
      const [source] = await tx
        .select({ isDemo: accountInvoicesTable.isDemo })
        .from(accountInvoicesTable)
        .where(
          and(
            eq(accountInvoicesTable.userId, userId),
            eq(accountInvoicesTable.identity, identity),
          ),
        );
      isDemo = Boolean(source?.isDemo);
    }

    const [row] = await tx
      .insert(accountConferencesTable)
      .values({
        userId,
        invoiceId: input.invoiceId,
        identity,
        supplierName: input.supplierName,
        invoiceNumber: input.invoiceNumber,
        issuedAt: input.issuedAt,
        totalExtraChargeCents: input.totalExtraChargeCents,
        hasCompleteIbsCbs: input.hasCompleteIbsCbs,
        results: input.results as StoredConferenceResult[],
        isDemo,
        savedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [accountConferencesTable.userId, accountConferencesTable.identity],
        set: {
          invoiceId: input.invoiceId,
          supplierName: input.supplierName,
          invoiceNumber: input.invoiceNumber,
          issuedAt: input.issuedAt,
          totalExtraChargeCents: input.totalExtraChargeCents,
          hasCompleteIbsCbs: input.hasCompleteIbsCbs,
          results: input.results as StoredConferenceResult[],
          isDemo,
          savedAt: new Date(),
        },
      })
      .returning();
    return row;
  });
  if (!saved) {
    res.status(404).json({ error: "Nota fiscal não encontrada para esta conta." });
    return;
  }
  res.json(SaveAccountConferenceResponse.parse(saved && conferenceRecord(saved)));
});

router.post("/account/import-legacy", async (req, res): Promise<void> => {
  const userId = getUserId(req, res);
  if (!userId) return;
  const parsed = ImportLegacyAccountDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    await lockAccountUser(tx, userId);
    let importedOrderItems = 0;
    if (parsed.data.orderItems.length > 0) {
      const [current] = await tx
        .select({ items: accountOrdersTable.items })
        .from(accountOrdersTable)
        .where(eq(accountOrdersTable.userId, userId));
      const existingIds = new Set((current?.items ?? []).map((item) => item.id));
      const additions = parsed.data.orderItems.filter((item) => !existingIds.has(item.id));
      importedOrderItems = additions.length;
      const merged = [...(current?.items ?? []), ...additions] as StoredOrderItem[];
      await tx
        .insert(accountOrdersTable)
        .values({ userId, items: merged })
        .onConflictDoUpdate({
          target: accountOrdersTable.userId,
          set: { items: merged, updatedAt: new Date() },
        });
    }

    let importedConferences = 0;
    for (const conference of parsed.data.conferences) {
      if (await saveLegacyConference(tx, userId, conference)) importedConferences += 1;
    }
    return { importedOrderItems, importedConferences };
  });
  res.json(ImportLegacyAccountDataResponse.parse(result));
});

export default router;
