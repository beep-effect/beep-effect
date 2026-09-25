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
import { LiteralKit } from "@beep/schema";
import { Cause, Console, DateTime, Effect, Exit, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeContainedFileString } from "../../../internal/cli/FsGuards.ts";
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
import type { Crypto } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { PrNumber, PrProvenanceRole } from "./Provenance.ts";
import type { PrSessionRegistryShape } from "./PrSessionRegistry.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProvenanceFooter");
const repositoryPattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/u;

/**
 * Stamp outcomes that do not confirm the expected footer on the pull request.
 *
 * **Details**
 *
 * `skipped` means the stamp stopped before it could confirm anything: no
 * registry rows, no session record, or a GitHub call failed, which can happen
 * after a write has already gone out. `yielded` means contention outlasted the
 * reconcile bound, and `drifted` means the post-write readback did not match
 * what was written: either the non-footer body changed or the expected footer
 * is missing. None of them proves the footer absent; all of them mean the
 * stamp could not vouch for it, so the publish lane fails.
 *
 * **Example** (Classify a stamp status)
 *
 * ```ts
 * import { ProvenanceStampFailureStatus } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProvenanceStampFailureStatus)("drifted")) // true
 * console.log(S.is(ProvenanceStampFailureStatus)("preserved")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProvenanceStampFailureStatus = LiteralKit(["skipped", "drifted", "yielded"]).pipe(
  $I.annoteSchema("ProvenanceStampFailureStatus", {
    description: "Provenance stamp statuses that could not confirm the footer: skipped, drifted, or yielded.",
  })
);

/**
 * Every outcome a provenance footer stamp can report.
 *
 * **Details**
 *
 * `current` means nothing needed writing and `preserved` means the footer
 * landed while keeping a concurrent body edit, so both are successes. The
 * remaining statuses are the failure family in {@link ProvenanceStampFailureStatus}.
 *
 * **Example** (Read the literal list)
 *
 * ```ts
 * import { ProvenanceStampStatus } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProvenanceStampStatus)("preserved")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProvenanceStampStatus = LiteralKit(["current", "preserved", "skipped", "drifted", "yielded"]).pipe(
  $I.annoteSchema("ProvenanceStampStatus", {
    description: "Outcome of one provenance footer stamp attempt on a pull request.",
  })
);

/**
 * Typed result of one provenance footer stamp: a status plus the human-readable line already logged.
 *
 * **Example** (Build a preserved outcome)
 *
 * ```ts
 * import { ProvenanceStampOutcome } from "@beep/repo-cli/test/Yeet"
 *
 * const outcome = ProvenanceStampOutcome.make({
 *   status: "preserved",
 *   message: "[yeet] provenance footer for PR #42 preserved a concurrent body edit by bob",
 * })
 * console.log(outcome.status) // "preserved"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ProvenanceStampOutcome extends S.Class<ProvenanceStampOutcome>($I`ProvenanceStampOutcome`)(
  {
    status: ProvenanceStampStatus,
    message: S.String,
  },
  $I.annote("ProvenanceStampOutcome", {
    description: "Status and logged message of one provenance footer stamp attempt.",
  })
) {}

const isProvenanceStampFailureStatus = S.is(ProvenanceStampFailureStatus);

/**
 * Decide whether a stamp outcome should count as a failed publish lane.
 *
 * **Example** (Only the failure family fails the lane)
 *
 * ```ts
 * import { isProvenanceStampFailure, ProvenanceStampOutcome } from "@beep/repo-cli/test/Yeet"
 *
 * const preserved = ProvenanceStampOutcome.make({ status: "preserved", message: "kept a bot edit" })
 * const drifted = ProvenanceStampOutcome.make({ status: "drifted", message: "body drifted" })
 * console.log(isProvenanceStampFailure(preserved)) // false
 * console.log(isProvenanceStampFailure(drifted)) // true
 * ```
 *
 * @param outcome - Stamp outcome returned by {@link ensureProvenanceFooter}.
 * @returns `true` when the status is in {@link ProvenanceStampFailureStatus}.
 * @category schemas
 * @since 0.0.0
 */
export const isProvenanceStampFailure = (outcome: ProvenanceStampOutcome): boolean =>
  isProvenanceStampFailureStatus(outcome.status);

const skippedStamp = (message: string): ProvenanceStampOutcome =>
  ProvenanceStampOutcome.make({ status: "skipped", message });

const currentStamp = (prNumber: PrNumber): ProvenanceStampOutcome =>
  ProvenanceStampOutcome.make({ status: "current", message: `provenance footer current for PR #${prNumber}` });

class GhPrBody extends S.Class<GhPrBody>($I`GhPrBody`)(
  { body: S.NullOr(S.String) },
  $I.annote("GhPrBody", { description: "Narrow gh pr view response carrying the body." })
) {}

// `gh pr view --json` exposes `updatedAt` but not `lastEditedAt` (gh 2.99).
// Any body edit bumps `updatedAt`, so it is a sound inclusive baseline: an
// edit that lands after this snapshot is timestamped at or after it, and the
// snapshot's own body is already a known body for the reconcile.
class GhPrBodySnapshot extends S.Class<GhPrBodySnapshot>($I`GhPrBodySnapshot`)(
  {
    body: S.NullOr(S.String),
    updatedAt: S.DateTimeUtcFromString,
  },
  $I.annote("GhPrBodySnapshot", {
    description: "Fresh pull-request body plus the GitHub update timestamp used as a race-detection baseline.",
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
  const viewed = yield* capture("gh", ["pr", "view", `${prNumber}`, "--json", "body,updatedAt"], context.repoRoot);
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
const editedAtOrAfter = Order.isGreaterThanOrEqualTo(DateTime.Order);

// Every body this stamp wrote or spliced from is known; any other body at or
// after the baseline is a concurrent edit that must be re-spliced, whether it
// landed before or after the stamp's own write. The baseline is inclusive
// because GitHub records edit times at second resolution, so an edit in the
// same second as the baseline is still foreign.
const newestUnknownEditSince = (
  edits: ReadonlyArray<PrBodyEdit>,
  baseline: DateTime.Utc,
  knownBodies: HashSet.HashSet<string>
): O.Option<PrBodyEdit> =>
  pipe(
    edits,
    A.filter((edit) => editedAtOrAfter(edit.editedAt, baseline) && !HashSet.has(knownBodies, edit.body)),
    A.sort(prBodyEditOrder),
    A.last
  );

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

type ReconcileRequirements =
  | Crypto.Crypto
  | FileSystem.FileSystem
  | Path.Path
  | Crypto.Crypto
  | ChildProcessSpawner.ChildProcessSpawner;

const yieldToConcurrentEdit = Effect.fn("ProvenanceFooter.yieldToConcurrentEdit")(function* (
  capture: typeof runRepoCommandCapture,
  context: RepoRunContext,
  prNumber: PrNumber,
  bodyPath: string,
  writtenBody: string,
  foreign: PrBodyEdit
): Effect.fn.Return<ProvenanceStampOutcome, DomainError | S.SchemaError | YeetCommandError, ReconcileRequirements> {
  const finalReadback = yield* readPrBody(capture, context, prNumber);
  const restoring = Str.Equivalence(finalReadback, writtenBody);
  if (restoring) {
    yield* writePrBody(capture, context, prNumber, bodyPath, foreign.body);
  }
  const outcome = restoring
    ? `restored the concurrent body edit by ${bodyEditorLabel(foreign)} that its last write had overtaken`
    : `left the newer concurrent body edit by ${bodyEditorLabel(foreign)} in place`;
  const warning = `[yeet] provenance footer for PR #${prNumber} yielded after ${maxReconcileRounds} reconcile rounds and ${outcome}; the next yeet monitor re-asserts the footer`;
  yield* Console.warn(warning);
  return ProvenanceStampOutcome.make({ status: "yielded", message: warning });
});

const verifyReconciledBody = Effect.fn("ProvenanceFooter.verifyReconciledBody")(function* (
  capture: typeof runRepoCommandCapture,
  context: RepoRunContext,
  prNumber: PrNumber,
  rendered: string,
  sourceBody: string,
  preservedForeign: O.Option<PrBodyEdit>
): Effect.fn.Return<ProvenanceStampOutcome, DomainError | S.SchemaError | YeetCommandError, ReconcileRequirements> {
  const readback = yield* readPrBody(capture, context, prNumber);
  const bodyDrifted = !Str.Equivalence(bodyWithoutProvenanceFooter(readback), bodyWithoutProvenanceFooter(sourceBody));
  const footerMissing = !Str.Equivalence(splicePrProvenanceFooter(readback, rendered), readback);
  const outcome = bodyDrifted
    ? ProvenanceStampOutcome.make({
        status: "drifted",
        message: O.isSome(preservedForeign)
          ? `[yeet] provenance footer repair for PR #${prNumber} did not preserve the expected concurrent body; leaving the latest body unchanged`
          : `[yeet] provenance footer for PR #${prNumber} may have overwritten a concurrent body edit; leaving the latest body unchanged`,
      })
    : footerMissing
      ? ProvenanceStampOutcome.make({
          status: "drifted",
          message: `[yeet] provenance footer for PR #${prNumber} is not on the latest body after the stamp; leaving the latest body unchanged`,
        })
      : O.match(preservedForeign, {
          onNone: () => currentStamp(prNumber),
          onSome: (edit) =>
            ProvenanceStampOutcome.make({
              status: "preserved",
              message: `[yeet] provenance footer for PR #${prNumber} preserved a concurrent body edit by ${bodyEditorLabel(edit)}`,
            }),
        });
  if (outcome.status !== "current") yield* Console.warn(outcome.message);
  return outcome;
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
  knownBodies: HashSet.HashSet<string>,
  preservedForeign: O.Option<PrBodyEdit>
): Effect.fn.Return<ProvenanceStampOutcome, DomainError | S.SchemaError | YeetCommandError, ReconcileRequirements> {
  const writtenBody = splicePrProvenanceFooter(sourceBody, rendered);
  const known = pipe(knownBodies, HashSet.add(sourceBody), HashSet.add(writtenBody));
  yield* writePrBody(capture, context, prNumber, bodyPath, writtenBody);
  const edits = yield* readPrBodyEdits(capture, context, repository, prNumber);
  const foreign = newestUnknownEditSince(edits, baseline, known);
  if (O.isNone(foreign)) {
    return yield* verifyReconciledBody(capture, context, prNumber, rendered, sourceBody, preservedForeign);
  }
  if (round >= maxReconcileRounds) {
    return yield* yieldToConcurrentEdit(capture, context, prNumber, bodyPath, writtenBody, foreign.value);
  }
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
    known,
    foreign
  );
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
    runId: yield* runIdForContext(context),
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
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const mirror = yield* runArtifactPathForContext(context, "provenance.json");
        yield* fs.makeDirectory(path.dirname(mirror), { recursive: true, mode: 0o700 });
        yield* writeContainedFileString(path.dirname(mirror), mirror, yield* encodeRecord(record));
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
 * either that foreign body with the footer or, when contention outlasts the
 * bound, the concurrent edit itself: an edit the final write overtook is
 * restored when that write is still the latest body, and anything newer is
 * left untouched (the next monitor re-asserts the footer).
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
 * @returns The typed stamp outcome; {@link ProvenanceStampFailureStatus} members mean the footer could not be confirmed.
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
  ProvenanceStampOutcome,
  never,
  | Crypto.Crypto
  | FileSystem.FileSystem
  | Path.Path
  | import("effect/unstable/process").ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* Effect.gen(function* () {
    const registry = registryOverride ?? (yield* makePrSessionRegistryLive());
    const rows = yield* registry.lookup(repository, prNumber);
    if (!A.isReadonlyArrayNonEmpty(rows)) {
      const warning = `[yeet] provenance footer stamp skipped for PR #${prNumber}: no local registry rows were available`;
      yield* Console.warn(warning);
      return skippedStamp(warning);
    }
    const labels = yield* runGitOutput(context.repoRoot, ["config", "--get", "beep.provenance.labels"]).pipe(
      Effect.map((value) => Str.trim(value) !== "off"),
      Effect.orElseSucceed(() => true)
    );
    const publicValue = toPublicPrProvenance(rows, O.some(prNumber), labels);
    const rendered = renderPrProvenance(publicValue);
    const body = yield* readPrBody(capture, context, prNumber);
    if (Str.Equivalence(splicePrProvenanceFooter(body, rendered), body)) return currentStamp(prNumber);
    const fresh = yield* readPrBodySnapshot(capture, context, prNumber);
    const freshBody = fresh.body ?? "";
    const next = splicePrProvenanceFooter(freshBody, rendered);
    if (Str.Equivalence(next, freshBody)) return currentStamp(prNumber);
    const bodyPath = yield* runArtifactPathForContext(context, "pr-provenance-body.md");
    const baseline = fresh.updatedAt;
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
      HashSet.empty<string>(),
      O.none()
    );
  }).pipe(
    Effect.catchCause((cause) => {
      const warning = `[yeet] provenance footer stamp skipped: ${Cause.pretty(cause)}`;
      return Console.warn(warning).pipe(Effect.as(skippedStamp(warning)));
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
 * @returns The typed stamp outcome, `skipped` when the session could not be recorded.
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
    return skippedStamp(
      `[yeet] provenance footer stamp skipped for PR #${prNumber}: session recording was unavailable`
    );
  }
  return yield* ensureProvenanceFooter(context, recording.value.repository, prNumber, capture, registryOverride);
});
