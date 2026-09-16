/**
 * Heavy-check admission: the one decision that says whether the `Heavy / *`
 * matrix runs for a head (ttc B8).
 *
 * **Details**
 *
 * Tier 2 (the heavy runner pool) is capacity-bound, so it runs only under an
 * admission verdict computed from a typed view of the GitHub event. The same
 * pure function serves two callers: `bun run beep ci admission` in the
 * `check.yml` admission job, and the `yeet monitor` loop, which rebuilds the
 * event from `gh pr view` labels plus a once-per-head merge-base diff. Both
 * therefore see the same verdict for the same head. The verdict is
 * three-valued because the two GitHub skip mechanisms mean different things:
 * a job skipped by `if:` leaves its contexts "Expected" (merge-blocked), while
 * a reusable workflow called with `admitted: false` reports every lane
 * `skipped` (ruleset satisfied).
 *
 * **Gotchas**
 *
 * `draft` is carried for the record and never admits: nearly every PR here is
 * non-draft, so admitting on it would be the status quo. The label is the
 * only pull-request admission source (ruling 51).
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect, FileSystem, Match, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../internal/repo-run/index.ts";
import { CiCommandError } from "./Ci.errors.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Ci/HeavyAdmission");

/**
 * The pull-request label that admits a head to the heavy matrix.
 *
 * **Example** (Print the admitting command)
 *
 * ```ts
 * import { HEAVY_ADMISSION_LABEL } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(`gh pr edit --add-label ${HEAVY_ADMISSION_LABEL}`) // gh pr edit --add-label ready-for-heavy
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HEAVY_ADMISSION_LABEL = "ready-for-heavy";

/**
 * The check-context prefix every heavy lane reports under.
 *
 * **Example** (Recognise a heavy context)
 *
 * ```ts
 * import { HEAVY_CONTEXT_PREFIX } from "@beep/repo-cli/commands/Ci"
 *
 * console.log("Heavy / Check".startsWith(HEAVY_CONTEXT_PREFIX)) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HEAVY_CONTEXT_PREFIX = "Heavy / ";

/**
 * Why a head was admitted: the label on a pull request, a merge-group entry,
 * or a push to the default branch.
 *
 * **Example** (Check a source)
 *
 * ```ts
 * import { HeavyAdmissionSource } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(HeavyAdmissionSource.is.label("label")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HeavyAdmissionSource = LiteralKit(["label", "merge-group", "main-push"]).pipe(
  $I.annoteSchema("HeavyAdmissionSource", {
    title: "Heavy Admission Source",
    description: "The event feature that admitted a head to the heavy matrix.",
  })
);

/**
 * Why a head was admitted.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HeavyAdmissionSource = typeof HeavyAdmissionSource.Type;

/**
 * The three-valued admission verdict.
 *
 * **Details**
 *
 * `run`: the matrix runs on the heavy pool. `skip-satisfied`: the reusable
 * workflow is called with `admitted: false`, every lane reports `skipped`, and
 * the ruleset is satisfied (docs-only diffs). `hold`: the caller job is
 * skipped by `if:`, the contexts stay "Expected", and the PR is merge-blocked
 * until the label lands.
 *
 * **Example** (Check a verdict)
 *
 * ```ts
 * import { HeavyAdmissionVerdict } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(HeavyAdmissionVerdict.is.hold("hold")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HeavyAdmissionVerdict = LiteralKit(["run", "skip-satisfied", "hold"]).pipe(
  $I.annoteSchema("HeavyAdmissionVerdict", {
    title: "Heavy Admission Verdict",
    description: "Whether the heavy matrix runs, reports skipped, or is held pending the label.",
  })
);

/**
 * The three-valued admission verdict.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HeavyAdmissionVerdict = typeof HeavyAdmissionVerdict.Type;

/**
 * The GitHub event names admission understands.
 *
 * **Example** (Check an event name)
 *
 * ```ts
 * import { HeavyAdmissionEventName } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(HeavyAdmissionEventName.is.pull_request("pull_request")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HeavyAdmissionEventName = LiteralKit(["pull_request", "push", "merge_group"]).pipe(
  $I.annoteSchema("HeavyAdmissionEventName", {
    title: "Heavy Admission Event Name",
    description: "The GitHub event names the admission decision reads.",
  })
);

/**
 * The GitHub event names admission understands.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HeavyAdmissionEventName = typeof HeavyAdmissionEventName.Type;

/**
 * Typed view of what the admission decision reads.
 *
 * **Details**
 *
 * Built from the GitHub event payload in CI and from `gh pr view` plus
 * `git diff --name-only <base>...HEAD` in the monitor. `changedPaths` is the
 * merge-base diff and is empty on `push` and `merge_group`, where no
 * pull-request diff exists.
 *
 * **Example** (A labelled pull request)
 *
 * ```ts
 * import { HeavyAdmissionEvent } from "@beep/repo-cli/commands/Ci"
 *
 * const event = HeavyAdmissionEvent.make({
 *   eventName: "pull_request",
 *   labels: ["ready-for-heavy"],
 *   draft: false,
 *   changedPaths: ["packages/a/src/index.ts"]
 * })
 * console.log(event.labels.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeavyAdmissionEvent extends S.Class<HeavyAdmissionEvent>($I`HeavyAdmissionEvent`)(
  {
    eventName: HeavyAdmissionEventName,
    labels: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(A.empty<string>())),
    draft: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    changedPaths: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(A.empty<string>())),
  },
  $I.annote("HeavyAdmissionEvent", {
    description:
      "The typed event view the heavy admission decision reads: event name, labels, draft flag, merge-base diff.",
  })
) {}

/**
 * The admission decision as data: verdict, its sources, and the docs-only flag.
 *
 * **Example** (Construct a held admission)
 *
 * ```ts
 * import { HeavyAdmission } from "@beep/repo-cli/commands/Ci"
 *
 * const admission = HeavyAdmission.make({
 *   verdict: "hold",
 *   admitted: false,
 *   sources: [],
 *   docsOnly: false,
 *   changedPathCount: 3
 * })
 * console.log(admission.admitted) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeavyAdmission extends S.Class<HeavyAdmission>($I`HeavyAdmission`)(
  {
    verdict: HeavyAdmissionVerdict,
    admitted: S.Boolean,
    sources: S.Array(HeavyAdmissionSource),
    docsOnly: S.Boolean,
    changedPathCount: S.Int,
  },
  $I.annote("HeavyAdmission", {
    description: "The heavy-matrix admission verdict with its sources and the docs-only classification.",
  })
) {}

/**
 * The docs-only path classification, decided before the heavy call.
 *
 * **Details**
 *
 * The `goals_document_pattern` of `scripts/ci-change-profile.sh` verbatim
 * (packet prose: `GOAL|PLAN|README|SPEC|DECISIONS.md`, `ops/manifest.json`,
 * `goals/INDEX|README.md`), widened by `docs/**`, `explorations/**`,
 * `research/**`, `.changeset/*.md`, and `*.md` anywhere. Executables,
 * fixtures, JSON and scripts under `goals/**` stay code-bearing.
 *
 * **Example** (Classify two paths)
 *
 * ```ts
 * import { heavyDocsOnlyPattern } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(heavyDocsOnlyPattern.test("packages/a/README.md")) // true
 * console.log(heavyDocsOnlyPattern.test("goals/x/scripts/run.sh")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const heavyDocsOnlyPattern: RegExp =
  /^(goals\/(INDEX|README)\.md|goals\/[^/]+\/(GOAL|PLAN|README|SPEC|DECISIONS)\.md|goals\/[^/]+\/ops\/manifest\.json)$|^docs\/|^explorations\/|^research\/|^\.changeset\/[^/]+\.md$|\.md$/u;

/**
 * Whether one repo-relative path is docs-only under {@link heavyDocsOnlyPattern}.
 *
 * **Example** (Guard a path)
 *
 * ```ts
 * import { isHeavyDocsOnlyPath } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(isHeavyDocsOnlyPath("docs/runbooks/ci.md")) // true
 * console.log(isHeavyDocsOnlyPath("goals/x/ops/fixtures.json")) // false
 * ```
 *
 * @param path - A repo-relative path as `git diff --name-only` prints it.
 * @returns Whether the path carries no code the heavy matrix must prove.
 * @category predicates
 * @since 0.0.0
 */
export const isHeavyDocsOnlyPath = (path: string): boolean => heavyDocsOnlyPattern.test(path);

const sourcesFor = (event: HeavyAdmissionEvent): ReadonlyArray<HeavyAdmissionSource> =>
  pipe(
    Match.value(event.eventName),
    Match.when("push", () => [HeavyAdmissionSource.Enum["main-push"]]),
    Match.when("merge_group", () => [HeavyAdmissionSource.Enum["merge-group"]]),
    Match.when("pull_request", () =>
      A.contains(event.labels, HEAVY_ADMISSION_LABEL)
        ? [HeavyAdmissionSource.Enum.label]
        : A.empty<HeavyAdmissionSource>()
    ),
    Match.exhaustive
  );

const verdictFor = (admitted: boolean, docsOnly: boolean): HeavyAdmissionVerdict =>
  pipe(
    Match.value({ admitted, docsOnly }),
    Match.when({ admitted: true }, () => HeavyAdmissionVerdict.Enum.run),
    Match.when({ docsOnly: true }, () => HeavyAdmissionVerdict.Enum["skip-satisfied"]),
    Match.orElse(() => HeavyAdmissionVerdict.Enum.hold)
  );

/**
 * Decide admission for one typed event. Pure and total.
 *
 * **Details**
 *
 * `sources` is `main-push` on `push`, `merge-group` on `merge_group`, and
 * `label` on a `pull_request` carrying {@link HEAVY_ADMISSION_LABEL}. `docsOnly`
 * holds for a `pull_request` with a non-empty diff where every path matches
 * {@link heavyDocsOnlyPattern}. The verdict is `run` when any source admits,
 * else `skip-satisfied` when docs-only, else `hold`. The label always wins over
 * the docs-only classification.
 *
 * **Example** (The three verdicts)
 *
 * ```ts
 * import { decideHeavyAdmission, HeavyAdmissionEvent } from "@beep/repo-cli/commands/Ci"
 *
 * const code = ["packages/a/src/index.ts"]
 * const docs = ["docs/runbooks/ci.md", "goals/x/PLAN.md"]
 * const labelled = HeavyAdmissionEvent.make({ eventName: "pull_request", labels: ["ready-for-heavy"], draft: false, changedPaths: code })
 * const unlabelledDocs = HeavyAdmissionEvent.make({ eventName: "pull_request", labels: [], draft: false, changedPaths: docs })
 * const unlabelledCode = HeavyAdmissionEvent.make({ eventName: "pull_request", labels: [], draft: false, changedPaths: code })
 * console.log(decideHeavyAdmission(labelled).verdict) // "run"
 * console.log(decideHeavyAdmission(unlabelledDocs).verdict) // "skip-satisfied"
 * console.log(decideHeavyAdmission(unlabelledCode).verdict) // "hold"
 * ```
 *
 * @param event - The typed event view.
 * @returns The admission verdict with its sources and docs-only flag.
 * @category utilities
 * @since 0.0.0
 */
export const decideHeavyAdmission = (event: HeavyAdmissionEvent): HeavyAdmission => {
  const sources = sourcesFor(event);
  const docsOnly =
    HeavyAdmissionEventName.is.pull_request(event.eventName) &&
    A.isReadonlyArrayNonEmpty(event.changedPaths) &&
    A.every(event.changedPaths, isHeavyDocsOnlyPath);
  const verdict = verdictFor(A.isReadonlyArrayNonEmpty(sources), docsOnly);
  return HeavyAdmission.make({
    verdict,
    admitted: HeavyAdmissionVerdict.is.run(verdict),
    sources,
    docsOnly,
    changedPathCount: A.length(event.changedPaths),
  });
};

class GhEventLabel extends S.Class<GhEventLabel>($I`GhEventLabel`)(
  { name: S.String },
  $I.annote("GhEventLabel", { description: "One label on the pull request of a GitHub event payload." })
) {}

class GhEventPullRequest extends S.Class<GhEventPullRequest>($I`GhEventPullRequest`)(
  {
    draft: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    labels: S.Array(GhEventLabel).pipe(SchemaUtils.withKeyDefaults(A.empty<GhEventLabel>())),
    base: S.Struct({ ref: S.String }),
  },
  $I.annote("GhEventPullRequest", {
    description: "The pull_request fields of a GitHub event payload that admission reads.",
  })
) {}

/**
 * The minimal `pull_request` event payload admission decodes from
 * `GITHUB_EVENT_PATH`: the action, the draft flag, the label names, and the
 * base ref. Unknown keys are stripped at the boundary.
 *
 * **Example** (Decode a payload)
 *
 * ```ts
 * import { GhPullRequestEventPayload } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * const payload = S.decodeUnknownSync(GhPullRequestEventPayload)({
 *   action: "labeled",
 *   pull_request: { draft: false, labels: [{ name: "ready-for-heavy" }], base: { ref: "main" } }
 * })
 * console.log(payload.pull_request.labels[0]?.name) // "ready-for-heavy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GhPullRequestEventPayload extends S.Class<GhPullRequestEventPayload>($I`GhPullRequestEventPayload`)(
  {
    action: S.String.pipe(SchemaUtils.withKeyDefaults("")),
    pull_request: GhEventPullRequest,
  },
  $I.annote("GhPullRequestEventPayload", {
    description: "Minimal GitHub pull_request event payload: action, draft, labels, base ref.",
  })
) {}

const decodeGhPullRequestEventPayload = S.decodeUnknownEffect(S.fromJsonString(GhPullRequestEventPayload));

/**
 * What the event reader needs beyond the environment: the resolved event
 * name, the optional payload path and base override, and the checkout to
 * diff in.
 *
 * **Example** (Construct a read input)
 *
 * ```ts
 * import { HeavyAdmissionReadInput } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const input = HeavyAdmissionReadInput.make({ eventName: "push", eventPath: O.none(), base: O.none(), cwd: "." })
 * console.log(input.eventName) // "push"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeavyAdmissionReadInput extends S.Class<HeavyAdmissionReadInput>($I`HeavyAdmissionReadInput`)(
  {
    eventName: HeavyAdmissionEventName,
    eventPath: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    base: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    cwd: S.String,
  },
  $I.annote("HeavyAdmissionReadInput", {
    description: "Resolved event name, optional payload path and base override, and the checkout to diff.",
  })
) {}

const SAFE_BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/u;

const safeBranch = (branch: string): Effect.Effect<string, CiCommandError> =>
  SAFE_BRANCH_PATTERN.test(branch)
    ? Effect.succeed(branch)
    : Effect.fail(CiCommandError.make({ message: `ci admission refuses an unsafe base branch "${branch}".` }));

// `origin/main` → `main`; a bare `main` stays `main`.
const branchOfBase = (base: string): string => Str.replace(/^origin\//u, "")(base);

/**
 * Read the merge-base diff of the checkout against `origin/<branch>`, fetching
 * the branch first the way `heavy.yml` does so a shallow CI checkout has it.
 *
 * **Details**
 *
 * The fetch is best effort (a stale but present ref still yields a correct
 * merge-base diff); the diff itself must exit 0, since an unreadable diff
 * cannot be told apart from an empty one and the decision would silently
 * hold.
 *
 * **Example** (Reference the reader)
 *
 * ```ts
 * import { readHeavyAdmissionChangedPaths } from "@beep/repo-cli/commands/Ci"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readHeavyAdmissionChangedPaths("main", "."))) // true
 * ```
 *
 * @param branch - The base branch name without the `origin/` prefix.
 * @param cwd - The checkout to diff.
 * @param capture - The command capture to run `git` through; the repo capture by default.
 * @returns The changed paths, trimmed and non-empty.
 * @category services
 * @since 0.0.0
 */
export const readHeavyAdmissionChangedPaths = Effect.fn("Ci.readHeavyAdmissionChangedPaths")(function* (
  branch: string,
  cwd: string,
  capture: typeof runRepoCommandCapture = runRepoCommandCapture
): Effect.fn.Return<ReadonlyArray<string>, CiCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const safe = yield* safeBranch(branch);
  yield* capture(
    "git",
    ["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${safe}:refs/remotes/origin/${safe}`],
    cwd
  ).pipe(Effect.ignore);
  const diff = yield* capture("git", ["diff", "--name-only", `origin/${safe}...HEAD`], cwd).pipe(
    CiCommandError.mapError("Failed to run git diff for heavy admission.")
  );
  if (diff.exitCode !== 0 || diff.truncated) {
    return yield* CiCommandError.make({
      message: `git diff --name-only origin/${safe}...HEAD exited ${diff.exitCode}${diff.truncated ? " (truncated)" : ""}.`,
    });
  }
  return pipe(Str.split(diff.output, "\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));
});

/**
 * Build the typed admission event from the GitHub event and the checkout.
 *
 * **Details**
 *
 * `push` and `merge_group` need no payload: they admit by event name alone and
 * carry an empty diff. `pull_request` decodes the payload at `eventPath`
 * (`GITHUB_EVENT_PATH` in CI) for labels, draft and the base ref, then diffs
 * against `origin/<base>` — `base` overrides the payload's ref when given.
 *
 * **Example** (Reference the reader)
 *
 * ```ts
 * import { HeavyAdmissionReadInput, readHeavyAdmissionEvent } from "@beep/repo-cli/commands/Ci"
 * import { Effect } from "effect"
 *
 * const input = HeavyAdmissionReadInput.make({ eventName: "push", cwd: "." })
 * console.log(Effect.isEffect(readHeavyAdmissionEvent(input))) // true
 * ```
 *
 * @param input - Resolved event name, optional payload path and base, and the checkout.
 * @param capture - The command capture to run `git` through; the repo capture by default.
 * @returns The typed event {@link decideHeavyAdmission} reads.
 * @category services
 * @since 0.0.0
 */
export const readHeavyAdmissionEvent = Effect.fn("Ci.readHeavyAdmissionEvent")(function* (
  input: HeavyAdmissionReadInput,
  capture: typeof runRepoCommandCapture = runRepoCommandCapture
): Effect.fn.Return<
  HeavyAdmissionEvent,
  CiCommandError,
  FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
> {
  if (!HeavyAdmissionEventName.is.pull_request(input.eventName)) {
    return HeavyAdmissionEvent.make({ eventName: input.eventName });
  }
  const eventPath = yield* Effect.fromOption(input.eventPath, () =>
    CiCommandError.make({
      message: "ci admission needs the pull_request payload: set GITHUB_EVENT_PATH or pass --event-path.",
    })
  );
  const fs = yield* FileSystem.FileSystem;
  const payload = yield* fs.readFileString(eventPath).pipe(
    CiCommandError.mapError(`Failed to read the event payload at ${eventPath}.`),
    Effect.flatMap((text) =>
      decodeGhPullRequestEventPayload(text).pipe(
        CiCommandError.mapError(`Failed to decode the pull_request payload at ${eventPath}.`)
      )
    )
  );
  const branch = branchOfBase(O.getOrElse(input.base, () => payload.pull_request.base.ref));
  const changedPaths = yield* readHeavyAdmissionChangedPaths(branch, input.cwd, capture);
  return HeavyAdmissionEvent.make({
    eventName: input.eventName,
    labels: A.map(payload.pull_request.labels, (label) => label.name),
    draft: payload.pull_request.draft,
    changedPaths,
  });
});

/**
 * Render the `$GITHUB_OUTPUT` lines the `check.yml` admission job consumes.
 *
 * **Example** (Render a run verdict)
 *
 * ```ts
 * import { HeavyAdmission, renderHeavyAdmissionGithubOutput } from "@beep/repo-cli/commands/Ci"
 *
 * const admission = HeavyAdmission.make({ verdict: "run", admitted: true, sources: ["label"], docsOnly: false, changedPathCount: 2 })
 * console.log(renderHeavyAdmissionGithubOutput(admission))
 * // verdict=run
 * // admitted=true
 * // docs_only=false
 * // sources=label
 * ```
 *
 * @param admission - The decided admission.
 * @returns Newline-terminated `key=value` lines: `verdict`, `admitted`, `docs_only`, `sources`.
 * @category formatting
 * @since 0.0.0
 */
export const renderHeavyAdmissionGithubOutput = (admission: HeavyAdmission): string =>
  `${A.join(
    [
      `verdict=${admission.verdict}`,
      `admitted=${admission.admitted}`,
      `docs_only=${admission.docsOnly}`,
      `sources=${A.join(admission.sources, ",")}`,
    ],
    "\n"
  )}\n`;

/**
 * Render the one-line human summary printed under `--no-json`.
 *
 * **Example** (Summarise a hold)
 *
 * ```ts
 * import { HeavyAdmission, renderHeavyAdmissionSummary } from "@beep/repo-cli/commands/Ci"
 *
 * const admission = HeavyAdmission.make({ verdict: "hold", admitted: false, sources: [], docsOnly: false, changedPathCount: 3 })
 * console.log(renderHeavyAdmissionSummary(admission))
 * // heavy admission: hold; sources: none; docs-only: no; changed paths: 3; admit: gh pr edit --add-label ready-for-heavy
 * ```
 *
 * @param admission - The decided admission.
 * @returns One line naming the verdict, sources, docs-only flag, diff size, and the admitting command when held.
 * @category formatting
 * @since 0.0.0
 */
export const renderHeavyAdmissionSummary = (admission: HeavyAdmission): string =>
  A.join(
    [
      `heavy admission: ${admission.verdict}`,
      `sources: ${A.isReadonlyArrayEmpty(admission.sources) ? "none" : A.join(admission.sources, ", ")}`,
      `docs-only: ${admission.docsOnly ? "yes" : "no"}`,
      `changed paths: ${admission.changedPathCount}`,
      ...(HeavyAdmissionVerdict.is.hold(admission.verdict)
        ? [`admit: gh pr edit --add-label ${HEAVY_ADMISSION_LABEL}`]
        : A.empty<string>()),
    ],
    "; "
  );

/**
 * Every heavy-admission schema, for arbitrary-based round-trip tests.
 *
 * **Example** (Round-trip every admission schema)
 *
 * ```ts
 * import { heavyAdmissionSchemasForTesting } from "@beep/repo-cli/commands/Ci"
 *
 * const names = Object.keys(heavyAdmissionSchemasForTesting).sort()
 * console.log(names)
 * // ["GhPullRequestEventPayload", "HeavyAdmission", "HeavyAdmissionEvent", "HeavyAdmissionReadInput"]
 * console.log(heavyAdmissionSchemasForTesting.HeavyAdmission.make({
 *   verdict: "hold", admitted: false, sources: [], docsOnly: false, changedPathCount: 3
 * }).verdict) // "hold"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const heavyAdmissionSchemasForTesting = {
  GhPullRequestEventPayload,
  HeavyAdmission,
  HeavyAdmissionEvent,
  HeavyAdmissionReadInput,
} as const;
