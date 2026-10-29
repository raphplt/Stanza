"use client";

import { useEffect, useRef, useState } from "react";
import { primaryButtonClass } from "./field";

const VIEW = 256;
const OUTPUT = 512;

type Offset = { x: number; y: number };

export function AvatarCropDialog({
  file,
  pending,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; start: Offset } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (file && !dialog.open) dialog.showModal();
    if (!file && dialog.open) dialog.close();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setZoom(1);
      const base = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
      setOffset({
        x: (VIEW - img.naturalWidth * base) / 2,
        y: (VIEW - img.naturalHeight * base) / 2,
      });
    };
    img.src = url;
    setSrc(url);
    return () => {
      URL.revokeObjectURL(url);
      setImage(null);
      setSrc(null);
    };
  }, [file]);

  const scale = image ? (VIEW / Math.min(image.naturalWidth, image.naturalHeight)) * zoom : 1;

  function clamp(next: Offset, s = scale): Offset {
    if (!image) return next;
    const w = image.naturalWidth * s;
    const h = image.naturalHeight * s;
    return {
      x: Math.min(0, Math.max(VIEW - w, next.x)),
      y: Math.min(0, Math.max(VIEW - h, next.y)),
    };
  }

  function changeZoom(value: number) {
    if (!image) return;
    const base = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
    const next = base * value;
    const center = VIEW / 2;
    setZoom(value);
    setOffset(
      clamp(
        {
          x: center - ((center - offset.x) / scale) * next,
          y: center - ((center - offset.y) / scale) * next,
        },
        next,
      ),
    );
  }

  function confirm() {
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      -offset.x / scale,
      -offset.y / scale,
      VIEW / scale,
      VIEW / scale,
      0,
      0,
      OUTPUT,
      OUTPUT,
    );
    canvas.toBlob((blob) => blob && onConfirm(blob), "image/jpeg", 0.9);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-paper p-6 text-ink backdrop:bg-ink/30"
    >
      <h2 className="font-serif text-xl font-medium">Recadrer la photo</h2>
      <p className="mt-1 text-sm text-muted">Faites glisser l'image pour la positionner.</p>
      <div
        className="relative mx-auto mt-5 cursor-grab touch-none overflow-hidden rounded-full border border-line bg-surface active:cursor-grabbing"
        style={{ width: VIEW, height: VIEW }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, start: offset };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setOffset(clamp({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {src && image && (
          // biome-ignore lint/performance/noImgElement: local object URL preview
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute top-0 left-0 max-w-none select-none"
            style={{
              width: image.naturalWidth * scale,
              height: image.naturalHeight * scale,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        )}
      </div>
      <label className="mt-5 flex items-center gap-3 text-sm text-muted">
        Zoom
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => changeZoom(Number(e.target.value))}
          className="flex-1 accent-[var(--accent)]"
        />
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="tap rounded-full px-4 text-sm hover:bg-surface">
          Annuler
        </button>
        <button type="button" onClick={confirm} disabled={!image || pending} className={primaryButtonClass}>
          {pending ? "Envoi…" : "Enregistrer"}
        </button>
      </div>
    </dialog>
  );
}
