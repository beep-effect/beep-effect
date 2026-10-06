/**
 * Docket intake server adapters: the Graph mailbox and calendar, the two
 * language-model agents, the file-backed store and the matter lookup.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Language-model paralegal and secretary agents.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./DocketIntake.agents.ts";
/**
 * Graph mailbox and calendar adapters.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./DocketIntake.graph.ts";
/**
 * Write journal, run summaries and the journaling port decorators.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./DocketIntake.journal.ts";
/**
 * Matter lookup adapter.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./DocketIntake.matters.ts";
/**
 * File-backed intake state and digest archive.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./DocketIntake.store.ts";
/**
 * Undo of one run: plan, dry-run report and apply.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./DocketIntake.undo.ts";
