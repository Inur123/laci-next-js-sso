export interface VerifiedSuccessEmailProps {
  name: string;
}

const getSuccessHtml = (name: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Berhasil Diverifikasi</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <!-- Preheader: Hanya menampilkan pesan yang sopan -->
      <div style="display: none; max-height: 0px; overflow: hidden;">
        Selamat! Alamat email Anda telah berhasil diverifikasi. Akun Anda kini menunggu aktivasi oleh Sekretaris Cabang.
      </div>

      <div style="background-color: #15803d; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Laci Digital</h1>
        <p style="color: #f0f0f0; margin: 10px 0 0 0;">PC IPNU IPPNU Magetan</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #15803d; margin-top: 0;">Akun Berhasil Diverifikasi!</h2>
        
        <p>Halo <strong>${name}</strong>,</p>
        
        <p>Selamat! Alamat email Anda telah berhasil diverifikasi.</p>
        
        <p>Akun Laci Digital Anda saat ini sedang menunggu antrean aktivasi oleh <strong>Sekretaris Cabang</strong> PC IPNU IPPNU Magetan sebelum Anda dapat mulai mengelola berkas dan data organisasi secara penuh.</p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Jika Anda mengalami kendala saat menggunakan aplikasi, jangan ragu untuk menghubungi tim support kami.
        </p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px dashed #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
          <p style="margin: 0 0 5px 0;">
            &copy; 2026 <strong style="color: #15803d;">Laci Digital</strong>. Semua hak dilindungi.
          </p>
          <p style="margin: 0 0 15px 0;">
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

export const verifiedSuccessEmailTemplate = ({
  name,
}: VerifiedSuccessEmailProps) => {
  return getSuccessHtml(name);
};

export const verifiedSuccessEmailText = ({
  name,
}: VerifiedSuccessEmailProps) => {
  return `
Halo ${name},
Selamat! Alamat email Anda telah berhasil diverifikasi.
Akun Anda saat ini sedang menunggu aktivasi oleh Sekretaris Cabang sebelum dapat digunakan sepenuhnya.
  `;
};
