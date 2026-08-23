import { ArsipSurat } from "@prisma/client";

export type DecryptedArsipSurat = Omit<
  ArsipSurat,
  "noSurat" | "pengirimPenerima" | "deskripsi" | "perihal"
> & {
  noSurat: string;
  pengirimPenerima: string;
  deskripsi: string | null;
  perihal: string;
};
