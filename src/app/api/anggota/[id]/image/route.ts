import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptFile, getOriginalExtension } from "@/lib/encryption";
import { downloadFromR2 } from "@/lib/storage-r2";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const anggota = await prisma.anggota.findUnique({
      where: { id },
      select: { foto: true },
    });

    if (!anggota || !anggota.foto) {
      return new NextResponse("Image not found", { status: 404 });
    }

    let buffer: Buffer;

    // Check if stored in R2 (new way) or Local (legacy)
    if (!anggota.foto.startsWith("/storage")) {
      // R2 Path (e.g., "anggota/filename.enc")
      try {
        buffer = await downloadFromR2(anggota.foto);
      } catch (err) {
        console.error("R2 Download Error:", err);
        return new NextResponse("Image not found in cloud", { status: 404 });
      }
    } else {
      // Legacy Local Path (Won't work in Vercel, but kept for types)
      return new NextResponse("Image legacy (lokal) tidak dapat diakses.", {
        status: 404,
      });
    }

    if (anggota.foto.endsWith(".enc")) {
      try {
        const decryptedBuffer = decryptFile(buffer);

        const ext = getOriginalExtension(anggota.foto);

        const mimeTypes: Record<string, string> = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          webp: "image/webp",
          svg: "image/svg+xml",
        };

        const contentType = mimeTypes[ext || ""] || "application/octet-stream";

        return new NextResponse(new Uint8Array(decryptedBuffer), {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch (e) {
        console.error("Decryption failed:", e);
        return new NextResponse("Decryption failed", { status: 500 });
      }
    }

    // Fallback for unencrypted images (should not happen in new logic)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Error serving anggota image:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
