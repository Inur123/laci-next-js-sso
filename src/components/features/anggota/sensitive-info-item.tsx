import { Eye, EyeOff } from "lucide-react";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";

function SensitiveInfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5 p-5 bg-slate-50/30 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:bg-white">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-1">
        <div className="p-1 bg-white rounded border border-slate-100">
          {icon}
        </div>
        {label}
      </span>
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-slate-700 leading-relaxed font-mono">
          {value ? (show ? value : "••••••••••••••••") : "-"}
        </div>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-slate-400 hover:text-primary"
            onClick={() => setShow(!show)}
            title={show ? "Sembunyikan" : "Tampilkan"}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </Button>
        )}
      </div>
    </div>
  );
}

export { SensitiveInfoItem };
