"use client";

import { useState } from "react";
import { createPeriode } from "@/app/actions/periode-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Plus } from "lucide-react";

export function AddPeriodeForm({ userRole }: { userRole?: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const nama = formData.get("nama") as string;

    const result = await createPeriode(nama);

    setPending(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Periode berhasil ditambahkan!");
      router.push("/dashboard/periode");
      router.refresh();
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama Periode</Label>
            <Input
              id="nama"
              name="nama"
              placeholder="Contoh: Masa Khidmat 2024-2026"
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t p-6 mt-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => router.back()}
            className="hover:bg-slate-100 transition-all duration-200"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={pending}
            className={`text-white shadow-md hover:shadow-xl transition-all duration-200 ${
              userRole === "SEKRETARIS_CABANG"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {pending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Menyimpan...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Simpan Periode
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
