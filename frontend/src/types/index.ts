export type DecryptedArsipSurat = {
  id: string;
  noSurat: string;
  pengirimPenerima: string;
  deskripsi: string | null;
  perihal: string;
  tanggal: Date | string;
  jenisSurat: string;
  organisasi?: string | null;
  file?: string | null;
  periode?: { nama: string };
  [key: string]: unknown;
};

export * from "./domain";
