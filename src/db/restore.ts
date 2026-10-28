import fs from "node:fs";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: pnpm db:restore <fichier.json[.gz]>");
    process.exit(1);
  }
  const bytes = new Uint8Array(fs.readFileSync(filePath));
  const { parseDumpBuffer, restoreDatabaseDump } = await import("./backup");
  const dump = parseDumpBuffer(bytes);
  await restoreDatabaseDump(dump);
  console.log(`Base restaurée avec succès depuis ${filePath} (export du ${dump.exportedAt}).`);
}

main().catch((err) => {
  console.error("Erreur lors de la restauration :", err);
  process.exit(1);
});
