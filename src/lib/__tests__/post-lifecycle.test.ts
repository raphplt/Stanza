import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import {
  applyDiscardUnpublishedChanges,
  applyDraftEdit,
  applyPublishOrUpdate,
  applyRestoreFromTrash,
} from "@/lib/post-lifecycle";

const content = (text: string): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const draft = {
  status: "draft" as const,
  title: "Brouillon",
  content: content("premier jet"),
  excerpt: "",
  ogImageUrl: null,
  publishedTitle: null,
  publishedContent: null,
  publishedExcerpt: null,
  publishedAt: null,
  version: 3,
};

describe("post lifecycle", () => {
  it("never flags unpublished changes on a draft", () => {
    const patch = applyDraftEdit(draft, { title: "Nouveau", content: content("texte") });
    expect(patch.hasUnpublishedChanges).toBe(false);
    expect(patch.version).toBe(4);
  });

  it("publishes the working version and fixes the first publication date", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    const patch = applyPublishOrUpdate(draft, {
      targetStatus: "published",
      slug: "brouillon",
      frenchTypography: true,
      now,
    });
    expect(patch.status).toBe("published");
    expect(patch.publishedTitle).toBe("Brouillon");
    expect(patch.publishedHtml).toBe("<p>premier jet</p>");
    expect(patch.publishedExcerpt).toBe("premier jet");
    expect(patch.publishedAt).toBe(now);

    const later = applyPublishOrUpdate(
      { ...draft, publishedAt: now },
      { targetStatus: "unlisted", slug: "brouillon", frenchTypography: true, now: new Date("2027-01-01") },
    );
    expect(later.publishedAt).toBe(now);
  });

  it("applies French typography to the published excerpt only", () => {
    const patch = applyPublishOrUpdate(
      { ...draft, excerpt: "Vraiment?" },
      { targetStatus: "published", slug: "brouillon", frenchTypography: true },
    );
    expect(patch.excerpt).toBe("Vraiment?");
    expect(patch.publishedExcerpt).toBe("Vraiment\u00A0?");
  });

  it("keeps edits of a live text out of the online version", () => {
    const live = {
      ...draft,
      status: "published" as const,
      publishedTitle: "Brouillon",
      publishedContent: content("premier jet"),
    };
    expect(
      applyDraftEdit(live, { title: "Brouillon", content: content("premier jet") }).hasUnpublishedChanges,
    ).toBe(false);
    const edited = applyDraftEdit(live, { title: "Brouillon", content: content("second jet") });
    expect(edited.hasUnpublishedChanges).toBe(true);
    expect(edited).not.toHaveProperty("publishedContent");
  });

  it("ignores key order differences coming back from jsonb", () => {
    const live = {
      ...draft,
      status: "published" as const,
      publishedTitle: "Brouillon",
      publishedContent: {
        content: [{ content: [{ text: "jet", type: "text" }], type: "paragraph" }],
        type: "doc",
      },
    };
    expect(applyDraftEdit(live, { title: "Brouillon", content: content("jet") }).hasUnpublishedChanges).toBe(
      false,
    );
  });

  it("discards unpublished changes back to the online version", () => {
    const patch = applyDiscardUnpublishedChanges({
      ...draft,
      title: "Modifié",
      content: content("modifié"),
      publishedTitle: "En ligne",
      publishedContent: content("en ligne"),
      publishedExcerpt: "Extrait",
    });
    expect(patch.title).toBe("En ligne");
    expect(patch.content).toEqual(content("en ligne"));
    expect(patch.hasUnpublishedChanges).toBe(false);
  });

  it("restores a trashed text as a draft", () => {
    expect(applyRestoreFromTrash(draft)).toMatchObject({ status: "draft", deletedAt: null });
  });
});
