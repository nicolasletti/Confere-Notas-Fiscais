import { Router, type IRouter } from "express";
import { and, count, eq, gte, lt, sql } from "drizzle-orm";
import { accountInvoicesTable, accountConferencesTable, db } from "@workspace/db";
import {
  GetMonthlyDashboardQueryParams, GetMonthlyDashboardResponse, GetMonthlyPackageQueryParams,
  GetMonthlyReportResponse,
} from "@workspace/api-zod";
import { monthlyDashboard, monthlyCsv, previousMonth, validMonth } from "../lib/monthly-dashboard";
import { monthlyReformTaxSummary, type ReformTaxInvoice } from "../lib/monthly-reform-tax";
import {
  generateMonthlyPackage,
  MAX_MONTHLY_PACKAGE_INVOICES,
  MAX_MONTHLY_PACKAGE_XML_BYTES,
  MonthlyPackageLimitError,
} from "../lib/monthly-package";

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
  const isReport = req.path.endsWith("/report");
  const from = `${previousMonth(month)}-01`;
  const [year, number] = month.split("-").map(Number);
  const until = `${number === 12 ? year + 1 : year}-${String(number === 12 ? 1 : number + 1).padStart(2, "0")}-01`;
  // A bounded two-month query, no XML bytes or other users' data loaded.
  const reformInvoicesQuery = isReport
    ? Promise.resolve([] as ReformTaxInvoice[])
    : db.select({
        issuer: accountInvoicesTable.issuer,
        issuedAt: accountInvoicesTable.issuedAt,
        originalXml: accountInvoicesTable.originalXml,
      }).from(accountInvoicesTable).where(and(
        eq(accountInvoicesTable.userId, req.user.id),
        gte(accountInvoicesTable.issuedAt, `${month}-01`),
        lt(accountInvoicesTable.issuedAt, until),
      ));
  const [invoices, conferences, reformInvoices] = await Promise.all([
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
    reformInvoicesQuery,
  ]);
  const dashboard = monthlyDashboard(month, invoices, conferences);
  if (isReport) {
    res.json(GetMonthlyReportResponse.parse({
      filename: `confere-relatorio-${month}.csv`, content: monthlyCsv(dashboard),
    }));
    return;
  }
  const data = GetMonthlyDashboardResponse.parse({
    ...dashboard,
    reform: monthlyReformTaxSummary(month, reformInvoices),
  });
  res.json(data);
});

router.get("/account/dashboard/monthly-package", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const parsed = GetMonthlyPackageQueryParams.safeParse(req.query);
  if (!parsed.success || !validMonth(parsed.data.month)) {
    res.status(400).json({ error: "Escolha um mês válido no formato AAAA-MM." });
    return;
  }

  const month = parsed.data.month;
  const [year, number] = month.split("-").map(Number);
  const until = `${number === 12 ? year + 1 : year}-${String(number === 12 ? 1 : number + 1).padStart(2, "0")}-01`;
  const inSelectedMonth = and(
    eq(accountInvoicesTable.userId, req.user.id),
    gte(accountInvoicesTable.issuedAt, `${month}-01`),
    lt(accountInvoicesTable.issuedAt, until),
  );

  try {
    const [limits] = await db.select({
      invoiceCount: count(),
      xmlBytes: sql<number>`coalesce(sum(octet_length(${accountInvoicesTable.originalXml})), 0)`.mapWith(Number),
    }).from(accountInvoicesTable).where(inSelectedMonth);
    if (limits.invoiceCount === 0) {
      res.status(404).json({ error: "Não há notas fiscais neste mês para montar o pacote." });
      return;
    }
    if (limits.invoiceCount > MAX_MONTHLY_PACKAGE_INVOICES) {
      res.status(413).json({
        error: `O mês tem mais de ${MAX_MONTHLY_PACKAGE_INVOICES} notas. Nenhum ZIP parcial foi criado; peça ajuda para exportar esse volume.`,
      });
      return;
    }
    if (limits.xmlBytes > MAX_MONTHLY_PACKAGE_XML_BYTES) {
      res.status(413).json({
        error: `Os XMLs deste mês ultrapassam o limite de ${MAX_MONTHLY_PACKAGE_XML_BYTES / (1024 * 1024)} MB. Nenhum ZIP parcial foi criado; peça ajuda para exportar esse volume.`,
      });
      return;
    }

    const inSelectedConferenceMonth = and(
      eq(accountConferencesTable.userId, req.user.id),
      gte(accountConferencesTable.issuedAt, `${month}-01`),
      lt(accountConferencesTable.issuedAt, until),
    );
    const [invoices, conferences] = await Promise.all([
      db.select({
        id: accountInvoicesTable.id,
        identity: accountInvoicesTable.identity,
        issuer: accountInvoicesTable.issuer,
        invoiceNumber: accountInvoicesTable.invoiceNumber,
        issuedAt: accountInvoicesTable.issuedAt,
        invoice: accountInvoicesTable.invoice,
        originalXml: accountInvoicesTable.originalXml,
      }).from(accountInvoicesTable).where(inSelectedMonth).limit(MAX_MONTHLY_PACKAGE_INVOICES + 1),
      db.select({
        invoiceId: accountConferencesTable.invoiceId,
        identity: accountConferencesTable.identity,
        totalExtraChargeCents: accountConferencesTable.totalExtraChargeCents,
        results: accountConferencesTable.results,
      }).from(accountConferencesTable).where(inSelectedConferenceMonth),
    ]);
    const monthlyPackage = generateMonthlyPackage(month, invoices, conferences);
    if (!monthlyPackage) {
      res.status(404).json({ error: "Não há notas fiscais neste mês para montar o pacote." });
      return;
    }
    res.status(200)
      .set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${monthlyPackage.filename}"`,
        "Content-Length": String(monthlyPackage.content.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        Vary: "Cookie",
      })
      .send(Buffer.from(monthlyPackage.content));
  } catch (error) {
    if (error instanceof MonthlyPackageLimitError) {
      res.status(413).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Could not generate monthly accountant package");
    res.status(500).json({ error: "Não foi possível montar o pacote deste mês. Tente novamente." });
  }
});

export default router;
