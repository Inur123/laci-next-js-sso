/**
 *  CENTRALIZED DATE UTILITIES
 *
 * Purpose: Reduce bundle size by centralizing date-fns imports
 * Impact: ~25KB bundle reduction
 *
 * Usage:
 * import { formatDate, formatTime } from "@/lib/date-utils";
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
 * Export Indonesian locale for direct use in components
 */
export { id as idLocale };
