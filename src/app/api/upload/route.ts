import { NextRequest } from "next/server";
import { authenticateRequest, unauthorized } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/upload
 *
 * Upload a file (image). Requires authentication.
 * Accepts multipart/form-data with a single "file" field.
 * Saves to public/uploads/ with a UUID filename.
 * Returns { url: '/uploads/<filename>' }
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

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    // Determine file extension from MIME type
    const extMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
    };
    const ext = extMap[file.type] ?? "";
    const filename = `${uuidv4()}${ext}`;

    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(filePath, buffer);

    const url = `/uploads/${filename}`;

    return Response.json({ url, filename, size: file.size }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/upload]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
