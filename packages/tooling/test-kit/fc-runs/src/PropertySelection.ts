/**
 * Test-level selection for the deep property sweep (`BEEP_FC_NUM_RUNS`).
 *
 * **Details**
 *
 * The run-count floor reaches a test only through `fcRuns` / `fcRunsCapped` options or an inline
 * property call (`Arbitrary.checkEffect`, `Arbitrary.sampleEffect`, `fc.assert`, the shared
 * `assertSchemaArbitraryDecodesToSelf` helper). A test registered as a plain `it(...)` or
 * `it.effect(...)` in a module graph that never makes such a call behaves identically at any
 * floor, so replaying it in the property lane cannot change its outcome. These pure functions
 * decide which registrations are provably plain. They err in one direction only: anything they
 * cannot positively recognise as plain stays in the sweep.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";

// Calls that execute a property (or draw samples) wherever they appear, including inside the
// body of a plain `it.effect(...)` registration. `assertSchemaArbitraryDecodesToSelf` is the
// shared `@beep/test-utils` helper that runs `Arbitrary.checkEffect` with `fcRuns`.
const inlineExecutionMarker =
  /\bFastCheck\b|\bfast-check\b|\bassertSchemaArbitraryDecodesToSelf\b|\bArbitrary\.(?:checkEffect|sampleEffect)\b|\bunstable\/arbitrary\/Arbitrary\b|\bfc\.(?:property|asyncProperty|assert|sample|check)\b/;

// Every `fcRuns(` / `fcRunsCapped(` call, and the one shape that only feeds a `.prop`
// registration: the `{ arbitrary: fcRuns(n) }` options object of `it.prop` / `it.effect.prop`.
// Any other call hands a raised run count to something else (a local or package helper), so
// the module counts as inline.
const fcRunsCall = /\bfcRuns(?:Capped)?\s*\(/g;
const fcRunsPropOption = /\barbitrary\s*:\s*fcRuns(?:Capped)?\s*\(/g;

const countMatches = (source: string, pattern: RegExp): number =>
  A.length(A.fromIterable(Str.matchAll(pattern)(source)));

/**
 * Report whether a module's source can run a property outside a `.prop` registration.
 *
 * **Details**
 *
 * True when the source names an inline execution call (`Arbitrary.checkEffect`,
 * `Arbitrary.sampleEffect`, `FastCheck`, `fast-check`, `fc.assert` and friends,
 * `assertSchemaArbitraryDecodesToSelf`, the retired unstable Arbitrary module path) or calls
 * `fcRuns` / `fcRunsCapped` anywhere other than as the `arbitrary:` option of a `.prop`
 * registration. In such a module every test is kept by the sweep.
 *
 * **Example** (Classify module sources)
 *
 * ```ts
 * import { runsPropertiesInline } from "@beep/fc-runs/PropertySelection"
 *
 * console.log(runsPropertiesInline('it.effect.prop("law", [arb], f, { arbitrary: fcRuns(20) })')) // false
 * console.log(runsPropertiesInline("yield* Arbitrary.checkEffect(arb, f, fcRuns(20))")) // true
 * console.log(runsPropertiesInline("const options = fcRuns(10)")) // true
 * ```
 *
 * @param source - Module source text.
 * @returns Whether the module can execute a property outside a `.prop` registration.
 * @category testing
 * @since 0.0.0
 */
export const runsPropertiesInline = (source: string): boolean =>
  inlineExecutionMarker.test(source) || countMatches(source, fcRunsCall) > countMatches(source, fcRunsPropOption);

const relativeImport = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g;

/**
 * List the relative module specifiers (`./` or `../`) a source imports or re-exports.
 *
 * **Example** (Read relative specifiers)
 *
 * ```ts
 * import { relativeImportSpecifiers } from "@beep/fc-runs/PropertySelection"
 *
 * const source = 'import { a } from "./support/A.ts"\nimport * as S from "effect/Schema"\nexport * from "../b"'
 * console.log(relativeImportSpecifiers(source)) // ["./support/A.ts", "../b"]
 * ```
 *
 * @param source - Module source text.
 * @returns Relative specifiers in source order, duplicates removed.
 * @category testing
 * @since 0.0.0
 */
export const relativeImportSpecifiers = (source: string): ReadonlyArray<string> =>
  pipe(
    A.fromIterable(Str.matchAll(relativeImport)(source)),
    A.flatMap((match) => O.toArray(O.fromNullishOr(match[1]))),
    A.dedupe
  );

/**
 * Candidate file paths a relative specifier may name, relative to the importer's directory.
 *
 * **Details**
 *
 * The repository writes `.ts` specifiers for both `.ts` and `.tsx` sources, so a `.ts`
 * specifier also tries its `.tsx` twin; an extensionless specifier tries `.ts`, `.tsx`, and
 * an `index.ts` inside a directory.
 *
 * **Example** (Expand specifiers)
 *
 * ```ts
 * import { relativeImportCandidates } from "@beep/fc-runs/PropertySelection"
 *
 * console.log(relativeImportCandidates("./A.ts")) // ["./A.ts", "./A.tsx"]
 * console.log(relativeImportCandidates("./A")) // ["./A", "./A.ts", "./A.tsx", "./A/index.ts"]
 * ```
 *
 * @param specifier - A relative module specifier.
 * @returns Candidate paths in resolution order.
 * @category testing
 * @since 0.0.0
 */
export const relativeImportCandidates = (specifier: string): ReadonlyArray<string> =>
  Str.endsWith(".ts")(specifier)
    ? [specifier, Str.replace(/\.ts$/, ".tsx")(specifier)]
    : /\.[cm]?[jt]sx?$/.test(specifier)
      ? [specifier]
      : [specifier, `${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`];

/**
 * Report whether a module graph can run a property outside a `.prop` registration.
 *
 * **Details**
 *
 * Walks the entry and every module it reaches through relative imports (transitively, each
 * module once) and applies {@link runsPropertiesInline} to each. An unreadable entry counts as
 * inline, so a file the selector cannot read keeps every test. A relative import none of whose
 * candidates can be read is ignored: the test file could not load it either. Package imports
 * (`@beep/*`, `effect/*`) are not followed; the only shared package helper that runs a
 * property inside a plain test, `assertSchemaArbitraryDecodesToSelf`, is matched by name.
 *
 * **Example** (Detect an inline helper one import away)
 *
 * ```ts
 * import { moduleGraphRunsPropertiesInline } from "@beep/fc-runs/PropertySelection"
 * import * as O from "effect/Option"
 *
 * const files: Record<string, string> = {
 *   "/t/a.test.ts": 'import { law } from "./law.ts"\nit.effect("a", () => law)',
 *   "/t/law.ts": "export const law = Arbitrary.checkEffect(arb, f, fcRuns(5))",
 * }
 * const read = (path: string) => O.fromNullishOr(files[path])
 * const resolve = (_importer: string, specifier: string) => [`/t/${specifier.slice(2)}`]
 * console.log(moduleGraphRunsPropertiesInline({ entry: "/t/a.test.ts", readSource: read, resolveCandidates: resolve })) // true
 * ```
 *
 * @param graph - The entry test file path, a read that returns a module's source (none when it
 *   cannot be read), and a resolver from an importer path and relative specifier to candidate paths.
 * @returns Whether any module in the relative import graph runs a property inline.
 * @category testing
 * @since 0.0.0
 */
export const moduleGraphRunsPropertiesInline = ({
  entry,
  readSource,
  resolveCandidates,
}: {
  readonly entry: string;
  readonly readSource: (path: string) => O.Option<string>;
  readonly resolveCandidates: (importer: string, specifier: string) => ReadonlyArray<string>;
}): boolean => {
  const visited = MutableHashSet.empty<string>();
  const visit = (path: string, source: string): boolean => {
    MutableHashSet.add(visited, path);
    return (
      runsPropertiesInline(source) ||
      A.some(relativeImportSpecifiers(source), (specifier) =>
        pipe(
          A.findFirst(resolveCandidates(path, specifier), (candidate) =>
            pipe(
              readSource(candidate),
              O.map((text) => [candidate, text] as const)
            )
          ),
          O.filter(([candidate]) => !MutableHashSet.has(visited, candidate)),
          O.exists(([candidate, text]) => visit(candidate, text))
        )
      )
    );
  };
  return O.match(readSource(entry), { onNone: () => true, onSome: (source) => visit(entry, source) });
};

// `it` / `test`, then only modifiers that never run a property, then the registration call.
// Call-form modifiers are recognised only when their argument list holds no parentheses.
const plainRegistration =
  /^\s*(?:it|test)(?:\.(?:effect|live|scoped|scopedLive|concurrent|sequential|fails|skip|only|todo)|\.(?:skipIf|runIf|each|for)\([^()]*\))*\(/;
const propertyRegistration = /\.prop\b|\bprop\s*\(/;

/**
 * Report whether a source line is positively a plain (non-property) test registration.
 *
 * **Details**
 *
 * Plain means `it` or `test`, followed only by the modifiers `effect`, `live`, `scoped`,
 * `scopedLive`, `concurrent`, `sequential`, `fails`, `skip`, `only`, `todo`, or a
 * parenthesis-free `skipIf(...)`, `runIf(...)`, `each(...)`, `for(...)`, and then `(`. A line
 * that mentions `.prop` anywhere is never plain, and so is every other shape: a custom wrapper,
 * a renamed `it` (`layerIt.effect(`), or a continuation line.
 *
 * **Example** (Classify registration lines)
 *
 * ```ts
 * import { isPlainRegistrationLine } from "@beep/fc-runs/PropertySelection"
 *
 * console.log(isPlainRegistrationLine('  it.effect("decodes", () =>')) // true
 * console.log(isPlainRegistrationLine('  it.effect.skipIf(isWindows)("spawns", () =>')) // true
 * console.log(isPlainRegistrationLine('  it.effect.prop("law", [arb], (input) =>')) // false
 * console.log(isPlainRegistrationLine('  layerIt.effect("x", () =>')) // false
 * ```
 *
 * @param line - One source line.
 * @returns Whether the line is a recognised plain registration.
 * @category testing
 * @since 0.0.0
 */
export const isPlainRegistrationLine = (line: string): boolean =>
  plainRegistration.test(line) && !propertyRegistration.test(line);

/**
 * List the 1-based line numbers of a source that are plain test registrations.
 *
 * **Example** (Find plain registration lines)
 *
 * ```ts
 * import { plainRegistrationLines } from "@beep/fc-runs/PropertySelection"
 *
 * const source = 'it("a", () => {})\nit.prop("b", [arb], f)\ntest.each([1, 2])("c %d", f)'
 * console.log(plainRegistrationLines(source)) // [1, 3]
 * ```
 *
 * @param source - Test file source text.
 * @returns Ascending 1-based line numbers whose line is a plain registration.
 * @category testing
 * @since 0.0.0
 */
export const plainRegistrationLines = (source: string): ReadonlyArray<number> =>
  pipe(
    source,
    Str.split(/\r?\n/),
    A.flatMap((line, index) => (isPlainRegistrationLine(line) ? [index + 1] : []))
  );
