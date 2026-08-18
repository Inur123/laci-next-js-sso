export interface PengajuanBerkasEmailProps {
  userName: string;
  pacName: string;
  submissionDate: string;
  detailUrl: string;
  noSurat?: string;
}

// Template untuk User (Konfirmasi Berhasil)
const getUserHtml = (props: PengajuanBerkasEmailProps) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pengajuan Berhasil</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <!-- Preheader -->
      <div style="display: none; max-height: 0px; overflow: hidden;">
        Alhamdulillah! Pengajuan PAC ${props.pacName} Anda telah berhasil dikirim.
      </div>

      <div style="background-color: #15803d; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Laci Digital</h1>
        <p style="color: #f0f0f0; margin: 10px 0 0 0;">PC IPNU IPPNU Magetan</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #15803d; margin-top: 0;">Pengajuan Telah Diterima</h2>
        
        <p>Halo <strong>${props.userName}</strong>,</p>
        
        <p>Terima kasih telah melakukan pengajuan data untuk <strong>${props.pacName}</strong> melalui sistem Laci Digital.</p>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">Ringkasan Pengajuan:</p>
          <p style="margin: 5px 0;"><strong>PAC:</strong> ${props.pacName}</p>
          <p style="margin: 5px 0;"><strong>Tanggal:</strong> ${props.submissionDate}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #d97706; font-weight: bold;">Menunggu Verifikasi</span></p>
        </div>
        
        <p>Tim admin PC IPNU IPPNU Magetan akan segera meninjau pengajuan Anda. Anda dapat memantau status pengajuan melalui dashboard.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${props.detailUrl}" style="background-color: #15803d; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Lihat Detail Pengajuan
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

// Template untuk Admin (Notifikasi Pengajuan Baru)
const getAdminHtml = (props: PengajuanBerkasEmailProps) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notifikasi Pengajuan Baru</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <!-- Preheader -->
      <div style="display: none; max-height: 0px; overflow: hidden;">
        Pemberitahuan: Ada pengajuan PAC baru dari ${props.pacName} yang memerlukan tindakan.
      </div>

      <div style="background-color: #1e293b; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Laci Digital Admin</h1>
        <p style="color: #cbd5e1; margin: 10px 0 0 0;">Notifikasi Sistem Pengajuan</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #0f172a; margin-top: 0;">Pengajuan Baru Perlu Ditinjau</h2>
        
        <p>Halo Admin,</p>
        
        <p>Sistem mendeteksi adanya pengajuan baru yang dikirimkan oleh user. Mohon segera lakukan tindak lanjut.</p>
        
        <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 14px; color: #64748b;">Informasi Pengajuan:</p>
          <p style="margin: 5px 0;"><strong>Pengaju:</strong> ${props.userName}</p>
          <p style="margin: 5px 0;"><strong>PAC:</strong> ${props.pacName}</p>
          <p style="margin: 5px 0;"><strong>Tanggal:</strong> ${props.submissionDate}</p>
        </div>
        
        <p>Silakan klik tombol di bawah ini untuk masuk ke panel admin dan meninjau berkas yang diajukan.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${props.detailUrl}" style="background-color: #0f172a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Tinjau Pengajuan Sekarang
          </a>
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px dashed #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0;">Email otomatis dari Sistem Laci Digital PC IPNU IPPNU Magetan</p>
          <!-- Anti-thread ID -->
          <div style="color: #ffffff; font-size: 1px; line-height: 1px; max-height: 0px; opacity: 0;">
            ${Date.now()}
          </div>
        </div>
      </div>
    </body>
    </html>
`;

export const pengajuanBerkasUserTemplate = (props: PengajuanBerkasEmailProps) =>
  getUserHtml(props);
export const pengajuanBerkasAdminTemplate = (props: PengajuanBerkasEmailProps) =>
  getAdminHtml(props);

export const pengajuanBerkasUserText = (props: PengajuanBerkasEmailProps) => `
Halo ${props.userName}, pengajuan PAC ${props.pacName} Anda telah berhasil dikirim pada ${props.submissionDate}.
`;

export const pengajuanBerkasAdminText = (props: PengajuanBerkasEmailProps) => `
Ada pengajuan baru dari ${props.userName} (PAC ${props.pacName}) pada ${props.submissionDate}. Segera lakukan peninjauan!
`;
