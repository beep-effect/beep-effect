import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as Path from "effect/Path";
import type { PlatformError } from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";

/**
 * Source that builds or provides an invocation outside the trusted boundary.
 *
 * @category models
 * @since 0.0.0
 */
export const Violation = S.Struct({ file: S.String, rule: S.String, excerpt: S.String });
/**
 * @category models
 * @since 0.0.0
 */
export type Violation = typeof Violation.Type;

/**
 * The patterns that build a root or an invocation, or provide an invocation
 * that no re-admission produced. A regex scan, so it catches the direct
 * forms only: an object spread, a decode of the `Invocation` schema, or an
 * aliased tag passes. A rule with `unless` does not apply to a file whose
 * code matches it.
 *
 * @category models
 * @since 0.0.0
 */
export const rules: ReadonlyArray<{ readonly rule: string; readonly pattern: RegExp; readonly unless?: RegExp }> = [
  { rule: "builds a root", pattern: /\bRoot\.cases\.\w+\.make\b|\bRoot\.make\b/g },
  { rule: "builds an invocation", pattern: /\bInvocation\.make(?:Unsafe)?\b|\bchain:\s*\[\s*\]/g },
  {
    rule: "provides an invocation no re-admission produced",
    pattern: /provideService\(\s*(?:[\w.]+\s*,\s*)?CurrentInvocation\s*,/g,
    // A policy or saga provides what its authority port's `readmit` returned.
    unless: /\.readmit\(/,
  },
];

// Comments (JSDoc examples included) are not code: strip them before matching.
const code = (source: string): string =>
  pipe(source, Str.replace(/\/\*[\s\S]*?\*\//g, ""), Str.replace(/(^|[^:])\/\/.*$/gm, "$1"));

/**
 * Every violation in one source text, comments ignored. The text comes
 * first and the file it is reported under is named, so the two strings
 * cannot be swapped by position.
 *
 * **Example** (Scanning a forged root)
 * ```ts
 * import { scanText } from "@proto/tooling/SourceScan";
 * import { pipe } from "effect/Function";
 *
 * const violations = scanText('Root.cases.Human.make({ principal: "p_x" })', { file: "forged.ts" });
 * const same = pipe('Root.cases.Human.make({ principal: "p_x" })', scanText({ file: "forged.ts" }));
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const scanText: {
  (options: { readonly file: string }): (source: string) => ReadonlyArray<Violation>;
  (source: string, options: { readonly file: string }): ReadonlyArray<Violation>;
} = dual(2, (source: string, { file }: { readonly file: string }): ReadonlyArray<Violation> => {
  const text = code(source);
  return A.flatMap(rules, ({ rule, pattern, unless }) =>
    unless !== undefined && unless.test(text)
      ? []
      : A.map(A.fromIterable(pipe(text, Str.matchAll(pattern))), (match) => Violation.make({ file, rule, excerpt: match[0] })),
  );
});

/**
 * Every violation under each package's `src`, except in the allowed files
 * (paths relative to `root`). The package directories and the allowed files
 * are both path lists, so they are named rather than positional.
 *
 * @category getters
 * @since 0.0.0
 */
export const scan: {
  (options: ScanOptions): (root: string) => Effect.Effect<Array<Violation>, PlatformError, FileSystem.FileSystem | Path.Path>;
  (root: string, options: ScanOptions): Effect.Effect<Array<Violation>, PlatformError, FileSystem.FileSystem | Path.Path>;
} = dual(2, Effect.fn("SourceScan.scan")(function* (root: string, { packageDirs, allowed }: ScanOptions) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* Effect.forEach(packageDirs, (dir) =>
    Effect.map(fs.readDirectory(path.join(root, dir, "src"), { recursive: true }), (names) =>
      pipe(
        names,
        A.filter(Str.endsWith(".ts")),
        A.map((name) => path.join(dir, "src", name)),
      ),
    ),
    { concurrency: 1 },
  );
  const scanned = yield* Effect.forEach(A.flatten(files), (file) =>
    Effect.map(fs.readFileString(path.join(root, file)), scanText({ file })),
    { concurrency: 1 },
  );
  return A.filter(A.flatten(scanned), (violation) => !A.contains(allowed, violation.file));
}));

/** What {@link scan} reads: the package directories to scan, and the files allowed to match. */
interface ScanOptions {
  readonly packageDirs: ReadonlyArray<string>;
  readonly allowed: ReadonlyArray<string>;
}
