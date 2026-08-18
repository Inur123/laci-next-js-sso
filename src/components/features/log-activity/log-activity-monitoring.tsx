"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart as PieIcon,
  LineChart as LineIcon,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

export type LogMonitoringProps = {
  data: {
    distribution: { name: string; value: number }[];
    leaderboard: {
      id: string;
      name: string;
      image: string | null;
      count: number;
    }[];
    timeline: { date: string; count: number }[];
  } | null;
};

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

export function LogActivityMonitoring({ data }: LogMonitoringProps) {
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <Card className="border-slate-200 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <LineIcon className="text-blue-600" size={20} />
              Tren Aktivitas User (7 Hari Terakhir)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-4">
            <div
              className="h-[280px] w-full pr-2"
              style={{ width: "100%", height: "280px" }}
            >
              <ResponsiveContainer width="99%" height={280}>
                <LineChart
                  data={data.timeline}
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                    padding={{ left: 20, right: 20 }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickCount={5}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={4}
                    dot={{
                      r: 4,
                      fill: "#3b82f6",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribution Chart */}
        <Card className="border-slate-200 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <PieIcon className="text-green-600" size={20} />
              Sebaran Aktivitas per Modul
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center min-h-[320px] pb-6">
            <div
              className="h-[220px] w-full"
              style={{ width: "100%", height: "220px" }}
            >
              <ResponsiveContainer width="99%" height={220}>
                <PieChart>
                  <Pie
                    data={data.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {data.distribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 px-4 text-center">
              {data.distribution.slice(0, 8).map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 text-[10px] sm:text-xs"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-slate-500 font-medium">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
