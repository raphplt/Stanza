import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:55432/stanza",
  },
} satisfies Config;
