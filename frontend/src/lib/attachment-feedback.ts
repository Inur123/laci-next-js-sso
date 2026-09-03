export function attachmentFeedback(status: number) {
  if (status === 404) {
    return {
      title: "File lampiran tidak ditemukan",
      description:
        "Data pengajuan tetap tersedia, tetapi file lampirannya tidak ditemukan. Hubungi pengaju untuk mengunggah ulang lampiran.",
    };
  }
  if (status === 401) {
    return {
      title: "Silakan masuk kembali",
      description: "Sesi Anda telah berakhir. Masuk kembali untuk membuka lampiran ini.",
    };
  }
  if (status === 403) {
    return {
      title: "Lampiran tidak dapat diakses",
      description: "Anda tidak memiliki akses untuk membuka lampiran ini.",
    };
  }
  return {
    title: "Lampiran belum dapat dimuat",
    description: "Terjadi gangguan saat mengambil file. Silakan coba lagi beberapa saat lagi.",
  };
}
