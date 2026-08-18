"use client";

import Link from "next/link";
import { Home, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="text-center">
        {/* Error Title */}
        <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tight mb-4">
          ERROR
        </h1>

        {/* 500 with emoji style */}
        <div className="flex items-center justify-center gap-3 md:gap-6 mb-6">
          {/* 5 */}
          <div className="relative">
            <div className="text-6xl md:text-8xl font-black text-green-600 leading-none">
              5
            </div>
          </div>

          {/* 0 with sad face */}
          <div className="relative">
            <div className="text-6xl md:text-8xl font-black text-green-600 leading-none border-6 border-green-600 rounded-2xl px-3 md:px-6 py-1 md:py-3">
              <div className="flex flex-col items-center justify-center h-full">
                {/* Eyes */}
                <div className="flex gap-3 md:gap-5 mb-1 md:mb-2">
                  <div className="w-3 h-3 md:w-5 md:h-5 bg-green-600 rounded-sm"></div>
                  <div className="w-3 h-3 md:w-5 md:h-5 bg-green-600 rounded-sm"></div>
                </div>
                {/* Sad Mouth */}
                <div className="w-8 md:w-14 h-1.5 md:h-2.5 bg-green-600 rounded-full transform rotate-180"></div>
              </div>
            </div>
          </div>

          {/* 0 */}
          <div className="relative">
            <div className="text-6xl md:text-8xl font-black text-green-600 leading-none border-6 border-green-600 rounded-2xl px-3 md:px-6 py-1 md:py-3">
              <div className="flex flex-col items-center justify-center h-full">
                {/* Eyes */}
                <div className="flex gap-3 md:gap-5 mb-1 md:mb-2">
                  <div className="w-3 h-3 md:w-5 md:h-5 bg-green-600 rounded-sm"></div>
                  <div className="w-3 h-3 md:w-5 md:h-5 bg-green-600 rounded-sm"></div>
                </div>
                {/* Sad Mouth */}
                <div className="w-8 md:w-14 h-1.5 md:h-2.5 bg-green-600 rounded-full transform rotate-180"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        <p className="text-lg md:text-xl text-gray-700 font-medium mb-2 max-w-md mx-auto">
          Ups! Terjadi kesalahan
        </p>
        <p className="text-sm md:text-base text-gray-500 mb-6 max-w-md mx-auto">
          {error.message ||
            "Terjadi kesalahan yang tidak terduga. Silakan coba lagi."}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <RefreshCw size={18} />
            Coba Lagi
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-800 font-semibold rounded-xl border-2 border-gray-300 hover:border-green-600 hover:text-green-600 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Home size={18} />
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
