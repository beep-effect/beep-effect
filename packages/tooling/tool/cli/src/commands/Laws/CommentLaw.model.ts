/**
 * Schemas for the comment law: policy, pending scopes, findings and summaries.
 *
 * **Details**
 *
 * The law stores no inventory of comments. The growth check compares a
 * path-free fingerprint multiset against the merge base, and the lock check
 * reads a shrink-only list of pending scopes, one shard per package under
 * `standards/comment-law/pending/`. Every scope not listed there must hold
 * zero banned comments.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { CommentKind } from "@beep/lint-rules/comment-grammar";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/CommentLaw.model");

/**
 * Whether comment-law findings fail the check.
 *
 * **Example** (Read the advisory literal)
 *
 * ```ts
 * import { CommentLawEnforcement } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * console.log(CommentLawEnforcement.is.advisory("advisory")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CommentLawEnforcement = LiteralKit(["advisory", "blocking"]).pipe(
  $I.annoteSchema("CommentLawEnforcement", { description: "Whether comment-law findings fail the check." })
);

/**
 * Type-level member of {@link CommentLawEnforcement}.
 *
 * @category models
 * @since 0.0.0
 */
export type CommentLawEnforcement = typeof CommentLawEnforcement.Type;

/**
 * Rule that produced a comment-law finding.
 *
 * **Details**
 *
 * `introduced-comment` is the growth check. `locked-scope-comment` is a
 * banned comment in a scope no shard lists. `stale-pending-scope` is a listed
 * scope that holds none, and `pending-scope-grew` a head scope that no merge
 * base scope contains.
 *
 * **Example** (Recognize the growth rule)
 *
 * ```ts
 * import { CommentLawRule } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * console.log(CommentLawRule.is["introduced-comment"]("introduced-comment")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CommentLawRule = LiteralKit([
  "introduced-comment",
  "locked-scope-comment",
  "stale-pending-scope",
  "pending-scope-grew",
]).pipe($I.annoteSchema("CommentLawRule", { description: "Rule that produced a comment-law finding." }));

/**
 * Type-level member of {@link CommentLawRule}.
 *
 * @category models
 * @since 0.0.0
 */
export type CommentLawRule = typeof CommentLawRule.Type;

/**
 * Repository policy for the comment law, read from `standards/comment-law/policy.jsonc`.
 *
 * **Example** (Build an advisory policy)
 *
 * ```ts
 * import { CommentLawPolicy } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * const policy = CommentLawPolicy.make({ schemaVersion: "comment-law-policy/v1", enforcement: "advisory" })
 *
 * console.log(policy.enforcement) // "advisory"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentLawPolicy extends S.Opaque<CommentLawPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.Literal("comment-law-policy/v1"),
    enforcement: CommentLawEnforcement,
  }).pipe($I.annoteSchema("CommentLawPolicy", { description: "Enforcement state of the comment law." }))
) {}

/**
 * One pending shard: the scopes of one package not yet swept to zero banned comments.
 *
 * **Details**
 *
 * `root` is the package directory, repository-relative (`.` for files that
 * sit in no package). Each scope is a path relative to `root`, a directory or
 * a single file; `.` is the whole root. A shard may only lose scopes, or
 * replace a scope with narrower scopes inside it.
 *
 * **Example** (List a whole package as pending)
 *
 * ```ts
 * import { CommentLawPending } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * const shard = CommentLawPending.make({
 *   schemaVersion: "comment-law-pending/v1",
 *   package: "@beep/csv",
 *   root: "packages/foundation/modeling/csv",
 *   scopes: ["."],
 * })
 *
 * console.log(shard.scopes) // ["."]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentLawPending extends S.Opaque<CommentLawPending, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.Literal("comment-law-pending/v1"),
    package: S.NonEmptyString,
    root: S.NonEmptyString,
    scopes: S.NonEmptyArray(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("CommentLawPending", {
      description: "Package-relative scopes not yet swept to zero banned comments; the list may only shrink.",
    })
  )
) {}

/**
 * One comment-law finding.
 *
 * **Details**
 *
 * `file` and `line` locate the finding for a reader; neither enters the
 * fingerprint. Scope findings carry the scope path in `file` and line 0.
 *
 * **Example** (Describe an introduced comment)
 *
 * ```ts
 * import { CommentLawFinding } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * const finding = CommentLawFinding.make({
 *   rule: "introduced-comment",
 *   file: "packages/foo/src/Bar.ts",
 *   line: 41,
 *   kind: "prose",
 *   excerpt: "Retry twice because the upstream",
 * })
 *
 * console.log(finding.line) // 41
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentLawFinding extends S.Opaque<CommentLawFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    rule: CommentLawRule,
    file: S.String,
    line: S.Int,
    kind: S.optionalKey(CommentKind),
    excerpt: S.String,
  }).pipe($I.annoteSchema("CommentLawFinding", { description: "One comment-law violation and where it is." }))
) {}

/**
 * Runtime options for one comment-law check.
 *
 * **Details**
 *
 * `base` names the ref to diff against; the check uses its merge base with
 * `HEAD`. Without one, `BEEP_PROOF_BASE`, `BEEP_YEET_PROOF_BASE` and then
 * `origin/main` are tried. `staged` compares the index with `HEAD` and skips
 * the lock check.
 *
 * **Example** (Configure a staged check)
 *
 * ```ts
 * import { CommentLawOptions } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * const options = CommentLawOptions.make({ cwd: process.cwd(), staged: true })
 *
 * console.log(options.staged) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentLawOptions extends S.Opaque<CommentLawOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: S.String,
    base: S.optionalKey(S.NonEmptyString),
    staged: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  }).pipe($I.annoteSchema("CommentLawOptions", { description: "Runtime options for one comment-law check." }))
) {}

/**
 * Result of one comment-law check.
 *
 * **Example** (Construct a clean summary)
 *
 * ```ts
 * import { CommentLawSummary } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * const summary = CommentLawSummary.make({
 *   enforcement: "advisory",
 *   base: "1a2b3c4d5e6f",
 *   changedFiles: 0,
 *   introduced: 0,
 *   removed: 0,
 *   failed: false,
 * })
 *
 * console.log(summary.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentLawSummary extends S.Opaque<CommentLawSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    enforcement: CommentLawEnforcement,
    base: S.String,
    changedFiles: S.Int,
    introduced: S.Int,
    removed: S.Int,
    failed: S.Boolean,
    findings: ArrayKeyDefaultEmpty(CommentLawFinding),
    advisories: ArrayKeyDefaultEmpty(CommentLawFinding),
  }).pipe($I.annoteSchema("CommentLawSummary", { description: "Result of one comment-law check." }))
) {}

/**
 * Banned-comment count for one package root and kind, from a whole-tree census.
 *
 * **Example** (Describe one census row)
 *
 * ```ts
 * import { CommentCensusRow } from "@beep/repo-cli/commands/Laws/CommentLaw.model"
 *
 * const row = CommentCensusRow.make({ root: "packages/foundation/modeling/csv", kind: "prose", count: 3 })
 *
 * console.log(row.count) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommentCensusRow extends S.Opaque<CommentCensusRow, { readonly brand: unique symbol }>()(
  S.Struct({
    root: S.String,
    kind: CommentKind,
    count: S.Int,
  }).pipe($I.annoteSchema("CommentCensusRow", { description: "Comment count for one package root and comment kind." }))
) {}
