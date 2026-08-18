"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  checkEmailVerificationStatus,
  sendVerifiedSuccessEmailAction,
} from "@/app/actions/auth-actions";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [isChecking, setIsChecking] = useState(true);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpPending, setOtpPending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) {
      toast.error("Email tidak ditemukan. Silakan daftar ulang.");
      router.push("/register");
      return;
    }

    // Smart Check: Redirect if already verified
    const checkStatus = async () => {
      const result = await checkEmailVerificationStatus(email);
      if (result.verified) {
        toast.info("Email Anda sudah terverifikasi sebelumnya.");
        router.push("/login?verified=true");
      } else {
        setIsChecking(false);
      }
    };

    checkStatus();
  }, [email, router]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const data = e.clipboardData.getData("text").trim();
    if (!/^\d+$/.test(data)) return;

    const pastedCode = data.slice(0, 6).split("");
    const newOtp = [...otp];

    pastedCode.forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });

    setOtp(newOtp);

    const nextIndex = Math.min(pastedCode.length, 5);
    otpInputs.current[nextIndex]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      toast.error("Silakan masukkan kode 6-digit lengkap.");
      return;
    }

    setOtpPending(true);
    try {
      const { error } = await authClient.emailOtp.verifyEmail({
        email,
        otp: otpCode,
      });

      if (error) {
        let errorMessage = error.message || "Kode verifikasi salah.";
        if (
          error.status === 429 ||
          error.code === "TOO_MANY_REQUESTS" ||
          error.message?.toLowerCase().includes("too many")
        ) {
          errorMessage =
            "Terlalu banyak percobaaan verifikasi. Mohon tunggu beberapa saat sebelum mencoba kembali.";
        } else if (error.message?.includes("Invalid OTP")) {
          errorMessage = "Kode OTP tidak valid atau sudah kedaluwarsa.";
        }
        toast.error(errorMessage);
      } else {
        // Trigger success email in background
        sendVerifiedSuccessEmailAction(email).catch((err) => {
          console.error("[VERIFY-EMAIL] Gagal memicu email sukses:", err);
        });

        router.push("/login?verified=true");
      }
    } catch (err) {
      toast.error("Gagal memverifikasi kode.");
    } finally {
      setOtpPending(false);
    }
  };

  const handeResendOtp = async () => {
    if (resendTimer > 0) return;

    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });

      if (error) {
        let errorMessage = error.message || "Gagal mengirim ulang kode.";
        if (
          error.status === 429 ||
          error.code === "TOO_MANY_REQUESTS" ||
          error.message?.toLowerCase().includes("too many")
        ) {
          errorMessage =
            "Terlalu banyak permintaan pengiriman OTP. Mohon tunggu 1-2 menit sebelum mencoba lagi.";
        }
        toast.error(errorMessage);
      } else {
        toast.success("Kode baru telah dikirim.");
        setResendTimer(60);
      }
    } catch (err) {
      toast.error("Gagal mengirim ulang kode.");
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin text-green-600 h-10 w-10 mb-4" />
        <p className="text-slate-500 text-sm font-medium animate-pulse">
          Menghubungkan ke sistem...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 lg:h-screen lg:overflow-hidden">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex flex-col justify-center items-center bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 p-12 relative overflow-hidden lg:rounded-tr-[16px] lg:rounded-br-[16px] shadow-2xl z-20">
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 text-center space-y-8 max-w-lg">
          <div className="flex justify-center">
            <Image
              src="/images/logo-laci.webp"
              alt="Logo LACI"
              width={200}
              height={200}
              className="drop-shadow-2xl"
              priority
            />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white">
              Verifikasi Akun Laci Digital
            </h1>
            <p className="text-lg text-green-50 leading-relaxed">
              Satu langkah lagi untuk bergabung dengan sistem manajemen
              administrasi digital PAC IPNU & IPPNU
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Verify Form */}
      <div className="flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-center lg:hidden mb-4">
            <Image
              src="/images/logo-laci.webp"
              alt="Logo LACI"
              width={60}
              height={60}
              priority
            />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Verifikasi Email Anda
            </h2>
            <p className="text-sm text-slate-600">
              Kami telah mengirimkan kode 6-digit ke <br />
              <span className="font-semibold text-slate-900">{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-8">
            <div className="flex justify-center gap-2 sm:gap-3">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    otpInputs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-lg focus:border-green-600 focus:ring-4 focus:ring-green-100 outline-none transition-all"
                />
              ))}
            </div>

            <div className="space-y-4">
              <button
                type="submit"
                disabled={otpPending}
                className="w-full py-4 bg-green-700 text-white font-bold rounded-xl shadow-lg hover:bg-green-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {otpPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Verifikasi Akun"
                )}
              </button>

              <div className="flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={handeResendOtp}
                  disabled={resendTimer > 0}
                  className="text-sm font-semibold text-green-700 hover:text-green-800 disabled:text-slate-400 transition-colors cursor-pointer"
                >
                  {resendTimer > 0
                    ? `Kirim ulang kode dalam ${resendTimer} detik`
                    : "Kirim ulang kode verifikasi"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailForm() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-green-600 h-12 w-12" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
