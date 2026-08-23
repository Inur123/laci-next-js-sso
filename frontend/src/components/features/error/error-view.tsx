"use client";

import Link from "next/link";
import { MoveLeft } from "lucide-react";

interface ErrorViewProps {
  code?: string | number;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  buttonText?: string;
  buttonHref?: string;
  buttonColor?: string;
  onReset?: () => void;
  resetText?: string;
  hideButton?: boolean;
  errorDigest?: string;
}

export function ErrorView({
  code,
  title,
  description,
  icon,
  iconBgColor = "bg-green-50",
  buttonText = "Kembali ke Beranda",
  buttonHref = "/dashboard",
  buttonColor = "bg-green-700 hover:bg-green-800 shadow-green-200",
  onReset,
  resetText = "Coba Lagi",
  errorDigest,
  hideButton = false,
}: ErrorViewProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon & Code */}
        <div className="flex flex-col items-center">
          <div className={`p-4 ${iconBgColor} rounded-2xl mb-4`}>{icon}</div>
          {code && (
            <h1 className="text-6xl font-black text-gray-900 leading-none">
              {code}
            </h1>
          )}
          <p className="text-xl font-semibold text-gray-800 mt-2">{title}</p>
        </div>

        {/* Message */}
        <p className="text-gray-600 leading-relaxed">{description}</p>

        {/* Error Code/Digest if available */}
        {errorDigest && (
          <div className="p-2 bg-slate-100 rounded-md inline-block">
            <code className="text-[10px] text-slate-500 uppercase tracking-widest">
              ID Error: {errorDigest}
            </code>
          </div>
        )}

        {/* Action Buttons */}
        {!hideButton && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 font-semibold">
            {onReset ? (
              <button
                onClick={onReset}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 ${buttonColor} text-white rounded-xl transition-all shadow-lg active:scale-95`}
              >
                {resetText}
              </button>
            ) : (
              <Link
                href={buttonHref}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 ${buttonColor} text-white rounded-xl transition-all shadow-lg active:scale-95`}
              >
                <MoveLeft size={18} />
                {buttonText}
              </Link>
            )}
          </div>
        )}

        {/* Brand Footer */}
        <div className="pt-12 text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Laci Digital - PC IPNU IPPNU MAGETAN
        </div>
      </div>
    </div>
  );
}
