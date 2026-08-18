"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import LoginClient from "@/components/features/auth/login-client";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const requestLocation = (onSuccess?: () => void, onError?: () => void) => {
  if (typeof window === "undefined") return;

  if (!navigator.geolocation) {
    toast.error("Browser Anda tidak mendukung deteksi lokasi (Geolocation). Silakan gunakan browser lain.");
    if (onError) onError();
    return;
  }

  // Toast info instead of blocking alert
  toast.info("Sistem mendeteksi lokasi Anda untuk keamanan. Mohon izinkan akses lokasi jika diminta.");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;

      document.cookie = `user_lat=${latitude}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `user_lng=${longitude}; path=/; max-age=86400; SameSite=Lax`;

      try {
        let cleanAddress = "";
        // Try BigDataCloud first (very fast, free, no rate limits for low volume)
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (res.ok) {
            const data = await res.json();
            const parts = [];
            if (data.locality) parts.push(data.locality);
            if (data.city) parts.push(data.city);
            if (data.principalSubdivision) parts.push(data.principalSubdivision);
            if (parts.length > 0) {
              cleanAddress = parts.join(", ");
            }
          }
        } catch (e) {
          console.warn("BigDataCloud failed, falling back to Nominatim...", e);
        }

        // Fallback to Nominatim if BigDataCloud fails
        if (!cleanAddress) {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
                "User-Agent": "LaciDigital/1.0",
              },
              signal: AbortSignal.timeout(3000)
            }
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.address) {
              const addr = data.address;
              const addressParts = [];
              const village = addr.village || addr.suburb || addr.neighbourhood || addr.road;
              const district = addr.county || addr.city_district || addr.municipality || addr.subdistrict;
              const city = addr.city || addr.regency || addr.town;
              const state = addr.state;

              if (village) addressParts.push(village);
              if (district) addressParts.push(district);
              if (city) addressParts.push(city);
              if (state) addressParts.push(state);

              cleanAddress = addressParts.length > 0
                ? addressParts.join(", ")
                : data.display_name.split(",").slice(0, 3).join(",").trim();
            }
          }
        }

        if (cleanAddress) {
          document.cookie = `user_address=${encodeURIComponent(cleanAddress)}; path=/; max-age=86400; SameSite=Lax`;
        }
      } catch (e) {
        console.warn("Reverse geocoding warning:", e);
      }

      if (onSuccess) onSuccess();
    },
    (error) => {
      console.warn("Geolocation warning:", error.message || `Code: ${error.code}`);
      toast.error("Akses Lokasi Ditolak/Gagal. Anda wajib mengizinkan akses lokasi di browser untuk login.");
      if (onError) onError();
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
};

export default function LoginForm() {
  useEffect(() => {
    // Check permission state and prompt
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          if (result.state !== "granted") {
            requestLocation();
          } else {
            // Refresh cookie if already granted
            navigator.geolocation.getCurrentPosition((pos) => {
              const { latitude, longitude } = pos.coords;
              document.cookie = `user_lat=${latitude}; path=/; max-age=86400; SameSite=Lax`;
              document.cookie = `user_lng=${longitude}; path=/; max-age=86400; SameSite=Lax`;
            });
          }
        })
        .catch(() => {
          requestLocation();
        });
    } else {
      requestLocation();
    }
  }, []);
  return (
    <div className="h-screen w-full grid lg:grid-cols-2 overflow-hidden">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex flex-col justify-center items-center bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 p-12 relative overflow-hidden lg:rounded-tr-[16px] lg:rounded-br-[16px] shadow-2xl z-20">
        {/* Decorative Elements */}
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
              style={{ height: "auto" }}
              priority
            />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white">
              Laci Digital IPNU IPPNU
            </h1>
            <p className="text-lg text-green-50 leading-relaxed">
              Sistem Manajemen Administrasi Digital untuk Pimpinan Anak Cabang
              IPNU & IPPNU
            </p>
          </div>
          <div className="pt-8 space-y-3 text-green-50">
            <div className="flex items-center gap-3 justify-center">
              <div className="w-2 h-2 bg-green-200 rounded-full"></div>
              <p className="text-sm">Kelola data anggota dengan mudah</p>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className="w-2 h-2 bg-green-200 rounded-full"></div>
              <p className="text-sm">Arsip surat digital yang terorganisir</p>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className="w-2 h-2 bg-green-200 rounded-full"></div>
              <p className="text-sm">Monitoring aktivitas real-time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex items-start sm:items-center justify-center p-4 sm:p-8 bg-white overflow-hidden">
        <div className="w-full max-w-md space-y-4 pt-4 sm:pt-0">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center">
            <Image
              src="/images/logo-laci.webp"
              alt="Logo LACI"
              width={60}
              height={60}
              style={{ height: "auto" }}
              priority
            />
          </div>

          {/* Header */}
          <div className="space-y-1 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Selamat Datang
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Masuk ke akun Anda untuk melanjutkan
            </p>
          </div>

          <LoginClient />
          <LoginWithSSO />
        </div>
      </div>
    </div>
  );
}

function LoginWithSSO() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSSOLogin = async () => {
    const cookiesArr = document.cookie.split(";");
    const hasLat = cookiesArr.some((c) => c.trim().startsWith("user_lat="));
    const hasLng = cookiesArr.some((c) => c.trim().startsWith("user_lng="));

    if (!hasLat || !hasLng) {
      toast.error("Akses Masuk Ditolak: Anda wajib mengaktifkan dan mengizinkan akses lokasi pada browser/perangkat Anda untuk masuk.");
      requestLocation();
      return;
    }

    setIsLoading(true);
    try {
      // Sign in with Better Auth Generic OAuth
      await authClient.signIn.oauth2({
        providerId: "sso-ipnu",
        callbackURL: `${window.location.origin}/dashboard?login=success`,
        errorCallbackURL: `${window.location.origin}/login?error=auth_error`,
      });
    } catch (error) {
      console.error("SSO Login error:", error);
      toast.error("Terjadi kesalahan saat menghubungi server SSO.");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <button
        type="button"
        onClick={handleSSOLogin}
        disabled={isLoading}
        className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 transition-all shadow-lg shadow-green-700/30 hover:shadow-xl hover:shadow-green-700/40 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Menghubungkan ke SSO...
          </>
        ) : (
          <>
            <Image
              src="/images/logo-sso.webp"
              alt="Logo SSO"
              width={24}
              height={24}
              className="mr-2 object-contain"
            />
            Masuk dengan Akun IPNU IPPNU ID
          </>
        )}
      </button>
    </div>
  );
}
