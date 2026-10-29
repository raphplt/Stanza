import { createHmac } from "node:crypto";

const secret = process.env.BETTER_AUTH_SECRET ?? "stanza-dev-secret-change-in-production-min-32-chars";

export function invitationToken(invitationId: string) {
  return createHmac("sha256", secret).update(`invitation:${invitationId}`).digest("base64url");
}

export function invitationPath(invitationId: string) {
  return `/invitation/${invitationToken(invitationId)}`;
}
