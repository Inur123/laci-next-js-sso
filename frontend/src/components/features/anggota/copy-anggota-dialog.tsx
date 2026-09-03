"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  copyAnggotaToPeriode,
  getAnggotaForPeriod,
} from "@/app/actions/anggota-actions";
import { toast } from "sonner";

type Period = { id: string; nama: string; isActive?: boolean };
type Member = { id: string; namaLengkap: string; nik?: string | null };

export function CopyAnggotaDialog({
  open,
  onOpenChange,
  periods,
  currentPeriodId,
  initialMembers,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periods: Period[];
  currentPeriodId?: string;
  initialMembers: Member[];
  onCompleted: () => void;
}) {
  const [sourcePeriodId, setSourcePeriodId] = useState(currentPeriodId || "");
  const [targetPeriodId, setTargetPeriodId] = useState("");
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSourcePeriodId(currentPeriodId || periods[0]?.id || "");
    setTargetPeriodId("");
    setSelectedIds([]);
    setSearch("");
    setMembers(initialMembers);
  }, [open, currentPeriodId, periods, initialMembers]);

  useEffect(() => {
    if (!open || !sourcePeriodId) return;
    let cancelled = false;
    setLoadingMembers(true);
    getAnggotaForPeriod(sourcePeriodId).then((result) => {
      if (!cancelled) {
        setMembers(result.data as Member[]);
        setSelectedIds([]);
        setLoadingMembers(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, sourcePeriodId]);

  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((member) =>
      `${member.namaLengkap} ${member.nik || ""}`.toLowerCase().includes(term),
    );
  }, [members, search]);

  const allVisibleSelected =
    visibleMembers.length > 0 &&
    visibleMembers.every((member) => selectedIds.includes(member.id));

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleMembers.some((member) => member.id === id)),
      );
    } else {
      setSelectedIds((current) => [
        ...new Set([...current, ...visibleMembers.map((member) => member.id)]),
      ]);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  };

  const submit = async () => {
    if (!sourcePeriodId || !targetPeriodId || selectedIds.length === 0) return;
    setSubmitting(true);
    const result = await copyAnggotaToPeriode(
      selectedIds,
      sourcePeriodId,
      targetPeriodId,
    );
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.success || "Anggota berhasil dimasukkan ke periode tujuan");
    onOpenChange(false);
    onCompleted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Masukkan Anggota ke Periode
          </DialogTitle>
          <DialogDescription>
            Pilih anggota dari periode lama. Data periode lama tetap tersimpan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Periode sumber</Label>
            <Select value={sourcePeriodId} onValueChange={setSourcePeriodId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih periode sumber" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.nama}{period.isActive ? " (Aktif)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Periode tujuan</Label>
            <Select value={targetPeriodId} onValueChange={setTargetPeriodId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih periode tujuan" />
              </SelectTrigger>
              <SelectContent>
                {periods
                  .filter((period) => period.id !== sourcePeriodId)
                  .map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.nama}{period.isActive ? " (Aktif)" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama atau NIK..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
              Pilih semua yang tampil
            </label>
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} dipilih dari {members.length}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border">
            {loadingMembers ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat anggota...
              </div>
            ) : visibleMembers.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-sm text-muted-foreground">
                <Users className="mb-2 h-5 w-5" /> Tidak ada anggota pada periode ini.
              </div>
            ) : (
              visibleMembers.map((member) => (
                <label
                  key={member.id}
                  className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 last:border-0 hover:bg-slate-50"
                >
                  <Checkbox
                    checked={selectedIds.includes(member.id)}
                    onCheckedChange={() => toggleMember(member.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{member.namaLengkap}</span>
                    {member.nik && <span className="block text-xs text-muted-foreground">NIK: {member.nik}</span>}
                  </span>
                  {selectedIds.includes(member.id) && <Check className="h-4 w-4 text-primary" />}
                </label>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || !targetPeriodId || selectedIds.length === 0}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Masukkan {selectedIds.length || ""} Anggota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
