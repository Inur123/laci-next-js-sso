"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createWilayah, updateWilayah } from "@/app/actions/wilayah-actions";

interface WilayahFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem: any | null;
  jenis: "RANTING" | "PK";
  onSuccess: () => void;
}

export function WilayahForm({
  open,
  onOpenChange,
  editItem,
  jenis,
  onSuccess,
}: WilayahFormProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!editItem;

  const [formData, setFormData] = useState({
    nama: "",
    ketua: "",
    kontak: "",
    alamat: "",
  });

  useEffect(() => {
    if (open) {
      if (editItem) {
        setFormData({
          nama: editItem.nama || "",
          ketua: editItem.ketua || "",
          kontak: editItem.kontak || "",
          alamat: editItem.alamat || "",
        });
      } else {
        setFormData({ nama: "", ketua: "", kontak: "", alamat: "" });
      }
    }
  }, [open, editItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    data.append("jenis", jenis);
    data.append("nama", formData.nama);
    data.append("ketua", formData.ketua);
    data.append("kontak", formData.kontak);
    data.append("alamat", formData.alamat);

    const res = isEdit
      ? await updateWilayah(editItem.id, data)
      : await createWilayah(data);

    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(isEdit ? "Berhasil diperbarui" : "Berhasil ditambahkan");
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-slate-50/50 border-b">
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <Pencil className="h-5 w-5 text-blue-600" />
            ) : (
              <MapPin className="h-5 w-5 text-green-600" />
            )}
            {isEdit ? "Edit" : "Tambah"} {jenis === "RANTING" ? "Ranting" : "PK"}
          </DialogTitle>
          <DialogDescription>
            Isi formulir di bawah ini untuk menyimpan data pimpinan {jenis === "RANTING" ? "ranting" : "komisariat"}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nama {jenis === "RANTING" ? "Ranting" : "PK"} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nama"
              placeholder={`Contoh: ${jenis === "RANTING" ? "Ranting Desa X" : "PK Sekolah Y"}`}
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ketua" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nama Ketua / Pimpinan
            </Label>
            <Input
              id="ketua"
              placeholder="Opsional"
              value={formData.ketua}
              onChange={(e) => setFormData({ ...formData, ketua: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kontak" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Kontak (No. HP)
            </Label>
            <Input
              id="kontak"
              placeholder="Opsional"
              value={formData.kontak}
              onChange={(e) => setFormData({ ...formData, kontak: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alamat" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Alamat Lengkap
            </Label>
            <Textarea
              id="alamat"
              placeholder="Opsional"
              value={formData.alamat}
              onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
              className="resize-none"
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-6 border-t mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 text-white shadow-md transition-all duration-200">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
