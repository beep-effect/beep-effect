/**
 * Shared schemas for Lint command inventory-backed checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, flow, Order } from "effect";
import { dual } from "effect/Function";
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
