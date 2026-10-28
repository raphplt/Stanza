import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { uuidv7 } from "@/lib/id";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "stanza-dev-secret-change-in-production-min-32-chars",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    storage: "database",
    modelName: "rateLimit",
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: true,
      },
      bio: {
        type: "string",
        required: false,
        defaultValue: "",
      },
      links: {
        type: "json",
        required: false,
        defaultValue: [],
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "active",
      },
      deletedAt: {
        type: "date",
        required: false,
      },
      reactionsEnabled: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      commentsEnabled: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      frenchTypography: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      theme: {
        type: "string",
        required: false,
        defaultValue: "auto",
      },
      checklistDismissed: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
  },
  advanced: {
    database: {
      generateId: () => uuidv7(),
    },
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
  plugins: [
    admin({
      defaultRole: "author",
      adminRoles: ["superadmin"],
      roles: {
        superadmin: adminAc,
        author: userAc,
      },
    }),
    nextCookies(),
  ],
});
