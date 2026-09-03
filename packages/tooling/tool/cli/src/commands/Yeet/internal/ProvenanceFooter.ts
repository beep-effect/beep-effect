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
import { Cause, Console, DateTime, Effect, Exit, Order, pipe } from "effect";
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
import type { DomainError } from "@beep/repo-utils";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { PrNumber, PrProvenanceRole } from "./Provenance.ts";
import type { PrSessionRegistryShape } from "./PrSessionRegistry.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProvenanceFooter");
const repositoryPattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/u;

class GhPrBody extends S.Class<GhPrBody>($I`GhPrBody`)(
  { body: S.NullOr(S.String) },
  $I.annote("GhPrBody", { description: "Narrow gh pr view response carrying the body." })
) {}

class GhPrBodySnapshot extends S.Class<GhPrBodySnapshot>($I`GhPrBodySnapshot`)(
  {
    body: S.NullOr(S.String),
    createdAt: S.DateTimeUtcFromString,
    lastEditedAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
  },
  $I.annote("GhPrBodySnapshot", {
    description: "Fresh pull-request body plus the GitHub edit timestamp used as a race-detection baseline.",
  })
) {}

/**
 * One full pull-request body revision from GitHub's user-content edit history.
 *
 * **Details**
 *
 * GitHub names the full-body field `diff`; the decoded model calls it `body`
 * so downstream race recovery cannot mistake it for a unified patch.
 *
 * **Example** (Describe a pull-request body revision)
 *
 * ```ts
 * import { PrBodyEdit } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const edit = PrBodyEdit.make({
 *   body: "Updated summary",
 *   editedAt: DateTime.makeUnsafe("2026-09-03T12:00:00Z"),
 *   editor: O.some("octocat"),
 * })
 * console.log(edit.body) // Updated summary
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrBodyEdit extends S.Class<PrBodyEdit>($I`PrBodyEdit`)(
  {
    editedAt: S.DateTimeUtcFromString,
    editor: S.OptionFromNullOr(S.String),
    body: S.String,
  },
  $I.annote("PrBodyEdit", { description: "A timestamped full pull-request body revision and its optional editor." })
) {}

class GhPrBodyEditNode extends S.Class<GhPrBodyEditNode>($I`GhPrBodyEditNode`)(
  {
    editedAt: S.DateTimeUtcFromString,
    editor: S.NullOr(S.Struct({ login: S.String })),
    diff: S.String,
  },
  $I.annote("GhPrBodyEditNode", { description: "Raw GitHub pull-request user-content edit node." })
) {}

class GhPrBodyEditsDocument extends S.Class<GhPrBodyEditsDocument>($I`GhPrBodyEditsDocument`)(
  {
    data: S.Struct({
      repository: S.Struct({
        pullRequest: S.Struct({ userContentEdits: S.Struct({ nodes: S.Array(GhPrBodyEditNode) }) }),
      }),
    }),
  },
  $I.annote("GhPrBodyEditsDocument", { description: "GitHub GraphQL response containing recent PR body edits." })
) {}

const decodeGhPrBody = S.decodeUnknownEffect(S.fromJsonString(GhPrBody));
const decodeGhPrBodySnapshot = S.decodeUnknownEffect(S.fromJsonString(GhPrBodySnapshot));
const decodeGhPrBodyEditsDocument = S.decodeUnknownEffect(S.fromJsonString(GhPrBodyEditsDocument));
const encodeRecord = S.encodeEffect(S.fromJsonString(PrSessionRecord));

const prBodyEditsQuery =
  "query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){userContentEdits(last:5){nodes{editedAt editor{login} diff}}}}}";

const readPrBodySnapshot = Effect.fn("ProvenanceFooter.readPrBodySnapshot")(function* (
  capture: typeof runRepoCommandCapture,
  context: RepoRunContext,
  prNumber: PrNumber
) {
  const viewed = yield* capture(
    "gh",
    ["pr", "view", `${prNumber}`, "--json", "body,createdAt,lastEditedAt"],
    context.repoRoot
  );
  if (viewed.exitCode !== 0) {
    return yield* YeetCommandError.make({ message: viewed.output, exitCode: viewed.exitCode });
  }
  return yield* decodeGhPrBodySnapshot(viewed.output);
});

const readPrBodyEdits = Effect.fn("ProvenanceFooter.readPrBodyEdits")(function* (
  capture: typeof runRepoCommandCapture,
  context: RepoRunContext,
  repository: PrRepository,
  prNumber: PrNumber
) {
  const response = yield* capture(
    "gh",
    [
      "api",
      "graphql",
      "-f",
      `query=${prBodyEditsQuery}`,
      "-F",
      `owner=${repository.owner}`,
      "-F",
      `name=${repository.name}`,
      "-F",
      `number=${prNumber}`,
    ],
    context.repoRoot
  );
  if (response.exitCode !== 0) {
    return yield* YeetCommandError.make({ message: response.output, exitCode: response.exitCode });
  }
  const document = yield* decodeGhPrBodyEditsDocument(response.output);
  return A.map(document.data.repository.pullRequest.userContentEdits.nodes, (edit) =>
    PrBodyEdit.make({
      body: edit.diff,
      editedAt: edit.editedAt,
      editor: pipe(
        O.fromNullishOr(edit.editor),
        O.map((editor) => editor.login)
      ),
    })
  );
});

const prBodyEditOrder = Order.mapInput(DateTime.Order, (edit: PrBodyEdit) => edit.editedAt);
const editedAfter = Order.isGreaterThan(DateTime.Order);

const newestEditSince = (
  edits: ReadonlyArray<PrBodyEdit>,
  baseline: DateTime.Utc,
  bodyMatches: (body: string) => boolean
): O.Option<PrBodyEdit> =>
  pipe(
    edits,
    A.filter((edit) => editedAfter(edit.editedAt, baseline) && bodyMatches(edit.body)),
    A.sort(prBodyEditOrder),
    A.last
  );

const newestForeignEditSince = (
  edits: ReadonlyArray<PrBodyEdit>,
  baseline: DateTime.Utc,
  writtenBody: string
): O.Option<PrBodyEdit> => newestEditSince(edits, baseline, (body) => !Str.Equivalence(body, writtenBody));

const newestEditOfBodySince = (
  edits: ReadonlyArray<PrBodyEdit>,
  baseline: DateTime.Utc,
  writtenBody: string
): O.Option<PrBodyEdit> => newestEditSince(edits, baseline, (body) => Str.Equivalence(body, writtenBody));

const bodyEditorLabel = (edit: PrBodyEdit): string => O.getOrElse(edit.editor, () => "an unknown editor");

const maxReconcileRounds = 3;

const writePrBody = Effect.fn("ProvenanceFooter.writePrBody")(function* (
  capture: typeof runRepoCommandCapture,
  context: RepoRunContext,
  prNumber: PrNumber,
  bodyPath: string,
  body: string
) {
  yield* writeTextFile(bodyPath, body);
  const edited = yield* capture("gh", ["pr", "edit", `${prNumber}`, "--body-file", bodyPath], context.repoRoot);
  if (edited.exitCode !== 0) {
    return yield* YeetCommandError.make({ message: edited.output, exitCode: edited.exitCode });
  }
});

const reconcilePrBodyAfterWrite = Effect.fn("ProvenanceFooter.reconcileAfterWrite")(function* (
  capture: typeof runRepoCommandCapture,
  context: RepoRunContext,
  repository: PrRepository,
  prNumber: PrNumber,
  bodyPath: string,
  rendered: string,
  sourceBody: string,
  baseline: DateTime.Utc,
  round: number,
  preservedForeign: O.Option<PrBodyEdit>
): Effect.fn.Return<
  O.Option<string>,
  DomainError | S.SchemaError | YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const writtenBody = splicePrProvenanceFooter(sourceBody, rendered);
  yield* writePrBody(capture, context, prNumber, bodyPath, writtenBody);
  const edits = yield* readPrBodyEdits(capture, context, repository, prNumber);
  const foreign = O.isNone(preservedForeign)
    ? newestForeignEditSince(edits, baseline, writtenBody)
    : pipe(
        newestEditOfBodySince(edits, baseline, writtenBody),
        O.flatMap((ownEdit) => newestForeignEditSince(edits, ownEdit.editedAt, writtenBody))
      );
  if (O.isSome(foreign)) {
    if (round < maxReconcileRounds) {
      return yield* reconcilePrBodyAfterWrite(
        capture,
        context,
        repository,
        prNumber,
        bodyPath,
        rendered,
        foreign.value.body,
        foreign.value.editedAt,
        round + 1,
        foreign
      );
    }
    yield* writePrBody(capture, context, prNumber, bodyPath, foreign.value.body);
    const warning = `[yeet] provenance footer for PR #${prNumber} yielded after ${maxReconcileRounds} reconcile rounds to a concurrent body edit by ${bodyEditorLabel(foreign.value)}; the footer will be retried by yeet monitor`;
    yield* Console.warn(warning);
    return O.some(warning);
  }
  const readback = yield* readPrBody(capture, context, prNumber);
  if (!Str.Equivalence(bodyWithoutProvenanceFooter(readback), bodyWithoutProvenanceFooter(sourceBody))) {
    const warning = O.isSome(preservedForeign)
      ? `[yeet] provenance footer repair for PR #${prNumber} did not preserve the expected concurrent body; leaving the latest body unchanged`
      : `[yeet] provenance footer for PR #${prNumber} may have overwritten a concurrent body edit; leaving the latest body unchanged`;
    yield* Console.warn(warning);
    return O.some(warning);
  }
  if (O.isSome(preservedForeign)) {
    const warning = `[yeet] provenance footer for PR #${prNumber} preserved a concurrent body edit by ${bodyEditorLabel(preservedForeign.value)}`;
    yield* Console.warn(warning);
    return O.some(warning);
  }
  return O.none<string>();
});

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
  return PrRepository.make({
    host: "github.com",
    owner: Str.toLowerCase(match.value[1]),
    name: Str.toLowerCase(match.value[2]),
  });
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
 * JSON twin never become registry data or process arguments. After every
 * write, a bounded reconcile yields to newer foreign edits: the final body is
 * either that foreign body with the footer or the foreign body restored
 * verbatim when contention outlasts the bound.
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
    const fresh = yield* readPrBodySnapshot(capture, context, prNumber);
    const freshBody = fresh.body ?? "";
    const next = splicePrProvenanceFooter(freshBody, rendered);
    if (Str.Equivalence(next, freshBody)) return O.none<string>();
    const bodyPath = yield* runArtifactPathForContext(context, "pr-provenance-body.md");
    const baseline = O.getOrElse(fresh.lastEditedAt, () => fresh.createdAt);
    return yield* reconcilePrBodyAfterWrite(
      capture,
      context,
      repository,
      prNumber,
      bodyPath,
      rendered,
      freshBody,
      baseline,
      0,
      O.none()
    );
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
