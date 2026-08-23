"use client";

import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, Clock, QrCode, Users, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { isPresensiOpen } from "@/lib/presensi-utils";
import { useState } from "react";

interface PresensiFullscreenPresentationProps {
  presensi: any;
  dataPresensi: any[];
  publicUrl: string;
  currentTime: string;
  isRefreshing: boolean;
  userRole?: string;
  closeFullscreen: () => void;
  fullscreenOverlayRef: React.RefObject<HTMLDivElement | null>;
}

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export function PresensiFullscreenPresentation({
  presensi,
  dataPresensi,
  publicUrl,
  currentTime,
  userRole = "SEKRETARIS_PAC",
  closeFullscreen,
  fullscreenOverlayRef,
}: PresensiFullscreenPresentationProps) {
  const fullscreenListRef = useRef<HTMLDivElement>(null);

  // Auto-tick to update automatic status in real-time
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const isOpen = isPresensiOpen(presensi);

  return (
    <div
      ref={fullscreenOverlayRef}
      className="fixed inset-0 z-50 bg-white flex flex-col"
    >
      {/* Top Bar */}
      <div
        className={`flex items-center justify-between px-6 py-3 border-b bg-white border-slate-200`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/images/logo-laci.webp"
            alt="Laci"
            width={32}
            height={32}
            className="rounded-md object-contain shrink-0"
          />
          <div className="min-w-0">
            <p className="text-slate-800 font-bold text-lg leading-tight truncate">
              {capitalizeName(presensi.namaKegiatan)}
            </p>
            <p className="text-slate-500 text-xs truncate">
              {capitalizeName(presensi.penyelenggara)} &middot;{" "}
              {capitalizeName(presensi.tempat)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {/* Live clock */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 ${
              userRole === "SEKRETARIS_CABANG"
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-green-50 border-green-200 text-green-600"
            }`}
          >
            <Clock
              className={`w-4 h-4 ${
                userRole === "SEKRETARIS_CABANG"
                  ? "text-blue-600"
                  : "text-green-600"
              }`}
            />
            <span className="font-mono font-black text-xl tracking-tighter">
              {currentTime}
            </span>
          </div>
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full"
            onClick={closeFullscreen}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden bg-slate-50/50">
        {/* Left — QR + Info */}
        <div className="flex flex-col items-center justify-start gap-4 px-6 py-6 w-[380px] shrink-0 border-r border-slate-200 bg-white shadow-xl z-10">
          {/* Status badge */}
          <div
            className={`text-[10px] font-bold px-3 py-1 rounded-full border-2 transition-all duration-500 ${
              isOpen
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-600 border-red-200"
            }`}
          >
            {isOpen ? "● Berlangsung" : "● Ditutup"}
          </div>

          {/* QR Code — Sangat Tipis & Compact */}
          <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-sm relative group transition-transform hover:scale-[1.02] duration-300 flex items-center justify-center">
            <QRCodeSVG
              value={publicUrl}
              size={320}
              level="H"
              includeMargin={false}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-lg p-1.5 shadow-lg border border-slate-50">
                <img
                  src="/images/logo-laci.webp"
                  alt="Laci"
                  width={52}
                  height={52}
                  className="rounded-md object-contain block"
                />
              </div>
            </div>
          </div>

          <div className="text-center space-y-0.5">
            <h3 className="text-slate-800 font-bold text-sm">
              Scan QR untuk Absensi
            </h3>
            <p className="text-slate-500 text-[10px] max-w-[220px]">
              Buka aplikasi scanner atau kamera di HP Anda.
            </p>
          </div>

          <div className="w-full h-px bg-slate-100" />

          {/* Info kegiatan — Lebih Rapat */}
          <div className="w-full space-y-2 text-slate-600 font-medium">
            <div className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-[13px]">
                {format(new Date(presensi.tanggal), "EEEE, dd MMMM yyyy", {
                  locale: id,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-[13px] font-bold">
                {presensi.jamMulai} - {presensi.jamSelesai} WIB
              </span>
            </div>
            <div className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-[13px] truncate">
                {capitalizeName(presensi.tempat)}
              </span>
            </div>
          </div>

          {/* Total counter — Lebih Tipis */}
          <div
            className={`mt-auto w-full flex items-center justify-between px-5 py-3 rounded-xl border-2 shadow-inner ${
              userRole === "SEKRETARIS_CABANG"
                ? "bg-blue-50 border-blue-100"
                : "bg-green-50 border-green-100"
            }`}
          >
            <div className="flex flex-col">
              <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest leading-none mb-1">
                Total Hadir
              </span>
              <div className="flex items-baseline gap-1 leading-none">
                <span
                  className={`text-3xl font-black ${
                    userRole === "SEKRETARIS_CABANG"
                      ? "text-blue-700"
                      : "text-green-600"
                  }`}
                >
                  {dataPresensi.length}
                </span>
                <span className="text-slate-400 text-[10px] font-bold">
                  Peserta
                </span>
              </div>
            </div>
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                userRole === "SEKRETARIS_CABANG"
                  ? "bg-blue-600/10"
                  : "bg-green-600/10"
              }`}
            >
              <Users
                className={`w-5 h-5 ${
                  userRole === "SEKRETARIS_CABANG"
                    ? "text-blue-600"
                    : "text-green-600"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Right — Daftar Kehadiran Realtime */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white/40">
          <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  userRole === "SEKRETARIS_CABANG"
                    ? "bg-blue-600 text-white"
                    : "bg-green-600 text-white"
                }`}
              >
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-slate-900 font-black text-lg tracking-tight">
                  Daftar Kehadiran
                </h2>
                <p className="text-slate-500 text-[10px] font-semibold flex items-center gap-1">
                  TERUPDATE SECARA REALTIME
                  <span className="flex gap-1 h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-bold text-slate-500">
                ESC UNTUK KELUAR
              </div>
            </div>
          </div>

          <div
            ref={fullscreenListRef}
            className="flex-1 overflow-y-auto px-6 py-6 space-y-3 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.200)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
          >
            {dataPresensi.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <QrCode className="w-24 h-24 mb-4 opacity-20" />
                <p className="text-xl font-black text-slate-400">
                  Belum Ada Peserta
                </p>
                <p className="text-slate-400 text-sm font-medium">
                  Menunggu peserta melakukan presensi...
                </p>
              </div>
            ) : (
              [...dataPresensi]
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
                )
                .map((item: any, index: number) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-3 rounded-[1.25rem] border-2 transition-all duration-500 animate-in slide-in-from-right-8 fade-in ${
                      index === 0
                        ? userRole === "SEKRETARIS_CABANG"
                          ? "bg-blue-50 border-blue-200 shadow-xl scale-[1.01] z-10"
                          : "bg-green-50 border-green-200 shadow-xl scale-[1.01] z-10"
                        : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-md"
                    }`}
                  >
                    {/* Nomor urut */}
                    <div
                      className={`text-slate-400 text-[10px] font-black w-6 text-center shrink-0 font-mono ${index === 0 ? (userRole === "SEKRETARIS_CABANG" ? "text-blue-500" : "text-green-600") : ""}`}
                    >
                      {String(dataPresensi.length - index).padStart(2, "0")}
                    </div>

                    {/* Avatar */}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm border-2 ${
                        item.organisasi === "IPNU"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : item.organisasi === "IPPNU"
                            ? "bg-rose-100 text-rose-700 border-rose-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {item.namaLengkap?.[0]?.toUpperCase() ?? "?"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-black text-lg tracking-tight truncate ${index === 0 ? "text-slate-900" : "text-slate-800"}`}
                        >
                          {capitalizeName(item.namaLengkap)}
                        </p>
                        {index === 0 && (
                          <div
                            className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest animate-pulse ${
                              userRole === "SEKRETARIS_CABANG"
                                ? "bg-blue-600 text-white"
                                : "bg-green-600 text-white"
                            }`}
                          >
                            Baru
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            item.organisasi === "IPNU"
                              ? "bg-emerald-100/50 text-emerald-700"
                              : item.organisasi === "IPPNU"
                                ? "bg-rose-100/50 text-rose-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.organisasi === "UMUM"
                            ? "Eksternal"
                            : item.organisasi}
                        </div>
                        <p className="text-slate-500 text-xs font-semibold truncate">
                          {item.tingkat ? `${item.tingkat} • ` : ""}
                          {capitalizeName(
                            item.organisasi === "UMUM"
                              ? item.instansi
                              : item.jabatan,
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Waktu */}
                    <div
                      className={`flex flex-col items-end shrink-0 ${index === 0 ? (userRole === "SEKRETARIS_CABANG" ? "text-blue-700" : "text-green-600") : "text-slate-400"}`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-widest mb-1 opacity-60">
                        Pukul
                      </span>
                      <span className="text-xl font-black font-mono leading-none">
                        {format(new Date(item.createdAt), "HH:mm:ss", {
                          locale: id,
                        })}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
