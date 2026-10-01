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
import { cacheSignedCaptureDiagnostic } from "./Cache.pilot.capture.ts";
import { CachePilotOutcome } from "./Cache.pilot.schemas.ts";
import { CacheSignedPilotMutation, CacheSignedPilotShadow } from "./Cache.pilot.signed.schemas.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type {
  CacheSignedPilotFreshPair,
  CacheSignedPilotPair,
  CacheSignedPilotReceipt,
} from "./Cache.pilot.signed.schemas.ts";

/**
 * Reject divergent or reused fresh execution before signed remote reuse starts.
 *
 * **Example** (Reference the fresh comparison gate)
 * ```ts
 * import { validateCacheSignedPilotFreshPair } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof validateCacheSignedPilotFreshPair === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheSignedPilotFreshPair = Effect.fn("CachePilot.validateSignedFreshPair")(function* (
  pair: CacheSignedPilotFreshPair,
  key: CacheQualificationKey
) {
  const { left, right } = pair;
  if (!CachePilotOutcome.isAnyOf(["Executed"])(left.outcome) || !CachePilotOutcome.isAnyOf(["Executed"])(right.outcome))
    return yield* CacheCommandError.new("Signed fresh pair must execute the selected computation.");
  if (
    left.id === right.id ||
    left.summarySha256 === right.summarySha256 ||
    pair.leftRoot === pair.rightRoot ||
    left.root === right.root ||
    !A.every(
      [left, right],
      (run) =>
        run.cacheEnabled &&
        run.graphExitCode === 0 &&
        run.nativeRuntimeKeyObserved &&
        run.sourceTreeUnchanged &&
        A.every(run.dependencies, (task) => task.origin === "fresh" && task.exitCode === 0)
    ) ||
    !A.every(
      [left.outcome, right.outcome],
      (outcome) =>
        outcome.selected.origin === "fresh" &&
        outcome.selected.exitCode === 0 &&
        outcome.selected.computation === key.computation &&
        outcome.replayLogMatches
    ) ||
    left.outcome.selected.taskHash !== right.outcome.selected.taskHash ||
    left.outcome.selected.inputsDigest !== right.outcome.selected.inputsDigest ||
    left.outcome.logSha256 !== right.outcome.logSha256 ||
    left.outcome.logBytes !== right.outcome.logBytes
  )
    return yield* CacheCommandError.new("Signed fresh pair lacks isolated, same-input successful fresh execution.");
  return pair;
});

/**
 * Require direct selected-task overlap among the isolated fresh comparisons.
 *
 * **Details**
 * All three pairs need positive native intervals. At least one must have a
 * strictly positive intersection; touching endpoints and parent-process overlap
 * do not count. Fresh execution and output equality are validated separately.
 *
 * **Example** (Reference the native overlap gate)
 * ```ts
 * import { validateCacheSignedPilotConcurrency } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof validateCacheSignedPilotConcurrency === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheSignedPilotConcurrency = Effect.fn("CachePilot.validateSignedConcurrency")(function* (
  pairs: ReadonlyArray<CacheSignedPilotFreshPair>
) {
  const intervals = A.map(pairs, (pair) => O.all([pair.left.selectedTaskInterval, pair.right.selectedTaskInterval]));
  if (
    pairs.length !== 3 ||
    !A.every(intervals, O.isSome) ||
    !A.every(
      A.getSomes(intervals),
      ([left, right]) => left.endTime > left.startTime && right.endTime > right.startTime
    ) ||
    !A.some(A.getSomes(intervals), ([left, right]) => left.startTime < right.endTime && right.startTime < left.endTime)
  )
    return yield* CacheCommandError.new("Signed fresh comparisons lack positive native selected-task overlap.");
});

const changesShadowHash = S.is(
  CacheSignedPilotShadow.fields.case.pick([
    "source-comment",
    "added-source",
    "readme",
    "declared-env",
    "declared-env-empty",
  ])
);

/**
 * Derive the signed shadow hash expectation from its fixed scenario.
 *
 * **Details**
 * The owned runner invokes this before starting the next shadow. Receipt
 * validation also checks the comparison's wire, output and protection facts.
 *
 * **Example** (Reference the shadow gate)
 * ```ts
 * import { validateCacheSignedPilotShadow } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof validateCacheSignedPilotShadow === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheSignedPilotShadow = Effect.fn("CachePilot.validateSignedShadow")(function* (
  shadow: CacheSignedPilotShadow,
  baseline: CacheSignedPilotPair
) {
  const changed = shadow.comparison.producer.outcome.selected.taskHash !== baseline.producer.outcome.selected.taskHash;
  if (changed !== changesShadowHash(shadow.case))
    return yield* CacheCommandError.new("Signed shadow violates its scenario-derived hash expectation.");
  return shadow;
});

const mutationSeedFails = S.is(CacheSignedPilotMutation.fields.case.pick(["root-lint-config", "dependency-source"]));
const mutationPaths = CacheSignedPilotMutation.fields.case.$match({
  "root-task-config": () => "turbo.json",
  "child-task-config": () => "packages/foundation/modeling/identity/turbo.json",
  "root-lint-config": () => "biome.jsonc",
  lockfile: () => "bun.lock",
  "package-manager": () => "package.json",
  "generated-alias": () => "tsconfig.json",
  "dependency-source": () => "packages/foundation/primitive/types/src/index.ts",
});

const validateSignedMutationSeed = Effect.fn("CachePilot.validateSignedMutation")(function* (
  mutation: CacheSignedPilotMutation,
  key: CacheQualificationKey
) {
  const seed = mutation.seed;
  const expectedExit = mutationSeedFails(mutation.case) ? 1 : 0;
  if (
    mutation.changedPath !== mutationPaths(mutation.case) ||
    mutation.beforeSha256 === mutation.afterSha256 ||
    !seed.cacheEnabled ||
    !seed.nativeRuntimeKeyObserved ||
    !seed.sourceTreeUnchanged ||
    seed.root !== mutation.comparison.producer.root ||
    seed.graphExitCode !== expectedExit ||
    seed.outcome.selected.exitCode !== expectedExit ||
    seed.outcome.selected.origin !== "fresh" ||
    seed.outcome.selected.computation !== key.computation ||
    seed.outcome.selected.taskHash === mutation.comparison.producer.outcome.selected.taskHash ||
    !seed.outcome.replayLogMatches ||
    !A.every(seed.dependencies, (task) => task.origin === "fresh" && task.exitCode === 0)
  )
    return yield* CacheCommandError.new("Signed mutation lacks its exact changed input and fresh seed verdict.");
});

const validateSignedRuntime = Effect.fn("CachePilot.validateSignedRuntime")(function* (pair: CacheSignedPilotPair) {
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
});

const validateSignedOutcomes = Effect.fn("CachePilot.validateSignedOutcomes")(function* (
  pair: CacheSignedPilotPair,
  key: CacheQualificationKey
) {
  const { authoritative: authority, producer, replay } = pair;
  if (!CachePilotOutcome.isAnyOf(["Executed"])(authority.outcome))
    return yield* CacheCommandError.new("Signed pilot authority did not execute.");
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
        outcome.selected.computation === key.computation &&
        outcome.logSha256 === authoritative.logSha256 &&
        outcome.logBytes === authoritative.logBytes
    ) ||
    !producer.outcome.replayLogMatches ||
    !replay.outcome.replayLogMatches ||
    producer.outcome.selected.taskHash !== replay.outcome.selected.taskHash ||
    producer.outcome.selected.inputsDigest !== replay.outcome.selected.inputsDigest
  )
    return yield* CacheCommandError.new("Signed pilot lacks matching successful fresh authority and remote replay.");
});

const validateSignedWire = Effect.fn("CachePilot.validateSignedWire")(function* (
  pair: CacheSignedPilotPair,
  mutation: O.Option<CacheSignedPilotMutation>
) {
  const producer = pair.producer;
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
  const expectedPuts = 1 + (O.exists(mutation, (entry) => !mutationSeedFails(entry.case)) ? 1 : 0);
  const expectedMisses = O.isSome(mutation) ? 2 : 1;
  if (
    puts.length !== expectedPuts ||
    gets.length !== 1 ||
    misses.length !== expectedMisses ||
    A.filter(events, (event) => event.operation === "get" || event.operation === "put").length !==
      puts.length + gets.length + misses.length
  )
    return yield* CacheCommandError.new("Signed pilot wire inventory differs from its baseline or seeded case.");
  const hash = producer.outcome.selected.taskHash;
  const put = yield* A.findFirst(puts, (event) => O.contains(hash)(event.artifact)).pipe(
    Effect.fromOption(() => CacheCommandError.new("Missing signed upload."))
  );
  const get = yield* A.head(gets).pipe(Effect.fromOption(() => CacheCommandError.new("Missing signed download.")));
  const miss = yield* A.findFirst(misses, (event) => O.contains(hash)(event.artifact)).pipe(
    Effect.fromOption(() => CacheCommandError.new("Missing fresh cache miss."))
  );
  if (O.isSome(mutation)) {
    const seedHash = mutation.value.seed.outcome.selected.taskHash;
    const seedMiss = yield* A.findFirst(misses, (event) => O.contains(seedHash)(event.artifact)).pipe(
      Effect.fromOption(() => CacheCommandError.new("Signed mutation seed omitted its direct cache miss."))
    );
    if (seedMiss.status !== 404 || seedMiss.sequence >= miss.sequence)
      return yield* CacheCommandError.new("Signed mutation seed was not observed before changed execution.");
    if (!mutationSeedFails(mutation.value.case)) {
      const seedPut = yield* A.findFirst(puts, (event) => O.contains(seedHash)(event.artifact)).pipe(
        Effect.fromOption(() => CacheCommandError.new("Signed mutation successful seed omitted its upload."))
      );
      if (
        seedPut.role !== "writer" ||
        seedPut.status !== 200 ||
        !seedPut.tagPresent ||
        seedPut.bytes === 0 ||
        O.isNone(seedPut.digest) ||
        !(seedMiss.sequence < seedPut.sequence && seedPut.sequence < miss.sequence)
      )
        return yield* CacheCommandError.new("Signed mutation seed upload lacks ordered authenticated bytes.");
    }
  }
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

  return put;
});

const validateSignedComparison = Effect.fn("CachePilot.validateSignedComparison")(function* (
  pair: CacheSignedPilotPair,
  key: CacheQualificationKey,
  client: CacheClientPin,
  mutation: O.Option<CacheSignedPilotMutation>
) {
  if (
    !S.toEquivalence(CacheClientPin)(
      pair.client,
      CacheClientPin.make({
        ...client,
        namespace: pair.client.namespace,
      })
    )
  )
    return yield* CacheCommandError.new("Signed pair client differs from its receipt pin.");
  yield* validateSignedRuntime(pair);
  yield* validateSignedOutcomes(pair, key);
  const put = yield* validateSignedWire(pair, mutation);
  const producer = pair.producer;
  if (
    !O.contains(pair.archive.archiveSha256)(put.digest) ||
    pair.archive.archiveBytes !== put.bytes ||
    pair.archive.logSha256 !== producer.outcome.logSha256 ||
    pair.archive.logBytes !== producer.outcome.logBytes ||
    pair.archive.archiveBytes === 0 ||
    pair.archive.archiveBytes > 1024 * 1024 ||
    pair.archive.logBytes > 64 * 1024 ||
    pair.archive.decodedBytes !== 512 + Math.ceil(pair.archive.logBytes / 512) * 512 + 1024
  )
    return yield* CacheCommandError.new(
      "Signed archive inspection is not bound to its transferred artifact and task log."
    );

  return pair;
});

/**
 * Validate one empty-store signed comparison before another case can run.
 *
 * **Example** (Reference the comparison gate)
 * ```ts
 * import { validateCacheSignedPilotPair } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof validateCacheSignedPilotPair === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheSignedPilotPair = Effect.fn("CachePilot.validateSignedPair")(function* (
  pair: CacheSignedPilotPair,
  key: CacheQualificationKey,
  client: CacheClientPin
) {
  return yield* validateSignedComparison(pair, key, client, O.none());
});

/**
 * Validate seeded invalidation, case-derived verdicts and the complete wire history.
 *
 * **Example** (Reference the seeded comparison gate)
 * ```ts
 * import { validateCacheSignedPilotMutation } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof validateCacheSignedPilotMutation === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheSignedPilotMutation = Effect.fn("CachePilot.validateSignedMutation")(function* (
  mutation: CacheSignedPilotMutation,
  key: CacheQualificationKey,
  client: CacheClientPin
) {
  yield* validateSignedMutationSeed(mutation, key);
  yield* validateSignedComparison(mutation.comparison, key, client, O.some(mutation));
  return mutation;
});

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
  if (
    A.dedupe(A.map(receipt.nonExecutions, (observation) => observation.reason)).length !== 4 ||
    !A.every(receipt.nonExecutions, (observation) => observation.id === observation.reason && observation.passed)
  )
    return yield* CacheCommandError.new("Signed pilot omits distinct, case-derived native non-execution controls.");
  const pairs = receipt.comparisons;
  const freshPairs = receipt.freshPairs;
  const freshRuns = A.flatMap(freshPairs, (pair) => [pair.left, pair.right]);
  const runs = A.appendAll(
    A.flatMap(pairs, (pair) => [pair.authoritative, pair.producer, pair.replay]),
    A.appendAll(
      freshRuns,
      A.map(receipt.mutations, (mutation) => mutation.seed)
    )
  );
  if (
    A.dedupe(A.map(receipt.mutations, (mutation) => mutation.case)).length !== 7 ||
    A.dedupe(A.map(receipt.shadows, (shadow) => shadow.case)).length !== 10 ||
    A.dedupe(A.map(pairs, (pair) => pair.id)).length !== 20 ||
    A.dedupe(A.map(freshPairs, (pair) => pair.id)).length !== 3 ||
    A.dedupe(A.map(pairs, (pair) => pair.client.namespace)).length !== 20 ||
    A.dedupe(A.map(runs, (run) => run.id)).length !== 73 ||
    A.dedupe(A.map(runs, (run) => run.summarySha256)).length !== 73
  )
    return yield* CacheCommandError.new("Signed pilot pairs, namespaces, runs and summaries must be independent.");
  if (
    A.dedupe(A.map(receipt.captureControls, (control) => control.case)).length !== 4 ||
    A.dedupe(A.map(receipt.captureControls, (control) => control.summarySha256)).length !== 4 ||
    A.some(
      receipt.captureControls,
      (control) =>
        control.diagnostic !== cacheSignedCaptureDiagnostic(control.case) ||
        A.some(runs, (run) => run.summarySha256 === control.summarySha256)
    )
  )
    return yield* CacheCommandError.new(
      "Native capture controls require distinct cases, summaries and exact rejection diagnostics."
    );
  const isolationRoots = A.appendAll(
    A.flatMap(freshPairs, (pair) => [pair.leftRoot, pair.rightRoot]),
    A.appendAll(
      A.flatMap(pairs, (pair) => [pair.authorityRoot, pair.producerRoot, pair.replayRoot]),
      A.append(
        A.map(receipt.nonExecutions, (observation) => observation.isolationRoot),
        receipt.policyRefusal.isolationRoot
      )
    )
  );
  const allRoots = A.appendAll(
    isolationRoots,
    A.map(receipt.captureControls, (control) => control.isolationRoot)
  );
  if (A.dedupe(allRoots).length !== 75)
    return yield* CacheCommandError.new("Signed comparisons reuse an isolation root.");
  if (
    A.some(receipt.nonExecutions, (observation) =>
      O.exists(observation.summarySha256, (digest) => A.some(runs, (run) => run.summarySha256 === digest))
    )
  )
    return yield* CacheCommandError.new("Non-execution evidence reused an executed task summary.");
  yield* Effect.forEach(freshPairs, (pair) => validateCacheSignedPilotFreshPair(pair, receipt.key), { discard: true });
  yield* validateCacheSignedPilotConcurrency(freshPairs);
  const baseline = yield* A.head(receipt.pairs).pipe(
    Effect.fromOption(() => CacheCommandError.new("Signed baseline comparison is missing."))
  );
  const baselineTask = baseline.producer.outcome.selected;
  if (
    receipt.policyRefusal.computation !== receipt.key.computation ||
    receipt.policyRefusal.taskHash === baselineTask.taskHash ||
    A.contains(receipt.policyRefusal.configuration.env, "BEEP_CACHE_TOOLCHAIN_DIGEST") ||
    receipt.policyRefusal.configuration.persistent ||
    receipt.policyRefusal.configuration.interactive ||
    A.some(runs, (run) => run.summarySha256 === receipt.policyRefusal.dryPlanSha256) ||
    A.some(receipt.nonExecutions, (observation) =>
      O.contains(receipt.policyRefusal.dryPlanSha256)(observation.summarySha256)
    )
  )
    return yield* CacheCommandError.new(
      "Missing-child policy refusal does not establish an independent ungoverned dry plan."
    );

  if (
    !A.every(
      receipt.pairs,
      (pair) =>
        pair.producer.outcome.selected.taskHash === baselineTask.taskHash &&
        pair.producer.outcome.selected.inputsDigest === baselineTask.inputsDigest
    )
  )
    return yield* CacheCommandError.new("Signed baseline comparisons disagree on their inputs.");
  for (const run of freshRuns) {
    if (
      !CachePilotOutcome.isAnyOf(["Executed"])(run.outcome) ||
      run.outcome.selected.taskHash !== baselineTask.taskHash ||
      run.outcome.selected.inputsDigest !== baselineTask.inputsDigest
    )
      return yield* CacheCommandError.new("Enabled fresh controls differ from the signed baseline inputs.");
  }
  yield* Effect.forEach(receipt.shadows, (shadow) => validateCacheSignedPilotShadow(shadow, baseline), {
    discard: true,
  });
  yield* Effect.forEach(
    receipt.mutations,
    (mutation) => validateCacheSignedPilotMutation(mutation, receipt.key, receipt.client),
    {
      discard: true,
    }
  );
  yield* Effect.forEach(
    A.appendAll(
      receipt.pairs,
      A.map(receipt.shadows, (shadow) => shadow.comparison)
    ),
    (pair) => validateCacheSignedPilotPair(pair, receipt.key, receipt.client),
    { discard: true }
  );

  return receipt;
});
