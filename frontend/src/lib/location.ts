import { toast } from "sonner";

export const requestLocation = (onSuccess?: () => void, onError?: () => void) => {
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
