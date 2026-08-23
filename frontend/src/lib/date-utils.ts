/**
 *  CENTRALIZED DATE UTILITIES
 *
 * Purpose: Reduce bundle size by centralizing date-fns imports
 * Impact: ~25KB bundle reduction
 *
 * Usage:
 * import { formatDate, formatDateTime, formatTime } from "@/lib/date-utils";
 */

import { format as formatFn } from "date-fns/format";
import { id } from "date-fns/locale/id";

/**
 * Format date to Indonesian locale
 * @param date - Date object or ISO string
 * @param formatStr - Format string (default: "dd MMMM yyyy")
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date()) // "31 Januari 2026"
 * formatDate("2026-01-31", "dd/MM/yyyy") // "31/01/2026"
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string = "dd MMMM yyyy",
): string {
  if (!date) return "-";

  try {
    return formatFn(new Date(date), formatStr, { locale: id });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "-";
  }
}

/**
 * Format date with time to Indonesian locale
 * @param date - Date object or ISO string
 * @returns Formatted datetime string
 *
 * @example
 * formatDateTime(new Date()) // "31 Jan 2026, 12:43"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, "dd MMM yyyy, HH:mm");
}

/**
 * Format time only
 * @param date - Date object or ISO string
 * @returns Formatted time string
 *
 * @example
 * formatTime(new Date()) // "12:43"
 */
export function formatTime(date: Date | string | null | undefined): string {
  return formatDate(date, "HH:mm");
}

/**
 * Format date for Excel export (Indonesian format)
 * @param date - Date object or ISO string
 * @returns Formatted date string for Excel
 *
 * @example
 * formatDateForExcel(new Date()) // "31/01/2026"
 */
export function formatDateForExcel(
  date: Date | string | null | undefined,
): string {
  return formatDate(date, "dd/MM/yyyy");
}

/**
 * Format date for form inputs (ISO format)
 * @param date - Date object or ISO string
 * @returns ISO date string
 *
 * @example
 * formatDateForInput(new Date()) // "2026-01-31"
 */
export function formatDateForInput(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";

  try {
    return formatFn(new Date(date), "yyyy-MM-dd");
  } catch (error) {
    console.error("Error formatting date for input:", error);
    return "";
  }
}

/**
 * Format relative date (e.g., "2 hari yang lalu")
 * Note: Requires additional date-fns import, use sparingly
 */
export function formatRelativeDate(
  date: Date | string | null | undefined,
): string {
  if (!date) return "-";

  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  if (diffDays < 7) return `${diffDays} hari yang lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu yang lalu`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} bulan yang lalu`;
  return `${Math.floor(diffDays / 365)} tahun yang lalu`;
}

/**
 * Export Indonesian locale for direct use in components
 */
export { id as idLocale };
