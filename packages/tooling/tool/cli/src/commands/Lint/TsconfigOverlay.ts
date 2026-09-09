/**
 * Check-overlay lint: a workspace `tsconfig.check.json` may only turn build
 * concerns off, never widen the program it typechecks, and must carry its
 * canonical project's references verbatim.
 *
 * **Details**
 * Every overlay extends the package's canonical `tsconfig.json` so
 * `tsgo -p tsconfig.check.json` typechecks the same program without emitting.
 * The moment it widens the program (`types`, `lib`, `paths`, `plugins`,
 * `strict`, ...) the check lane and the build lane typecheck different
 * programs and a green `check` stops proving the package compiles.
 *
 * Apps used to guard that equivalence by running a second compiler pass over
 * `tsconfig.json` on every check. `.bin/tsc` is the same patched Effect
 * compiler as `tsgo`, so that pass was pure duplication (quality-lane audit
 * D5). This lint replaces it with a structural guarantee: an overlay may set
 * only the keys in {@link TsconfigOverlayDocumentKey} and the compiler options
 * in {@link TsconfigOverlayCompilerOptionKey}. Anything else must live in the
 * canonical `tsconfig.json` where both lanes inherit it.
 *
 * `references` is not inherited through `extends`, so the overlay must
 * repeat the canonical list exactly (quality-lane audit D3): with it the
 * check consumes upstream `dist/*.d.ts` that turbo's `^build` already
 * produced; without it every upstream package is typechecked from source
 * again. `beep tsconfig-sync` writes that list; this lint proves it stayed
 * in sync.
 *
 * The lint is ratchet-free: one non-allowlisted key or one drifted
 * reference list anywhere fails the gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, normalizePath } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, O, pipe, R, Str } from "@beep/utils";
import { Console, Effect, FileSystem, HashSet, Order, Path } from "effect";
import * as S from "effect/Schema";
import { Command } from "effect/unstable/cli";
import { renderTruncatedLines } from "../../internal/artifacts/index.ts";
import { CliReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { pathExists } from "../../internal/quality/TestTypecheckCoverage.ts";
import { collectOwnedPaths, testFixtureSegment } from "./internal/WorkspaceWalk.ts";
import { TsconfigOverlayReadError } from "./Lint.errors.ts";

const $I = $RepoCliId.create("commands/Lint/TsconfigOverlay");

const overlayFileName = "tsconfig.check.json";
const canonicalFileName = "tsconfig.json";
const checkCommand = "bun run beep lint tsconfig-overlay";
const syncCommand = "bun run beep tsconfig-sync --write";
// Mirrors the package test-typecheck lint's search roots so every overlay a
// package owns is judged; the shared WorkspaceWalk prunes build outputs.
const overlaySearchRoots = ["apps", "infra", "packages"] as const;
const renderedViolationLimit = 40;

/**
 * Top-level keys a `tsconfig.check.json` overlay may set.
 *
 * **Details**
 * `$schema` is editor metadata, not a compiler input, so it is tolerated.
 * `references` is allowed because `extends` does not inherit it and the
 * overlay must repeat the canonical project's list (the references rule
 * checks that it does); `include` and `exclude` are allowed so an overlay
 * can widen the file set to a sibling directory the build must not emit
 * (scripts, examples).
 *
 * **Example** (Check a document key)
 *
 * ```ts
 * import { TsconfigOverlayDocumentKey } from "@beep/repo-cli/commands/Lint/TsconfigOverlay"
 *
 * console.log(TsconfigOverlayDocumentKey.is.compilerOptions("compilerOptions")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TsconfigOverlayDocumentKey = LiteralKit([
  "$schema",
  "extends",
  "references",
  "include",
  "exclude",
  "compilerOptions",
]).pipe(
  $I.annoteSchema("TsconfigOverlayDocumentKey", {
    description: "Top-level keys a tsconfig.check.json overlay may set.",
  })
);

/**
 * Top-level key a `tsconfig.check.json` overlay may set.
 *
 * **Example** (Annotate a value as TsconfigOverlayDocumentKey)
 *
 * ```ts
 * import type { TsconfigOverlayDocumentKey } from "@beep/repo-cli/commands/Lint/TsconfigOverlay"
 *
 * const key: TsconfigOverlayDocumentKey = "references"
 * console.log(key) // "references"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TsconfigOverlayDocumentKey = typeof TsconfigOverlayDocumentKey.Type;

/**
 * Compiler options a `tsconfig.check.json` overlay may set.
 *
 * **Details**
 * These are the options that turn emit and project-reference machinery off
 * (`composite`, `incremental`, `declaration`, `declarationMap`,
 * `emitDeclarationOnly`, `noEmit`, `tsBuildInfoFile`) plus `rootDir`, which
 * the overlay re-anchors at the repository root so upstream declaration
 * files are legal program members. `module` and `moduleResolution` left the
 * list once the reference-keeping census (quality-lane audit D3) proved the
 * base config's `NodeNext` produces identical diagnostics.
 *
 * **Example** (Check a compiler option key)
 *
 * ```ts
 * import { TsconfigOverlayCompilerOptionKey } from "@beep/repo-cli/commands/Lint/TsconfigOverlay"
 *
 * console.log(TsconfigOverlayCompilerOptionKey.is.noEmit("noEmit")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TsconfigOverlayCompilerOptionKey = LiteralKit([
  "composite",
  "incremental",
  "noEmit",
  "declaration",
  "declarationMap",
  "emitDeclarationOnly",
  "rootDir",
  "tsBuildInfoFile",
]).pipe(
  $I.annoteSchema("TsconfigOverlayCompilerOptionKey", {
    description: "Compiler options a tsconfig.check.json overlay may set.",
  })
);

/**
 * Compiler option a `tsconfig.check.json` overlay may set.
 *
 * **Example** (Annotate a value as TsconfigOverlayCompilerOptionKey)
 *
 * ```ts
 * import type { TsconfigOverlayCompilerOptionKey } from "@beep/repo-cli/commands/Lint/TsconfigOverlay"
 *
 * const key: TsconfigOverlayCompilerOptionKey = "noEmit"
 * console.log(key) // "noEmit"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TsconfigOverlayCompilerOptionKey = typeof TsconfigOverlayCompilerOptionKey.Type;

/**
 * Where in the overlay document a violation was found.
 *
 * **Details**
 * `document` and `compilerOptions` name a key outside the allowlist at that
 * level; `references` names the reference list drifting from the canonical
 * `tsconfig.json`.
 *
 * **Example** (Check a violation scope)
 *
 * ```ts
 * import { TsconfigOverlayViolationScope } from "@beep/repo-cli/commands/Lint/TsconfigOverlay"
 *
 * console.log(TsconfigOverlayViolationScope.is.compilerOptions("compilerOptions")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TsconfigOverlayViolationScope = LiteralKit(["document", "compilerOptions", "references"]).pipe(
  $I.annoteSchema("TsconfigOverlayViolationScope", {
    description: "Whether a violation names a top-level key, a compilerOptions key, or the drifted references list.",
  })
);

/**
 * Where in the overlay document a violation was found.
 *
 * **Example** (Annotate a value as TsconfigOverlayViolationScope)
 *
 * ```ts
 * import type { TsconfigOverlayViolationScope } from "@beep/repo-cli/commands/Lint/TsconfigOverlay"
 *
 * const scope: TsconfigOverlayViolationScope = "document"
 * console.log(scope) // "document"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TsconfigOverlayViolationScope = typeof TsconfigOverlayViolationScope.Type;

/**
 * One finding against a `tsconfig.check.json` overlay: a key set outside the
 * allowlist, or (scope `references`) a reference list that drifts from the
 * canonical `tsconfig.json`, with `detail` describing the drift.
 *
 * **Example** (Construct a violation)
 *
 * ```ts
 * import { TsconfigOverlayViolation } from "@beep/repo-cli/commands/Lint/TsconfigOverlay"
 *
 * const violation = TsconfigOverlayViolation.make({
 *   file: "packages/drivers/example/tsconfig.check.json",
 *   scope: "compilerOptions",
 *   key: "types"
 * })
 * console.log(violation.key) // "types"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsconfigOverlayViolation extends S.Class<TsconfigOverlayViolation>($I`TsconfigOverlayViolation`)(
  {
    file: S.String,
    scope: TsconfigOverlayViolationScope,
    key: S.String,
    detail: S.optionalKey(S.String),
  },
  $I.annote("TsconfigOverlayViolation", {
    description:
      "A key a tsconfig.check.json overlay sets outside the allowlist, or its references drifting from tsconfig.json.",
  })
) {}

// The overlay is judged by its raw key set, so the document is decoded as an
// open record rather than a struct that would silently drop unknown keys.
const TsconfigOverlayRawDocument = S.Record(S.String, S.Unknown);
const decodeOverlayDocument = decodeJsoncTextAs(TsconfigOverlayRawDocument);
const isRawDocument = S.is(TsconfigOverlayRawDocument);
const isAllowedDocumentKey = S.is(TsconfigOverlayDocumentKey);
const isAllowedCompilerOptionKey = S.is(TsconfigOverlayCompilerOptionKey);

// The reference list of either file; a missing key reads as no references.
const TsconfigReferenceList = S.Struct({
  references: S.Struct({ path: S.String }).pipe(S.Array, S.optionalKey),
});
const decodeReferenceList = S.decodeUnknownEffect(TsconfigReferenceList);
const decodeCanonicalReferenceList = decodeJsoncTextAs(TsconfigReferenceList);
const referencePathsOf = (document: typeof TsconfigReferenceList.Type): ReadonlyArray<string> =>
  A.map(document.references ?? A.empty(), (entry) => entry.path);
const referenceListEquivalence = A.makeEquivalence(Str.equivalence);

const violationOrder: Order.Order<TsconfigOverlayViolation> = Order.Struct({
  file: Order.String,
  scope: Order.String,
  key: Order.String,
});

// A directory owns its overlay when one exists outside a fixture tree.
const overlayOwnedIn = Effect.fn("TsconfigOverlay.overlayOwnedIn")(function* (
  directory: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const overlayPath = normalizePath(path.resolve(directory, overlayFileName));

  return Str.includes(testFixtureSegment)(`${overlayPath}/`) || !(yield* pathExists(fs, overlayPath))
    ? A.empty<string>()
    : A.of(overlayPath);
});

// Every overlay file under one search root, absolute and in directory order.
const collectOverlayFiles = (
  searchRoot: string
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> =>
  collectOwnedPaths(searchRoot, overlayOwnedIn);

const violationsOf = (
  file: string,
  document: Readonly<Record<string, unknown>>
): ReadonlyArray<TsconfigOverlayViolation> => {
  const documentViolations = pipe(
    R.keys(document),
    A.filter((key) => !isAllowedDocumentKey(key)),
    A.map((key) => TsconfigOverlayViolation.make({ file, scope: "document", key }))
  );
  const compilerOptionViolations = pipe(
    R.get(document, "compilerOptions"),
    O.filter(isRawDocument),
    O.map(R.keys),
    O.getOrElse(A.empty<string>),
    A.filter((key) => !isAllowedCompilerOptionKey(key)),
    A.map((key) => TsconfigOverlayViolation.make({ file, scope: "compilerOptions", key }))
  );
  return A.appendAll(documentViolations, compilerOptionViolations);
};

// Exact, order-sensitive comparison: tsconfig-sync writes both lists in the
// same canonical order, so anything but equality is drift.
const referenceViolationOf = (
  file: string,
  expected: ReadonlyArray<string>,
  actual: ReadonlyArray<string>
): O.Option<TsconfigOverlayViolation> => {
  if (referenceListEquivalence(expected, actual)) {
    return O.none();
  }
  const expectedSet = HashSet.fromIterable(expected);
  const actualSet = HashSet.fromIterable(actual);
  const missing = HashSet.size(HashSet.difference(expectedSet, actualSet));
  const extra = HashSet.size(HashSet.difference(actualSet, expectedSet));
  const reordered = missing === 0 && extra === 0 ? ", reordered" : "";

  return O.some(
    TsconfigOverlayViolation.make({
      file,
      scope: "references",
      key: "references",
      detail: `expected the ${A.length(expected)} reference(s) of ${canonicalFileName}, found ${A.length(actual)} (missing ${missing}, extra ${extra}${reordered})`,
    })
  );
};

// Canonical references next to the overlay; an absent tsconfig.json has none.
const canonicalReferencePaths = Effect.fn("TsconfigOverlay.canonicalReferencePaths")(function* (
  overlayFile: string,
  relativeFile: string
): Effect.fn.Return<ReadonlyArray<string>, TsconfigOverlayReadError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonicalFile = path.join(path.dirname(overlayFile), canonicalFileName);
  if (!(yield* pathExists(fs, canonicalFile))) {
    return A.empty();
  }
  const text = yield* fs
    .readFileString(canonicalFile)
    .pipe(TsconfigOverlayReadError.mapError(`Failed to read the ${canonicalFileName} next to ${relativeFile}.`));
  const document = yield* decodeCanonicalReferenceList(text).pipe(
    TsconfigOverlayReadError.mapError(
      `Failed to decode references from the ${canonicalFileName} next to ${relativeFile}.`
    )
  );
  return referencePathsOf(document);
});

/**
 * Scan every workspace `tsconfig.check.json` and report the keys each one
 * sets outside the overlay allowlist plus any reference list that drifts
 * from the canonical `tsconfig.json` beside it.
 *
 * **Details**
 * Files are read as JSONC (comments and trailing commas are fine) and judged
 * by their raw key set; the reference comparison is exact and
 * order-sensitive, with a missing `references` key on either side reading
 * as an empty list. Findings are sorted by file, scope, and key so output is
 * stable across runs.
 *
 * **Example** (Collect overlay violations)
 *
 * ```ts
 * import { collectTsconfigOverlayViolations } from "@beep/repo-cli/commands/Lint/TsconfigOverlay"
 * import * as Effect from "effect/Effect"
 *
 * const program = collectTsconfigOverlayViolations("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root; search roots are resolved beneath it.
 * @returns Sorted violations, empty when every overlay stays inside the allowlist.
 * @category use-cases
 * @since 0.0.0
 */
export const collectTsconfigOverlayViolations = Effect.fn("TsconfigOverlay.collectTsconfigOverlayViolations")(
  function* (
    repoRoot: string
  ): Effect.fn.Return<
    ReadonlyArray<TsconfigOverlayViolation>,
    TsconfigOverlayReadError,
    FileSystem.FileSystem | Path.Path
  > {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const overlayFiles = yield* pipe(
      overlaySearchRoots,
      Effect.forEach((root) => collectOverlayFiles(path.join(repoRoot, root)), { concurrency: 1 }),
      Effect.map(A.flatten)
    );

    const violations = yield* Effect.forEach(
      overlayFiles,
      Effect.fnUntraced(function* (overlayFile) {
        const relativeFile = normalizePath(path.relative(repoRoot, overlayFile));
        const text = yield* fs
          .readFileString(overlayFile)
          .pipe(TsconfigOverlayReadError.mapError(`Failed to read ${relativeFile}.`));
        const document = yield* decodeOverlayDocument(text).pipe(
          TsconfigOverlayReadError.mapError(`Failed to parse ${relativeFile} as a JSONC object.`)
        );
        const overlayReferences = yield* decodeReferenceList(document).pipe(
          TsconfigOverlayReadError.mapError(`Failed to decode references from ${relativeFile}.`),
          Effect.map(referencePathsOf)
        );
        const expectedReferences = yield* canonicalReferencePaths(overlayFile, relativeFile);
        return A.appendAll(
          violationsOf(relativeFile, document),
          A.fromOption(referenceViolationOf(relativeFile, expectedReferences, overlayReferences))
        );
      }),
      { concurrency: 1 }
    );

    return pipe(violations, A.flatten, A.sort(violationOrder));
  }
);

const renderViolation = (violation: TsconfigOverlayViolation): string =>
  TsconfigOverlayViolationScope.$match(violation.scope, {
    document: () => `  - ${violation.file} ${violation.key}`,
    compilerOptions: () => `  - ${violation.file} compilerOptions.${violation.key}`,
    references: () => `  - ${violation.file} references: ${violation.detail ?? "drift from tsconfig.json"}`,
  });

const allowlistHint = `[tsconfig-overlay] an overlay may set only ${A.join(TsconfigOverlayDocumentKey.Options, ", ")} and compilerOptions { ${A.join(TsconfigOverlayCompilerOptionKey.Options, ", ")} }; move anything else into the package's tsconfig.json so build and check inherit it together`;
const referencesHint = `[tsconfig-overlay] an overlay's references must equal its tsconfig.json references verbatim (extends does not inherit them); regenerate with: ${syncCommand}`;
const isReferencesViolation = (violation: TsconfigOverlayViolation): boolean =>
  TsconfigOverlayViolationScope.is.references(violation.scope);

/**
 * Fail when any workspace `tsconfig.check.json` sets a key outside the
 * overlay allowlist or carries references that drift from its
 * `tsconfig.json`.
 *
 * **Details**
 * Ratchet-free by design: there is no baseline to grow, because a widened
 * overlay silently changes what `check` proves and a drifted reference list
 * silently re-typechecks upstream source. The command logs one `ok` line
 * with the overlay count on success and lists every violation on standard
 * error, with the matching remediation hint, before exiting non-zero.
 *
 * **Example** (Run the overlay lint)
 *
 * ```ts
 * import { runTsconfigOverlayLint } from "@beep/repo-cli/commands/Lint/TsconfigOverlay"
 * import * as Effect from "effect/Effect"
 *
 * const program = runTsconfigOverlayLint()
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @returns Effect that fails with a reported exit when at least one overlay violates the allowlist or drifts.
 * @category use-cases
 * @since 0.0.0
 */
export const runTsconfigOverlayLint = Effect.fn("TsconfigOverlay.runTsconfigOverlayLint")(
  function* (): Effect.fn.Return<void, TsconfigOverlayReadError | CliReportedExit, FileSystem.FileSystem | Path.Path> {
    const path = yield* Path.Path;
    const repoRoot = normalizePath(path.resolve(process.cwd()));
    const overlayCount = yield* pipe(
      overlaySearchRoots,
      Effect.forEach((root) => collectOverlayFiles(path.join(repoRoot, root)), { concurrency: 1 }),
      Effect.map(A.flatten),
      Effect.map(A.length)
    );
    const violations = yield* collectTsconfigOverlayViolations(repoRoot);

    if (A.isReadonlyArrayNonEmpty(violations)) {
      const files = pipe(
        violations,
        A.map((violation) => violation.file),
        A.dedupe
      );
      const hints = A.appendAll(
        A.some(violations, (violation) => !isReferencesViolation(violation)) ? A.of(allowlistHint) : A.empty<string>(),
        A.some(violations, isReferencesViolation) ? A.of(referencesHint) : A.empty<string>()
      );
      yield* Console.error(
        A.join(
          [
            `[tsconfig-overlay] violation: ${A.length(violations)} finding(s) across ${A.length(files)} overlay(s)`,
            ...renderTruncatedLines({ items: violations, render: renderViolation, limit: renderedViolationLimit }),
            ...hints,
            `[tsconfig-overlay] re-check with: ${checkCommand}`,
          ],
          "\n"
        )
      );
      return yield* CliReportedExit.make({
        message:
          "tsconfig-overlay: a tsconfig.check.json sets keys outside the overlay allowlist or drifts from its tsconfig.json references.",
        exitCode: 1,
      });
    }

    yield* Console.log(`[tsconfig-overlay] ok: ${overlayCount} overlay(s), 0 violation(s)`);
  }
);

/**
 * `bun run beep lint tsconfig-overlay` — fail when a `tsconfig.check.json`
 * sets keys outside the overlay allowlist or drifts from its `tsconfig.json`
 * references.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { lintTsconfigOverlayCommand } from "@beep/repo-cli/commands/Lint/TsconfigOverlay"
 *
 * console.log(lintTsconfigOverlayCommand.name) // "tsconfig-overlay"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintTsconfigOverlayCommand = Command.make("tsconfig-overlay", {}, () => runTsconfigOverlayLint()).pipe(
  Command.withDescription(
    "Fail when a tsconfig.check.json overlay sets keys outside the allowlist or drifts from its tsconfig.json references"
  )
);
