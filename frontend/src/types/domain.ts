export const LogAction = {
  CREATE: "CREATE", UPDATE: "UPDATE", DELETE: "DELETE", IMPORT: "IMPORT",
  EXPORT: "EXPORT", APPROVE: "APPROVE", REJECT: "REJECT", LOGIN: "LOGIN", LOGOUT: "LOGOUT",
} as const;
export type LogAction = (typeof LogAction)[keyof typeof LogAction];

export const LogModule = {
  ARSIP_SURAT: "ARSIP_SURAT", ANGGOTA: "ANGGOTA", BERKAS_PIMPINAN: "BERKAS_PIMPINAN",
  BERKAS_SP: "BERKAS_SP", AGENDA_KEGIATAN: "AGENDA_KEGIATAN", PENGAJUAN_BERKAS: "PENGAJUAN_BERKAS",
  PERIODE: "PERIODE", USER: "USER", AUTH: "AUTH", PRESENSI: "PRESENSI", WILAYAH: "WILAYAH",
} as const;
export type LogModule = (typeof LogModule)[keyof typeof LogModule];

export type JenisWilayah = "RANTING" | "PK";
export type StatusPengajuan = "PENDING" | "DITERIMA" | "DITOLAK";
export type PenerimaSurat = "IPNU" | "IPPNU" | "BERSAMA" | "CBP_KPP";

export interface Periode {
  id: string;
  nama: string;
  userId?: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
}
