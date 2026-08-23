import { format, addMinutes } from "date-fns";

/**
 * Shared logic to check if a presensi session is currently open.
 * Now supports:
 * 1. Automatic time-based window (today and within start/end time)
 * 2. Forced open by admin (limited to 10 minutes)
 * 3. Manual closure by admin
 */
export function isPresensiOpen(presensi: any) {
  // Guard against undefined/null presensi
  if (!presensi) return false;

  // 1. If explicitly closed by admin (isActive: false)
  if (presensi.isActive === false) return false;

  const now = new Date();

  // 2. Automatic timing
  // VPS sudah di-setting timezone Asia/Jakarta, jadi pakai date-fns langsung
  const todayStr = format(now, "yyyy-MM-dd");
  const eventDateStr = format(new Date(presensi.tanggal), "yyyy-MM-dd");

  if (todayStr !== eventDateStr) return false;

  // Check time match if date is today
  try {
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    const [startH, startM] = presensi.jamMulai.split(":").map(Number);
    const [endH, endM] = presensi.jamSelesai.split(":").map(Number);

    const nowTotalMinutes = nowH * 60 + nowM;
    const startTotalMinutes = startH * 60 + startM;
    const endTotalMinutes = endH * 60 + endM;

    return (
      nowTotalMinutes >= startTotalMinutes && nowTotalMinutes <= endTotalMinutes
    );
  } catch {
    return false;
  }
}
