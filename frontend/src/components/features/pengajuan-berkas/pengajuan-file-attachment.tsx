"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Eye, FileText, FileX, RefreshCcw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { attachmentFeedback } from "@/lib/attachment-feedback";
import { isImage, isPdf } from "@/lib/encryption";

type FileState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; httpStatus: number };

export function PengajuanFileAttachment({ id, file, isReference = false }: {
  id: string;
  file: string | null;
  isReference?: boolean;
}) {
  const [state, setState] = useState<FileState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [previewFailed, setPreviewFailed] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!file) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let disposed = false;
    setState({ status: "loading" });
    setPreviewFailed(false);

    async function loadFile() {
      try {
        const params = new URLSearchParams({ preview: "true" });
        if (isReference) params.set("scope", "reference");
        const response = await fetch(`/api/pengajuan-berkas/download/${encodeURIComponent(id)}?${params}`, {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/octet-stream" },
          signal: controller.signal,
        });
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          if (!disposed) setState({ status: "error", httpStatus: response.status });
          return;
        }
        const blob = await response.blob();
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: "ready", url: objectUrl });
      } catch {
        if (!disposed) setState({ status: "error", httpStatus: 0 });
      } finally {
        clearTimeout(timeout);
      }
    }
    void loadFile();
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, file, isReference, attempt]);

  const feedback = !file
    ? { title: "Belum ada lampiran", description: "Pengajuan ini belum memiliki lampiran file." }
    : state.status === "error" ? attachmentFeedback(state.httpStatus) : null;
  const filename = `Pengajuan_${id}.${file?.match(/-([a-z0-9]+)\.enc$/i)?.[1] || "bin"}`;

  return (
    <Card>
      <CardHeader><CardTitle>File Lampiran</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {feedback ? (
          <div role="status" className="flex flex-col items-center rounded-lg border border-dashed bg-slate-50 px-6 py-10 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4"><FileX className="h-8 w-8 text-slate-400" /></div>
            <h3 className="font-semibold text-slate-800">{feedback.title}</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{feedback.description}</p>
            {file && (
              <Button variant="outline" className="mt-5" onClick={() => setAttempt(value => value + 1)}>
                <RefreshCcw className="h-4 w-4" /> Coba lagi
              </Button>
            )}
          </div>
        ) : state.status === "loading" ? (
          <div role="status" className="flex items-center justify-center gap-3 rounded-lg border bg-slate-50 p-10 text-sm text-muted-foreground">
            <Spinner className="h-5 w-5 text-primary" /> Memuat lampiran...
          </div>
        ) : state.status === "ready" ? (
          <>
            <div className="flex flex-col items-center justify-between gap-4 rounded-lg border p-4 md:flex-row">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-100 p-3"><FileText className="h-8 w-8 text-slate-500" /></div>
                <p className="font-medium">File Surat</p>
              </div>
              <div className="flex w-full gap-2 md:w-auto">
                <Button asChild variant="outline" className="flex-1 md:flex-none">
                  <a href={state.url} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /> Buka</a>
                </Button>
                <Button asChild className="flex-1 md:flex-none">
                  <a href={state.url} download={filename}><Download className="h-4 w-4" /> Download</a>
                </Button>
              </div>
            </div>
            {(isPdf(file) || isImage(file)) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b bg-slate-50/50 p-2 text-xs font-medium">
                  <span>Pratinjau {isPdf(file) ? "PDF" : "Gambar"}</span>
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-primary">
                    <a href={state.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /> Layar Penuh</a>
                  </Button>
                </div>
                {isImage(file) ? (
                  <div className="flex justify-center rounded-lg border bg-slate-50 p-4">
                    {previewFailed ? (
                      <p role="status" className="p-6 text-center text-sm text-muted-foreground">Pratinjau tidak dapat ditampilkan. Gunakan tombol Buka atau Download untuk mengakses file.</p>
                    ) : (
                      <img src={state.url} alt="Pratinjau lampiran pengajuan" className="max-h-[1000px] max-w-full rounded object-contain" onError={() => setPreviewFailed(true)} />
                    )}
                  </div>
                ) : isMobile ? (
                  <div className="flex flex-col items-center rounded-lg border bg-slate-50 p-8 text-center">
                    <Smartphone className="mb-3 h-8 w-8 text-primary" />
                    <p className="mb-4 text-sm text-muted-foreground">Buka file untuk melihat pratinjau PDF di perangkat Anda.</p>
                    <Button asChild><a href={state.url} target="_blank" rel="noopener noreferrer">Buka PDF</a></Button>
                  </div>
                ) : (
                  <object data={`${state.url}#view=FitH`} type="application/pdf" aria-label="Pratinjau lampiran PDF" className="h-[750px] w-full rounded-lg border">
                    <p className="p-6 text-center text-sm text-muted-foreground">Browser tidak dapat menampilkan pratinjau PDF. Gunakan tombol Buka atau Download di atas.</p>
                  </object>
                )}
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
