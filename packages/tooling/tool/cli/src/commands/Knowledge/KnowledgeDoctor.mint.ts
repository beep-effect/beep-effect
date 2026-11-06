/**
 * The knowledge doctor's CI mint: the mint's file outcome, the contexts the mint write and
 * `--accept-mint` require (C8 condition i), and the quality-lane mode that keeps the doctor
 * report-only until the first seal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { configStringOption } from "@beep/repo-cli-kit/cli/EnvConfig";
import { LiteralKit } from "@beep/schema";
import { Str } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { KnowledgeCommitSha } from "./Knowledge.refs.ts";
import {
  encodeKnowledgeBaselineText,
  KNOWLEDGE_DOCTOR_BASELINE_PATH,
  KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
  KnowledgeDoctorBaseline,
  mintKnowledgeBaseline,
} from "./KnowledgeDoctor.baseline.ts";
import type { KnowledgeMintInput } from "./KnowledgeDoctor.baseline.ts";

const $I = $RepoCliId.create("commands/Knowledge/KnowledgeDoctor.mint");

/* -------------------------------------------------------------------------------------------------
 * Mint outcome
 * ---------------------------------------------------------------------------------------------- */

/**
 * The head branch the mint workflow opens its baseline-only pull request from (C8 condition i).
 *
 * **Example** (The mint branch)
 *
 * ```ts
 * import { KNOWLEDGE_MINT_BRANCH } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 *
 * console.log(KNOWLEDGE_MINT_BRANCH) // "automation/knowledge-baseline-mint"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_MINT_BRANCH = "automation/knowledge-baseline-mint";

/**
 * The repository variable naming the mint App's slug; its pull requests are authored by `<slug>[bot]`.
 *
 * **Example** (The variable name)
 *
 * ```ts
 * import { KNOWLEDGE_MINT_APP_SLUG_VARIABLE } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 *
 * console.log(KNOWLEDGE_MINT_APP_SLUG_VARIABLE) // "KNOWLEDGE_MINT_APP_SLUG"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_MINT_APP_SLUG_VARIABLE = "KNOWLEDGE_MINT_APP_SLUG";

/**
 * What one mint produced: the baseline, its exact file text, and whether it changes the committed file.
 *
 * **Details**
 *
 * `changed` is `false` when the committed baseline at the minted commit already holds the same note
 * and entries, so only `mintedAt` would move. The mint then writes nothing, and the weekly workflow
 * opens no pull request that would only restamp the commit.
 *
 * **Example** (An unchanged mint)
 *
 * ```ts
 * import { KNOWLEDGE_DOCTOR_BASELINE_NOTE, KnowledgeDoctorBaseline } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import { KnowledgeMintOutcome } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 *
 * const outcome = KnowledgeMintOutcome.make({
 *   baseline: KnowledgeDoctorBaseline.make({
 *     mintedAt: "1111111111111111111111111111111111111111",
 *     note: KNOWLEDGE_DOCTOR_BASELINE_NOTE,
 *     entries: [],
 *   }),
 *   text: "{}\n",
 *   changed: false,
 * })
 *
 * console.log(outcome.changed) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeMintOutcome extends S.Opaque<KnowledgeMintOutcome, { readonly brand: unique symbol }>()(
  S.Struct({
    baseline: KnowledgeDoctorBaseline,
    text: S.String,
    changed: S.Boolean,
  }).pipe(
    $I.annoteSchema("KnowledgeMintOutcome", {
      description: "One mint's baseline, its canonical file text, and whether it changes the committed baseline.",
    })
  )
) {}

/**
 * Mints a commit's baseline and renders the exact text `knowledge doctor mint --write` commits.
 *
 * **Details**
 *
 * The mint is {@link mintKnowledgeBaseline}, so a laundering input fails with its
 * `KnowledgeMintRefusal` and the list of refused finding ids. The text is
 * {@link encodeKnowledgeBaselineText}, the same renderer `verify-mint` compares against, so two mints
 * of one commit give identical bytes. The outcome is unchanged when re-rendering the new entries under
 * the committed `mintedAt` reproduces the committed text exactly.
 *
 * **Example** (Minting is effectful)
 *
 * ```ts
 * import { mintKnowledgeBaselineText } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 *
 * console.log(typeof mintKnowledgeBaselineText) // "function"
 * ```
 *
 * @param input - The minted commit's report, tree, removals, seal files, and previous promotions.
 * @returns The baseline, its file text, and whether it changes the committed file.
 * @category use-cases
 * @since 0.0.0
 */
export const mintKnowledgeBaselineText = Effect.fn("KnowledgeDoctor.mintText")(function* (input: KnowledgeMintInput) {
  const baseline = yield* mintKnowledgeBaseline(input);
  const text = yield* encodeKnowledgeBaselineText(baseline);
  const changed = yield* O.match(input.files.baseline, {
    onNone: () => Effect.succeed(true),
    onSome: (committed) =>
      encodeKnowledgeBaselineText(KnowledgeDoctorBaseline.make({ ...baseline, mintedAt: committed.mintedAt })).pipe(
        Effect.map((restamped) => !O.contains(input.files.baselineText, restamped))
      ),
  });
  return KnowledgeMintOutcome.make({ baseline, text, changed });
});

/* -------------------------------------------------------------------------------------------------
 * Write context
 * ---------------------------------------------------------------------------------------------- */

/**
 * The facts `knowledge doctor mint --write` checks before it writes the sealed baseline.
 *
 * **Details**
 *
 * `ci` is `CI=true`; `clean` means no tracked file differs from `HEAD`; `headIsMinted` means `HEAD`
 * is the minted commit, so the written file lands on the tree it describes; `onBase` means the base
 * ref contains the minted commit.
 *
 * **Example** (A CI write on the default branch)
 *
 * ```ts
 * import { KnowledgeMintWriteContext } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 *
 * const context = KnowledgeMintWriteContext.make({
 *   baseRef: "origin/main",
 *   ci: true,
 *   clean: true,
 *   commit: "1111111111111111111111111111111111111111",
 *   headIsMinted: true,
 *   onBase: true,
 * })
 *
 * console.log(context.baseRef) // "origin/main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeMintWriteContext extends S.Opaque<KnowledgeMintWriteContext, { readonly brand: unique symbol }>()(
  S.Struct({
    baseRef: S.String,
    ci: S.Boolean,
    clean: S.Boolean,
    commit: KnowledgeCommitSha,
    headIsMinted: S.Boolean,
    onBase: S.Boolean,
  }).pipe(
    $I.annoteSchema("KnowledgeMintWriteContext", {
      description: "CI flag, clean checkout, HEAD identity, and base containment of one mint write.",
    })
  )
) {}

/**
 * Lists every reason a mint write may not run; empty when it may.
 *
 * **Details**
 *
 * The write is CI-only (the mint workflow), on a clean checkout whose `HEAD` is the minted commit,
 * at a commit the base ref contains. A dry run (no `--write`) skips these checks because it writes
 * nothing.
 *
 * **Example** (A local write is refused)
 *
 * ```ts
 * import {
 *   KnowledgeMintWriteContext,
 *   knowledgeMintWriteRefusals,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 *
 * const reasons = knowledgeMintWriteRefusals(
 *   KnowledgeMintWriteContext.make({
 *     baseRef: "origin/main",
 *     ci: false,
 *     clean: true,
 *     commit: "1111111111111111111111111111111111111111",
 *     headIsMinted: true,
 *     onBase: true,
 *   })
 * )
 *
 * console.log(reasons.length) // 1
 * ```
 *
 * @param context - The checked write facts.
 * @returns One sentence per unmet condition.
 * @category predicates
 * @since 0.0.0
 */
export const knowledgeMintWriteRefusals = (context: KnowledgeMintWriteContext): ReadonlyArray<string> =>
  A.getSomes([
    context.ci ? O.none() : O.some("CI is not true; only the mint workflow writes the sealed baseline."),
    context.clean ? O.none() : O.some("Tracked files differ from HEAD; the mint writes only onto a clean checkout."),
    context.headIsMinted
      ? O.none()
      : O.some(`HEAD is not ${context.commit}; check out the minted commit before writing its baseline.`),
    context.onBase
      ? O.none()
      : O.some(`${context.baseRef} does not contain ${context.commit}; mint a default-branch commit.`),
  ]);

/* -------------------------------------------------------------------------------------------------
 * Pull request context (C8 condition i)
 * ---------------------------------------------------------------------------------------------- */

/**
 * The login GitHub gives the pull requests a GitHub App opens.
 *
 * **Example** (An App login)
 *
 * ```ts
 * import { knowledgeMintAppLogin } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 *
 * console.log(knowledgeMintAppLogin("beep-knowledge-mint")) // "beep-knowledge-mint[bot]"
 * ```
 *
 * @param slug - URL name of the GitHub App, as in `github.com/apps/<slug>`.
 * @returns `<slug>[bot]`.
 * @category utilities
 * @since 0.0.0
 */
export const knowledgeMintAppLogin = (slug: string): string => `${slug}[bot]`;

/**
 * The pull-request facts C8 condition (i) reads.
 *
 * **Details**
 *
 * `headRef`, `headRepository`, and `author` come from the `pull_request` event payload; `repository`
 * is `GITHUB_REPOSITORY`; `appSlug` is the `KNOWLEDGE_MINT_APP_SLUG` repository variable. Each is
 * `O.none()` outside a pull-request run or when unset.
 *
 * **Example** (The mint App's pull request)
 *
 * ```ts
 * import { KnowledgeMintPullRequest } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 * import * as O from "effect/Option"
 *
 * const pullRequest = KnowledgeMintPullRequest.make({
 *   appSlug: O.some("beep-knowledge-mint"),
 *   author: O.some("beep-knowledge-mint[bot]"),
 *   headRef: O.some("automation/knowledge-baseline-mint"),
 *   headRepository: O.some("beep-effect/beep-effect"),
 *   repository: O.some("beep-effect/beep-effect"),
 * })
 *
 * console.log(O.isSome(pullRequest.author)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeMintPullRequest extends S.Opaque<KnowledgeMintPullRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    appSlug: S.Option(S.String),
    author: S.Option(S.String),
    headRef: S.Option(S.String),
    headRepository: S.Option(S.String),
    repository: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeMintPullRequest", {
      description: "Head branch, head and base repositories, author, and the mint App slug of one pull-request run.",
    })
  )
) {}

const shown = (value: O.Option<string>): string => O.getOrElse(value, () => "unknown");
const sameRepository = (left: O.Option<string>, right: O.Option<string>): boolean =>
  O.isSome(left) && O.isSome(right) && Str.toLowerCase(left.value) === Str.toLowerCase(right.value);

/**
 * Lists every reason a pull request fails C8 condition (i); empty when `--accept-mint` may apply.
 *
 * **Details**
 *
 * Condition (i) holds when the head branch is {@link KNOWLEDGE_MINT_BRANCH} in this repository and
 * the pull request author is the mint App (`<KNOWLEDGE_MINT_APP_SLUG>[bot]`). An unset slug fails
 * closed. Conditions (ii)-(iv) stay with the seal guard, which reads the diff, the ancestry of
 * `mintedAt`, and the byte-for-byte re-mint.
 *
 * **Example** (A human's pull request on the mint branch)
 *
 * ```ts
 * import {
 *   KnowledgeMintPullRequest,
 *   knowledgeMintPullRequestRefusals,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 * import * as O from "effect/Option"
 *
 * const reasons = knowledgeMintPullRequestRefusals(
 *   KnowledgeMintPullRequest.make({
 *     appSlug: O.some("beep-knowledge-mint"),
 *     author: O.some("octocat"),
 *     headRef: O.some("automation/knowledge-baseline-mint"),
 *     headRepository: O.some("beep-effect/beep-effect"),
 *     repository: O.some("beep-effect/beep-effect"),
 *   })
 * )
 *
 * console.log(reasons.length) // 1
 * ```
 *
 * @param pullRequest - The pull-request facts of this run.
 * @returns One sentence per unmet part of condition (i).
 * @category predicates
 * @since 0.0.0
 */
export const knowledgeMintPullRequestRefusals = (pullRequest: KnowledgeMintPullRequest): ReadonlyArray<string> => {
  const slug = O.filter(pullRequest.appSlug, Str.isNonEmpty);
  return A.getSomes([
    O.contains(pullRequest.headRef, KNOWLEDGE_MINT_BRANCH)
      ? O.none()
      : O.some(`The head branch is ${shown(pullRequest.headRef)}, not ${KNOWLEDGE_MINT_BRANCH}.`),
    sameRepository(pullRequest.headRepository, pullRequest.repository)
      ? O.none()
      : O.some(`The head branch lives in ${shown(pullRequest.headRepository)}, not ${shown(pullRequest.repository)}.`),
    O.match(slug, {
      onNone: () =>
        O.some(`${KNOWLEDGE_MINT_APP_SLUG_VARIABLE} is unset, so the mint App's pull-request author is unknown.`),
      onSome: (value) =>
        O.contains(pullRequest.author, knowledgeMintAppLogin(value))
          ? O.none()
          : O.some(`The pull request author is ${shown(pullRequest.author)}, not ${knowledgeMintAppLogin(value)}.`),
    }),
  ]);
};

const GithubPullRequestPayload = S.Struct({
  pull_request: S.Struct({
    user: S.Struct({ login: S.String }),
    head: S.Struct({
      ref: S.String,
      repo: S.NullishOr(S.Struct({ full_name: S.String })),
    }),
  }),
});

const decodeGithubPullRequestPayload = S.decodeUnknownEffect(S.fromJsonString(GithubPullRequestPayload));

/**
 * Reads this run's pull-request facts from `GITHUB_EVENT_PATH`, `GITHUB_REPOSITORY`, and
 * `KNOWLEDGE_MINT_APP_SLUG`.
 *
 * **Details**
 *
 * An absent, unreadable, or non-`pull_request` payload yields `O.none()` facts, which
 * {@link knowledgeMintPullRequestRefusals} refuses: an unreadable payload can never buy acceptance.
 *
 * **Example** (Reading is effectful)
 *
 * ```ts
 * import { readKnowledgeMintPullRequest } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readKnowledgeMintPullRequest())) // true
 * ```
 *
 * @returns The pull-request facts of this run.
 * @category use-cases
 * @since 0.0.0
 */
export const readKnowledgeMintPullRequest = Effect.fn("KnowledgeDoctor.readMintPullRequest")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const eventPath = yield* configStringOption("GITHUB_EVENT_PATH");
  const payload = yield* O.match(eventPath, {
    onNone: () => Effect.succeedNone,
    onSome: (path) => fs.readFileString(path).pipe(Effect.flatMap(decodeGithubPullRequestPayload), Effect.option),
  });
  const pullRequest = O.map(payload, (event) => event.pull_request);
  return KnowledgeMintPullRequest.make({
    appSlug: yield* configStringOption(KNOWLEDGE_MINT_APP_SLUG_VARIABLE),
    author: O.map(pullRequest, (row) => row.user.login),
    headRef: O.map(pullRequest, (row) => row.head.ref),
    headRepository: O.flatMap(pullRequest, (row) => O.map(O.fromNullishOr(row.head.repo), (repo) => repo.full_name)),
    repository: yield* configStringOption("GITHUB_REPOSITORY"),
  });
});

/* -------------------------------------------------------------------------------------------------
 * Quality-lane mode
 * ---------------------------------------------------------------------------------------------- */

/**
 * How the quality lane runs the knowledge doctor: the read-only report, or the gate with the seal guard.
 *
 * **Example** (The two modes)
 *
 * ```ts
 * import { KnowledgeDoctorCiMode } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 *
 * console.log(KnowledgeDoctorCiMode.is.gate("gate")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeDoctorCiMode = LiteralKit(["report", "gate"]).pipe(
  $I.annoteSchema("KnowledgeDoctorCiMode", {
    description: "Quality-lane mode of the knowledge doctor: read-only report or the sealed-baseline gate.",
  })
);

/**
 * How the quality lane runs the knowledge doctor.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeDoctorCiMode = typeof KnowledgeDoctorCiMode.Type;

/**
 * The facts the quality-lane mode is decided on.
 *
 * **Example** (A branch that touches nothing sealed)
 *
 * ```ts
 * import { KnowledgeDoctorCiModeInput } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 *
 * console.log(KnowledgeDoctorCiModeInput.make({ sealedAtBase: false, changedPaths: ["docs/a.md"] }).sealedAtBase) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorCiModeInput extends S.Opaque<
  KnowledgeDoctorCiModeInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    changedPaths: S.Array(S.String),
    sealedAtBase: S.Boolean,
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorCiModeInput", {
      description: "Whether the merge-base tracks the sealed baseline, and the paths the branch changes.",
    })
  )
) {}

const SEAL_PATHS = HashSet.make(KNOWLEDGE_DOCTOR_BASELINE_PATH, KNOWLEDGE_DOCTOR_PROMOTIONS_PATH);

/**
 * Decides the quality-lane mode: report-only until the first seal lands, the gate from then on.
 *
 * **Details**
 *
 * The gate runs once the merge-base tracks `goals/knowledge-doctor.baseline.jsonc`, so merging the
 * first CI mint flips the lane to gating with no further edit. Before that, a branch that changes
 * the baseline or the promotions file also runs the gate, so the seal guard judges the mint App's
 * first baseline-only pull request and treats any other baseline edit as `baseline-tamper`. A
 * promotion before the first seal fails closed with the missing-baseline refusal. Every other
 * branch gets the read-only report, which never fails on findings.
 *
 * **Example** (A first-seal pull request runs the gate)
 *
 * ```ts
 * import {
 *   decideKnowledgeDoctorCiMode,
 *   KnowledgeDoctorCiModeInput,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 *
 * const mode = decideKnowledgeDoctorCiMode(
 *   KnowledgeDoctorCiModeInput.make({
 *     sealedAtBase: false,
 *     changedPaths: ["goals/knowledge-doctor.baseline.jsonc"],
 *   })
 * )
 *
 * console.log(mode) // "gate"
 * ```
 *
 * @param input - Whether the merge-base is sealed and the branch's changed paths.
 * @returns `gate` when the seal exists or is being touched, `report` otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const decideKnowledgeDoctorCiMode = (input: KnowledgeDoctorCiModeInput): KnowledgeDoctorCiMode =>
  input.sealedAtBase || A.some(input.changedPaths, (path) => HashSet.has(SEAL_PATHS, path))
    ? KnowledgeDoctorCiMode.Enum.gate
    : KnowledgeDoctorCiMode.Enum.report;
