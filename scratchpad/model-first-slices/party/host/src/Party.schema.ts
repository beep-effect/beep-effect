import { PartyDirectoryTables } from "./Directory/PartyDirectory.table.ts";

// Party host's Drizzle schema: every table it owns, one export each, for drizzle-kit
// (`bun run --cwd party/host migrations`) and, later, an Alchemy `Drizzle.Schema`.
// `PartySchema.test.ts` holds these exports to the declared tables.

/**
 * Generation 0 of the directory's rows.
 *
 * @category tables
 * @since 0.0.0
 */
export const party_directory_rows_v_0 = PartyDirectoryTables.rows[0].table;

/**
 * The directory's positions, every generation's.
 *
 * @category tables
 * @since 0.0.0
 */
export const party_directory_positions = PartyDirectoryTables.positions;

/**
 * The directory's active generation.
 *
 * @category tables
 * @since 0.0.0
 */
export const party_directory_active = PartyDirectoryTables.active;
