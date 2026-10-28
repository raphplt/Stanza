import type { JSONContent } from "@tiptap/core";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "@/lib/id";

export type AuthorLink = {
  label: string;
  url: string;
};

export type UserRole = "author" | "superadmin";
export type UserStatus = "active" | "deactivated" | "deleted";
export type UserTheme = "auto" | "light" | "dark";
export type PostStatus = "draft" | "unlisted" | "published";
export type RevisionReason = "publish" | "auto" | "restore";
export type ReactionKind = "love" | "moved" | "fire" | "wow" | "think" | "clap";
export type AccessRequestStatus = "pending" | "approved" | "rejected" | "archived";

export const user = pgTable(
  "user",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").$type<UserRole>().notNull().default("author"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    username: text("username").notNull().unique(),
    bio: text("bio").notNull().default(""),
    links: jsonb("links").$type<AuthorLink[]>().notNull().default([]),
    status: text("status").$type<UserStatus>().notNull().default("active"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    reactionsEnabled: boolean("reactions_enabled").notNull().default(true),
    commentsEnabled: boolean("comments_enabled").notNull().default(false),
    frenchTypography: boolean("french_typography").notNull().default(true),
    theme: text("theme").$type<UserTheme>().notNull().default("auto"),
    checklistDismissed: boolean("checklist_dismissed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_username_idx").on(t.username), index("user_status_idx").on(t.status)],
);

export const session = pgTable(
  "session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  key: text("key").notNull().unique(),
  count: integer("count").notNull().default(0),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const post = pgTable(
  "post",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    shareId: text("share_id").notNull().unique(),
    status: text("status").$type<PostStatus>().notNull().default("draft"),
    title: text("title").notNull().default(""),
    content: jsonb("content")
      .$type<JSONContent>()
      .notNull()
      .default({ type: "doc", content: [{ type: "paragraph" }] }),
    excerpt: text("excerpt").notNull().default(""),
    publishedTitle: text("published_title"),
    publishedContent: jsonb("published_content").$type<JSONContent | null>(),
    publishedHtml: text("published_html"),
    publishedExcerpt: text("published_excerpt"),
    ogImageUrl: text("og_image_url"),
    hasUnpublishedChanges: boolean("has_unpublished_changes").notNull().default(false),
    wordCount: integer("word_count").notNull().default(0),
    readingMinutes: integer("reading_minutes").notNull().default(1),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("post_author_slug_unique").on(t.authorId, t.slug),
    index("post_author_status_published_idx").on(t.authorId, t.status, t.publishedAt),
  ],
);

export const postRevision = pgTable(
  "post_revision",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: jsonb("content").$type<JSONContent>().notNull(),
    reason: text("reason").$type<RevisionReason>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("post_revision_post_id_idx").on(t.postId, t.createdAt)],
);

export const reaction = pgTable(
  "reaction",
  {
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ReactionKind>().notNull(),
    visitorHash: text("visitor_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.kind, t.visitorHash] }),
    index("reaction_post_id_idx").on(t.postId),
  ],
);

export const invitation = pgTable("invitation", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email"),
  note: text("note"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accessRequest = pgTable("access_request", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  status: text("status").$type<AccessRequestStatus>().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  handledAt: timestamp("handled_at", { withTimezone: true }),
});

export const passwordReset = pgTable("password_reset", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const redirectTable = pgTable("redirect", {
  fromPath: text("from_path").primaryKey(),
  toPath: text("to_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const media = pgTable(
  "media",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_user_id_idx").on(t.userId)],
);

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  siteName: text("site_name").notNull().default("Stanza"),
  tagline: text("tagline").notNull().default("Des textes, rien que des textes."),
  landingText: text("landing_text")
    .notNull()
    .default("Un espace calme où quelques auteurs invités rédigent, publient et partagent leurs textes."),
  accessRequestsOpen: boolean("access_requests_open").notNull().default(true),
  showLatestPostsOnLanding: boolean("show_latest_posts_on_landing").notNull().default(false),
  readOnlyMode: boolean("read_only_mode").notNull().default(false),
  legalNotice: text("legal_notice").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const backup = pgTable("backup", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  blobPath: text("blob_path").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  status: text("status").$type<"success" | "failed">().notNull(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
