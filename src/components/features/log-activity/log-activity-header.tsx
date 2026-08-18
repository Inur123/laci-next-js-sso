"use client";

import { Activity, User as UserIcon } from "lucide-react";

interface LogActivityHeaderProps {
  userRole: string;
  currentView: string;
  onViewChange: (view: "personal" | "global") => void;
}

export function LogActivityHeader({
  userRole,
  currentView,
  onViewChange,
}: LogActivityHeaderProps) {
  const isCabang = userRole === "SEKRETARIS_CABANG";

  const handleViewChange = (view: "personal" | "global") => {
    onViewChange(view);
  };

  const getTabStyle = (tabName: string) => {
    const isActive = currentView === tabName;

    let style =
      "flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium w-full sm:w-auto min-w-[120px] cursor-pointer ";

    if (isActive) {
      style += isCabang
        ? "bg-blue-600 text-white shadow-sm"
        : "bg-green-600 text-white shadow-sm";
    } else {
      style += isCabang
        ? "text-slate-500 hover:text-blue-600 hover:bg-blue-50"
        : "text-slate-500 hover:text-green-600 hover:bg-green-50";
    }
    return style;
  };

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
          <Activity size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Riwayat Aktivitas
          </h2>
          <p className="text-sm text-slate-500">
            {currentView === "global"
              ? "Memantau seluruh aktivitas dari user PAC pada periode aktif"
              : "Catatan riwayat aktivitas personal Anda pada periode aktif"}
          </p>
        </div>
      </div>

      {isCabang && (
        <div className="grid grid-cols-2 bg-slate-50 p-1 rounded-lg border border-slate-100 w-full md:w-auto shadow-sm">
          <button
            onClick={() => handleViewChange("personal")}
            className={getTabStyle("personal")}
          >
            <UserIcon size={16} />
            <span>Personal</span>
          </button>
          <button
            onClick={() => handleViewChange("global")}
            className={getTabStyle("global")}
          >
            <Activity size={16} />
            <span>Global</span>
          </button>
        </div>
      )}
    </div>
  );
}
