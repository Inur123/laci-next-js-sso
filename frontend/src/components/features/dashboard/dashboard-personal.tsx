"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Mail,
  FileText,
  Calendar,
  FolderOpen,
  ArrowUpRight,
  BarChart3,
  QrCode,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { NumberTicker } from "@/components/ui/number-ticker";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface DashboardStats {
  anggota: number;
  globalAnggota?: number;
  surat: number;
  berkasSP?: number;
  berkasPimpinan: number;
  pengajuan: number;
  userCount?: number;
  periode: number;
  kegiatan: number;
  presensi: number;
  trend?: { name: string; value: number }[];
}

export function DashboardPersonal({
  stats,
  role,
  emailVerified = true,
}: {
  stats: DashboardStats;
  role?: string;
  emailVerified?: boolean;
}) {
  const isCabang = role === "CABANG";
  const themeHex = isCabang ? "#2563eb" : "#16a34a"; // Blue-600 vs Green-600

  const quickActions = isCabang
    ? [
        {
          title: "Total Anggota",
          icon: Users,
          href: "/dashboard/anggota",
          color: "text-blue-600",
          bgColor: "bg-blue-100/50",
          borderColor: "border-blue-100",
          count: stats.anggota,
        },
        {
          title: "Arsip Surat",
          icon: Mail,
          href: "/dashboard/arsip/surat",
          color: "text-amber-600",
          bgColor: "bg-amber-100/50",
          borderColor: "border-amber-100",
          count: stats.surat,
        },
        {
          title: "Berkas SP",
          icon: FolderOpen,
          href: "/dashboard/berkas-sp",
          color: "text-indigo-600",
          bgColor: "bg-indigo-100/50",
          borderColor: "border-indigo-100",
          count: stats.berkasSP || 0,
        },
        {
          title: "Berkas Pimpinan",
          icon: FolderOpen,
          href: "/dashboard/berkas-pimpinan",
          color: "text-purple-600",
          bgColor: "bg-purple-100/50",
          borderColor: "border-purple-100",
          count: stats.berkasPimpinan,
        },
        {
          title: "Verifikasi Pengajuan",
          icon: FileText,
          href: "/dashboard/pengajuan-berkas",
          color: "text-green-600",
          bgColor: "bg-green-100/50",
          borderColor: "border-green-100",
          count: stats.pengajuan,
        },
        {
          title: "Agenda Kegiatan",
          icon: BarChart3,
          href: "/dashboard/agenda-kegiatan",
          color: "text-rose-600",
          bgColor: "bg-rose-100/50",
          borderColor: "border-rose-100",
          count: stats.kegiatan,
        },
        {
          title: "Manajemen User",
          icon: Users,
          href: "/dashboard/manajemen-user",
          color: "text-slate-600",
          bgColor: "bg-slate-100/50",
          borderColor: "border-slate-100",
          count: stats.userCount || 0,
        },
        {
          title: "Data Anggota",
          icon: Users,
          href: "/dashboard/anggota",
          color: "text-cyan-600",
          bgColor: "bg-cyan-100/50",
          borderColor: "border-cyan-100",
          count: stats.anggota,
        },
        {
          title: "Periode",
          icon: Calendar,
          href: "/dashboard/periode",
          color: "text-sky-600",
          bgColor: "bg-sky-100/50",
          borderColor: "border-sky-100",
          count: stats.periode,
        },
        {
          title: "Presensi",
          icon: QrCode,
          href: "/dashboard/presensi",
          color: "text-pink-600",
          bgColor: "bg-pink-100/50",
          borderColor: "border-pink-100",
          count: stats.presensi,
        },
      ]
    : [
        {
          title: "Total Anggota",
          icon: Users,
          href: "/dashboard/anggota",
          color: "text-blue-600",
          bgColor: "bg-blue-100/50",
          borderColor: "border-blue-100",
          count: stats.anggota,
        },
        {
          title: "Arsip Surat",
          icon: Mail,
          href: "/dashboard/arsip/surat",
          color: "text-amber-600",
          bgColor: "bg-amber-100/50",
          borderColor: "border-amber-100",
          count: stats.surat,
        },
        {
          title: "Arsip Pimpinan",
          icon: FolderOpen,
          href: "/dashboard/berkas-pimpinan",
          color: "text-purple-600",
          bgColor: "bg-purple-100/50",
          borderColor: "border-purple-100",
          count: stats.berkasPimpinan,
        },
        {
          title: "Pengajuan Berkas",
          icon: FileText,
          href: "/dashboard/pengajuan-berkas",
          color: "text-green-600",
          bgColor: "bg-green-100/50",
          borderColor: "border-green-100",
          count: stats.pengajuan,
        },
        {
          title: "Periode",
          icon: Calendar,
          href: "/dashboard/periode",
          color: "text-cyan-600",
          bgColor: "bg-cyan-100/50",
          borderColor: "border-cyan-100",
          count: stats.periode,
        },
        {
          title: "Presensi",
          icon: QrCode,
          href: "/dashboard/presensi",
          color: "text-pink-600",
          bgColor: "bg-pink-100/50",
          borderColor: "border-pink-100",
          count: stats.presensi,
        },
      ];

  // Data for Charts
  const activityData = isCabang
    ? [
        { name: "Anggota", total: stats.anggota, fill: "#2563eb" },
        { name: "Surat", total: stats.surat, fill: "#d97706" },
        { name: "SP", total: stats.berkasSP || 0, fill: "#4f46e5" },
        { name: "Pimpinan", total: stats.berkasPimpinan, fill: "#9333ea" },
        { name: "Pengajuan", total: stats.pengajuan, fill: "#16a34a" },
        { name: "Kegiatan", total: stats.kegiatan, fill: "#e11d48" },
        { name: "Presensi", total: stats.presensi, fill: "#db2777" },
      ]
    : [
        { name: "Anggota", total: stats.anggota, fill: "#2563eb" }, // Blue
        { name: "Surat", total: stats.surat, fill: "#d97706" }, // Amber
        { name: "Pimpinan", total: stats.berkasPimpinan, fill: "#9333ea" }, // Purple
        {
          name: "Pengajuan",
          total: stats.pengajuan,
          fill: "#16a34a",
        }, // Green
        { name: "Periode", total: stats.periode, fill: "#0891b2" }, // Cyan
        { name: "Presensi", total: stats.presensi, fill: "#db2777" }, // Pink
      ];

  // Use Real Trend Data
  const trendData = stats.trend || [];

  return (
    <div className="space-y-6">
      {/* 1. Compact Stat Cards (1 Row) */}
      <div
        className={`grid grid-cols-2 md:grid-cols-3 ${isCabang ? "lg:grid-cols-5" : "lg:grid-cols-6"} gap-3`}
      >
        {quickActions.map((item, index) => {
          const cardContent = (
            <Card
              className={`h-[85px] flex flex-col justify-between p-3 shadow-none border ${item.borderColor} ${item.bgColor.replace("/50", "/20")} ${!emailVerified ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-bold uppercase truncate pr-1 ${item.color}`}
                >
                  {item.title}
                </span>
                {!emailVerified ? (
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                )}
              </div>
              <div className={`text-xl font-bold leading-none ${item.color}`}>
                <NumberTicker value={item.count} />
              </div>
            </Card>
          );

          if (!emailVerified) {
            return (
              <div
                key={index}
                className="group"
                onClick={() =>
                  toast.warning(
                    "Verifikasi email Anda untuk mengakses fitur ini.",
                  )
                }
              >
                {cardContent}
              </div>
            );
          }

          return (
            <Link href={item.href} key={index} className="group">
              {cardContent}
            </Link>
          );
        })}
      </div>

      {/* 2. Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar Chart Activity */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Statistik Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="h-[300px] w-full"
              style={{ height: "300px", minHeight: "300px" }}
            >
              <ResponsiveContainer width="99%" height={300}>
                <BarChart
                  data={activityData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Line Chart Trends */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowUpRight
                className={isCabang ? "text-blue-600" : "text-green-600"}
                size={20}
              />
              Tren Keaktifan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="h-[300px] w-full"
              style={{ height: "300px", minHeight: "300px" }}
            >
              <ResponsiveContainer width="99%" height={300}>
                <LineChart
                  data={trendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={themeHex}
                    strokeWidth={3}
                    dot={{ fill: themeHex, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    animationDuration={1200}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
