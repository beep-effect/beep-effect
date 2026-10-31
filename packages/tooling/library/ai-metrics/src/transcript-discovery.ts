/**
 * Scoped streaming discovery of explicitly declared private transcript roots.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { transcriptDirectoryHelper } from "./internal/transcript-directory-helper.ts";
import { hashPrivateIdentifier } from "./privacy.ts";
import { TranscriptIntakeError } from "./transcript-intake.ts";
import { TranscriptPageInput } from "./transcript-page.ts";
import { runTranscriptSweep, TranscriptSweepInput, TranscriptSweepOutcome } from "./transcript-sweep.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";
import type { TranscriptSweepReport } from "./transcript-sweep.ts";

const $I = $RepoAiMetricsId.create("transcript-discovery");
/**
 * Explicit root declarations and traversal budgets.
 *
 * **Details**
 *
 * Private paths and salt must not become telemetry. At most eight disjoint absolute roots, eight directory levels per root, 1024 consumed helper events/launches and 32 candidates per page. Retired roots are never accessed. Archives are not implicitly enrolled. A cycle entry ceiling reports overflow instead of claiming completeness.
 *
 * **Example** (Inspect the transcript discovery input constructor)
 *
 * ```ts
 * import { TranscriptDiscoveryInput } from "@beep/repo-ai-metrics/transcript-discovery"
 * console.log(typeof TranscriptDiscoveryInput.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptDiscoveryInput extends S.Opaque<TranscriptDiscoveryInput, { readonly brand: unique symbol }>()(
  S.Struct({
    roots: S.Array(
      S.Struct({
        path: S.NonEmptyString.check(S.isMaxLength(4096)),
        source: TranscriptPageInput.fields.source,
        retired: S.Boolean,
      })
    ).check(S.isMinLength(1), S.isMaxLength(8)),
    hashSalt: TranscriptPageInput.fields.hashSalt,
    maxDepth: S.Int.check(S.isBetween({ minimum: 1, maximum: 8 })),
    maxEntries: S.Int.check(S.isBetween({ minimum: 1, maximum: 1024 })),
    maxFiles: S.Int.check(S.isBetween({ minimum: 1, maximum: 32 })),
    maxCycleEntries: S.Int.check(S.isBetween({ minimum: 1, maximum: 1048576 })),
  }).pipe($I.annoteSchema("TranscriptDiscoveryInput", { description: "Private declared roots and traversal limits." }))
) {}
/**
 * Content-free discovery refusal.
 * **Example** (Inspecting a refusal)
 * ```ts
 * import { TranscriptDiscoveryError } from "@beep/repo-ai-metrics/transcript-discovery"
 * console.log(TranscriptDiscoveryError.make({reason:"busy"}).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class TranscriptDiscoveryError extends S.TaggedError<
  TranscriptDiscoveryError,
  { readonly brand: unique symbol }
>($I`TranscriptDiscoveryError`)(
  "TranscriptDiscoveryError",
  { reason: S.Literals(["configuration", "unavailable", "changed", "busy", "closed"]) },
  $I.annote("TranscriptDiscoveryError", { description: "Failure without raw paths or OS error contents." })
) {}
/**
 * Safe progress for declared roots, separate from file acceptance and fleet coverage.
 *
 * **Details**
 *
 * Completion means an observed traversal, not an atomic snapshot. Symlinks/nonfiles are excluded. Overflow, unreadability and directory replacement differ from completion. Progress restarts with the process; accepted offsets remain in the journal. Counts cover each current cycle; cycle numbers are local to this scanner. Read progress remains pending until the matching page outcomes are recorded. Partial and failed reads survive later empty directory pages in that same cycle.
 *
 * **Example** (Inspect the transcript discovery report constructor)
 *
 * ```ts
 * import { TranscriptDiscoveryReport } from "@beep/repo-ai-metrics/transcript-discovery"
 * console.log(typeof TranscriptDiscoveryReport.make)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptDiscoveryReport extends S.Opaque<TranscriptDiscoveryReport, { readonly brand: unique symbol }>()(
  S.Struct({
    operations: S.Natural,
    candidates: S.Natural,
    activeHelpers: S.Natural,
    roots: S.Array(
      S.Struct({
        rootId: Sha256Hex,
        source: TranscriptPageInput.fields.source,
        state: S.Literals(["retired", "pending", "scanning", "complete", "unavailable", "changed", "overflow"]),
        cycle: S.Natural,
        entries: S.Natural,
        candidates: S.Natural,
        excludedLinks: S.Natural,
        read: S.Struct({
          assessed: S.Natural,
          pending: S.Natural,
          accepted: S.Natural,
          idle: S.Natural,
          partial: S.Natural,
          backlogged: S.Natural,
          failed: S.Natural,
        }),
      })
    ).check(S.isMinLength(1), S.isMaxLength(8)),
  }).pipe(
    $I.annoteSchema("TranscriptDiscoveryReport", { description: "Declared-root progress without paths or content." })
  )
) {}
const failure = (reason: TranscriptDiscoveryError["reason"]) => TranscriptDiscoveryError.make({ reason });
const DirectoryEvent = S.Struct({
  kind: S.Literals([
    "file",
    "directory",
    "directory-end",
    "link",
    "other",
    "complete",
    "changed",
    "unavailable",
    "overflow",
  ]),
  relative: S.String.check(S.isMaxLength(4096)),
}).pipe($I.annoteSchema("DirectoryEvent", { description: "Private bounded event from the owned directory helper." }));
const decodeDirectoryEventJson = S.decodeEffect(S.fromJsonString(DirectoryEvent));
const isTerminalDirectoryEventKind = S.is(
  DirectoryEvent.fields.kind.pick(["complete", "overflow", "unavailable", "changed"])
);

const openRoot = Effect.fn("AiMetrics.discovery.openRoot")(function* (
  directory: string,
  input: TranscriptDiscoveryInput
) {
  const scope = yield* Scope.fork(yield* Scope.Scope);
  const acquire = Effect.gen(function* () {
    const handle = yield* ChildProcess.make(
      "/usr/bin/python3",
      ["-I", "-u", "-c", transcriptDirectoryHelper, directory, `${input.maxDepth}`, `${input.maxCycleEntries}`],
      {
        extendEnv: false,
        stdin: "ignore",
        stderr: "ignore",
        killSignal: "SIGKILL",
      }
    );
    const pull = yield* handle.stdout.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.mapEffect((line) => decodeDirectoryEventJson(line)),
      Stream.rechunk(1),
      Stream.toPull
    );
    return {
      scope,
      next: pull.pipe(
        Effect.map((items) => items[0]),
        Effect.mapError(() => failure("unavailable")),
        Effect.timeoutOrElse({ duration: "5 seconds", orElse: () => Effect.fail(failure("unavailable")) })
      ),
    };
  }).pipe(
    Effect.provideService(Scope.Scope, scope),
    Effect.mapError(() => failure("unavailable"))
  );
  const result = yield* Effect.result(acquire);
  if (Result.isFailure(result)) {
    yield* Scope.close(scope, Exit.void);
    return yield* result.failure;
  }
  return result.success;
});
// Runtime process capabilities, not persisted domain data.
interface RootRuntime {
  candidates: number;
  cycle: number;
  entries: number;
  excludedLinks: number;
  handle: O.Option<Effect.Success<ReturnType<typeof openRoot>>>;
  readonly path: string;
  read: { assessed: number; accepted: number; idle: number; partial: number; backlogged: number; failed: number };
  readonly rootId: Sha256Hex;
  readonly source: TranscriptPageInput["source"];
  state: TranscriptDiscoveryReport["roots"][number]["state"];
}
const closeRoot = Effect.fn("AiMetrics.discovery.closeRoot")(function* (root: RootRuntime) {
  if (O.isSome(root.handle)) yield* Scope.close(root.handle.value.scope, Exit.void);
  root.handle = O.none();
});
const recordReadOutcome = (read: RootRuntime["read"], outcome: TranscriptSweepReport["outcomes"][number]) => {
  read.assessed += 1;
  TranscriptSweepOutcome.match({
    Accepted: (accepted) => {
      read.accepted += 1;
      if (accepted.waitingForPartialLine) read.partial += 1;
      else if (accepted.remainingBytes > 0) read.backlogged += 1;
    },
    Failed: () => {
      read.failed += 1;
    },
    Idle: (idle) => {
      if (idle.waitingForPartialLine) read.partial += 1;
      else read.idle += 1;
    },
  })(outcome);
};
/**
 * Create a scoped, single-owner directory scanner.
 *
 * **Details**
 *
 * Alternates directory operations across roots. Managed isolated Python helpers retain streaming progress across pages, with at most one process per active root and roots times depth directory handles. Their stdout is bounded by pipe backpressure; they may prefetch ahead of observed progress, up to the cycle limit, and never read file contents. This adapter requires /usr/bin/python3. Pending means no completed observation is asserted. suspend closes helpers and resets unfinished roots to pending; resumed discovery rescans them using durable accepted offsets. A completed/failed/overflowed root closes and retries next page; one bad root cannot starve others. The returned sources array is private reader input; only report is publishable. Each pull has a five-second cooperative deadline; failure or scope closure kills the owned helper. Deployment must still impose process, CPU and memory limits. Canonical path and inode/device checks reject symlinks and observed replacement, but cannot defeat adversarial path-resolution races. Do not enroll untrusted writable mounts.
 *
 * **Example** (Inspect the factory for transcript discovery)
 *
 * ```ts
 * import { makeTranscriptDiscovery } from "@beep/repo-ai-metrics/transcript-discovery"
 * console.log(typeof makeTranscriptDiscovery)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const makeTranscriptDiscovery = Effect.fn("AiMetrics.makeTranscriptDiscovery")(function* (
  input: TranscriptDiscoveryInput
) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const ownerScope = yield* Scope.Scope;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const salt = Redacted.value(input.hashSalt);
  if (Str.trim(salt) === "") return yield* failure("configuration");
  const paths = A.map(input.roots, (root) => path.resolve(root.path));
  if (
    A.some(input.roots, (root) => !path.isAbsolute(root.path)) ||
    A.some(paths, (root) => root === path.parse(root).root) ||
    A.some(paths, (root, index) =>
      A.some(
        paths,
        (other, otherIndex) => index !== otherIndex && (root === other || Str.startsWith(`${root}${path.sep}`)(other))
      )
    )
  )
    return yield* failure("configuration");
  const roots: ReadonlyArray<RootRuntime> = yield* Effect.forEach(
    input.roots,
    Effect.fnUntraced(function* (root) {
      const resolved = path.resolve(root.path);
      if (!root.retired) {
        const canonical = yield* fs.realPath(resolved).pipe(Effect.option);
        if (O.isSome(canonical) && canonical.value !== resolved) return yield* failure("configuration");
      }
      return {
        path: resolved,
        source: root.source,
        rootId: yield* hashPrivateIdentifier(`transcript-discovery-root/v1:${root.source}:${resolved}`, O.some(salt)),
        state: root.retired ? "retired" : "pending",
        cycle: 0,
        entries: 0,
        candidates: 0,
        read: { assessed: 0, accepted: 0, idle: 0, partial: 0, backlogged: 0, failed: 0 },
        excludedLinks: 0,
        handle: O.none(),
      } satisfies RootRuntime;
    })
  );
  const semaphore = yield* Semaphore.make(1);
  const suspendRoots = Effect.forEach(
    roots,
    (root) =>
      closeRoot(root).pipe(
        Effect.andThen(
          Effect.sync(() => {
            if (root.state === "scanning") root.state = "pending";
          })
        )
      ),
    { discard: true }
  );
  let cursor = 0;
  let closed = false;
  yield* Effect.addFinalizer(
    Effect.fnUntraced(function* () {
      closed = true;
      yield* Effect.forEach(roots, closeRoot, { discard: true }).pipe(Effect.orDie);
    })
  );
  const report = (operations: number, candidates: number) =>
    TranscriptDiscoveryReport.make({
      operations,
      candidates,
      activeHelpers: A.filter(roots, (root) => O.isSome(root.handle)).length,
      roots: A.map(roots, (root) => ({
        rootId: root.rootId,
        source: root.source,
        state: root.state,
        cycle: root.cycle,
        entries: root.entries,
        candidates: root.candidates,
        excludedLinks: root.excludedLinks,
        read: { ...root.read, pending: root.candidates - root.read.assessed },
      })),
    });
  const candidateFromFile = Effect.fnUntraced(function* (root: RootRuntime, relative: string) {
    const candidate = path.resolve(root.path, relative);
    if (!Str.startsWith(`${root.path}${path.sep}`)(candidate)) return yield* failure("changed");
    const name = path.basename(candidate);
    if (!Str.endsWith(".jsonl")(name) || (root.source !== "claude" && !Str.startsWith("rollout-")(name)))
      return O.none();
    root.candidates += 1;
    const pathHash = yield* hashPrivateIdentifier(candidate, O.some(salt)).pipe(
      Effect.mapError(() => failure("unavailable"))
    );
    const observation = {
      root,
      cycle: root.cycle,
      sourceId: yield* hashPrivateIdentifier(`transcript-source/v1:${root.source}:${pathHash}`, O.some(salt)).pipe(
        Effect.mapError(() => failure("unavailable"))
      ),
    };
    return O.some({ observation, source: { path: candidate, source: root.source, retired: false } });
  });
  const startCycle = Effect.fnUntraced(function* (root: RootRuntime) {
    root.cycle += 1;
    root.entries = 0;
    root.candidates = 0;
    root.read = { assessed: 0, accepted: 0, idle: 0, partial: 0, backlogged: 0, failed: 0 };
    root.excludedLinks = 0;
    root.handle = O.some(yield* openRoot(root.path, input));
    root.state = "scanning";
  }, Effect.uninterruptible);
  const advanceRoot = Effect.fnUntraced(function* (root: RootRuntime) {
    if (root.state !== "scanning") {
      yield* startCycle(root);
      return O.none();
    }
    if (O.isNone(root.handle)) return yield* failure("changed");
    const event = yield* root.handle.value.next;
    if (isTerminalDirectoryEventKind(event.kind)) {
      root.state = event.kind;
      yield* closeRoot(root);
      return O.none();
    }
    if (event.kind !== "directory-end") root.entries += 1;
    if (event.kind === "link") root.excludedLinks += 1;
    return event.kind === "file" ? yield* candidateFromFile(root, event.relative) : O.none();
  });
  const nextPage = Effect.gen(function* () {
    if (closed) return yield* failure("closed");
    const eligible = A.filter(roots, (root) => root.state !== "retired");
    let finished: ReadonlyArray<Sha256Hex> = [];
    let sources: ReadonlyArray<{ path: string; source: TranscriptPageInput["source"]; retired: boolean }> = [];
    let observations: ReadonlyArray<{
      readonly root: RootRuntime;
      readonly cycle: number;
      readonly sourceId: Sha256Hex;
    }> = [];
    let operations = 0;
    const visitRoot = Effect.fnUntraced(function* (root: RootRuntime) {
      const result = yield* Effect.result(advanceRoot(root));
      if (Result.isFailure(result)) {
        root.state = result.failure.reason === "changed" ? "changed" : "unavailable";
        yield* closeRoot(root);
        finished = A.append(finished, root.rootId);
        return;
      }
      if (root.state !== "scanning") finished = A.append(finished, root.rootId);
      if (O.isSome(result.success)) {
        observations = A.append(observations, result.success.value.observation);
        sources = A.append(sources, result.success.value.source);
      }
    });
    while (operations < input.maxEntries && sources.length < input.maxFiles && finished.length < eligible.length) {
      const root = eligible[cursor % eligible.length];
      cursor = (cursor + 1) % eligible.length;
      if (root === undefined || A.contains(finished, root.rootId)) continue;
      operations += 1;
      yield* visitRoot(root);
    }
    let recorded = false;
    const releaseOwnPage = () => {
      if (O.exists(unrecorded, (page) => page.recordReads === recordReads)) unrecorded = O.none();
    };
    const recordReads = Effect.fn("AiMetrics.discovery.recordReads")(
      function* (sweep: TranscriptSweepReport) {
        if (
          recorded ||
          closed ||
          sweep.outcomes.length !== observations.length ||
          A.some(
            observations,
            (o) =>
              o.root.cycle !== o.cycle ||
              A.filter(sweep.outcomes, (result) => result.sourceId === o.sourceId).length !== 1
          )
        ) {
          // An inconsistent page is never re-offered; the next traversal rediscovers it.
          releaseOwnPage();
          return yield* failure("changed");
        }
        for (const observation of observations) {
          const outcome = A.findFirst(sweep.outcomes, (r) => r.sourceId === observation.sourceId);
          if (O.isNone(outcome)) return yield* failure("changed");
          recordReadOutcome(observation.root.read, outcome.value);
        }
        recorded = true;
        releaseOwnPage();
        return report(operations, sources.length);
      },
      semaphore.withPermitsIfAvailable(1),
      Effect.flatMap((result) => Effect.fromOption(result).pipe(Effect.mapError(() => failure("busy"))))
    );
    return { sources, report: report(operations, sources.length), recordReads };
  }).pipe(
    Effect.onInterrupt(() => suspendRoots),
    Effect.provideService(Scope.Scope, ownerScope),
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    semaphore.withPermitsIfAvailable(1),
    Effect.flatMap(
      Effect.fn("AiMetrics.discovery.admit")(function* (result) {
        if (O.isNone(result)) return yield* failure("busy");
        return result.value;
      })
    )
  );
  // A page whose reads were never recorded (its sweep was interrupted or failed) is offered
  // again before discovery advances, so its unattempted candidates are not dropped. The
  // per-attempt schedule cursor then resumes after the file that consumed the last cycle.
  let unrecorded: O.Option<Effect.Success<typeof nextPage>> = O.none();
  const next = Effect.suspend(() => {
    if (closed) return Effect.fail(failure("closed"));
    return O.match(unrecorded, {
      onSome: Effect.succeed,
      onNone: () =>
        nextPage.pipe(
          Effect.tap((page) =>
            Effect.sync(() => {
              unrecorded = A.isReadonlyArrayNonEmpty(page.sources) ? O.some(page) : O.none();
            })
          )
        ),
    });
  });
  const suspend = suspendRoots.pipe(
    semaphore.withPermitsIfAvailable(1),
    Effect.flatMap((result) => (O.isNone(result) ? Effect.fail(failure("busy")) : Effect.void))
  );
  return {
    next,
    suspend,
    hashSalt: input.hashSalt,
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
  };
});
/**
 * Scoped capability derived from the scanner factory.
 * **Example** See `makeTranscriptDiscovery`.
 * @category services
 * @since 0.0.0
 */
export type TranscriptDiscovery = Effect.Success<ReturnType<typeof makeTranscriptDiscovery>>;

/**
 * Bounded source reading after discovery, using the existing page contract.
 * **Example** (Inspecting read limits)
 * ```ts
 * import { TranscriptDiscoveryReadPolicy } from "@beep/repo-ai-metrics/transcript-discovery"
 * console.log(typeof TranscriptDiscoveryReadPolicy.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TranscriptDiscoveryReadPolicy extends S.Opaque<
  TranscriptDiscoveryReadPolicy,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    maxBytes: TranscriptPageInput.fields.maxBytes,
    maxLineBytes: TranscriptPageInput.fields.maxLineBytes,
    maxFrames: TranscriptPageInput.fields.maxFrames,
  })
    .check(
      S.makeFilter((value) => value.maxBytes > value.maxLineBytes, {
        identifier: "DiscoveryReadBounds",
        title: "Discovery read bounds",
        message: "Page must exceed line bound",
      })
    )
    .pipe(
      $I.annoteSchema("TranscriptDiscoveryReadPolicy", { description: "Bounded reading of each discovered candidate." })
    )
) {}
/**
 * Process every candidate from one bounded discovery page through durable intake.
 *
 * **Details**
 *
 * Namespace mismatch fails before directory progress. Failed admissions retain their accepted cursor and are retried in a later traversal. Discovery is not a durable receipt; a crash between discovery and acceptance causes rescanning. Returns only metadata reports, never the private candidate paths.
 *
 * **Example** (Inspect the discovered-transcript sweep function)
 *
 * ```ts
 * import { runDiscoveredTranscriptSweep } from "@beep/repo-ai-metrics/transcript-discovery"
 * console.log(typeof runDiscoveredTranscriptSweep)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const runDiscoveredTranscriptSweep = Effect.fn("AiMetrics.runDiscoveredTranscriptSweep")(function* (
  config: TranscriptIntakeConfig,
  discovery: TranscriptDiscovery,
  policy: TranscriptDiscoveryReadPolicy
) {
  if (discovery.namespaceId !== config.namespaceId) return yield* TranscriptIntakeError.make({ reason: "namespace" });
  const page = yield* discovery.next;
  const sweep = yield* runTranscriptSweep(
    config,
    TranscriptSweepInput.make({
      ...policy,
      sources: page.sources,
      hashSalt: discovery.hashSalt,
      maxSources: 32,
    })
  );
  return { discovery: yield* page.recordReads(sweep), sweep };
});
