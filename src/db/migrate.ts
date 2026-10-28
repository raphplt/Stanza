import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  const { db } = await import("./client");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations appliquées avec succès.");
}

main().catch((err) => {
  console.error("Erreur lors des migrations :", err);
  process.exit(1);
});
