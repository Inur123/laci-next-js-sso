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

    const user = await prisma.user.findUnique({
      where: { id },
      select: { image: true },
    });

    if (!user || !user.image) {
      return new NextResponse("Image not found", { status: 404 });
    }

    // 1. External URLs
    if (user.image.startsWith("http")) {
      return NextResponse.redirect(user.image);
    }

    // 2. Base64
    if (user.image.startsWith("data:")) {
      const matches = user.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const type = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    // 3. R2 Storage
    let buffer: Buffer;
    if (user.image.startsWith("/storage")) {
      return new NextResponse("Legacy image not supported", { status: 404 });
    }

    try {
      buffer = await downloadFromR2(user.image);
    } catch (err) {
      console.error("R2 Error:", err);
      return new NextResponse("Image not found in cloud", { status: 404 });
    }

    // 4. Decrypt if needed
    if (user.image.endsWith(".enc")) {
      try {
        const decryptedBuffer = decryptFile(buffer);
        const ext = getOriginalExtension(user.image);

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

    // 5. Unencrypted from R2
    let contentType = "application/octet-stream";
    if (user.image.endsWith(".png")) contentType = "image/png";
    if (user.image.endsWith(".jpg") || user.image.endsWith(".jpeg"))
      contentType = "image/jpeg";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Error serving user image:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
