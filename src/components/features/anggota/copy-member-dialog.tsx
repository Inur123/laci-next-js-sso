"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, Loader2, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getPeriodes } from "@/app/actions/periode-actions";
import {
  getAnggotaList,
  copyAnggotaToCurrentPeriode,
} from "@/app/actions/anggota-actions";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function CopyMemberDialog({ userRole }: { userRole: string }) {
  const isCabang = userRole === "SEKRETARIS_CABANG";

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(false);

  const [periodes, setPeriodes] = useState<
    { id: string; nama: string; isActive: boolean }[]
  >([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const [members, setMembers] = useState<any[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // Load periods when dialog opens
  useEffect(() => {
    if (open) {
      const loadPeriodes = async () => {
        const data = await getPeriodes();
        // Only show historical periods (not the active one)
        setPeriodes(data.filter((p) => !p.isActive) as any);
      };
      loadPeriodes();
    }
  }, [open]);

  // Load members when period selected
  useEffect(() => {
    if (selectedPeriodId) {
      const loadMembers = async () => {
        setFetchingMembers(true);
        try {
          const result = await getAnggotaList(
            "",
            1,
            100,
            undefined,
            selectedPeriodId,
          );
          setMembers(result.data);
          setSelectedMemberIds([]); // Reset selection when period changes
        } catch (error) {
          toast.error("Gagal memuat data anggota");
        } finally {
          setFetchingMembers(false);
        }
      };
      loadMembers();
    } else {
      setMembers([]);
    }
  }, [selectedPeriodId]);

  const filteredMembers = members.filter(
    (m) =>
      m.namaLengkap.toLowerCase().includes(search.toLowerCase()) ||
      (m.jabatan && m.jabatan.toLowerCase().includes(search.toLowerCase())),
  );

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (selectedMemberIds.length === filteredMembers.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(filteredMembers.map((m) => m.id));
    }
  };

  const handleCopy = async () => {
    if (selectedMemberIds.length === 0) {
      toast.error("Pilih minimal satu anggota");
      return;
    }

    setLoading(true);
    try {
      const result = await copyAnggotaToCurrentPeriode(selectedMemberIds);
      if (result.success) {
        toast.success(result.success);
        setOpen(false);
        // Reset state
        setSelectedPeriodId("");
        setSelectedMemberIds([]);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Gagal menyalin anggota");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full sm:w-auto h-9 px-4 text-sm bg-white shadow-sm transition-all duration-200",
            isCabang
              ? "border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              : "border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700",
          )}
        >
          <Copy className="mr-2 h-4 w-4" />
          Salin dari Periode Lain
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-slate-50/50 border-b">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus
              className={cn(
                "h-5 w-5",
                isCabang ? "text-blue-600" : "text-green-600",
              )}
            />
            Salin Anggota
          </DialogTitle>
          <DialogDescription>
            Pilih periode asal dan centang anggota yang akan dilanjutkan ke
            periode saat ini.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pilih Periode Asal
            </label>
            <Select
              value={selectedPeriodId}
              onValueChange={setSelectedPeriodId}
            >
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Pilih periode..." />
              </SelectTrigger>
              <SelectContent>
                {periodes.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    Tidak ada periode lain
                  </div>
                ) : (
                  periodes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nama} {p.isActive && "(Aktif)"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedPeriodId && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama atau jabatan..."
                  className="pl-9 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-medium text-slate-500">
                  {selectedMemberIds.length} terpilih dari{" "}
                  {filteredMembers.length}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-[11px] font-bold",
                    isCabang
                      ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      : "text-green-600 hover:text-green-700 hover:bg-green-50",
                  )}
                  onClick={toggleAll}
                >
                  {selectedMemberIds.length === filteredMembers.length
                    ? "Batal Semua"
                    : "Pilih Semua"}
                </Button>
              </div>

              <ScrollArea className="h-[250px] rounded-md border bg-white p-1">
                {fetchingMembers ? (
                  <div className="flex flex-col items-center justify-center h-[240px] gap-2 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p className="text-xs">Memuat anggota...</p>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[240px] text-slate-400">
                    <p className="text-xs">Tidak ada anggota ditemukan</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredMembers.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-md transition-colors cursor-pointer hover:bg-slate-50",
                          selectedMemberIds.includes(m.id) &&
                            (isCabang ? "bg-blue-50/50" : "bg-green-50/50"),
                        )}
                        onClick={() => toggleMember(m.id)}
                      >
                        <Checkbox
                          checked={selectedMemberIds.includes(m.id)}
                          onCheckedChange={() => toggleMember(m.id)}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="h-8 w-8 border border-slate-100">
                            <AvatarFallback
                              className={cn(
                                "text-[10px] font-bold",
                                isCabang
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-green-50 text-green-600",
                              )}
                            >
                              {m.namaLengkap.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-slate-900 truncate">
                              {m.namaLengkap}
                            </span>
                            {m.jabatan && (
                              <span className="text-[10px] text-slate-500 truncate">
                                {m.jabatan}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-slate-50/50 border-t">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            onClick={handleCopy}
            disabled={loading || selectedMemberIds.length === 0}
            className={cn(
              "text-white min-w-[100px] shadow-md",
              isCabang
                ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                : "bg-green-600 hover:bg-green-700 shadow-green-200",
            )}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyalin...
              </>
            ) : (
              `Salin ${selectedMemberIds.length} Anggota`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
