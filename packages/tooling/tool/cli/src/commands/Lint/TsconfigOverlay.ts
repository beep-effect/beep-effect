/**
 * Check-overlay allowlist lint: a workspace `tsconfig.check.json` may only
 * turn build concerns off, never widen the program it typechecks.
 *
 * **Details**
 * Every overlay extends the package's canonical `tsconfig.json` so
 * `tsgo -p tsconfig.check.json` can typecheck the same program without
 * emitting or consuming project references. The moment it widens the program
 * (`types`, `lib`, `paths`, `plugins`, `strict`, ...) the check lane and the
 * build lane typecheck different programs and a green `check` stops proving
 * the package compiles.
 *
 * Apps used to guard that equivalence by running a second compiler pass over
 * `tsconfig.json` on every check. `.bin/tsc` is the same patched Effect
 * compiler as `tsgo`, so that pass was pure duplication (quality-lane audit
 * D5). This lint replaces it with a structural guarantee: an overlay may set
 * only the keys in {@link TsconfigOverlayDocumentKey} and the compiler options
 * in {@link TsconfigOverlayCompilerOptionKey}. Anything else must live in the
 * canonical `tsconfig.json` where both lanes inherit it.
 *
 * The lint is ratchet-free: one non-allowlisted key anywhere fails the gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, normalizePath } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, O, pipe, R, Str } from "@beep/utils";
import { Console, Effect, FileSystem, Order, Path } from "effect";
import * as S from "effect/Schema";
import { Command } from "effect/unstable/cli";
import { renderTruncatedLines } from "../../internal/artifacts/index.ts";
import { CliReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { collectOwnedPaths, exists, testFixtureSegment } from "./internal/WorkspaceWalk.ts";
import { TsconfigOverlayReadError } from "./Lint.errors.ts";

const $I = $RepoCliId.create("commands/Lint/TsconfigOverlay");

const overlayFileName = "tsconfig.check.json";
const checkCommand = "bun run beep lint tsconfig-overlay";
// Mirrors the package test-typecheck lint's search roots so every overlay a
// package owns is judged; the shared WorkspaceWalk prunes build outputs.
const overlaySearchRoots = ["apps", "infra", "packages"] as const;
const renderedViolationLimit = 40;

/**
 * Top-level keys a `tsconfig.check.json` overlay may set.
 *
 * **Details**
 * `$schema` is editor metadata, not a compiler input, so it is tolerated.
 * `references` is allowed because the overlay's whole purpose is to drop the
 * canonical project's references (`extends` does not inherit them); `include`
 * and `exclude` are allowed so an overlay can widen the file set to a sibling
 * directory the build must not emit (scripts, examples).
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
 * the overlay must re-anchor once references are dropped. `module` and
 * `moduleResolution` stay allowed until the reference-keeping overlay census
 * (quality-lane audit D3) proves they can be removed without diagnostic
 * deltas; tighten this list in that PR.
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
  "module",
  "moduleResolution",
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
 * Where in the overlay document a violating key was found.
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
export const TsconfigOverlayViolationScope = LiteralKit(["document", "compilerOptions"]).pipe(
  $I.annoteSchema("TsconfigOverlayViolationScope", {
    description: "Whether a violating key sits at the overlay's top level or inside compilerOptions.",
  })
);

/**
 * Where in the overlay document a violating key was found.
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
 * One key a `tsconfig.check.json` overlay sets outside the allowlist.
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
  },
  $I.annote("TsconfigOverlayViolation", {
    description: "A key a tsconfig.check.json overlay sets outside the allowlisted overlay key set.",
  })
) {}

// The overlay is judged by its raw key set, so the document is decoded as an
// open record rather than a struct that would silently drop unknown keys.
const TsconfigOverlayRawDocument = S.Record(S.String, S.Unknown);
const decodeOverlayDocument = decodeJsoncTextAs(TsconfigOverlayRawDocument);
const isRawDocument = S.is(TsconfigOverlayRawDocument);
const isAllowedDocumentKey = S.is(TsconfigOverlayDocumentKey);
const isAllowedCompilerOptionKey = S.is(TsconfigOverlayCompilerOptionKey);

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

  return Str.includes(testFixtureSegment)(`${overlayPath}/`) || !(yield* exists(fs, overlayPath))
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

/**
 * Scan every workspace `tsconfig.check.json` and report the keys each one
 * sets outside the overlay allowlist.
 *
 * **Details**
 * Files are read as JSONC (comments and trailing commas are fine) and judged
 * by their raw key set. Findings are sorted by file, scope, and key so output
 * is stable across runs.
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
        return violationsOf(relativeFile, document);
      }),
      { concurrency: 1 }
    );

    return pipe(violations, A.flatten, A.sort(violationOrder));
  }
);

const renderViolation = (violation: TsconfigOverlayViolation): string =>
  `  - ${violation.file} ${violation.scope === "compilerOptions" ? "compilerOptions." : ""}${violation.key}`;

const allowlistHint = `[tsconfig-overlay] an overlay may set only ${A.join(TsconfigOverlayDocumentKey.Options, ", ")} and compilerOptions { ${A.join(TsconfigOverlayCompilerOptionKey.Options, ", ")} }; move anything else into the package's tsconfig.json so build and check inherit it together`;

/**
 * Fail when any workspace `tsconfig.check.json` sets a key outside the
 * overlay allowlist.
 *
 * **Details**
 * Ratchet-free by design: there is no baseline to grow, because a widened
 * overlay silently changes what `check` proves. The command logs one `ok`
 * line with the overlay count on success and lists every violation on
 * standard error before exiting non-zero.
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
 * @returns Effect that fails with a reported exit when at least one overlay violates the allowlist.
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
      yield* Console.error(
        A.join(
          [
            `[tsconfig-overlay] violation: ${A.length(violations)} key(s) across ${A.length(files)} overlay(s) fall outside the allowlist`,
            ...renderTruncatedLines({ items: violations, render: renderViolation, limit: renderedViolationLimit }),
            allowlistHint,
            `[tsconfig-overlay] re-check with: ${checkCommand}`,
          ],
          "\n"
        )
      );
      return yield* CliReportedExit.make({
        message: "tsconfig-overlay: a tsconfig.check.json sets keys outside the overlay allowlist.",
        exitCode: 1,
      });
    }

    yield* Console.log(`[tsconfig-overlay] ok: ${overlayCount} overlay(s), 0 violation(s)`);
  }
);

/**
 * `bun run beep lint tsconfig-overlay` — fail when a `tsconfig.check.json`
 * sets keys outside the overlay allowlist.
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
  Command.withDescription("Fail when a tsconfig.check.json overlay sets keys outside the allowlisted overlay key set")
);
