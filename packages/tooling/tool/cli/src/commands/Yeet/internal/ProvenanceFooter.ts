/**
 * Registry-backed construction and non-fatal stamping of public PR provenance.
 *
 * **Gotchas**
 *
 * The current PR body is splice framing, never provenance authority. Footer
 * content is rebuilt solely from workstation-local registry rows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Cause, Console, DateTime, Effect, Exit } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext, runIdForContext } from "./ArtifactPaths.ts";
import { runGitOutput } from "./GitExec.ts";
import { writeTextFile } from "./IssueArtifacts.ts";
import {
  makePrProvenanceServiceLive,
  PrRepository,
  PrSessionRecord,
  parsePrProvenanceFooter,
  renderPrProvenance,
  splicePrProvenanceFooter,
  toPublicPrProvenance,
} from "./Provenance.ts";
import { makePrSessionRegistryLive } from "./PrSessionRegistry.ts";
import type { FileSystem, Path } from "effect";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { PrNumber, PrProvenanceRole } from "./Provenance.ts";
import type { PrSessionRegistryShape } from "./PrSessionRegistry.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProvenanceFooter");
const repositoryPattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/u;

class GhPrBody extends S.Class<GhPrBody>($I`GhPrBody`)(
  { body: S.NullOr(S.String) },
  $I.annote("GhPrBody", { description: "Narrow gh pr view response carrying the body." })
) {}
const decodeGhPrBody = S.decodeUnknownEffect(S.fromJsonString(GhPrBody));
const encodeRecord = S.encodeEffect(S.fromJsonString(PrSessionRecord));

const readPrBody = Effect.fn("ProvenanceFooter.readPrBody")(function* (
  capture: typeof runRepoCommandCapture,
  context: RepoRunContext,
  prNumber: PrNumber
) {
  const viewed = yield* capture("gh", ["pr", "view", `${prNumber}`, "--json", "body"], context.repoRoot);
  if (viewed.exitCode !== 0) {
    return yield* YeetCommandError.make({ message: viewed.output, exitCode: viewed.exitCode });
  }
  const current = yield* decodeGhPrBody(viewed.output);
  return current.body ?? "";
});

const bodyWithoutProvenanceFooter = (body: string): string =>
  O.match(parsePrProvenanceFooter(body), {
    onNone: () => Str.trimEnd(body),
    onSome: ({ start, end }) => `${Str.trimEnd(Str.slice(0, start)(body))}${Str.slice(end)(body)}`,
  });

/**
 * Independent persistence outcomes for a locally detected PR session row.
 *
 * **Example** (Describe a partial persistence result)
 *
 * ```ts
 * import { PrRepository, PrSessionRecordingResult } from "@beep/repo-cli/test/Yeet"
 *
 * const result = PrSessionRecordingResult.make({
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   registryRowExists: false,
 *   mirrorWritten: true,
 * })
 * console.log(result.mirrorWritten) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrSessionRecordingResult extends S.Class<PrSessionRecordingResult>($I`PrSessionRecordingResult`)(
  { repository: PrRepository, registryRowExists: S.Boolean, mirrorWritten: S.Boolean },
  $I.annote("PrSessionRecordingResult", { description: "Independent registry and run-mirror persistence outcomes." })
) {}

/**
 * Attempt registry append and run-directory mirroring independently.
 *
 * **Details**
 *
 * Both operations are attempted exactly once. Each failure emits an accurately
 * attributed warning and becomes a boolean outcome instead of failing publish.
 *
 * **Example** (Preserve a successful mirror after append failure)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { persistPrSessionRecord, PrRepository } from "@beep/repo-cli/test/Yeet"
 *
 * const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * const persistence = persistPrSessionRecord(repository, Effect.fail("denied"), Effect.void)
 * console.log(Effect.isEffect(persistence)) // true
 * ```
 *
 * @param repository - Repository identity returned even when either persistence operation fails.
 * @param append - Registry append effect attempted first.
 * @param mirror - Run-directory mirror effect attempted independently of append.
 * @returns Separate registry and mirror success outcomes.
 * @category workflows
 * @since 0.0.0
 */
export const persistPrSessionRecord = Effect.fn("ProvenanceFooter.persistRecord")(function* <
  AppendError,
  AppendRequirements,
  MirrorError,
  MirrorRequirements,
>(
  repository: PrRepository,
  append: Effect.Effect<void, AppendError, AppendRequirements>,
  mirror: Effect.Effect<void, MirrorError, MirrorRequirements>
) {
  const appendExit = yield* Effect.exit(append);
  if (Exit.isFailure(appendExit))
    yield* Console.warn(`[yeet] provenance registry append skipped: ${Cause.pretty(appendExit.cause)}`);
  const mirrorExit = yield* Effect.exit(mirror);
  if (Exit.isFailure(mirrorExit))
    yield* Console.warn(`[yeet] provenance run mirror skipped: ${Cause.pretty(mirrorExit.cause)}`);
  return PrSessionRecordingResult.make({
    repository,
    registryRowExists: Exit.isSuccess(appendExit),
    mirrorWritten: Exit.isSuccess(mirrorExit),
  });
});

/**
 * Resolve the current GitHub repository from the origin URL.
 *
 * **Example** (Build repository detection)
 *
 * ```ts
 * import { detectPrRepository } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const detection = detectPrRepository("/worktrees/beep-effect10")
 * console.log(Effect.isEffect(detection)) // true
 * ```
 *
 * @param cwd - Checkout whose `origin` remote identifies the GitHub repository.
 * @returns The normalized `github.com` repository identity or a typed command error.
 * @category detection
 * @since 0.0.0
 */
export const detectPrRepository = Effect.fn("ProvenanceFooter.detectRepository")(function* (cwd: string) {
  const origin = Str.trim(yield* runGitOutput(cwd, ["config", "--get", "remote.origin.url"]));
  const match = Str.match(repositoryPattern)(origin);
  if (O.isNone(match) || match.value[1] === undefined || match.value[2] === undefined) {
    return yield* YeetCommandError.make({ message: "Expected a github.com origin URL." });
  }
  return PrRepository.make({ host: "github.com", owner: match.value[1], name: match.value[2] });
});

/**
 * Detect and assemble a registry row without writing it.
 *
 * **Example** (Build a current-session record)
 *
 * ```ts
 * import {
 *   makeCurrentPrSessionRecord,
 *   PrRepository,
 *   RepoRunContext,
 * } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feat/yeet-pr-resume-footer",
 *   cwd: "/worktrees/beep-effect10",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/worktrees/beep-effect10",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
 * })
 * const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * const record = makeCurrentPrSessionRecord(context, repository, O.some(42), O.none(), "created")
 * console.log(Effect.isEffect(record)) // true
 * ```
 *
 * @param context - Hydrated Yeet run context supplying repository and branch coordinates.
 * @param repository - Normalized GitHub repository stored in the local row.
 * @param prNumber - Pull-request number when GitHub has already assigned one.
 * @param prUrl - Pull-request URL when creation returned one.
 * @param role - Lifecycle action performed by the current session.
 * @returns A detected local registry row without writing workstation state.
 * @category constructors
 * @since 0.0.0
 */
export const makeCurrentPrSessionRecord = Effect.fn("ProvenanceFooter.makeRecord")(function* (
  context: RepoRunContext,
  repository: PrRepository,
  prNumber: O.Option<PrNumber>,
  prUrl: O.Option<string>,
  role: PrProvenanceRole
) {
  const detector = yield* makePrProvenanceServiceLive();
  const provenance = yield* detector.detect(context.repoRoot, context.branch);
  const headSha = Str.trim(yield* runGitOutput(context.repoRoot, ["rev-parse", "HEAD"]));
  const recordedAt = yield* DateTime.now;
  return PrSessionRecord.make({
    ...provenance,
    schemaVersion: 1,
    repository,
    prNumber,
    prUrl,
    headSha,
    runId: runIdForContext(context),
    role,
    recordedAt,
  });
});

/**
 * Append a current-session row and mirror it into the Yeet run directory.
 *
 * **Details**
 *
 * Registry and mirror failures are warnings: provenance must never turn a
 * successful publish or monitor operation into a failure.
 *
 * **Example** (Build a non-fatal recording workflow)
 *
 * ```ts
 * import { recordCurrentPrSession, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feat/yeet-pr-resume-footer",
 *   cwd: "/worktrees/beep-effect10",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/worktrees/beep-effect10",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
 * })
 * const recording = recordCurrentPrSession(context, 42, O.none(), "pushed")
 * console.log(Effect.isEffect(recording)) // true
 * ```
 *
 * @param context - Hydrated Yeet run context for the action being recorded.
 * @param prNumber - Positive pull-request number linked to the local session.
 * @param prUrl - Pull-request URL when the caller has one available.
 * @param role - Lifecycle action appended to the registry history.
 * @param registryOverride - Optional in-memory registry used by fixture-safe tests.
 * @returns Repository and independent persistence outcomes; detection failures become `None`.
 * @category workflows
 * @since 0.0.0
 */
export const recordCurrentPrSession = Effect.fn("ProvenanceFooter.recordCurrentSession")(function* (
  context: RepoRunContext,
  prNumber: PrNumber,
  prUrl: O.Option<string>,
  role: PrProvenanceRole,
  registryOverride?: PrSessionRegistryShape
) {
  return yield* Effect.gen(function* () {
    const repository = yield* detectPrRepository(context.repoRoot);
    const record = yield* makeCurrentPrSessionRecord(context, repository, O.some(prNumber), prUrl, role);
    const registry = registryOverride ?? (yield* makePrSessionRegistryLive());
    return yield* persistPrSessionRecord(
      repository,
      registry.append(record),
      Effect.gen(function* () {
        const mirror = yield* runArtifactPathForContext(context, "provenance.json");
        yield* writeTextFile(mirror, yield* encodeRecord(record));
      })
    );
  }).pipe(
    Effect.tapCause((cause) => Console.warn(`[yeet] provenance detection skipped: ${Cause.pretty(cause)}`)),
    Effect.option
  );
});

/**
 * Rebuild and stamp a PR footer solely from local registry rows.
 *
 * **Details**
 *
 * The existing PR body is used only as splice framing. Its visible labels and
 * JSON twin never become registry data or process arguments.
 *
 * **Example** (Build footer re-assertion)
 *
 * ```ts
 * import {
 *   ensureProvenanceFooter,
 *   PrRepository,
 *   RepoRunContext,
 * } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feat/yeet-pr-resume-footer",
 *   cwd: "/worktrees/beep-effect10",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/worktrees/beep-effect10",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
 * })
 * const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * const stamping = ensureProvenanceFooter(context, repository, 42)
 * console.log(Effect.isEffect(stamping)) // true
 * ```
 *
 * @param context - Hydrated Yeet run context used for local artifacts and `gh` calls.
 * @param repository - Registry partition whose rows supply the public projection.
 * @param prNumber - Positive pull-request number used for lookup and the typed resume fence.
 * @param capture - Subprocess runner, injectable for deterministic GitHub body tests.
 * @param registryOverride - Optional in-memory registry used by fixture-safe tests.
 * @returns An effect that re-asserts the footer when local rows exist and content changed.
 * @category workflows
 * @since 0.0.0
 */
export const ensureProvenanceFooter = Effect.fn("ProvenanceFooter.ensure")(function* (
  context: RepoRunContext,
  repository: PrRepository,
  prNumber: PrNumber,
  capture: typeof runRepoCommandCapture = runRepoCommandCapture,
  registryOverride?: PrSessionRegistryShape
): Effect.fn.Return<
  O.Option<string>,
  never,
  FileSystem.FileSystem | Path.Path | import("effect/unstable/process").ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* Effect.gen(function* () {
    const registry = registryOverride ?? (yield* makePrSessionRegistryLive());
    const rows = yield* registry.lookup(repository, prNumber);
    if (A.isReadonlyArrayEmpty(rows)) {
      const warning = `[yeet] provenance footer stamp skipped for PR #${prNumber}: no local registry rows were available`;
      yield* Console.warn(warning);
      return O.some(warning);
    }
    const labels = yield* runGitOutput(context.repoRoot, ["config", "--get", "beep.provenance.labels"]).pipe(
      Effect.map((value) => Str.trim(value) !== "off"),
      Effect.orElseSucceed(() => true)
    );
    const first = A.head(rows);
    if (O.isNone(first)) return O.none<string>();
    const publicValue = toPublicPrProvenance([first.value, ...A.drop(rows, 1)], O.some(prNumber), labels);
    const rendered = renderPrProvenance(publicValue);
    const body = yield* readPrBody(capture, context, prNumber);
    if (Str.Equivalence(splicePrProvenanceFooter(body, rendered), body)) return O.none<string>();
    const freshBody = yield* readPrBody(capture, context, prNumber);
    const next = splicePrProvenanceFooter(freshBody, rendered);
    if (Str.Equivalence(next, freshBody)) return O.none<string>();
    const bodyPath = yield* runArtifactPathForContext(context, "pr-provenance-body.md");
    yield* writeTextFile(bodyPath, next);
    const edited = yield* capture("gh", ["pr", "edit", `${prNumber}`, "--body-file", bodyPath], context.repoRoot);
    if (edited.exitCode !== 0)
      return yield* YeetCommandError.make({ message: edited.output, exitCode: edited.exitCode });
    const writtenBody = yield* readPrBody(capture, context, prNumber);
    if (!Str.Equivalence(bodyWithoutProvenanceFooter(writtenBody), bodyWithoutProvenanceFooter(freshBody))) {
      const warning = `[yeet] provenance footer for PR #${prNumber} may have overwritten a concurrent body edit; leaving the latest body unchanged`;
      yield* Console.warn(warning);
      return O.some(warning);
    }
    return O.none<string>();
  }).pipe(
    Effect.catchCause((cause) => {
      const warning = `[yeet] provenance footer stamp skipped: ${Cause.pretty(cause)}`;
      return Console.warn(warning).pipe(Effect.as(O.some(warning)));
    })
  );
});

/**
 * Record the current monitor session and re-assert its public provenance footer once.
 *
 * **Example** (Build the monitor provenance prelude)
 *
 * ```ts
 * import { recordMonitoredPrSession, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main", branch: "feat/footer", cwd: ".", head: "HEAD",
 *   originalArgv: [], packetDir: ".beep/yeet", repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * console.log(Effect.isEffect(recordMonitoredPrSession(context, 42))) // true
 * ```
 *
 * @param context - Hydrated Yeet context for the monitor invocation.
 * @param prNumber - Pull-request number observed once before polling begins.
 * @param capture - Subprocess runner, injectable for deterministic GitHub tests.
 * @param registryOverride - Optional in-memory registry used by fixture-safe tests.
 * @returns The footer warning when stamping could not be completed, otherwise `None`.
 * @category workflows
 * @since 0.0.0
 */
export const recordMonitoredPrSession = Effect.fn("ProvenanceFooter.recordMonitoredSession")(function* (
  context: RepoRunContext,
  prNumber: PrNumber,
  capture: typeof runRepoCommandCapture = runRepoCommandCapture,
  registryOverride?: PrSessionRegistryShape
) {
  const recording = yield* recordCurrentPrSession(context, prNumber, O.none(), "monitored", registryOverride);
  if (O.isNone(recording)) {
    return O.some(`[yeet] provenance footer stamp skipped for PR #${prNumber}: session recording was unavailable`);
  }
  return yield* ensureProvenanceFooter(context, recording.value.repository, prNumber, capture, registryOverride);
});
