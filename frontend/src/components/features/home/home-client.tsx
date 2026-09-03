"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
type User = any;
type Session = {
  user: any;
  session?: any;
  expires?: string;
} | null;
import {
  Archive,
  ShieldCheck,
  LayoutDashboard,
  Menu,
  X,
  Download,
  Calendar,
  Users,
  Mail,
  Play,
  QrCode,
  Server,
  Wallet,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { loginWithSSO, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { getPublicStats } from "@/app/actions/dashboard-actions";
import { requestLocation } from "@/lib/location";
import { toast } from "sonner";
import LoginClient from "@/components/features/auth/login-client";

interface HomeClientProps {
  session: Session | null;
  stats: {
    anggotaTerdaftar: number;
    suratDiproses: number;
  };
}

export default function HomeClient({ session, stats }: HomeClientProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [loggingInFrom, setLoggingInFrom] = useState<"desktop" | "mobile" | "hero" | null>(null);

  const router = useRouter();

  // Formatting helper for Indonesian locale
  const nf = new Intl.NumberFormat("id-ID");

  const [currentStats, setCurrentStats] = useState(stats);

  // Sync state if props change (e.g. from router.refresh)
  useEffect(() => {
    setCurrentStats(stats);
  }, [stats]);

  useEffect(() => {
    const handleRealtime = async (event: Event) => {
      // 1. Trigger server-side refresh
      router.refresh();

      // 2. Also fetch manually for faster local update
      setTimeout(async () => {
        const fresh = await getPublicStats();
        if (fresh) {
          setCurrentStats({
            anggotaTerdaftar: fresh.anggotaCount,
            suratDiproses: fresh.suratCount,
          });
        }
      }, 500);
    };

    window.addEventListener("laci-realtime", handleRealtime as EventListener);
    return () => {
      window.removeEventListener(
        "laci-realtime",
        handleRealtime as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["home", "fitur", "resources", "kontak"];
      const offset = 110;

      // Show/hide scroll to top button
      setShowScrollTop(window.scrollY > 300);
      setIsScrolled(window.scrollY > 20);

      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;

      if (atBottom) {
        setActiveSection("kontak");
        return;
      }

      const y = window.scrollY + offset;
      let current = "home";

      for (const id of sections) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= y) {
          current = id;
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle section scrolling from other pages
  useEffect(() => {
    // Check sessionStorage (more private) OR query param (fallback)
    const storedTarget = sessionStorage.getItem("laci_scroll_target");
    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get("section");
    const hashTarget = window.location.hash.substring(1);

    const target = storedTarget || sectionParam || hashTarget;

    if (target) {
      // Clean URL immediately
      if (window.location.search || window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      if (storedTarget) sessionStorage.removeItem("laci_scroll_target");

      // Delay slightly to ensure DOM elements are ready
      const timer = setTimeout(() => {
        goTo(target);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [router]);

  useEffect(() => {
    // Check permission state and prompt for geolocation on mount
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

  const handleSSOLogin = async (source: "desktop" | "mobile" | "hero") => {
    // Cek izin real-time (bukan hanya dari sisa cookie kemarin/sebelumnya)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        if (result.state !== "granted") {
          // Bersihkan cookie lama agar tidak bisa bypass
          document.cookie = "user_lat=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          document.cookie = "user_lng=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          
          toast.error("Akses Masuk Ditolak: Anda wajib mengizinkan akses lokasi pada browser/perangkat Anda untuk masuk.");
          requestLocation();
          return;
        }
      } catch (e) {
        // Fallback jika browser tidak mendukung query
      }
    }

    const cookiesArr = document.cookie.split(";");
    const hasLat = cookiesArr.some((c) => c.trim().startsWith("user_lat="));
    const hasLng = cookiesArr.some((c) => c.trim().startsWith("user_lng="));

    if (!hasLat || !hasLng) {
      toast.error("Akses Masuk Ditolak: Anda wajib mengaktifkan dan mengizinkan akses lokasi pada browser/perangkat Anda untuk masuk.");
      requestLocation();
      return;
    }

    setLoggingInFrom(source);
    try {
      loginWithSSO();
    } catch (error) {
      console.error("SSO Login error:", error);
      toast.error("Terjadi kesalahan saat menghubungi server SSO.");
      setLoggingInFrom(null);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    if (!isMenuOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
  };

  const navLinks = [
    { title: "Home", id: "home" },
    { title: "Fitur", id: "fitur" },
    { title: "Resources", id: "resources" },
    { title: "Kontak", id: "kontak" },
  ];

  const goTo = (id: string, isMobile = false) => {
    if (isMobile) {
      setIsMenuOpen(false);
      document.body.classList.remove("overflow-hidden");
    }

    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const linkBase =
    "rounded-xl px-3 py-2 text-sm font-semibold transition cursor-pointer";
  const linkActive = "bg-[#f0fdf4] text-[#166534] ring-1 ring-[#bbf7d0]";
  const linkIdleDesktop = "text-slate-600 hover:bg-slate-100";
  const linkIdleMobile = "text-slate-700 hover:bg-slate-100";

  return (
    <div className="bg-white text-slate-900 antialiased font-sans flex flex-col min-h-screen">
      <LoginClient />
      <div className="noise pointer-events-none fixed inset-0 -z-10"></div>

      {/* NAVBAR */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out",
          isScrolled ? "py-0" : "py-4 sm:py-6",
        )}
      >
        <nav
          className={cn(
            "mx-auto transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center justify-between",
            isScrolled
              ? "max-w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md px-4 py-3 sm:px-10 shadow-sm"
              : "max-w-[92%] sm:max-w-7xl px-6 sm:px-8 py-3 bg-white/95 backdrop-blur-lg rounded-full border border-slate-200/50 shadow-[0_20px_50px_rgba(0,0,0,0.08)]",
          )}
        >
          {/* Logo */}
          <a
            href="#home"
            className="flex items-center gap-3 group"
            onClick={(e) => {
              e.preventDefault();
              goTo("home");
            }}
          >
            <div className="relative">
              <Image
                src="/images/logo-laci.webp"
                alt="Laci Digital"
                width={40}
                height={40}
                className={cn(
                  "object-contain transition-all duration-500",
                  isScrolled ? "h-8 w-8" : "h-10 w-10",
                )}
              />
            </div>
            <div className="leading-tight">
              <p
                className={cn(
                  "font-bold transition-all duration-500 tracking-tight",
                  isScrolled ? "text-sm" : "text-base sm:text-lg",
                )}
              >
                Laci Digital
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                PC IPNU IPPNU Magetan
              </p>
            </div>
          </a>

          {/* Desktop menu */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => goTo(link.id)}
                className={cn(
                  linkBase,
                  activeSection === link.id ? linkActive : linkIdleDesktop,
                )}
              >
                {link.title}
              </button>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden items-center gap-2 md:flex">
            {session ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(2,44,20,0.10)] hover:bg-[#15803d]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <button
                  onClick={() => handleSSOLogin("desktop")}
                  disabled={loggingInFrom !== null}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {loggingInFrom === "desktop" ? "Loading..." : "Login"}
                </button>
                <Link
                  href="https://pelajarnumagetan.id/register"
                  className="rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(2,44,20,0.10)] hover:bg-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#bbf7d0]"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden rounded-xl p-2 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#bbf7d0] cursor-pointer relative z-50 [&_svg]:pointer-events-none"
            aria-label="Toggle menu"
            onClick={toggleMenu}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        {/* Mobile Dropdown Menu */}
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-50 md:hidden overflow-hidden transition-all duration-300 ease-in-out",
            isMenuOpen
              ? "max-h-[500px] opacity-100"
              : "max-h-0 opacity-0 pointer-events-none",
          )}
        >
          <div
            className={cn(
              "bg-white shadow-2xl transition-all duration-300",
              isScrolled
                ? "border-t border-slate-100 px-4 py-6"
                : "mx-4 mt-2 rounded-[2rem] border border-slate-200/60 px-6 py-6",
            )}
          >
            <div className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => goTo(link.id, true)}
                  className={cn(
                    linkBase,
                    activeSection === link.id ? linkActive : linkIdleMobile,
                  )}
                >
                  {link.title}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {session ? (
                <Link
                  href="/dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className="col-span-2 rounded-xl bg-[#16a34a] px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_10px_30px_rgba(2,44,20,0.10)] hover:bg-[#15803d]"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleSSOLogin("mobile");
                    }}
                    disabled={loggingInFrom !== null}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {loggingInFrom === "mobile" ? "Loading..." : "Login"}
                  </button>
                  <Link
                    href="https://pelajarnumagetan.id/register"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-xl bg-[#16a34a] px-4 py-2.5 text-center text-sm font-bold text-white shadow-lg shadow-green-100 hover:bg-[#15803d]"
                  >
                    Daftar
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div>
          {/* HERO SECTION */}
          <section
            id="home"
            className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-6 lg:px-8 lg:pt-36 lg:pb-16"
          >
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-xs font-semibold text-[#15803d]">
                  <span className="h-2 w-2 rounded-full bg-[#22c55e]"></span>
                  Layanan Cerdas Administrasi
                </div>

                <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
                  Selamat Datang di{" "}
                  <span className="text-[#15803d]">Laci Digital</span>
                </h1>

                <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                  <b>LACI</b> — <em>Layanan Cerdas Administrasi</em> untuk{" "}
                  <b>PC IPNU IPPNU Kabupaten Magetan</b>. Kelola data anggota
                  per periode, arsip surat &amp; berkas, pengajuan surat, serta
                  administrasi organisasi dengan mudah, aman, dan efisien.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {session ? (
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#16a34a] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(2,44,20,0.10)] hover:bg-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#bbf7d0]"
                    >
                      Buka Dashboard
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSSOLogin("hero")}
                      disabled={loggingInFrom !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#15803d] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(2,44,20,0.10)] hover:bg-[#166534] focus:outline-none focus:ring-2 focus:ring-[#bbf7d0] transition-all disabled:opacity-70 cursor-pointer"
                    >
                      {loggingInFrom === "hero" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Menghubungkan...
                        </>
                      ) : (
                        <>
                          <Image
                            src="/images/logo-sso.webp"
                            alt="Logo SSO"
                            width={20}
                            height={20}
                            className="object-contain"
                          />
                          Masuk dengan IPNU IPPNU ID
                        </>
                      )}
                    </button>
                  )}

                  <a
                    href="#fitur"
                    onClick={(e) => {
                      e.preventDefault();
                      goTo("fitur");
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Pelajari Lebih Lanjut
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M9 18l6-6-6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">Aman</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Data terenkripsi
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">
                      Mudah
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Kelola organisasi
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">24/7</p>
                    <p className="mt-1 text-xs text-slate-500">Akses online</p>
                  </div>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-md sm:max-w-lg lg:max-w-none">
                <div className="absolute -inset-3 sm:-inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-[#dcfce7] via-white to-white blur-2xl"></div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-4 sm:p-6 shadow-[0_10px_30px_rgba(2,44,20,0.10)]">
                  {/* header card */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-2xl bg-[rgba(22,163,74,0.10)] text-[#15803d]">
                        <ShieldCheck className="h-6 w-6" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold">PC IPNU IPPNU</p>
                        <p className="text-xs text-slate-500">
                          Dashboard ringkas & modern
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex w-fit items-center rounded-full bg-[#f0fdf4] px-3 py-1 text-xs font-semibold text-[#15803d] border border-[#bbf7d0]">
                      Enkripsi Aktif
                    </span>
                  </div>

                  {/* stats */}
                  <div className="mt-5 sm:mt-6 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-500">
                        Anggota Terdaftar
                      </p>
                      <p className="mt-2 text-2xl sm:text-3xl font-bold">
                        <span>{nf.format(currentStats.anggotaTerdaftar)}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Periode ini</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-500">
                        Surat Diproses
                      </p>
                      <p className="mt-2 text-2xl sm:text-3xl font-bold">
                        <span>{nf.format(currentStats.suratDiproses)}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Real-time</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4 sm:col-span-2">
                      <p className="text-xs font-semibold text-slate-500">
                        Status Layanan
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs sm:text-sm font-semibold text-slate-700 border border-slate-200">
                          <span className="h-2 w-2 rounded-full bg-[#22c55e]"></span>
                          Arsip Digital
                        </span>

                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs sm:text-sm font-semibold text-slate-700 border border-slate-200">
                          <span className="h-2 w-2 rounded-full bg-[#22c55e]"></span>
                          Pengajuan Surat
                        </span>

                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs sm:text-sm font-semibold text-slate-700 border border-slate-200">
                          <span className="h-2 w-2 rounded-full bg-[#22c55e]"></span>
                          Dashboard & Export
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* tip */}
                  <div className="mt-5 sm:mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-200">
                    <p className="text-sm font-semibold">Tip cepat</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Gunakan <b>filter periode</b> untuk memastikan data selalu
                      sesuai masa kepengurusan.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FITUR UNGGULAN SECTION */}
          <section
            id="fitur"
            className="border-t border-slate-200/70 bg-slate-50/40"
          >
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Fitur Unggulan
                </h2>
                <p className="mt-3 text-slate-600">
                  Sistem terintegrasi untuk manajemen organisasi yang efisien,
                  rapi, dan modern.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    title: "Periode Kepengurusan",
                    desc: "Switch cepat, filter otomatis, dan pengingat perubahan periode.",
                    icon: Calendar,
                    color: "bg-[rgba(22,163,74,0.10)] text-[#15803d]",
                    sub: "Periode",
                  },
                  {
                    title: "Data Anggota",
                    desc: "Kelola data anggota lengkap: foto, NIA, info pribadi, filter per periode.",
                    icon: Users,
                    color: "bg-indigo-500/10 text-indigo-700",
                    sub: "Anggota",
                  },
                  {
                    title: "Arsip Berkas Digital",
                    desc: "Enkripsi, search, pagination, dan export Excel (format Indonesia).",
                    icon: Archive,
                    color: "bg-orange-500/10 text-orange-700",
                    sub: "Berkas",
                  },
                  {
                    title: "Arsip Surat Digital",
                    desc: "Surat masuk/keluar: filter jenis, search, dan pencarian nomor surat.",
                    icon: Mail,
                    color: "bg-sky-500/10 text-sky-700",
                    sub: "Surat",
                  },
                  {
                    title: "Pengajuan Surat",
                    desc: "Status pending/diterima/ditolak dan notifikasi otomatis.",
                    icon: Play,
                    color: "bg-violet-500/10 text-violet-700",
                    sub: "Approval",
                  }, // Using Play as a replacement for the specific svg
                  {
                    title: "Manajemen User PAC",
                    desc: "Approve akses, verifikasi email, dan monitoring aktivasi akun.",
                    icon: Users,
                    color: "bg-amber-500/10 text-amber-700",
                    sub: "User",
                  },
                  {
                    title: "Kalender Kegiatan",
                    desc: "Jadwal cabang lengkap: waktu, tempat, dan deskripsi.",
                    icon: Calendar,
                    color: "bg-rose-500/10 text-rose-700",
                    sub: "Jadwal",
                  },
                  {
                    title: "Dashboard & Export",
                    desc: "Statistik real-time & export Excel format tanggal Indonesia.",
                    icon: LayoutDashboard,
                    color: "bg-red-500/10 text-red-700",
                    sub: "Laporan",
                  },
                  {
                    title: "Keamanan Data",
                    desc: "Role-based access, verifikasi email, dan autentikasi berlapis.",
                    icon: ShieldCheck,
                    color: "bg-[rgba(22,163,74,0.10)] text-[#15803d]",
                    sub: "Security",
                  },
                  {
                    title: "Presensi Digital",
                    desc: "Sistem presensi QR Code real-time yang terintegrasi dengan agenda kegiatan.",
                    icon: QrCode,
                    color: "bg-cyan-500/10 text-cyan-700",
                    sub: "Presensi",
                  },
                  {
                    title: "API Master Data",
                    desc: "Integrasi data organisasi terpusat untuk sinkronisasi aplikasi pihak ketiga.",
                    icon: Server,
                    color: "bg-slate-500/10 text-slate-500",
                    sub: "Coming Soon",
                  },
                  {
                    title: "E-Wallet & Keuangan",
                    desc: "Manajemen iuran anggota, dana organisasi, dan laporan keuangan digital.",
                    icon: Wallet,
                    color: "bg-slate-500/10 text-slate-500",
                    sub: "Coming Soon",
                  },
                ].map((fitur, i) => (
                  <article
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-[0_10px_30px_rgba(2,44,20,0.10)] transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={cn(
                          "grid h-12 w-12 place-items-center rounded-2xl",
                          fitur.color,
                        )}
                      >
                        <fitur.icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {fitur.sub}
                      </span>
                    </div>
                    <h3 className="mt-4 text-base font-semibold">
                      {fitur.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {fitur.desc}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* RESOURCES SECTION */}
          <section id="resources">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
              <div className="mx-auto max-w-2xl text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  <svg
                    className="h-4 w-4 text-[#15803d]"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 6v12M6 12h12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Dokumen & Resources
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Pusat Sumber Daya
                </h2>
                <p className="mt-3 text-slate-600">
                  Download template surat, format administrasi, peraturan, dan
                  logo resmi IPNU IPPNU Magetan.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    title: "Format Surat Baru",
                    desc: "Template surat terbaru sesuai standar PC IPNU IPPNU Magetan.",
                    link: "https://drive.google.com/drive/folders/1r-4OOy_5UcDDn6glvgz7NPrr6n5uxbSP",
                  },
                  {
                    title: "Administrasi Makesta",
                    desc: "Format administrasi lengkap untuk Masa Kesetiaan Anggota (MAKESTA).",
                    link: "https://drive.google.com/drive/folders/1e4__zQjlCTHsT_oIyrxlEeBDLUKm6KP7",
                  },
                  {
                    title: "Logo Resmi",
                    desc: "Logo IPNU, IPPNU, dan PC Magetan berbagai format.",
                    link: "https://drive.google.com/drive/folders/1cOwGh9FtPg62mDD61b7P097y-FWK-CTz",
                  },
                  {
                    title: "Peraturan IPNU IPPNU",
                    desc: "Peraturan organisasi, AD/ART, dan pedoman pelaksanaan terbaru.",
                    link: "https://drive.google.com/drive/folders/1uJuqz-Y8CD5RT0cwVNn1V2Db6rI_3FHj",
                  },
                  {
                    title: "Format Pengajuan SP",
                    desc: "Template pengajuan Surat Pengantar dari PAC ke PC Magetan.",
                    link: "https://drive.google.com/drive/folders/1l9Nb5O7hTyKVmuSgG8k13QmiHfBcLGRo",
                  },
                  {
                    title: "Perlengkapan Lakmud",
                    desc: "Daftar dan template perlengkapan untuk Latihan Kader Muda (LAKMUD).",
                    link: "https://drive.google.com/drive/u/0/folders/1FtsEWTe32t-p1aZI0MV6M5djwfClh468",
                  },
                ].map((res, i) => (
                  <a
                    key={i}
                    href={res.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-[0_10px_30px_rgba(2,44,20,0.10)] transition"
                  >
                    <p className="font-semibold">{res.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{res.desc}</p>
                    <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#15803d] group-hover:text-[#14532d]">
                      Download Template
                      <Download className="h-4 w-4" />
                    </span>
                  </a>
                ))}
              </div>

              <div className="mt-10 rounded-3xl border border-[#bbf7d0] bg-[#f0fdf4] p-6 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Butuh Bantuan?</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Hubungi tim kami jika ada pertanyaan seputar dokumen dan
                      resources.
                    </p>
                  </div>
                  <a
                    href="mailto:lacipelajarnumagetan@gmail.com"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#16a34a] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(2,44,20,0.10)] hover:bg-[#15803d]"
                  >
                    Hubungi Kami
                    <Mail className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER SECTION */}
      <footer
        id="kontak"
        className="relative overflow-hidden bg-slate-950 text-slate-200 mt-auto"
      >
        {/* Background Typography */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {/* Desktop Version */}
          <div className="hidden md:flex w-full h-full items-center justify-center">
            <span className="text-[15vw] font-[family-name:var(--font-outfit)] font-black italic text-transparent [-webkit-text-stroke:1px_#fff] whitespace-nowrap tracking-tighter leading-none scale-y-[1.35] origin-center opacity-20 -translate-x-[2%]">
              CONNECTIVE
            </span>
          </div>

          {/* Mobile Version */}
          <div className="md:hidden flex flex-col justify-between items-center h-full py-6 opacity-30 scale-110">
            <span className="text-[14vw] font-[family-name:var(--font-outfit)] font-black italic text-transparent [-webkit-text-stroke:1px_#fff] whitespace-nowrap tracking-tighter leading-none opacity-100 -translate-x-[3%]">
              CONNECTIVE
            </span>
            <span className="text-[14vw] font-[family-name:var(--font-outfit)] font-black italic text-transparent [-webkit-text-stroke:1px_#fff] whitespace-nowrap tracking-tighter leading-none opacity-30 -translate-x-[3%]">
              CONNECTIVE
            </span>
            <span className="text-[14vw] font-[family-name:var(--font-outfit)] font-black italic text-transparent [-webkit-text-stroke:1px_#fff] whitespace-nowrap tracking-tighter leading-none opacity-100 -translate-x-[3%]">
              CONNECTIVE
            </span>
            <span className="text-[14vw] font-[family-name:var(--font-outfit)] font-black italic text-transparent [-webkit-text-stroke:1px_#fff] whitespace-nowrap tracking-tighter leading-none opacity-30 -translate-x-[3%]">
              CONNECTIVE
            </span>
            <span className="text-[14vw] font-[family-name:var(--font-outfit)] font-black italic text-transparent [-webkit-text-stroke:1px_#fff] whitespace-nowrap tracking-tighter leading-none opacity-100 -translate-x-[3%]">
              CONNECTIVE
            </span>
            <span className="text-[14vw] font-[family-name:var(--font-outfit)] font-black italic text-transparent [-webkit-text-stroke:1px_#fff] whitespace-nowrap tracking-tighter leading-none opacity-30 -translate-x-[3%]">
              CONNECTIVE
            </span>
            <span className="text-[14vw] font-[family-name:var(--font-outfit)] font-black italic text-transparent [-webkit-text-stroke:1px_#fff] whitespace-nowrap tracking-tighter leading-none opacity-100 -translate-x-[3%]">
              CONNECTIVE
            </span>
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8 text-left">
            {/* Brand */}
            <div className="lg:col-span-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/images/logo-laci.webp"
                  alt="Laci Digital"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
                <div>
                  <p className="font-[family-name:var(--font-outfit)] font-bold text-xl uppercase tracking-wider text-white">
                    Laci Digital
                  </p>
                  <p className="text-sm text-slate-400">
                    Layanan Cerdas Administrasi
                  </p>
                </div>
              </div>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400 lg:mx-0">
                LACI (Layanan Cerdas Administrasi) — platform digital PC IPNU
                IPPNU Kabupaten Magetan untuk pengelolaan administrasi
                organisasi yang rapi dan efisien.
              </p>
            </div>

            {/* Menu */}
            <div className="lg:col-span-2 lg:pl-4">
              <p className="font-[family-name:var(--font-outfit)] font-bold text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
                Menu
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <button
                    className="hover:text-white transition-colors cursor-pointer"
                    onClick={() => goTo("home")}
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    className="hover:text-white transition-colors cursor-pointer"
                    onClick={() => goTo("fitur")}
                  >
                    Fitur
                  </button>
                </li>
                <li>
                  <button
                    className="hover:text-white transition-colors cursor-pointer"
                    onClick={() => goTo("resources")}
                  >
                    Resources
                  </button>
                </li>
              </ul>
            </div>

            {/* Informasi */}
            <div className="lg:col-span-2">
              <p className="font-[family-name:var(--font-outfit)] font-bold text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
                Informasi
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <Link
                    href="/faq"
                    className="hover:text-white transition-colors"
                  >
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/ketentuan-penggunaan"
                    className="hover:text-white transition-colors"
                  >
                    Ketentuan Penggunaan
                  </Link>
                </li>
                <li>
                  <Link
                    href="/kebijakan-privasi"
                    className="hover:text-white transition-colors"
                  >
                    Kebijakan Privasi
                  </Link>
                </li>
              </ul>
            </div>

            {/* Kontak */}
            <div className="lg:col-span-3">
              <p className="font-[family-name:var(--font-outfit)] font-bold text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
                Kontak
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li className="flex items-center lg:justify-start">
                  <span>Magetan, Jawa Timur</span>
                </li>
                <li>
                  <a
                    href="mailto:lacipelajarnumagetan@gmail.com"
                    className="hover:text-[#22c55e] transition-colors whitespace-nowrap text-sm"
                  >
                    lacipelajarnumagetan@gmail.com
                  </a>
                </li>
                <li>
                  <a
                    href="https://wa.me/6285850512135"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#22c55e] transition-colors"
                  >
                    +62 858-5051-2135
                  </a>
                </li>
              </ul>
            </div>

            {/* Media Partner */}
            <div className="lg:col-span-2 text-left">
              <p className="font-[family-name:var(--font-outfit)] font-bold text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
                Media Partner
              </p>
              <div className="mt-2 w-fit ml-0 lg:ml-0 overflow-hidden rounded-2xl bg-white shadow-lg p-2">
                <Image
                  src="/images/media.webp"
                  alt="Media Partner"
                  width={160}
                  height={80}
                  className="h-20 w-auto object-contain"
                  sizes="160px"
                />
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-10 pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 text-center sm:text-left">
              © {new Date().getFullYear()} Laci Digital. All rights reserved.
            </p>
            <p className="text-xs text-slate-500 text-center sm:text-right">
              Versi v1.0.0
            </p>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full bg-[#16a34a] text-white shadow-lg hover:bg-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#bbf7d0] transition-all duration-300 cursor-pointer",
          showScrollTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none",
        )}
        aria-label="Scroll to top"
      >
        <ChevronUp className="h-6 w-6 mx-auto" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PublicLayout: Navbar + Footer yang sama dengan home-client
// Dipakai di halaman FAQ, Ketentuan Penggunaan, Kebijakan Privasi
// ─────────────────────────────────────────────────────────────────
export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  const navLinks = [
    { title: "Home", id: "home" },
    { title: "Fitur", id: "fitur" },
    { title: "Resources", id: "resources" },
    { title: "Kontak", id: "kontak" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen((prev) => {
      const next = !prev;
      document.body.classList.toggle("overflow-hidden", next);
      return next;
    });
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    document.body.classList.remove("overflow-hidden");
  };

  // SPA navigation: gunakan Next.js router.push agar tidak full page reload
  const goToHome = (id: string) => {
    if (id === "home") {
      router.push("/");
    } else {
      // Store target in sessionStorage to keep URL clean
      sessionStorage.setItem("laci_scroll_target", id);
      router.push("/");
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const linkBase =
    "rounded-xl px-3 py-2 text-sm font-semibold transition cursor-pointer";
  const linkIdle = "text-slate-600 hover:bg-slate-100";
  const linkIdleMobile = "text-slate-700 hover:bg-slate-100";

  return (
    <div className="bg-white text-slate-900 antialiased font-sans flex flex-col min-h-screen">
      <div className="noise pointer-events-none fixed inset-0 -z-10"></div>

      {/* NAVBAR — sama persis dengan home */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out",
          isScrolled ? "py-0" : "py-4 sm:py-6",
        )}
      >
        <nav
          className={cn(
            "mx-auto transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center justify-between",
            isScrolled
              ? "max-w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md px-4 py-3 sm:px-10 shadow-sm"
              : "max-w-[92%] sm:max-w-7xl px-6 sm:px-8 py-3 bg-white/95 backdrop-blur-lg rounded-full border border-slate-200/50 shadow-[0_20px_50px_rgba(0,0,0,0.08)]",
          )}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo-laci.webp"
              alt="Laci Digital"
              width={40}
              height={40}
              className={cn(
                "object-contain transition-all duration-500",
                isScrolled ? "h-8 w-8" : "h-10 w-10",
              )}
            />
            <div className="leading-tight">
              <p
                className={cn(
                  "font-bold transition-all duration-500 tracking-tight",
                  isScrolled ? "text-sm" : "text-base sm:text-lg",
                )}
              >
                Laci Digital
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                PC IPNU IPPNU Magetan
              </p>
            </div>
          </Link>

          {/* Desktop menu */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => goToHome(link.id)}
                className={cn(linkBase, linkIdle)}
              >
                {link.title}
              </button>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden items-center gap-2 md:flex">
            {session ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(2,44,20,0.10)] hover:bg-[#15803d]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/"
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Login
                </Link>
                <Link
                  href="https://pelajarnumagetan.id/register"
                  className="rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(2,44,20,0.10)] hover:bg-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#bbf7d0]"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden rounded-xl p-2 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#bbf7d0] cursor-pointer relative z-50 [&_svg]:pointer-events-none"
            aria-label="Toggle menu"
            onClick={toggleMenu}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        {/* Mobile Dropdown */}
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-50 md:hidden overflow-hidden transition-all duration-300 ease-in-out",
            isMenuOpen
              ? "max-h-[500px] opacity-100"
              : "max-h-0 opacity-0 pointer-events-none",
          )}
        >
          <div
            className={cn(
              "bg-white shadow-2xl transition-all duration-300",
              isScrolled
                ? "border-t border-slate-100 px-4 py-6"
                : "mx-4 mt-2 rounded-[2rem] border border-slate-200/60 px-6 py-6",
            )}
          >
            <div className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    goToHome(link.id);
                    closeMenu();
                  }}
                  className={cn(linkBase, linkIdleMobile)}
                >
                  {link.title}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {session ? (
                <Link
                  href="/dashboard"
                  onClick={closeMenu}
                  className="col-span-2 rounded-xl bg-[#16a34a] px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_10px_30px_rgba(2,44,20,0.10)] hover:bg-[#15803d]"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/"
                    onClick={closeMenu}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Login
                  </Link>
                  <Link
                    href="https://pelajarnumagetan.id/register"
                    onClick={closeMenu}
                    className="rounded-xl bg-[#16a34a] px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_10px_30px_rgba(2,44,20,0.10)] hover:bg-[#15803d]"
                  >
                    Daftar
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 pt-24 sm:pt-32">{children}</main>

      {/* FOOTER — sama persis dengan home */}
      <footer
        id="kontak"
        className="relative overflow-hidden bg-slate-950 text-slate-200 mt-auto"
      >
        {/* Background Typography */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <div className="hidden md:flex w-full h-full items-center justify-center">
            <span className="text-[15vw] font-[family-name:var(--font-outfit)] font-black italic text-transparent [-webkit-text-stroke:1px_#fff] whitespace-nowrap tracking-tighter leading-none scale-y-[1.35] origin-center opacity-20 -translate-x-[2%]">
              CONNECTIVE
            </span>
          </div>
          <div className="md:hidden flex flex-col justify-between items-center h-full py-6 opacity-30 scale-110">
            {[...Array(7)].map((_, i) => (
              <span
                key={i}
                className={cn(
                  "text-[14vw] font-[family-name:var(--font-outfit)] font-black italic text-transparent [-webkit-text-stroke:1px_#fff] whitespace-nowrap tracking-tighter leading-none -translate-x-[3%]",
                  i % 2 === 0 ? "opacity-100" : "opacity-30",
                )}
              >
                CONNECTIVE
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-8 text-left">
            {/* Brand */}
            <div className="lg:col-span-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/images/logo-laci.webp"
                  alt="Laci Digital"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
                <div>
                  <p className="font-[family-name:var(--font-outfit)] font-bold text-xl uppercase tracking-wider text-white">
                    Laci Digital
                  </p>
                  <p className="text-sm text-slate-400">
                    Layanan Cerdas Administrasi
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400 lg:mx-0">
                LACI (Layanan Cerdas Administrasi) — platform digital PC IPNU
                IPPNU Kabupaten Magetan untuk pengelolaan administrasi
                organisasi yang rapi dan efisien.
              </p>
            </div>

            {/* Menu */}
            <div className="lg:col-span-2 lg:pl-4">
              <p className="font-[family-name:var(--font-outfit)] font-bold text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
                Menu
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                {[
                  { label: "Home", id: "home" },
                  { label: "Fitur", id: "fitur" },
                  { label: "Resources", id: "resources" },
                ].map((m) => (
                  <li key={m.id}>
                    <button
                      className="hover:text-white transition-colors cursor-pointer"
                      onClick={() => goToHome(m.id)}
                    >
                      {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Informasi */}
            <div className="lg:col-span-2">
              <p className="font-[family-name:var(--font-outfit)] font-bold text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
                Informasi
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <Link
                    href="/faq"
                    className="hover:text-white transition-colors"
                  >
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/ketentuan-penggunaan"
                    className="hover:text-white transition-colors"
                  >
                    Ketentuan Penggunaan
                  </Link>
                </li>
                <li>
                  <Link
                    href="/kebijakan-privasi"
                    className="hover:text-white transition-colors"
                  >
                    Kebijakan Privasi
                  </Link>
                </li>
              </ul>
            </div>

            {/* Kontak */}
            <div className="lg:col-span-3">
              <p className="font-[family-name:var(--font-outfit)] font-bold text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
                Kontak
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <span>Magetan, Jawa Timur</span>
                </li>
                <li>
                  <a
                    href="mailto:lacipelajarnumagetan@gmail.com"
                    className="hover:text-[#22c55e] transition-colors whitespace-nowrap text-sm"
                  >
                    lacipelajarnumagetan@gmail.com
                  </a>
                </li>
                <li>
                  <a
                    href="https://wa.me/6285850512135"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#22c55e] transition-colors"
                  >
                    +62 858-5051-2135
                  </a>
                </li>
              </ul>
            </div>

            {/* Media Partner */}
            <div className="lg:col-span-2 text-left">
              <p className="font-[family-name:var(--font-outfit)] font-bold text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">
                Media Partner
              </p>
              <div className="mt-2 w-fit lg:ml-0 overflow-hidden rounded-2xl bg-white shadow-lg p-2">
                <Image
                  src="/images/media.webp"
                  alt="Media Partner"
                  width={160}
                  height={80}
                  className="h-20 w-auto object-contain"
                  sizes="160px"
                />
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-10 pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 text-center sm:text-left">
              © {new Date().getFullYear()} Laci Digital. All rights reserved.
            </p>
            <p className="text-xs text-slate-500 text-center sm:text-right">
              Versi v1.0.0
            </p>
          </div>
        </div>
      </footer>

      {/* Scroll to Top */}
      <button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full bg-[#16a34a] text-white shadow-lg hover:bg-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#bbf7d0] transition-all duration-300 cursor-pointer",
          showScrollTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none",
        )}
        aria-label="Scroll to top"
      >
        <ChevronUp className="h-6 w-6 mx-auto" />
      </button>
    </div>
  );
}
