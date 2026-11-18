import { make } from "@beep/effect-drizzle";
import { $PartyHostId } from "@proto/kernel/Identity";
import { DirectoryRow } from "@proto/party-contract/Directory/FindParties.read";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import type { PartyDirectoryGeneration } from "@proto/party-model/Directory/PartyDirectory.handler";
import { sql } from "drizzle-orm";
import * as S from "effect/Schema";

const $I = $PartyHostId.create("Directory/PartyDirectory.table");

/**
 * The kit the directory's tables are declared with. A projection's tables are
 * rebuilt from history and never the system of record, so they carry no
 * audit or version columns.
 *
 * @category kits
 * @since 0.0.0
 */
export const StoreKit = make("pg", () => ({ defaultColumns: {} }));
const { Model, pg, toPgTable } = StoreKit;

/**
 * A directory row's columns, field for field the contract's `DirectoryRow`:
 * the row's meaning stays in the contract, and this adds only where it is
 * stored. Every generation's row table has these columns until a shape
 * change, which is a new generation.
 *
 * @category models
 * @since 0.0.0
 */
export const PartyDirectoryRowFields = {
  partyId: DirectoryRow.fields.partyId.pipe(pg.text(), pg.primaryKey()),
  org: DirectoryRow.fields.org.pipe(pg.text(), pg.index()),
  name: DirectoryRow.fields.name.pipe(pg.text()),
  absorbed: DirectoryRow.fields.absorbed.pipe(pg.array(PartyId.pipe(pg.text()))),
};

/**
 * Generation 0 of the directory's rows, in table `party_directory_rows_v_0`.
 *
 * @category models
 * @since 0.0.0
 */
export class PartyDirectoryRowsV0 extends Model<PartyDirectoryRowsV0>($I`PartyDirectoryRowsV0`)(PartyDirectoryRowFields, {
  description: "The party directory's rows, generation 0.",
}) {}

/**
 * Any generation's row model: one class per generation, all with
 * {@link PartyDirectoryRowFields}.
 *
 * @category models
 * @since 0.0.0
 */
export type PartyDirectoryRowModel = typeof PartyDirectoryRowsV0;

/**
 * One generation's rows: the model that decodes them and the table that
 * holds them.
 *
 * **Example** (A generation's table)
 * ```ts
 * import { generationOf, PartyDirectoryRowsV0 } from "@proto/party-host/Directory/PartyDirectory.table";
 *
 * const zero = generationOf(PartyDirectoryRowsV0);
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const generationOf = (model: PartyDirectoryRowModel) => ({ model, table: toPgTable(model) });

/**
 * One generation's rows, as {@link generationOf} gives them.
 *
 * @category models
 * @since 0.0.0
 */
export type PartyDirectoryRowGeneration = ReturnType<typeof generationOf>;

/**
 * The row tables this deploy keeps, by generation. It must hold the
 * generation the build writes (`PartyDirectoryGeneration`); during a rebuild
 * it holds the active one beside it, until the switch.
 *
 * **Details**
 *
 * To rebuild the directory: bump `PartyDirectoryGeneration`, declare the next
 * `PartyDirectoryRowsV<n>` with the same fields (or the new shape), add it
 * here and to `Party.schema.ts`, and generate a migration
 * (`bun run --cwd party/host migrations`). Once the switch has happened in
 * every environment, remove the old generation from both and generate the
 * migration that drops its table.
 *
 * @category tables
 * @since 0.0.0
 */
export const PartyDirectoryRowTables = { 0: generationOf(PartyDirectoryRowsV0) } satisfies Readonly<
  Record<typeof PartyDirectoryGeneration, PartyDirectoryRowGeneration> & Record<number, PartyDirectoryRowGeneration>
>;

/**
 * The last position a generation applied, per source stream: the store's
 * own checkpoints (D14, D16). One table for every generation, keyed by
 * generation and stream; its row is locked while a batch for that stream is
 * applied, so two runners applying one stream serialise.
 *
 * @category models
 * @since 0.0.0
 */
export class PartyDirectoryPositions extends Model<PartyDirectoryPositions>($I`PartyDirectoryPositions`)(
  {
    generation: S.Int.pipe(pg.integer()),
    stream: S.String.pipe(pg.text()),
    seq: S.Int.pipe(pg.integer()),
  },
  { description: "The last position each directory generation applied, per source stream." },
  (columns) => [pg.Table.compositePrimaryKey("party_directory_positions_pk", [columns.generation, columns.stream])],
) {}

/**
 * Which generation queries read: one row, written by the first generation
 * to apply and moved by the switch at the end of a rebuild.
 *
 * @category models
 * @since 0.0.0
 */
export class PartyDirectoryActive extends Model<PartyDirectoryActive>($I`PartyDirectoryActive`)(
  {
    slot: S.tag(1).pipe(pg.integer(), pg.primaryKey()),
    generation: S.Int.pipe(pg.integer()),
  },
  { description: "The directory generation queries read; a single row." },
  (columns) => [pg.Table.check(sql<boolean>`${columns.slot} = 1`, "party_directory_active_single_row")],
) {}

/**
 * The directory's tables as Drizzle sees them: each kept generation's rows,
 * the positions and the active pointer.
 *
 * @category tables
 * @since 0.0.0
 */
export const PartyDirectoryTables = {
  rows: PartyDirectoryRowTables,
  positions: toPgTable(PartyDirectoryPositions),
  active: toPgTable(PartyDirectoryActive),
};
