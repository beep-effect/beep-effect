// Generated from migrations/ by `bun run --cwd runs/host migrations`. Do not edit:
// the same command rewrites it, and `bun run --cwd runs/host migrations --check` fails on drift.

/**
 * Every committed migration, in order: its statements, keyed
 * `<id>_<folder>`. `id` orders them for `effect/sql/Migrator`; the folder
 * is drizzle-kit's, under `migrations/`.
 *
 * @category migrations
 * @since 0.0.0
 */
export const RunsMigrations: Readonly<Record<string, ReadonlyArray<string>>> = {
  "1_20261118135738_init": [
    "CREATE TABLE \"runs_inbox_checkpoints\" (\n\t\"producer\" text PRIMARY KEY,\n\t\"seq\" integer NOT NULL\n);",
    "CREATE TABLE \"runs_inbox_seen\" (\n\t\"key\" text PRIMARY KEY\n);",
  ],
};
