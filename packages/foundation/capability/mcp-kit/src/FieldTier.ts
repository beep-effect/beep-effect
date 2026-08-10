/**
 * Progressive field-tier projector and columnar reshaper.
 *
 * Large MCP tool results (a USPTO `documentBag`-shaped response is the
 * canonical example) blow past client output ceilings when returned in full.
 * This module names three progressive-disclosure field tiers —
 * `minimal`/`balanced`/`complete` — as actual `Schema.Struct` variants (per
 * `uspto_pfw_mcp#4`, port-with-attribution), projects a payload down to a
 * tier's field set, strips null-valued fields, and reshapes row-oriented
 * arrays into a columnar envelope (per `us-gov-open-data-mcp#4`,
 * port-with-attribution) to shrink JSON size further. When even the
 * `minimal` tier does not fit a caller's budget, {@link FetchableHandle}
 * names the escape valve: a UUID+TTL handle a caller can fetch instead of
 * receiving the payload inline (per `patents-mcp-server#3`,
 * reimplement-only).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpKitId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, UnknownRecord } from "@beep/schema";
import { HashSet } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $McpKitId.create("FieldTier");

/**
 * Named progressive-disclosure field tier.
 *
 * **Example** (Access minimal enum value)
 *
 * ```ts
 * import { FieldTierName } from "@beep/mcp-kit"
 *
 * const tier = FieldTierName.Enum.minimal
 * console.log(tier)
 * // "minimal"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FieldTierName = LiteralKit(["minimal", "balanced", "complete"]).pipe(
  $I.annoteSchema("FieldTierName", {
    description: "Named progressive-disclosure field tier: minimal, balanced, or complete.",
  })
);

/**
 * Runtime type for {@link FieldTierName}.
 *
 * **Example** (Satisfy FieldTierName type)
 *
 * ```ts
 * import type { FieldTierName } from "@beep/mcp-kit"
 *
 * const tier = "balanced" satisfies FieldTierName
 * console.log(tier)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FieldTierName = typeof FieldTierName.Type;

/**
 * A set of three named `Schema.Struct` field-tier variants over the same
 * conceptual payload: `minimal` (smallest), `balanced`, and `complete`
 * (largest).
 *
 * **Example** (Satisfy three-tier schema set)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { FieldTierSet } from "@beep/mcp-kit"
 *
 * const tiers = {
 *   minimal: S.Struct({ id: S.String }),
 *   balanced: S.Struct({ id: S.String, title: S.String }),
 *   complete: S.Struct({ id: S.String, title: S.String, body: S.String })
 * } satisfies FieldTierSet<S.Struct.Fields, S.Struct.Fields, S.Struct.Fields>
 * console.log(Object.keys(tiers.complete.fields))
 * // ["id", "title", "body"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface FieldTierSet<
  Minimal extends S.Struct.Fields,
  Balanced extends S.Struct.Fields,
  Complete extends S.Struct.Fields,
> {
  readonly balanced: S.Struct<Balanced>;
  readonly complete: S.Struct<Complete>;
  readonly minimal: S.Struct<Minimal>;
}

/**
 * Names a {@link FieldTierSet}. This is an identity constructor — it exists
 * to give the three tier schemas a single documented entry point and to
 * anchor the generic constraint that all three tiers describe the same
 * conceptual payload.
 *
 * **Example** (Define named field tiers)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { defineFieldTiers } from "@beep/mcp-kit"
 *
 * const tiers = defineFieldTiers({
 *   minimal: S.Struct({ id: S.String, title: S.String }),
 *   balanced: S.Struct({ id: S.String, title: S.String, summary: S.String }),
 *   complete: S.Struct({ id: S.String, title: S.String, summary: S.String, body: S.String })
 * })
 * console.log(Object.keys(tiers.minimal.fields))
 * // ["id", "title"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const defineFieldTiers = <
  Minimal extends S.Struct.Fields,
  Balanced extends S.Struct.Fields,
  Complete extends S.Struct.Fields,
>(
  tiers: FieldTierSet<Minimal, Balanced, Complete>
): FieldTierSet<Minimal, Balanced, Complete> => tiers;

const fieldNamesOf = (struct: S.Struct<S.Struct.Fields>): ReadonlyArray<string> => R.keys(struct.fields);

/**
 * Removes null- and undefined-valued keys from a plain record, shrinking its
 * encoded JSON size.
 *
 * **Example** (Strip nullish record keys)
 *
 * ```ts
 * import { stripNulls } from "@beep/mcp-kit"
 *
 * const stripped = stripNulls({ a: 1, b: null, c: undefined, d: 0 })
 * console.log(stripped)
 * // { a: 1, d: 0 }
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const stripNulls = (value: Record<string, unknown>): Record<string, unknown> =>
  R.filter(value, (fieldValue) => fieldValue !== null && fieldValue !== undefined);

const pickFields = (value: Record<string, unknown>, fields: ReadonlyArray<string>): Record<string, unknown> => {
  const allow = HashSet.fromIterable(fields);
  return R.filter(value, (_fieldValue, key) => HashSet.has(allow, key));
};

/**
 * Projects a plain payload record down to one named field tier's field set,
 * then strips null-valued fields.
 *
 * **Example** (Project payload to minimal)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { defineFieldTiers, projectFieldTier } from "@beep/mcp-kit"
 *
 * const tiers = defineFieldTiers({
 *   minimal: S.Struct({ id: S.String }),
 *   balanced: S.Struct({ id: S.String, summary: S.String }),
 *   complete: S.Struct({ id: S.String, summary: S.String, body: S.String })
 * })
 *
 * const projected = projectFieldTier({ id: "doc-1", summary: "s", body: "b" }, "minimal", tiers)
 * console.log(projected)
 * // { id: "doc-1" }
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const projectFieldTier: {
  (
    tier: FieldTierName,
    tiers: FieldTierSet<S.Struct.Fields, S.Struct.Fields, S.Struct.Fields>
  ): (value: Record<string, unknown>) => Record<string, unknown>;
  (
    value: Record<string, unknown>,
    tier: FieldTierName,
    tiers: FieldTierSet<S.Struct.Fields, S.Struct.Fields, S.Struct.Fields>
  ): Record<string, unknown>;
} = dual(
  3,
  (
    value: Record<string, unknown>,
    tier: FieldTierName,
    tiers: FieldTierSet<S.Struct.Fields, S.Struct.Fields, S.Struct.Fields>
  ): Record<string, unknown> => stripNulls(pickFields(value, fieldNamesOf(tiers[tier])))
);

/**
 * Estimates a value's serialized JSON size in bytes/characters, used as a
 * proxy for a caller's token/size budget.
 *
 * **Example** (Estimate object JSON size)
 *
 * ```ts
 * import { estimateJsonSize } from "@beep/mcp-kit"
 *
 * console.log(estimateJsonSize({ a: 1 }))
 * // 8
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const estimateJsonSize = (value: unknown): number => JSON.stringify(value).length;

const TIER_ORDER: ReadonlyArray<FieldTierName> = A.reverse(FieldTierName.Options);

/**
 * A payload too large for even the `minimal` tier, handed to the caller's
 * `mintFetchableHandle` callback (see {@link projectWithinBudget}) to become a
 * {@link FetchableHandle}. The kit does not mint handles itself — UUID
 * generation, TTL policy, and out-of-band storage are consumer-owned.
 *
 * **Example** (Make oversized field projection)
 *
 * ```ts
 * import { OversizedFieldProjection } from "@beep/mcp-kit"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const oversized = OversizedFieldProjection.make({
 *   value: { id: "doc-1" },
 *   sizeBytes: NonNegativeInt.make(1000)
 * })
 * console.log(oversized.sizeBytes)
 * // 1000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OversizedFieldProjection extends S.Class<OversizedFieldProjection>($I`OversizedFieldProjection`)(
  {
    value: UnknownRecord.annotateKey({
      description: "The oversized minimal-tier projection.",
    }),
    sizeBytes: NonNegativeInt.annotateKey({
      description: "Estimated serialized size of `value`, in bytes.",
    }),
  },
  $I.annote("OversizedFieldProjection", {
    description: "A minimal-tier projection that still exceeds the caller's size budget.",
  })
) {}

/**
 * A fetchable handle for a payload too large to return inline: a UUID
 * identifier plus a TTL expiry the caller can use to fetch the full payload
 * out-of-band, instead of receiving it embedded in a tool result.
 *
 * **Example** (Make fetchable handle)
 *
 * ```ts
 * import { FetchableHandle } from "@beep/mcp-kit"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const handle = FetchableHandle.make({
 *   handleId: "5b1d6a3e-8f3e-4a1a-9c1e-2e6b7a2f9c10",
 *   expiresAt: "2026-07-01T01:00:00.000Z",
 *   sizeBytes: NonNegativeInt.make(2_000_000),
 *   tier: "complete"
 * })
 * console.log(handle.tier)
 * // "complete"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FetchableHandle extends S.Class<FetchableHandle>($I`FetchableHandle`)(
  {
    handleId: S.NonEmptyString.annotateKey({
      description: "UUID identifying the out-of-band payload.",
    }),
    expiresAt: S.NonEmptyString.annotateKey({
      description: "ISO-8601 timestamp after which the handle is no longer fetchable.",
    }),
    sizeBytes: NonNegativeInt.annotateKey({
      description: "Approximate serialized size of the full payload, in bytes.",
    }),
    tier: FieldTierName.annotateKey({
      description: "Field tier the full payload was projected at before storage.",
    }),
  },
  $I.annote("FetchableHandle", {
    description: "UUID+TTL fetchable handle standing in for a payload too large to return inline.",
  })
) {
  static readonly is = S.is(FetchableHandle);
}

/**
 * The result of {@link projectWithinBudget}: `Inline` when some tier fit the
 * budget and its projected value is returned directly; `Fetchable` when even
 * `minimal` did not fit, carrying a {@link FetchableHandle} minted by the
 * caller instead of an oversized inline payload.
 *
 * **Example** (Make inline projection outcome)
 *
 * ```ts
 * import { FieldProjectionOutcome } from "@beep/mcp-kit"
 *
 * const outcome = FieldProjectionOutcome.make({
 *   _tag: "Inline",
 *   tier: "minimal",
 *   value: { id: "doc-1" }
 * })
 * console.log(outcome._tag)
 * // "Inline"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FieldProjectionOutcome = LiteralKit(["Inline", "Fetchable"])
  .toTaggedUnion("_tag")({
    Inline: {
      tier: FieldTierName,
      value: UnknownRecord,
    },
    Fetchable: {
      handle: FetchableHandle,
    },
  })
  .pipe(
    $I.annoteSchema("FieldProjectionOutcome", {
      description: "Inline or fetchable outcome of projecting a payload within a caller's size budget.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Inline or fetchable outcome of projecting a payload within a caller's size budget.
 *
 * **Example** (Type FieldProjectionOutcome value)
 *
 * ```ts
 * import { FieldProjectionOutcome as FieldProjectionOutcomeValue } from "@beep/mcp-kit"
 * import type { FieldProjectionOutcome } from "@beep/mcp-kit"
 *
 * const outcome: FieldProjectionOutcome = FieldProjectionOutcomeValue.make({
 *   _tag: "Inline",
 *   tier: "balanced",
 *   value: { id: "doc-1", title: "Patent packet" }
 * })
 * console.log(outcome._tag)
 * // "Inline"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FieldProjectionOutcome = typeof FieldProjectionOutcome.Type;

type ProjectWithinBudgetOptions = {
  readonly tiers: FieldTierSet<S.Struct.Fields, S.Struct.Fields, S.Struct.Fields>;
  readonly budgetBytes: NonNegativeInt;
  readonly mintFetchableHandle: (oversized: OversizedFieldProjection) => FetchableHandle;
};

/**
 * Projects a payload to the most complete field tier that fits within
 * `options.budgetBytes`. When even the `minimal` tier does not fit, the
 * payload is never returned inline — `options.mintFetchableHandle` is called
 * with the oversized `minimal` projection and its size, and the result is
 * returned as the `Fetchable` outcome.
 *
 * **Example** (Project within budget bytes)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonNegativeInt } from "@beep/schema"
 * import { defineFieldTiers, FetchableHandle, projectWithinBudget } from "@beep/mcp-kit"
 *
 * const tiers = defineFieldTiers({
 *   minimal: S.Struct({ id: S.String }),
 *   balanced: S.Struct({ id: S.String, summary: S.String }),
 *   complete: S.Struct({ id: S.String, summary: S.String, body: S.String })
 * })
 *
 * const projected = projectWithinBudget(
 *   { id: "doc-1", summary: "s", body: "b".repeat(100) },
 *   {
 *     tiers,
 *     budgetBytes: NonNegativeInt.make(40),
 *     mintFetchableHandle: (oversized) =>
 *       FetchableHandle.make({
 *         handleId: "5b1d6a3e-8f3e-4a1a-9c1e-2e6b7a2f9c10",
 *         expiresAt: "2026-07-01T01:00:00.000Z",
 *         sizeBytes: oversized.sizeBytes,
 *         tier: "minimal"
 *       })
 *   }
 * )
 * console.log(projected._tag)
 * // "Fetchable"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const projectWithinBudget: {
  (value: Record<string, unknown>, options: ProjectWithinBudgetOptions): FieldProjectionOutcome;
  (options: ProjectWithinBudgetOptions): (value: Record<string, unknown>) => FieldProjectionOutcome;
} = dual(2, (value: Record<string, unknown>, options: ProjectWithinBudgetOptions): FieldProjectionOutcome => {
  for (const tier of TIER_ORDER) {
    const projected = projectFieldTier(value, tier, options.tiers);
    if (estimateJsonSize(projected) <= options.budgetBytes) {
      return FieldProjectionOutcome.make({ _tag: "Inline", tier, value: projected });
    }
  }
  const minimalProjected = projectFieldTier(value, "minimal", options.tiers);
  const oversized = OversizedFieldProjection.make({
    value: minimalProjected,
    sizeBytes: NonNegativeInt.make(estimateJsonSize(minimalProjected)),
  });
  return FieldProjectionOutcome.make({ _tag: "Fetchable", handle: options.mintFetchableHandle(oversized) });
});

/**
 * Columnar reshaping of row-oriented records: instead of repeating every
 * field name once per row, `columns` lists each field name once and `rows`
 * carries only the values, in `columns` order.
 *
 * **Example** (Make columnar envelope)
 *
 * ```ts
 * import { ColumnarEnvelope } from "@beep/mcp-kit"
 *
 * const envelope = ColumnarEnvelope.make({ columns: ["id", "title"], rows: [["doc-1", "Title"]] })
 * console.log(envelope.columns)
 * // ["id", "title"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ColumnarEnvelope extends S.Class<ColumnarEnvelope>($I`ColumnarEnvelope`)(
  {
    columns: S.Array(S.String).annotateKey({
      description: "Field names, in the order each row's values appear.",
    }),
    rows: S.Unknown.pipe(S.Array, S.Array).annotateKey({
      description: "Row values, one array per row, in `columns` order.",
    }),
  },
  $I.annote("ColumnarEnvelope", {
    description: "Columnar reshaping of row-oriented records: one column-name list plus value-only rows.",
  })
) {
  static readonly fromRows = (rows: ReadonlyArray<Record<string, unknown>>): ColumnarEnvelope => {
    const columns = A.dedupe(A.flatMap(rows, R.keys));
    return ColumnarEnvelope.make({
      columns,
      rows: A.map(rows, (row) => A.map(columns, (column) => (R.has(row, column) ? row[column] : null))),
    });
  };

  static readonly is = S.is(ColumnarEnvelope);
}

/**
 * Reshapes an array of row-oriented records into a {@link ColumnarEnvelope}.
 * The column list is the ordered union of every row's keys (first-occurrence
 * order across all rows, not just the first row), so sparse rows — for
 * example after {@link stripNulls} or a narrower field-tier projection — never
 * silently drop fields. Cells missing from a given row are filled with
 * `null`.
 *
 * **Example** (Reshape rows to columnar)
 *
 * ```ts
 * import { toColumnarEnvelope } from "@beep/mcp-kit"
 *
 * const envelope = toColumnarEnvelope([{ title: "A" }, { id: "2", title: "B" }])
 * console.log(envelope.columns)
 * // ["title", "id"]
 * console.log(envelope.rows)
 * // [["A", null], ["B", "2"]]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const toColumnarEnvelope = ColumnarEnvelope.fromRows;
