import { Router, type IRouter } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import { accountInvoicesTable, accountConferencesTable, db } from "@workspace/db";
import {
  GetWeeklyDashboardQueryParams, GetWeeklyDashboardResponse, GetWeeklyReportResponse,
} from "@workspace/api-zod";
import { validWeekStart, weekBounds, weeklyCsv, weeklyDashboard } from "../lib/weekly-dashboard";

const router: IRouter = Router();

router.get(["/account/dashboard/weekly", "/account/dashboard/weekly/report"], async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const parsed = GetWeeklyDashboardQueryParams.safeParse(req.query);
  if (!parsed.success || !validWeekStart(parsed.data.weekStart)) {
    res.status(400).json({ error: "Escolha uma segunda-feira válida no formato AAAA-MM-DD." });
    return;
  }
  const bounds = weekBounds(parsed.data.weekStart);
  // Bounded to these two weeks and the session owner, without loading original XML bytes.
  const [invoices, conferences] = await Promise.all([
    db.select({
      id: accountInvoicesTable.id, identity: accountInvoicesTable.identity,
      issuer: accountInvoicesTable.issuer, issuedAt: accountInvoicesTable.issuedAt,
      hasCompleteIbsCbs: accountInvoicesTable.hasCompleteIbsCbs, invoice: accountInvoicesTable.invoice,
    }).from(accountInvoicesTable).where(and(
      eq(accountInvoicesTable.userId, req.user.id),
      gte(accountInvoicesTable.issuedAt, bounds.previousWeekStart),
      lt(accountInvoicesTable.issuedAt, bounds.endExclusive),
    )),
    db.select({
      invoiceId: accountConferencesTable.invoiceId, identity: accountConferencesTable.identity,
      issuedAt: accountConferencesTable.issuedAt,
      totalExtraChargeCents: accountConferencesTable.totalExtraChargeCents,
      savedAt: accountConferencesTable.savedAt,
    }).from(accountConferencesTable).where(and(
      eq(accountConferencesTable.userId, req.user.id),
      gte(accountConferencesTable.issuedAt, bounds.previousWeekStart),
      lt(accountConferencesTable.issuedAt, bounds.endExclusive),
    )),
  ]);
  const data = GetWeeklyDashboardResponse.parse(
    weeklyDashboard(bounds.weekStart, invoices, conferences),
  );
  if (req.path.endsWith("/report")) {
    res.json(GetWeeklyReportResponse.parse({
      filename: `confere-relatorio-semana-${bounds.weekStart}.csv`, content: weeklyCsv(data),
    }));
  } else {
    res.json(data);
  }
});

export default router;
