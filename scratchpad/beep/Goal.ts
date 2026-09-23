/**
 * Canonical goal contracts with released-client compatibility fields.
 *
 * **Details**
 *
 * Goals are Workflow, not a memory layer. Conversation is upstream of memory
 * and is not a memory. A goal moves from active work to an ended status in
 * its own collection. Long-term memory may store a fact about a commitment;
 * the goal row stays in workflow. Create and update do not share a normalizer.
 * Response aliases are required floats beside an optional metric.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { EvidenceRef } from "./ActionItem.ts";
import { boundedText, optionalBoundedText, optionalStableId, optionalText, optionalTimestamp, stableId, text, textBoundsCheck, timestamp } from "./Kit.ts";
import { atLeastCheck, betweenCheck, boolDefault, finiteDefault, intDefault, jsonbArrayLengthCheck, Model, optionalNull, pg, Table } from "./Port.ts";

const decodeUnknownOptionStringUnknownRecord = S.decodeUnknownOption(S.Record(S.String, S.Unknown));

const $I = $ScratchpadId.create("beep/Goal");

/**
 * Goal progress shape.
 *
 * **Example** (Decode scale)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GoalType } from "@beep/scratchpad/beep/Goal"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(GoalType)("scale"))) // "scale"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalType = LiteralKit(["boolean", "scale", "numeric"]).pipe(
  $I.annoteSchema("GoalType", { description: "How a goal metric is measured." }),
);

/**
 * Decoded type of {@link GoalType}.
 *
 * @see {@link GoalType} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type GoalType = typeof GoalType.Type;

const decodeGoalType = S.decodeUnknownEffect(GoalType);

/**
 * Goal lifecycle status, including focused.
 *
 * **Details**
 *
 * Create rejects `focused`. The lifecycle request accepts only paused,
 * achieved, and abandoned. The response still uses the full set.
 *
 * **Example** (Decode paused)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GoalStatus } from "@beep/scratchpad/beep/Goal"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(GoalStatus)("paused"))) // "paused"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalStatus = LiteralKit(["background", "focused", "paused", "achieved", "abandoned"]).pipe(
  $I.annoteSchema("GoalStatus", { description: "Workflow status of a goal, from background through ended." }),
);

/**
 * Decoded type of {@link GoalStatus}.
 *
 * @see {@link GoalStatus} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type GoalStatus = typeof GoalStatus.Type;

/**
 * Who created the goal.
 *
 * **Details**
 *
 * Released desktop clients sent `ai` and onboarding source strings.
 * {@link normalizeLegacySource} rewrites those before this set is checked.
 *
 * **Example** (Decode user)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GoalSource } from "@beep/scratchpad/beep/Goal"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(GoalSource)("user"))) // "user"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalSource = LiteralKit(["user", "ai_suggested", "imported"]).pipe(
  $I.annoteSchema("GoalSource", { description: "Who created the goal after legacy source strings are rewritten." }),
);

/**
 * Decoded type of {@link GoalSource}.
 *
 * @see {@link GoalSource} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type GoalSource = typeof GoalSource.Type;

/**
 * What to do with related rows when a goal pauses or ends.
 *
 * **Example** (Decode detach)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GoalRelationshipDisposition } from "@beep/scratchpad/beep/Goal"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(GoalRelationshipDisposition)("detach"))) // "detach"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalRelationshipDisposition = LiteralKit(["retain", "detach"]).pipe(
  $I.annoteSchema("GoalRelationshipDisposition", { description: "Whether related rows stay attached when a goal ends." }),
);

/**
 * Decoded type of {@link GoalRelationshipDisposition}.
 *
 * @see {@link GoalRelationshipDisposition} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type GoalRelationshipDisposition = typeof GoalRelationshipDisposition.Type;

/**
 * Kind of progress event.
 *
 * **Example** (Decode a milestone)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GoalProgressEventKind } from "@beep/scratchpad/beep/Goal"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(GoalProgressEventKind)("milestone"))) // "milestone"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalProgressEventKind = LiteralKit(["evidence", "metric_update", "milestone", "status_change"]).pipe(
  $I.annoteSchema("GoalProgressEventKind", { description: "Kind of goal progress event." }),
);

/**
 * Decoded type of {@link GoalProgressEventKind}.
 *
 * @see {@link GoalProgressEventKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type GoalProgressEventKind = typeof GoalProgressEventKind.Type;

/**
 * Goal write was rejected.
 *
 * **Example** (Build a focused-create error)
 *
 * ```ts
 * import { GoalContractError } from "@beep/scratchpad/beep/Goal"
 *
 * const error = GoalContractError.make({ message: "create the goal first, then focus it explicitly" })
 * console.log(error.message) // "create the goal first, then focus it explicitly"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GoalContractError extends S.TaggedError<GoalContractError>()(
  "GoalContractError",
  { message: S.String },
  $I.annoteError<GoalContractError>("GoalContractError", {
    description: "A goal create, update, or lifecycle rule was rejected.",
  }),
) {}

/**
 * Encoded shape of {@link GoalContractError}.
 *
 * @see {@link GoalContractError} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalContractError {
  export type Encoded = S.Codec.Encoded<typeof GoalContractError>;
}

const optionalFinite = (column: string) => S.Finite.pipe(optionalNull, pg.doublePrecision(), pg.columnName(column));

/**
 * Current and target values for a goal.
 *
 * **Details**
 *
 * `min` must not exceed `max` when both are present. {@link validateMetricBounds}
 * is that rule. Unit is at most 64 characters.
 *
 * **Example** (Decode a scale metric)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GoalMetricWire } from "@beep/scratchpad/beep/Goal"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(GoalMetricWire)({ type: "scale", current: 1, target: 5, min: null, max: null, unit: null }),
 * )
 * console.log(decoded.target) // 5
 * console.log(O.isNone(decoded.unit)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalMetric extends Model<GoalMetric>("GoalMetric")(
  {
    type: GoalType.pipe(pg.text(), pg.columnName("type")),
    current: S.Finite.pipe(pg.doublePrecision(), pg.columnName("current")),
    target: S.Finite.pipe(pg.doublePrecision(), pg.columnName("target")),
    min: optionalFinite("min"),
    max: optionalFinite("max"),
    unit: optionalBoundedText("unit", { maxLength: 64 }),
  },
  $I.annote("GoalMetric", { description: "Goal metric. Min must not exceed max when both are set." }),
  (columns: { readonly min: ExtraConfigColumn; readonly max: ExtraConfigColumn; readonly unit: ExtraConfigColumn }) => [
    Table.check("goal_metric_bounds")(
      sql<boolean>`${columns.min} is null or ${columns.max} is null or ${columns.min} <= ${columns.max}`,
    ),
    textBoundsCheck("unit", { maxLength: 64 })(columns.unit),
  ],
) {}

/**
 * Encoded shape of {@link GoalMetric}.
 *
 * @see {@link GoalMetric} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalMetric {
  export type Encoded = S.Codec.Encoded<typeof GoalMetric>;
}

/**
 * Wire codec for a goal metric; identical to {@link GoalMetric} because every metric key is already one word.
 *
 * **Example** (Decode a numeric metric)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GoalMetricWire } from "@beep/scratchpad/beep/Goal"
 *
 * const metric = S.decodeUnknownSync(GoalMetricWire)({ type: "numeric", current: 2, target: 10, unit: "km" })
 * console.log(metric.target) // 10
 * console.log(O.getOrNull(metric.unit)) // "km"
 * ```
 *
 * @see {@link GoalMetric} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalMetricWire = GoalMetric;

/**
 * Rejects a metric whose min is greater than its max.
 *
 * **Example** (Reject an inverted range)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { GoalMetric, validateMetricBounds } from "@beep/scratchpad/beep/Goal"
 *
 * const metric = GoalMetric.make({ type: "scale", current: 0, target: 1, min: O.some(4), max: O.some(1) })
 * const failed = Effect.runSyncExit(validateMetricBounds(metric))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const validateMetricBounds = Effect.fn("GoalMetric.validateBounds")(function* (metric: GoalMetric) {
  if (O.isSome(metric.min) && O.isSome(metric.max) && metric.min.value > metric.max.value) {
    return yield* GoalContractError.make({ message: "metric min must not exceed max" });
  }
  return metric;
});

/**
 * Promotes a released `description` field onto `desired_outcome` when that field is missing or null.
 *
 * **Example** (Fill desired outcome from description)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { normalizeLegacyDescription } from "@beep/scratchpad/beep/Goal"
 *
 * const prepared = S.decodeUnknownSync(S.Record(S.String, S.Unknown))(
 *   normalizeLegacyDescription({ title: "Run", description: "5k" }),
 * )
 * console.log(prepared.desired_outcome) // "5k"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const normalizeLegacyDescription = (value: unknown): unknown => {
  const record = decodeUnknownOptionStringUnknownRecord(value);
  if (O.isNone(record) || !R.has(record.value, "description")) return value;
  const description = record.value.description;
  const without = R.remove(record.value, "description");
  const desired = R.get(without, "desired_outcome");
  if (O.isNone(desired) || desired.value === null) return R.set("desired_outcome", description)(without);
  return without;
};

/**
 * Rewrites released desktop source strings.
 *
 * **Details**
 *
 * `ai` becomes `ai_suggested`. The three onboarding strings become `user`.
 * Non-strings pass through. Other strings stay unchanged for the enum check.
 *
 * **Example** (Rewrite ai)
 *
 * ```ts
 * import { normalizeLegacySource } from "@beep/scratchpad/beep/Goal"
 *
 * console.log(normalizeLegacySource("ai")) // "ai_suggested"
 * console.log(normalizeLegacySource("onboarding_typed")) // "user"
 * console.log(normalizeLegacySource(1)) // 1
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const normalizeLegacySource = (value: unknown): unknown => {
  if (!P.isString(value)) return value;
  if (value === "ai") return "ai_suggested";
  if (value === "onboarding_step_flow" || value === "onboarding_typed" || value === "onboarding_selected") return "user";
  return value;
};

const userSource = "user";
const backgroundStatus = "background";
const scaleType = "scale";

const rewriteSource = (value: string): string => {
  const rewritten = normalizeLegacySource(value);
  return P.isString(rewritten) ? rewritten : value;
};

const knownSource = (value: string): O.Option<GoalSource> => {
  const rewritten = rewriteSource(value);
  if (rewritten === "user" || rewritten === "ai_suggested" || rewritten === "imported") return O.some(rewritten);
  return O.none();
};

const legacySource = S.String.pipe(
  S.decodeTo(GoalSource, {
    decode: SchemaGetter.transformEffect((value: string, options) => {
      const source = knownSource(value);
      if (O.isNone(source)) {
        return Effect.fail(new SchemaIssue.InvalidValue({ message: "invalid goal source" }, value, options));
      }
      return Effect.succeed(source.value);
    }),
    encode: SchemaGetter.transform((value: GoalSource) => value),
  }),
);

const noCriteria = (): ReadonlyArray<string> => [];

/**
 * Canonical create body, including released request fields.
 *
 * **Details**
 *
 * `title` is 1 to 500 characters before trim. {@link normalizeLegacyMetric}
 * strips it, rejects blank and `focused`, fills `desired_outcome` from the
 * title, drops blank success criteria, and synthesizes a metric only when
 * `metric` is missing and `target_value` or `goal_type` is present.
 * `current_value` alone does not synthesize a metric.
 *
 * **Gotchas**
 *
 * Decode through {@link decodeGoalCreate}. A straight schema decode does not
 * strip, fill, or reject focused. Unknown keys, including a leftover
 * `description`, fail that decoder after promotion.
 *
 * **Example** (Construct a background goal)
 *
 * ```ts
 * import { GoalCreate } from "@beep/scratchpad/beep/Goal"
 *
 * const created = GoalCreate.make({ title: "Run" })
 * console.log(created.status) // "background"
 * console.log(created.source) // "user"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCreate extends Model<GoalCreate>("GoalCreate")(
  {
    title: boundedText("title", { minLength: 1, maxLength: 500 }),
    desiredOutcome: optionalBoundedText("desired_outcome", { maxLength: 2000 }),
    whyItMatters: optionalBoundedText("why_it_matters", { maxLength: 2000 }),
    successCriteria: S.Array(S.String)
      .check(S.isMaxLength(20))
      .pipe(S.withConstructorDefault(Effect.sync(noCriteria)), pg.jsonb(), pg.columnName("success_criteria")),
    horizonAt: optionalTimestamp("horizon_at"),
    status: GoalStatus.pipe(S.withConstructorDefault(Effect.succeed(backgroundStatus)), pg.text(), pg.columnName("status")),
    metric: GoalMetric.pipe(optionalNull, pg.jsonb(), pg.columnName("metric")),
    source: legacySource.pipe(S.withConstructorDefault(Effect.succeed(userSource)), pg.text(), pg.columnName("source")),
    goalType: GoalType.pipe(optionalNull, pg.text(), pg.columnName("goal_type")),
    targetValue: optionalFinite("target_value"),
    currentValue: optionalFinite("current_value"),
    minValue: optionalFinite("min_value"),
    maxValue: optionalFinite("max_value"),
    unit: optionalBoundedText("unit", { maxLength: 64 }),
  },
  $I.annote("GoalCreate", {
    description: "Canonical goal create shape with released description, source, and metric aliases.",
  }),
  (columns: {
    readonly title: ExtraConfigColumn;
    readonly desiredOutcome: ExtraConfigColumn;
    readonly whyItMatters: ExtraConfigColumn;
    readonly unit: ExtraConfigColumn;
    readonly successCriteria: ExtraConfigColumn;
  }) => [
    textBoundsCheck("title", { minLength: 1, maxLength: 500 })(columns.title),
    textBoundsCheck("desired_outcome", { maxLength: 2000 })(columns.desiredOutcome),
    textBoundsCheck("why_it_matters", { maxLength: 2000 })(columns.whyItMatters),
    textBoundsCheck("unit", { maxLength: 64 })(columns.unit),
    jsonbArrayLengthCheck("success_criteria", { maximum: 20 })(columns.successCriteria),
  ],
) {}

/**
 * Encoded shape of {@link GoalCreate}.
 *
 * @see {@link GoalCreate} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalCreate {
  export type Encoded = S.Codec.Encoded<typeof GoalCreate>;
}

/**
 * Wire codec for a goal create body that maps camelCase fields to the released snake_case keys.
 *
 * **Details**
 *
 * This codec only renames keys. Request bodies go through {@link decodeGoalCreate}, which also trims, fills, and rejects.
 *
 * **Example** (Encode snake_case keys)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GoalCreate, GoalCreateWire } from "@beep/scratchpad/beep/Goal"
 *
 * const encoded = S.encodeSync(GoalCreateWire)(GoalCreate.make({ title: "Run a 5k", targetValue: O.some(5) }))
 * console.log(encoded.target_value) // 5
 * console.log(encoded.success_criteria) // []
 * ```
 *
 * @see {@link GoalCreate} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalCreateWire = GoalCreate.pipe(
  S.encodeKeys({
    desiredOutcome: "desired_outcome",
    whyItMatters: "why_it_matters",
    successCriteria: "success_criteria",
    horizonAt: "horizon_at",
    goalType: "goal_type",
    targetValue: "target_value",
    currentValue: "current_value",
    minValue: "min_value",
    maxValue: "max_value",
  }),
);

const decodeGoalCreateWire = S.decodeUnknownEffect(GoalCreateWire, { onExcessProperty: "error" });

const trimmedCriteria = (values: ReadonlyArray<string>): ReadonlyArray<string> => {
  let kept = A.empty<string>();
  for (const value of values) {
    const trimmed = Str.trim(value);
    if (!Str.isEmpty(trimmed)) kept = A.append(kept, trimmed);
  }
  return kept;
};

/**
 * Strips the title, rejects focused creates, and synthesizes a legacy metric.
 *
 * **Example** (Fill the outcome from the title)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { GoalCreate, normalizeLegacyMetric } from "@beep/scratchpad/beep/Goal"
 *
 * const created = Effect.runSync(normalizeLegacyMetric(GoalCreate.make({ title: "  Run  " })))
 * console.log(created.title) // "Run"
 * console.log(O.getOrElse(created.desiredOutcome, () => "")) // "Run"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const normalizeLegacyMetric = Effect.fn("GoalCreate.normalizeLegacyMetric")(function* (create: GoalCreate) {
  const title = Str.trim(create.title);
  if (Str.isEmpty(title)) return yield* GoalContractError.make({ message: "title cannot be blank" });
  const desiredOutcome = O.orElse(create.desiredOutcome, () => O.some(title));
  if (create.status === "focused") {
    return yield* GoalContractError.make({ message: "create the goal first, then focus it explicitly" });
  }
  const successCriteria = trimmedCriteria(create.successCriteria);
  const synthesize = O.isNone(create.metric) && (O.isSome(create.targetValue) || O.isSome(create.goalType));
  const metric = synthesize
    ? O.some(
        yield* validateMetricBounds(
          GoalMetric.make({
            type: yield* decodeGoalType(O.getOrElse(create.goalType, () => scaleType)),
            current: O.getOrElse(create.currentValue, () => 0),
            target: O.getOrElse(create.targetValue, () => 0),
            min: create.minValue,
            max: create.maxValue,
            unit: create.unit,
          }),
        ),
      )
    : create.metric;
  if (O.isSome(metric)) yield* validateMetricBounds(metric.value);
  return GoalCreate.make({
    ...create,
    title,
    desiredOutcome,
    successCriteria,
    metric,
  });
});

/**
 * Decodes a create body, promotes `description`, and normalizes the metric.
 *
 * **Example** (Rewrite a legacy source)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeGoalCreate } from "@beep/scratchpad/beep/Goal"
 *
 * const created = Effect.runSync(
 *   decodeGoalCreate({ title: "Run", source: "ai", status: "background", success_criteria: [] }),
 * )
 * console.log(created.source) // "ai_suggested"
 * ```
 *
 * @see {@link normalizeLegacyDescription} and {@link normalizeLegacyMetric}.
 * @category decoding
 * @since 0.0.0
 */
export const decodeGoalCreate = Effect.fn("GoalCreate.decode")(function* (input: unknown) {
  const decoded = yield* decodeGoalCreateWire(
    normalizeLegacyDescription(input),
  );
  return yield* normalizeLegacyMetric(decoded);
});

/**
 * Partial goal update. Null on a required compatibility field is rejected.
 *
 * **Details**
 *
 * {@link protectRequiredFields} tells omission from explicit null for `title`,
 * `desired_outcome`, `success_criteria`, `target_value`, and `current_value`.
 * The class itself stores those as `Option`, so a later encode of `None` is
 * null and is not a round trip of an omission. `clear_metric` is the removal
 * signal. This update does not synthesize a metric and does not strip success
 * criteria.
 *
 * **Gotchas**
 *
 * Use {@link decodeGoalUpdate}. Schema decode alone accepts explicit null as
 * `None`, which the Python validator rejects.
 *
 * **Example** (Construct a clear-metric update)
 *
 * ```ts
 * import { GoalUpdate } from "@beep/scratchpad/beep/Goal"
 *
 * console.log(GoalUpdate.make({ clearMetric: true }).clearMetric) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalUpdate extends Model<GoalUpdate>("GoalUpdate")(
  {
    title: optionalBoundedText("title", { minLength: 1, maxLength: 500 }),
    desiredOutcome: optionalBoundedText("desired_outcome", { maxLength: 2000 }),
    whyItMatters: optionalBoundedText("why_it_matters", { maxLength: 2000 }),
    successCriteria: S.Array(S.String).check(S.isMaxLength(20)).pipe(optionalNull, pg.jsonb(), pg.columnName("success_criteria")),
    horizonAt: optionalTimestamp("horizon_at"),
    metric: GoalMetric.pipe(optionalNull, pg.jsonb(), pg.columnName("metric")),
    clearMetric: boolDefault("clear_metric", false),
    targetValue: optionalFinite("target_value"),
    currentValue: optionalFinite("current_value"),
    minValue: optionalFinite("min_value"),
    maxValue: optionalFinite("max_value"),
    unit: optionalBoundedText("unit", { maxLength: 64 }),
  },
  $I.annote("GoalUpdate", {
    description: "Goal patch. Explicit null on title, outcome, criteria, or metric values is rejected by the decoder.",
  }),
  (columns: {
    readonly title: ExtraConfigColumn;
    readonly desiredOutcome: ExtraConfigColumn;
    readonly whyItMatters: ExtraConfigColumn;
    readonly unit: ExtraConfigColumn;
    readonly successCriteria: ExtraConfigColumn;
  }) => [
    textBoundsCheck("title", { minLength: 1, maxLength: 500 })(columns.title),
    textBoundsCheck("desired_outcome", { maxLength: 2000 })(columns.desiredOutcome),
    textBoundsCheck("why_it_matters", { maxLength: 2000 })(columns.whyItMatters),
    textBoundsCheck("unit", { maxLength: 64 })(columns.unit),
    jsonbArrayLengthCheck("success_criteria", { maximum: 20 })(columns.successCriteria),
  ],
) {}

/**
 * Encoded shape of {@link GoalUpdate}.
 *
 * @see {@link GoalUpdate} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalUpdate {
  export type Encoded = S.Codec.Encoded<typeof GoalUpdate>;
}

/**
 * Wire codec for a goal patch that maps camelCase fields to the released snake_case keys.
 *
 * **Details**
 *
 * This codec only renames keys. Request bodies go through {@link decodeGoalUpdate}, which rejects explicit null on protected fields.
 *
 * **Example** (Encode a clear-metric patch)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GoalUpdate, GoalUpdateWire } from "@beep/scratchpad/beep/Goal"
 *
 * const encoded = S.encodeSync(GoalUpdateWire)(GoalUpdate.make({ clearMetric: true }))
 * console.log(encoded.clear_metric) // true
 * ```
 *
 * @see {@link GoalUpdate} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalUpdateWire = GoalUpdate.pipe(
  S.encodeKeys({
    desiredOutcome: "desired_outcome",
    whyItMatters: "why_it_matters",
    successCriteria: "success_criteria",
    horizonAt: "horizon_at",
    clearMetric: "clear_metric",
    targetValue: "target_value",
    currentValue: "current_value",
    minValue: "min_value",
    maxValue: "max_value",
  }),
);

const decodeGoalUpdateWire = S.decodeUnknownEffect(GoalUpdateWire, { onExcessProperty: "error" });

const nullGuards: ReadonlyArray<readonly [string, string]> = [
  ["title", "title cannot be null"],
  ["desired_outcome", "desired_outcome cannot be null"],
  ["success_criteria", "success_criteria cannot be null"],
  ["target_value", "target_value cannot be null; use clear_metric to remove the metric"],
  ["current_value", "current_value cannot be null; use clear_metric to remove the metric"],
];

/**
 * Rejects explicit nulls and strips title and desired outcome.
 *
 * **Example** (Reject a null title)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { GoalUpdate, protectRequiredFields } from "@beep/scratchpad/beep/Goal"
 *
 * const failed = Effect.runSyncExit(protectRequiredFields({ title: null }, GoalUpdate.make({})))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const protectRequiredFields = Effect.fn("GoalUpdate.protectRequiredFields")(function* (
  raw: unknown,
  update: GoalUpdate,
) {
  const record = decodeUnknownOptionStringUnknownRecord(raw);
  if (O.isSome(record)) {
    for (const [key, message] of nullGuards) {
      if (R.has(record.value, key) && record.value[key] === null) {
        return yield* GoalContractError.make({ message });
      }
    }
  }
  const title = O.map(update.title, Str.trim);
  if (O.isSome(title) && Str.isEmpty(title.value)) {
    return yield* GoalContractError.make({ message: "title cannot be blank" });
  }
  const desiredOutcome = O.map(update.desiredOutcome, Str.trim);
  if (O.isSome(desiredOutcome) && Str.isEmpty(desiredOutcome.value)) {
    return yield* GoalContractError.make({ message: "desired_outcome cannot be blank" });
  }
  return GoalUpdate.make({ ...update, title, desiredOutcome });
});

/**
 * Decodes an update and applies {@link protectRequiredFields}.
 *
 * **Example** (Allow an omitted title)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { decodeGoalUpdate } from "@beep/scratchpad/beep/Goal"
 *
 * const updated = Effect.runSync(decodeGoalUpdate({ clear_metric: false }))
 * console.log(O.isNone(updated.title)) // true
 * ```
 *
 * @see {@link protectRequiredFields} for explicit null.
 * @category decoding
 * @since 0.0.0
 */
export const decodeGoalUpdate = Effect.fn("GoalUpdate.decode")(function* (input: unknown) {
  const decoded = yield* decodeGoalUpdateWire(input);
  return yield* protectRequiredFields(input, decoded);
});

/**
 * Request to focus a goal.
 *
 * **Details**
 *
 * `focus_rank` is null or 0 through 4. `replacement_goal_id` is an optional
 * stable id.
 *
 * **Example** (Decode rank 0)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GoalFocusRequestWire } from "@beep/scratchpad/beep/Goal"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(GoalFocusRequestWire)({ focus_rank: 0, replacement_goal_id: null }))
 * console.log(O.getOrElse(decoded.focusRank, () => -1)) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalFocusRequest extends Model<GoalFocusRequest>("GoalFocusRequest")(
  {
    replacementGoalId: optionalStableId("replacement_goal_id"),
    focusRank: S.Int.check(S.isBetween({ minimum: 0, maximum: 4 })).pipe(
      optionalNull,
      pg.integer(),
      pg.columnName("focus_rank"),
    ),
  },
  $I.annote("GoalFocusRequest", { description: "Focus a goal at rank 0 through 4, optionally replacing another goal." }),
  (columns: { readonly replacementGoalId: ExtraConfigColumn; readonly focusRank: ExtraConfigColumn }) => [
    betweenCheck("focus_rank", 0, 4)(columns.focusRank),
  ],
) {}

/**
 * Encoded shape of {@link GoalFocusRequest}.
 *
 * @see {@link GoalFocusRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalFocusRequest {
  export type Encoded = S.Codec.Encoded<typeof GoalFocusRequest>;
}

/**
 * Wire codec for a focus request that maps `focusRank` and `replacementGoalId` to snake_case keys.
 *
 * **Example** (Encode a rank-two focus)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GoalFocusRequest, GoalFocusRequestWire } from "@beep/scratchpad/beep/Goal"
 *
 * const encoded = S.encodeSync(GoalFocusRequestWire)(GoalFocusRequest.make({ focusRank: O.some(2) }))
 * console.log(encoded.focus_rank) // 2
 * console.log(encoded.replacement_goal_id) // null
 * ```
 *
 * @see {@link GoalFocusRequest} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalFocusRequestWire = GoalFocusRequest.pipe(
  S.encodeKeys({ replacementGoalId: "replacement_goal_id", focusRank: "focus_rank" }),
);

/**
 * Pause or end a goal.
 *
 * **Details**
 *
 * {@link validateTerminalStatus} accepts only paused, achieved, and abandoned.
 * `relationship_disposition` is required for every accepted status.
 *
 * **Example** (Decode an abandon)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeGoalLifecycleRequest } from "@beep/scratchpad/beep/Goal"
 *
 * const decoded = Effect.runSync(decodeGoalLifecycleRequest({ status: "abandoned", relationship_disposition: "retain" }))
 * console.log(decoded.status) // "abandoned"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalLifecycleRequest extends Model<GoalLifecycleRequest>("GoalLifecycleRequest")(
  {
    status: GoalStatus.pipe(pg.text(), pg.columnName("status")),
    relationshipDisposition: GoalRelationshipDisposition.pipe(pg.text(), pg.columnName("relationship_disposition")),
  },
  $I.annote("GoalLifecycleRequest", {
    description: "Pause or end a goal. Focused and background are not transitions.",
  }),
) {}

/**
 * Encoded shape of {@link GoalLifecycleRequest}.
 *
 * @see {@link GoalLifecycleRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalLifecycleRequest {
  export type Encoded = S.Codec.Encoded<typeof GoalLifecycleRequest>;
}

/**
 * Wire codec for a pause or end request that maps `relationshipDisposition` to `relationship_disposition`.
 *
 * **Details**
 *
 * This codec accepts any goal status. {@link decodeGoalLifecycleRequest} adds the terminal-status rule.
 *
 * **Example** (Encode a pause)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GoalLifecycleRequest, GoalLifecycleRequestWire } from "@beep/scratchpad/beep/Goal"
 *
 * const encoded = S.encodeSync(GoalLifecycleRequestWire)(
 *   GoalLifecycleRequest.make({ status: "paused", relationshipDisposition: "retain" }),
 * )
 * console.log(encoded) // { status: "paused", relationship_disposition: "retain" }
 * ```
 *
 * @see {@link GoalLifecycleRequest} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalLifecycleRequestWire = GoalLifecycleRequest.pipe(
  S.encodeKeys({ relationshipDisposition: "relationship_disposition" }),
);

const decodeGoalLifecycleRequestWire = S.decodeUnknownEffect(GoalLifecycleRequestWire, { onExcessProperty: "error" });

/**
 * Rejects a lifecycle status that does not pause or end the goal.
 *
 * **Example** (Reject focused)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { GoalLifecycleRequest, validateTerminalStatus } from "@beep/scratchpad/beep/Goal"
 *
 * const request = GoalLifecycleRequest.make({ status: "focused", relationshipDisposition: "retain" })
 * const failed = Effect.runSyncExit(validateTerminalStatus(request))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const validateTerminalStatus = Effect.fn("GoalLifecycleRequest.validateTerminalStatus")(function* (
  request: GoalLifecycleRequest,
) {
  if (request.status !== "paused" && request.status !== "achieved" && request.status !== "abandoned") {
    return yield* GoalContractError.make({ message: "goal lifecycle transition must pause or end the goal" });
  }
  return request;
});

/**
 * Decodes a lifecycle request and rejects non-terminal statuses.
 *
 * **Example** (Accept paused)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeGoalLifecycleRequest } from "@beep/scratchpad/beep/Goal"
 *
 * const decoded = Effect.runSync(decodeGoalLifecycleRequest({ status: "paused", relationship_disposition: "detach" }))
 * console.log(decoded.relationshipDisposition) // "detach"
 * ```
 *
 * @see {@link validateTerminalStatus} for the status rule.
 * @category decoding
 * @since 0.0.0
 */
export const decodeGoalLifecycleRequest = Effect.fn("GoalLifecycleRequest.decode")(function* (input: unknown) {
  const decoded = yield* decodeGoalLifecycleRequestWire(input);
  return yield* validateTerminalStatus(decoded);
});

const EvidenceRefWire = EvidenceRef.pipe(
  S.encodeKeys({
    deviceId: "device_id",
    excerptHash: "excerpt_hash",
    transcriptSegmentIds: "transcript_segment_ids",
    startSeconds: "start_seconds",
    endSeconds: "end_seconds",
  }),
);

const noEvidence = (): ReadonlyArray<EvidenceRef> => [];

const evidenceList = (column: string) =>
  S.Array(EvidenceRefWire)
    .check(S.isMaxLength(50))
    .pipe(S.withConstructorDefault(Effect.sync(noEvidence)), pg.jsonb(), pg.columnName(column));

/**
 * Progress event to append.
 *
 * **Details**
 *
 * Summary is 1 to 1000 characters. Evidence refs are at most 50 and use the
 * action-item evidence shape.
 *
 * **Example** (Construct an empty evidence list)
 *
 * ```ts
 * import { GoalProgressEventCreate } from "@beep/scratchpad/beep/Goal"
 *
 * const event = GoalProgressEventCreate.make({ kind: "milestone", summary: "Started" })
 * console.log(event.evidenceRefs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalProgressEventCreate extends Model<GoalProgressEventCreate>("GoalProgressEventCreate")(
  {
    kind: GoalProgressEventKind.pipe(pg.text(), pg.columnName("kind")),
    summary: boundedText("summary", { minLength: 1, maxLength: 1000 }),
    evidenceRefs: evidenceList("evidence_refs"),
    metric: GoalMetric.pipe(optionalNull, pg.jsonb(), pg.columnName("metric")),
  },
  $I.annote("GoalProgressEventCreate", { description: "Progress event to append. Evidence refs are capped at 50." }),
  (columns: { readonly summary: ExtraConfigColumn; readonly evidenceRefs: ExtraConfigColumn }) => [
    textBoundsCheck("summary", { minLength: 1, maxLength: 1000 })(columns.summary),
    jsonbArrayLengthCheck("evidence_refs", { maximum: 50 })(columns.evidenceRefs),
  ],
) {}

/**
 * Encoded shape of {@link GoalProgressEventCreate}.
 *
 * @see {@link GoalProgressEventCreate} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalProgressEventCreate {
  export type Encoded = S.Codec.Encoded<typeof GoalProgressEventCreate>;
}

/**
 * Wire codec for a progress event to append, mapping `evidenceRefs` to `evidence_refs`.
 *
 * **Example** (Encode a milestone)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GoalProgressEventCreate, GoalProgressEventCreateWire } from "@beep/scratchpad/beep/Goal"
 *
 * const encoded = S.encodeSync(GoalProgressEventCreateWire)(
 *   GoalProgressEventCreate.make({ kind: "milestone", summary: "Ran the first 2k" }),
 * )
 * console.log(encoded.evidence_refs) // []
 * console.log(encoded.summary) // "Ran the first 2k"
 * ```
 *
 * @see {@link GoalProgressEventCreate} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalProgressEventCreateWire = GoalProgressEventCreate.pipe(
  S.encodeKeys({ evidenceRefs: "evidence_refs" }),
);

/**
 * Stored progress event.
 *
 * **Details**
 *
 * `sequence` is at least 1. Ids are stable ids.
 *
 * **Example** (Decode sequence 1)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GoalProgressEventWire } from "@beep/scratchpad/beep/Goal"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(GoalProgressEventWire)({
 *     event_id: "event-1",
 *     goal_id: "goal-1",
 *     sequence: 1,
 *     kind: "evidence",
 *     summary: "Noted",
 *     evidence_refs: [],
 *     created_at: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(decoded.sequence) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalProgressEvent extends Model<GoalProgressEvent>("GoalProgressEvent")(
  {
    eventId: stableId("event_id"),
    goalId: stableId("goal_id"),
    sequence: S.Int.check(S.isGreaterThanOrEqualTo(1)).pipe(pg.integer(), pg.columnName("sequence")),
    kind: GoalProgressEventKind.pipe(pg.text(), pg.columnName("kind")),
    summary: boundedText("summary", { minLength: 1, maxLength: 1000 }),
    evidenceRefs: evidenceList("evidence_refs"),
    metric: GoalMetric.pipe(optionalNull, pg.jsonb(), pg.columnName("metric")),
    createdAt: timestamp("created_at"),
  },
  $I.annote("GoalProgressEvent", { description: "Stored goal progress event. Sequence starts at 1." }),
  (columns: {
    readonly sequence: ExtraConfigColumn;
    readonly summary: ExtraConfigColumn;
    readonly evidenceRefs: ExtraConfigColumn;
  }) => [
    atLeastCheck("sequence", 1)(columns.sequence),
    textBoundsCheck("summary", { minLength: 1, maxLength: 1000 })(columns.summary),
    jsonbArrayLengthCheck("evidence_refs", { maximum: 50 })(columns.evidenceRefs),
  ],
) {}

/**
 * Encoded shape of {@link GoalProgressEvent}.
 *
 * @see {@link GoalProgressEvent} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalProgressEvent {
  export type Encoded = S.Codec.Encoded<typeof GoalProgressEvent>;
}

/**
 * Wire codec for a stored progress event with snake_case id, evidence, and timestamp keys.
 *
 * **Example** (Round-trip a stored event)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GoalProgressEventWire } from "@beep/scratchpad/beep/Goal"
 *
 * const event = S.decodeUnknownSync(GoalProgressEventWire)({
 *   event_id: "event-1",
 *   goal_id: "goal-1",
 *   sequence: 2,
 *   kind: "metric_update",
 *   summary: "Logged 3 km",
 *   evidence_refs: [],
 *   created_at: "2020-01-02T03:04:05.000Z",
 * })
 * const encoded = S.encodeSync(GoalProgressEventWire)(event)
 * console.log(event.goalId) // "goal-1"
 * console.log(encoded.goal_id) // "goal-1"
 * ```
 *
 * @see {@link GoalProgressEvent} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalProgressEventWire = GoalProgressEvent.pipe(
  S.encodeKeys({
    eventId: "event_id",
    goalId: "goal_id",
    evidenceRefs: "evidence_refs",
    createdAt: "created_at",
  }),
);

const responseCriteria = (): ReadonlyArray<string> => [];

/**
 * Goal returned to released clients.
 *
 * **Details**
 *
 * Canonical response plus non-null aliases required by released clients.
 * `goal_type` is an open string, not {@link GoalType}. `target_value`,
 * `current_value`, `min_value`, and `max_value` are required finite numbers
 * even when `metric` is null. `desired_outcome` is required here.
 *
 * **Gotchas**
 *
 * Non-finite alias numbers are rejected so generation stays finite. The Python
 * field does not set `allow_inf_nan`.
 *
 * **Example** (Decode a required alias)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GoalResponseWire } from "@beep/scratchpad/beep/Goal"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(GoalResponseWire)({
 *     id: "goal-1",
 *     goal_id: "goal-1",
 *     title: "Run",
 *     desired_outcome: "5k",
 *     success_criteria: [],
 *     status: "background",
 *     source: "user",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     updated_at: "2020-01-02T03:04:05.000Z",
 *     latest_progress_sequence: 0,
 *     goal_type: "scale",
 *     target_value: 5,
 *     current_value: 0,
 *     min_value: 0,
 *     max_value: 10,
 *     is_active: true,
 *   }),
 * )
 * console.log(decoded.targetValue) // 5
 * console.log(decoded.goalType) // "scale"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalResponse extends Model<GoalResponse>("GoalResponse")(
  {
    id: stableId("id"),
    goalId: stableId("goal_id"),
    title: text("title"),
    desiredOutcome: text("desired_outcome"),
    whyItMatters: optionalText("why_it_matters"),
    successCriteria: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.sync(responseCriteria)),
      pg.jsonb(),
      pg.columnName("success_criteria"),
    ),
    horizonAt: optionalTimestamp("horizon_at"),
    status: GoalStatus.pipe(pg.text(), pg.columnName("status")),
    focusRank: S.Int.pipe(optionalNull, pg.integer(), pg.columnName("focus_rank")),
    metric: GoalMetric.pipe(optionalNull, pg.jsonb(), pg.columnName("metric")),
    source: GoalSource.pipe(pg.text(), pg.columnName("source")),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    endedAt: optionalTimestamp("ended_at"),
    latestProgressSequence: intDefault("latest_progress_sequence", 0),
    goalType: text("goal_type"),
    targetValue: S.Finite.pipe(pg.doublePrecision(), pg.columnName("target_value")),
    currentValue: S.Finite.pipe(pg.doublePrecision(), pg.columnName("current_value")),
    minValue: S.Finite.pipe(pg.doublePrecision(), pg.columnName("min_value")),
    maxValue: S.Finite.pipe(pg.doublePrecision(), pg.columnName("max_value")),
    unit: optionalText("unit"),
    isActive: S.Boolean.pipe(pg.boolean(), pg.columnName("is_active")),
    advice: optionalText("advice"),
  },
  $I.annote("GoalResponse", {
    description: "Goal response. Workflow row, not a memory. Alias floats stay beside the optional metric.",
  }),
) {}

/**
 * Encoded shape of {@link GoalResponse}.
 *
 * @see {@link GoalResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalResponse {
  export type Encoded = S.Codec.Encoded<typeof GoalResponse>;
}

/**
 * Wire codec for the goal response sent to released clients, with snake_case keys for every multi-word field.
 *
 * **Example** (Round-trip the alias floats)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GoalResponseWire } from "@beep/scratchpad/beep/Goal"
 *
 * const goal = S.decodeUnknownSync(GoalResponseWire)({
 *   id: "goal-1",
 *   goal_id: "goal-1",
 *   title: "Run a 5k",
 *   desired_outcome: "Finish under 30 minutes",
 *   success_criteria: [],
 *   status: "focused",
 *   focus_rank: 0,
 *   source: "user",
 *   created_at: "2020-01-02T03:04:05.000Z",
 *   updated_at: "2020-01-02T03:04:05.000Z",
 *   latest_progress_sequence: 1,
 *   goal_type: "numeric",
 *   target_value: 5,
 *   current_value: 2,
 *   min_value: 0,
 *   max_value: 5,
 *   is_active: true,
 * })
 * const encoded = S.encodeSync(GoalResponseWire)(goal)
 * console.log(encoded.current_value) // 2
 * console.log(encoded.focus_rank) // 0
 * ```
 *
 * @see {@link GoalResponse} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalResponseWire = GoalResponse.pipe(
  S.encodeKeys({
    goalId: "goal_id",
    desiredOutcome: "desired_outcome",
    whyItMatters: "why_it_matters",
    successCriteria: "success_criteria",
    horizonAt: "horizon_at",
    focusRank: "focus_rank",
    createdAt: "created_at",
    updatedAt: "updated_at",
    endedAt: "ended_at",
    latestProgressSequence: "latest_progress_sequence",
    goalType: "goal_type",
    targetValue: "target_value",
    currentValue: "current_value",
    minValue: "min_value",
    maxValue: "max_value",
    isActive: "is_active",
  }),
);

/**
 * One history point. `date` is a string, not a datetime.
 *
 * **Example** (Decode a history point)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GoalHistoryEntryResponseWire } from "@beep/scratchpad/beep/Goal"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(GoalHistoryEntryResponseWire)({
 *     date: "2020-01-02",
 *     value: 1,
 *     recorded_at: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(decoded.date) // "2020-01-02"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalHistoryEntryResponse extends Model<GoalHistoryEntryResponse>("GoalHistoryEntryResponse")(
  {
    date: text("date"),
    value: S.Finite.pipe(pg.doublePrecision(), pg.columnName("value")),
    recordedAt: timestamp("recorded_at"),
  },
  $I.annote("GoalHistoryEntryResponse", { description: "One goal history point. date is a string." }),
) {}

/**
 * Encoded shape of {@link GoalHistoryEntryResponse}.
 *
 * @see {@link GoalHistoryEntryResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalHistoryEntryResponse {
  export type Encoded = S.Codec.Encoded<typeof GoalHistoryEntryResponse>;
}

/**
 * Wire codec for one goal history point, mapping `recordedAt` to `recorded_at`.
 *
 * **Example** (Round-trip a history point)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GoalHistoryEntryResponseWire } from "@beep/scratchpad/beep/Goal"
 *
 * const entry = S.decodeUnknownSync(GoalHistoryEntryResponseWire)({
 *   date: "2020-01-02",
 *   value: 3,
 *   recorded_at: "2020-01-02T03:04:05.000Z",
 * })
 * const encoded = S.encodeSync(GoalHistoryEntryResponseWire)(entry)
 * console.log(encoded.value) // 3
 * console.log("recorded_at" in encoded) // true
 * ```
 *
 * @see {@link GoalHistoryEntryResponse} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalHistoryEntryResponseWire = GoalHistoryEntryResponse.pipe(S.encodeKeys({ recordedAt: "recorded_at" }));

/**
 * Result of deleting a goal.
 *
 * **Example** (Decode a deletion)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GoalDeleteResponseWire } from "@beep/scratchpad/beep/Goal"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(GoalDeleteResponseWire)({ success: true, deleted_id: "goal-1" }))
 * console.log(decoded.deletedId) // "goal-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDeleteResponse extends Model<GoalDeleteResponse>("GoalDeleteResponse")(
  {
    success: S.Boolean.pipe(pg.boolean(), pg.columnName("success")),
    deletedId: text("deleted_id"),
  },
  $I.annote("GoalDeleteResponse", { description: "Whether a goal delete succeeded and which id was removed." }),
) {}

/**
 * Encoded shape of {@link GoalDeleteResponse}.
 *
 * @see {@link GoalDeleteResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalDeleteResponse {
  export type Encoded = S.Codec.Encoded<typeof GoalDeleteResponse>;
}

/**
 * Wire codec for a goal delete result, mapping `deletedId` to `deleted_id`.
 *
 * **Example** (Encode a deletion)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GoalDeleteResponse, GoalDeleteResponseWire } from "@beep/scratchpad/beep/Goal"
 *
 * const encoded = S.encodeSync(GoalDeleteResponseWire)(GoalDeleteResponse.make({ success: true, deletedId: "goal-1" }))
 * console.log(encoded) // { success: true, deleted_id: "goal-1" }
 * ```
 *
 * @see {@link GoalDeleteResponse} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalDeleteResponseWire = GoalDeleteResponse.pipe(S.encodeKeys({ deletedId: "deleted_id" }));

/**
 * Suggested goal. Type is an open string. Min and max construct as 0 and 10.
 *
 * **Example** (Construct the numeric defaults)
 *
 * ```ts
 * import { GoalSuggestionResponse } from "@beep/scratchpad/beep/Goal"
 *
 * const suggestion = GoalSuggestionResponse.make({
 *   suggestedTitle: "Run",
 *   suggestedType: "scale",
 *   suggestedTarget: 5,
 *   reasoning: "You mentioned it",
 * })
 * console.log(suggestion.suggestedMin) // 0
 * console.log(suggestion.suggestedMax) // 10
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalSuggestionResponse extends Model<GoalSuggestionResponse>("GoalSuggestionResponse")(
  {
    suggestedTitle: text("suggested_title"),
    suggestedType: text("suggested_type"),
    suggestedTarget: S.Finite.pipe(pg.doublePrecision(), pg.columnName("suggested_target")),
    suggestedMin: finiteDefault("suggested_min", 0),
    suggestedMax: finiteDefault("suggested_max", 10),
    reasoning: text("reasoning"),
  },
  $I.annote("GoalSuggestionResponse", { description: "Suggested goal. suggested_type stays an open string." }),
) {}

/**
 * Encoded shape of {@link GoalSuggestionResponse}.
 *
 * @see {@link GoalSuggestionResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalSuggestionResponse {
  export type Encoded = S.Codec.Encoded<typeof GoalSuggestionResponse>;
}

/**
 * Wire codec for a suggested goal, mapping every `suggested*` field to its snake_case key.
 *
 * **Example** (Encode the default bounds)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GoalSuggestionResponse, GoalSuggestionResponseWire } from "@beep/scratchpad/beep/Goal"
 *
 * const encoded = S.encodeSync(GoalSuggestionResponseWire)(
 *   GoalSuggestionResponse.make({
 *     suggestedTitle: "Run a 5k",
 *     suggestedType: "numeric",
 *     suggestedTarget: 5,
 *     reasoning: "You mentioned training for a race",
 *   }),
 * )
 * console.log(encoded.suggested_min) // 0
 * console.log(encoded.suggested_max) // 10
 * ```
 *
 * @see {@link GoalSuggestionResponse} for the decoded model.
 * @category codecs
 * @since 0.0.0
 */
export const GoalSuggestionResponseWire = GoalSuggestionResponse.pipe(
  S.encodeKeys({
    suggestedTitle: "suggested_title",
    suggestedType: "suggested_type",
    suggestedTarget: "suggested_target",
    suggestedMin: "suggested_min",
    suggestedMax: "suggested_max",
  }),
);

/**
 * Advice string returned beside goals.
 *
 * **Details**
 *
 * This is the goal module's advice response, not the proactive advice model.
 *
 * **Example** (Decode advice)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AdviceResponse } from "@beep/scratchpad/beep/Goal"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(AdviceResponse)({ advice: "Keep going" }))
 * console.log(decoded.advice) // "Keep going"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdviceResponse extends Model<AdviceResponse>("AdviceResponse")(
  {
    advice: text("advice"),
  },
  $I.annote("AdviceResponse", { description: "Advice string returned with a goal. Not the proactive advice model." }),
) {}

/**
 * Encoded shape of {@link AdviceResponse}.
 *
 * @see {@link AdviceResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AdviceResponse {
  export type Encoded = S.Codec.Encoded<typeof AdviceResponse>;
}
