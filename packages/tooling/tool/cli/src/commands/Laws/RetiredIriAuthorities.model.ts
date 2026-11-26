/**
 * Schemas and data for the retired IRI authority law.
 *
 * **Details**
 *
 * The identity authority moved to the single public origin's `/ns/` route.
 * The retired hosts, the public origin, the exemptions, and the rule-2 scope
 * live here as data so the scanner in `RetiredIriAuthorities.ts` stays a pure
 * function of them.
 *
 * **Gotchas**
 *
 * Hosts are stored as DNS label tuples and joined at runtime. This module, the
 * scanner, and their tests never spell a retired host or the public origin, so
 * the law needs no self-allowlist and a repository-wide text search for a
 * retired host stays clean.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/RetiredIriAuthorities.model");

/**
 * **Details**
 *
 * `retired-authority` matches any host form of a retired identity authority in
 * any tracked text. `public-origin-literal` matches the public origin spelled
 * inside a string or template literal of tracked code outside the packages
 * that own it.
 *
 * **Example** (Identify a retired-authority finding)
 *
 * ```ts
 * import { RetiredIriAuthorityRule } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 *
 * console.log(RetiredIriAuthorityRule.is["retired-authority"]("retired-authority")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RetiredIriAuthorityRule = LiteralKit(["retired-authority", "public-origin-literal"]).pipe(
  $I.annoteSchema("RetiredIriAuthorityRule", {
    description: "Rule that detected a retired IRI authority or a hand-written public origin.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type RetiredIriAuthorityRule = typeof RetiredIriAuthorityRule.Type;

/**
 * **Example** (Describe a retired host)
 *
 * ```ts
 * import { RetiredIriAuthority } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 *
 * const row = RetiredIriAuthority.make({ labels: ["old", "example"], reason: "placeholder host" })
 *
 * console.log(row.labels.join(".")) // "old.example"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredIriAuthority extends S.Opaque<RetiredIriAuthority, { readonly brand: unique symbol }>()(
  S.Struct({
    labels: S.NonEmptyArray(S.String),
    reason: S.String,
  }).pipe(
    $I.annoteSchema("RetiredIriAuthority", {
      description: "One retired identity authority host, stored as its DNS labels, with the reason it retired.",
    })
  )
) {}

/**
 * The retired identity authority hosts, longest first.
 *
 * **Details**
 *
 * The placeholder namespace host and its apex were never owned; the two drift
 * hosts were folded into the identity composer. Longest first so a subdomain
 * row wins over its apex row at the same position.
 *
 * **Example** (Count the retired hosts)
 *
 * ```ts
 * import { retiredIriAuthorities } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 *
 * console.log(retiredIriAuthorities.length) // 4
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const retiredIriAuthorities: ReadonlyArray<RetiredIriAuthority> = A.map(
  [
    [["beep-effect", "dev"], "drift authority folded into the identity composer"],
    [["ns", "beep", "sh"], "placeholder identity authority, never owned"],
    [["beep", "dev"], "drift authority folded into the identity composer"],
    [["beep", "sh"], "placeholder apex, never owned"],
  ] as const,
  ([labels, reason]) => RetiredIriAuthority.make({ labels: [...labels], reason })
);

/**
 * DNS labels of the single public origin's host.
 *
 * **Example** (Count the origin labels)
 *
 * ```ts
 * import { publicOriginHostLabels } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 *
 * console.log(publicOriginHostLabels.length) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const publicOriginHostLabels: readonly [string, ...Array<string>] = ["beep-effect", "com"];

/**
 * **Example** (Describe an allowlist entry)
 *
 * ```ts
 * import { RetiredIriAuthoritiesAllowlistEntry } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 *
 * const entry = RetiredIriAuthoritiesAllowlistEntry.make({
 *   file: "packages/example/src/Pinned.ts",
 *   reason: "bootstrap package that cannot depend on identity",
 * })
 *
 * console.log(entry.file) // "packages/example/src/Pinned.ts"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredIriAuthoritiesAllowlistEntry extends S.Opaque<
  RetiredIriAuthoritiesAllowlistEntry,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    file: S.String,
    reason: S.String,
  }).pipe(
    $I.annoteSchema("RetiredIriAuthoritiesAllowlistEntry", {
      description: "One repository-relative file the public-origin rule never reports, with the reason.",
    })
  )
) {}

/**
 * Where each rule of the retired IRI authority law applies.
 *
 * **Details**
 *
 * `exemptDirectorySegments` exempt a file from both rules when any of its
 * directory segments matches, at any depth. `exemptRootPrefixes` exempt a file
 * when its repository-relative path starts with the prefix, so only the
 * top-level tree is exempt. The `origin*` fields scope the public-origin rule
 * to tracked code outside the owner packages and outside test code.
 *
 * **Example** (Describe a minimal scope)
 *
 * ```ts
 * import { RetiredIriAuthoritiesScope } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 *
 * const scope = RetiredIriAuthoritiesScope.make({
 *   exemptDirectorySegments: ["history"],
 *   exemptRootPrefixes: ["research/"],
 *   originSourceRoots: ["packages/"],
 *   originSourceExtensions: [".ts"],
 *   originOwnerPrefixes: [],
 *   originTestDirectorySegments: ["test"],
 *   originTestBasenameMarkers: [".test."],
 *   originAllowlist: [],
 * })
 *
 * console.log(scope.exemptRootPrefixes) // [ "research/" ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredIriAuthoritiesScope extends S.Opaque<
  RetiredIriAuthoritiesScope,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    exemptDirectorySegments: S.Array(S.String),
    exemptRootPrefixes: S.Array(S.String),
    originSourceRoots: S.Array(S.String),
    originSourceExtensions: S.Array(S.String),
    originOwnerPrefixes: S.Array(S.String),
    originTestDirectorySegments: S.Array(S.String),
    originTestBasenameMarkers: S.Array(S.String),
    originAllowlist: S.Array(RetiredIriAuthoritiesAllowlistEntry),
  }).pipe(
    $I.annoteSchema("RetiredIriAuthoritiesScope", {
      description: "Exemptions for both rules and the code scope of the public-origin rule.",
    })
  )
) {}

/**
 * The scope the retired IRI authority law applies.
 *
 * **Details**
 *
 * Packet history (any `history/` directory) is immutable and the top-level
 * `research/` tree is the machine-generated research surface; nested
 * `research/` directories inside packets are not exempt. The public origin may
 * be spelled by `@beep/identity` and `@beep/public-site`, by tests, by data and
 * prose files, and inside comments; everywhere else code derives it.
 *
 * **Example** (Read the exempt directory segments)
 *
 * ```ts
 * import { retiredIriAuthoritiesScope } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 *
 * console.log(retiredIriAuthoritiesScope.exemptDirectorySegments) // [ "history" ]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const retiredIriAuthoritiesScope: RetiredIriAuthoritiesScope = RetiredIriAuthoritiesScope.make({
  exemptDirectorySegments: ["history"],
  exemptRootPrefixes: ["research/"],
  originSourceRoots: ["packages/", "apps/", "scripts/", "tools/"],
  originSourceExtensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"],
  originOwnerPrefixes: ["packages/foundation/modeling/identity/", "packages/foundation/modeling/public-site/"],
  originTestDirectorySegments: ["test", "tests", "__tests__", "fixtures"],
  originTestBasenameMarkers: [".test.", ".spec."],
  originAllowlist: [
    RetiredIriAuthoritiesAllowlistEntry.make({
      file: "packages/tooling/test-kit/test-runner/src/internal/generated/RegistryTerms.ts",
      reason:
        "The bootstrap test runner must not depend on @beep/identity, so the registry generator projects its terms as literals; a parity test in @beep/identity guards drift.",
    }),
  ],
});

/**
 * **Example** (Construct a finding)
 *
 * ```ts
 * import { RetiredIriAuthorityFinding } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 *
 * const finding = RetiredIriAuthorityFinding.make({
 *   file: "docs/example.md",
 *   line: 3,
 *   column: 9,
 *   match: "//old.example",
 *   rule: "retired-authority",
 *   suggestion: "derive the IRI from $I (@beep/identity)",
 * })
 *
 * console.log(finding.line) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredIriAuthorityFinding extends S.Opaque<
  RetiredIriAuthorityFinding,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    file: S.String,
    line: S.Int,
    column: S.Int,
    match: S.String,
    rule: RetiredIriAuthorityRule,
    suggestion: S.String,
  }).pipe(
    $I.annoteSchema("RetiredIriAuthorityFinding", {
      description: "One retired IRI authority or public-origin literal found in a repository file, with its position.",
    })
  )
) {}

/**
 * **Example** (Configure a strict scan)
 *
 * ```ts
 * import { RetiredIriAuthoritiesOptions } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 *
 * const options = RetiredIriAuthoritiesOptions.make({ cwd: process.cwd(), strictCheck: true })
 *
 * console.log(options.strictCheck) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredIriAuthoritiesOptions extends S.Opaque<
  RetiredIriAuthoritiesOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    cwd: S.String,
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("RetiredIriAuthoritiesOptions", {
      description: "Runtime options for the retired IRI authority law.",
    })
  )
) {}

/**
 * **Example** (Construct a clean summary)
 *
 * ```ts
 * import { RetiredIriAuthoritiesSummary } from "@beep/repo-cli/commands/Laws/RetiredIriAuthorities.model"
 *
 * const summary = RetiredIriAuthoritiesSummary.make({
 *   scannedFiles: 10,
 *   skippedBinaryFiles: 1,
 *   exemptFiles: 2,
 *   strictFailure: false,
 * })
 *
 * console.log(summary.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredIriAuthoritiesSummary extends S.Opaque<
  RetiredIriAuthoritiesSummary,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    scannedFiles: S.Int,
    skippedBinaryFiles: S.Int,
    exemptFiles: S.Int,
    strictFailure: S.Boolean,
    findings: ArrayKeyDefaultEmpty(RetiredIriAuthorityFinding),
  }).pipe(
    $I.annoteSchema("RetiredIriAuthoritiesSummary", {
      description: "Result of one retired IRI authority law run over the git-tracked text files.",
    })
  )
) {}
