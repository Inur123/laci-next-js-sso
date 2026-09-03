"use client";

import React, { useState, useEffect } from "react";
import { updateProfile } from "@/app/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import {
  Camera,
  Mail,
  User as UserIcon,
  Lock,
  Upload,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { resendVerificationAction } from "@/app/actions/auth-actions";
import { cn } from "@/lib/utils";
import { ImageCropModal } from "@/components/shared/image-crop-modal";

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export default function ProfilePage({ user }: { user: any }) {
  const [loading, setLoading] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [resendTimer, setResendTimer] = useState(0);

  // Persistence logic for resend timer
  useEffect(() => {
    const savedTime = localStorage.getItem(`resend_timer_${user.id}`);
    if (savedTime) {
      const remaining = Math.ceil((parseInt(savedTime) - Date.now()) / 1000);
      if (remaining > 0) {
        setResendTimer(remaining);
      } else {
        localStorage.removeItem(`resend_timer_${user.id}`);
      }
    }
  }, [user.id]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Use API endpoint for initial image if user has one
  const initialImage = user.image
    ? `/api/manajemen-user/${user.id}/image?v=${user.image.startsWith("http") ? "" : user.image}`
    : null;
  const [preview, setPreview] = useState<string | null>(initialImage);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [selectedFileMimeType, setSelectedFileMimeType] = useState<string>("image/jpeg");
  const [showCropModal, setShowCropModal] = useState(false);
  const router = useRouter();

  // Sync preview if user.image changes (e.g. after update)
  useEffect(() => {
    setPreview(
      user.image ? `/api/manajemen-user/${user.id}/image?t=${Date.now()}` : null,
    );
    setSelectedFile(null); // Reset file selection on external update
  }, [user.image, user.id]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score: 1, label: "Lemah", color: "#ef4444" };
    if (score === 2) return { score: 2, label: "Cukup", color: "#f97316" };
    if (score === 3) return { score: 3, label: "Sedang", color: "#eab308" };
    if (score === 4) return { score: 4, label: "Kuat", color: "#22c55e" };
    return { score: 5, label: "Sangat Kuat", color: "#16a34a" };
  };

  const strength = getPasswordStrength(newPassword);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    setSelectedFileMimeType(file.type);
    // Buka modal crop — tidak ada batas 2MB pada file mentah, batas diterapkan setelah crop
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropSrc(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  /** Dipanggil setelah user selesai crop di modal */
  const handleCropComplete = (croppedFile: File) => {
    // Cek ukuran hasil crop (biasanya jauh lebih kecil)
    if (croppedFile.size > 2 * 1024 * 1024) {
      toast.error("Ukuran foto terlalu besar, coba lagi");
      return;
    }
    
    // Revoke URL lama jika ada untuk mencegah memory leak
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }

    setSelectedFile(croppedFile);
    const objectUrl = URL.createObjectURL(croppedFile);
    setPreview(objectUrl);
    
    // Log info untuk debugging jika perlu
    console.log("Crop completed:", croppedFile.name, croppedFile.size, "bytes");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const password = form.get("password") as string;
    const confirmPassword = form.get("confirmPassword") as string;

    if (password && password !== confirmPassword) {
      toast.error("Password dan Konfirmasi Password tidak cocok!");
      return;
    }

    if (password && password.length < 6) {
      toast.error("Password minimal 6 karakter!");
      return;
    }

    setLoading(true);

    try {
      // Create a clean FormData to send
      const data = new FormData();
      data.append("name", form.get("name") as string);
      data.append("email", form.get("email") as string);
      if (password) data.append("password", password);

      if (selectedFile) {
        data.append("image", selectedFile);
      }

      // Spam Protection: Prevent email change if cooldown is active
      const email = form.get("email") as string;
      if (email !== user.email && resendTimer > 0) {
        toast.error(`Harap tunggu ${resendTimer} detik sebelum mengganti email lagi.`);
        return;
      }

      const result = await updateProfile(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Profil berhasil diperbarui!");
        // Reset password fields after success
        setNewPassword("");
        setConfirmPassword("");
        
        // If email was changed, trigger the 60s cooldown persistence
        if (form.get("email") !== user.email) {
          const expiryTime = Date.now() + 60 * 1000;
          localStorage.setItem(
            `resend_timer_${user.id}`,
            expiryTime.toString(),
          );
          setResendTimer(60);
        }
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat menyimpan profil.");
    } finally {
      setLoading(false);
    }
  }

  const handleVerifyCurrentEmail = async () => {
    if (resendTimer > 0) return;
    setVerifyingEmail(true);
    try {
      // NOTE: For now still using the OTP send action as it's the only one available
      // but we change the UI to not expect a modal here.
      const res = await resendVerificationAction(user.email || "");
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Instruksi verifikasi telah dikirim ke email Anda.");
        const expiryTime = Date.now() + 60 * 1000;
        localStorage.setItem(`resend_timer_${user.id}`, expiryTime.toString());
        setResendTimer(60);
      }
    } catch (err) {
      toast.error("Gagal mengirim permintaan verifikasi.");
    } finally {
      setVerifyingEmail(false);
    }
  };

  const formRef = React.useRef<HTMLFormElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    // Add small delay to prevent catching the Enter key from sidebar navigation
    const timer = setTimeout(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" || target.tagName === "SELECT";

        // Only trigger if focused on an input field (already excludes textarea via isInput)
        if (e.key === "Enter" && isInput) {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Listen for real-time updates from database (e.g. if emailVerified is changed)
  useEffect(() => {
    const handleRealtime = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      // Refresh if any user-related data changes
      if (detail?.model === "USER" || detail?.module === "USER") {
        router.refresh();
      }
    };

    window.addEventListener("laci-realtime", handleRealtime as EventListener);

    return () => {
      window.removeEventListener(
        "laci-realtime",
        handleRealtime as EventListener,
      );
    };
  }, [router]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <UserIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Profil Saya</h2>
            <p className="text-sm text-muted-foreground">
              Kelola informasi profil dan pengaturan keamanan akun Anda
            </p>
          </div>
        </div>
      </div>

      <Card className="border shadow-sm overflow-hidden w-full">
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-[280px_1fr]">
            {/* Sidebar-like Profile Section */}
            <div className="bg-white p-8 border-r flex flex-col items-center text-center">
              <div
                className="relative group cursor-pointer"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div
                  className={`relative rounded-full ${isDragging ? "ring-4 ring-primary ring-offset-4 ring-offset-background" : ""}`}
                >
                  <Avatar className="h-40 w-40 border-4 border-background shadow-xl">
                    <AvatarImage 
                      src={preview ?? undefined} 
                      className="h-full w-full object-cover" 
                    />
                    <AvatarFallback className="text-4xl bg-slate-100 text-slate-500 font-bold">
                      {getInitials(user.name || "User")}
                    </AvatarFallback>
                  </Avatar>

                  {isDragging && (
                    <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm rounded-full flex items-center justify-center z-10 border-2 border-primary border-dashed">
                      <Upload className="w-10 h-10 text-primary animate-bounce" />
                    </div>
                  )}
                </div>

                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleFileChange(e);
                    // Reset agar file yang sama bisa dipilih ulang
                    e.target.value = "";
                  }}
                />
                <Label
                  htmlFor="image"
                  tabIndex={-1}
                  className="absolute bottom-2 right-2 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform z-20"
                >
                  <Camera size={20} />
                </Label>
              </div>
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="text-xl font-bold">{capitalizeName(user.name || "")}</div>
                <Badge
                  variant="outline"
                  className="w-fit text-[10px] bg-white text-primary border-primary/20 hover:bg-slate-50 transition-colors shadow-none"
                >
                  {user.role?.replace("_", " ")}
                </Badge>
                <code className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                  ID: {user.id}
                </code>
              </div>
              <p className="mt-4 text-[11px] text-slate-400">
                Klik ikon kamera atau drag & drop foto baru. Maks 2MB.
              </p>
            </div>

            {/* Form Section */}
            <div className="p-8 space-y-8">
              <div className="grid gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <UserIcon size={18} className="text-primary" />
                    Informasi Pribadi
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nama Pimpinan</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={capitalizeName(user.name || "")}
                        required
                        className="bg-background"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Alamat Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          defaultValue={user.email || ""}
                          required
                          className="bg-background pl-10"
                        />
                      </div>

                      {/* Email Verification UI - Reverted to Original Design */}
                      <div className="mt-2">
                        {user.emailVerified ? (
                          <div className="flex items-center">
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1.5 py-1 px-2.5 text-[11px] font-medium"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Terverifikasi
                            </Badge>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-600 border-amber-100 flex items-center gap-1.5 py-1 px-2.5 text-[11px] font-medium whitespace-nowrap"
                              >
                                <AlertCircle className="w-3 h-3" />
                                Belum Terverifikasi
                              </Badge>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleVerifyCurrentEmail}
                                disabled={verifyingEmail || resendTimer > 0}
                                className="h-7 px-3 text-[10px] font-bold border-emerald-600 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all cursor-pointer"
                              >
                                {verifyingEmail ? (
                                  <>
                                    <Spinner className="h-2 w-2 mr-1.5" />
                                    Memproses...
                                  </>
                                ) : resendTimer > 0 ? (
                                  `Kirim ulang (${resendTimer}s)`
                                ) : (
                                  "Kirim Email Verifikasi"
                                )}
                              </Button>
                            </div>
                            <p className="text-[10px] text-slate-400 italic">
                              Jika Anda mengganti email, status verifikasi akan
                              direset.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Lock size={18} className="text-primary" />
                    Keamanan
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password Baru</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Kosongkan jika tidak ingin diubah"
                          className="bg-background pr-10"
                        />
                        {newPassword && (
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Password Strength Indicator */}
                      {newPassword && (
                        <div className="space-y-1.5 mt-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className="h-1 flex-1 rounded-full transition-all duration-300"
                                style={{
                                  backgroundColor:
                                    level <= strength.score
                                      ? strength.color
                                      : "#e2e8f0",
                                }}
                              />
                            ))}
                          </div>
                          <p
                            className="text-[10px] font-medium"
                            style={{ color: strength.color }}
                          >
                            Kekuatan password: {strength.label}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">
                        Konfirmasi Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Konfirmasi password baru"
                          className="bg-background pr-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={16} />
                          ) : (
                              <Eye size={16} />
                          )}
                        </button>
                      </div>

                      {/* Match Indicator */}
                      {confirmPassword && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {newPassword === confirmPassword ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                              <p className="text-[10px] text-emerald-600 font-medium">
                                Password cocok
                              </p>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-rose-500" />
                              <p className="text-[10px] text-rose-600 font-medium">
                                Password belum cocok
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    Minimal 6 karakter untuk keamanan ekstra.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 sm:flex-none sm:min-w-[100px] hover:bg-slate-100 transition-all duration-200"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "flex-1 sm:flex-none sm:px-8 text-white shadow-md hover:shadow-xl transition-all duration-200",
                    user.role === "SEKRETARIS_CABANG"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-green-600 hover:bg-green-700",
                  )}
                >
                  {loading ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Perbarui Profil
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Card>
      {/* Crop Modal */}
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          originalMimeType={selectedFileMimeType}
          open={showCropModal}
          onClose={() => {
            setShowCropModal(false);
            setCropSrc(null);
          }}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
