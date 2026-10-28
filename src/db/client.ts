import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@db.localtest.me:4444/stanza";

if (
  connectionString.includes("db.localtest.me") ||
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1")
) {
  neonConfig.fetchEndpoint = (host) => {
    const port = host.includes(":") ? host.split(":")[1] : "4444";
    return `http://127.0.0.1:${port}/sql`;
  };
}

export const sqlClient = neon(connectionString);
export const db = drizzle(sqlClient, { schema });
