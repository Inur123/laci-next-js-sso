"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropModalProps {
  imageSrc: string;
  originalMimeType?: string; // e.g. "image/png" atau "image/jpeg"
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void;
}

/**
 * Mengambil cropped image dari canvas, mempertahankan format asli (PNG/JPEG)
 */
async function getCroppedImage(
  imageSrc: string,
  cropArea: CropArea,
  mimeType: string = "image/jpeg",
): Promise<File> {
  const image = new Image();
  image.src = imageSrc;
  image.crossOrigin = "anonymous"; // Hindari masalah CORS

  return new Promise((resolve, reject) => {
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context tidak tersedia"));
        return;
      }

      // Output size 400x400 (standar profil)
      const size = 400;
      canvas.width = size;
      canvas.height = size;

      // 1. Bersihkan canvas (penting untuk transparansi PNG)
      ctx.clearRect(0, 0, size, size);

      // 2. Jika JPEG, beri background putih
      const isPNG = mimeType.toLowerCase() === "image/png";
      if (!isPNG) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
      }

      // 3. Gambar area yang dicrop dengan kualitas tinggi
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        size,
        size,
      );

      const outputMime = isPNG ? "image/png" : "image/jpeg";
      const outputExt = isPNG ? "png" : "jpg";
      const quality = isPNG ? undefined : 0.95;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Gagal membuat blob dari canvas"));
            return;
          }
          // Beri nama unik agar cache browser tidak tertukar
          const filename = `profile-${Date.now()}.${outputExt}`;
          resolve(new File([blob], filename, { type: outputMime }));
        },
        outputMime,
        quality,
      );
    };

    image.onerror = () =>
      reject(new Error("Gagal memuat gambar untuk di-crop"));
  });
}

export function ImageCropModal({
  imageSrc,
  originalMimeType = "image/jpeg",
  open,
  onClose,
  onCropComplete,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((value: number) => {
    setZoom(value);
  }, []);

  const onCropCompleteInternal = useCallback(
    (_: unknown, croppedPixels: CropArea) => {
      setCroppedAreaPixels(croppedPixels);
    },
    [],
  );

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const file = await getCroppedImage(
        imageSrc,
        croppedAreaPixels,
        originalMimeType,
      );
      onCropComplete(file);
      onClose();
    } catch (err) {
      console.error("Crop error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-base font-semibold">
            Sesuaikan Foto Profil
          </DialogTitle>
        </DialogHeader>

        {/* Crop Area dengan Pattern Checkerboard untuk indikasi Transparansi */}
        <div
          className="relative w-full"
          style={{
            height: 340,
            backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), 
              linear-gradient(-45deg, #ccc 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #ccc 25%), 
              linear-gradient(-45deg, transparent 75%, #ccc 25%)`,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
            backgroundColor: "#eee",
          }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteInternal}
            style={{
              containerStyle: {
                borderRadius: 0,
                backgroundColor: "transparent",
              },
              cropAreaStyle: {
                border: "2px solid white",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
              },
            }}
          />
        </div>

        {/* Zoom Controls */}
        <div className="px-6 py-4 border-b bg-slate-50">
          <p className="text-xs text-slate-500 mb-2 font-medium">Zoom</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
              className="p-1.5 rounded-full hover:bg-slate-200 transition-colors text-slate-600"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full accent-primary cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              className="p-1.5 rounded-full hover:bg-slate-200 transition-colors text-slate-600"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-full hover:bg-slate-200 transition-colors text-slate-400"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            Geser foto untuk mengatur posisi, scroll/slider untuk zoom
          </p>
        </div>

        <DialogFooter className="px-6 py-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isProcessing}
          >
            <X className="w-4 h-4 mr-1.5" />
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1 text-white bg-primary hover:bg-primary/90"
          >
            {isProcessing ? (
              <>
                <Spinner className="w-4 h-4 mr-1.5" />
                Memproses...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Gunakan Foto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
