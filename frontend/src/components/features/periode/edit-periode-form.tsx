"use client";

import { useState, useEffect, useRef } from "react";
import { updatePeriode } from "@/app/actions/periode-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Periode } from "@/types/domain";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle } from "lucide-react";

export function EditPeriodeForm({
  periode,
  userRole,
}: {
  periode: Periode;
  userRole?: string;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const nama = formData.get("nama") as string;

    const result = await updatePeriode(periode.id, nama);

    setPending(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Periode berhasil diperbarui!");
      router.push("/dashboard/periode");
      router.refresh();
    }
  }

  const formRef = useRef<HTMLFormElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "Enter" && target.tagName !== "TEXTAREA") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Periode</CardTitle>
        <CardDescription>Ubah nama periode Anda.</CardDescription>
      </CardHeader>
      <form ref={formRef} onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama Periode</Label>
            <Input id="nama" name="nama" defaultValue={periode.nama} required />
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
                <CheckCircle className="w-4 h-4 mr-2" />
                Perbarui Periode
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
