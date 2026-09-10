/**
 * Shared schemas for Lint command inventory-backed checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, flow, Order } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { Ordering } from "effect/Ordering";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Lint/Lint.schemas");

/**
 * Committed schema-first inventory path.
 *
 * **Example** (Check inventory path length)
 *
 * ```ts
 * import { SchemaFirstInventoryPath } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(SchemaFirstInventoryPath.length > 0) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SchemaFirstInventoryPath = "standards/schema-first.inventory.jsonc";

/**
 * Committed schema-crispening policy path.
 *
 * **Example** (Check policy path length)
 *
 * ```ts
 * import { SchemaCrispeningPolicyPath } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(SchemaCrispeningPolicyPath.length > 0) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SchemaCrispeningPolicyPath = "standards/schema-crispening.policy.jsonc";
// infra/lambda/** stays out of scope: self-contained esbuild-bundled Lambda packages
// (own package.json, no @beep/schema dependency) cannot carry annotated schemas.
const INCLUDED_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/{src,test}/**/*.ts"] as const;
const SOURCE_FILE_GLOBS = [...INCLUDED_GLOBS, "!**/docs/**"] as const;

/**
 * Source glob scope used by schema-first lint and schema catalog scans.
 *
 * **Example** (Check schema-first source globs)
 *
 * ```ts
 * import { SchemaFirstIncludedGlobs } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(SchemaFirstIncludedGlobs.includes("packages/**\/*.{ts,tsx}")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SchemaFirstIncludedGlobs: ReadonlyArray<string> = A.fromIterable(INCLUDED_GLOBS);

/**
 * Source glob scope plus scan exclusions used by schema-first ts-morph projects.
 *
 * **Example** (Check docs exclusion glob)
 *
 * ```ts
 * import { SchemaFirstSourceFileGlobs } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(SchemaFirstSourceFileGlobs.includes("!**\/docs/**")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SchemaFirstSourceFileGlobs: ReadonlyArray<string> = A.fromIterable(SOURCE_FILE_GLOBS);

/**
 * Stable schema-first policy rule identifiers emitted for lint and Yeet issue routing.
 *
 * **Example** (Import policy rule identifiers)
 *
 * ```ts
 * import { SchemaFirstPolicyRuleId } from "@beep/repo-cli/commands/Lint/Lint.schemas"
 *
 * console.log(typeof SchemaFirstPolicyRuleId !== "undefined") // true
 * ```
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const SchemaFirstPolicyRuleId = LiteralKit([
  "schema-first-inventory",
  "literal-kit-const-assertion",
  "SFV4-defaults",
  "SFV4-static-api",
  "SFV4-precision-audit",
  "SFV4-arbitrary-tests",
  "SFV4-equivalence",
  "SFV4-tagged-error-equivalence",
  "SFV4-numeric-domain",
  "SFV4-boundary-codec",
  "SFV4-fn-schema",
  "SFV4-normalization",
  "SFV4-null-return",
  "SFV4-getsomes-struct",
]).pipe(
  $I.annoteSchema("SchemaFirstPolicyRuleId", {
    description: "Stable schema-first policy rule identifiers emitted for lint and Yeet issue routing.",
  })
);

/**
 * Stable schema-first policy rule identifier emitted for lint and Yeet issue routing.
 *
 * **Example** (Type inventory rule identifier)
 *
 * ```ts
 * import type { SchemaFirstPolicyRuleId } from "@beep/repo-cli/commands/Lint/Lint.schemas"
 *
 * const ruleId: SchemaFirstPolicyRuleId = "schema-first-inventory"
 * console.log(ruleId) // "schema-first-inventory"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SchemaFirstPolicyRuleId = typeof SchemaFirstPolicyRuleId.Type;

/**
 * Kinds of schema-first inventory findings.
 *
 * **Example** (Import entry kind enum)
 *
 * ```ts
 * import { SchemaFirstEntryKind } from "@beep/repo-cli/commands/Lint/Lint.schemas"
 *
 * console.log(typeof SchemaFirstEntryKind !== "undefined") // true
 * ```
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const SchemaFirstEntryKind = LiteralKit([
  "exported-interface",
  "exported-type-literal",
  "object-struct-schema",
  "schema-policy-advisory",
]).pipe(
  $I.annoteSchema("SchemaFirstEntryKind", {
    description: "Kinds of schema-first inventory findings.",
  })
);

/**
 * Kind of schema-first inventory finding.
 *
 * **Example** (Type exported interface kind)
 *
 * ```ts
 * import type { SchemaFirstEntryKind } from "@beep/repo-cli/commands/Lint/Lint.schemas"
 *
 * const kind: SchemaFirstEntryKind = "exported-interface"
 * console.log(kind) // "exported-interface"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SchemaFirstEntryKind = typeof SchemaFirstEntryKind.Type;

/**
 * Tracked status for a schema-first inventory finding.
 *
 * **Example** (Import entry status enum)
 *
 * ```ts
 * import { SchemaFirstEntryStatus } from "@beep/repo-cli/commands/Lint/Lint.schemas"
 *
 * console.log(typeof SchemaFirstEntryStatus !== "undefined") // true
 * ```
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const SchemaFirstEntryStatus = LiteralKit(["candidate", "exception", "advisory"]).pipe(
  $I.annoteSchema("SchemaFirstEntryStatus", {
    description: "Tracked status for a schema-first inventory finding.",
  })
);

/**
 * Tracked status for a schema-first inventory finding.
 *
 * **Example** (Type advisory entry status)
 *
 * ```ts
 * import type { SchemaFirstEntryStatus } from "@beep/repo-cli/commands/Lint/Lint.schemas"
 *
 * const status: SchemaFirstEntryStatus = "advisory"
 * console.log(status) // "advisory"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SchemaFirstEntryStatus = typeof SchemaFirstEntryStatus.Type;

/**
 * Single tracked schema-first inventory finding for a source file symbol.
 *
 * **Example** (Validate inventory entry candidate)
 *
 * ```ts
 * import { SchemaFirstInventoryEntry } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * const candidate = {
 *   file: "packages/example/src/Foo.ts",
 *   kind: "exported-interface",
 *   line: 12,
 *   owner: "@beep/example",
 *   reason: "exported schema carries annotations",
 *   status: "candidate",
 *   symbol: "Foo"
 * }
 * console.log(S.is(SchemaFirstInventoryEntry)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaFirstInventoryEntry extends S.Class<SchemaFirstInventoryEntry>($I`SchemaFirstInventoryEntry`)(
  {
    file: S.String,
    symbol: S.String,
    kind: SchemaFirstEntryKind,
    status: SchemaFirstEntryStatus,
    ruleId: S.optionalKey(SchemaFirstPolicyRuleId),
    line: S.optionalKey(S.Finite),
    owner: S.String,
    reason: S.String,
  },
  $I.annote("SchemaFirstInventoryEntry", {
    description: "Single tracked schema-first finding for a source file symbol.",
  })
) {}

/**
 * Namespace for {@link SchemaFirstInventoryEntry} companion types.
 *
 * **Example** (Log companion namespace name)
 *
 * ```ts
 * console.log("SchemaFirstInventoryEntry")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace SchemaFirstInventoryEntry {
  /**
   * Encoded representation of {@link SchemaFirstInventoryEntry}.
   *
   * **Example** (Log encoded type name)
   *
   * ```ts
   * console.log("Encoded")
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof SchemaFirstInventoryEntry.Encoded;
}

/**
 * Committed schema-first inventory baseline for repo-wide lint enforcement.
 *
 * **Example** (Validate inventory document)
 *
 * ```ts
 * import { SchemaFirstInventoryDocument } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * const candidate = { entries: [], generatedAt: "2026-07-08T00:00:00.000Z", version: 1 }
 * console.log(S.is(SchemaFirstInventoryDocument)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaFirstInventoryDocument extends S.Class<SchemaFirstInventoryDocument>(
  $I`SchemaFirstInventoryDocument`
)(
  {
    version: S.Literal(1),
    generatedOn: S.String,
    scope: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.fromIterable(INCLUDED_GLOBS))),
      S.withDecodingDefault(Effect.succeed(A.fromIterable(INCLUDED_GLOBS)))
    ),
    entries: S.Array(SchemaFirstInventoryEntry).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<SchemaFirstInventoryEntry>())),
      S.withDecodingDefault(Effect.succeed(A.empty<SchemaFirstInventoryEntry.Encoded>()))
    ),
  },
  $I.annote("SchemaFirstInventoryDocument", {
    description: "Committed schema-first inventory baseline for repo-wide lint enforcement.",
  })
) {}

/**
 * CLI options for schema-first inventory verification.
 *
 * **Example** (Validate lint options)
 *
 * ```ts
 * import { SchemaFirstLintOptions } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * const candidate = { fix: false, write: false }
 * console.log(S.is(SchemaFirstLintOptions)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaFirstLintOptions extends S.Class<SchemaFirstLintOptions>($I`SchemaFirstLintOptions`)(
  {
    write: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
  },
  $I.annote("SchemaFirstLintOptions", {
    description: "CLI options for schema-first inventory verification.",
  })
) {}

/**
 * Summary of schema-first inventory verification results.
 *
 * **Example** (Validate lint summary)
 *
 * ```ts
 * import { SchemaFirstLintSummary } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * const candidate = { checked: 3, violations: [] }
 * console.log(S.is(SchemaFirstLintSummary)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaFirstLintSummary extends S.Class<SchemaFirstLintSummary>($I`SchemaFirstLintSummary`)(
  {
    liveEntries: S.Finite,
    trackedEntries: S.Finite,
    missingEntries: S.Finite,
    staleEntries: S.Finite,
    enforcedCandidates: S.Finite,
    literalKitConstAssertions: S.Finite,
    boundaryCodecAdvisories: S.Finite,
    defaultsAdvisories: S.Finite,
    staticApiAdvisories: S.Finite,
    equivalenceAdvisories: S.Finite,
    taggedErrorEquivalenceAdvisories: S.Finite,
    precisionAuditAdvisories: S.Finite,
    arbitraryTestsAdvisories: S.Finite,
    numericDomainAdvisories: S.Finite,
    fnSchemaAdvisories: S.Finite,
    normalizationAdvisories: S.Finite,
    nullReturnAdvisories: S.Finite,
    getsomesStructAdvisories: S.Finite,
    crispeningPolicyExempt: S.Finite,
    wroteInventory: S.Boolean,
  },
  $I.annote("SchemaFirstLintSummary", {
    description: "Summary of schema-first inventory verification results.",
  })
) {}

/**
 * Wave-family keys used to resolve the schema-crispening policy blocking flag
 * by path prefix.
 *
 * **Example** (Import crispening family enum)
 *
 * ```ts
 * import { SchemaCrispeningFamily } from "@beep/repo-cli/commands/Lint/Lint.schemas"
 *
 * console.log(typeof SchemaCrispeningFamily !== "undefined") // true
 * ```
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const SchemaCrispeningFamily = LiteralKit(["foundation", "drivers", "tooling", "apps-slices"]).pipe(
  $I.annoteSchema("SchemaCrispeningFamily", {
    description: "Wave-family keys used to resolve the schema-crispening policy blocking flag by path prefix.",
  })
);

/**
 * Wave-family key used to resolve the schema-crispening policy blocking flag by path prefix.
 *
 * **Example** (Type tooling family key)
 *
 * ```ts
 * import type { SchemaCrispeningFamily } from "@beep/repo-cli/commands/Lint/Lint.schemas"
 *
 * const family: SchemaCrispeningFamily = "tooling"
 * console.log(family) // "tooling"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SchemaCrispeningFamily = typeof SchemaCrispeningFamily.Type;

/**
 * Blocking flag for a schema-crispening wave family or per-owner policy override.
 *
 * **Example** (Validate family policy)
 *
 * ```ts
 * import { SchemaCrispeningFamilyPolicy } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * const candidate = { family: "tooling", rules: [] }
 * console.log(S.is(SchemaCrispeningFamilyPolicy)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaCrispeningFamilyPolicy extends S.Class<SchemaCrispeningFamilyPolicy>(
  $I`SchemaCrispeningFamilyPolicy`
)(
  {
    blocking: S.Boolean,
  },
  $I.annote("SchemaCrispeningFamilyPolicy", {
    description: "Blocking flag for a schema-crispening wave family or per-owner override.",
  })
) {}

/**
 * Schema-crispening policy ratchet document: novel lint cards and the
 * per-family / per-owner blocking flags that resolve whether a card's
 * findings currently fail the repo-wide schema-first lint.
 *
 * **Example** (Validate policy document)
 *
 * ```ts
 * import { SchemaCrispeningPolicyDocument } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * const candidate = { families: [] }
 * console.log(S.is(SchemaCrispeningPolicyDocument)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaCrispeningPolicyDocument extends S.Class<SchemaCrispeningPolicyDocument>(
  $I`SchemaCrispeningPolicyDocument`
)(
  {
    schemaVersion: S.Literal("schema-crispening-policy/v1"),
    cards: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    families: S.Record(S.String, SchemaCrispeningFamilyPolicy).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, SchemaCrispeningFamilyPolicy>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, SchemaCrispeningFamilyPolicy>()))
    ),
    ownerOverrides: S.Record(S.String, SchemaCrispeningFamilyPolicy).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, SchemaCrispeningFamilyPolicy>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, SchemaCrispeningFamilyPolicy>()))
    ),
  },
  $I.annote("SchemaCrispeningPolicyDocument", {
    description: "Schema-crispening policy ratchet: novel lint cards and per-family/per-owner blocking flags.",
  })
) {}

/**
 * Direct LiteralKit call argument that redundantly asserts an inline array as const.
 *
 * **Example** (Validate const assertion violation)
 *
 * ```ts
 * import { LiteralKitConstAssertionViolation } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * const candidate = { file: "packages/example/src/Foo.ts", line: 12, name: "FooKind" }
 * console.log(S.is(LiteralKitConstAssertionViolation)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LiteralKitConstAssertionViolation extends S.Class<LiteralKitConstAssertionViolation>(
  $I`LiteralKitConstAssertionViolation`
)(
  {
    file: S.String,
    line: S.Finite,
    argument: S.Finite,
  },
  $I.annote("LiteralKitConstAssertionViolation", {
    description: "Direct LiteralKit call argument that redundantly asserts an inline array as const.",
  })
) {}

/**
 * Encoder for persisted schema-first inventory documents.
 *
 * **Example** (Wrap encoder as Effect)
 *
 * ```ts
 * import { encodeSchemaFirstInventoryDocument } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(encodeSchemaFirstInventoryDocument)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSchemaFirstInventoryDocument: {
  (
    input: unknown,
    options?: AST.ParseOptions
  ): Effect.Effect<S.Codec.Encoded<typeof SchemaFirstInventoryDocument>, S.SchemaError>;
  (
    options?: AST.ParseOptions
  ): (input: unknown) => Effect.Effect<S.Codec.Encoded<typeof SchemaFirstInventoryDocument>, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SchemaFirstInventoryDocument));

/**
 * Stable key used to reconcile live schema-first scan results with the baseline.
 *
 * **Example** (Build reconciliation entry key)
 *
 * ```ts
 * import { makeSchemaFirstEntryKey } from "@beep/repo-cli/commands/Lint"
 *
 * const result = makeSchemaFirstEntryKey({
 *   file: "packages/example/src/Foo.ts",
 *   kind: "exported-interface",
 *   line: 12,
 *   owner: "@beep/example",
 *   reason: "exported schema carries annotations",
 *   status: "candidate",
 *   symbol: "Foo"
 * })
 * console.log(result) // rendered command output
 * ```
 *
 * @param entry - The schema-first inventory entry to derive a reconciliation key for.
 * @returns A stable string key combining the entry's file, symbol, kind, rule id, and line.
 * @category utilities
 * @since 0.0.0
 */
export const makeSchemaFirstEntryKey = (entry: SchemaFirstInventoryEntry): string =>
  `${entry.file}::${entry.symbol}::${entry.kind}::${entry.ruleId ?? ""}::${entry.line ?? ""}`;

/**
 * Sort order for schema-first inventory entries.
 *
 * **Example** (Compare identical inventory entries)
 *
 * ```ts
 * import { schemaFirstEntryOrder, SchemaFirstInventoryEntry } from "@beep/repo-cli/commands/Lint"
 *
 * const entry = SchemaFirstInventoryEntry.make({
 *   file: "packages/example/src/Foo.ts",
 *   kind: "exported-interface",
 *   line: 12,
 *   owner: "@beep/example",
 *   reason: "exported schema carries annotations",
 *   status: "candidate",
 *   symbol: "Foo"
 * })
 * console.log(schemaFirstEntryOrder(entry, entry)) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const schemaFirstEntryOrder: {
  (that: SchemaFirstInventoryEntry): (self: SchemaFirstInventoryEntry) => Ordering;
  (self: SchemaFirstInventoryEntry, that: SchemaFirstInventoryEntry): Ordering;
} = dual(2, Order.mapInput(Order.String, makeSchemaFirstEntryKey));

/**
 * Sort schema-first inventory entries in committed baseline order.
 *
 * **Example** (Sort empty entries array)
 *
 * ```ts
 * import { sortSchemaFirstEntries } from "@beep/repo-cli/commands/Lint"
 *
 * const result = sortSchemaFirstEntries([])
 * console.log(result) // rendered command output
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sortSchemaFirstEntries: (
  entries: ReadonlyArray<SchemaFirstInventoryEntry>
) => ReadonlyArray<SchemaFirstInventoryEntry> = flow(A.sort(schemaFirstEntryOrder));

/**
 * Test whether an inventory entry is an active advisory for the supplied schema-first rule.
 *
 * **Example** (Create advisory rule predicate)
 *
 * ```ts
 * import { isActiveSchemaFirstRuleAdvisory } from "@beep/repo-cli/commands/Lint"
 *
 * const result = isActiveSchemaFirstRuleAdvisory("literal-kit-const-assertion")
 * console.log(result) // rendered command output
 * ```
 *
 * @param ruleId - The schema-first policy rule id to match advisories against.
 * @returns A predicate that reports whether an entry is an active advisory for that rule id.
 * @category predicates
 * @since 0.0.0
 */
export const isActiveSchemaFirstRuleAdvisory =
  (ruleId: SchemaFirstPolicyRuleId) =>
  (entry: SchemaFirstInventoryEntry): boolean =>
    entry.ruleId === ruleId && entry.status === "advisory";

// Effect Vitest canon -------------------------------------------------------

/**
 * Enumerates the mechanical detector rules implemented during P0c.
 *
 * **Example** (Validate a detector rule)
 *
 * ```ts
 * import { EffectVitestRuleId } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EffectVitestRuleId)("EV007")) // true
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const EffectVitestRuleId = LiteralKit([
  "EV001",
  "EV002",
  "EV003",
  "EV004",
  "EV005",
  "EV006",
  "EV007",
  "EV008",
  "EV009",
  "EV010",
  "EV011",
  "EV012",
  "EV013",
  "EV014",
  "EV015",
]).pipe($I.annoteSchema("EffectVitestRuleId", { description: "Stable P0c Effect Vitest detector rule identifier." }));
/**
 * Decoded detector identifier accepted by {@link EffectVitestRuleId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EffectVitestRuleId = typeof EffectVitestRuleId.Type;

const EffectVitestLens = LiteralKit(["detector", "resource", "flake", "property", "observability"]).pipe(
  $I.annoteSchema("EffectVitestLens", { description: "Originating detector or judgment lens for a finding." })
);

const EffectVitestSeverity = LiteralKit(["blocker", "major", "minor", "info"]).pipe(
  $I.annoteSchema("EffectVitestSeverity", { description: "Review severity assigned to an Effect Vitest finding." })
);
/**
 * Decoded severity assigned by Effect Vitest detector policy.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EffectVitestSeverity = typeof EffectVitestSeverity.Type;

const EffectVitestMechanization = LiteralKit(["detector", "judgment"]).pipe(
  $I.annoteSchema("EffectVitestMechanization", {
    description: "Whether a finding is mechanically asserted or requests judgment.",
  })
);

const EffectVitestFindingStatus = LiteralKit(["open", "fixed", "exception"]).pipe(
  $I.annoteSchema("EffectVitestFindingStatus", { description: "Lifecycle state of an Effect Vitest finding." })
);

const EffectVitestLensRuleId = S.String.check(S.isPattern(/^L-(?:RES|FLAKE|PROP|OBS)-\d{2}$/u)).pipe(
  $I.annoteSchema("EffectVitestLensRuleId", {
    description: "Resource, flake, property, or observability judgment rule identifier.",
  })
);

/**
 * Accepts both EV detector identifiers and the four judgment-lens rule families.
 *
 * **Example** (Validate both rule families)
 *
 * ```ts
 * import { EffectVitestFindingRuleId } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EffectVitestFindingRuleId)("EV001")) // true
 * console.log(S.is(EffectVitestFindingRuleId)("L-RES-01")) // true
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const EffectVitestFindingRuleId = S.Union([EffectVitestRuleId, EffectVitestLensRuleId]).pipe(
  $I.annoteSchema("EffectVitestFindingRuleId", {
    description: "Detector or judgment-lens rule identifier stored in a finding row.",
  })
);
/**
 * Decoded finding rule identifier accepted by {@link EffectVitestFindingRuleId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EffectVitestFindingRuleId = typeof EffectVitestFindingRuleId.Type;

const EffectVitestPositiveLine = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("EffectVitestPositiveLine", { description: "Positive one-based source line number." })
);
const EffectVitestConfidence = S.Finite.check(
  S.makeFilterGroup([S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1)], {
    identifier: $I`EffectVitestConfidenceChecks`,
    title: "Effect Vitest Confidence",
    description: "Finite confidence value in the inclusive interval from zero to one.",
  })
).pipe($I.annoteSchema("EffectVitestConfidence", { description: "Finding confidence from zero through one." }));
const EffectVitestEvidence = S.String.check(S.isMaxLength(200)).pipe(
  $I.annoteSchema("EffectVitestEvidence", { description: "Compact source evidence limited to 200 characters." })
);
const EffectVitestOccurrence = S.String.check(S.isPattern(/^v2:[a-f0-9]{64}$/u)).pipe(
  $I.annoteSchema("EffectVitestOccurrence", {
    description:
      "Versioned SHA-256 anchor of lexical registration titles and the complete containing statement token stream.",
  })
);
const optionalText = S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);

/**
 * Names the pinned primitive and concise built-in remediation available before P0d.
 *
 * **Example** (Create a replacement hint)
 *
 * ```ts
 * import { EffectVitestReplacement } from "@beep/repo-cli/commands/Lint"
 *
 * const replacement = EffectVitestReplacement.make({ primitive: "it.effect", sketch: "Return the Effect." })
 * console.log(replacement.primitive)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectVitestReplacement extends S.Class<EffectVitestReplacement>($I`EffectVitestReplacement`)(
  { primitive: S.NonEmptyString, sketch: S.NonEmptyString },
  $I.annote("EffectVitestReplacement", { description: "Pinned primitive identifier and concise P0c remediation hint." })
) {}

const EffectVitestFindingFields = S.Struct({
  id: S.NonEmptyString,
  lens: EffectVitestLens,
  ruleId: EffectVitestFindingRuleId,
  package: S.NonEmptyString,
  file: S.NonEmptyString,
  line: EffectVitestPositiveLine,
  endLine: EffectVitestPositiveLine.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  symbol: optionalText,
  testName: optionalText,
  occurrence: EffectVitestOccurrence.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  class: S.NonEmptyString,
  evidence: EffectVitestEvidence,
  replacement: EffectVitestReplacement,
  severity: EffectVitestSeverity,
  confidence: EffectVitestConfidence,
  mechanization: EffectVitestMechanization,
  status: EffectVitestFindingStatus,
  reason: optionalText,
  fixSha: optionalText,
}).check(
  S.makeFilter(
    (finding) =>
      (O.isNone(finding.endLine) || finding.endLine.value >= finding.line) &&
      ((finding.status !== "exception" && finding.class !== "flaky-test-wrap") ||
        O.exists(finding.reason, (reason) => Str.isNonEmpty(Str.trim(reason)))),
    {
      identifier: $I`EffectVitestFindingInvariant`,
      title: "Effect Vitest finding invariants",
      description: "End lines cannot precede start lines, and exception or flaky-wrap rows require a non-empty reason.",
      message: "Expected ordered lines and a non-empty reason for exception or flaky-test-wrap rows",
    }
  )
);

/**
 * Models a schema-validated detector or judgment row with encoded optional keys.
 *
 * **Example** (Create a judgment finding)
 *
 * ```ts
 * import { EffectVitestFinding, EffectVitestReplacement } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * const finding = EffectVitestFinding.make({
 *   id: "L-RES-01:packages/example/test/resource.test.ts:8:withRepo@2#1",
 *   lens: "resource", ruleId: "L-RES-01", package: "@beep/example",
 *   file: "packages/example/test/resource.test.ts", line: 8, endLine: O.some(8),
 *   symbol: O.some("withRepo"), testName: O.some("uses a repository"), class: "resource-wrapper",
 *   evidence: "withRepo(program)",
 *   replacement: EffectVitestReplacement.make({ primitive: "it.layer", sketch: "Share the resource layer." }),
 *   severity: "major", confidence: 0.55, mechanization: "judgment", status: "open",
 *   reason: O.none(), fixSha: O.none()
 * })
 * console.log(finding.ruleId) // "L-RES-01"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectVitestFinding extends S.Class<EffectVitestFinding>($I`EffectVitestFinding`)(
  EffectVitestFindingFields,
  $I.annote("EffectVitestFinding", {
    description: "Stable Effect Vitest detector or judgment finding persisted as encoded JSONL.",
  })
) {}

const EffectVitestPrimitiveKind = LiteralKit([
  "method",
  "tester-method",
  "function",
  "type",
  "option",
  "readme-section",
]).pipe(
  $I.annoteSchema("EffectVitestPrimitiveKind", {
    description: "Pinned API export or README-section kind represented by the P0d primitive graph.",
  })
);

const EffectVitestPinnedCommitSha = S.String.check(S.isPattern(/^[0-9a-f]{40}$/u)).pipe(
  $I.annoteSchema("EffectVitestPinnedCommitSha", {
    description: "Lowercase forty-character commit SHA anchoring the Effect Vitest primitive graph.",
  })
);

const EffectVitestPrimitiveFields = S.Struct({
  id: S.NonEmptyString,
  name: S.NonEmptyString,
  kind: EffectVitestPrimitiveKind,
  file: S.NonEmptyString,
  startLine: EffectVitestPositiveLine,
  endLine: EffectVitestPositiveLine,
  signature: S.NonEmptyString,
  description: S.NonEmptyString,
  whenToUse: S.NonEmptyString,
  whenNotToUse: S.NonEmptyString,
  replaces: S.Array(EffectVitestRuleId),
  example: S.NonEmptyString,
  gotchas: S.Array(S.NonEmptyString),
}).check(
  S.makeFilter(
    (primitive) =>
      primitive.endLine >= primitive.startLine &&
      A.length(A.dedupe(primitive.replaces)) === A.length(primitive.replaces) &&
      (!A.isReadonlyArrayEmpty(primitive.replaces) || Str.startsWith("No detector replacement:")(primitive.whenToUse)),
    {
      identifier: $I`EffectVitestPrimitiveInvariant`,
      title: "Effect Vitest primitive invariants",
      description:
        "Source ranges must be ordered, replacement rule IDs must be unique, and entries without replacements must explain why.",
      message: "Expected ordered lines, unique replacement rule IDs, and an explicit no-replacement reason",
    }
  )
);

/**
 * Defines the schema P0d will use for the complete pinned primitive graph.
 *
 * **Example** (Create a pinned primitive entry)
 *
 * ```ts
 * import { EffectVitestPrimitive } from "@beep/repo-cli/commands/Lint"
 *
 * const primitive = EffectVitestPrimitive.make({
 *   id: "it.effect",
 *   name: "it.effect",
 *   kind: "method",
 *   file: "src/index.ts",
 *   startLine: 1,
 *   endLine: 1,
 *   signature: "it.effect(name, effect)",
 *   description: "Registers an Effect test.",
 *   whenToUse: "Use for tests driven by TestClock and test services.",
 *   whenNotToUse: "Do not use for plain synchronous functions.",
 *   replaces: ["EV001"],
 *   example: 'it.effect("works", () => program)',
 *   gotchas: ["Return the Effect from the callback."]
 * })
 * console.log(primitive.id) // "it.effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectVitestPrimitive extends S.Class<EffectVitestPrimitive>($I`EffectVitestPrimitive`)(
  EffectVitestPrimitiveFields,
  $I.annote("EffectVitestPrimitive", {
    description: "Schema-validated pinned primitive, source anchor, usage guidance, and detector replacement edges.",
  })
) {}

/**
 * Records how the portable fixture proves the pinned graph surface without
 * expanding Vitest's export-star into invented declarations.
 *
 * **Example** (Describe source-derived coverage)
 *
 * ```ts
 * import { EffectVitestPrimitiveCoverage } from "@beep/repo-cli/commands/Lint"
 *
 * const coverage = EffectVitestPrimitiveCoverage.make({
 *   exportStarModule: "vitest",
 *   method: "Direct declarations and named namespace members are compared with pinned source.",
 *   sourceFiles: ["packages/vitest/src/index.ts"]
 * })
 * console.log(coverage.exportStarModule) // "vitest"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectVitestPrimitiveCoverage extends S.Class<EffectVitestPrimitiveCoverage>(
  $I`EffectVitestPrimitiveCoverage`
)(
  {
    exportStarModule: S.Literal("vitest"),
    method: S.NonEmptyString,
    sourceFiles: S.Array(S.NonEmptyString),
  },
  $I.annote("EffectVitestPrimitiveCoverage", {
    description: "Portable source inventory method and deliberate Vitest export-star boundary.",
  })
) {}

const EffectVitestPrimitiveGraphFields = S.Struct({
  schemaVersion: S.Literal("effect-vitest-primitives/v1"),
  package: S.Literal("@effect/vitest"),
  version: S.NonEmptyString,
  tag: S.NonEmptyString,
  sha: EffectVitestPinnedCommitSha,
  coverage: EffectVitestPrimitiveCoverage,
  entries: S.Array(EffectVitestPrimitive),
}).check(
  S.makeFilter(
    (document) => {
      const ids = A.map(document.entries, (entry) => entry.id);
      const replacements = A.flatMap(document.entries, (entry) => entry.replaces);
      return (
        document.tag === `${document.package}@${document.version}` &&
        !A.isReadonlyArrayEmpty(document.entries) &&
        A.length(A.dedupe(ids)) === A.length(ids) &&
        A.every(EffectVitestRuleId.Options, (ruleId) => A.contains(replacements, ruleId))
      );
    },
    {
      identifier: $I`EffectVitestPrimitiveGraphInvariant`,
      title: "Effect Vitest primitive graph invariants",
      description:
        "The tag must match the package/version pin, entry IDs must be unique, and every detector rule must have a replacement edge.",
      message: "Expected a matching package tag, unique entries, and complete EV001-EV015 replacement coverage",
    }
  )
);

/**
 * Models the complete pinned Effect Vitest primitive graph and its source-derived
 * coverage declaration.
 *
 * **Example** (Reject an incomplete graph)
 *
 * ```ts
 * import { EffectVitestPrimitiveGraphDocument } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * const isGraph = S.is(EffectVitestPrimitiveGraphDocument)
 * console.log(isGraph({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectVitestPrimitiveGraphDocument extends S.Class<EffectVitestPrimitiveGraphDocument>(
  $I`EffectVitestPrimitiveGraphDocument`
)(
  EffectVitestPrimitiveGraphFields,
  $I.annote("EffectVitestPrimitiveGraphDocument", {
    description: "Complete primitive graph pinned to one Effect Vitest package version and tag commit.",
  })
) {}

/**
 * Stores the full-scan baseline used by the default membership ratchet.
 *
 * **Example** (Create an empty baseline)
 *
 * ```ts
 * import { EffectVitestInventoryDocument } from "@beep/repo-cli/commands/Lint"
 *
 * const document = EffectVitestInventoryDocument.make({ schemaVersion: "effect-vitest-inventory/v1", effectVitestVersion: "4.0.0-rc.113", scope: [], findings: [] })
 * console.log(document.findings.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectVitestInventoryDocument extends S.Class<EffectVitestInventoryDocument>(
  $I`EffectVitestInventoryDocument`
)(
  {
    schemaVersion: S.Literal("effect-vitest-inventory/v1"),
    effectVitestVersion: S.NonEmptyString,
    scope: S.Array(S.String),
    findings: S.Array(EffectVitestFinding),
  },
  $I.annote("EffectVitestInventoryDocument", {
    description: "Tracked full-scan baseline for Effect Vitest detector findings.",
  })
) {}

const EffectVitestCensusKind = LiteralKit(["test", "support"]).pipe(
  $I.annoteSchema("EffectVitestCensusKind", { description: "D9 test or test-support file classification." })
);
/**
 * Records a D9 file with its containing workspace and physical size.
 *
 * **Example** (Create a census row)
 *
 * ```ts
 * import { EffectVitestCensusRow } from "@beep/repo-cli/commands/Lint"
 *
 * const row = EffectVitestCensusRow.make({ file: "packages/example/test/Foo.test.ts", package: "@beep/example", kind: "test", bytes: 42, lines: 2 })
 * console.log(row.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectVitestCensusRow extends S.Class<EffectVitestCensusRow>($I`EffectVitestCensusRow`)(
  {
    file: S.NonEmptyString,
    package: S.NonEmptyString,
    kind: EffectVitestCensusKind,
    bytes: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    lines: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  },
  $I.annote("EffectVitestCensusRow", {
    description: "File path, actual workspace owner, kind, byte count, and line count in the D9 census.",
  })
) {}

/**
 * Separates detector scan duration from the later package test timing model.
 *
 * **Example** (Record a scan duration)
 *
 * ```ts
 * import { EffectVitestScanTiming } from "@beep/repo-cli/commands/Lint"
 *
 * const timing = EffectVitestScanTiming.make({ scanMs: 125, fileCount: 1044, findingCount: 10 })
 * console.log(timing.scanMs)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export class EffectVitestScanTiming extends S.Class<EffectVitestScanTiming>($I`EffectVitestScanTiming`)(
  {
    scanMs: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    fileCount: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    findingCount: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  },
  $I.annote("EffectVitestScanTiming", { description: "Measured syntax-only scan duration and result cardinalities." })
) {}

class EffectVitestPackageFileTiming extends S.Class<EffectVitestPackageFileTiming>($I`EffectVitestPackageFileTiming`)(
  {
    file: S.NonEmptyString,
    ms: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    tests: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  },
  $I.annote("EffectVitestPackageFileTiming", {
    description: "Reporter-derived duration and test count for one test file.",
  })
) {}
class EffectVitestSlowTestTiming extends S.Class<EffectVitestSlowTestTiming>($I`EffectVitestSlowTestTiming`)(
  { file: S.NonEmptyString, testName: S.NonEmptyString, ms: S.Finite.check(S.isGreaterThanOrEqualTo(0)) },
  $I.annote("EffectVitestSlowTestTiming", { description: "One slow test selected from a package reporter artifact." })
) {}

/**
 * Models the P1 before/after package timing summary from SPEC section 5.4.
 *
 * **Example** (Create an empty package timing summary)
 *
 * ```ts
 * import { EffectVitestPackageTiming } from "@beep/repo-cli/commands/Lint"
 *
 * const timing = EffectVitestPackageTiming.make({ package: "@beep/example", runner: "node-vitest", capturedAt: "2026-09-08", totalMs: 10, testCount: 0, files: [], slowest: [] })
 * console.log(timing.runner)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectVitestPackageTiming extends S.Class<EffectVitestPackageTiming>($I`EffectVitestPackageTiming`)(
  {
    package: S.NonEmptyString,
    runner: S.Literal("node-vitest"),
    capturedAt: S.NonEmptyString,
    totalMs: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    testCount: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    files: S.Array(EffectVitestPackageFileTiming),
    slowest: S.Array(EffectVitestSlowTestTiming),
  },
  $I.annote("EffectVitestPackageTiming", {
    description: "Reporter-derived package timing summary kept separate from command scan time.",
  })
) {}

/**
 * Selects census, baseline refresh, row emission, or default ratchet mode.
 *
 * **Example** (Select default ratchet mode)
 *
 * ```ts
 * import { EffectVitestLintOptions } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * const options = EffectVitestLintOptions.make({ census: false, write: false, rows: O.none() })
 * console.log(options.write)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectVitestLintOptions extends S.Class<EffectVitestLintOptions>($I`EffectVitestLintOptions`)(
  { census: S.Boolean, write: S.Boolean, rows: optionalText },
  $I.annote("EffectVitestLintOptions", { description: "Validated Effect Vitest lint command operation flags." })
) {}

/**
 * Repository-relative path of the committed full-scan baseline.
 *
 * **Example** (Inspect the inventory target)
 *
 * ```ts
 * import { EffectVitestInventoryPath } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(EffectVitestInventoryPath) // "standards/effect-vitest.inventory.jsonc"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EffectVitestInventoryPath = "standards/effect-vitest.inventory.jsonc";
/**
 * Repository-relative path of the authoritative pinned primitive graph.
 *
 * **Example** (Inspect the primitive graph target)
 *
 * ```ts
 * import { EffectVitestPrimitiveGraphPath } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(EffectVitestPrimitiveGraphPath) // "standards/effect-vitest.primitives.jsonc"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EffectVitestPrimitiveGraphPath = "standards/effect-vitest.primitives.jsonc";
/**
 * Repository-relative path replaced by the authoritative D9 census mode.
 *
 * **Example** (Inspect the census target)
 *
 * ```ts
 * import { EffectVitestCensusPath } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(EffectVitestCensusPath) // "goals/effect-vitest-canon/ops/inventory/test-files.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EffectVitestCensusPath = "goals/effect-vitest-canon/ops/inventory/test-files.json";

const EffectVitestTestFilePath = S.String.check(
  S.isPattern(/\.(?:test|spec)\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/u)
).pipe(
  $I.annoteSchema("EffectVitestTestFilePath", {
    description: "D9 test/spec suffix accepted by the syntax-only project.",
  })
);

/**
 * Tests the same suffix domain used by the authoritative D9 discovery globs.
 *
 * **Example** (Classify a test and support module)
 *
 * ```ts
 * import { isEffectVitestTestFilePath } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(isEffectVitestTestFilePath("packages/demo/test/Foo.test.ts")) // true
 * console.log(isEffectVitestTestFilePath("packages/demo/test/utils.ts")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isEffectVitestTestFilePath = S.is(EffectVitestTestFilePath);

/**
 * Supplies the only D9 include/exclude glob set used by project discovery.
 *
 * **Example** (Inspect the test-root glob)
 *
 * ```ts
 * import { EffectVitestSourceFileGlobs } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(EffectVitestSourceFileGlobs[0]?.startsWith("{apps,packages,infra}")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EffectVitestSourceFileGlobs: ReadonlyArray<string> = A.fromIterable([
  "{apps,packages,infra}/**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
  "{apps,packages,infra}/**/test/**/*.ts",
  "!{apps,packages,infra}/**/node_modules/**",
]);

/**
 * Builds a shift-resistant membership key with a versioned lexical occurrence anchor.
 *
 * **Details**
 *
 * Legacy rows without an anchor retain their original key. Scan comparison may
 * bridge a legacy fingerprint only when it is unique on both sides. Anchored
 * duplicates are never eligible for automatic exception inheritance.
 *
 * **Example** (Keep line numbers out of membership identity)
 *
 * ```ts
 * import { EffectVitestFinding, EffectVitestReplacement, makeEffectVitestFindingKey } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * const row = EffectVitestFinding.make({
 *   id: "EV001:packages/example/test/a.test.ts:4:runSync@2#1",
 *   lens: "detector", ruleId: "EV001", package: "@beep/example",
 *   file: "packages/example/test/a.test.ts", line: 4, endLine: O.some(4),
 *   symbol: O.some("runSync"), testName: O.none(), class: "runtime-boundary-in-test",
 *   evidence: "Effect.runSync(program)",
 *   replacement: EffectVitestReplacement.make({ primitive: "it.effect", sketch: "Return the Effect." }),
 *   severity: "major", confidence: 0.95, mechanization: "detector", status: "open",
 *   reason: O.none(), fixSha: O.none()
 * })
 * const shifted = EffectVitestFinding.make({ ...row, line: 14, endLine: O.some(14) })
 * console.log(makeEffectVitestFindingKey(row) === makeEffectVitestFindingKey(shifted)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeEffectVitestFindingKey = (finding: EffectVitestFinding): string =>
  A.join(
    [
      finding.ruleId,
      finding.file,
      O.getOrElse(finding.symbol, () => ""),
      finding.class,
      finding.evidence,
      ...O.match(finding.occurrence, { onNone: A.empty<string>, onSome: (anchor) => [anchor] }),
      `#${A.lastNonEmpty(Str.split("#")(finding.id))}`,
    ],
    "::"
  );

/**
 * Decode unknown data as the complete pinned Effect Vitest primitive graph.
 *
 * **Example** (Decode through the schema boundary)
 *
 * ```ts
 * import { decodeEffectVitestPrimitiveGraphDocument } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 *
 * const decoded = decodeEffectVitestPrimitiveGraphDocument()({})
 * Effect.runPromiseExit(decoded).then((exit) => console.log(exit._tag)) // "Failure"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEffectVitestPrimitiveGraphDocument: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<EffectVitestPrimitiveGraphDocument, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<EffectVitestPrimitiveGraphDocument, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(EffectVitestPrimitiveGraphDocument));

/**
 * Encode a validated primitive graph for deterministic JSONC persistence.
 *
 * **Example** (Build the graph encoder)
 *
 * ```ts
 * import { encodeEffectVitestPrimitiveGraphDocument } from "@beep/repo-cli/commands/Lint"
 *
 * const encode = encodeEffectVitestPrimitiveGraphDocument()
 * console.log(typeof encode) // "function"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeEffectVitestPrimitiveGraphDocument: {
  (
    options?: AST.ParseOptions
  ): (input: unknown) => Effect.Effect<S.Codec.Encoded<typeof EffectVitestPrimitiveGraphDocument>, S.SchemaError>;
  (
    input: unknown,
    options?: AST.ParseOptions
  ): Effect.Effect<S.Codec.Encoded<typeof EffectVitestPrimitiveGraphDocument>, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(EffectVitestPrimitiveGraphDocument));

/**
 * Decode unknown data as a validated Effect Vitest inventory in the Effect error channel.
 *
 * **Example** (Decode an empty baseline)
 *
 * ```ts
 * import { decodeEffectVitestInventoryDocument } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 *
 * const decoded = decodeEffectVitestInventoryDocument({
 *   schemaVersion: "effect-vitest-inventory/v1",
 *   effectVitestVersion: "4.0.0-rc.113",
 *   scope: [],
 *   findings: []
 * })
 * Effect.runPromise(decoded).then(({ findings }) => console.log(findings.length)) // 0
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEffectVitestInventoryDocument: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<EffectVitestInventoryDocument, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<EffectVitestInventoryDocument, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(EffectVitestInventoryDocument));
/**
 * Encode a validated inventory document for JSONC formatting and persistence.
 *
 * **Example** (Encode an empty baseline)
 *
 * ```ts
 * import { EffectVitestInventoryDocument, encodeEffectVitestInventoryDocument } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 *
 * const document = EffectVitestInventoryDocument.make({
 *   schemaVersion: "effect-vitest-inventory/v1",
 *   effectVitestVersion: "4.0.0-rc.113",
 *   scope: [],
 *   findings: []
 * })
 * Effect.runPromise(encodeEffectVitestInventoryDocument(document)).then(({ findings }) => console.log(findings.length)) // 0
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeEffectVitestInventoryDocument: {
  (
    options?: AST.ParseOptions
  ): (input: unknown) => Effect.Effect<S.Codec.Encoded<typeof EffectVitestInventoryDocument>, S.SchemaError>;
  (
    input: unknown,
    options?: AST.ParseOptions
  ): Effect.Effect<S.Codec.Encoded<typeof EffectVitestInventoryDocument>, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(EffectVitestInventoryDocument));
/**
 * Encode one validated finding as its JSONL-compatible JSON string.
 *
 * **Example** (Encode a detector row)
 *
 * ```ts
 * import { EffectVitestFinding, EffectVitestReplacement, encodeEffectVitestFindingJson } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as Str from "effect/String"
 *
 * const row = EffectVitestFinding.make({
 *   id: "EV001:packages/example/test/a.test.ts:4:runSync@2#1",
 *   lens: "detector", ruleId: "EV001", package: "@beep/example",
 *   file: "packages/example/test/a.test.ts", line: 4, endLine: O.some(4),
 *   symbol: O.some("runSync"), testName: O.none(), class: "runtime-boundary-in-test",
 *   evidence: "Effect.runSync(program)",
 *   replacement: EffectVitestReplacement.make({ primitive: "it.effect", sketch: "Return the Effect." }),
 *   severity: "major", confidence: 0.95, mechanization: "detector", status: "open",
 *   reason: O.none(), fixSha: O.none()
 * })
 * Effect.runPromise(encodeEffectVitestFindingJson(row)).then((json) => console.log(Str.includes("EV001")(json))) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeEffectVitestFindingJson: {
  (options?: AST.ParseOptions): (input: EffectVitestFinding) => Effect.Effect<string, S.SchemaError>;
  (input: EffectVitestFinding, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeEffect(S.fromJsonString(EffectVitestFinding)));
/**
 * Decode one JSONL record to `Option`, rejecting unrelated producer records without throwing.
 *
 * **Example** (Reject an unrelated JSONL row)
 *
 * ```ts
 * import { decodeEffectVitestFindingJson } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(decodeEffectVitestFindingJson('{"producer":"other"}'))) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEffectVitestFindingJson: {
  (options?: AST.ParseOptions): (input: unknown) => O.Option<EffectVitestFinding>;
  (input: unknown, options?: AST.ParseOptions): O.Option<EffectVitestFinding>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownOption(S.fromJsonString(EffectVitestFinding)));
