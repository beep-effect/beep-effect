/**
 * \@beep/lint-rules
 *
 * Repo-local Biome GritQL lint rules for effect-smol-aligned quality enforcement.
 * This module is the canonical registry of the GritQL rules shipped by the package:
 * each rule's slug, `.grit` file, advisory/mandatory severity, the CLI check it
 * supersedes (if any), and a one-line summary. Tooling (presets, the biome.jsonc
 * drift check, and the parity harness) reads the registry instead of hardcoding paths.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { $LintRulesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LintRulesId;

/**
 * Package version for `@beep/lint-rules`.
 *
 * **Example** (Assert package version)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { VERSION } from "@beep/lint-rules"
 *
 * strictEqual(VERSION, "0.1.0")
 * ```
 *
 * @category configuration
 * @since 0.1.0
 */
export const VERSION = "0.1.0" as const;

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
 *   "no-native-error",
 *   "no-bigint-literals",
 *   "no-empty-named-blocks",
 *   "prefer-array-flat-map"
 * ])
 * ```
 *
 * @category configuration
 * @since 0.1.0
 */
export const RULE_NAMES = [
  "no-native-error",
  "no-bigint-literals",
  "no-empty-named-blocks",
  "prefer-array-flat-map",
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
export type RuleName = S.Schema.Type<typeof RuleNameSchema>;

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
export type RuleSeverity = S.Schema.Type<typeof RuleSeveritySchema>;

class RuleMetadataSchema extends S.Class<RuleMetadataSchema>("RuleMetadataSchema")({
  name: RuleNameSchema,
  severity: RuleSeveritySchema,
  replaces: S.OptionFromNullOr(S.String),
  summary: S.String,
  scope: S.OptionFromNullOr(S.String),
}) {}

type RuleMetadata = S.Schema.Type<typeof RuleMetadataSchema>;

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
 * const encoded = S.encodeSync(RuleRegistrySchema)(RULES)
 *
 * strictEqual(encoded["no-bigint-literals"].replaces, null)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RuleRegistrySchema extends S.Class<RuleRegistrySchema>("RuleRegistrySchema")(
  {
    "no-native-error": RuleMetadataSchema,
    "no-bigint-literals": RuleMetadataSchema,
    "no-empty-named-blocks": RuleMetadataSchema,
    "prefer-array-flat-map": RuleMetadataSchema,
  },
  $I.annote("RuleRegistrySchema", {
    description: "Schema for the finite rule registry keyed by rule slug.",
  })
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
export const RULES: { readonly [K in RuleName]: RuleMetadata } = S.decodeUnknownSync(RuleRegistrySchema)({
  "no-native-error": {
    name: "no-native-error",
    severity: "error",
    replaces: "lint tooling-tagged-errors",
    summary: "Disallow native Error construction in tooling source; use TaggedErrorClass.",
    scope: "packages/tooling/**/src/**",
  },
  "no-bigint-literals": {
    name: "no-bigint-literals",
    severity: "warn",
    replaces: null,
    summary: "Disallow bigint literals (1n, 0xFFn, ...); use BigInt(value).",
    scope: "**/src/**",
  },
  "no-empty-named-blocks": {
    name: "no-empty-named-blocks",
    severity: "error",
    replaces: null,
    summary: 'Disallow empty named import blocks: `import {} from "..."`.',
    scope: null,
  },
  "prefer-array-flat-map": {
    name: "prefer-array-flat-map",
    severity: "error",
    replaces: null,
    summary: "Prefer `.flatMap(f)` over `.map(f).flat()`.",
    scope: null,
  },
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
  decodeURIComponent(new URL(`../rules/${name}.grit`, import.meta.url).pathname);

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
export const rulesDir = (): string => decodeURIComponent(new URL("../rules/", import.meta.url).pathname);
