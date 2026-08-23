export interface PengajuanBerkasStatusEmailProps {
  userName: string;
  pacName: string;
  status: "DITERIMA" | "DITOLAK";
  alasanPenolakan?: string;
  detailUrl: string;
  noSurat?: string;
}

const getStatusHtml = (props: PengajuanBerkasStatusEmailProps) => {
  const isAccepted = props.status === "DITERIMA";
  const statusLabel = isAccepted ? "Diterima" : "Ditolak";
  const brandColor = isAccepted ? "#15803d" : "#ef4444"; // Hijau brand atau Merah

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Update Status Pengajuan</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <!-- Preheader -->
      <div style="display: none; max-height: 0px; overflow: hidden;">
        Update Status Pengajuan PAC ${props.pacName}: ${statusLabel}.
      </div>

      <div style="background-color: ${brandColor}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Laci Digital</h1>
        <p style="color: #f0f0f0; margin: 10px 0 0 0;">PC IPNU IPPNU Magetan</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: ${brandColor}; margin-top: 0;">Pengajuan Anda Telah ${statusLabel}</h2>
        
        <p>Halo <strong>${props.userName}</strong>,</p>
        
        <p>Kami ingin menginformasikan bahwa pengajuan PAC Anda untuk <strong>${props.pacName}</strong> telah selesai ditinjau oleh Sekretaris Cabang.</p>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">Informasi Pengajuan:</p>
          <p style="margin: 5px 0;"><strong>PAC:</strong> ${props.pacName}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${brandColor}; font-weight: bold;">${statusLabel}</span></p>
          ${
            !isAccepted && props.alasanPenolakan
              ? `
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e5e7eb;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Alasan Penolakan:</p>
            <p style="margin: 5px 0; color: #ef4444;">${props.alasanPenolakan}</p>
          </div>
          `
              : ""
          }
        </div>
        
        <p>${
          isAccepted
            ? "Terima kasih atas kerja samanya. Pengajuan Anda telah resmi tercatat di sistem."
            : "Silakan lakukan revisi sesuai alasan di atas dan ajukan kembali jika diperlukan. Jika ada pertanyaan, silahkan hubungi Sekretaris Cabang."
        }</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${props.detailUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Lihat Detail Di Dashboard
          </a>
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px dashed #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0 0 5px 0;">
            &copy; 2026 <strong style="color: #15803d;">Laci Digital</strong>. Semua hak dilindungi.
          </p>
          <p style="margin: 0;">
            PC IPNU IPPNU Magetan | Magetan, Jawa Timur, Indonesia
          </p>
          <!-- Anti-thread ID -->
          <div style="color: #ffffff; font-size: 1px; line-height: 1px; max-height: 0px; opacity: 0;">
            ${Date.now()}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const pengajuanBerkasStatusTemplate = (
  props: PengajuanBerkasStatusEmailProps,
) => getStatusHtml(props);

export const pengajuanBerkasStatusText = (props: PengajuanBerkasStatusEmailProps) => {
  const isAccepted = props.status === "DITERIMA";
  const statusStr = isAccepted ? "DITERIMA" : "DITOLAK";
  const contactMsg = isAccepted
    ? ""
    : " Jika ada pertanyaan, silahkan hubungi Sekretaris Cabang.";
  return `Halo ${props.userName}, pengajuan PAC ${props.pacName} Anda telah ${statusStr}.${!isAccepted && props.alasanPenolakan ? " Alasan: " + props.alasanPenolakan : ""}${contactMsg}`;
};
