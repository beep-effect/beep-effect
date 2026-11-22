/**
 * Package code-decision model: a decision that governs code is one file,
 * `<package>/decisions/<YYYY-MM-DD>-<slug>.md`, whose YAML frontmatter names
 * the declarations it governs (`governs`) and the checks that turn red when it
 * is undone (`enforcedBy`). `beep decisions check` resolves every anchor and
 * every `// decision: <slug>` pointer; `beep decisions for` lists the
 * decisions governing a file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DecisionDate, DecisionFileName, DecisionSingleLine } from "../../internal/decisions/DecisionFile.ts";

const $I = $RepoCliId.create("commands/Decisions/Decisions.schemas");

/**
 * Package-relative directory that holds code-decision files.
 *
 * **Example** (Log the decisions directory)
 *
 * ```ts
 * import { CODE_DECISIONS_DIR } from "@beep/repo-cli/commands/Decisions"
 *
 * console.log(CODE_DECISIONS_DIR) // "decisions"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CODE_DECISIONS_DIR = "decisions";

/**
 * Most lines a code-decision body may hold.
 *
 * **Example** (Log the body limit)
 *
 * ```ts
 * import { CODE_DECISION_BODY_MAX_LINES } from "@beep/repo-cli/commands/Decisions"
 *
 * console.log(CODE_DECISION_BODY_MAX_LINES) // 12
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CODE_DECISION_BODY_MAX_LINES = 12;

/**
 * A governed declaration: `<package-relative path>#<declaration name>`.
 *
 * **Details**
 *
 * The path is relative to the package that owns the decision file, never
 * absolute and never through `..`. The name is a top-level declaration of that
 * file (const, function, class, interface, type alias or enum), exported or
 * not. No line numbers and no body hashes, so a refactor that keeps the name
 * keeps the anchor.
 *
 * **Example** (Validate anchors)
 *
 * ```ts
 * import { CodeDecisionAnchor } from "@beep/repo-cli/commands/Decisions"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodeDecisionAnchor)("src/Git.ts#rejectOptionLikeRefs")) // true
 * console.log(S.is(CodeDecisionAnchor)("../other/src/Git.ts#rejectOptionLikeRefs")) // false
 * console.log(S.is(CodeDecisionAnchor)("src/Git.ts")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodeDecisionAnchor = S.String.check(
  S.isPattern(
    /^(?!\/)(?!(?:.*\/)?\.\.(?:\/|#))[^#\s]+#[A-Za-z_$][\w$]*$/,
    $I.annote("CodeDecisionAnchorPatternCheck", {
      title: "Code Decision Anchor Pattern",
      description: "<package-relative path>#<declaration name>",
      message: "Expected <package-relative path>#<declaration name>",
    })
  )
).pipe(
  $I.annoteSchema("CodeDecisionAnchor", {
    description: "A top-level declaration a code decision governs, named by package-relative file and identifier.",
  })
);

/**
 * Code decision anchor string.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodeDecisionAnchor = typeof CodeDecisionAnchor.Type;

/**
 * A lint rule that enforces a decision: `lint:<rule>`.
 *
 * **Example** (Validate a lint enforcer)
 *
 * ```ts
 * import { CodeDecisionLintEnforcer } from "@beep/repo-cli/commands/Decisions"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodeDecisionLintEnforcer)("lint:beep/no-comments")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodeDecisionLintEnforcer = S.String.check(
  S.isPattern(
    /^lint:[\w@/.:-]+$/,
    $I.annote("CodeDecisionLintEnforcerPatternCheck", {
      title: "Code Decision Lint Enforcer Pattern",
      description: "lint:<rule>",
      message: "Expected lint:<rule>",
    })
  )
).pipe(
  $I.annoteSchema("CodeDecisionLintEnforcer", {
    description: "A lint rule that turns red when a code decision is undone.",
  })
);

/**
 * A test that enforces a decision: `<package-relative test path>#<describe or
 * test title>`.
 *
 * **Example** (Validate a test enforcer)
 *
 * ```ts
 * import { CodeDecisionTestEnforcer } from "@beep/repo-cli/commands/Decisions"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodeDecisionTestEnforcer)("test/Git.test.ts#option-injection guard")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodeDecisionTestEnforcer = S.String.check(
  S.isPattern(
    /^(?!lint:)(?!\/)(?!(?:.*\/)?\.\.(?:\/|#))[^#\s]+#\S(?:.*\S)?$/,
    $I.annote("CodeDecisionTestEnforcerPatternCheck", {
      title: "Code Decision Test Enforcer Pattern",
      description: "<package-relative test path>#<describe or test title>",
      message: "Expected <package-relative test path>#<describe or test title>",
    })
  )
).pipe(
  $I.annoteSchema("CodeDecisionTestEnforcer", {
    description: "A test, named by file and describe/it/test call title, that turns red when a decision is undone.",
  })
);

/**
 * Either enforcer form of a code decision.
 *
 * **Details**
 *
 * An enforcer is written only after the stated reversal was made in a scratch
 * copy and the named check went red. An empty `enforcedBy` is legal and is
 * counted by `beep decisions check`: the decision is protected by prose alone.
 *
 * **Example** (Validate enforcers)
 *
 * ```ts
 * import { CodeDecisionEnforcer } from "@beep/repo-cli/commands/Decisions"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodeDecisionEnforcer)("lint:beep/no-comments")) // true
 * console.log(S.is(CodeDecisionEnforcer)("test/a.test.ts#keeps the order")) // true
 * console.log(S.is(CodeDecisionEnforcer)("a test somewhere")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodeDecisionEnforcer = S.Union([CodeDecisionLintEnforcer, CodeDecisionTestEnforcer]).pipe(
  $I.annoteSchema("CodeDecisionEnforcer", {
    description: "A lint rule or test anchor that enforces a code decision.",
  })
);

/**
 * Code decision enforcer string.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodeDecisionEnforcer = typeof CodeDecisionEnforcer.Type;

const bodyLines = (body: string): ReadonlyArray<string> => (Str.isEmpty(body) ? A.empty() : Str.split("\n")(body));

const FENCE_LINE = /^\s*(?:```|~~~)/u;

const isFenceLine = (line: string): boolean => FENCE_LINE.test(line);

/**
 * The Markdown body of a code decision: at most
 * {@link CODE_DECISION_BODY_MAX_LINES} lines and no code fences.
 *
 * **Details**
 *
 * The body holds the decision, the reason, a `Rejected:` line for the
 * alternative and an `Accepted limit:` line if any. No fences, so nothing in
 * a decision needs compiling.
 *
 * **Example** (Validate bodies)
 *
 * ```ts
 * import { CodeDecisionBody } from "@beep/repo-cli/commands/Decisions"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodeDecisionBody)("Refuse leading-dash refs.\n\nRejected: a bare --.")) // true
 * console.log(S.is(CodeDecisionBody)("```ts\nconst x = 1\n```")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodeDecisionBody = S.String.check(
  S.makeFilter(
    (body: string) => A.length(bodyLines(body)) <= CODE_DECISION_BODY_MAX_LINES,
    $I.annote("CodeDecisionBodyMaxLines", {
      title: "Code Decision Body Length",
      description: `A code decision body holds at most ${CODE_DECISION_BODY_MAX_LINES} lines.`,
      message: `Expected a body of at most ${CODE_DECISION_BODY_MAX_LINES} lines`,
    })
  ),
  S.makeFilter(
    (body: string) => !A.some(bodyLines(body), isFenceLine),
    $I.annote("CodeDecisionBodyNoFences", {
      title: "Code Decision Body Without Fences",
      description: "A code decision body carries no code fences.",
      message: "Expected a body without code fences",
    })
  )
).pipe(
  $I.annoteSchema("CodeDecisionBody", {
    description: "The trimmed Markdown body of a code decision file.",
  })
);

/**
 * YAML frontmatter of a package code-decision file.
 *
 * **Details**
 *
 * `title`, `date` and `reversal` follow the goal-decision grammar;
 * `governs` names at least one {@link CodeDecisionAnchor}; `enforcedBy` lists
 * {@link CodeDecisionEnforcer}s and may be empty; `supersedes` names the file
 * this one replaces (which the same change deletes); `pullRequest` attributes
 * it. Files decode with `onExcessProperty: "error"`, so a misspelled key fails
 * `beep decisions check`.
 *
 * **Example** (Construct frontmatter)
 *
 * ```ts
 * import { CodeDecisionFrontmatter } from "@beep/repo-cli/commands/Decisions"
 *
 * const frontmatter = CodeDecisionFrontmatter.make({
 *   title: "Option-like git arguments are refused before spawn",
 *   date: "2026-11-21",
 *   reversal: "Delete rejectOptionLikeRefs; git then reads a leading-dash ref as a flag.",
 *   governs: ["src/Git.ts#rejectOptionLikeRefs"],
 *   enforcedBy: ["test/Git.test.ts#option-injection guard"],
 * })
 * console.log(frontmatter.governs.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeDecisionFrontmatter extends S.Opaque<CodeDecisionFrontmatter, { readonly brand: unique symbol }>()(
  S.Struct({
    title: DecisionSingleLine,
    date: DecisionDate,
    reversal: DecisionSingleLine,
    governs: S.NonEmptyArray(CodeDecisionAnchor),
    enforcedBy: S.Array(CodeDecisionEnforcer),
    supersedes: S.optionalKey(DecisionFileName),
    pullRequest: S.optionalKey(S.Int.check(S.isGreaterThan(0))),
  }).pipe(
    $I.annoteSchema("CodeDecisionFrontmatter", {
      description: "Schema-validated YAML frontmatter of a package code-decision file.",
    })
  )
) {}

/**
 * Namespace for {@link CodeDecisionFrontmatter} companion types.
 *
 * **Example** (Name the encoded type)
 *
 * ```ts
 * import type { CodeDecisionFrontmatter } from "@beep/repo-cli/commands/Decisions"
 *
 * const encoded: CodeDecisionFrontmatter.Encoded = {
 *   title: "Raw DDL for the disposable bundle",
 *   date: "2026-11-21",
 *   reversal: "Generate the bundle DDL with drizzle-kit.",
 *   governs: ["src/PracticeKg.projections.ts#createKgTables"],
 *   enforcedBy: [],
 * }
 * console.log(encoded.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CodeDecisionFrontmatter {
  /**
   * Encoded representation of {@link CodeDecisionFrontmatter}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CodeDecisionFrontmatter.Encoded;
}

/**
 * One parsed code-decision file.
 *
 * **Details**
 *
 * `file` is repository-relative; `packageRoot` is the repository-relative
 * directory of the owning package, the base every anchor path resolves from.
 *
 * **Example** (Construct a decision)
 *
 * ```ts
 * import { CodeDecision } from "@beep/repo-cli/commands/Decisions"
 *
 * const decision = CodeDecision.make({
 *   file: "packages/drivers/git/decisions/2026-11-21-option-like-arguments.md",
 *   packageRoot: "packages/drivers/git",
 *   frontmatter: {
 *     title: "Option-like git arguments are refused before spawn",
 *     date: "2026-11-21",
 *     reversal: "Delete rejectOptionLikeRefs.",
 *     governs: ["src/Git.ts#rejectOptionLikeRefs"],
 *     enforcedBy: [],
 *   },
 *   body: "Rejected: a bare -- separator.",
 * })
 * console.log(decision.packageRoot)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeDecision extends S.Opaque<CodeDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    packageRoot: S.String,
    frontmatter: CodeDecisionFrontmatter,
    body: CodeDecisionBody,
  }).pipe(
    $I.annoteSchema("CodeDecision", {
      description: "One package code-decision file after frontmatter and body decoding.",
    })
  )
) {}

/**
 * What a `beep decisions check` problem is about.
 *
 * **Details**
 *
 * `invalid-file`: the name, frontmatter or body does not decode.
 * `misplaced-file`: the file is not directly under a package's `decisions/`.
 * `unresolved-anchor`: a `governs` anchor names no top-level declaration.
 * `unresolved-enforcer`: an `enforcedBy` test anchor names no call title.
 * `unresolved-pointer`: a `// decision: <slug>` comment names no file.
 *
 * **Example** (Check a kind)
 *
 * ```ts
 * import { CodeDecisionProblemKind } from "@beep/repo-cli/commands/Decisions"
 *
 * console.log(CodeDecisionProblemKind.is["unresolved-pointer"]("unresolved-pointer")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodeDecisionProblemKind = LiteralKit([
  "invalid-file",
  "misplaced-file",
  "unresolved-anchor",
  "unresolved-enforcer",
  "unresolved-pointer",
]).pipe(
  $I.annoteSchema("CodeDecisionProblemKind", {
    description: "The rule a code-decision problem breaks.",
  })
);

/**
 * Code decision problem kind literal.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodeDecisionProblemKind = typeof CodeDecisionProblemKind.Type;

/**
 * One problem `beep decisions check` reports.
 *
 * **Example** (Construct a problem)
 *
 * ```ts
 * import { CodeDecisionProblem } from "@beep/repo-cli/commands/Decisions"
 *
 * const problem = CodeDecisionProblem.make({
 *   kind: "unresolved-pointer",
 *   file: "packages/demo/src/a.ts:3",
 *   message: "decision: missing-slug names no packages/demo/decisions/*-missing-slug.md",
 * })
 * console.log(problem.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeDecisionProblem extends S.Opaque<CodeDecisionProblem, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: CodeDecisionProblemKind,
    file: S.String,
    message: S.String,
  }).pipe(
    $I.annoteSchema("CodeDecisionProblem", {
      description: "A code-decision file, anchor or source pointer that fails beep decisions check.",
    })
  )
) {}

/**
 * The result of `beep decisions check`.
 *
 * **Details**
 *
 * `decisions` counts the files that decode; `unenforced` counts those with an
 * empty `enforcedBy`; `pointers` counts the `// decision: <slug>` comments
 * found in tracked source.
 *
 * **Example** (Construct an empty report)
 *
 * ```ts
 * import { CodeDecisionCheckReport } from "@beep/repo-cli/commands/Decisions"
 *
 * const report = CodeDecisionCheckReport.make({ decisions: 0, unenforced: 0, pointers: 0, problems: [] })
 * console.log(report.problems.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeDecisionCheckReport extends S.Opaque<CodeDecisionCheckReport, { readonly brand: unique symbol }>()(
  S.Struct({
    decisions: S.Int,
    unenforced: S.Int,
    pointers: S.Int,
    problems: S.Array(CodeDecisionProblem),
  }).pipe(
    $I.annoteSchema("CodeDecisionCheckReport", {
      description: "Counts and problems of one beep decisions check run.",
    })
  )
) {}

/**
 * One decision `beep decisions for` lists: its title, its file and the
 * anchors that matched the query.
 *
 * **Example** (Construct a match)
 *
 * ```ts
 * import { CodeDecisionMatch } from "@beep/repo-cli/commands/Decisions"
 *
 * const match = CodeDecisionMatch.make({
 *   title: "Option-like git arguments are refused before spawn",
 *   file: "packages/drivers/git/decisions/2026-11-21-option-like-arguments.md",
 *   anchors: ["src/Git.ts#rejectOptionLikeRefs"],
 * })
 * console.log(match.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeDecisionMatch extends S.Opaque<CodeDecisionMatch, { readonly brand: unique symbol }>()(
  S.Struct({
    title: S.String,
    file: S.String,
    anchors: S.Array(CodeDecisionAnchor),
  }).pipe(
    $I.annoteSchema("CodeDecisionMatch", {
      description: "A code decision whose governs anchors match a beep decisions for query.",
    })
  )
) {}

/**
 * One `// decision: <slug>` pointer comment found in tracked source.
 *
 * **Details**
 *
 * The comment is a line comment alone on its line; `slug` must name a
 * `decisions/<YYYY-MM-DD>-<slug>.md` file in the package that owns `file`
 * (the nearest `package.json` above it).
 *
 * **Example** (Construct a pointer)
 *
 * ```ts
 * import { CodeDecisionPointer } from "@beep/repo-cli/commands/Decisions"
 *
 * const pointer = CodeDecisionPointer.make({ file: "packages/drivers/git/src/Git.ts", line: 167, slug: "option-like-arguments" })
 * console.log(pointer.slug)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeDecisionPointer extends S.Opaque<CodeDecisionPointer, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    line: S.Int.check(S.isGreaterThan(0)),
    slug: S.String,
  }).pipe(
    $I.annoteSchema("CodeDecisionPointer", {
      description: "A // decision: <slug> line comment that cites a package code-decision file.",
    })
  )
) {}
