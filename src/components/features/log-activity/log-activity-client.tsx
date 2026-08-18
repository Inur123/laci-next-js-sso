"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogActivityHeader } from "./log-activity-header";
import { LogActivityStats } from "./log-activity-stats";
import { LogActivityList } from "./log-activity-list";
import type { LogActivityData } from "./log-activity-list";
import { LogActivityMonitoring } from "./log-activity-monitoring";
import type { LogMonitoringProps } from "./log-activity-monitoring";

interface LogActivityClientProps {
  initialPersonalLogs: {
    data: LogActivityData[];
    totalPages: number;
    total: number;
  };
  initialGlobalLogs: {
    data: LogActivityData[];
    totalPages: number;
    total: number;
  };
  personalStats: Record<string, number> | null;
  globalStats: Record<string, number> | null;
  monitoringData: LogMonitoringProps["data"];
  userRole: string;
  pacUsers?: { id: string; name: string }[];
}

export function LogActivityClient({
  initialPersonalLogs,
  initialGlobalLogs,
  personalStats: initialPersonalStats,
  globalStats: initialGlobalStats,
  monitoringData: initialMonitoringData,
  userRole,
  pacUsers = [],
}: LogActivityClientProps) {
  const searchParams = useSearchParams();
  const userIdFilter = searchParams.get("userId") || "ALL";
  const [activeTab, setActiveTab] = useState<"personal" | "global">("personal");
  const [monitoringData, setMonitoringData] = useState(initialMonitoringData);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCabang = userRole === "SEKRETARIS_CABANG";

  // Sync with props
  useEffect(() => {
    setMonitoringData(initialMonitoringData);
  }, [initialMonitoringData]);

  // Override activeTab if not Cabang
  const currentTab = isCabang ? activeTab : "personal";

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };

      const isLogEvent =
        detail?.type === "log" ||
        (detail?.type === "mutation" && detail.model === "LogActivity");

      if (!isLogEvent) return;
      if (realtimeTimerRef.current) return;

      realtimeTimerRef.current = setTimeout(async () => {
        realtimeTimerRef.current = null;

        // Give extra time for server revalidation to settle
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Only fetch monitoring data as stats are handled internally by LogActivityStats
        if (isCabang) {
          const { getLogMonitoringData } =
            await import("@/app/actions/log-activity-actions");
          const mData = await getLogMonitoringData(userIdFilter);
          if (mData) setMonitoringData(mData);
        }
      }, 500);
    };

    window.addEventListener("laci-realtime", handler as EventListener);
    return () => {
      window.removeEventListener("laci-realtime", handler as EventListener);
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
      }
    };
  }, [isCabang, userIdFilter]);

  return (
    <div className="space-y-6 text-slate-900">
      <LogActivityHeader
        userRole={userRole}
        currentView={currentTab}
        onViewChange={(view: "personal" | "global") => setActiveTab(view)}
      />

      {currentTab === "personal" ? (
        <div
          key="personal-view"
          className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 space-y-6"
        >
          <LogActivityStats
            key="stats-personal"
            stats={initialPersonalStats}
            currentView="personal"
            userRole={userRole}
          />
          <LogActivityList
            key="list-personal"
            initialLogs={initialPersonalLogs.data}
            initialTotalPages={initialPersonalLogs.totalPages}
            initialCurrentPage={1}
            initialTotalItems={initialPersonalLogs.total}
            userRole={userRole}
            initialView="personal"
            pacUsers={pacUsers}
          />
        </div>
      ) : (
        <div
          key="global-view"
          className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 space-y-6"
        >
          <LogActivityStats
            key="stats-global"
            stats={initialGlobalStats}
            currentView="global"
            userRole={userRole}
          />
          <LogActivityMonitoring data={monitoringData} />
          <div className="pt-4 mt-8 border-t border-slate-100">
            <h3 className="text-lg font-bold mb-4 text-slate-800">
              Daftar Aktivitas Global
            </h3>
            <LogActivityList
              key="list-global"
              initialLogs={initialGlobalLogs.data}
              initialTotalPages={initialGlobalLogs.totalPages}
              initialCurrentPage={1}
              initialTotalItems={initialGlobalLogs.total}
              userRole={userRole}
              initialView="global"
              pacUsers={pacUsers}
            />
          </div>
        </div>
      )}
    </div>
  );
}
