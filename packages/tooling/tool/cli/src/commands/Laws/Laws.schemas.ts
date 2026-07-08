/**
 * Shared schemas for Laws command inventory-backed checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { TsMorphProjectInspectionRequest } from "@beep/repo-utils/TSMorph/index";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, Order } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/DualArity");

/**
 * Committed dual-arity inventory path.
 *
 * @example
 * ```ts
 * import { DualArityInventoryPath } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(DualArityInventoryPath)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const DualArityInventoryPath = "standards/dual-arity.inventory.jsonc";

/**
 * Source glob scope used by dual-arity laws.
 *
 * @example
 * ```ts
 * import { DualArityIncludedGlobs } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(DualArityIncludedGlobs)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const DualArityIncludedGlobs: ReadonlyArray<string> = [
  "apps/**/*.{ts,tsx}",
  "packages/**/*.{ts,tsx}",
  "infra/**/*.ts",
];

/**
 * Roots whose candidate entries fail strict dual-arity checks while still inventoried.
 *
 * @example
 * ```ts
 * import { DualArityEnforcedRoots } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(DualArityEnforcedRoots)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const DualArityEnforcedRoots: ReadonlyArray<string> = [
  "packages/tooling/tool/cli/src/commands/Laws/DualArity.ts",
  "packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts",
  "packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts",
];

/**
 * Public helper API shapes tracked by the dual-arity law.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const DualArityEntryKind = LiteralKit([
  "exported-function",
  "exported-const-function",
  "static-method",
  "static-function-property",
]).pipe(
  $I.annoteSchema("DualArityEntryKind", {
    description: "Kinds of public helper APIs tracked by the dual-arity law.",
  })
);

/**
 * Tracked status for a dual-arity inventory entry.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const DualArityEntryStatus = LiteralKit(["candidate", "exception"]).pipe(
  $I.annoteSchema("DualArityEntryStatus", {
    description: "Tracked status for a dual-arity inventory entry.",
  })
);

/**
 * Diagnostic kinds emitted by the public API dual-arity law.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const DualArityDiagnosticKind = LiteralKit([
  "missing-dual",
  "invalid-dual-source",
  "invalid-dual-arity",
  "missing-dual-signatures",
  "too-many-positional-params",
  "third-param-not-object-like",
  "obvious-wrong-first-parameter",
]).pipe(
  $I.annoteSchema("DualArityDiagnosticKind", {
    description: "Diagnostic kinds emitted by the public API dual-arity law.",
  })
);

/**
 * Single tracked public API dual-arity finding.
 *
 * @example
 * ```ts
 * import { DualArityInventoryEntry } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(DualArityInventoryEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DualArityInventoryEntry extends S.Class<DualArityInventoryEntry>($I`DualArityInventoryEntry`)(
  {
    file: S.String,
    qualifiedName: S.String,
    kind: DualArityEntryKind,
    status: DualArityEntryStatus,
    owner: S.String,
    reason: S.String,
    issue: S.String.pipe(S.UndefinedOr, S.optionalKey),
    line: S.Finite,
    column: S.Finite,
    parameterCount: S.Finite,
    diagnostics: S.Array(DualArityDiagnosticKind),
  },
  $I.annote("DualArityInventoryEntry", {
    description: "Single tracked public API dual-arity finding.",
  })
) {}

/**
 * Namespace for {@link DualArityInventoryEntry} companion types.
 *
 * @example
 * ```ts
 * console.log("DualArityInventoryEntry")
 * ```
 * @category models
 * @since 0.0.0
 */
export declare namespace DualArityInventoryEntry {
  /**
   * Encoded representation of {@link DualArityInventoryEntry}.
   *
   * @example
   * ```ts
   * console.log("Encoded")
   * ```
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof DualArityInventoryEntry.Encoded;
}

/**
 * Committed public API dual-arity inventory baseline for repo-wide Effect governance.
 *
 * @example
 * ```ts
 * import { DualArityInventoryDocument } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(DualArityInventoryDocument)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DualArityInventoryDocument extends S.Class<DualArityInventoryDocument>($I`DualArityInventoryDocument`)(
  {
    version: S.Literal(1),
    generatedOn: S.String,
    scope: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.fromIterable(DualArityIncludedGlobs))),
      S.withDecodingDefault(Effect.succeed(A.fromIterable(DualArityIncludedGlobs)))
    ),
    enforcedRoots: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.fromIterable(DualArityEnforcedRoots))),
      S.withDecodingDefault(Effect.succeed(A.fromIterable(DualArityEnforcedRoots)))
    ),
    entries: S.Array(DualArityInventoryEntry).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<DualArityInventoryEntry>())),
      S.withDecodingDefault(Effect.succeed(A.empty<DualArityInventoryEntry.Encoded>()))
    ),
  },
  $I.annote("DualArityInventoryDocument", {
    description: "Committed public API dual-arity inventory baseline for repo-wide Effect governance.",
  })
) {}

/**
 * Runtime options for public API dual-arity enforcement.
 *
 * @example
 * ```ts
 * console.log("DualArityRulesOptions")
 * ```
 * @category models
 * @since 0.0.0
 */
export class DualArityRulesOptions extends S.Class<DualArityRulesOptions>($I`DualArityRulesOptions`)(
  {
    write: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    excludePaths: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
  },
  $I.annote("DualArityRulesOptions", {
    description: "Runtime options for public API dual-arity enforcement.",
  })
) {}

/**
 * Summary of public API dual-arity inventory verification.
 *
 * @example
 * ```ts
 * console.log("DualArityRulesSummary")
 * ```
 * @category models
 * @since 0.0.0
 */
export class DualArityRulesSummary extends S.Class<DualArityRulesSummary>($I`DualArityRulesSummary`)(
  {
    liveEntries: S.Finite,
    trackedEntries: S.Finite,
    missingEntries: S.Finite,
    staleEntries: S.Finite,
    enforcedCandidates: S.Finite,
    invalidExceptions: S.Finite,
    excludedLegitimate: S.Finite,
    wroteInventory: S.Boolean,
    strictFailure: S.Boolean,
    diagnostics: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
  },
  $I.annote("DualArityRulesSummary", {
    description: "Summary of public API dual-arity inventory verification.",
  })
) {}

/**
 * Encoder for persisted dual-arity inventory documents.
 *
 * @example
 * ```ts
 * import { encodeDualArityInventoryDocument } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(encodeDualArityInventoryDocument)
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeDualArityInventoryDocument = S.encodeUnknownEffect(DualArityInventoryDocument);

/**
 * Decoder for TSMorph project inspection requests used by the dual-arity law.
 *
 * @example
 * ```ts
 * import { decodeDualArityProjectInspectionRequest } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(decodeDualArityProjectInspectionRequest)
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const decodeDualArityProjectInspectionRequest = S.decodeUnknownEffect(TsMorphProjectInspectionRequest);

/**
 * Stable key used to reconcile live dual-arity scan results with the baseline.
 *
 * @example
 * ```ts
 * import { makeDualArityEntryKey } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(makeDualArityEntryKey)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const makeDualArityEntryKey = (entry: DualArityInventoryEntry): string =>
  `${entry.file}::${entry.qualifiedName}::${entry.kind}`;

/**
 * Sort order for dual-arity inventory entries.
 *
 * @example
 * ```ts
 * import { dualArityEntryOrder } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(dualArityEntryOrder)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const dualArityEntryOrder: Order.Order<DualArityInventoryEntry> = Order.mapInput(
  Order.String,
  makeDualArityEntryKey
);

/**
 * Sort dual-arity inventory entries in committed baseline order.
 *
 * @example
 * ```ts
 * import { sortDualArityEntries } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(sortDualArityEntries)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const sortDualArityEntries = (
  entries: ReadonlyArray<DualArityInventoryEntry>
): ReadonlyArray<DualArityInventoryEntry> => A.sort(entries, dualArityEntryOrder);
