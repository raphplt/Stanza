import fs from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { media } from "@/db/schema";
import { generateRandomToken, uuidv7 } from "@/lib/id";
import { assertWritable, requireActionUser } from "@/lib/permissions";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

const MAX_POST_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function verifyMagicBytes(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 12) return false;
  if (mime === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mime === "image/gif") {
    return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  }
  if (mime === "image/webp") {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  if (mime === "image/avif") {
    return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const { user } = await requireActionUser();
    await assertWritable();

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = formData.get("kind") === "avatar" ? "avatar" : "post";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Format non pris en charge (JPEG, PNG, WebP, AVIF ou GIF uniquement)." },
        { status: 400 },
      );
    }

    const maxBytes = kind === "avatar" ? MAX_AVATAR_BYTES : MAX_POST_IMAGE_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error:
            kind === "avatar"
              ? "La photo de profil ne peut pas dépasser 5 Mo."
              : "L'image ne peut pas dépasser 8 Mo.",
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!verifyMagicBytes(new Uint8Array(buffer), file.type)) {
      return NextResponse.json(
        { error: "Le contenu du fichier ne correspond pas à une image valide." },
        { status: 400 },
      );
    }

    const randomName = `${generateRandomToken(16)}.${ext}`;
    const blobPath = `media/${user.id}/${randomName}`;
    let publicUrl: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const uploaded = await put(blobPath, buffer, {
        access: "public",
        contentType: file.type,
        addRandomSuffix: false,
      });
      publicUrl = uploaded.url;
    } else {
      const dir = path.join(process.cwd(), ".local-blobs", "media", user.id);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, randomName), buffer);
      publicUrl = `/api/upload/local/media/${user.id}/${randomName}`;
    }

    await db.insert(media).values({
      id: uuidv7(),
      userId: user.id,
      url: publicUrl,
      size: file.size,
    });

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'envoi du fichier.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
