"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getStanzaCoreExtensions } from "@/lib/editor-extensions";
import { foldForSearch } from "@/lib/slug";
import { type ImageDetails, ImageDialog, LinkDialog } from "./editor-dialogs";

type SlashItem = {
  label: string;
  keywords: string;
  run: (editor: Editor) => void;
};

type SlashState = { query: string; from: number; to: number; left: number; top: number };

type PendingImage = { src: string; pos: number | null } | null;

async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("kind", "post");
  const res = await fetch("/api/upload", { method: "POST", body });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Envoi impossible.");
  return data.url;
}

function readSlash(editor: Editor): SlashState | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if ($from.depth !== 1 || $from.parent.type.name !== "paragraph") return null;
  const text = $from.parent.textContent;
  if (!/^\/[\p{L}\d]*$/u.test(text) || $from.parentOffset !== text.length) return null;
  const from = $from.start();
  const coords = editor.view.coordsAtPos(from);
  return { query: text.slice(1), from, to: $from.end(), left: coords.left, top: coords.bottom };
}

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    setCoarse(media.matches);
    const onChange = () => setCoarse(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return coarse;
}

function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return offset;
}

export function RichEditor({
  initialContent,
  onChange,
  onReady,
  onTyping,
}: {
  initialContent: JSONContent;
  onChange: (content: JSONContent) => void;
  onReady: (editor: Editor) => void;
  onTyping: () => void;
}) {
  const coarse = useCoarsePointer();
  const keyboardOffset = useKeyboardOffset();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const insertPosRef = useRef<number | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashRef = useRef<{ state: SlashState | null; items: SlashItem[]; index: number }>({
    state: null,
    items: [],
    index: 0,
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage>(null);
  const [editingImage, setEditingImage] = useState<ImageDetails | null>(null);
  const [focused, setFocused] = useState(false);
  const callbacks = useRef({ onChange, onTyping, openLink: () => setLinkOpen(true), upload: handleFiles });
  callbacks.current = { onChange, onTyping, openLink: () => setLinkOpen(true), upload: handleFiles };

  const slashItems: SlashItem[] = [
    {
      label: "Intertitre",
      keywords: "titre h2",
      run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Sous-intertitre",
      keywords: "titre h3",
      run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Petit intertitre",
      keywords: "titre h4",
      run: (e) => e.chain().focus().toggleHeading({ level: 4 }).run(),
    },
    { label: "Citation", keywords: "quote", run: (e) => e.chain().focus().toggleBlockquote().run() },
    { label: "Liste à puces", keywords: "puces", run: (e) => e.chain().focus().toggleBulletList().run() },
    {
      label: "Liste numérotée",
      keywords: "numeros",
      run: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Image",
      keywords: "photo illustration",
      run: (e) => {
        insertPosRef.current = e.state.selection.from;
        fileInputRef.current?.click();
      },
    },
    {
      label: "Séparateur",
      keywords: "ornement strophe scene",
      run: (e) => e.chain().focus().setHorizontalRule().run(),
    },
  ];
  const filteredSlash = slash
    ? slashItems.filter((item) =>
        foldForSearch(`${item.label} ${item.keywords}`).includes(foldForSearch(slash.query)),
      )
    : [];
  slashRef.current = { state: slash, items: filteredSlash, index: slashIndex };

  function runSlash(editor: Editor, item: SlashItem) {
    const state = slashRef.current.state;
    if (!state) return;
    editor.chain().focus().deleteRange({ from: state.from, to: state.to }).run();
    setSlash(null);
    item.run(editor);
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...getStanzaCoreExtensions(), Placeholder.configure({ placeholder: "Commence à écrire…" })],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "prose-stanza mx-auto min-h-[50vh] focus:outline-none",
        "aria-label": "Contenu du texte",
        spellcheck: "true",
      },
      handleKeyDown: (view, event) => {
        callbacks.current.onTyping();
        const { state, items, index } = slashRef.current;
        if (state && items.length > 0) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            const delta = event.key === "ArrowDown" ? 1 : -1;
            setSlashIndex((index + delta + items.length) % items.length);
            return true;
          }
          if (event.key === "Enter") {
            const item = items[index];
            if (item && editorRef.current) runSlash(editorRef.current, item);
            return true;
          }
          if (event.key === "Escape") {
            setSlash(null);
            return true;
          }
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          if (view.state.selection.empty && !editorRef.current?.isActive("link")) {
            toast("Sélectionnez d'abord le texte à lier.");
            return true;
          }
          callbacks.current.openLink();
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        callbacks.current.upload(files, view.state.selection.from);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null;
        callbacks.current.upload(files, pos);
        return true;
      },
    },
    onCreate: ({ editor }) => onReady(editor),
    onUpdate: ({ editor }) => {
      callbacks.current.onChange(editor.getJSON());
      setSlash(readSlash(editor));
      setSlashIndex(0);
    },
    onSelectionUpdate: ({ editor }) => setSlash(readSlash(editor)),
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      setSlash(null);
    },
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            strike: e.isActive("strike"),
            link: e.isActive("link"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            quote: e.isActive("blockquote"),
            bulletList: e.isActive("bulletList"),
            image: e.isActive("image"),
            href: (e.getAttributes("link").href as string | undefined) ?? "",
          }
        : null,
  });

  async function handleFiles(files: File[], pos: number | null) {
    const file = files[0];
    if (!file) return;
    const id = toast.loading("Envoi de l'image…");
    try {
      const src = await uploadImage(file);
      toast.dismiss(id);
      setPendingImage({ src, pos });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.", { id });
    }
  }

  function insertImage({ alt, caption }: ImageDetails) {
    if (!editor || !pendingImage) return;
    const node = { type: "image", attrs: { src: pendingImage.src, alt, caption: caption || null } };
    const chain = editor.chain().focus();
    if (pendingImage.pos !== null) chain.insertContentAt(pendingImage.pos, node).run();
    else chain.insertContent(node).run();
    setPendingImage(null);
  }

  function openImageDetails() {
    if (!editor) return;
    const attrs = editor.getAttributes("image");
    setEditingImage({ alt: attrs.alt ?? "", caption: attrs.caption ?? "" });
  }

  function applyLink(href: string) {
    setLinkOpen(false);
    if (!editor) return;
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
  }

  if (!editor || !active) {
    return <div className="prose-stanza mx-auto min-h-[50vh]" aria-hidden="true" />;
  }

  const markButtons = [
    {
      label: "Gras",
      short: "G",
      on: active.bold,
      run: () => editor.chain().focus().toggleBold().run(),
      cls: "font-bold",
    },
    {
      label: "Italique",
      short: "I",
      on: active.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
      cls: "italic font-serif",
    },
    {
      label: "Barré",
      short: "S",
      on: active.strike,
      run: () => editor.chain().focus().toggleStrike().run(),
      cls: "line-through",
    },
    { label: "Lien", short: "Lien", on: active.link, run: () => setLinkOpen(true), cls: "" },
    {
      label: "Intertitre",
      short: "H2",
      on: active.h2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      cls: "",
    },
    {
      label: "Sous-intertitre",
      short: "H3",
      on: active.h3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      cls: "",
    },
    {
      label: "Citation",
      short: "“",
      on: active.quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
      cls: "font-serif text-lg",
    },
  ];

  const toolbarButtons = [
    ...markButtons.filter((b) => b.label !== "Sous-intertitre"),
    {
      label: "Liste",
      short: "•",
      on: active.bulletList,
      run: () => editor.chain().focus().toggleBulletList().run(),
      cls: "text-lg",
    },
    {
      label: "Image",
      short: "Img",
      on: false,
      run: () => {
        insertPosRef.current = editor.state.selection.from;
        fileInputRef.current?.click();
      },
      cls: "",
    },
    {
      label: "Séparateur",
      short: "⁂",
      on: false,
      run: () => editor.chain().focus().setHorizontalRule().run(),
      cls: "",
    },
    {
      label: "Annuler",
      short: "↶",
      on: false,
      run: () => editor.chain().focus().undo().run(),
      cls: "text-lg",
    },
  ];

  return (
    <>
      <EditorContent editor={editor} />

      {!coarse && (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top", offset: 8 }}
          className="flex items-center gap-0.5 rounded-xl border border-line bg-paper p-1 shadow-sm"
        >
          {active.image ? (
            <button
              type="button"
              onClick={openImageDetails}
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-surface"
            >
              Texte alternatif et légende
            </button>
          ) : (
            markButtons.map((b) => (
              <button
                key={b.label}
                type="button"
                aria-label={b.label}
                aria-pressed={b.on}
                title={b.label}
                onClick={b.run}
                className={`min-w-9 rounded-lg px-2 py-1.5 text-sm transition-colors ${b.cls} ${
                  b.on ? "bg-ink text-paper" : "hover:bg-surface"
                }`}
              >
                {b.short}
              </button>
            ))
          )}
        </BubbleMenu>
      )}

      {slash && filteredSlash.length > 0 && (
        <div
          role="listbox"
          aria-label="Insérer"
          style={{ left: slash.left, top: slash.top + 6 }}
          className="fixed z-40 w-56 rounded-xl border border-line bg-paper py-1.5 shadow-sm"
        >
          {filteredSlash.map((item, i) => (
            <button
              key={item.label}
              type="button"
              role="option"
              aria-selected={i === slashIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                runSlash(editor, item);
              }}
              className={`flex w-full px-3.5 py-2 text-left text-sm ${i === slashIndex ? "bg-surface" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {coarse && focused && (
        <div
          role="toolbar"
          aria-label="Mise en forme"
          style={{ bottom: keyboardOffset }}
          className="fixed inset-x-0 z-40 flex gap-1 overflow-x-auto border-t border-line bg-paper/95 px-2 py-1.5 backdrop-blur"
        >
          {active.image ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openImageDetails}
              className="tap shrink-0 rounded-lg px-3 text-sm"
            >
              Texte alternatif et légende
            </button>
          ) : (
            toolbarButtons.map((b) => (
              <button
                key={b.label}
                type="button"
                aria-label={b.label}
                aria-pressed={b.on}
                onMouseDown={(e) => e.preventDefault()}
                onClick={b.run}
                className={`tap shrink-0 rounded-lg px-2 text-sm ${b.cls} ${b.on ? "bg-ink text-paper" : ""}`}
              >
                {b.short}
              </button>
            ))
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          handleFiles(files, insertPosRef.current);
        }}
      />

      <LinkDialog
        open={linkOpen}
        initialHref={active.href}
        onSubmit={applyLink}
        onClose={() => {
          setLinkOpen(false);
          editor.commands.focus();
        }}
      />

      <ImageDialog
        open={pendingImage !== null}
        src={pendingImage?.src ?? null}
        initial={{ alt: "", caption: "" }}
        submitLabel="Insérer"
        onSubmit={insertImage}
        onClose={() => setPendingImage(null)}
      />

      <ImageDialog
        open={editingImage !== null}
        src={null}
        initial={editingImage ?? { alt: "", caption: "" }}
        submitLabel="Enregistrer"
        onSubmit={({ alt, caption }) => {
          editor
            .chain()
            .focus()
            .updateAttributes("image", { alt, caption: caption || null })
            .run();
          setEditingImage(null);
        }}
        onClose={() => setEditingImage(null)}
      />
    </>
  );
}
