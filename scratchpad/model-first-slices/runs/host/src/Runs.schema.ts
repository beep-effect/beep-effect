import { InboxTables } from "./Inbox/Inbox.table.ts";

// Runs host's Drizzle schema: every table it owns, one export each, for drizzle-kit
// (`bun run --cwd runs/host migrations`) and, later, an Alchemy `Drizzle.Schema`.

/**
 * The inbox's checkpoints, per producer.
 *
 * @category tables
 * @since 0.0.0
 */
export const runs_inbox_checkpoints = InboxTables.checkpoints;

/**
 * The inbox keys of the facts acted on.
 *
 * @category tables
 * @since 0.0.0
 */
export const runs_inbox_seen = InboxTables.seen;
