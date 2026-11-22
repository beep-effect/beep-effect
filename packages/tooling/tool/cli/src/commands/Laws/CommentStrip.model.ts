/**
 * Schemas for the comment-law strip: ledger rows, votes, refusals and summaries.
 *
 * **Details**
 *
 * The strip is the deletion half of the comment law. A ledger lists every
 * banned comment under one path with a stable `cid`; two or more vote files
 * classify those rows with the `/delete-comment` rubric codes; `apply`
 * deletes only the rows the votes agree on and proves every touched file
 * parses to the same program. The ledger lives under the gitignored
 * `.beep/comment-law/ledger/` directory and is never committed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { CommentKind } from "@beep/lint-rules/comment-grammar";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("commands/Laws/CommentStrip.model");

/**
 * Rubric code a classifier gives one ledger row.
 *
 * **Details**
 *
 * `T` tautology, `S` stale, `X` excuse, `D` decision record, `H` hazard,
 * `N` narration, `G` grouping, `L` licence. Only `T`, `S`, `X`, `D` and `G`
 * delete; `X` needs an issue or pull request URL and `D` a committed
 * decision file in the owning package.
 *
 * **Example** (Recognize a tautology code)
 *
 * ```ts
 * import { CommentVoteCode } from "@beep/repo-cli/commands/Laws/CommentStrip.model"
 *
 * console.log(CommentVoteCode.is.T("T")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CommentVoteCode = LiteralKit(["T", "S", "X", "D", "H", "N", "G", "L"]).pipe(
  $I.annoteSchema("CommentVoteCode", { description: "Delete-comment rubric code for one ledger row." })
);

/**
 * Type-level member of {@link CommentVoteCode}.
 *
 * @category models
 * @since 0.0.0
 */
export type CommentVoteCode = typeof CommentVoteCode.Type;

/**
 * Why `apply` left a ledger row in place.
 *
 * **Details**
 *
 * `stale-cid` means the row no longer matches the tree, or an identical
 * comment censused with it is gone, so the census must run again.
 * `too-few-votes` and `votes-disagree` mean no deletable code has two
 * agreeing votes. `retained-code` is an agreed `H`, `N` or `L`.
 * `missing-ref` is an `X` without an issue or pull request URL and
 * `missing-decision` a `D` whose decision file is not committed in `HEAD`.
 * `ordinal-sibling` refuses a deletion that would hand a surviving identical
 * comment the deleted row's `cid`. `proof-failed` and `parse-error` come
 * from the AST-identity proof. `symlinked-path` is a file that resolves
 * through a symlink, `uncovered-path` a file the comment law does not cover,
 * `target-dirty` a file whose working copy differs from `HEAD`, and
 * `file-changed` a file edited while apply ran. In
 * every case the file is left untouched.
 *
 * **Example** (Recognize a protected refusal)
 *
 * ```ts
 * import { CommentRefusalReason } from "@beep/repo-cli/commands/Laws/CommentStrip.model"
 *
 * console.log(CommentRefusalReason.is.protected("protected")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CommentRefusalReason = LiteralKit([
  "protected",
  "stale-cid",
  "too-few-votes",
  "votes-disagree",
  "retained-code",
  "missing-ref",
  "missing-decision",
  "ordinal-sibling",
  "proof-failed",
  "parse-error",
  "symlinked-path",
  "uncovered-path",
  "target-dirty",
  "file-changed",
]).pipe($I.annoteSchema("CommentRefusalReason", { description: "Why the strip left one ledger row in place." }));

/**
 * Type-level member of {@link CommentRefusalReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type CommentRefusalReason = typeof CommentRefusalReason.Type;

const isRepoRelativeFile = (file: string): boolean =>
  !Str.startsWith("/")(file) &&
  !Str.includes("\\")(file) &&
  !A.some(Str.split(file, "/"), (segment) => segment === ".." || segment === "." || segment === "");

/**
 * A file path relative to the repository root, written with `/`, that cannot
 * leave the repository.
 *
 * **Details**
 *
 * An absolute path, a backslash, and an empty, `.` or `..` segment are
 * rejected, so a ledger row can only name a file inside the checkout. Apply
 * still resolves the real path, which catches a symlink escape.
 *
 * **Example** (Check ledger paths)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CommentRepoPath } from "@beep/repo-cli/commands/Laws/CommentStrip.model"
 *
 * console.log(S.is(CommentRepoPath)("packages/foo/src/Bar.ts")) // true
 * console.log(S.is(CommentRepoPath)("../other/src/Bar.ts")) // false
 * console.log(S.is(CommentRepoPath)("/etc/passwd")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CommentRepoPath = S.String.check(
  S.makeFilter(isRepoRelativeFile, {
    identifier: "CommentRepoPathShape",
    title: "Repository Relative File",
    description: "A relative file path with no backslash and no empty, `.` or `..` segment.",
    message: "expected a repository-relative file path with no backslash and no empty, `.` or `..` segment",
  })
).pipe(
  S.brand("CommentRepoPath"),
  $I.annoteSchema("CommentRepoPath", {
    description: "A file path relative to the repository root that cannot leave the repository.",
  })
);

/**
 * Type of {@link CommentRepoPath}.
 *
 * @category models
 * @since 0.0.0
 */
export type CommentRepoPath = typeof CommentRepoPath.Type;

/**
 * One banned comment in a strip ledger.
 *
 * **Details**
 *
 * `cid` is the first 16 hex characters of a SHA-256 over the file, the
 * kind, the normalized text, the next 60 non-whitespace code characters
 * after the comment (other comments skipped) and an ordinal among rows that
 * share all four. Line shifts keep it; editing the comment or the code under
 * it changes it. `protect` names why the row can never be deleted by the
 * strip, and is `null` in the JSONL file when it can.
 *
 * **Example** (Describe an unprotected row)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { CommentLedgerRow, CommentRepoPath } from "@beep/repo-cli/commands/Laws/CommentStrip.model"
 *
 * const row = CommentLedgerRow.make({
 *   cid: "0123456789abcdef",
 *   file: CommentRepoPath.make("packages/foo/src/Bar.ts"),
 *   line: 12,
 *   kind: "prose",
 *   text: "retry twice",
 *   protect: O.none(),
 * })
 *
 * console.log(O.isNone(row.protect)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentLedgerRow extends S.Opaque<CommentLedgerRow, { readonly brand: unique symbol }>()(
  S.Struct({
    cid: S.String,
    file: CommentRepoPath,
    line: S.Int,
    kind: CommentKind,
    text: S.String,
    protect: S.OptionFromNullOr(S.String),
  }).pipe(
    $I.annoteSchema("CommentLedgerRow", {
      description: "One banned comment with its stable id and the reason it is protected, if any.",
    })
  )
) {}

/**
 * One classifier vote: a row id, a rubric code and its reference.
 *
 * **Details**
 *
 * A vote file is a TSV of `cid<TAB>code<TAB>ref`. `ref` is empty for most
 * codes, an issue or pull request URL for `X`, and the repository-relative
 * path of the decision file for `D`.
 *
 * **Example** (Vote a tautology)
 *
 * ```ts
 * import { CommentVote } from "@beep/repo-cli/commands/Laws/CommentStrip.model"
 *
 * const vote = CommentVote.make({ cid: "0123456789abcdef", code: "T", ref: "" })
 *
 * console.log(vote.code) // "T"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentVote extends S.Opaque<CommentVote, { readonly brand: unique symbol }>()(
  S.Struct({
    cid: S.String,
    code: CommentVoteCode,
    ref: S.String,
  }).pipe($I.annoteSchema("CommentVote", { description: "One classifier verdict on one ledger row." }))
) {}

/**
 * One ledger row the strip did not delete, and why.
 *
 * **Example** (Describe a protected refusal)
 *
 * ```ts
 * import { CommentRefusal } from "@beep/repo-cli/commands/Laws/CommentStrip.model"
 *
 * const refusal = CommentRefusal.make({
 *   cid: "0123456789abcdef",
 *   file: "packages/foo/src/Bar.ts",
 *   line: 3,
 *   reason: "protected",
 *   detail: "tool-read tag @since",
 * })
 *
 * console.log(refusal.reason) // "protected"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentRefusal extends S.Opaque<CommentRefusal, { readonly brand: unique symbol }>()(
  S.Struct({
    cid: S.String,
    file: S.String,
    line: S.Int,
    reason: CommentRefusalReason,
    detail: S.String,
  }).pipe($I.annoteSchema("CommentRefusal", { description: "One ledger row the strip left in place." }))
) {}

/**
 * Result of writing one strip ledger.
 *
 * **Example** (Read a ledger summary)
 *
 * ```ts
 * import { CommentLedgerSummary } from "@beep/repo-cli/commands/Laws/CommentStrip.model"
 *
 * const summary = CommentLedgerSummary.make({ path: ".beep/comment-law/ledger/packages-foo.jsonl", rows: 4, protected: 1 })
 *
 * console.log(summary.rows - summary.protected) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentLedgerSummary extends S.Opaque<CommentLedgerSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    rows: S.Int,
    protected: S.Int,
  }).pipe(
    $I.annoteSchema("CommentLedgerSummary", {
      description: "Where a strip ledger was written, its row count and how many rows are protected.",
    })
  )
) {}

/**
 * Inputs of one strip `apply` run.
 *
 * **Example** (Apply two vote files)
 *
 * ```ts
 * import { CommentApplyOptions } from "@beep/repo-cli/commands/Laws/CommentStrip.model"
 *
 * const options = CommentApplyOptions.make({
 *   cwd: process.cwd(),
 *   ledger: ".beep/comment-law/ledger/packages-foo.jsonl",
 *   votes: ["a.tsv", "b.tsv"],
 * })
 *
 * console.log(options.votes.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentApplyOptions extends S.Opaque<CommentApplyOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: S.String,
    ledger: S.NonEmptyString,
    votes: S.Array(S.NonEmptyString),
  }).pipe($I.annoteSchema("CommentApplyOptions", { description: "Ledger and vote files for one strip apply run." }))
) {}

/**
 * Result of one strip `apply` run.
 *
 * **Details**
 *
 * `deleted` counts removed comments; `filesTouched` lists the files written,
 * each of which passed the AST-identity proof. Every other ledger row is in
 * `refusals`.
 *
 * **Example** (Read an apply summary)
 *
 * ```ts
 * import { CommentApplySummary } from "@beep/repo-cli/commands/Laws/CommentStrip.model"
 *
 * const summary = CommentApplySummary.make({ deleted: 2, filesTouched: ["packages/foo/src/Bar.ts"], refusals: [] })
 *
 * console.log(summary.deleted) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentApplySummary extends S.Opaque<CommentApplySummary, { readonly brand: unique symbol }>()(
  S.Struct({
    deleted: S.Int,
    filesTouched: S.Array(S.String),
    refusals: S.Array(CommentRefusal),
  }).pipe(
    $I.annoteSchema("CommentApplySummary", {
      description: "Comments deleted, files written and rows refused by one strip apply run.",
    })
  )
) {}
