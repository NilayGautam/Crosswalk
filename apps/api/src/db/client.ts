import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

const MIGRATIONS_FOLDER = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "drizzle");

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface DatabaseHandle {
  db: Database;
  close: () => Promise<void>;
}

/**
 * Opens the embedded Postgres and brings it up to the latest migration.
 * Pass a folder to keep the data, or nothing for a throwaway database in
 * memory, which is what the tests use.
 */
export async function openDatabase(dataDir?: string): Promise<DatabaseHandle> {
  if (dataDir !== undefined) {
    mkdirSync(dataDir, { recursive: true });
  }
  const client = dataDir === undefined ? new PGlite() : new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, close: () => client.close() };
}
