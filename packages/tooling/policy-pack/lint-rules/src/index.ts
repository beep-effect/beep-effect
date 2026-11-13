/**
 * \@beep/lint-rules
 *
 * Repo-local Biome GritQL lint rules for Effect-aligned quality enforcement.
 * This module is the canonical registry of the GritQL rules shipped by the package:
 * each rule's slug, `.grit` file, advisory/mandatory severity, the CLI check it
 * supersedes (if any), and a one-line summary. Tooling (presets, the biome.jsonc
 * drift check, and the parity harness) reads the registry instead of hardcoding paths.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import * as NodeURL from "node:url";
import { $LintRulesId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $LintRulesId;

/**
 * Slugs of the GritQL rules shipped by this package (one `.grit` file each).
 *
 * **Example** (List shipped rule names)
 *
 * ```ts
 * import { deepStrictEqual } from "node:assert/strict"
 * import { RULE_NAMES } from "@beep/lint-rules"
 *
 * deepStrictEqual(RULE_NAMES, [
 *   "no-file-url-pathname",
 *   "no-native-error",
 *   "no-bigint-literals",
 *   "no-empty-named-blocks",
 *   "prefer-array-flat-map",
 *   "prefer-identity-annote-pipe",
 *   "no-hand-built-identity-annotation",
 *   "prefer-exact-optional-key",
 *   "no-hand-rolled-canonical-json"
 * ])
 * ```
 *
 * @category configuration
 * @since 0.1.0
 */
export const RULE_NAMES = [
  "no-file-url-pathname",
  "no-native-error",
  "no-bigint-literals",
  "no-empty-named-blocks",
  "prefer-array-flat-map",
  "prefer-identity-annote-pipe",
  "no-hand-built-identity-annotation",
  "prefer-exact-optional-key",
  "no-hand-rolled-canonical-json",
] as const;

/**
 * Schema-backed literal domain for rule slugs shipped by this package.
 *
 * **Example** (Decode valid rule name)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { RuleNameSchema } from "@beep/lint-rules"
 * import * as S from "effect/Schema"
 *
 * const decodeRuleName = S.decodeUnknownSync(RuleNameSchema)
 *
 * strictEqual(decodeRuleName("prefer-array-flat-map"), "prefer-array-flat-map")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const RuleNameSchema = S.Literals(RULE_NAMES);

/**
 * The slug of a single GritQL rule shipped by this package.
 *
 * **Example** (Assign RuleName type)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import type { RuleName } from "@beep/lint-rules"
 *
 * const name: RuleName = "prefer-array-flat-map"
 *
 * strictEqual(name, "prefer-array-flat-map")
 * ```
 *
 * @category type-level
 * @since 0.1.0
 */
export type RuleName = typeof RuleNameSchema.Type;

/**
 * Schema-backed literal domain for rule diagnostic severities.
 *
 * **Example** (Decode severity value)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { RuleSeveritySchema } from "@beep/lint-rules"
 * import * as S from "effect/Schema"
 *
 * const decodeSeverity = S.decodeUnknownSync(RuleSeveritySchema)
 *
 * strictEqual(decodeSeverity("warn"), "warn")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const RuleSeveritySchema = S.Literals(["warn", "error"]);

/**
 * Diagnostic severity used to gate a rule. `warn` is advisory (Biome exits 0);
 * `error` is mandatory (Biome exits 1). The advisory-to-mandatory transition flips
 * this value in the rule's `.grit` file.
 *
 * **Example** (Assign severity type)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import type { RuleSeverity } from "@beep/lint-rules"
 *
 * const severity: RuleSeverity = "warn"
 *
 * strictEqual(severity, "warn")
 * ```
 *
 * @category type-level
 * @since 0.1.0
 */
export type RuleSeverity = typeof RuleSeveritySchema.Type;

class RuleMetadataSchema extends S.Opaque<RuleMetadataSchema, { readonly brand: unique symbol }>()(
  S.Struct({
    name: RuleNameSchema,
    severity: RuleSeveritySchema,
    replaces: S.OptionFromNullOr(S.String),
    summary: S.String,
    scope: S.OptionFromNullOr(S.String),
  }).pipe($I.annoteSchema("RuleMetadataSchema"))
) {}

type RuleMetadata = RuleMetadataSchema;

/**
 * Schema for the finite rule registry keyed by rule slug.
 *
 * **Example** (Encode rule registry)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { RULES, RuleRegistrySchema } from "@beep/lint-rules"
 * import * as S from "effect/Schema"
 *
 * const encoded = S.encodeSync(RuleRegistrySchema)(RuleRegistrySchema.make(RULES))
 *
 * strictEqual(encoded["no-bigint-literals"].replaces, null)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RuleRegistrySchema extends S.Opaque<RuleRegistrySchema, { readonly brand: unique symbol }>()(
  S.Struct({
    "no-file-url-pathname": RuleMetadataSchema,
    "no-native-error": RuleMetadataSchema,
    "no-bigint-literals": RuleMetadataSchema,
    "no-empty-named-blocks": RuleMetadataSchema,
    "prefer-array-flat-map": RuleMetadataSchema,
    "prefer-identity-annote-pipe": RuleMetadataSchema,
    "no-hand-built-identity-annotation": RuleMetadataSchema,
    "prefer-exact-optional-key": RuleMetadataSchema,
    "no-hand-rolled-canonical-json": RuleMetadataSchema,
  }).pipe(
    $I.annoteSchema("RuleRegistrySchema", {
      description: "Schema for the finite rule registry keyed by rule slug.",
    })
  )
) {}

/**
 * Canonical registry of GritQL rule metadata, keyed by rule slug.
 *
 * **Example** (Read rule severities)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { RULES } from "@beep/lint-rules"
 *
 * strictEqual(RULES["no-bigint-literals"].severity, "warn")
 * strictEqual(RULES["prefer-array-flat-map"].severity, "error")
 * ```
 *
 * @category configuration
 * @since 0.1.0
 */
export const RULES: { readonly [K in RuleName]: RuleMetadata } = RuleRegistrySchema.make({
  "no-file-url-pathname": RuleMetadataSchema.make({
    name: "no-file-url-pathname",
    severity: "error",
    replaces: O.none(),
    summary: "Use fileURLToPath instead of pathname when converting module-relative file URLs to paths.",
    scope: O.none(),
  }),
  "no-native-error": RuleMetadataSchema.make({
    name: "no-native-error",
    severity: "error",
    replaces: O.some("lint tooling-tagged-errors"),
    summary: "Disallow native Error construction in tooling source; use S.TaggedError from effect/Schema.",
    scope: O.some("packages/tooling/**/src/**"),
  }),
  "no-bigint-literals": RuleMetadataSchema.make({
    name: "no-bigint-literals",
    severity: "warn",
    replaces: O.none(),
    summary: "Disallow bigint literals (1n, 0xFFn, ...); use BigInt(value).",
    scope: O.some("**/src/**"),
  }),
  "no-empty-named-blocks": RuleMetadataSchema.make({
    name: "no-empty-named-blocks",
    severity: "error",
    replaces: O.none(),
    summary: 'Disallow empty named import blocks: `import {} from "..."`.',
    scope: O.none(),
  }),
  "prefer-array-flat-map": RuleMetadataSchema.make({
    name: "prefer-array-flat-map",
    severity: "error",
    replaces: O.none(),
    summary: "Prefer `.flatMap(f)` over `.map(f).flat()`.",
    scope: O.none(),
  }),
  "prefer-identity-annote-pipe": RuleMetadataSchema.make({
    name: "prefer-identity-annote-pipe",
    severity: "error",
    replaces: O.none(),
    summary:
      "Pipe identity annotations onto non-class schemas: `X.pipe($I.annoteSchema(...))` and `X.pipe($I.annoteKey(...))`, not `.annotate($I.annote(...))` or `.annotateKey($I.annote(...))`.",
    scope: O.none(),
  }),
  "no-hand-built-identity-annotation": RuleMetadataSchema.make({
    name: "no-hand-built-identity-annotation",
    severity: "error",
    replaces: O.none(),
    summary:
      "Disallow hand-built `{ identifier: $I`Name` }` annotation objects; use `$I.annote(...)` or `X.pipe($I.annoteSchema(...))`.",
    scope: O.none(),
  }),
  "prefer-exact-optional-key": RuleMetadataSchema.make({
    name: "prefer-exact-optional-key",
    severity: "error",
    replaces: O.none(),
    summary:
      "Schema fields use exact optional keys (EF-40): `S.optionalKey`, `S.withDecodingDefaultKey` and `S.OptionFromOptionalKey`, never `S.optional`, `S.withDecodingDefault` or `S.OptionFromOptional`.",
    scope: O.none(),
  }),
  "no-hand-rolled-canonical-json": RuleMetadataSchema.make({
    name: "no-hand-rolled-canonical-json",
    severity: "error",
    replaces: O.none(),
    summary:
      "Disallow hand-rolled JSON object text (braces around a join of members) outside `@beep/jsonc`; canonical bytes come from `JsoncFingerprint.canonicalizeResult`.",
    scope: O.some("**/src/** except packages/foundation/modeling/jsonc/**"),
  }),
});

/**
 * Absolute filesystem path to a rule's `.grit` file, resolved relative to this
 * module so it works from `src/` (dev) and `dist/` (published) alike.
 *
 * **Example** (Resolve rule grit path)
 *
 * ```ts
 * import { ok } from "node:assert/strict"
 * import { rulePath } from "@beep/lint-rules"
 *
 * const grit = rulePath("no-bigint-literals")
 *
 * ok(grit.endsWith("/rules/no-bigint-literals.grit"))
 * ```
 *
 * @param name - The rule slug whose `.grit` file path to resolve.
 * @returns The absolute filesystem path to `<name>.grit`.
 * @category configuration
 * @since 0.1.0
 */
export const rulePath = (name: RuleName): string =>
  NodeURL.fileURLToPath(new URL(`../rules/${name}.grit`, import.meta.url));

/**
 * Absolute filesystem path to the directory holding the `.grit` rule files.
 *
 * **Example** (Get rules directory path)
 *
 * ```ts
 * import { ok } from "node:assert/strict"
 * import { rulesDir } from "@beep/lint-rules"
 *
 * const dir = rulesDir()
 *
 * ok(dir.endsWith("/rules/"))
 * ```
 *
 * @returns The absolute filesystem path to the `rules/` directory.
 * @category configuration
 * @since 0.1.0
 */
export const rulesDir = (): string => NodeURL.fileURLToPath(new URL("../rules/", import.meta.url));
