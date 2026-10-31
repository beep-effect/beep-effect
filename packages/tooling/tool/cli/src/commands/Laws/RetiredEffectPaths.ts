/**
 * Repo-local retired Effect module path law.
 *
 * **Details**
 *
 * Effect moved every module out of its `unstable` namespace with no
 * compatibility re-exports (`.patterns/effect-module-paths.md`). This law
 * scans every git-tracked text file for a retired path, or a Markdown link
 * fragment holding a retired path's heading slug, and suggests the current
 * one, so a stale path in code, prose, JSON, or a table of contents cannot
 * return.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import {
  lineStartOffsets,
  locateIndex,
  messageGitErrorAdapter,
  scanTrackedTextFiles,
} from "./internal/TrackedTextFiles.ts";
import { RetiredEffectPathsExecutionError } from "./Laws.errors.ts";
import {
  RetiredEffectPathFinding,
  RetiredEffectPathMatchKind,
  RetiredEffectPathsSummary,
  retiredEffectPathMappings,
  retiredEffectPathsAllowlist,
} from "./RetiredEffectPaths.model.ts";
import type * as Crypto from "effect/Crypto";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type {
  RetiredEffectPathMapping,
  RetiredEffectPathRule,
  RetiredEffectPathsOptions,
} from "./RetiredEffectPaths.model.ts";

/** `effect/` + `unstable` at a word boundary, plus any `/segment` chain that follows it. */
const MODULE_SPECIFIER_PATTERN = /effect\/unstable\b(?:\/[\w*-]+)*/gu;

/** A retired `unstable/<module>` source directory, or the retired arbitrary module file. */
const SOURCE_PATH_PATTERN =
  /(?<![\w-])unstable\/(?:arbitrary\/Arbitrary\.(?:d\.ts|ts|js)\b|(?:ai|cli|cluster|devtools|encoding|eventlog|http|httpapi|net|observability|persistence|process|reactivity|rpc|schema|socket|sql|workers|workflow|arbitrary)\b)/gu;

/**
 * The `#fragment` of an inline link `](…#…)` or a reference definition
 * `]: …#…`. Consume unterminated candidates too, so a failed opener cannot
 * restart the search over the same suffix. Callers discard candidates without
 * a fragment. Both valid and malformed candidates advance over disjoint spans.
 */
const LINK_FRAGMENT_PATTERN = /\](?:\(|:[ \t]*)[^\s)#]*(?:#[^\s)]*|(?=[\s)]|$))/gu;

/**
 * A retired path's GitHub heading slug (`effect/unstable/reactivity/Atom` →
 * `effectunstablereactivityatom`), searched only inside a link fragment. The
 * slug runs to the next hyphen, since slugging turns the heading's spaces into
 * hyphens.
 */
const ANCHOR_SLUG_PATTERN = /effectunstable[\p{L}\p{N}_]*/gu;

/** Cheap pre-filter: every match of every rule contains this literal. */
const RULE_LITERAL = "unstable";

type RawMatch = {
  readonly index: number;
  readonly text: string;
  readonly rule: RetiredEffectPathRule;
};

const byIndexAscending = Order.mapInput(Order.Number, (match: RawMatch) => match.index);

const collectMatches = (content: string, pattern: RegExp, rule: RetiredEffectPathRule): ReadonlyArray<RawMatch> =>
  A.map(A.fromIterable(F.pipe(content, Str.matchAll(pattern))), (match) => ({
    index: match.index ?? 0,
    text: match[0],
    rule,
  }));

const collectAnchorSlugMatches = (content: string): ReadonlyArray<RawMatch> =>
  A.flatMap(
    A.filter(collectMatches(content, LINK_FRAGMENT_PATTERN, "anchor-slug"), (link) => Str.includes("#")(link.text)),
    (link: RawMatch) => {
      const fragmentStart = Str.length(A.headNonEmpty(Str.split(link.text, "#"))) + 1;
      return A.map(
        collectMatches(Str.slice(fragmentStart)(link.text), ANCHOR_SLUG_PATTERN, "anchor-slug"),
        (match) => ({
          ...match,
          index: link.index + fragmentStart + match.index,
        })
      );
    }
  );

const isInsideSpan =
  (spans: ReadonlyArray<RawMatch>) =>
  (match: RawMatch): boolean =>
    A.some(spans, (span) => match.index >= span.index && match.index < span.index + Str.length(span.text));

const mappingFits =
  (rule: RetiredEffectPathRule, text: string) =>
  (row: RetiredEffectPathMapping): boolean =>
    row.rule === rule &&
    RetiredEffectPathMatchKind.match(row.kind, {
      exact: () => row.retired === text,
      prefix: () => F.pipe(text, Str.startsWith(row.retired)),
    });

/**
 * Compute the current path for a retired span from the mapping table.
 *
 * **Details**
 *
 * The first row of {@link retiredEffectPathMappings} that fits wins. A prefix
 * row keeps the span's remainder, so `effect/unstable/http/HttpClient` becomes
 * `effect/http/HttpClient`.
 *
 * **Example** (Suggest the http-api rename)
 *
 * ```ts
 * import { suggestRetiredEffectPath } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths"
 *
 * console.log(suggestRetiredEffectPath("effect/unstable/httpapi", "module-specifier")) // "effect/http-api"
 * ```
 *
 * **Example** (Suggest in a pipeline)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import { suggestRetiredEffectPath } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths"
 *
 * console.log(pipe("unstable/rpc", suggestRetiredEffectPath("source-path"))) // "rpc"
 * ```
 *
 * @param text - The matched retired span.
 * @param rule - Rule that matched the span.
 * @returns The replacement text, or the span itself when no row fits.
 * @category utilities
 * @since 0.0.0
 */
export const suggestRetiredEffectPath: {
  (rule: RetiredEffectPathRule): (text: string) => string;
  (text: string, rule: RetiredEffectPathRule): string;
} = F.dual(2, (text: string, rule: RetiredEffectPathRule): string =>
  F.pipe(
    A.findFirst(retiredEffectPathMappings, mappingFits(rule, text)),
    O.map((row) => `${row.current}${Str.slice(Str.length(row.retired))(text)}`),
    O.getOrElse(() => text)
  )
);

const toFinding =
  (file: string, lineStarts: ReadonlyArray<number>) =>
  (match: RawMatch): RetiredEffectPathFinding =>
    RetiredEffectPathFinding.make({
      file,
      ...locateIndex(lineStarts, match.index),
      match: match.text,
      rule: match.rule,
      suggestion: suggestRetiredEffectPath(match.text, match.rule),
    });

/**
 * Scan one file's text for retired Effect module paths.
 *
 * **Details**
 *
 * A `source-path` match that starts inside a `module-specifier` match is the
 * same retired span and is not reported twice. An `anchor-slug` match is
 * reported only inside a Markdown link fragment, so the slug in prose or in
 * link text is ignored. Lines and columns are 1-based; columns count UTF-16
 * code units.
 *
 * **Example** (Find a retired import specifier)
 *
 * ```ts
 * import { scanText } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths"
 *
 * const [finding] = scanText("demo.ts", 'import { HttpClient } from "effect/unstable/http"\n')
 * console.log(finding?.suggestion) // "effect/http"
 * ```
 *
 * **Example** (Find a retired heading anchor in a table of contents)
 *
 * ```ts
 * import { scanText } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths"
 *
 * const [finding] = scanText("api.md", "- [Atom](#atom-effectunstablereactivityatom)\n")
 * console.log(finding?.suggestion) // "effectreactivityatom"
 * ```
 *
 * **Example** (Scan in a pipeline)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import { scanText } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths"
 *
 * console.log(pipe("notes.md", scanText("see unstable/sql")).length) // 1
 * ```
 *
 * @param file - Repository-relative path recorded on each finding.
 * @param content - The file's text.
 * @returns Findings ordered by position.
 * @category utilities
 * @since 0.0.0
 */
export const scanText: {
  (content: string): (file: string) => ReadonlyArray<RetiredEffectPathFinding>;
  (file: string, content: string): ReadonlyArray<RetiredEffectPathFinding>;
} = F.dual(2, (file: string, content: string): ReadonlyArray<RetiredEffectPathFinding> => {
  if (!F.pipe(content, Str.includes(RULE_LITERAL))) {
    return A.empty();
  }
  const moduleMatches = collectMatches(content, MODULE_SPECIFIER_PATTERN, "module-specifier");
  const sourceMatches = A.filter(
    collectMatches(content, SOURCE_PATH_PATTERN, "source-path"),
    (match) => !isInsideSpan(moduleMatches)(match)
  );
  const anchorMatches = collectAnchorSlugMatches(content);
  const matches = A.sort(A.flatten([moduleMatches, sourceMatches, anchorMatches]), byIndexAscending);
  return A.match(matches, {
    onEmpty: A.empty<RetiredEffectPathFinding>,
    onNonEmpty: A.map(toFinding(file, lineStartOffsets(content))),
  });
});

/**
 * Whether the retired Effect path law skips a repository-relative path.
 *
 * **Example** (Skip a vendored patch)
 *
 * ```ts
 * import { isAllowlisted } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths"
 *
 * console.log(isAllowlisted("patches/drizzle-orm.patch")) // true
 * console.log(isAllowlisted("docs/README.md")) // false
 * ```
 *
 * @param file - Repository-relative path.
 * @returns `true` when the path is in {@link retiredEffectPathsAllowlist}.
 * @category utilities
 * @since 0.0.0
 */
export const isAllowlisted = (file: string): boolean =>
  A.contains(retiredEffectPathsAllowlist.exactPaths, file) ||
  A.some(retiredEffectPathsAllowlist.directoryPrefixes, (prefix) => F.pipe(file, Str.startsWith(prefix)));

/**
 * Render one finding as a `file:line:col  match  →  suggestion` report line.
 *
 * **Example** (Format a finding)
 *
 * ```ts
 * import { formatRetiredEffectPathFinding, scanText } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths"
 *
 * for (const finding of scanText("demo.md", "see unstable/httpapi\n")) {
 *   console.log(formatRetiredEffectPathFinding(finding)) // "demo.md:1:5  unstable/httpapi  →  http-api"
 * }
 * ```
 *
 * @param finding - The finding to render.
 * @returns One human-readable report line.
 * @category utilities
 * @since 0.0.0
 */
export const formatRetiredEffectPathFinding = (finding: RetiredEffectPathFinding): string =>
  `${finding.file}:${finding.line}:${finding.column}  ${finding.match}  →  ${finding.suggestion}`;

/**
 * Run the retired Effect module path law over every git-tracked text file.
 *
 * **Details**
 *
 * Lists index entries with `git ls-files --stage`, keeps regular files, skips
 * the allowlist and any file containing a NUL byte, and scans the working-tree
 * text. Index entries deleted from the working tree are skipped.
 *
 * **Example** (Count retired paths in the repository)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { RetiredEffectPathsOptions } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model"
 * import { runRetiredEffectPaths } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths"
 *
 * const program = Effect.map(
 *   runRetiredEffectPaths(RetiredEffectPathsOptions.make({ cwd: process.cwd(), strictCheck: true })),
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
export const runRetiredEffectPaths = Effect.fn("RetiredEffectPaths.runRetiredEffectPaths")(function* (
  options: RetiredEffectPathsOptions
): Effect.fn.Return<
  RetiredEffectPathsSummary,
  RetiredEffectPathsExecutionError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const { skippedFiles, ...scan } = yield* scanTrackedTextFiles({
    cwd: options.cwd,
    gitErrors: messageGitErrorAdapter(RetiredEffectPathsExecutionError.new),
    mapError: RetiredEffectPathsExecutionError.mapError,
    isSkipped: isAllowlisted,
    scan: scanText,
  });
  return RetiredEffectPathsSummary.make({
    ...scan,
    allowlistedFiles: skippedFiles,
    strictFailure: options.strictCheck && A.isReadonlyArrayNonEmpty(scan.findings),
  });
});
