/**
 * Fails when the drizzle-kit schema surface (`src/schema.ts`) has changed
 * without a committed migration: copies `drizzle/` to a scratch dir, runs
 * `drizzle-kit generate` against it, and errors if a new migration folder
 * appears. Non-destructive — the real `drizzle/` folder is never written.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Data, HashSet } from "effect";

class MigrationsDriftError extends Data.TaggedError("MigrationsDriftError")<{
  readonly message: string;
  readonly newFolders: ReadonlyArray<string>;
}> {}

const packageRoot = join(import.meta.dirname, "..");
const drizzleFolder = join(packageRoot, "drizzle");
const scratch = mkdtempSync(join(tmpdir(), "db-admin-migrations-drift-"));

try {
  cpSync(drizzleFolder, scratch, { recursive: true });
  const before = HashSet.fromIterable(readdirSync(scratch));

  await $`bunx --bun drizzle-kit generate --dialect postgresql --schema ./src/schema.ts --out ${scratch} --name drift_check`
    .cwd(packageRoot)
    .quiet();

  const newFolders = readdirSync(scratch).filter((entry) => !HashSet.has(before, entry));
  if (newFolders.length > 0) {
    for (const folder of newFolders) {
      // build-script stdout, not application logging
      // @effect-diagnostics-next-line globalConsole:off
      console.error(`--- pending migration ${folder} ---`);
      // @effect-diagnostics-next-line globalConsole:off
      console.error(readFileSync(join(scratch, folder, "migration.sql"), "utf8"));
    }
    throw new MigrationsDriftError({
      message:
        "db-admin schema changed without a migration. Run `bun run generate -- --name <slug>` in packages/_internal/db-admin, review the SQL, and commit the new drizzle folder.",
      newFolders,
    });
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
