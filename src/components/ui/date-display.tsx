"use client";

import { Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import moment from "moment-hijri";

// Configure moment-hijri to use Indonesian locale for Hijri months
moment.locale("id");

// Custom Hijri month names in Indonesian spelling
const hijriMonthsIndonesian = [
  "Muharram",
  "Safar",
  "Rabiul Awal",
  "Rabiul Akhir",
  "Jumadil Awal",
  "Jumadil Akhir",
  "Rajab",
  "Sya'ban", // ← Ejaan Indonesia (bukan Sha'ban)
  "Ramadan",
  "Syawal",
  "Dzulqaidah",
  "Dzulhijjah",
];

interface DateDisplayProps {
  themeClass?: string;
}

export function DateDisplay({ themeClass = "theme-pac" }: DateDisplayProps) {
  const [dates, setDates] = useState({
    masehiShort: "",
    hijriShort: "",
  });
  const [mounted, setMounted] = useState(false);

  // Determine colors based on theme
  const isCabang = themeClass === "theme-cabang";
  const iconColor = isCabang ? "text-blue-600" : "text-green-600";
  const hijriColor = isCabang ? "text-blue-700" : "text-green-700";

  useEffect(() => {
    setMounted(true);

    const updateDates = () => {
      const now = new Date();

      // Format Masehi - Shorter version
      const dayName = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
      }).format(now);

      const dateStr = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(now);

      const masehiShort = `${dayName}, ${dateStr} M`;

      // Format Hijri - Custom Indonesian spelling
      const hijriDate = moment();
      const hijriDay = hijriDate.format("iDD");
      const hijriMonthIndex = parseInt(hijriDate.format("iM")) - 1; // 0-indexed
      const hijriYear = hijriDate.format("iYYYY");
      const hijriMonthName = hijriMonthsIndonesian[hijriMonthIndex];

      const hijriShort = `${hijriDay} ${hijriMonthName} ${hijriYear} H`;

      setDates({ masehiShort, hijriShort });
    };

    updateDates();

    // Update every minute to keep it fresh
    const interval = setInterval(updateDates, 60000);

    return () => clearInterval(interval);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="inline-flex items-center gap-1 rounded border border-slate-200/50 bg-slate-50/50 px-1.5 py-0.5 animate-pulse">
        <Calendar className="h-2.5 w-2.5 text-slate-400" />
        <div className="flex flex-col gap-0">
          <div className="h-1.5 w-16 bg-slate-200 rounded"></div>
          <div className="h-1.5 w-12 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 rounded border border-slate-200/50 bg-slate-50/50 px-1.5 py-0.5 hover:bg-slate-100/50 transition-colors">
      <Calendar className={`h-2.5 w-2.5 ${iconColor} flex-shrink-0`} />
      <div className="flex flex-col gap-0">
        <span className="text-[8px] font-semibold text-slate-700 leading-tight">
          {dates.masehiShort}
        </span>
        <span className={`text-[8px] font-medium ${hijriColor} leading-tight`}>
          {dates.hijriShort}
        </span>
      </div>
    </div>
  );
}
