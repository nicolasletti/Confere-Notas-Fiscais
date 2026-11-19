import {
  DeleteDemoDataResponse,
  GetDemoDataResponse,
  LoadDemoDataResponse,
} from "@workspace/api-zod";
import {
  accountConferencesTable,
  accountInvoicesTable,
  db,
} from "@workspace/db";
import { and, count, eq, inArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { lockAccountUser } from "../lib/account-lock";
import { createDemoDataset } from "../lib/demo-data";

const router: IRouter = Router();

class DemoDataConflictError extends Error {}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

router.get("/account/demo-data", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const userId = req.user.id;
  const [invoices, conferences] = await Promise.all([
    db.select({ value: count() }).from(accountInvoicesTable).where(
      and(eq(accountInvoicesTable.userId, userId), eq(accountInvoicesTable.isDemo, true)),
    ),
    db.select({ value: count() }).from(accountConferencesTable).where(
      and(eq(accountConferencesTable.userId, userId), eq(accountConferencesTable.isDemo, true)),
    ),
  ]);
  const invoiceCount = Number(invoices[0]?.value ?? 0);
  const conferenceCount = Number(conferences[0]?.value ?? 0);
  res.json(GetDemoDataResponse.parse({
    hasDemoData: invoiceCount > 0 || conferenceCount > 0,
    invoiceCount,
    conferenceCount,
  }));
});

router.post("/account/demo-data", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const userId = req.user.id;

  try {
    const dataset = createDemoDataset();
    const result = await db.transaction(async (tx) => {
      await lockAccountUser(tx, userId);

      const existingInvoices = await tx
        .select({ id: accountInvoicesTable.id })
        .from(accountInvoicesTable)
        .where(and(
          eq(accountInvoicesTable.userId, userId),
          eq(accountInvoicesTable.isDemo, true),
        ));
      if (existingInvoices.length > 0) {
        const [existingConferences] = await tx
          .select({ value: count() })
          .from(accountConferencesTable)
          .where(and(
            eq(accountConferencesTable.userId, userId),
            eq(accountConferencesTable.isDemo, true),
          ));
        return {
          created: false,
          invoiceCount: existingInvoices.length,
          conferenceCount: Number(existingConferences?.value ?? 0),
        };
      }

      const identities = dataset.map((row) => row.identity);
      const [invoiceConflict] = await tx
        .select({ isDemo: accountInvoicesTable.isDemo })
        .from(accountInvoicesTable)
        .where(and(
          eq(accountInvoicesTable.userId, userId),
          inArray(accountInvoicesTable.identity, identities),
        ))
        .limit(1);
      const [conferenceConflict] = await tx
        .select({ isDemo: accountConferencesTable.isDemo })
        .from(accountConferencesTable)
        .where(and(
          eq(accountConferencesTable.userId, userId),
          inArray(accountConferencesTable.identity, identities),
        ))
        .limit(1);
      if (invoiceConflict || conferenceConflict) {
        throw new DemoDataConflictError("A record already uses a demonstration identity.");
      }

      const savedInvoices = await tx
        .insert(accountInvoicesTable)
        .values(dataset.map((row) => ({
          userId,
          identity: row.identity,
          originalFileName: row.originalFileName,
          issuer: row.issuer,
          invoiceNumber: row.invoiceNumber,
          issuedAt: row.issuedAt,
          hasCompleteIbsCbs: row.hasCompleteIbsCbs,
          invoice: row.invoice,
          originalXml: row.originalXml,
          isDemo: true,
          createdAt: row.createdAt,
        })))
        .returning({ id: accountInvoicesTable.id, identity: accountInvoicesTable.identity });
      if (savedInvoices.length !== dataset.length) {
        throw new Error("Could not save every demonstration invoice.");
      }
      const invoiceIdByIdentity = new Map(
        savedInvoices.map((row) => [row.identity, row.id]),
      );

      const savedConferences = await tx
        .insert(accountConferencesTable)
        .values(dataset.map((row) => ({
          userId,
          invoiceId: invoiceIdByIdentity.get(row.identity)!,
          identity: row.conference.identity,
          supplierName: row.conference.supplierName,
          invoiceNumber: row.conference.invoiceNumber,
          issuedAt: row.conference.issuedAt,
          totalExtraChargeCents: row.conference.totalExtraChargeCents,
          hasCompleteIbsCbs: row.conference.hasCompleteIbsCbs,
          results: row.conference.results,
          isDemo: true,
          savedAt: row.conference.savedAt,
        })))
        .returning({ id: accountConferencesTable.id });
      if (savedConferences.length !== dataset.length) {
        throw new Error("Could not save every demonstration conference.");
      }

      return {
        created: true,
        invoiceCount: savedInvoices.length,
        conferenceCount: savedConferences.length,
      };
    });
    res.json(LoadDemoDataResponse.parse(result));
  } catch (error) {
    if (error instanceof DemoDataConflictError || isUniqueConstraintError(error)) {
      res.status(409).json({
        error: "Não foi possível carregar: há um registro real com a mesma identificação. Seus dados não foram alterados.",
      });
      return;
    }
    req.log.error({ err: error }, "Could not load demonstration data");
    res.status(500).json({ error: "Não foi possível carregar os dados de demonstração. Nenhum dado parcial foi salvo." });
  }
});

router.delete("/account/demo-data", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const userId = req.user.id;

  try {
    const result = await db.transaction(async (tx) => {
      await lockAccountUser(tx, userId);
      const demoInvoices = await tx
        .select({ id: accountInvoicesTable.id, identity: accountInvoicesTable.identity })
        .from(accountInvoicesTable)
        .where(and(
          eq(accountInvoicesTable.userId, userId),
          eq(accountInvoicesTable.isDemo, true),
        ));
      const linkedConferences = [
        eq(accountConferencesTable.isDemo, true),
        ...(demoInvoices.length
          ? [inArray(accountConferencesTable.invoiceId, demoInvoices.map((row) => row.id))]
          : []),
        ...(demoInvoices.length
          ? [inArray(accountConferencesTable.identity, demoInvoices.map((row) => row.identity))]
          : []),
      ];
      const deletedConferences = await tx
        .delete(accountConferencesTable)
        .where(and(
          eq(accountConferencesTable.userId, userId),
          or(...linkedConferences),
        ))
        .returning({ id: accountConferencesTable.id });
      const deletedInvoices = await tx
        .delete(accountInvoicesTable)
        .where(and(
          eq(accountInvoicesTable.userId, userId),
          eq(accountInvoicesTable.isDemo, true),
        ))
        .returning({ id: accountInvoicesTable.id });
      return {
        deletedInvoiceCount: deletedInvoices.length,
        deletedConferenceCount: deletedConferences.length,
        deletedInvoiceIds: deletedInvoices.map((row) => row.id),
      };
    });
    res.json(DeleteDemoDataResponse.parse(result));
  } catch (error) {
    req.log.error({ err: error }, "Could not delete demonstration data");
    res.status(500).json({ error: "Não foi possível apagar os dados de demonstração. Tente novamente." });
  }
});

export default router;
