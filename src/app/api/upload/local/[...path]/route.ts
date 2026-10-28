import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  if (!segments || segments.some((s) => s.includes("..") || s.includes("/"))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const baseDir = path.resolve(process.cwd(), ".local-blobs");
  const targetPath = path.resolve(baseDir, ...segments);
  if (!targetPath.startsWith(baseDir)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const data = await fs.readFile(targetPath);
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
