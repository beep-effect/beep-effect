/**
 * Score a Remote Cache target against the generated conformance corpus.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CacheConformanceProxyOptions, makeCacheConformanceFaultProxy } from "./Cache.conformance.proxy.ts";
import {
  CacheConformanceBearers,
  CacheConformanceCaseResult,
  CacheConformanceCaseVerdicts,
  CacheConformanceDimension,
  CacheConformanceLoadEnvelope,
  CacheConformanceRun,
  CacheConformanceVerdictCounts,
} from "./Cache.conformance.schemas.ts";
import {
  CacheConformanceWireCheck,
  cacheConformanceLabCaseIds,
  runCacheConformanceLabCase,
  runCacheConformanceWireCase,
} from "./Cache.conformance.wire.ts";
import { decodeCacheExperimentText, readCacheExperimentBytes } from "./Cache.evidence.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type {
  CacheConformanceCase,
  CacheConformanceCorpus,
  CacheConformanceExchange,
  CacheConformanceOperation,
  CacheConformanceTarget,
  CacheConformanceVerdict,
} from "./Cache.conformance.schemas.ts";
import type { CacheConformanceWireOutcome } from "./Cache.conformance.wire.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.conformance");
const decodeBearers = S.decodeUnknownEffect(S.toType(CacheConformanceBearers));
const decodeEnvelopeJson = S.decodeEffect(S.fromJsonString(CacheConformanceLoadEnvelope));
const encodeRunJson = S.encodeEffect(S.fromJsonString(CacheConformanceRun, { space: 2 }));

const LoopbackIpv4 = S.String.check(S.isPattern(/^127(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/)).pipe(
  $I.annoteSchema("LoopbackIpv4", { description: "An IPv4 address inside 127.0.0.0/8." })
);
const isLoopbackIpv4 = S.is(LoopbackIpv4);
const loopbackNames = HashSet.make("localhost", "[::1]", "::1");
const isLoopbackHost = (hostname: string) =>
  HashSet.has(loopbackNames, hostname) || Str.endsWith(".localhost")(hostname) || isLoopbackIpv4(hostname);

/**
 * Refuse a target whose base URL crosses its declared profile boundary.
 *
 * **Details**
 * The `local-container` profile only accepts `http`/`https` loopback hosts, so
 * a local lab run cannot write to a reachable shared or production endpoint.
 *
 * **Example** (Check a target boundary)
 * ```ts
 * import { assertCacheConformanceTargetBoundary } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof assertCacheConformanceTargetBoundary === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const assertCacheConformanceTargetBoundary = Effect.fn("CacheConformance.assertTargetBoundary")(function* (
  target: CacheConformanceTarget
) {
  const url = target.baseUrl;
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return yield* CacheCommandError.new("Conformance targets must use http or https.");
  if (target.profile === "local-container" && !isLoopbackHost(url.hostname))
    return yield* CacheCommandError.new("The local-container profile refuses a non-loopback baseUrl.");
  if (target.namespace.teamId === target.namespace.foreignTeamId)
    return yield* CacheCommandError.new("The target namespace and foreign namespace must differ.");
  return target;
});

/**
 * Read the four bearers named by a target into `Redacted` values.
 *
 * **Details**
 * Only the environment variable names live in the target file. Missing or
 * empty values fail before any request is sent, as do an unknown bearer equal
 * to a valid one and reused bearers where the target claims a role split or
 * tenant binding. The error names the variables, never their values.
 *
 * **Example** (Load run bearers)
 * ```ts
 * import { loadCacheConformanceBearers } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof loadCacheConformanceBearers === "function")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const loadCacheConformanceBearers = Effect.fn("CacheConformance.loadBearers")(function* (
  target: CacheConformanceTarget
) {
  const names = target.credentials;
  const values = yield* Config.all({
    reader: Config.Redacted(names.reader),
    writer: Config.Redacted(names.writer),
    foreign: Config.Redacted(names.foreign),
    unknown: Config.Redacted(names.unknown),
  }).pipe(
    Effect.mapError(() =>
      CacheCommandError.new(
        `Set ${names.reader}, ${names.writer}, ${names.foreign} and ${names.unknown} to the target's bearers.`
      )
    )
  );
  const reader = Redacted.value(values.reader);
  const writer = Redacted.value(values.writer);
  const foreign = Redacted.value(values.foreign);
  const unknown = Redacted.value(values.unknown);
  const valid = HashSet.make(reader, writer, foreign);
  // A topology without a role split or per-tenant credentials genuinely hands
  // every caller the same bearer, so reuse is allowed exactly where the target
  // does not claim the separation; the unknown bearer is always distinct.
  if (
    A.some([reader, writer, foreign, unknown], Str.isEmpty) ||
    HashSet.has(valid, unknown) ||
    (target.policy.readerWriterSplit && reader === writer) ||
    (target.policy.tenantBinding && (foreign === reader || foreign === writer))
  )
    return yield* CacheCommandError.new(
      "Bearers must be non-empty, the unknown bearer must match no valid one, and claimed role or tenant separation needs distinct bearers."
    );
  return yield* decodeBearers(values).pipe(CacheCommandError.mapError("Cannot hold the run bearers."));
});

/**
 * Fold recorded expectations into one verdict: the first failure names the
 * expectation, and no expectation at all is a non-execution, never a pass.
 *
 * **Example** (Score an empty expectation list)
 * ```ts
 * import { cacheConformanceVerdictOf } from "@beep/repo-cli/commands/Cache"
 * console.assert(cacheConformanceVerdictOf([]).verdict === "not-executed")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const cacheConformanceVerdictOf = (
  checks: ReadonlyArray<CacheConformanceWireCheck>
): CacheConformanceVerdict => {
  const failed = A.filter(checks, (check) => !check.ok);
  return A.match(failed, {
    onEmpty: (): CacheConformanceVerdict =>
      A.isReadonlyArrayNonEmpty(checks)
        ? { verdict: "pass" }
        : { verdict: "not-executed", reason: "The executor recorded no expectation for this dimension." },
    onNonEmpty: ([first, ...rest]): CacheConformanceVerdict => ({
      verdict: "fail",
      expectation: first.id,
      detail: A.join(
        A.map([first, ...rest], (check) => `${check.id}: ${check.detail}`),
        " | "
      ),
    }),
  });
};

const documentedChecks = (
  exchanges: ReadonlyArray<CacheConformanceExchange>,
  operations: ReadonlyArray<CacheConformanceOperation>
) =>
  A.flatMap(exchanges, (exchange) =>
    O.flatMap(exchange.strictScored ? exchange.operationId : O.none(), (id) =>
      O.map(
        A.findFirst(operations, (operation) => operation.operationId === id),
        (operation) => {
          const documented = A.map(operation.responses, (response) => response.status);
          const shape = A.findFirst(operation.responses, (response) => O.contains(exchange.status, response.status));
          const statusOk = O.isSome(shape);
          const mediaOk = O.match(
            O.flatMap(shape, (response) => response.contentType),
            {
              onNone: () => true,
              onSome: (media) =>
                exchange.method === "HEAD" ||
                O.exists(exchange.contentType, (actual) => Str.startsWith(media)(Str.toLowerCase(actual))),
            }
          );
          const observed = O.match(exchange.status, { onNone: () => exchange.outcome, onSome: (code) => `${code}` });
          return [
            CacheConformanceWireCheck.make({
              id: `documented-status:${id}`,
              ok: statusOk,
              detail: `${exchange.step} answered ${observed}; documented ${A.join(
                A.map(documented, (code) => `${code}`),
                ", "
              )}`,
            }),
            CacheConformanceWireCheck.make({
              id: `documented-content-type:${id}`,
              ok: mediaOk,
              detail: `${exchange.step} content type ${O.getOrElse(exchange.contentType, () => "absent")}`,
            }),
          ];
        }
      )
    ).pipe(O.getOrElse(() => []))
  );

const strictVerdict = (outcome: CacheConformanceWireOutcome, operations: ReadonlyArray<CacheConformanceOperation>) =>
  O.match(outcome.unsupported, {
    onSome: (reason): CacheConformanceVerdict => ({ verdict: "unsupported-optional", reason }),
    onNone: () =>
      cacheConformanceVerdictOf(A.appendAll(documentedChecks(outcome.exchanges, operations), outcome.strict)),
  });

const unscoredByWire = Match.type<CacheConformanceDimension>().pipe(
  Match.when(
    (dimension) => dimension === "published-stable-client" || dimension === "published-canary-client",
    () => "Client acceptance is scored only by native runs (cache conformance-native)."
  ),
  Match.when("observability", () => "Needs backend log capture; the wire runner records only direct receipts."),
  Match.when("performance-envelope", () => "Needs measured load on a deployed replica."),
  Match.orElse(() => "The wire runner does not score this dimension.")
);

const skippedReason = (entry: CacheConformanceCase) =>
  entry.executor === "native"
    ? `Requires the pinned native Turbo executables; executed by cache conformance-native. ${entry.reason}`
    : HashSet.has(labExecuted, entry.id)
      ? `Measured by cache conformance-lab. ${entry.reason}`
      : `Requires a deployed boundary or measured load the local lab cannot supply. ${entry.reason}`;

const labExecuted = HashSet.fromIterable(cacheConformanceLabCaseIds);

/**
 * Build one case's six verdicts: dimensions the case does not score are
 * `not-applicable`; the rest come from `verdict`.
 *
 * **Example** (Mark every scored dimension unexecuted)
 * ```ts
 * import { cacheConformanceCaseVerdicts } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof cacheConformanceCaseVerdicts === "function")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const cacheConformanceCaseVerdicts: {
  (
    verdict: (dimension: CacheConformanceDimension) => CacheConformanceVerdict
  ): (entry: CacheConformanceCase) => CacheConformanceCaseVerdicts;
  (
    entry: CacheConformanceCase,
    verdict: (dimension: CacheConformanceDimension) => CacheConformanceVerdict
  ): CacheConformanceCaseVerdicts;
} = dual(
  2,
  (
    entry: CacheConformanceCase,
    verdict: (dimension: CacheConformanceDimension) => CacheConformanceVerdict
  ): CacheConformanceCaseVerdicts => {
    const scored = HashSet.fromIterable(entry.dimensions);
    const pick = (dimension: CacheConformanceDimension): CacheConformanceVerdict =>
      HashSet.has(scored, dimension) ? verdict(dimension) : { verdict: "not-applicable" };
    return CacheConformanceCaseVerdicts.make({
      "strict-openapi": pick("strict-openapi"),
      "published-stable-client": pick("published-stable-client"),
      "published-canary-client": pick("published-canary-client"),
      "beep-security-policy": pick("beep-security-policy"),
      observability: pick("observability"),
      "performance-envelope": pick("performance-envelope"),
    });
  }
);

const scoreCase = Effect.fn("CacheConformance.scoreCase")(function* (
  entry: CacheConformanceCase,
  corpus: CacheConformanceCorpus,
  target: CacheConformanceTarget,
  bearers: CacheConformanceBearers
) {
  if (entry.executor !== "wire") return skippedCacheConformanceCase(entry, skippedReason(entry));
  const outcome = yield* runCacheConformanceWireCase(entry.id, target, bearers, corpus.operations);
  const strict = strictVerdict(outcome, corpus.operations);
  const policy = cacheConformanceVerdictOf(outcome.policy);
  return CacheConformanceCaseResult.make({
    id: entry.id,
    executor: entry.executor,
    exchanges: outcome.exchanges,
    notes: A.map(outcome.notes, Str.slice(0, 512)),
    verdicts: cacheConformanceCaseVerdicts(entry, (dimension) =>
      Match.value(dimension).pipe(
        Match.when("strict-openapi", () => strict),
        Match.when("beep-security-policy", () => policy),
        Match.orElse((other): CacheConformanceVerdict => ({ verdict: "not-executed", reason: unscoredByWire(other) }))
      )
    ),
  });
});

const countVerdicts = (results: ReadonlyArray<CacheConformanceCaseResult>, dimension: CacheConformanceDimension) => {
  const verdicts = A.map(results, (result) => result.verdicts[dimension].verdict);
  const count = (kind: CacheConformanceVerdict["verdict"]) =>
    S.Natural.make(A.filter(verdicts, (verdict) => verdict === kind).length);
  return CacheConformanceVerdictCounts.make({
    dimension,
    pass: count("pass"),
    fail: count("fail"),
    unsupportedOptional: count("unsupported-optional"),
    notApplicable: count("not-applicable"),
    notExecuted: count("not-executed"),
  });
};

/**
 * Report a case this run does not execute: every scored dimension is
 * `not-executed` with `reason`.
 *
 * **Example** (Reference the skipped-case constructor)
 * ```ts
 * import { skippedCacheConformanceCase } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof skippedCacheConformanceCase === "function")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const skippedCacheConformanceCase: {
  (reason: string): (entry: CacheConformanceCase) => CacheConformanceCaseResult;
  (entry: CacheConformanceCase, reason: string): CacheConformanceCaseResult;
} = dual(2, (entry: CacheConformanceCase, reason: string) =>
  CacheConformanceCaseResult.make({
    id: entry.id,
    executor: entry.executor,
    exchanges: [],
    notes: [],
    verdicts: cacheConformanceCaseVerdicts(entry, () => ({ verdict: "not-executed", reason })),
  })
);

/**
 * Assemble a run report with per-dimension summary counts.
 *
 * **Example** (Reference the report assembler)
 * ```ts
 * import { assembleCacheConformanceRun } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof assembleCacheConformanceRun === "function")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const assembleCacheConformanceRun = ({
  corpus,
  target,
  cases,
  ...details
}: {
  readonly corpus: CacheConformanceCorpus;
  readonly target: CacheConformanceTarget;
  readonly startedAt: string;
  readonly executors: CacheConformanceRun["executors"];
  readonly clients: CacheConformanceRun["clients"];
  readonly representative: boolean;
  readonly cases: ReadonlyArray<CacheConformanceCaseResult>;
}) =>
  CacheConformanceRun.make({
    profile: target.profile,
    representative: details.representative,
    executors: details.executors,
    clients: details.clients,
    topology: target.topology,
    backend: target.backend,
    policy: target.policy,
    corpus: { specSha256: corpus.openapi.sha256, sourcePlanSha256: corpus.sourcePlan.sha256 },
    startedAt: details.startedAt,
    cases,
    summary: A.map(CacheConformanceDimension.literals, (dimension) => countVerdicts(cases, dimension)),
  });

/**
 * Run every corpus case against one target and score each dimension separately.
 *
 * **Details**
 * `wire` cases execute over `HttpClient` with a per-request timeout; `native`
 * and `lab` cases are reported `not-executed` with their reason. Strict OpenAPI
 * and Beep security policy are scored independently, so a documented-status
 * deviation such as a `201` upload never hides or causes a policy verdict.
 *
 * **Example** (Plan a conformance run)
 * ```ts
 * import { runCacheConformance } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheConformance === "function")
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runCacheConformance = Effect.fn("CacheConformance.run")(function* (
  corpus: CacheConformanceCorpus,
  target: CacheConformanceTarget,
  bearers: CacheConformanceBearers
) {
  yield* assertCacheConformanceTargetBoundary(target);
  const startedAt = DateTime.formatIso(yield* DateTime.now);
  const cases = yield* Effect.forEach(corpus.cases, (entry) => scoreCase(entry, corpus, target, bearers));
  return assembleCacheConformanceRun({
    corpus,
    target,
    startedAt,
    executors: ["wire"],
    clients: [],
    representative: false,
    cases,
  });
});

/**
 * Repository-relative measured production load envelope.
 *
 * **Example** (Read the envelope path)
 * ```ts
 * import { cacheConformanceLoadEnvelopePath } from "@beep/repo-cli/commands/Cache"
 * console.assert(cacheConformanceLoadEnvelopePath.endsWith(".json"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const cacheConformanceLoadEnvelopePath =
  "goals/turborepo-cache-conformance/research/load-envelope-2026-10-23.json";

/**
 * Read and decode the measured load envelope.
 *
 * **Example** (Plan the envelope read)
 * ```ts
 * import { loadCacheConformanceEnvelope } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof loadCacheConformanceEnvelope === "function")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const loadCacheConformanceEnvelope = Effect.fn("CacheConformance.loadEnvelope")(function* (root: string) {
  return yield* readCacheExperimentBytes(root, cacheConformanceLoadEnvelopePath).pipe(
    Effect.flatMap(decodeCacheExperimentText),
    Effect.flatMap(decodeEnvelopeJson)
  );
}, CacheCommandError.mapError("Cannot read the measured load envelope."));

/** How long the proxy holds a `timeout` fault; longer than the probes' client deadline. */
const labHoldMs = 3000;

const scoreLabCase = Effect.fn("CacheConformance.scoreLabCase")(function* (
  entry: CacheConformanceCase,
  corpus: CacheConformanceCorpus,
  target: CacheConformanceTarget,
  bearers: CacheConformanceBearers,
  proxy: Effect.Success<ReturnType<typeof makeCacheConformanceFaultProxy>>,
  envelope: CacheConformanceLoadEnvelope
) {
  if (!HashSet.has(labExecuted, entry.id))
    return skippedCacheConformanceCase(entry, "Not part of the lab run; the wire and native runs score it.");
  const outcome = yield* runCacheConformanceLabCase(entry.id, target, bearers, corpus.operations, proxy, envelope);
  return CacheConformanceCaseResult.make({
    id: entry.id,
    executor: "lab",
    exchanges: outcome.exchanges,
    notes: A.map(outcome.notes, Str.slice(0, 512)),
    measurements: outcome.measurements,
    verdicts: cacheConformanceCaseVerdicts(entry, (dimension) =>
      Match.value(dimension).pipe(
        Match.when("observability", () => cacheConformanceVerdictOf(outcome.observability)),
        Match.when("performance-envelope", () => cacheConformanceVerdictOf(outcome.performance)),
        Match.orElse(
          (): CacheConformanceVerdict => ({
            verdict: "not-executed",
            reason: "The lab run scores only observability and the performance envelope.",
          })
        )
      )
    ),
  });
});

/**
 * Run the lab cases: proxied fault classes (RC-023) and the measured payload
 * (RC-027) and concurrency (RC-028) envelopes.
 *
 * **Details**
 * The envelope comes from the measured production load file. Only a
 * `disposable-deployment` run is marked representative; a local container run
 * never is. Every other case is reported `not-executed` for the lab run.
 *
 * **Example** (Plan a lab run)
 * ```ts
 * import { runCacheConformanceLab } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheConformanceLab === "function")
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runCacheConformanceLab = Effect.fn("CacheConformance.runLab")(function* (
  corpus: CacheConformanceCorpus,
  target: CacheConformanceTarget,
  bearers: CacheConformanceBearers,
  envelope: CacheConformanceLoadEnvelope
) {
  yield* assertCacheConformanceTargetBoundary(target);
  const startedAt = DateTime.formatIso(yield* DateTime.now);
  const proxy = yield* makeCacheConformanceFaultProxy(
    CacheConformanceProxyOptions.make({ target, bearers, holdMs: labHoldMs })
  );
  const cases = yield* Effect.forEach(corpus.cases, (entry) =>
    scoreLabCase(entry, corpus, target, bearers, proxy, envelope)
  );
  return assembleCacheConformanceRun({
    corpus,
    target,
    startedAt,
    executors: ["lab"],
    clients: [],
    representative: target.profile === "disposable-deployment",
    cases,
  });
}, Effect.scoped);

const verdictRank = (verdict: CacheConformanceVerdict) =>
  Match.value(verdict.verdict).pipe(
    Match.when("fail", () => 4),
    Match.when("pass", () => 3),
    Match.when("unsupported-optional", () => 2),
    Match.when("not-executed", () => 1),
    Match.orElse(() => 0)
  );

const mergeVerdicts = (verdicts: A.NonEmptyReadonlyArray<CacheConformanceVerdict>): CacheConformanceVerdict => {
  const top = A.reduce(A.tailNonEmpty(verdicts), A.headNonEmpty(verdicts), (best, next) =>
    verdictRank(next) > verdictRank(best) ? next : best
  );
  const failures = A.filter(verdicts, (verdict) => verdict.verdict === "fail");
  return top.verdict === "fail"
    ? {
        verdict: "fail",
        expectation: top.expectation,
        detail: A.join(
          A.map(failures, (verdict) => (verdict.verdict === "fail" ? verdict.detail : "")),
          " || "
        ),
      }
    : top;
};

/**
 * Merge run reports for one target (same profile, topology, backend and
 * corpus) into a single report: per (case, dimension), any executed `fail`
 * wins, then `pass`, then `unsupported-optional`, then `not-executed`.
 *
 * **Details**
 * Wire, native (one per client channel) and lab runs each execute different
 * cases and dimensions; the merged report keeps every receipt, note and
 * measurement, and recomputes the summary counts.
 *
 * **Example** (Reference the merge step)
 * ```ts
 * import { mergeCacheConformanceRuns } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof mergeCacheConformanceRuns === "function")
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mergeCacheConformanceRuns = Effect.fn("CacheConformance.mergeRuns")(function* (
  runs: A.NonEmptyReadonlyArray<CacheConformanceRun>
) {
  const first = A.headNonEmpty(runs);
  if (
    !A.every(
      runs,
      (run) =>
        run.profile === first.profile &&
        run.topology === first.topology &&
        run.backend.release === first.backend.release &&
        run.corpus.specSha256 === first.corpus.specSha256 &&
        run.corpus.sourcePlanSha256 === first.corpus.sourcePlanSha256 &&
        run.cases.length === first.cases.length
    )
  )
    return yield* CacheCommandError.new(
      `Runs for ${first.profile}/${first.topology} disagree on target, backend, corpus or case set.`
    );
  const cases = A.map(first.cases, (entry, index) => {
    const peers = A.map(runs, (run) => A.get(run.cases, index).pipe(O.getOrElse(() => entry)));
    const executed = A.findFirst(
      peers,
      (peer) => A.isReadonlyArrayNonEmpty(peer.exchanges) || A.isReadonlyArrayNonEmpty(peer.measurements)
    );
    const pick = (dimension: CacheConformanceDimension) =>
      mergeVerdicts(A.map(peers, (peer) => peer.verdicts[dimension]));
    return CacheConformanceCaseResult.make({
      id: entry.id,
      executor: O.match(executed, { onNone: () => entry.executor, onSome: (peer) => peer.executor }),
      exchanges: A.flatMap(peers, (peer) => peer.exchanges),
      notes: A.flatMap(peers, (peer) => peer.notes),
      measurements: A.flatMap(peers, (peer) => peer.measurements),
      verdicts: CacheConformanceCaseVerdicts.make({
        "strict-openapi": pick("strict-openapi"),
        "published-stable-client": pick("published-stable-client"),
        "published-canary-client": pick("published-canary-client"),
        "beep-security-policy": pick("beep-security-policy"),
        observability: pick("observability"),
        "performance-envelope": pick("performance-envelope"),
      }),
    });
  });
  if (
    !A.every(runs, (run) =>
      A.every(run.cases, (entry, index) => O.exists(A.get(first.cases, index), (peer) => peer.id === entry.id))
    )
  )
    return yield* CacheCommandError.new("Runs list cases in different orders.");
  const executors = A.dedupe(A.flatMap(runs, (run) => run.executors));
  return CacheConformanceRun.make({
    profile: first.profile,
    representative: A.some(runs, (run) => run.representative),
    executors: A.isReadonlyArrayNonEmpty(executors) ? executors : first.executors,
    clients: A.flatMap(runs, (run) => run.clients),
    topology: first.topology,
    backend: first.backend,
    policy: first.policy,
    corpus: first.corpus,
    startedAt: first.startedAt,
    cases,
    summary: A.map(CacheConformanceDimension.literals, (dimension) => countVerdicts(cases, dimension)),
  });
});

/**
 * Render a run report as two-space JSON with a trailing newline.
 *
 * **Example** (Reference the report codec)
 * ```ts
 * import { encodeCacheConformanceRun } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof encodeCacheConformanceRun === "function")
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeCacheConformanceRun = Effect.fn("CacheConformance.encodeRun")(function* (
  report: CacheConformanceRun
) {
  return `${yield* encodeRunJson(report)}\n`;
}, CacheCommandError.mapError("Cannot encode the conformance run report."));
