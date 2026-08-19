import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getLogActivityById } from "@/app/actions/log-activity-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Calendar,
  User,
  Layers,
  Activity,
  Tag,
  Clock,
  Globe,
  Monitor,
  Smartphone,
  Wifi,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LogAction, LogModule } from "@prisma/client";
import { formatDate, formatTime } from "@/lib/date-utils";
import { Suspense } from "react";
import { LogDetailSkeleton } from "@/components/features/log-activity/log-activity-skeleton";

async function parseLocation(locationStr: string | null) {
  if (!locationStr) return null;
  
  // Try to parse format: "Address (Lat, Lng)"
  const gpsRegex = /(.*?)\s*\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/;
  const match = locationStr.match(gpsRegex);
  
  if (match) {
    const [_, address, lat, lng] = match;
    const parts = address.split(",").map(p => p.trim());
    
    let desa = "";
    let kecamatan = "";
    let kabupaten = "";
    let provinsi = "";

    if (parts.length >= 4) {
      desa = parts[0];
      kecamatan = parts[1];
      kabupaten = parts[2];
      provinsi = parts[3];
    } else if (parts.length === 3) {
      desa = parts[0];
      kabupaten = parts[1];
      provinsi = parts[2];
    } else if (parts.length === 2) {
      kabupaten = parts[0];
      provinsi = parts[1];
    } else if (parts.length === 1) {
      kabupaten = parts[0];
    }

    if (provinsi === "Jawa") provinsi = "Jawa Timur";

    // If kecamatan is empty, try to fetch from BigDataCloud to fill it
    if (!kecamatan && lat && lng) {
      try {
        const bdcRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`,
          { signal: AbortSignal.timeout(2000) }
        );
        if (bdcRes.ok) {
          const bdcData = await bdcRes.json();
          if (bdcData && bdcData.localityInfo) {
            const allItems = [
              ...(bdcData.localityInfo.administrative || []),
              ...(bdcData.localityInfo.informative || [])
            ];
            const kecItem = allItems.find(item => 
              item.description && item.description.toLowerCase().includes("kecamatan")
            );
            if (kecItem) {
              kecamatan = kecItem.name;
            } else if (bdcData.locality && bdcData.locality !== bdcData.city) {
              kecamatan = bdcData.locality;
            }
          }
        }
      } catch (e) {
        console.warn("Fallback kecamatan fetch failed:", e);
      }
    }

    return {
      desa,
      kecamatan,
      kabupaten,
      provinsi,
      lat: parseFloat(lat).toFixed(6),
      lng: parseFloat(lng).toFixed(6),
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    };
  }
  
  // Fallback for simple "lat, lng" format
  const coordsRegex = /^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/;
  const coordsMatch = locationStr.match(coordsRegex);
  if (coordsMatch) {
    const [_, lat, lng] = coordsMatch;
    
    // Try Nominatim first (detailed for Indonesia)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: {
            "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
            "User-Agent": "LaciDigital/1.0",
          },
          signal: AbortSignal.timeout(3000),
          next: { revalidate: 86400 }
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const addr = data.address;
          const desa = addr.village || addr.suburb || addr.neighbourhood || addr.road || "";
          let kecamatan = addr.city_district || addr.subdistrict || addr.municipality || "";
          const kabupaten = addr.city || addr.regency || addr.town || addr.county || "";
          let provinsi = addr.state || "";
          if (provinsi === "Jawa") provinsi = "Jawa Timur";

          // Try to fill in kecamatan if empty
          if (!kecamatan) {
            try {
              const bdcRes = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`,
                { signal: AbortSignal.timeout(2000) }
              );
              if (bdcRes.ok) {
                const bdcData = await bdcRes.json();
                if (bdcData && bdcData.localityInfo) {
                  const allItems = [
                    ...(bdcData.localityInfo.administrative || []),
                    ...(bdcData.localityInfo.informative || [])
                  ];
                  const kecItem = allItems.find(item => 
                    item.description && item.description.toLowerCase().includes("kecamatan")
                  );
                  if (kecItem) {
                    kecamatan = kecItem.name;
                  } else if (bdcData.locality && bdcData.locality !== bdcData.city) {
                    kecamatan = bdcData.locality;
                  }
                }
              }
            } catch (e) {
              console.warn("Server-side BDC fallback for kecamatan failed:", e);
            }
          }

          return {
            desa,
            kecamatan,
            kabupaten,
            provinsi,
            lat: parseFloat(lat).toFixed(6),
            lng: parseFloat(lng).toFixed(6),
            mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          };
        }
      }
    } catch (e) {
      console.warn("Nominatim failed on server, trying BigDataCloud...", e);
    }

    // Fallback to BigDataCloud
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`,
        {
          signal: AbortSignal.timeout(3000),
          next: { revalidate: 86400 }
        }
      );
      if (res.ok) {
        const data = await res.json();
        let prov = data.principalSubdivision || "";
        if (prov === "Jawa") prov = "Jawa Timur";

        let kecamatan = "";
        if (data.localityInfo) {
          const allItems = [
            ...(data.localityInfo.administrative || []),
            ...(data.localityInfo.informative || [])
          ];
          const kecItem = allItems.find(item => 
            item.description && item.description.toLowerCase().includes("kecamatan")
          );
          if (kecItem) {
            kecamatan = kecItem.name;
          } else if (data.locality && data.locality !== data.city) {
            kecamatan = data.locality;
          }
        }

        return {
          desa: "",
          kecamatan,
          kabupaten: data.city || "",
          provinsi: prov,
          lat: parseFloat(lat).toFixed(6),
          lng: parseFloat(lng).toFixed(6),
          mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        };
      }
    } catch (e) {
      console.warn("Server-side fallback reverse geocoding warning:", e);
    }

    return {
      desa: "",
      kecamatan: "",
      kabupaten: "Koordinat Presisi",
      provinsi: "",
      lat: parseFloat(lat).toFixed(6),
      lng: parseFloat(lng).toFixed(6),
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    };
  }

  return {
    address: locationStr,
    lat: null,
    lng: null,
    mapUrl: null,
  };
}

const actionConfig: Record<
  LogAction,
  { label: string; className: string; icon: LucideIcon }
> = {
  CREATE: {
    label: "Tambah",
    className: "bg-green-100/80 text-green-700 border-green-200",
    icon: Activity,
  },
  UPDATE: {
    label: "Update",
    className: "bg-blue-100/80 text-blue-700 border-blue-200",
    icon: Activity,
  },
  DELETE: {
    label: "Hapus",
    className: "bg-red-100/80 text-red-700 border-red-200",
    icon: Activity,
  },
  IMPORT: {
    label: "Import",
    className: "bg-cyan-100/80 text-cyan-700 border-cyan-200",
    icon: Activity,
  },
  EXPORT: {
    label: "Export Excel",
    className: "bg-purple-100/80 text-purple-700 border-purple-200",
    icon: Activity,
  },
  APPROVE: {
    label: "Setujui",
    className: "bg-emerald-100/80 text-emerald-700 border-emerald-200",
    icon: Activity,
  },
  REJECT: {
    label: "Tolak",
    className: "bg-rose-100/80 text-rose-700 border-rose-200",
    icon: Activity,
  },
  LOGIN: {
    label: "Login",
    className: "bg-emerald-100/80 text-emerald-700 border-emerald-200",
    icon: Activity,
  },
  LOGOUT: {
    label: "Logout",
    className: "bg-orange-100/80 text-orange-700 border-orange-200",
    icon: Activity,
  },
};

const moduleConfig: Record<LogModule, { label: string; className: string }> = {
  ARSIP_SURAT: {
    label: "Arsip Surat",
    className: "bg-blue-50 text-green-600 border-blue-200",
  },
  ANGGOTA: {
    label: "Anggota",
    className: "bg-green-50 text-green-600 border-green-200",
  },
  BERKAS_PIMPINAN: {
    label: "Berkas Pimpinan",
    className: "bg-purple-50 text-purple-600 border-purple-200",
  },
  BERKAS_SP: {
    label: "Berkas SP",
    className: "bg-indigo-50 text-indigo-600 border-indigo-200",
  },
  AGENDA_KEGIATAN: {
    label: "Kegiatan",
    className: "bg-amber-50 text-amber-600 border-amber-200",
  },
  PENGAJUAN_BERKAS: {
    label: "Pengajuan PAC",
    className: "bg-rose-50 text-rose-600 border-rose-200",
  },
  PERIODE: {
    label: "Periode",
    className: "bg-cyan-50 text-cyan-600 border-cyan-200",
  },
  USER: {
    label: "Update Profil",
    className: "bg-slate-50 text-slate-600 border-slate-200",
  },
  AUTH: {
    label: "Autentikasi",
    className: "bg-gray-50 text-gray-600 border-gray-200",
  },
  PRESENSI: {
    label: "Presensi",
    className: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  WILAYAH: {
    label: "Wilayah",
    className: "bg-teal-50 text-teal-600 border-teal-200",
  },
};

export default function LogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<LogDetailSkeleton />}>
      <LogDetailContent params={params} />
    </Suspense>
  );
}

async function LogDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { id } = await params;
  const log = await getLogActivityById(id);

  if (!log) notFound();

  const actionInfo = actionConfig[log.action];
  const moduleInfo = moduleConfig[log.module];

  // Deteksi apakah device adalah mobile berdasarkan field device
  const isMobile =
    log.device?.toLowerCase().includes("mobile") ||
    log.device?.toLowerCase().includes("iphone") ||
    log.device?.toLowerCase().includes("android");

  const hasDeviceInfo =
    log.ipAddress || log.browser || log.device || log.location;

  const parsedLocation = await parseLocation(log.location);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/log-activity">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate text-slate-900">
              Detail Log Aktivitas
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              Informasi lengkap jejak aktivitas sistem
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info */}
        <Card className="md:col-span-2 shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                Informasi Aktivitas
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div>
              <Label className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2 block">
                Deskripsi
              </Label>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-slate-900 font-medium leading-relaxed">
                  {log.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Modul / Menu
                </p>
                <div className="pt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-2.5 py-0.5 text-xs transition-colors",
                      moduleInfo.className,
                    )}
                  >
                    {moduleInfo.label}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Jenis Aksi
                </p>
                <div className="pt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-2.5 py-0.5 text-xs font-bold uppercase",
                      actionInfo.className,
                    )}
                  >
                    {actionInfo.label}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Periode Aktif
                </p>
                <p className="font-semibold text-slate-900">
                  {log.periode.nama}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Log ID
                </p>
                <code className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono">
                  {log.id}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pelaku & Waktu Card */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
              Pelaku &amp; Waktu
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <User size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                  User Akun
                </p>
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  {log.user.name}
                </p>
                <p className="text-[10px] text-slate-500 italic bg-slate-50 px-2 py-0.5 rounded border border-slate-100 w-fit">
                  {log.user.role.replace(/_/g, " ")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Calendar size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                  Tanggal Kejadian
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {formatDate(new Date(log.createdAt), "PPPP")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Clock size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                  Waktu Presisi
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {formatTime(new Date(log.createdAt))} WIB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card Informasi Perangkat & Jaringan */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-violet-100 flex items-center justify-center">
              <Globe className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
              Informasi Perangkat &amp; Jaringan
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!hasDeviceInfo ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Monitor className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">
                Data perangkat tidak tersedia
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Log ini dibuat sebelum fitur pencatatan perangkat ditambahkan
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Alamat IP */}
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <Wifi className="w-4 h-4 text-blue-600" />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                    Alamat IP
                  </p>
                  {log.ipAddress ? (
                    <code className="block break-all text-sm font-semibold text-slate-900 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {log.ipAddress}
                    </code>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      Tidak tersedia
                    </p>
                  )}
                </div>
              </div>

              {/* Browser */}
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                    Browser
                  </p>
                  {log.browser ? (
                    <p className="text-sm font-semibold text-slate-900">
                      {log.browser}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      Tidak tersedia
                    </p>
                  )}
                </div>
              </div>

              {/* Perangkat */}
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                  {isMobile ? (
                    <Smartphone className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Monitor className="w-4 h-4 text-amber-600" />
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                    Perangkat
                  </p>
                  {log.device ? (
                    <p className="text-sm font-semibold text-slate-900">
                      {log.device}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      Tidak tersedia
                    </p>
                  )}
                </div>
              </div>

              {/* Lokasi */}
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-rose-600" />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">
                    Lokasi
                  </p>
                  {log.location && parsedLocation ? (() => {
                    const parts: string[] = [];
                    if (parsedLocation.desa) {
                      parts.push(parsedLocation.desa);
                    }
                    if (parsedLocation.kecamatan) {
                      parts.push(`Kec. ${parsedLocation.kecamatan}`);
                    }
                    if (parsedLocation.kabupaten) {
                      parts.push(`Kab. ${parsedLocation.kabupaten}`);
                    }
                    if (parsedLocation.provinsi) {
                      parts.push(parsedLocation.provinsi);
                    }

                    if (parts.length === 0 && parsedLocation.address) {
                      return (
                        <p className="text-sm font-semibold text-slate-900 leading-tight">
                          {parsedLocation.address}
                        </p>
                      );
                    }

                    // Split parts into 2 lines
                    let line1 = "";
                    let line2 = "";
                    if (parts.length >= 3) {
                      line1 = parts.slice(0, 2).join(", ");
                      line2 = parts.slice(2).join(", ");
                    } else {
                      line1 = parts[0] || "";
                      line2 = parts[1] || "";
                    }

                    return (
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">
                          {line1}
                        </p>
                        {line2 && (
                          <p className="text-xs text-slate-500 font-medium">
                            {line2}
                          </p>
                        )}
                        {parsedLocation.mapUrl && (
                          <div className="pt-0.5">
                            <a
                              href={parsedLocation.mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-rose-600 hover:text-rose-700 hover:underline font-semibold inline-flex items-center gap-0.5"
                            >
                              Lihat di Google Maps &rarr;
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <p className="text-sm text-slate-400 italic">
                      Tidak tersedia
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}


        </CardContent>
      </Card>
    </div>
  );
}
