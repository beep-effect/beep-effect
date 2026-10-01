/**
 * Reject inconsistent native protocol observations before retaining them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CacheClientPin } from "@beep/repo-configs/cache";
import { LiteralKit } from "@beep/schema";
import { Effect, Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { CacheFixtureEvent } from "./Cache.protocol.fixture.schemas.ts";
import { CacheProtocolReadFailure } from "./Cache.protocol.runner.schemas.ts";
import { CacheProtocolObservation } from "./Cache.protocol.schemas.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheProtocolExecution } from "./Cache.protocol.runner.schemas.ts";

const sameClient = S.toEquivalence(CacheClientPin);

const equivalentWireMetadata = S.toEquivalence(
  S.Struct(Struct.pick(CacheFixtureEvent.fields, ["role", "status", "bytes", "tagPresent"]))
);
const equivalentArtifact = S.toEquivalence(CacheProtocolObservation.fields.exchanges.value.fields.artifact);

const validateProtocolNativeRun = Effect.fn("Cache.validateProtocolNativeRun")(function* (
  run: CacheProtocolObservation["runs"][number],
  event: CacheProtocolObservation["exchanges"][number],
  upload: CacheProtocolObservation["exchanges"][number],
  producedOutput: CacheProtocolObservation["exchanges"][number]["artifact"]
) {
  const isProducer = run.case === "producer";
  if (
    event.taskHash !== run.taskHash ||
    event.method !== (isProducer ? "PUT" : "GET") ||
    !equivalentWireMetadata(
      { role: event.role, status: event.status, bytes: event.artifact.bytes, tagPresent: event.tag === "present" },
      {
        role: isProducer ? "writer" : "reader",
        status: 200,
        bytes: upload.artifact.bytes,
        tagPresent: run.case !== "missing-tag",
      }
    ) ||
    (event.artifact.sha256 === upload.artifact.sha256) !== (run.case !== "corrupt-body")
  )
    return yield* CacheCommandError.new(`Protocol ${run.case} has inconsistent wire or storage evidence.`);
  const outcomeMatches = Match.value(run.outcome).pipe(
    Match.tags({
      Produced: () => isProducer,
      Replayed: ({ output }) => run.case === "replay" && equivalentArtifact(output, producedOutput),
      Rejected: ({ exitCode, restoredOutputs }) =>
        run.case !== "producer" && run.case !== "replay" && exitCode !== 0 && restoredOutputs === 0,
    }),
    Match.exhaustive
  );
  if (!outcomeMatches) return yield* CacheCommandError.new(`Protocol ${run.case} has an inconsistent native outcome.`);
});

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
    !A.every(
      [
        runs.length,
        exchanges.length,
        A.dedupe(A.map(runs, (run) => run.case)).length,
        A.dedupe(A.map(exchanges, (event) => event.case)).length,
        A.dedupe(A.map(exchanges, (event) => event.requestId)).length,
        A.dedupe(A.map(runs, (run) => run.summary)).length,
      ],
      (count) => count === 6
    ) ||
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
    yield* validateProtocolNativeRun(run, event, upload, producedOutput);
  }
  return observation;
});

const UntamperedCase = LiteralKit(["producer", "replay", "wrong-key"]);
const isUntamperedCase = S.is(UntamperedCase);
const isTransportCase = S.is(CacheProtocolReadFailure.fields.case);

const validateProtocolPopulation = Effect.fn("Cache.validateProtocolPopulation")(function* (
  report: CacheProtocolExecution
) {
  const { observation, roots, failures, events } = report;
  const cases = A.map(observation.runs, (run) => run.case);
  const allCases = A.appendAll(
    cases,
    A.map(failures, (failure) => failure.case)
  );
  const summaries = A.appendAll(
    A.map(observation.runs, (run) => run.summary),
    A.map(failures, (failure) => failure.summary)
  );
  if (
    !A.every(
      [
        roots.length,
        A.dedupe(A.map(roots, (root) => root.case)).length,
        A.dedupe(A.map(roots, (root) => root.sha256)).length,
        A.dedupe(allCases).length,
        A.dedupe(summaries).length,
      ],
      (count) => count === 9
    ) ||
    !A.every(roots, (root) => A.contains(allCases, root.case)) ||
    failures.length !== 3 ||
    events.length === 0 ||
    !A.every(
      events,
      (event, index) =>
        event.sequence === index + 1 &&
        A.contains(allCases, event.scenario.id) &&
        event.role === (event.scenario.id === "producer" ? "writer" : "reader") &&
        event.scenario.fault === (isUntamperedCase(event.scenario.id) ? "none" : event.scenario.id)
    ) ||
    A.filter(events, (event) => event.operation === "put").length !== 1
  )
    return yield* CacheCommandError.new(
      "Protocol execution requires nine distinct cases, isolated roots and ordered, attributed wire evidence."
    );
});

const validateProtocolExchange = Effect.fn("Cache.validateProtocolExchange")(function* (
  exchange: CacheProtocolObservation["exchanges"][number],
  event: CacheFixtureEvent
) {
  if (
    event.scenario.id !== exchange.case ||
    event.operation !== (exchange.method === "PUT" ? "put" : "get") ||
    !equivalentWireMetadata(event, {
      role: exchange.role,
      status: exchange.status,
      bytes: exchange.artifact.bytes,
      tagPresent: exchange.tag === "present",
    }) ||
    !O.contains(exchange.taskHash)(event.artifact) ||
    !O.contains(exchange.artifact.sha256)(event.digest)
  )
    return yield* CacheCommandError.new("Protocol exchange differs from its direct wire event.");
});

const validateProtocolReadFailure = Effect.fn("Cache.validateProtocolReadFailure")(function* (
  failure: CacheProtocolReadFailure,
  events: ReadonlyArray<CacheFixtureEvent>,
  upload: CacheProtocolObservation["exchanges"][number]
) {
  const reads = A.filter(events, (event) => event.scenario.id === failure.case && event.operation === "get");
  const status = CacheProtocolReadFailure.fields.case.$match({
    unavailable: () => 503,
    throttled: () => 429,
    "truncated-body": () => 200,
  })(failure.case);
  if (
    failure.taskHash !== upload.taskHash ||
    reads.length === 0 ||
    !A.every(reads, (event) => {
      const emptyBody = () => event.bytes === 0 && !event.tagPresent && O.isNone(event.digest);
      const bytesMatch = CacheProtocolReadFailure.fields.case.$match({
        unavailable: emptyBody,
        throttled: emptyBody,
        "truncated-body": () =>
          event.bytes === upload.artifact.bytes - 1 &&
          event.tagPresent &&
          O.isSome(event.digest) &&
          !O.contains(upload.artifact.sha256)(event.digest),
      })(failure.case);
      return (
        event.status === status && event.role === "reader" && O.contains(failure.taskHash)(event.artifact) && bytesMatch
      );
    })
  )
    return yield* CacheCommandError.new("Protocol read failure lacks corresponding direct wire evidence.");
});

const validateProtocolIntegrityRead = Effect.fn("Cache.validateProtocolIntegrityRead")(function* (
  event: CacheFixtureEvent,
  upload: CacheProtocolObservation["exchanges"][number]
) {
  const producerMiss = event.scenario.id === "producer";
  if (
    !O.contains(upload.taskHash)(event.artifact) ||
    event.status !== (producerMiss ? 404 : 200) ||
    (producerMiss && (event.bytes !== 0 || event.tagPresent || O.isSome(event.digest)))
  )
    return yield* CacheCommandError.new("Protocol integrity case contains an unexpected artifact read.");
});

/**
 * Revalidate all native integrity and transport cases against their direct wire events.
 *
 * **Details**
 * This validates relationships after a worker or importer decodes its report.
 * It does not authenticate the report or grant qualification authority.
 *
 * **Example** (Validate the complete decoded execution)
 * ```ts
 * import { CacheProtocolExecution, validateCacheProtocolExecution } from "@beep/repo-cli/commands/Cache"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * const validate = (input: unknown) => S.decodeUnknownEffect(CacheProtocolExecution)(input).pipe(
 *   Effect.flatMap(validateCacheProtocolExecution)
 * )
 * console.assert(typeof validate === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheProtocolExecution = Effect.fn("Cache.validateProtocolExecution")(function* (
  report: CacheProtocolExecution
) {
  const { observation, failures, events } = report;
  yield* validateCacheProtocolObservation(observation);
  yield* validateProtocolPopulation(report);
  const upload = yield* A.findFirst(observation.exchanges, (event) => event.case === "producer").pipe(
    Effect.fromOption(() => CacheCommandError.new("Protocol upload is missing."))
  );
  for (const event of events) {
    if (event.operation !== "get" || isTransportCase(event.scenario.id)) continue;
    yield* validateProtocolIntegrityRead(event, upload);
  }
  const exchanges = A.filter(
    events,
    (event) =>
      !isTransportCase(event.scenario.id) &&
      event.status === 200 &&
      (event.operation === "put" || event.operation === "get")
  );
  if (exchanges.length !== observation.exchanges.length)
    return yield* CacheCommandError.new("Protocol exchange inventory differs from its direct wire events.");
  for (const exchange of observation.exchanges) {
    const event = yield* A.findFirst(exchanges, (row) => `wire-${row.sequence}` === exchange.requestId).pipe(
      Effect.fromOption(() => CacheCommandError.new("Protocol exchange lacks its direct wire event."))
    );
    yield* validateProtocolExchange(exchange, event);
  }
  yield* Effect.forEach(failures, (failure) => validateProtocolReadFailure(failure, events, upload), { discard: true });

  return report;
});
