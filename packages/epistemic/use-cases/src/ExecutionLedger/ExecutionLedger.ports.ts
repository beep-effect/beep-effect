/**
 * Execution ledger port: the typed contract through which write-ahead decisions
 * and post-settlement outcomes are appended and read back. The live Drizzle
 * implementation is provided in the epistemic server tier.
 *
 * The surface is deliberately append-and-read only: there is no update, no
 * delete, and no way to express either, because the tables reject both by
 * trigger and the mutable operation would be exactly what an attacker wants.
 * Chain verification is not on the port — `verifyExecutionDecisionChain` in
 * `epistemic/domain` recomputes every seal from the rows a reader fetched, so a
 * lying adapter cannot vouch for its own chain.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type {
  ExecutionDecisionRecord,
  ExecutionOutcomeRecord,
  ExecutionRunKey,
} from "@beep/epistemic-domain/values/ExecutionRecord";
import type { Effect } from "effect";
import type { ExecutionLedgerError, ExecutionLedgerUnavailable } from "./ExecutionLedger.errors.ts";

const $I = $EpistemicUseCasesId.create("ExecutionLedger/ExecutionLedger.ports");

/**
 * Service shape for the execution ledger.
 *
 * `appendDecision` is the write-ahead half: the governed gate calls it before
 * the effect runs and converts any failure into a refusal. `appendOutcome`
 * settles an allowed decision after the effect ran; its failure cannot fail the
 * dispatch, because the effect has already happened. `readDecisions` returns a
 * run's chain in dense `seq` order so the domain verifier can be applied
 * directly. `readUnsettledAllowed` is the derived "decided, outcome unknown"
 * predicate, scoped to allowed decisions — a refused dispatch legitimately has
 * no outcome row and must never be reported as unknown.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import type { ExecutionLedgerShape } from "@beep/epistemic-use-cases/ExecutionLedger"
 *
 * const shape: ExecutionLedgerShape = {
 *   appendDecision: () => Effect.void,
 *   appendOutcome: () => Effect.void,
 *   readDecisions: () => Effect.succeed([]),
 *   readOutcomes: () => Effect.succeed([]),
 *   readUnsettledAllowed: () => Effect.succeed([])
 * }
 *
 * strictEqual(typeof shape.appendDecision, "function")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ExecutionLedgerShape {
  readonly appendDecision: (record: ExecutionDecisionRecord) => Effect.Effect<void, ExecutionLedgerError>;
  readonly appendOutcome: (record: ExecutionOutcomeRecord) => Effect.Effect<void, ExecutionLedgerError>;
  readonly readDecisions: (
    runKey: ExecutionRunKey
  ) => Effect.Effect<ReadonlyArray<ExecutionDecisionRecord>, ExecutionLedgerUnavailable>;
  readonly readOutcomes: (
    runKey: ExecutionRunKey
  ) => Effect.Effect<ReadonlyArray<ExecutionOutcomeRecord>, ExecutionLedgerUnavailable>;
  readonly readUnsettledAllowed: (
    runKey: ExecutionRunKey
  ) => Effect.Effect<ReadonlyArray<ExecutionDecisionRecord>, ExecutionLedgerUnavailable>;
}

/**
 * Execution ledger service tag.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger"
 *
 * const hasAppend = Effect.runSync(
 *   Effect.gen(function* () {
 *     const ledger = yield* ExecutionLedger
 *     return typeof ledger.appendDecision === "function"
 *   }).pipe(
 *     Effect.provideService(
 *       ExecutionLedger,
 *       ExecutionLedger.of({
 *         appendDecision: () => Effect.void,
 *         appendOutcome: () => Effect.void,
 *         readDecisions: () => Effect.succeed([]),
 *         readOutcomes: () => Effect.succeed([]),
 *         readUnsettledAllowed: () => Effect.succeed([])
 *       })
 *     )
 *   )
 * )
 *
 * strictEqual(hasAppend, true)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ExecutionLedger extends Context.Service<ExecutionLedger, ExecutionLedgerShape>()($I`ExecutionLedger`) {}
