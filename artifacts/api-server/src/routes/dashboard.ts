import { Router, type IRouter } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import { accountInvoicesTable, accountConferencesTable, db } from "@workspace/db";
import {
  GetMonthlyDashboardQueryParams, GetMonthlyDashboardResponse,
  GetMonthlyReportResponse,
} from "@workspace/api-zod";
import { monthlyDashboard, monthlyCsv, previousMonth, validMonth } from "../lib/monthly-dashboard";

const router: IRouter = Router();

router.get(["/account/dashboard", "/account/dashboard/report"], async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const parsed = GetMonthlyDashboardQueryParams.safeParse(req.query);
  if (!parsed.success || !validMonth(parsed.data.month)) {
    res.status(400).json({ error: "Escolha um mês válido no formato AAAA-MM." });
    return;
  }
  const month = parsed.data.month;
  const from = `${previousMonth(month)}-01`;
  const [year, number] = month.split("-").map(Number);
  const until = `${number === 12 ? year + 1 : year}-${String(number === 12 ? 1 : number + 1).padStart(2, "0")}-01`;
  // A bounded two-month query, no XML bytes or other users' data loaded.
  const [invoices, conferences] = await Promise.all([
    db.select({
      id: accountInvoicesTable.id, identity: accountInvoicesTable.identity,
      issuer: accountInvoicesTable.issuer, issuedAt: accountInvoicesTable.issuedAt,
      hasCompleteIbsCbs: accountInvoicesTable.hasCompleteIbsCbs, invoice: accountInvoicesTable.invoice,
    }).from(accountInvoicesTable).where(and(
      eq(accountInvoicesTable.userId, req.user.id),
      gte(accountInvoicesTable.issuedAt, from), lt(accountInvoicesTable.issuedAt, until),
    )),
    db.select({
      invoiceId: accountConferencesTable.invoiceId, identity: accountConferencesTable.identity,
      issuedAt: accountConferencesTable.issuedAt,
      totalExtraChargeCents: accountConferencesTable.totalExtraChargeCents,
      savedAt: accountConferencesTable.savedAt,
    }).from(accountConferencesTable).where(and(
      eq(accountConferencesTable.userId, req.user.id),
      gte(accountConferencesTable.issuedAt, from), lt(accountConferencesTable.issuedAt, until),
    )),
  ]);
  const data = GetMonthlyDashboardResponse.parse(monthlyDashboard(month, invoices, conferences));
  if (req.path.endsWith("/report")) {
    res.json(GetMonthlyReportResponse.parse({
      filename: `confere-relatorio-${month}.csv`, content: monthlyCsv(data),
    }));
  } else {
    res.json(data);
  }
});

export default router;
