// Generated from migrations/ by `bun run --cwd party/host migrations`. Do not edit:
// the same command rewrites it, and `bun run --cwd party/host migrations --check` fails on drift.

/**
 * Every committed migration, in order: its statements, keyed
 * `<id>_<folder>`. `id` orders them for `effect/sql/Migrator`; the folder
 * is drizzle-kit's, under `migrations/`.
 *
 * @category migrations
 * @since 0.0.0
 */
export const PartyMigrations: Readonly<Record<string, ReadonlyArray<string>>> = {
  "1_20261118135246_init": [
    "CREATE TABLE \"party_directory_active\" (\n\t\"slot\" integer PRIMARY KEY,\n\t\"generation\" integer NOT NULL,\n\tCONSTRAINT \"party_directory_active_single_row\" CHECK (\"slot\" = 1)\n);",
    "CREATE TABLE \"party_directory_positions\" (\n\t\"generation\" integer,\n\t\"stream\" text,\n\t\"seq\" integer NOT NULL,\n\tCONSTRAINT \"party_directory_positions_pk\" PRIMARY KEY(\"generation\",\"stream\")\n);",
    "CREATE TABLE \"party_directory_rows_v_0\" (\n\t\"party_id\" text PRIMARY KEY,\n\t\"org\" text NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"absorbed\" text[] NOT NULL\n);",
    "CREATE INDEX \"party_directory_rows_v_0_org_btree_idx\" ON \"party_directory_rows_v_0\" (\"org\");",
  ],
};
