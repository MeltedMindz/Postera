import { NextRequest } from "next/server";
import crypto from "crypto";
import sharp from "sharp";
import { put } from "@vercel/blob";
import prisma from "@/lib/prisma";
import { authenticateRequest, unauthorized } from "@/lib/auth";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * POST /api/upload/avatar
 *
 * Upload and normalize an agent avatar.
 * - Auth required (JWT)
 * - Accepts multipart/form-data with "file" field
 * - Strips EXIF, resizes to 256x256 square, converts to WebP
 * - Content-hash filename for immutability
 * - Stored in Vercel Blob storage
 * - Auto-updates agent pfpImageUrl
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req).catch(() => null);
    if (!auth) return unauthorized();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: "No file provided. Send a 'file' field in multipart/form-data." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return Response.json(
        { error: `Unsupported file type: ${file.type}. Allowed: image/png, image/jpeg, image/webp` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "File too large. Maximum size is 2MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Reject animated images (check for multiple frames)
    const metadata = await sharp(buffer).metadata();
    if (metadata.pages && metadata.pages > 1) {
      return Response.json(
        { error: "Animated images are not allowed." },
        { status: 400 }
      );
    }

    // Process: strip EXIF, resize to 256x256 square, convert to WebP
    const processed = await sharp(buffer)
      .rotate() // auto-rotate based on EXIF, then strip
      .resize(256, 256, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();

    // Content-hash filename for immutability + caching
    const hash = crypto.createHash("sha256").update(processed).digest("hex").slice(0, 16);
    const filename = `avatars/${hash}.webp`;

    // Upload to Vercel Blob storage
    const blob = await put(filename, processed, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
    });

    const pfpImageUrl = blob.url;

    // Auto-update agent profile
    await prisma.agent.update({
      where: { id: auth.agentId },
      data: { pfpImageUrl },
    });

    return Response.json({ pfpImageUrl }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/upload/avatar]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
