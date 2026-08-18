export interface VerificationEmailProps {
  name: string;
  otp?: string;
  verificationUrl?: string; // Legacy
}

const getOtpEmailHtml = (name: string, otp: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Kode Verifikasi Email</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      
      <div style="background-color: #15803d; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 1px;">Laci Digital</h1>
        <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 16px;">PC IPNU IPPNU Magetan</p>
      </div>
      
      <div style="background: #ffffff; padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #15803d; margin-top: 0; text-align: center; font-size: 24px;">Verifikasi Email Anda</h2>
        
        <p style="font-size: 16px;">Halo <strong>${name}</strong>,</p>
        
        <p style="font-size: 16px; color: #4a5568;">Terima kasih telah mendaftar di Laci Digital. Gunakan kode OTP di bawah ini untuk melengkapi proses verifikasi email Anda:</p>
        
        <div style="text-align: center; margin: 40px 0;">
          <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #15803d; padding: 20px 40px; border-radius: 12px;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: bold; color: #15803d; letter-spacing: 10px; margin-left: 10px;">${otp}</span>
          </div>
        </div>
        
        <p style="color: #ef4444; font-size: 14px; text-align: center; margin-top: 20px; font-weight: 500;">
          <strong>Penting:</strong> Kode ini hanya berlaku selama 10 menit.
        </p>
        
        <p style="color: #718096; font-size: 14px; margin-top: 30px;">
          Jika Anda tidak merasa mendaftar di Laci Digital, harap abaikan email ini. Jangan berikan kode ini kepada siapapun demi keamanan akun Anda.
        </p>
        
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
const getLinkEmailHtml = (name: string, url: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifikasi Email</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      
      <div style="background-color: #15803d; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 1px;">Laci Digital</h1>
        <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 16px;">PC IPNU IPPNU Magetan</p>
      </div>
      
      <div style="background: #ffffff; padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #15803d; margin-top: 0; text-align: center; font-size: 24px;">Verifikasi Email Anda</h2>
        
        <p style="font-size: 16px;">Halo <strong>${name}</strong>,</p>
        
        <p style="font-size: 16px; color: #4a5568;">Terima kasih telah memperbarui profil Anda di Laci Digital. Klik tombol di bawah ini untuk memverifikasi akun email baru Anda:</p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${url}" style="display: inline-block; background-color: #15803d; color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(21, 128, 61, 0.2);">Verifikasi Sekarang</a>
        </div>
        
        <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 20px;">
          Jika tombol tidak bekerja, salin dan tempel tautan berikut ke browser Anda:<br>
          <a href="${url}" style="color: #15803d; word-break: break-all;">${url}</a>
        </p>
        
        <p style="color: #ef4444; font-size: 14px; text-align: center; margin-top: 20px; font-weight: 500;">
          <strong>Penting:</strong> Tautan ini hanya berlaku selama 10 menit.
        </p>

        <p style="color: #718096; font-size: 14px; margin-top: 30px;">
          Jika Anda tidak merasa melakukan perubahan ini, harap segera amankan akun Anda.
        </p>
        
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

export const verificationEmailTemplate = ({
  name,
  otp,
  verificationUrl,
}: VerificationEmailProps) => {
  if (verificationUrl) {
    return getLinkEmailHtml(name, verificationUrl);
  }
  if (otp) {
    return getOtpEmailHtml(name, otp);
  }
  return "No valid verification method provided.";
};

export const verificationEmailText = ({
  name,
  otp,
}: VerificationEmailProps) => {
  return `
Halo ${name},
Kode verifikasi email Laci Digital Anda adalah: ${otp}
Kode ini berlaku selama 10 menit.
  `;
};
