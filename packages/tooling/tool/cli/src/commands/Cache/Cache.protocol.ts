/**
 * Reject inconsistent native protocol observations before retaining them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CacheClientPin } from "@beep/repo-configs/cache";
import { Effect, Match } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheProtocolObservation } from "./Cache.protocol.schemas.ts";

const sameClient = S.toEquivalence(CacheClientPin);

/**
 * Check synthetic signed-replay relationships without granting promotion authority.
 *
 * **Details**
 * Requires one producer, one replay and four distinct rejection cases. The
 * caller still owns provenance and capture verification. Freely editable
 * observations must not be passed off as protected producer receipts.
 *
 * **Example** (Check decoded protocol evidence)
 *
 * ```ts
 * import { CacheProtocolObservation, validateCacheProtocolObservation } from "@beep/repo-cli/commands/Cache"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * const validate = (input: unknown) => S.decodeUnknownEffect(CacheProtocolObservation)(input).pipe(
 *   Effect.flatMap(validateCacheProtocolObservation)
 * )
 * console.assert(typeof validate === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheProtocolObservation = Effect.fn("Cache.validateProtocolObservation")(function* (
  observation: CacheProtocolObservation
) {
  const { runs, exchanges, client } = observation;
  if (
    runs.length !== 6 ||
    exchanges.length !== 6 ||
    A.dedupe(A.map(runs, (run) => run.case)).length !== 6 ||
    A.dedupe(A.map(exchanges, (event) => event.case)).length !== 6 ||
    A.dedupe(A.map(exchanges, (event) => event.requestId)).length !== 6 ||
    A.dedupe(A.map(runs, (run) => run.summary)).length !== 6 ||
    A.dedupe(A.map(runs, (run) => run.taskHash)).length !== 1 ||
    !A.every(runs, (run) => sameClient(run.client, client))
  )
    return yield* CacheCommandError.new("Protocol observations require six distinct, same-client, same-task cases.");
  const producer = yield* A.findFirst(runs, (run) => run.case === "producer").pipe(
    Effect.fromOption(() => CacheCommandError.new("Protocol producer is missing."))
  );
  const upload = yield* A.findFirst(exchanges, (event) => event.case === "producer").pipe(
    Effect.fromOption(() => CacheCommandError.new("Protocol upload is missing."))
  );
  if (producer.outcome._tag !== "Produced" || upload.artifact.bytes === 0)
    return yield* CacheCommandError.new("Protocol producer must capture a nonempty uploaded archive.");
  const producedOutput = producer.outcome.output;
  for (const run of runs) {
    const event = yield* A.findFirst(exchanges, (candidate) => candidate.case === run.case).pipe(
      Effect.fromOption(() => CacheCommandError.new("Protocol exchange is missing."))
    );
    const isProducer = run.case === "producer";
    if (
      event.taskHash !== run.taskHash ||
      event.status !== 200 ||
      event.method !== (isProducer ? "PUT" : "GET") ||
      event.role !== (isProducer ? "writer" : "reader") ||
      event.tag !== (run.case === "missing-tag" ? "absent" : "present") ||
      event.artifact.bytes !== upload.artifact.bytes ||
      (event.artifact.sha256 === upload.artifact.sha256) !== (run.case !== "corrupt-body")
    )
      return yield* CacheCommandError.new(`Protocol ${run.case} has inconsistent wire or storage evidence.`);
    const outcomeMatches = Match.value(run.outcome).pipe(
      Match.tags({
        Produced: () => isProducer,
        Replayed: ({ output }) =>
          run.case === "replay" && output.sha256 === producedOutput.sha256 && output.bytes === producedOutput.bytes,
        Rejected: ({ exitCode, restoredOutputs }) =>
          run.case !== "producer" && run.case !== "replay" && exitCode !== 0 && restoredOutputs === 0,
      }),
      Match.exhaustive
    );
    if (!outcomeMatches)
      return yield* CacheCommandError.new(`Protocol ${run.case} has an inconsistent native outcome.`);
  }
  return observation;
});
