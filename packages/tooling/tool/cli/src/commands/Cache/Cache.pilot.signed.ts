/**
 * Structural and relational checks for signed real-pilot observation receipts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CacheClientPin, CacheQualificationKey } from "@beep/repo-configs/cache";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CachePilotOutcome } from "./Cache.pilot.schemas.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheSignedPilotReceipt } from "./Cache.pilot.signed.schemas.ts";

/**
 * Reject inconsistent signed pilot reports without conferring producer trust.
 *
 * **Details**
 * This checks relationships inside an observation. A separately protected
 * producer record and live contract binding remain mandatory for promotion.
 *
 * **Example** (Reference observation validation)
 * ```ts
 * import { validateCacheSignedPilotReceipt } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof validateCacheSignedPilotReceipt === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheSignedPilotReceipt = Effect.fn("CachePilot.validateSignedReceipt")(function* (
  receipt: CacheSignedPilotReceipt
) {
  const expectedKey = CacheQualificationKey.make({
    ...receipt.baseKey,
    profile: `${receipt.baseKey.profile}-private-loopback-signed-v1`,
  });
  if (!S.toEquivalence(CacheQualificationKey)(receipt.key, expectedKey))
    return yield* CacheCommandError.new("Signed pilot profile differs from its base tuple.");
  if (O.isNone(receipt.runtimeLinker))
    return yield* CacheCommandError.new("Signed pilot runtime linkage evidence is missing.");
  const pairs = receipt.pairs;
  const runs = A.flatMap(pairs, (pair) => [pair.authoritative, pair.producer, pair.replay]);
  if (
    A.dedupe(A.map(pairs, (pair) => pair.id)).length !== 3 ||
    A.dedupe(A.map(pairs, (pair) => pair.client.namespace)).length !== 3 ||
    A.dedupe(A.map(runs, (run) => run.id)).length !== 9 ||
    A.dedupe(A.map(runs, (run) => run.summarySha256)).length !== 9
  )
    return yield* CacheCommandError.new("Signed pilot pairs, namespaces, runs and summaries must be independent.");
  for (const pair of pairs) {
    if (
      !S.toEquivalence(CacheClientPin)(
        pair.client,
        CacheClientPin.make({
          ...receipt.client,
          namespace: pair.client.namespace,
        })
      )
    )
      return yield* CacheCommandError.new("Signed pair client differs from its receipt pin.");
    const authority = pair.authoritative;
    const producer = pair.producer;
    const replay = pair.replay;
    if (!CachePilotOutcome.isAnyOf(["Executed"])(authority.outcome))
      return yield* CacheCommandError.new("Signed pilot authority did not execute.");
    if (
      authority.cacheEnabled ||
      !producer.cacheEnabled ||
      !replay.cacheEnabled ||
      authority.root !== producer.root ||
      producer.root === replay.root ||
      !A.every(
        [authority, producer, replay],
        (run) =>
          run.graphExitCode === 0 &&
          run.nativeRuntimeKeyObserved &&
          run.sourceTreeUnchanged &&
          A.every(run.dependencies, (task) => task.origin === "fresh" && task.exitCode === 0)
      )
    )
      return yield* CacheCommandError.new("Signed pilot runtime, source, roots or fresh dependencies are invalid.");
    const authoritative = authority.outcome;
    const outcomes = [authoritative, producer.outcome, replay.outcome];
    if (
      authority.outcome.selected.origin !== "fresh" ||
      producer.outcome.selected.origin !== "fresh" ||
      replay.outcome.selected.origin !== "remote-hit" ||
      !A.every(
        outcomes,
        (outcome) =>
          outcome.selected.exitCode === 0 &&
          outcome.selected.computation === receipt.key.computation &&
          outcome.logSha256 === authoritative.logSha256 &&
          outcome.logBytes === authoritative.logBytes
      ) ||
      !producer.outcome.replayLogMatches ||
      !replay.outcome.replayLogMatches ||
      producer.outcome.selected.taskHash !== replay.outcome.selected.taskHash ||
      producer.outcome.selected.inputsDigest !== replay.outcome.selected.inputsDigest
    )
      return yield* CacheCommandError.new("Signed pilot lacks matching successful fresh authority and remote replay.");
    const events = pair.events;
    if (
      !A.every(
        A.map(events, (event, index) => event.sequence === index + 1 && event.scenario.fault === "none"),
        (valid) => valid
      )
    )
      return yield* CacheCommandError.new("Signed pilot wire sequence is incomplete or faulted.");
    const puts = A.filter(events, (event) => event.operation === "put");
    const gets = A.filter(events, (event) => event.operation === "get" && event.role === "reader");
    const misses = A.filter(events, (event) => event.operation === "get" && event.role === "writer");
    if (puts.length !== 1 || gets.length !== 1 || misses.length !== 1)
      return yield* CacheCommandError.new("Signed pilot requires one direct miss, upload and reader download.");
    const put = yield* A.head(puts).pipe(Effect.fromOption(() => CacheCommandError.new("Missing signed upload.")));
    const get = yield* A.head(gets).pipe(Effect.fromOption(() => CacheCommandError.new("Missing signed download.")));
    const miss = yield* A.head(misses).pipe(
      Effect.fromOption(() => CacheCommandError.new("Missing fresh cache miss."))
    );
    const hash = producer.outcome.selected.taskHash;
    if (
      put.role !== "writer" ||
      put.status !== 200 ||
      get.status !== 200 ||
      miss.status !== 404 ||
      !put.tagPresent ||
      !get.tagPresent ||
      put.bytes === 0 ||
      put.bytes !== get.bytes ||
      O.isNone(put.digest) ||
      !O.contains(put.digest.value)(get.digest) ||
      !A.every([put, get, miss], (event) => O.contains(hash)(event.artifact)) ||
      !(miss.sequence < put.sequence && put.sequence < get.sequence)
    )
      return yield* CacheCommandError.new("Signed pilot upload and download lack ordered matching signed bytes.");
  }
  return receipt;
});
