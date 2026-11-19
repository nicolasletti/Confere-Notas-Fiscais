import type { WeeklyDashboard } from "@workspace/api-zod";
import {
  monthlyCsv, summarizeDateRange, type DashboardConference, type DashboardInvoice,
} from "./monthly-dashboard";

export function validWeekStart(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > "9998-12-31") return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

export function shiftCalendarDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekBounds(weekStart: string) {
  if (!validWeekStart(weekStart)) throw new Error("Escolha uma segunda-feira válida.");
  return {
    weekStart,
    weekEnd: shiftCalendarDate(weekStart, 6),
    previousWeekStart: shiftCalendarDate(weekStart, -7),
    previousWeekEnd: shiftCalendarDate(weekStart, -1),
    endExclusive: shiftCalendarDate(weekStart, 7),
  };
}

export function weeklyDashboard(
  weekStart: string, invoices: DashboardInvoice[], conferences: DashboardConference[],
): WeeklyDashboard {
  const bounds = weekBounds(weekStart);
  const current = summarizeDateRange(bounds.weekStart, bounds.endExclusive, invoices, conferences);
  const previous = summarizeDateRange(bounds.previousWeekStart, bounds.weekStart, invoices, conferences);
  return {
    weekStart: bounds.weekStart, weekEnd: bounds.weekEnd,
    previousWeekStart: bounds.previousWeekStart, previousWeekEnd: bounds.previousWeekEnd,
    current: current.metrics, previous: previous.metrics, suppliers: current.suppliers, items: current.items,
    unverifiedInvoiceCount: current.unverifiedInvoiceCount,
    excludedLegacyConferenceCount: current.excludedLegacyConferenceCount,
  };
}

export function weeklyCsv(data: WeeklyDashboard): string {
  return monthlyCsv({ ...data, month: data.weekStart, previousMonth: data.previousWeekStart }, {
    title: "coNFere — Relatório da semana",
    label: `${data.weekStart} a ${data.weekEnd}`,
    previousLabel: `${data.previousWeekStart} a ${data.previousWeekEnd}`,
    criterion: "Segunda a domingo pela data de emissão da nota; compras = soma dos valores dos produtos (vProd), sem frete e outros acréscimos.",
    sealLabel: "Reforma da última nota na semana",
  });
}
