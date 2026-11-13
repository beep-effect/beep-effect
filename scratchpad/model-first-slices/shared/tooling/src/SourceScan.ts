import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Path from "effect/Path";
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
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * Every violation in one source text, comments ignored.
 *
 * @category getters
 * @since 0.0.0
 */
export const scanText = (file: string, source: string): ReadonlyArray<Violation> => {
  const text = code(source);
  return A.flatMap(rules, ({ rule, pattern, unless }) =>
    unless !== undefined && unless.test(text)
      ? []
      : A.map(A.fromIterable(text.matchAll(pattern)), (match) => Violation.make({ file, rule, excerpt: match[0] })),
  );
};

/**
 * Every violation under each package's `src`, except in the allowed files
 * (paths relative to `root`).
 *
 * @category getters
 * @since 0.0.0
 */
export const scan = Effect.fn("SourceScan.scan")(function* (
  root: string,
  packageDirs: ReadonlyArray<string>,
  allowed: ReadonlyArray<string>,
) {
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
  );
  const scanned = yield* Effect.forEach(A.flatten(files), (file) =>
    Effect.map(fs.readFileString(path.join(root, file)), (source) => scanText(file, source)),
  );
  return A.filter(A.flatten(scanned), (violation) => !A.contains(allowed, violation.file));
});
