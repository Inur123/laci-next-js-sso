import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  downloadBerkasSPFile,
  getBerkasSPById,
} from "@/app/actions/berkas-sp-actions";
import { getOriginalExtension, verifyDownloadToken } from "@/lib/encryption";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = request.nextUrl.searchParams.get("token");

    let isAuthorized = false;

    // Check Token First (for mobile/external viewers)
    if (token) {
      const verifiedId = verifyDownloadToken(token);
      if (verifiedId && verifiedId === id) {
        isAuthorized = true;
      }
    }

    // Check Session if not authorized by token
    if (!isAuthorized) {
      const session = await auth();

      if (!session?.user) {
        return new NextResponse("Unauthorized", { status: 401 });
      }

      // Role Check: Only SEKRETARIS_CABANG
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (user?.role !== "SEKRETARIS_CABANG") {
        return new NextResponse("Unauthorized", { status: 403 });
      }
      isAuthorized = true;
    }

    // Get berkas info
    const berkas = await getBerkasSPById(id);

    if (!berkas || !berkas.file) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Download and decrypt file
    const decryptedBuffer = await downloadBerkasSPFile(id);

    // Get original extension and construct new filename based on Nama
    const encryptedFilename = berkas.file.split("/").pop() || "";
    const extension = getOriginalExtension(encryptedFilename);

    // Sanitize Nama for filename
    const sanitizedNama = berkas.nama.replace(/[/\\?%*:|"<>]/g, "-");
    const downloadFilename = `${sanitizedNama}.${extension}`;

    // Map extension to content type
    const contentTypes: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };

    const contentType =
      contentTypes[extension || ""] || "application/octet-stream";
    const isPreview = request.nextUrl.searchParams.get("preview") === "true";

    // Return decrypted file
    return new NextResponse(new Uint8Array(decryptedBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${isPreview ? "inline" : "attachment"}; filename="${downloadFilename}"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
