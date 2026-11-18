import { make } from "@beep/effect-drizzle";
import { $RunsHostId } from "@proto/kernel/Identity";
import { IdText, Name } from "@proto/kernel/Measure";
import * as S from "effect/Schema";

const $I = $RunsHostId.create("Inbox/Inbox.table");

/**
 * The kit the inbox's tables are declared with: process tables, so no audit
 * or version columns.
 *
 * @category kits
 * @since 0.0.0
 */
export const StoreKit = make("pg", () => ({ defaultColumns: {} }));
const { Model, pg, toPgTable } = StoreKit;

/**
 * The last position the inbox handled, per producer.
 *
 * @category models
 * @since 0.0.0
 */
export class RunsInboxCheckpoints extends Model<RunsInboxCheckpoints>($I`RunsInboxCheckpoints`)(
  {
    producer: Name.pipe(pg.text(), pg.primaryKey()),
    seq: S.Int.pipe(pg.integer()),
  },
  { description: "The last position the runs inbox handled, per producer." },
) {}

/**
 * The inbox keys of the facts the inbox acted on.
 *
 * @category models
 * @since 0.0.0
 */
export class RunsInboxSeen extends Model<RunsInboxSeen>($I`RunsInboxSeen`)(
  { key: IdText.pipe(pg.text(), pg.primaryKey()) },
  { description: "The inbox keys of the facts the runs inbox acted on." },
) {}

/**
 * The inbox's tables as Drizzle sees them.
 *
 * @category tables
 * @since 0.0.0
 */
export const InboxTables = {
  checkpoints: toPgTable(RunsInboxCheckpoints),
  seen: toPgTable(RunsInboxSeen),
};
