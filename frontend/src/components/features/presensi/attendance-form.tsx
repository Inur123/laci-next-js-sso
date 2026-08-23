"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import {
  submitPresensiData,
  getPresensiDetail,
} from "@/app/actions/presensi-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { isPresensiOpen } from "@/lib/presensi-utils";

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

interface AttendanceFormProps {
  presensi: any;
}

export function AttendanceForm({ presensi }: AttendanceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    namaLengkap: string;
    organisasi: string;
    email: string;
    noHp: string;
    asal: "struktural" | "non-struktural";
    tingkat?: string | null;
    jabatan?: string | null;
    instansi?: string | null;
  } | null>(null);
  const [asal, setAsal] = useState<"struktural" | "non-struktural">(
    "struktural",
  );
  const [organisasi, setOrganisasi] = useState("");
  const [bagian, setBagian] = useState("");
  const [currentPresensi, setCurrentPresensi] = useState(presensi);
  // Realtime: status buka/tutup dari server
  const [isActive, setIsActive] = useState<boolean>(isPresensiOpen(presensi));
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tick every second to handle automatic time-based closing
  useEffect(() => {
    const interval = setInterval(() => {
      setIsActive(isPresensiOpen(currentPresensi));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentPresensi]);

  /**
   * TRIPLE PROTECTION: Global Realtime Listener + Automatic Tick
   */
  useEffect(() => {
    const refreshData = async () => {
      try {
        const fresh = await getPresensiDetail(presensi.id);
        if (fresh) {
          // Hanya update jika ada perubahan agar tidak re-render terus
          if (JSON.stringify(fresh) !== JSON.stringify(currentPresensi)) {
            setCurrentPresensi(fresh);
            setIsActive(isPresensiOpen(fresh));
          }
        }
      } catch {}
    };

    const handleRealtime = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;

      const detailType = detail.type?.toLowerCase();
      const detailModel = detail.model?.toLowerCase();
      const detailModule = detail.module;

      // Refresh jika ada perubahan pada event Presensi (via Mutation atau Log)
      const isPresensiMutation =
        detailType === "mutation" && detailModel === "presensi";
      const isPresensiLog =
        detailType === "log" &&
        (detailModule === "PRESENSI" || detailModule === "AGENDA_KEGIATAN");

      if (isPresensiMutation || isPresensiLog) {
        // Debounce Realtime update
        if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = setTimeout(refreshData, 500);
      }
    };

    window.addEventListener("laci-realtime", handleRealtime);

    // Polling backup setiap 60 detik (sebagai pengaman terakhir)
    const pollingInterval = setInterval(refreshData, 60000);

    return () => {
      window.removeEventListener("laci-realtime", handleRealtime);
      clearInterval(pollingInterval);
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    };
  }, [presensi.id, currentPresensi]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    if (asal === "non-struktural") {
      formData.set("organisasi", "UMUM");
    }

    const data = Object.fromEntries(formData.entries());

    try {
      const result = await submitPresensiData(presensi.id, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Presensi berhasil!");

        // Redirect ke halaman sukses dengan ID peserta
        setTimeout(() => {
          if (result.participantId) {
            router.push(
              `/presensi/${presensi.id}/success?id=${result.participantId}`,
            );
          } else {
            router.push(`/presensi/${presensi.id}/success`);
          }
        }, 100);
      }
    } catch (err) {
      console.error("Submit Error:", err);
      toast.error("Terjadi kesalahan sistem saat menyimpan data");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Presensi Ditutup (Danger Look)                                       */
  /* ------------------------------------------------------------------ */
  if (!isActive) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border-2 border-red-100 p-8 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 bg-red-100/50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" strokeWidth={2} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          Presensi Telah Ditutup
        </h3>
        <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
          Maaf, sesi absensi untuk agenda ini sedang tidak aktif atau waktu
          kegiatan telah berakhir.
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Sukses – tampilkan summary data, tanpa tombol kembali               */
  /* ------------------------------------------------------------------ */

  // Helper component untuk detail item (Flat version)
  function DetailItem({
    icon,
    label,
    value,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
  }) {
    return (
      <div className="flex items-center gap-4 group">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-green-50 group-hover:text-green-500 transition-colors">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mb-0.5">
            {label}
          </p>
          <p className="text-sm font-semibold text-slate-700 truncate">
            {value || "-"}
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Form utama – clean flat tanpa Card global                           */
  /* ------------------------------------------------------------------ */
  return (
    <div className="w-full">
      {/* ── CARD HEADER ── */}
      <div className="pt-2 px-0 pb-2 text-center">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
          Lengkapi Data Anda
        </h2>
        <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-1">
          Silakan mengisi formulir berikut untuk keperluan presensi.
        </p>
      </div>

      {/* ── CARD BODY ── */}
      <form onSubmit={handleSubmit} className="py-6 px-0 pt-6 space-y-5">
        {/* Nama Lengkap */}
        <Field label="Nama Lengkap" htmlFor="namaLengkap" required>
          <Input
            id="namaLengkap"
            name="namaLengkap"
            placeholder="Contoh: Irrandy"
            className="h-11 rounded-xl border-slate-200 bg-white focus-visible:ring-green-500"
            required
          />
        </Field>

        {/* Email */}
        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="contoh@email.com"
            className="h-11 rounded-xl border-slate-200 bg-white focus-visible:ring-green-500"
            required
          />
        </Field>

        {/* No HP */}
        <Field label="No HP" htmlFor="noHp" required>
          <Input
            id="noHp"
            name="noHp"
            placeholder="08xxxxxxxxxx"
            className="h-11 rounded-xl border-slate-200 bg-white focus-visible:ring-green-500"
            required
            type="tel"
            inputMode="numeric"
            onKeyPress={(e) => {
              if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
              }
            }}
          />
        </Field>

        {/* Asal Instansi */}
        <div className="border-2 border-green-500 rounded-xl p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Asal</p>

          <div className="flex gap-6">
            <RadioBtn
              name="asal_type"
              value="struktural"
              label="Internal"
              checked={asal === "struktural"}
              onChange={() => {
                setAsal("struktural");
                setOrganisasi("");
                setBagian("");
              }}
            />
            <RadioBtn
              name="asal_type"
              value="non-struktural"
              label="Eksternal"
              checked={asal === "non-struktural"}
              onChange={() => {
                setAsal("non-struktural");
                setOrganisasi("");
                setBagian("");
              }}
            />
          </div>

          {/* Internal */}
          {asal === "struktural" && (
            <div className="space-y-3 pt-1">
              <Field label="Organisasi" htmlFor="org-sel" required>
                <Select
                  name="organisasi"
                  onValueChange={setOrganisasi}
                  required
                >
                  <SelectTrigger
                    id="org-sel"
                    className="h-11 w-full rounded-xl border-slate-200 bg-white focus:ring-green-500"
                  >
                    <SelectValue placeholder="Pilih Organisasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IPNU">IPNU</SelectItem>
                    <SelectItem value="IPPNU">IPPNU</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {organisasi && (
                <>
                  <Field label="Tingkat" htmlFor="tingkat-sel" required>
                    <Select name="tingkat" required>
                      <SelectTrigger
                        id="tingkat-sel"
                        className="h-11 w-full rounded-xl border-slate-200 bg-white focus:ring-green-500"
                      >
                        <SelectValue placeholder="Pilih Tingkat" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CABANG">Pimpinan Cabang</SelectItem>
                        <SelectItem value="PAC">
                          Pimpinan Anak Cabang
                        </SelectItem>
                        <SelectItem value="RANTING">
                          Pimpinan Ranting
                        </SelectItem>
                        <SelectItem value="PK">Pimpinan Komisariat</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Bagian" htmlFor="bagian-sel" required>
                    <Select onValueChange={setBagian} required>
                      <SelectTrigger
                        id="bagian-sel"
                        className="h-11 w-full rounded-xl border-slate-200 bg-white focus:ring-green-500"
                      >
                        <SelectValue placeholder="Pilih Bagian" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PH">Pengurus Harian</SelectItem>
                        <SelectItem value="DEPT">Departemen</SelectItem>
                        <SelectItem value="LEMBAGA">Lembaga / Badan</SelectItem>
                        <SelectItem value="LAINNYA">
                          Lainnya (Ketik Manual)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Jabatan PH */}
                  {bagian === "PH" && (
                    <Field label="Jabatan PH" htmlFor="jabatan-ph" required>
                      <Select name="jabatan" required>
                        <SelectTrigger
                          id="jabatan-ph"
                          className="h-11 w-full rounded-xl border-slate-200 bg-white focus:ring-green-500"
                        >
                          <SelectValue placeholder="Pilih Jabatan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ketua">Ketua</SelectItem>
                          <SelectItem value="Wakil Ketua I">
                            Wakil Ketua I
                          </SelectItem>
                          <SelectItem value="Wakil Ketua II">
                            Wakil Ketua II
                          </SelectItem>
                          <SelectItem value="Wakil Ketua III">
                            Wakil Ketua III
                          </SelectItem>
                          <SelectItem value="Wakil Ketua IV">
                            Wakil Ketua IV
                          </SelectItem>
                          <SelectItem value="Wakil Ketua V">
                            Wakil Ketua V
                          </SelectItem>
                          <SelectItem value="Sekretaris">Sekretaris</SelectItem>
                          <SelectItem value="Wakil Sekretaris I">
                            Wakil Sekretaris I
                          </SelectItem>
                          <SelectItem value="Wakil Sekretaris II">
                            Wakil Sekretaris II
                          </SelectItem>
                          <SelectItem value="Wakil Sekretaris III">
                            Wakil Sekretaris III
                          </SelectItem>
                          <SelectItem value="Wakil Sekretaris IV">
                            Wakil Sekretaris IV
                          </SelectItem>
                          <SelectItem value="Wakil Sekretaris V">
                            Wakil Sekretaris V
                          </SelectItem>
                          <SelectItem value="Bendahara">Bendahara</SelectItem>
                          <SelectItem value="Wakil Bendahara">
                            Wakil Bendahara
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  {/* Departemen */}
                  {bagian === "DEPT" && (
                    <Field label="Departemen" htmlFor="jabatan-dept" required>
                      <Select name="jabatan" required>
                        <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white focus:ring-green-500">
                          <SelectValue placeholder="Pilih Departemen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dept. Organisasi">
                            Departemen Organisasi
                          </SelectItem>
                          <SelectItem value="Dept. Kaderisasi">
                            Departemen Kaderisasi
                          </SelectItem>
                          <SelectItem value="Dept. JSP">
                            Departemen Jaringan Sekolah & Pesantren
                          </SelectItem>
                          {organisasi === "IPNU" ? (
                            <SelectItem value="Dept. Dakwah">
                              Departemen Dakwah
                            </SelectItem>
                          ) : (
                            <>
                              <SelectItem value="Dept. Media & Digital">
                                Departemen Media & Digitalisasi
                              </SelectItem>
                              <SelectItem value="Dept. Jarkominfo">
                                Departemen Jarkominfo (Jaringan Komunikasi dan
                                Informasi)
                              </SelectItem>
                            </>
                          )}
                          <SelectItem value="Dept. SBO">
                            Departemen Seni Budaya & Olahraga
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  {/* Lembaga */}
                  {bagian === "LEMBAGA" && (
                    <Field
                      label="Lembaga / Badan"
                      htmlFor="jabatan-lembaga"
                      required
                    >
                      <Select name="jabatan" required>
                        <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white focus:ring-green-500">
                          <SelectValue placeholder="Pilih Lembaga" />
                        </SelectTrigger>
                        <SelectContent>
                          {organisasi === "IPNU" ? (
                            <>
                              <SelectItem value="CBP">
                                CBP (Corp Brigade Pembangunan)
                              </SelectItem>
                              <SelectItem value="LPP">
                                LPP (Lembaga Pers & Penerbitan)
                              </SelectItem>
                              <SelectItem value="EKONOMI">
                                Lembaga Ekonomi
                              </SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="KPP">
                                KPP (Korps Pelajar Putri)
                              </SelectItem>
                              <SelectItem value="LEKAS">
                                LEKAS (Lembaga Ekonomi dan Kewirausahaan)
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  {/* Lainnya */}
                  {bagian === "LAINNYA" && (
                    <Field
                      label="Sebutkan Jabatan / Bagian"
                      htmlFor="jabatan-manual"
                    >
                      <Input
                        id="jabatan-manual"
                        name="jabatan"
                        placeholder="Ketik jabatan Anda"
                        className="h-11 rounded-xl border-slate-200 bg-white focus-visible:ring-green-500"
                        required
                      />
                    </Field>
                  )}
                </>
              )}
            </div>
          )}

          {/* Non Struktural */}
          {asal === "non-struktural" && (
            <div className="space-y-3 pt-1">
              <Field label="Instansi" htmlFor="instansi" required>
                <Input
                  id="instansi"
                  name="instansi"
                  placeholder="Misal: Koran Kompas, Sekolah X, dll"
                  className="h-11 rounded-xl border-slate-200 bg-white focus-visible:ring-green-500"
                  required
                />
              </Field>
              <Field label="Jabatan" htmlFor="jabatan">
                <Input
                  id="jabatan"
                  name="jabatan"
                  placeholder="Misal: Wartawan, Guru, Anggota (opsional)"
                  className="h-11 rounded-xl border-slate-200 bg-white focus-visible:ring-green-500"
                />
              </Field>
            </div>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white h-12 text-base font-bold rounded-xl shadow-sm transition-all duration-200"
        >
          {isSubmitting ? (
            <>
              <Spinner className="mr-2 h-5 w-5" />
              Memproses...
            </>
          ) : (
            "Presensi"
          )}
        </Button>
      </form>
    </div>
  );
}

/* ── Helpers ── */

function SuksesRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-slate-800 font-medium text-sm leading-snug">{value}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function RadioBtn({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div className="relative w-5 h-5 shrink-0">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            checked ? "border-green-600" : "border-slate-300"
          }`}
        >
          {checked && <div className="w-2.5 h-2.5 rounded-full bg-green-600" />}
        </div>
      </div>
      <span
        className={`text-sm font-medium transition-colors ${
          checked ? "text-green-600" : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </label>
  );
}
