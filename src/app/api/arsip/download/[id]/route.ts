import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { downloadArsipFile, getArsipSuratById } from "@/app/actions/arsip-actions";
import { getOriginalExtension, verifyDownloadToken } from "@/lib/encryption";

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
      isAuthorized = true;
    }

    // Get arsip surat info
    const arsip = await getArsipSuratById(id);

    if (!arsip || !arsip.file) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Download and decrypt file
    const decryptedBuffer = await downloadArsipFile(id);

    // Get original extension and construct new filename based on No. Surat
    const encryptedFilename = arsip.file.split("/").pop() || "";
    const extension = getOriginalExtension(encryptedFilename);

    // Sanitize No. Surat for filename (remove /, \, :, *, ?, ", <, >, |)
    const sanitizedNoSurat = arsip.noSurat.replace(/[/\\?%*:|"<>]/g, "-");
    const downloadFilename = `${sanitizedNoSurat}.${extension}`;

    // Map extension to content type
    const contentTypes: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
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
