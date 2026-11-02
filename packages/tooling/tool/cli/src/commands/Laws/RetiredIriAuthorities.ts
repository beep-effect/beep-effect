/**
 * Repo-local retired IRI authority law.
 *
 * **Details**
 *
 * The identity authority moved to the single public origin's `/ns/` route and
 * every retired authority host was cut over in one change. Rule 1 scans every
 * git-tracked text file for any host form of a retired authority. Rule 2 keeps
 * the public origin out of hand-written code: outside `@beep/identity`,
 * `@beep/public-site`, and test code, a string or template literal must not
 * spell it; code derives IRIs from `$I` and hosted URLs from `hostedUrl`.
 *
 * **Gotchas**
 *
 * Patterns are built from escaped host labels at module load, so this file
 * never spells a host it enforces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Regex from "effect/RegExp";
import * as Str from "effect/String";
import { ts } from "ts-morph";
import {
  lineStartOffsets,
  locateIndex,
  messageGitErrorAdapter,
  scanTrackedTextFiles,
} from "./internal/TrackedTextFiles.ts";
import { RetiredIriAuthoritiesExecutionError } from "./Laws.errors.ts";
import {
  publicOriginHostLabels,
  RetiredIriAuthoritiesSummary,
  RetiredIriAuthorityFinding,
  retiredIriAuthorities,
  retiredIriAuthoritiesScope,
} from "./RetiredIriAuthorities.model.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RetiredIriAuthoritiesOptions, RetiredIriAuthorityRule } from "./RetiredIriAuthorities.model.ts";

const hostOf = (labels: ReadonlyArray<string>): string => A.join(labels, ".");

const publicOriginHost = hostOf(publicOriginHostLabels);

/** The public origin, assembled at runtime so this file never spells it. */
const publicOrigin = `https://${publicOriginHost}`;

/** A host may not continue as a longer DNS name (`.devtools`, `.shop`, `.sh.example`). */
const HOST_END = String.raw`(?![\w-]|\.[\w-])`;

/**
 * `//` as written, JSON-escaped (`\/\/`), or percent-encoded (`%2F%2F`), with an
 * optional http(s) scheme in the same spelling.
 */
const AUTHORITY_PREFIX = String.raw`(?:https?(?::|%3A))?(?:\/\/|\\\/\\\/|%2F%2F)`;

const RETIRED_HOSTS = A.join(
  A.map(retiredIriAuthorities, (row) => Regex.escape(hostOf(row.labels))),
  "|"
);

/**
 * Rule 1: a retired host, or any subdomain of one, after an authority prefix or
 * after `@` (an email domain), or standing alone (`<host>`, `docs.<host>`,
 * `docs.<host>/page`) where it cannot be part of a longer name or a file path
 * (`scripts/<host>`).
 */
const RETIRED_AUTHORITY_PATTERN = new RegExp(
  String.raw`(?:(?:${AUTHORITY_PREFIX}|@)|(?<![\w.@/\\-]))(?:[\w-]+\.)*(?:${RETIRED_HOSTS})${HOST_END}`,
  "giu"
);

/** Rule 2: the apex or `www` public origin with an http(s) scheme; service subdomains do not match. */
const PUBLIC_ORIGIN_PATTERN = new RegExp(
  String.raw`(?<![\w.-])https?:\/\/(?:www\.)?${Regex.escape(publicOriginHost)}${HOST_END}`,
  "giu"
);

/** Cheap pre-filter shared by every retired host. */
const RETIRED_PREFILTER = /beep/iu;

type RawMatch = {
  readonly index: number;
  readonly text: string;
};

type Span = {
  readonly start: number;
  readonly end: number;
};

const byPosition = Order.combine(
  Order.mapInput(Order.Number, (finding: RetiredIriAuthorityFinding) => finding.line),
  Order.mapInput(Order.Number, (finding: RetiredIriAuthorityFinding) => finding.column)
);

const collectMatches = (content: string, pattern: RegExp): ReadonlyArray<RawMatch> =>
  A.getSomes(
    A.map(A.fromIterable(F.pipe(content, Str.matchAll(pattern))), (match) =>
      O.map(O.fromNullishOr(match.index), (index) => ({ index, text: match[0] }))
    )
  );

/** `//` as written, JSON-escaped (`\/\/`), or percent-encoded (`%2F%2F`, any case): the match is an IRI, not prose. */
const AUTHORITY_SEPARATOR_PATTERN = /\/\/|\\\/\\\/|%2F%2F/iu;

const defang = (host: string): string => F.pipe(host, Str.replaceAll(".", "[.]"));

const retiredAuthoritySuggestion = (match: string): string => {
  if (F.pipe(match, Str.startsWith("@"))) {
    return "use an RFC 2606 example.com address";
  }
  if (AUTHORITY_SEPARATOR_PATTERN.test(match)) {
    return `${publicOrigin}/ns/<path> (derive with $I from @beep/identity)`;
  }
  return `defang the host in prose (${defang(match)}) or derive the IRI with $I from @beep/identity`;
};

const PUBLIC_ORIGIN_SUGGESTION = "derive with $I (@beep/identity) or hostedUrl (@beep/public-site)";

const toFinding =
  (
    file: string,
    lineStarts: ReadonlyArray<number>,
    rule: RetiredIriAuthorityRule,
    suggest: (match: string) => string
  ) =>
  (match: RawMatch): RetiredIriAuthorityFinding =>
    RetiredIriAuthorityFinding.make({
      file,
      ...locateIndex(lineStarts, match.index),
      match: match.text,
      rule,
      suggestion: suggest(match.text),
    });

const directorySegments = (file: string): ReadonlyArray<string> => A.dropRight(Str.split("/")(file), 1);

const basename = (file: string): string => A.lastNonEmpty(Str.split("/")(file));

const hasAnyPrefix = (file: string, prefixes: ReadonlyArray<string>): boolean =>
  A.some(prefixes, (prefix) => F.pipe(file, Str.startsWith(prefix)));

/**
 * Scan one file's text for any host form of a retired IRI authority (rule 1).
 *
 * **Details**
 *
 * Comments, prose, JSON, and data are all scanned. A host, or any subdomain of
 * it, matches after a `scheme://` or `//` prefix (also JSON-escaped or
 * percent-encoded) and as an `@` email domain; a bare host matches standing
 * alone. Nothing matches inside a longer DNS name or as a file name after a
 * path separator. Lines and columns are 1-based; columns count UTF-16 code
 * units.
 *
 * **Example** (Find a retired authority in an IRI)
 *
 * ```ts
 * import { scanRetiredIriAuthorityText } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities"
 *
 * const host = ["beep", "dev"].join(".")
 * const [finding] = scanRetiredIriAuthorityText("notes.md", `see https://${host}/epistemic/Claim\n`)
 * console.log(finding?.column) // 5
 * ```
 *
 * **Example** (Scan in a pipeline)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import { scanRetiredIriAuthorityText } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities"
 *
 * console.log(pipe("notes.md", scanRetiredIriAuthorityText("nothing retired here")).length) // 0
 * ```
 *
 * @param file - Repository-relative path recorded on each finding.
 * @param content - The file's text.
 * @returns Findings ordered by position.
 * @category utilities
 * @since 0.0.0
 */
export const scanRetiredIriAuthorityText: {
  (content: string): (file: string) => ReadonlyArray<RetiredIriAuthorityFinding>;
  (file: string, content: string): ReadonlyArray<RetiredIriAuthorityFinding>;
} = F.dual(2, (file: string, content: string): ReadonlyArray<RetiredIriAuthorityFinding> => {
  if (!RETIRED_PREFILTER.test(content)) {
    return A.empty();
  }
  return A.match(collectMatches(content, RETIRED_AUTHORITY_PATTERN), {
    onEmpty: A.empty<RetiredIriAuthorityFinding>,
    onNonEmpty: A.map(toFinding(file, lineStartOffsets(content), "retired-authority", retiredAuthoritySuggestion)),
  });
});

const scriptKindOf = (file: string): ts.ScriptKind => {
  if (F.pipe(file, Str.endsWith(".tsx"))) {
    return ts.ScriptKind.TSX;
  }
  if (F.pipe(file, Str.endsWith(".jsx"))) {
    return ts.ScriptKind.JSX;
  }
  if (A.some([".js", ".mjs", ".cjs"], (extension) => F.pipe(file, Str.endsWith(extension)))) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
};

const isLiteralToken = (node: ts.Node): boolean =>
  ts.isStringLiteral(node) ||
  ts.isNoSubstitutionTemplateLiteral(node) ||
  ts.isTemplateHead(node) ||
  ts.isTemplateMiddle(node) ||
  ts.isTemplateTail(node) ||
  ts.isJsxText(node);

const literalSpans = (file: string, content: string): ReadonlyArray<Span> => {
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, false, scriptKindOf(file));
  const spans: Array<Span> = [];
  const visit = (node: ts.Node): void => {
    if (isLiteralToken(node)) {
      spans.push({ start: node.getStart(sourceFile), end: node.getEnd() });
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return spans;
};

const insideAnySpan =
  (spans: ReadonlyArray<Span>) =>
  (match: RawMatch): boolean =>
    A.some(spans, (span) => match.index >= span.start && match.index < span.end);

/**
 * Scan one source file for the public origin inside string and template literals (rule 2).
 *
 * **Details**
 *
 * Only files whose text names the origin host are parsed. The TypeScript
 * parser bounds every string literal, template head, middle, and tail, and
 * JSX text; a match in a comment is documentation and is not reported. The
 * script kind follows the file extension.
 *
 * **Example** (Report a hand-written origin in code but not in a comment)
 *
 * ```ts
 * import { scanPublicOriginLiterals } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities"
 *
 * const origin = `https://${["beep-effect", "com"].join(".")}`
 * const source = `// ${origin}/docs\nexport const docs = "${origin}/docs"\n`
 * console.log(scanPublicOriginLiterals("packages/x/src/a.ts", source).map((finding) => finding.line)) // [ 2 ]
 * ```
 *
 * @param file - Repository-relative path; its extension picks the script kind.
 * @param content - The file's text.
 * @returns Findings ordered by position.
 * @category utilities
 * @since 0.0.0
 */
export const scanPublicOriginLiterals: {
  (content: string): (file: string) => ReadonlyArray<RetiredIriAuthorityFinding>;
  (file: string, content: string): ReadonlyArray<RetiredIriAuthorityFinding>;
} = F.dual(2, (file: string, content: string): ReadonlyArray<RetiredIriAuthorityFinding> => {
  if (!F.pipe(Str.toLowerCase(content), Str.includes(publicOriginHost))) {
    return A.empty();
  }
  const matches = collectMatches(content, PUBLIC_ORIGIN_PATTERN);
  if (A.isReadonlyArrayEmpty(matches)) {
    return A.empty();
  }
  const inLiterals = A.filter(matches, insideAnySpan(literalSpans(file, content)));
  return A.map(
    inLiterals,
    toFinding(file, lineStartOffsets(content), "public-origin-literal", () => PUBLIC_ORIGIN_SUGGESTION)
  );
});

/**
 * Whether both rules skip a repository-relative path.
 *
 * **Details**
 *
 * Any `history` directory segment, at any depth, exempts the file; only the
 * top-level `research/` tree is exempt, not a nested packet `research/`.
 *
 * **Example** (Exempt packet history but not nested research)
 *
 * ```ts
 * import { isRetiredIriAuthorityExempt } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities"
 *
 * console.log(isRetiredIriAuthorityExempt("goals/x/history/2026-10-20-brief.md")) // true
 * console.log(isRetiredIriAuthorityExempt("goals/x/research/notes.md")) // false
 * ```
 *
 * @param file - Repository-relative path.
 * @returns `true` when the file is exempt from the law.
 * @category utilities
 * @since 0.0.0
 */
export const isRetiredIriAuthorityExempt = (file: string): boolean =>
  A.some(directorySegments(file), (segment) =>
    A.contains(retiredIriAuthoritiesScope.exemptDirectorySegments, segment)
  ) || hasAnyPrefix(file, retiredIriAuthoritiesScope.exemptRootPrefixes);

/**
 * Whether the public-origin rule never reports a repository-relative path.
 *
 * **Example** (Read the bootstrap allowlist)
 *
 * ```ts
 * import { isPublicOriginAllowlisted } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities"
 *
 * console.log(isPublicOriginAllowlisted("packages/tooling/test-kit/test-runner/src/Vitest.errors.ts")) // true
 * ```
 *
 * @param file - Repository-relative path.
 * @returns `true` when the file is on the public-origin allowlist.
 * @category utilities
 * @since 0.0.0
 */
export const isPublicOriginAllowlisted = (file: string): boolean =>
  A.some(retiredIriAuthoritiesScope.originAllowlist, (entry) => entry.file === file);

/**
 * Whether the public-origin rule applies to a repository-relative path.
 *
 * **Details**
 *
 * The rule covers JavaScript and TypeScript sources under the code roots at
 * any depth, package-root configs included, except the owner packages, test
 * code (test directories, fixtures, `.test.` and `.spec.` files), and the
 * allowlist.
 *
 * **Example** (Scope code but not tests or owners)
 *
 * ```ts
 * import { isPublicOriginScoped } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities"
 *
 * console.log(isPublicOriginScoped("apps/web/vite.config.ts")) // true
 * console.log(isPublicOriginScoped("packages/x/test/a.test.ts")) // false
 * console.log(isPublicOriginScoped("packages/foundation/modeling/public-site/src/index.ts")) // false
 * ```
 *
 * @param file - Repository-relative path.
 * @returns `true` when rule 2 scans the file.
 * @category utilities
 * @since 0.0.0
 */
export const isPublicOriginScoped = (file: string): boolean => {
  const scope = retiredIriAuthoritiesScope;
  const name = basename(file);
  return (
    hasAnyPrefix(file, scope.originSourceRoots) &&
    A.some(scope.originSourceExtensions, (extension) => F.pipe(name, Str.endsWith(extension))) &&
    !hasAnyPrefix(file, scope.originOwnerPrefixes) &&
    !A.some(directorySegments(file), (segment) => A.contains(scope.originTestDirectorySegments, segment)) &&
    !A.some(scope.originTestBasenameMarkers, (marker) => F.pipe(name, Str.includes(marker))) &&
    !isPublicOriginAllowlisted(file)
  );
};

/**
 * Apply both rules to one file, honoring the exemptions and the rule-2 scope.
 *
 * **Example** (Skip an exempt history file)
 *
 * ```ts
 * import { scanRetiredIriAuthorityFile } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities"
 *
 * const host = ["beep", "dev"].join(".")
 * console.log(scanRetiredIriAuthorityFile("goals/x/history/a.md", `https://${host}/a`).length) // 0
 * console.log(scanRetiredIriAuthorityFile("goals/x/README.md", `https://${host}/a`).length) // 1
 * ```
 *
 * @param file - Repository-relative path.
 * @param content - The file's text.
 * @returns Findings of both rules ordered by position.
 * @category utilities
 * @since 0.0.0
 */
export const scanRetiredIriAuthorityFile: {
  (content: string): (file: string) => ReadonlyArray<RetiredIriAuthorityFinding>;
  (file: string, content: string): ReadonlyArray<RetiredIriAuthorityFinding>;
} = F.dual(2, (file: string, content: string): ReadonlyArray<RetiredIriAuthorityFinding> => {
  if (isRetiredIriAuthorityExempt(file)) {
    return A.empty();
  }
  const retired = scanRetiredIriAuthorityText(file, content);
  return isPublicOriginScoped(file)
    ? A.sort(A.appendAll(retired, scanPublicOriginLiterals(file, content)), byPosition)
    : retired;
});

/**
 * Render one finding as a `file:line:col  match  →  suggestion` report line.
 *
 * **Example** (Format a finding)
 *
 * ```ts
 * import { formatRetiredIriAuthorityFinding, scanRetiredIriAuthorityText } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities"
 *
 * const host = ["beep", "dev"].join(".")
 * for (const finding of scanRetiredIriAuthorityText("demo.md", `mail team@${host}\n`)) {
 *   console.log(formatRetiredIriAuthorityFinding(finding).startsWith("demo.md:1:10  @")) // true
 * }
 * ```
 *
 * @param finding - The finding to render.
 * @returns One human-readable report line.
 * @category utilities
 * @since 0.0.0
 */
export const formatRetiredIriAuthorityFinding = (finding: RetiredIriAuthorityFinding): string =>
  `${finding.file}:${finding.line}:${finding.column}  ${finding.match}  →  ${finding.suggestion}`;

/**
 * Run the retired IRI authority law over every git-tracked text file.
 *
 * **Details**
 *
 * Lists index entries with `git ls-files --stage`, keeps regular files, skips
 * exempt paths and any file containing a NUL byte, and scans the working-tree
 * text. Untracked files are not listed, so they are never scanned; index
 * entries deleted from the working tree are skipped.
 *
 * **Example** (Count findings in the repository)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { RetiredIriAuthoritiesOptions } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 * import { runRetiredIriAuthorities } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities"
 *
 * const program = Effect.map(
 *   runRetiredIriAuthorities(RetiredIriAuthoritiesOptions.make({ cwd: process.cwd(), strictCheck: true })),
 *   (summary) => summary.findings.length
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository location and strictness.
 * @returns Effect that scans the tracked files and summarizes every finding.
 * @category utilities
 * @since 0.0.0
 */
export const runRetiredIriAuthorities = Effect.fn("RetiredIriAuthorities.runRetiredIriAuthorities")(function* (
  options: RetiredIriAuthoritiesOptions
): Effect.fn.Return<
  RetiredIriAuthoritiesSummary,
  RetiredIriAuthoritiesExecutionError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const { skippedFiles, ...scan } = yield* scanTrackedTextFiles({
    cwd: options.cwd,
    gitErrors: messageGitErrorAdapter(RetiredIriAuthoritiesExecutionError.new),
    mapError: RetiredIriAuthoritiesExecutionError.mapError,
    isSkipped: isRetiredIriAuthorityExempt,
    scan: scanRetiredIriAuthorityFile,
  });
  return RetiredIriAuthoritiesSummary.make({
    ...scan,
    exemptFiles: skippedFiles,
    strictFailure: options.strictCheck && A.isReadonlyArrayNonEmpty(scan.findings),
  });
});
