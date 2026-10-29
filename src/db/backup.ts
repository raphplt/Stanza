import { gunzipSync, gzipSync, strFromU8, strToU8 } from "fflate";
import { db } from "./client";
import {
  accessRequest,
  account,
  backup,
  invitation,
  media,
  passwordReset,
  post,
  postRevision,
  postView,
  rateLimit,
  reaction,
  redirectTable,
  session,
  siteSettings,
  user,
  verification,
} from "./schema";

export type DatabaseDump = {
  version: 1;
  exportedAt: string;
  tables: {
    siteSettings: (typeof siteSettings.$inferSelect)[];
    user: (typeof user.$inferSelect)[];
    account: (typeof account.$inferSelect)[];
    session: (typeof session.$inferSelect)[];
    verification: (typeof verification.$inferSelect)[];
    rateLimit: (typeof rateLimit.$inferSelect)[];
    post: (typeof post.$inferSelect)[];
    postRevision: (typeof postRevision.$inferSelect)[];
    reaction: (typeof reaction.$inferSelect)[];
    postView?: (typeof postView.$inferSelect)[];
    invitation: (typeof invitation.$inferSelect)[];
    accessRequest: (typeof accessRequest.$inferSelect)[];
    passwordReset: (typeof passwordReset.$inferSelect)[];
    redirect: (typeof redirectTable.$inferSelect)[];
    media: (typeof media.$inferSelect)[];
    backup: (typeof backup.$inferSelect)[];
  };
};

export async function exportDatabaseDump(): Promise<DatabaseDump> {
  const [
    settingsRows,
    userRows,
    accountRows,
    sessionRows,
    verificationRows,
    rateLimitRows,
    postRows,
    postRevisionRows,
    reactionRows,
    postViewRows,
    invitationRows,
    accessRequestRows,
    passwordResetRows,
    redirectRows,
    mediaRows,
    backupRows,
  ] = await Promise.all([
    db.select().from(siteSettings),
    db.select().from(user),
    db.select().from(account),
    db.select().from(session),
    db.select().from(verification),
    db.select().from(rateLimit),
    db.select().from(post),
    db.select().from(postRevision),
    db.select().from(reaction),
    db.select().from(postView),
    db.select().from(invitation),
    db.select().from(accessRequest),
    db.select().from(passwordReset),
    db.select().from(redirectTable),
    db.select().from(media),
    db.select().from(backup),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      siteSettings: settingsRows,
      user: userRows,
      account: accountRows,
      session: sessionRows,
      verification: verificationRows,
      rateLimit: rateLimitRows,
      post: postRows,
      postRevision: postRevisionRows,
      reaction: reactionRows,
      postView: postViewRows,
      invitation: invitationRows,
      accessRequest: accessRequestRows,
      passwordReset: passwordResetRows,
      redirect: redirectRows,
      media: mediaRows,
      backup: backupRows,
    },
  };
}

export async function exportDatabaseGzip(): Promise<Uint8Array> {
  const dump = await exportDatabaseDump();
  const json = JSON.stringify(dump);
  return gzipSync(strToU8(json));
}

const DATE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "deletedAt",
  "expiresAt",
  "banExpires",
  "accessTokenExpiresAt",
  "refreshTokenExpiresAt",
  "publishedAt",
  "lastPublishedAt",
  "pinnedAt",
  "usedAt",
  "revokedAt",
  "handledAt",
]);

function reviveRowDates<T extends Record<string, unknown>>(row: T): T {
  const copy: Record<string, unknown> = { ...row };
  for (const key of Object.keys(copy)) {
    const val = copy[key];
    if (DATE_KEYS.has(key) && typeof val === "string") {
      copy[key] = new Date(val);
    }
  }
  return copy as T;
}

export function parseDumpBuffer(bytes: Uint8Array): DatabaseDump {
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const raw = isGzip ? gunzipSync(bytes) : bytes;
  const text = strFromU8(raw);
  return JSON.parse(text) as DatabaseDump;
}

export async function restoreDatabaseDump(dump: DatabaseDump): Promise<void> {
  await db.delete(reaction);
  await db.delete(postView);
  await db.delete(postRevision);
  await db.delete(post);
  await db.delete(invitation);
  await db.delete(passwordReset);
  await db.delete(media);
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(rateLimit);
  await db.delete(accessRequest);
  await db.delete(redirectTable);
  await db.delete(backup);
  await db.delete(user);
  await db.delete(siteSettings);

  const t = dump.tables;
  if (t.siteSettings?.length) {
    await db.insert(siteSettings).values(t.siteSettings.map(reviveRowDates));
  }
  if (t.user?.length) {
    await db.insert(user).values(t.user.map(reviveRowDates));
  }
  if (t.account?.length) {
    await db.insert(account).values(t.account.map(reviveRowDates));
  }
  if (t.session?.length) {
    await db.insert(session).values(t.session.map(reviveRowDates));
  }
  if (t.verification?.length) {
    await db.insert(verification).values(t.verification.map(reviveRowDates));
  }
  if (t.rateLimit?.length) {
    await db.insert(rateLimit).values(t.rateLimit);
  }
  if (t.post?.length) {
    await db.insert(post).values(t.post.map(reviveRowDates));
  }
  if (t.postRevision?.length) {
    await db.insert(postRevision).values(t.postRevision.map(reviveRowDates));
  }
  if (t.reaction?.length) {
    await db.insert(reaction).values(t.reaction.map(reviveRowDates));
  }
  if (t.postView?.length) {
    await db.insert(postView).values(t.postView.map(reviveRowDates));
  }
  if (t.invitation?.length) {
    await db.insert(invitation).values(t.invitation.map(reviveRowDates));
  }
  if (t.accessRequest?.length) {
    await db.insert(accessRequest).values(t.accessRequest.map(reviveRowDates));
  }
  if (t.passwordReset?.length) {
    await db.insert(passwordReset).values(t.passwordReset.map(reviveRowDates));
  }
  if (t.redirect?.length) {
    await db.insert(redirectTable).values(t.redirect.map(reviveRowDates));
  }
  if (t.media?.length) {
    await db.insert(media).values(t.media.map(reviveRowDates));
  }
  if (t.backup?.length) {
    await db.insert(backup).values(t.backup.map(reviveRowDates));
  }
}
