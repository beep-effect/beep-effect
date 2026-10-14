/**
 * Schemas and data for the retired Effect module path law.
 *
 * **Details**
 *
 * The retired-to-current mapping and the allowlist live here as data so the
 * scanner in `RetiredEffectPaths.ts` stays a pure function of them. The
 * canonical prose record of the mapping is `.patterns/effect-module-paths.md`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/RetiredEffectPaths.model");

/**
 * Rule that detected a retired Effect module path.
 *
 * **Details**
 *
 * `module-specifier` matches the retired `effect/unstable` package namespace
 * (import specifiers and their prose mentions). `source-path` matches a
 * retired `unstable/<module>` directory inside the Effect source or dist tree.
 *
 * **Example** (Identify a module-specifier finding)
 *
 * ```ts
 * import { RetiredEffectPathRule } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model"
 *
 * console.log(RetiredEffectPathRule.is["module-specifier"]("module-specifier")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RetiredEffectPathRule = LiteralKit(["module-specifier", "source-path"]).annotate(
  $I.annote("RetiredEffectPathRule", {
    description: "Rule that detected a retired Effect module path.",
  })
);

/**
 * Type-level member of {@link RetiredEffectPathRule}.
 *
 * @category models
 * @since 0.0.0
 */
export type RetiredEffectPathRule = typeof RetiredEffectPathRule.Type;

/**
 * How a mapping row compares its retired text with a matched span.
 *
 * **Details**
 *
 * `exact` requires the whole matched span to equal the retired text. `prefix`
 * requires the span to start with it and carries the remainder over to the
 * replacement.
 *
 * **Example** (Identify a prefix mapping row)
 *
 * ```ts
 * import { RetiredEffectPathMatchKind } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model"
 *
 * console.log(RetiredEffectPathMatchKind.is.prefix("prefix")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RetiredEffectPathMatchKind = LiteralKit(["exact", "prefix"]).annotate(
  $I.annote("RetiredEffectPathMatchKind", {
    description: "How a retired Effect path mapping row compares its retired text with a matched span.",
  })
);

/**
 * Type-level member of {@link RetiredEffectPathMatchKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type RetiredEffectPathMatchKind = typeof RetiredEffectPathMatchKind.Type;

/**
 * One row of the retired-to-current Effect path mapping.
 *
 * **Example** (Describe the http-api rename)
 *
 * ```ts
 * import { RetiredEffectPathMapping } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model"
 *
 * const row = RetiredEffectPathMapping.make({
 *   rule: "source-path",
 *   kind: "exact",
 *   retired: "unstable/httpapi",
 *   current: "http-api",
 * })
 *
 * console.log(row.current) // "http-api"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredEffectPathMapping extends S.Class<RetiredEffectPathMapping>($I`RetiredEffectPathMapping`)(
  {
    rule: RetiredEffectPathRule,
    kind: RetiredEffectPathMatchKind,
    retired: S.String,
    current: S.String,
  },
  $I.annote("RetiredEffectPathMapping", {
    description: "One row of the retired-to-current Effect module path mapping.",
  })
) {}

/**
 * Ordered retired-to-current mapping; the first row that fits a matched span wins.
 *
 * **Details**
 *
 * Exceptions come before the generic rows: `httpapi` became `http-api`, and the
 * `arbitrary` barrel folded into the single `effect/Arbitrary` module. Every
 * other retired path drops its `unstable/` segment.
 *
 * **Example** (Count the mapping rows per rule)
 *
 * ```ts
 * import { retiredEffectPathMappings } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model"
 *
 * console.log(retiredEffectPathMappings.filter((row) => row.rule === "source-path").length) // 5
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const retiredEffectPathMappings: ReadonlyArray<RetiredEffectPathMapping> = A.map(
  [
    ["module-specifier", "exact", "effect/unstable/arbitrary", "effect/Arbitrary"],
    ["module-specifier", "exact", "effect/unstable/arbitrary/Arbitrary", "effect/Arbitrary"],
    ["module-specifier", "exact", "effect/unstable/arbitrary/index", "effect/Arbitrary"],
    ["module-specifier", "exact", "effect/unstable/httpapi", "effect/http-api"],
    ["module-specifier", "prefix", "effect/unstable/httpapi/", "effect/http-api/"],
    ["module-specifier", "exact", "effect/unstable", "effect/<module>"],
    ["module-specifier", "prefix", "effect/unstable/", "effect/"],
    ["source-path", "exact", "unstable/arbitrary/Arbitrary.ts", "Arbitrary.ts"],
    ["source-path", "exact", "unstable/arbitrary/Arbitrary.d.ts", "Arbitrary.d.ts"],
    ["source-path", "exact", "unstable/arbitrary/Arbitrary.js", "Arbitrary.js"],
    ["source-path", "exact", "unstable/httpapi", "http-api"],
    ["source-path", "prefix", "unstable/", ""],
  ] as const,
  ([rule, kind, retired, current]) => RetiredEffectPathMapping.make({ rule, kind, retired, current })
);

/**
 * Repository paths the retired Effect path law never scans.
 *
 * **Example** (Describe an allowlist)
 *
 * ```ts
 * import { RetiredEffectPathsAllowlist } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model"
 *
 * const allowlist = RetiredEffectPathsAllowlist.make({
 *   directoryPrefixes: ["patches/"],
 *   exactPaths: [".gitleaksignore"],
 * })
 *
 * console.log(allowlist.directoryPrefixes) // [ "patches/" ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredEffectPathsAllowlist extends S.Class<RetiredEffectPathsAllowlist>($I`RetiredEffectPathsAllowlist`)(
  {
    directoryPrefixes: S.Array(S.String),
    exactPaths: S.Array(S.String),
  },
  $I.annote("RetiredEffectPathsAllowlist", {
    description: "Repository-relative directory prefixes and exact paths the retired Effect path law never scans.",
  })
) {}

/**
 * The allowlist the retired Effect path law applies.
 *
 * **Details**
 *
 * `patches/` keeps the vendor's published bytes so each patch still applies.
 * `.patterns/effect-module-paths.md` is the canonical record of the mapping.
 * `.gitleaksignore` fingerprints historical commits by their real paths. The
 * law's own model, scanner, and test spell the retired paths as data.
 *
 * **Example** (Read the allowlisted directory prefixes)
 *
 * ```ts
 * import { retiredEffectPathsAllowlist } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model"
 *
 * console.log(retiredEffectPathsAllowlist.directoryPrefixes) // [ "patches/" ]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const retiredEffectPathsAllowlist: RetiredEffectPathsAllowlist = RetiredEffectPathsAllowlist.make({
  directoryPrefixes: ["patches/"],
  exactPaths: [
    ".gitleaksignore",
    ".patterns/effect-module-paths.md",
    "packages/tooling/tool/cli/src/commands/Laws/RetiredEffectPaths.model.ts",
    "packages/tooling/tool/cli/src/commands/Laws/RetiredEffectPaths.ts",
    "packages/tooling/tool/cli/test/laws-retired-effect-paths.test.ts",
  ],
});

/**
 * One retired Effect module path found in a repository file.
 *
 * **Example** (Construct a finding)
 *
 * ```ts
 * import { RetiredEffectPathFinding } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model"
 *
 * const finding = RetiredEffectPathFinding.make({
 *   file: "docs/example.md",
 *   line: 3,
 *   column: 9,
 *   match: "unstable/httpapi",
 *   rule: "source-path",
 *   suggestion: "http-api",
 * })
 *
 * console.log(finding.suggestion) // "http-api"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredEffectPathFinding extends S.Class<RetiredEffectPathFinding>($I`RetiredEffectPathFinding`)(
  {
    file: S.String,
    line: S.Int,
    column: S.Int,
    match: S.String,
    rule: RetiredEffectPathRule,
    suggestion: S.String,
  },
  $I.annote("RetiredEffectPathFinding", {
    description:
      "One retired Effect module path found in a repository file, with its 1-based position and replacement.",
  })
) {}

/**
 * Runtime options for the retired Effect path law.
 *
 * **Example** (Configure a strict scan)
 *
 * ```ts
 * import { RetiredEffectPathsOptions } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model"
 *
 * const options = RetiredEffectPathsOptions.make({ cwd: process.cwd(), strictCheck: true })
 *
 * console.log(options.strictCheck) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredEffectPathsOptions extends S.Class<RetiredEffectPathsOptions>($I`RetiredEffectPathsOptions`)(
  {
    cwd: S.String,
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
  },
  $I.annote("RetiredEffectPathsOptions", {
    description: "Runtime options for the retired Effect module path law.",
  })
) {}

/**
 * Result of one retired Effect path law run.
 *
 * **Example** (Construct a clean summary)
 *
 * ```ts
 * import { RetiredEffectPathsSummary } from "@beep/repo-cli/commands/Laws/RetiredEffectPaths.model"
 *
 * const summary = RetiredEffectPathsSummary.make({
 *   scannedFiles: 10,
 *   skippedBinaryFiles: 1,
 *   allowlistedFiles: 2,
 *   strictFailure: false,
 * })
 *
 * console.log(summary.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredEffectPathsSummary extends S.Class<RetiredEffectPathsSummary>($I`RetiredEffectPathsSummary`)(
  {
    scannedFiles: S.Int,
    skippedBinaryFiles: S.Int,
    allowlistedFiles: S.Int,
    strictFailure: S.Boolean,
    findings: S.Array(RetiredEffectPathFinding).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<RetiredEffectPathFinding>())),
      S.withDecodingDefault(Effect.succeed(A.empty<RetiredEffectPathFinding>()))
    ),
  },
  $I.annote("RetiredEffectPathsSummary", {
    description: "Result of one retired Effect module path law run over the git-tracked text files.",
  })
) {}
