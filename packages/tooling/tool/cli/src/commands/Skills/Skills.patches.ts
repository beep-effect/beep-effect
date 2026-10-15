/**
 * Patch-series building blocks for vendored skills: line-level unified-diff
 * hunks and `.github/CODEOWNERS` owner resolution.
 *
 * **Details**
 *
 * A vendored skill whose installed tree differs from its pinned upstream
 * snapshot carries one patch per drifted file. Each patch is a plain Git
 * unified diff with three lines of context, so the HITL hunk review (B8) reads
 * real hunks rather than a whole-file replacement. Each patch is owned by the
 * `.github/CODEOWNERS` owner of the installed file, read from the merge-base
 * with GitHub's last-match semantics (B9), so a pull request cannot grant
 * itself ownership.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { diffLines, sameDiffLine } from "./internal/DiffLines.ts";
import { readAtMergeBase } from "./internal/MergeBase.ts";
import { SkillsCommandError } from "./Skills.errors.ts";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { DiffLine } from "./internal/DiffLines.ts";

const $I = $RepoCliId.create("commands/Skills/Skills.patches");

const UNIFIED_CONTEXT = 3;
const MAX_LCS_CELLS = 4_000_000;
const NO_NEWLINE_MARKER = "\\ No newline at end of file";

type DiffOpKind = "equal" | "delete" | "insert";
type DiffOp = {
  readonly kind: DiffOpKind;
  readonly line: DiffLine;
  readonly oldBefore: number;
  readonly newBefore: number;
};
type HunkSpan = { readonly from: number; to: number };

const cell = (table: Uint32Array, index: number): number => table[index] ?? 0;

// Longest-common-subsequence lengths of every suffix pair, row-major with width |after| + 1.
const lcsTable = (before: ReadonlyArray<DiffLine>, after: ReadonlyArray<DiffLine>): Uint32Array => {
  const width = A.length(after) + 1;
  const table = new Uint32Array((A.length(before) + 1) * width);
  for (let i = A.length(before) - 1; i >= 0; i--) {
    for (let j = A.length(after) - 1; j >= 0; j--) {
      table[i * width + j] = sameDiffLine(A.getUnsafe(before, i), A.getUnsafe(after, j))
        ? cell(table, (i + 1) * width + j + 1) + 1
        : Math.max(cell(table, (i + 1) * width + j), cell(table, i * width + j + 1));
    }
  }
  return table;
};

const boundedLcsTable = (before: ReadonlyArray<DiffLine>, after: ReadonlyArray<DiffLine>): Uint32Array | undefined =>
  (A.length(before) + 1) * (A.length(after) + 1) <= MAX_LCS_CELLS ? lcsTable(before, after) : undefined;

// Deletions win ties, so a changed block renders its `-` lines before its `+` lines, as Git does.
const nextOpKind = (
  before: ReadonlyArray<DiffLine>,
  after: ReadonlyArray<DiffLine>,
  table: Uint32Array,
  i: number,
  j: number
): DiffOpKind => {
  if (i >= A.length(before)) {
    return "insert";
  }
  if (j >= A.length(after)) {
    return "delete";
  }
  if (sameDiffLine(A.getUnsafe(before, i), A.getUnsafe(after, j))) {
    return "equal";
  }
  const width = A.length(after) + 1;
  return cell(table, (i + 1) * width + j) >= cell(table, i * width + j + 1) ? "delete" : "insert";
};

const commonPrefixLength = (before: ReadonlyArray<DiffLine>, after: ReadonlyArray<DiffLine>): number => {
  let prefix = 0;
  while (
    prefix < A.length(before) &&
    prefix < A.length(after) &&
    sameDiffLine(A.getUnsafe(before, prefix), A.getUnsafe(after, prefix))
  ) {
    prefix++;
  }
  return prefix;
};

const commonSuffixLength = (
  before: ReadonlyArray<DiffLine>,
  after: ReadonlyArray<DiffLine>,
  prefix: number
): number => {
  let suffix = 0;
  while (
    suffix < A.length(before) - prefix &&
    suffix < A.length(after) - prefix &&
    sameDiffLine(A.getUnsafe(before, A.length(before) - suffix - 1), A.getUnsafe(after, A.length(after) - suffix - 1))
  ) {
    suffix++;
  }
  return suffix;
};

const scriptKind = (
  before: ReadonlyArray<DiffLine>,
  after: ReadonlyArray<DiffLine>,
  changedBefore: ReadonlyArray<DiffLine>,
  changedAfter: ReadonlyArray<DiffLine>,
  table: Uint32Array | undefined,
  prefix: number,
  suffix: number,
  i: number,
  j: number
): DiffOpKind => {
  if (i < prefix || (i >= A.length(before) - suffix && j >= A.length(after) - suffix)) {
    return "equal";
  }
  if (table === undefined) {
    return i < A.length(before) - suffix ? "delete" : "insert";
  }
  return nextOpKind(changedBefore, changedAfter, table, i - prefix, j - prefix);
};

const editScript = (before: ReadonlyArray<DiffLine>, after: ReadonlyArray<DiffLine>): ReadonlyArray<DiffOp> => {
  // A large changed region gets a valid whole-region replacement instead of a
  // quadratic LCS table. Equal prefixes and suffixes still retain their context.
  const prefix = commonPrefixLength(before, after);
  const suffix = commonSuffixLength(before, after, prefix);
  const changedBefore = A.take(A.drop(before, prefix), A.length(before) - prefix - suffix);
  const changedAfter = A.take(A.drop(after, prefix), A.length(after) - prefix - suffix);
  const table = boundedLcsTable(changedBefore, changedAfter);
  const ops: Array<DiffOp> = [];
  let i = 0;
  let j = 0;
  while (i < A.length(before) || j < A.length(after)) {
    const kind = scriptKind(before, after, changedBefore, changedAfter, table, prefix, suffix, i, j);
    const line = kind === "insert" ? A.getUnsafe(after, j) : A.getUnsafe(before, i);
    ops.push({ kind, line, oldBefore: i, newBefore: j });
    i += kind === "insert" ? 0 : 1;
    j += kind === "delete" ? 0 : 1;
  }
  return ops;
};

// One span per change, widened by the context, merged with the previous span when they touch.
const hunkSpans = (ops: ReadonlyArray<DiffOp>): ReadonlyArray<HunkSpan> =>
  A.reduce(ops, A.empty<HunkSpan>(), (spans, op, index) => {
    if (op.kind === "equal") {
      return spans;
    }
    const from = Math.max(0, index - UNIFIED_CONTEXT);
    const to = Math.min(A.length(ops), index + UNIFIED_CONTEXT + 1);
    const previous = A.last(spans);
    if (O.isSome(previous) && from <= previous.value.to) {
      previous.value.to = to;
      return spans;
    }
    return A.append(spans, { from, to });
  });

// `git diff` range syntax: an empty side names the line before it, a one-line side omits the count.
const hunkRange = (linesBefore: number, count: number): string => {
  if (count === 0) {
    return `${linesBefore},0`;
  }
  return count === 1 ? `${linesBefore + 1}` : `${linesBefore + 1},${count}`;
};

const opPrefix: { readonly [Kind in DiffOpKind]: string } = { equal: " ", delete: "-", insert: "+" };

const renderOp = (op: DiffOp): ReadonlyArray<string> => {
  const rendered = `${opPrefix[op.kind]}${op.line.text}`;
  return op.line.eol ? [rendered] : [rendered, NO_NEWLINE_MARKER];
};

const renderHunk = (ops: ReadonlyArray<DiffOp>, span: HunkSpan): ReadonlyArray<string> => {
  const slice = A.take(A.drop(ops, span.from), span.to - span.from);
  const first = A.getUnsafe(slice, 0);
  const oldCount = A.length(A.filter(slice, (op) => op.kind !== "insert"));
  const newCount = A.length(A.filter(slice, (op) => op.kind !== "delete"));
  return A.prepend(
    A.flatMap(slice, renderOp),
    `@@ -${hunkRange(first.oldBefore, oldCount)} +${hunkRange(first.newBefore, newCount)} @@`
  );
};

/**
 * Renders the unified-diff hunks that turn `before` into `after`.
 *
 * **Details**
 *
 * Lines are compared by text and by whether they end in a newline, so a file
 * that only gained or lost its final newline still produces a hunk, marked
 * with Git's `\ No newline at end of file`. Hunks carry three lines of
 * context and use `git diff`'s range syntax. The result holds only `@@`
 * headers and hunk bodies; the caller adds the `diff --git`, `---`, and `+++`
 * file headers. Equal inputs produce no hunks.
 *
 * **Example** (Diff one changed line)
 *
 * ```ts
 * import { renderUnifiedHunks } from "@beep/repo-cli/commands/Skills/Skills.patches"
 *
 * console.log(renderUnifiedHunks("a\nb\nc\n", "a\nB\nc\n"))
 * // ["@@ -1,3 +1,3 @@", " a", "-b", "+B", " c"]
 * ```
 *
 * @param before - The pristine text.
 * @param after - The installed text.
 * @returns The hunk lines, without file headers or a trailing newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderUnifiedHunks: {
  (after: string): (before: string) => ReadonlyArray<string>;
  (before: string, after: string): ReadonlyArray<string>;
} = dual(2, (before: string, after: string): ReadonlyArray<string> => {
  const ops = editScript(diffLines(before), diffLines(after));
  return A.flatMap(hunkSpans(ops), (span) => renderHunk(ops, span));
});

const globTokens: Readonly<Record<string, string>> = {
  "**/": "(?:.*/)?",
  "/**": "(?:/.*)?",
  "**": ".*",
  "*": "[^/]*",
  "?": "[^/]",
};

const escapeRegExp = Str.replace(/[.+^${}()|[\]\\]/gu, "\\$&");

const globSource = (glob: string): string =>
  A.join(
    A.map(Str.split(glob, /(\*\*\/|\/\*\*|\*\*|\*|\?)/u), (token) =>
      O.getOrElse(R.get(globTokens, token), () => escapeRegExp(token))
    ),
    ""
  );

// gitignore-style matching: a pattern with a leading or inner slash is anchored to the root, a
// trailing slash matches only below a directory, and a matched directory owns everything under it.
const codeownersPattern = (pattern: string): RegExp => {
  const directoryOnly = Str.endsWith("/")(pattern);
  const body = Str.replace(/^\/+|\/+$/gu, "")(pattern);
  const anchored = Str.startsWith("/")(pattern) || Str.includes("/")(body);
  const prefix = anchored ? "^" : "^(?:.*/)?";
  const suffix = directoryOnly ? "/.*$" : "(?:/.*)?$";
  return new RegExp(`${prefix}${globSource(body)}${suffix}`, "u");
};

type CodeownersRule = { readonly pattern: RegExp; readonly owners: ReadonlyArray<string> };

const parseCodeownersLine = (line: string): O.Option<CodeownersRule> => {
  const content = Str.trim(Str.replace(/(^|\s)#.*$/u, "")(line));
  if (Str.isEmpty(content)) {
    return O.none();
  }
  const [pattern, ...owners] = Str.split(content, /\s+/u);
  return O.map(O.fromUndefinedOr(pattern), (value) => ({ pattern: codeownersPattern(value), owners }));
};

/**
 * Resolves the owner of a repository path from `.github/CODEOWNERS` text.
 *
 * **Details**
 *
 * GitHub semantics: the last matching line wins, patterns follow gitignore
 * rules (`*` stays within one path segment, `**` crosses segments, a leading
 * or inner `/` anchors to the repository root, a trailing `/` matches only
 * below a directory), and `#` starts a comment. Several owners on the winning
 * line are joined with a space. A winning line with no owners leaves the path
 * deliberately unowned, so the result is `None`, as it is when nothing matches.
 *
 * **Example** (Let the last match win)
 *
 * ```ts
 * import { resolveCodeownersOwner } from "@beep/repo-cli/commands/Skills/Skills.patches"
 * import * as O from "effect/Option"
 *
 * const codeowners = "* @kriegcloud\n.claude/skills/ @skills-team @kriegcloud\n"
 * console.log(O.getOrNull(resolveCodeownersOwner(codeowners, ".claude/skills/oracle/SKILL.md")))
 * // "@skills-team @kriegcloud"
 * ```
 *
 * @param codeowners - The CODEOWNERS file text.
 * @param repoPath - A repository-relative path with forward slashes.
 * @returns The winning line's owners, or `None` when the path has no owner.
 * @category utilities
 * @since 0.0.0
 */
export const resolveCodeownersOwner: {
  (repoPath: string): (codeowners: string) => O.Option<string>;
  (codeowners: string, repoPath: string): O.Option<string>;
} = dual(2, (codeowners: string, repoPath: string): O.Option<string> => {
  const rules = A.getSomes(A.map(Str.split(codeowners, "\n"), parseCodeownersLine));
  return O.flatMap(
    A.findLast(rules, (rule) => rule.pattern.test(repoPath)),
    (rule) => (A.isReadonlyArrayNonEmpty(rule.owners) ? O.some(A.join(rule.owners, " ")) : O.none())
  );
});

/**
 * Service contract that names the owner of a generated skill patch.
 *
 * @see {@link SkillPatchOwnerSource} for the injectable service built on this contract.
 * @category services
 * @since 0.0.0
 */
export interface SkillPatchOwnerSourceShape {
  /** Resolve the CODEOWNERS owner of `repoPath`, failing when no line owns it. */
  readonly ownerOf: (repoRoot: string, repoPath: string) => Effect.Effect<string, SkillsCommandError>;
}

/**
 * Injectable owner resolver for generated skill patches.
 *
 * **When to use**
 *
 * Use when computing a vendored skill's patch series: every patch names the
 * owner of the installed file it changes. A test supplies fixed CODEOWNERS
 * text with {@link skillPatchOwnerSourceFromCodeowners}; the live layer reads
 * the file at the merge-base.
 *
 * **Example** (Resolve an owner from fixed CODEOWNERS text)
 *
 * ```ts
 * import { SkillPatchOwnerSource, skillPatchOwnerSourceFromCodeowners } from "@beep/repo-cli/commands/Skills/Skills.patches"
 * import * as Effect from "effect/Effect"
 *
 * const owner = Effect.gen(function* () {
 *   const source = yield* SkillPatchOwnerSource
 *   return yield* source.ownerOf("/workspace", ".claude/skills/oracle/SKILL.md")
 * })
 *
 * const program = Effect.provideService(owner, SkillPatchOwnerSource, skillPatchOwnerSourceFromCodeowners("* @kriegcloud\n"))
 * console.log(Effect.runSync(program)) // "@kriegcloud"
 * ```
 *
 * @see {@link SkillPatchOwnerSourceLive} for the merge-base implementation.
 * @category services
 * @since 0.0.0
 */
export class SkillPatchOwnerSource extends Context.Service<SkillPatchOwnerSource, SkillPatchOwnerSourceShape>()(
  $I`SkillPatchOwnerSource`
) {}

const ownerOrFail = (codeowners: O.Option<string>, origin: string, repoPath: string) =>
  O.flatMap(codeowners, resolveCodeownersOwner(repoPath)).pipe(
    Effect.fromOption,
    Effect.mapError(() =>
      SkillsCommandError.make({
        message: `No .github/CODEOWNERS line at ${origin} owns ${repoPath}; a generated skill patch needs an owner (B9).`,
        file: repoPath,
      })
    )
  );

/**
 * Builds an owner resolver over fixed CODEOWNERS text.
 *
 * **Example** (Supply fixed ownership)
 *
 * ```ts
 * import { skillPatchOwnerSourceFromCodeowners } from "@beep/repo-cli/commands/Skills/Skills.patches"
 * import * as Effect from "effect/Effect"
 *
 * const source = skillPatchOwnerSourceFromCodeowners("* @kriegcloud\n")
 * console.log(Effect.runSync(source.ownerOf("/workspace", "skills-lock.json"))) // "@kriegcloud"
 * ```
 *
 * @param codeowners - The CODEOWNERS text every lookup reads.
 * @returns A resolver that ignores `repoRoot` and applies last-match semantics.
 * @category constructors
 * @since 0.0.0
 */
export const skillPatchOwnerSourceFromCodeowners = (codeowners: string): SkillPatchOwnerSourceShape =>
  SkillPatchOwnerSource.of({
    ownerOf: Effect.fn("SkillPatchOwnerSource.fromCodeowners.ownerOf")((_repoRoot, repoPath) =>
      ownerOrFail(O.some(codeowners), "the supplied text", repoPath)
    ),
  });

const CODEOWNERS_BASE_REF = "origin/main";
const CODEOWNERS_PATH = ".github/CODEOWNERS";

type MergeBaseCodeowners = { readonly base: string; readonly codeowners: O.Option<string> };

// The base copy is read so a pull request cannot grant itself ownership (B9, K6). A base without
// the file yields `None`, which fails only when a patch actually needs an owner.
const readMergeBaseCodeowners = Effect.fn("SkillPatchOwnerSource.readMergeBaseCodeowners")(function* (
  repoRoot: string
): Effect.fn.Return<MergeBaseCodeowners, SkillsCommandError, ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto> {
  const read = yield* readAtMergeBase(repoRoot, CODEOWNERS_BASE_REF, CODEOWNERS_PATH, "patch ownership");
  return { base: read.base, codeowners: read.text };
});

const makeSkillPatchOwnerSource = Effect.gen(function* () {
  const runtime = yield* Effect.context<ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto>();
  const cache = MutableHashMap.empty<string, MergeBaseCodeowners>();
  const codeownersAt = Effect.fn("SkillPatchOwnerSource.codeownersAt")(function* (repoRoot: string) {
    const cached = MutableHashMap.get(cache, repoRoot);
    if (O.isSome(cached)) {
      return cached.value;
    }
    const read = yield* readMergeBaseCodeowners(repoRoot).pipe(Effect.provide(runtime));
    MutableHashMap.set(cache, repoRoot, read);
    return read;
  });
  return SkillPatchOwnerSource.of({
    ownerOf: Effect.fn("SkillPatchOwnerSource.ownerOf")(function* (repoRoot, repoPath) {
      const read = yield* codeownersAt(repoRoot);
      return yield* ownerOrFail(read.codeowners, `merge-base ${Str.slice(0, 10)(read.base)}`, repoPath);
    }),
  });
}).pipe(Effect.withSpan("SkillPatchOwnerSource.make"));

/**
 * Live owner resolver reading `.github/CODEOWNERS` at the merge-base with `origin/main`.
 *
 * **Details**
 *
 * The file is read once per repository root through
 * `git show <merge-base>:.github/CODEOWNERS` and cached for the layer's lifetime. The
 * layer stays open on the child-process spawner and crypto services.
 *
 * **Gotchas**
 *
 * A checkout without an `origin/main` ref cannot resolve a merge-base, so any
 * patch that needs an owner fails rather than falling back to the working copy.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { SkillPatchOwnerSourceLive } from "@beep/repo-cli/commands/Skills/Skills.patches"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(SkillPatchOwnerSourceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillPatchOwnerSourceLive = Layer.effect(SkillPatchOwnerSource, makeSkillPatchOwnerSource);
