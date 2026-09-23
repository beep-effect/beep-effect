/**
 * Server-owned canonical promotion and graph-admission contracts.
 *
 * **Details**
 *
 * Long-term memory is a state transition, never a create-time option. The
 * promotion planner may propose a compact structured graph plan, but
 * deterministic code binds that plan to the current short-term item revision,
 * content, and evidence before the authoritative apply transaction accepts it.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Rec from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { Model, UtcTimestamp, pg, textBoundsCheck } from "./Kit.ts";
import { MemoryContractError, canonicalJson, deterministicContractId } from "./MemoryContracts.ts";
import { atLeastCheck, jsonColumn, jsonList, jsonbArrayLengthCheck, optionalJsonColumn } from "./Port.ts";

const $I = $ScratchpadId.create("beep/MemoryPromotion");

/**
 * Receipt version written on every admission receipt.
 *
 * **Example** (Read the admission version)
 *
 * ```ts
 * import { PROMOTION_ADMISSION_VERSION } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_ADMISSION_VERSION) // "canonical_memory_promotion_admission.v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_ADMISSION_VERSION = "canonical_memory_promotion_admission.v1";

/**
 * Schema version of a v1 graph plan. Arguments carry the object slots.
 *
 * **Example** (Read the v1 plan version)
 *
 * ```ts
 * import { PROMOTION_GRAPH_PLAN_VERSION } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_GRAPH_PLAN_VERSION) // "canonical_memory_graph_plan.v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_GRAPH_PLAN_VERSION = "canonical_memory_graph_plan.v1";

/**
 * Schema version of a v2 graph plan. Typed subject and object endpoints are required.
 *
 * **Example** (Read the v2 plan version)
 *
 * ```ts
 * import { PROMOTION_GRAPH_PLAN_V2_VERSION } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_GRAPH_PLAN_V2_VERSION) // "canonical_memory_graph_plan.v2"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_GRAPH_PLAN_V2_VERSION = "canonical_memory_graph_plan.v2";

/**
 * Schema version of a v1 graph assertion.
 *
 * **Example** (Read the v1 assertion version)
 *
 * ```ts
 * import { PROMOTION_GRAPH_ASSERTION_VERSION } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_GRAPH_ASSERTION_VERSION) // "canonical_memory_graph_assertion.v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_GRAPH_ASSERTION_VERSION = "canonical_memory_graph_assertion.v1";

/**
 * Schema version of a v2 graph assertion.
 *
 * **Example** (Read the v2 assertion version)
 *
 * ```ts
 * import { PROMOTION_GRAPH_ASSERTION_V2_VERSION } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_GRAPH_ASSERTION_V2_VERSION) // "canonical_memory_graph_assertion.v2"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_GRAPH_ASSERTION_V2_VERSION = "canonical_memory_graph_assertion.v2";

/**
 * Planner id frozen on every admission receipt.
 *
 * **Example** (Read the planner id)
 *
 * ```ts
 * import { PROMOTION_PLANNER_ID } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_PLANNER_ID) // "canonical_batched_promotion"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_PLANNER_ID = "canonical_batched_promotion";

/**
 * Planner version frozen on every admission receipt.
 *
 * **Example** (Read the planner version)
 *
 * ```ts
 * import { PROMOTION_PLANNER_VERSION } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_PLANNER_VERSION) // "v2"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_PLANNER_VERSION = "v2";

/**
 * Maximum length of a subject id or an endpoint label.
 *
 * **Example** (Read the subject bound)
 *
 * ```ts
 * import { PROMOTION_GRAPH_SUBJECT_MAX_LENGTH } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_GRAPH_SUBJECT_MAX_LENGTH) // 200
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_GRAPH_SUBJECT_MAX_LENGTH = 200;

/**
 * Maximum length of a predicate.
 *
 * **Example** (Read the predicate bound)
 *
 * ```ts
 * import { PROMOTION_GRAPH_PREDICATE_MAX_LENGTH } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_GRAPH_PREDICATE_MAX_LENGTH) // 64
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_GRAPH_PREDICATE_MAX_LENGTH = 64;

/**
 * Maximum number of top-level argument slots.
 *
 * **Example** (Read the slot bound)
 *
 * ```ts
 * import { PROMOTION_GRAPH_ARGUMENT_MAX_COUNT } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_GRAPH_ARGUMENT_MAX_COUNT) // 16
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_GRAPH_ARGUMENT_MAX_COUNT = 16;

/**
 * Maximum length of any object key inside the arguments.
 *
 * **Example** (Read the key bound)
 *
 * ```ts
 * import { PROMOTION_GRAPH_ARGUMENT_KEY_MAX_LENGTH } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_GRAPH_ARGUMENT_KEY_MAX_LENGTH) // 64
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_GRAPH_ARGUMENT_KEY_MAX_LENGTH = 64;

/**
 * Maximum canonical JSON size of the arguments, in bytes.
 *
 * **Example** (Read the payload bound)
 *
 * ```ts
 * import { PROMOTION_GRAPH_ARGUMENTS_MAX_JSON_BYTES } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_GRAPH_ARGUMENTS_MAX_JSON_BYTES) // 8192
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_GRAPH_ARGUMENTS_MAX_JSON_BYTES = 8 * 1024;

/**
 * Maximum container nesting depth inside the arguments. The root object is depth 0.
 *
 * **Example** (Read the depth bound)
 *
 * ```ts
 * import { PROMOTION_GRAPH_ARGUMENTS_MAX_DEPTH } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(PROMOTION_GRAPH_ARGUMENTS_MAX_DEPTH) // 8
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROMOTION_GRAPH_ARGUMENTS_MAX_DEPTH = 8;

/**
 * Stable desktop graph vocabulary for a typed endpoint.
 *
 * **Details**
 *
 * Unknown model output is rejected rather than degraded into `concept`, so a
 * type change cannot silently become a concept.
 *
 * **Example** (Check a node type)
 *
 * ```ts
 * import { CanonicalGraphNodeType } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(CanonicalGraphNodeType.is("place")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CanonicalGraphNodeType = LiteralKit(["person", "place", "organization", "thing", "concept"]).pipe(
  $I.annoteSchema("CanonicalGraphNodeType", {
    description: "Typed graph endpoint vocabulary: person, place, organization, thing, or concept.",
  }),
);

/**
 * Decoded {@link CanonicalGraphNodeType}.
 *
 * @see {@link CanonicalGraphNodeType} for the literal set.
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalGraphNodeType = typeof CanonicalGraphNodeType.Type;

const contractError = (message: string): MemoryContractError => MemoryContractError.make({ message });

const fail = (message: string): Result.Result<never, MemoryContractError> => Result.fail(contractError(message));

const errorMessage = (error: unknown): string =>
  P.hasProperty(error, "message") && P.isString(error.message) ? error.message : String(error);

const construct = <A>(make: () => A): Result.Result<A, MemoryContractError> =>
  Result.try({ try: make, catch: (error) => contractError(errorMessage(error)) });

const collapseWhitespace = (value: string): string => A.join(" ")(A.filter(Str.split(value, /\s+/), Str.isNonEmpty));

const sortedUnique = (values: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(A.dedupe(values), Order.String);

const normalizeIds = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  sortedUnique(A.filter(A.map(values, Str.trim), Str.isNonEmpty));

const entityIdForNormalizedLabel = (normalized: string): string =>
  Equal.equals(normalized, "user")
    ? "user"
    : Str.startsWith("ent_")(normalized)
      ? normalized
      : `ent_${Str.takeLeft(20)(deterministicContractId("canonical-graph-entity", { label: normalized }))}`;

/**
 * Stable graph endpoint id for a readable entity label.
 *
 * **Details**
 *
 * The label is whitespace-collapsed and lower-cased. `user` stays `user`, a
 * label that already starts with `ent_` is kept, and every other label becomes
 * `ent_` plus the first 20 hex characters of the `canonical-graph-entity`
 * contract id.
 *
 * **Gotchas**
 *
 * Python uses `casefold`; this port uses `toLowerCase`, which agrees for ASCII
 * labels. A blank label fails with {@link MemoryContractError}.
 *
 * **Example** (Keep the user id)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { canonicalGraphEntityId } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(Result.getOrElse(canonicalGraphEntityId("  User "), () => "")) // "user"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const canonicalGraphEntityId = (label: string): Result.Result<string, MemoryContractError> => {
  const normalized = Str.toLowerCase(collapseWhitespace(label));
  return Str.isEmpty(normalized)
    ? fail("canonical graph entity label must not be blank")
    : Result.succeed(entityIdForNormalizedLabel(normalized));
};

const isJsonArray = (value: S.Json): value is S.JsonArray => A.isArray(value);

const isJsonObject = (value: S.Json): value is S.JsonObject => P.isObject(value) && !A.isArray(value);

const jsonIssue = (value: S.Json, depth: number): O.Option<string> => {
  if (P.isNull(value) || P.isString(value) || P.isBoolean(value)) return O.none();
  if (P.isNumber(value)) {
    return Number.isFinite(value) ? O.none() : O.some("promotion graph argument numbers must be finite JSON numbers");
  }
  if (depth > PROMOTION_GRAPH_ARGUMENTS_MAX_DEPTH) {
    return O.some(
      `promotion graph arguments exceed maximum JSON nesting depth of ${PROMOTION_GRAPH_ARGUMENTS_MAX_DEPTH}`,
    );
  }
  if (isJsonArray(value)) return A.findFirst(value, (item) => jsonIssue(item, depth + 1));
  if (!isJsonObject(value)) return O.none();
  return A.findFirst(Rec.toEntries(value), ([key, item]) =>
    key.length > PROMOTION_GRAPH_ARGUMENT_KEY_MAX_LENGTH
      ? O.some(`promotion graph argument keys must be at most ${PROMOTION_GRAPH_ARGUMENT_KEY_MAX_LENGTH} characters`)
      : jsonIssue(item, depth + 1),
  );
};

const entryKey = Order.mapInput(Order.String, (entry: readonly [string, S.Json]) => entry[0]);

const normalizeArguments = (
  value: S.JsonObject,
  requireNonEmpty: boolean,
): Result.Result<S.JsonObject, MemoryContractError> => {
  const entries = Rec.toEntries(value);
  if (entries.length > PROMOTION_GRAPH_ARGUMENT_MAX_COUNT) {
    return fail(`promotion graph plan supports at most ${PROMOTION_GRAPH_ARGUMENT_MAX_COUNT} arguments`);
  }
  const issue = jsonIssue(value, 0);
  if (O.isSome(issue)) return fail(issue.value);
  const initial: Result.Result<Rec.ReadonlyRecord<string, S.Json>, MemoryContractError> = Result.succeed({});
  const normalized = A.reduce(A.sort(entries, entryKey), initial, (accumulated, [key, item]) =>
    Result.flatMap(accumulated, (record) => {
      const stripped = Str.trim(key);
      if (Str.isEmpty(stripped)) return fail("promotion graph argument keys must not be blank");
      if (Rec.has(record, stripped)) return fail("promotion graph argument keys must be unique after trimming");
      return Result.succeed(Rec.set(record, stripped, item));
    }),
  );
  return Result.flatMap(normalized, (record) => {
    if (requireNonEmpty && Rec.size(record) === 0) return fail("promotion graph plan requires at least one argument");
    if (canonicalJson(record).length > PROMOTION_GRAPH_ARGUMENTS_MAX_JSON_BYTES) {
      return fail(
        `promotion graph arguments JSON payload must be at most ${PROMOTION_GRAPH_ARGUMENTS_MAX_JSON_BYTES} bytes`,
      );
    }
    return Result.succeed(record);
  });
};

/**
 * Validate and normalize a non-empty graph argument object.
 *
 * **Details**
 *
 * The Python default: at least one slot is required. See
 * {@link PromotionGraphArguments} for the field form, which allows an empty
 * object and lets the v1 plan rule add the non-empty requirement.
 *
 * **Example** (Reject an empty object)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { normalizePromotionGraphArguments } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(Result.isFailure(normalizePromotionGraphArguments({}))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const normalizePromotionGraphArguments = (
  value: S.JsonObject,
): Result.Result<S.JsonObject, MemoryContractError> => normalizeArguments(value, true);

const argumentsIssue = (value: S.JsonObject): string | undefined =>
  Result.match(normalizeArguments(value, false), {
    onFailure: (error) => error.message,
    onSuccess: () => undefined,
  });

/**
 * JSON object accepted as graph plan arguments or qualifiers.
 *
 * **Details**
 *
 * The check is {@link normalizePromotionGraphArguments} with
 * `requireNonEmpty` off. The stored value keeps the caller's key spelling; the
 * derive functions write the trimmed, sorted form back.
 *
 * **Example** (Reject a blank key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PromotionGraphArguments } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const exit = Effect.runSyncExit(S.decodeUnknownEffect(PromotionGraphArguments)({ " ": 1 }))
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PromotionGraphArguments = S.JsonObject.check(
  S.makeFilter(argumentsIssue, {
    identifier: "PromotionGraphArguments",
    title: "Promotion graph arguments",
    message: "promotion graph arguments are illegal",
  }),
).pipe(
  $I.annoteSchema("PromotionGraphArguments", {
    description: "Bounded JSON object of graph slots. Keys must be non-blank and unique after trimming.",
  }),
);

/**
 * Decoded {@link PromotionGraphArguments}.
 *
 * @see {@link PromotionGraphArguments} for the bounds.
 * @category type-level
 * @since 0.0.0
 */
export type PromotionGraphArguments = typeof PromotionGraphArguments.Type;

const strippedText = (identifier: string, maxLength: number, blankMessage: string, lengthMessage: string) =>
  S.String.check(
    S.makeFilter(
      (value: string) => {
        const stripped = Str.trim(value);
        return Str.isEmpty(stripped) ? blankMessage : stripped.length > maxLength ? lengthMessage : undefined;
      },
      { identifier, title: identifier, message: blankMessage },
    ),
  );

const nonBlankText = (identifier: string, message: string) =>
  S.String.check(
    S.makeFilter((value: string) => (Str.isEmpty(Str.trim(value)) ? message : undefined), {
      identifier,
      title: identifier,
      message,
    }),
  );

const evidenceList = (identifier: string, message: string) =>
  S.Array(S.String).check(
    S.makeFilter((values: ReadonlyArray<string>) => (A.isReadonlyArrayNonEmpty(normalizeIds(values)) ? undefined : message), {
      identifier,
      title: identifier,
      message,
    }),
  );

const EndpointLabel = S.String.check(
  S.makeFilter(
    (value: string) => {
      const collapsed = collapseWhitespace(value);
      return Str.isEmpty(collapsed)
        ? "graph relation endpoint label and node_type must not be blank"
        : collapsed.length > PROMOTION_GRAPH_SUBJECT_MAX_LENGTH
          ? "graph relation endpoint fields exceed the maximum length"
          : undefined;
    },
    {
      identifier: "GraphRelationEndpointLabel",
      title: "Graph relation endpoint label",
      message: "graph relation endpoint label is illegal",
    },
  ),
);

/**
 * A typed graph endpoint whose identity is derived from its source label.
 *
 * **Details**
 *
 * `label` is whitespace-collapsed and at most
 * {@link PROMOTION_GRAPH_SUBJECT_MAX_LENGTH} characters. `entityId` defaults to
 * an empty string at construction; {@link normalizeGraphRelationEndpoint}
 * writes the id derived from the label and rejects any other value.
 *
 * **Gotchas**
 *
 * Decoding does not derive the id. Run the normalize function, or decode a
 * plan or assertion through its derive function, before trusting `entityId`.
 *
 * **Example** (Construct an endpoint without an id)
 *
 * ```ts
 * import { GraphRelationEndpoint } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const endpoint = GraphRelationEndpoint.make({ label: "Seattle", nodeType: "place" })
 * console.log(endpoint.entityId) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphRelationEndpoint extends Model<GraphRelationEndpoint>("GraphRelationEndpoint")(
  {
    entityId: S.String.pipe(S.withConstructorDefault(Effect.succeed("")))
      .annotateKey({ description: "Derived endpoint id. Blank until normalized; must match the label when set." })
      .pipe(pg.text(), pg.columnName("entity_id")),
    label: EndpointLabel.annotateKey({
      description: "Readable entity label. Whitespace is collapsed; at most 200 characters.",
    }).pipe(pg.text(), pg.columnName("label")),
    nodeType: CanonicalGraphNodeType.annotateKey({
      description: "Stable desktop graph node type. Unknown types are rejected, not coerced to concept.",
    }).pipe(pg.text(), pg.columnName("node_type")),
  },
  $I.annote("GraphRelationEndpoint", {
    description: "Typed graph endpoint whose identity is derived from its source label.",
  }),
  (columns) => [
    textBoundsCheck("label", { minLength: 1, maxLength: PROMOTION_GRAPH_SUBJECT_MAX_LENGTH })(columns.label),
  ],
) {}

/**
 * Encoded form of {@link GraphRelationEndpoint}.
 *
 * @see {@link GraphRelationEndpoint} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GraphRelationEndpoint {
  export type Encoded = S.Codec.Encoded<typeof GraphRelationEndpoint>;
}

/**
 * Collapse the label and derive the endpoint id.
 *
 * **Details**
 *
 * Mirrors the Python `normalize_entity_id` model validator. A non-blank
 * `entityId` that differs from the derived id fails.
 *
 * **Example** (Derive the id)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { GraphRelationEndpoint, normalizeGraphRelationEndpoint } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const endpoint = normalizeGraphRelationEndpoint(GraphRelationEndpoint.make({ label: "User", nodeType: "person" }))
 * console.log(Result.getOrElse(endpoint, () => null)?.entityId) // "user"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const normalizeGraphRelationEndpoint = (
  endpoint: GraphRelationEndpoint,
): Result.Result<GraphRelationEndpoint, MemoryContractError> => {
  const label = collapseWhitespace(endpoint.label);
  return Result.flatMap(canonicalGraphEntityId(label), (expected) =>
    Str.isNonEmpty(endpoint.entityId) && endpoint.entityId !== expected
      ? fail("graph relation endpoint id must be derived from its label")
      : construct(() => GraphRelationEndpoint.make({ entityId: expected, label, nodeType: endpoint.nodeType })),
  );
};

const normalizeOptionalEndpoint = (
  endpoint: O.Option<GraphRelationEndpoint>,
): Result.Result<O.Option<GraphRelationEndpoint>, MemoryContractError> =>
  O.match(endpoint, {
    onNone: () => Result.succeed(O.none()),
    onSome: (value) => Result.map(normalizeGraphRelationEndpoint(value), O.some),
  });

const SubjectEntityId = strippedText(
  "PromotionGraphSubjectEntityId",
  PROMOTION_GRAPH_SUBJECT_MAX_LENGTH,
  "promotion graph subject and predicate must not be blank",
  `promotion graph subject_entity_id must be at most ${PROMOTION_GRAPH_SUBJECT_MAX_LENGTH} characters`,
);

const PredicateText = strippedText(
  "PromotionGraphPredicate",
  PROMOTION_GRAPH_PREDICATE_MAX_LENGTH,
  "promotion graph subject and predicate must not be blank",
  `promotion graph predicate must be at most ${PROMOTION_GRAPH_PREDICATE_MAX_LENGTH} characters`,
);

const blankTextColumn = (column: string, description: string) =>
  S.String.pipe(S.withConstructorDefault(Effect.succeed("")))
    .annotateKey({ description })
    .pipe(pg.text(), pg.columnName(column));

const positiveIntColumn = (column: string, description: string) =>
  S.Int.check(S.isGreaterThanOrEqualTo(1))
    .annotateKey({ description })
    .pipe(pg.integer(), pg.columnName(column));

const stringListColumn = (column: string, description: string) =>
  S.Array(S.String)
    .pipe(S.withConstructorDefault(Effect.succeed([])))
    .annotateKey({ description })
    .pipe(pg.jsonb(), pg.columnName(column));

const argumentsColumn = (column: string, description: string) =>
  PromotionGraphArguments.annotateKey({ description }).pipe(
    S.withConstructorDefault(Effect.succeed({})),
    pg.jsonb(),
    pg.columnName(column),
  );

const requiredArgumentsColumn = (column: string, description: string) =>
  PromotionGraphArguments.annotateKey({ description }).pipe(pg.jsonb(), pg.columnName(column));

const planFields = {
  subjectEntityId: SubjectEntityId.annotateKey({
    description: "Subject endpoint id. Stripped, non-blank, at most 200 characters.",
  }).pipe(pg.text(), pg.columnName("subject_entity_id")),
  predicate: PredicateText.annotateKey({
    description: "Relation predicate. Stripped, non-blank, at most 64 characters.",
  }).pipe(pg.text(), pg.columnName("predicate")),
  planHash: blankTextColumn(
    "plan_hash",
    "Derived canonical-promotion-graph-plan contract id. Blank until derived; a mismatch is rejected.",
  ),
};

const planChecks = (columns: {
  readonly subjectEntityId: Parameters<ReturnType<typeof textBoundsCheck>>[0];
  readonly predicate: Parameters<ReturnType<typeof textBoundsCheck>>[0];
}) => [
  textBoundsCheck("subject_entity_id", { minLength: 1, maxLength: PROMOTION_GRAPH_SUBJECT_MAX_LENGTH })(
    columns.subjectEntityId,
  ),
  textBoundsCheck("predicate", { minLength: 1, maxLength: PROMOTION_GRAPH_PREDICATE_MAX_LENGTH })(columns.predicate),
];

/**
 * v1 graph plan. Argument slots name the objects; endpoints are optional hints.
 *
 * **Details**
 *
 * A non-empty graph assertion generated in the same L2 planning call. This is
 * a promotion proposal, not a product layer. v1 requires at least one
 * argument after normalization, and its hash covers only the schema version,
 * subject id, predicate, and arguments.
 *
 * **Example** (Construct a v1 plan)
 *
 * ```ts
 * import { PromotionGraphPlanV1 } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const plan = PromotionGraphPlanV1.make({ subjectEntityId: "user", predicate: "lives_in", arguments: { place: "Seattle" } })
 * console.log(plan.schemaVersion) // "canonical_memory_graph_plan.v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PromotionGraphPlanV1 extends Model<PromotionGraphPlanV1>("PromotionGraphPlanV1")(
  {
    schemaVersion: S.tag(PROMOTION_GRAPH_PLAN_VERSION).pipe(pg.text(), pg.columnName("schema_version")),
    ...planFields,
    arguments: argumentsColumn("arguments", "Object slots. Must be non-empty once derived."),
    subject: optionalJsonColumn(GraphRelationEndpoint, "subject"),
    object: optionalJsonColumn(GraphRelationEndpoint, "object"),
    qualifiers: argumentsColumn("qualifiers", "Extra qualifiers. Not part of the v1 hash."),
  },
  $I.annote("PromotionGraphPlanV1", {
    description: "v1 promotion graph plan keyed by argument slots.",
  }),
  planChecks,
) {}

/**
 * Encoded form of {@link PromotionGraphPlanV1}.
 *
 * @see {@link PromotionGraphPlanV1} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PromotionGraphPlanV1 {
  export type Encoded = S.Codec.Encoded<typeof PromotionGraphPlanV1>;
}

/**
 * v2 graph plan. Typed subject and object endpoints are required.
 *
 * **Details**
 *
 * The subject endpoint id must equal `subjectEntityId`, the two endpoints may
 * not form a self-loop, and non-empty `arguments` must equal `qualifiers`.
 * Deriving copies `qualifiers` into `arguments`. The hash adds the two
 * endpoints and the qualifiers.
 *
 * **Example** (Construct a v2 plan)
 *
 * ```ts
 * import { GraphRelationEndpoint, PromotionGraphPlanV2 } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const plan = PromotionGraphPlanV2.make({
 *   subjectEntityId: "user",
 *   predicate: "lives_in",
 *   subject: GraphRelationEndpoint.make({ label: "User", nodeType: "person" }),
 *   object: GraphRelationEndpoint.make({ label: "Seattle", nodeType: "place" }),
 * })
 * console.log(plan.schemaVersion) // "canonical_memory_graph_plan.v2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PromotionGraphPlanV2 extends Model<PromotionGraphPlanV2>("PromotionGraphPlanV2")(
  {
    schemaVersion: S.tag(PROMOTION_GRAPH_PLAN_V2_VERSION).pipe(pg.text(), pg.columnName("schema_version")),
    ...planFields,
    arguments: argumentsColumn("arguments", "Mirror of qualifiers once derived."),
    subject: jsonColumn(GraphRelationEndpoint, "subject"),
    object: jsonColumn(GraphRelationEndpoint, "object"),
    qualifiers: argumentsColumn("qualifiers", "Relation qualifiers. Part of the v2 hash."),
  },
  $I.annote("PromotionGraphPlanV2", {
    description: "v2 promotion graph plan with typed subject and object endpoints.",
  }),
  planChecks,
) {}

/**
 * Encoded form of {@link PromotionGraphPlanV2}.
 *
 * @see {@link PromotionGraphPlanV2} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PromotionGraphPlanV2 {
  export type Encoded = S.Codec.Encoded<typeof PromotionGraphPlanV2>;
}

const PlanVersionKit = LiteralKit([PROMOTION_GRAPH_PLAN_VERSION, PROMOTION_GRAPH_PLAN_V2_VERSION]);

/**
 * Promotion graph plan. `schemaVersion` chooses the member shape.
 *
 * **Details**
 *
 * The plan is the graph half of a promotion proposal. Deterministic code binds
 * it to the short-term item revision, content, and evidence through
 * {@link PromotionAdmissionReceipt} before the apply transaction accepts it.
 *
 * **Gotchas**
 *
 * Python defaults a missing `schema_version` to v1. This decoder requires the
 * key; construction through {@link PromotionGraphPlanV1} fills it.
 *
 * **Example** (Decode a v1 plan)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PromotionGraphPlan } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const plan = Effect.runSync(
 *   S.decodeUnknownEffect(PromotionGraphPlan)({
 *     schemaVersion: "canonical_memory_graph_plan.v1",
 *     subjectEntityId: "user",
 *     predicate: "lives_in",
 *     arguments: { place: "Seattle" },
 *     qualifiers: {},
 *     planHash: "",
 *   }),
 * )
 * console.log(plan.schemaVersion) // "canonical_memory_graph_plan.v1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PromotionGraphPlan = PlanVersionKit.mapMembers(
  Tuple.evolve([() => PromotionGraphPlanV1, () => PromotionGraphPlanV2]),
).pipe(
  S.toTaggedUnion("schemaVersion"),
  $I.annoteSchema("PromotionGraphPlan", {
    description: "Promotion graph plan. schemaVersion selects the v1 slot form or the v2 typed-endpoint form.",
  }),
);

/**
 * Decoded {@link PromotionGraphPlan}.
 *
 * @see {@link PromotionGraphPlan} for the two member shapes.
 * @category type-level
 * @since 0.0.0
 */
export type PromotionGraphPlan = typeof PromotionGraphPlan.Type;

const endpointJson = (endpoint: GraphRelationEndpoint): S.JsonObject => ({
  entity_id: endpoint.entityId,
  label: endpoint.label,
  node_type: endpoint.nodeType,
});

/**
 * Snake-case payload hashed into `planHash`.
 *
 * **Details**
 *
 * v1 hashes the schema version, subject id, predicate, and arguments. v2 adds
 * the subject and object dumps and the qualifiers.
 *
 * **Example** (Read the v1 payload keys)
 *
 * ```ts
 * import { PromotionGraphPlanV1, promotionGraphPlanHashPayload } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const plan = PromotionGraphPlanV1.make({ subjectEntityId: "user", predicate: "lives_in", arguments: { place: "Seattle" } })
 * console.log(Object.keys(promotionGraphPlanHashPayload(plan)).length) // 4
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const promotionGraphPlanHashPayload = (plan: PromotionGraphPlan): S.JsonObject => {
  const base = {
    schema_version: plan.schemaVersion,
    subject_entity_id: plan.subjectEntityId,
    predicate: plan.predicate,
    arguments: plan.arguments,
  };
  return plan.schemaVersion === PROMOTION_GRAPH_PLAN_V2_VERSION
    ? {
        ...base,
        subject: endpointJson(plan.subject),
        object: endpointJson(plan.object),
        qualifiers: plan.qualifiers,
      }
    : base;
};

const planContractId = (plan: PromotionGraphPlan): string =>
  deterministicContractId("canonical-promotion-graph-plan", promotionGraphPlanHashPayload(plan));

const normalizeV1Plan = (
  plan: PromotionGraphPlanV1,
  subjectEntityId: string,
  predicate: string,
  normalizedArguments: S.JsonObject,
  qualifiers: S.JsonObject,
): Result.Result<PromotionGraphPlanV1, MemoryContractError> =>
  Result.gen(function* () {
    if (Rec.size(normalizedArguments) === 0) return yield* fail("promotion graph plan requires at least one argument");
    const subject = yield* normalizeOptionalEndpoint(plan.subject);
    const object = yield* normalizeOptionalEndpoint(plan.object);
    return yield* construct(() =>
      PromotionGraphPlanV1.make({
        subjectEntityId,
        predicate,
        arguments: normalizedArguments,
        subject,
        object,
        qualifiers,
        planHash: "",
      }),
    );
  });

const normalizeV2Plan = (
  plan: PromotionGraphPlanV2,
  subjectEntityId: string,
  predicate: string,
  normalizedArguments: S.JsonObject,
  qualifiers: S.JsonObject,
): Result.Result<PromotionGraphPlanV2, MemoryContractError> =>
  Result.gen(function* () {
    const subject = yield* normalizeGraphRelationEndpoint(plan.subject);
    const object = yield* normalizeGraphRelationEndpoint(plan.object);
    if (subject.entityId !== subjectEntityId) {
      return yield* fail("v2 graph relation subject must match subject_entity_id");
    }
    if (subject.entityId === object.entityId) {
      return yield* fail("v2 graph relation plans must not contain self-loops");
    }
    if (Rec.size(normalizedArguments) > 0 && !Equal.equals(normalizedArguments, qualifiers)) {
      return yield* fail("v2 graph relation arguments must match qualifiers");
    }
    return yield* construct(() =>
      PromotionGraphPlanV2.make({
        subjectEntityId,
        predicate,
        arguments: qualifiers,
        subject,
        object,
        qualifiers,
        planHash: "",
      }),
    );
  });

const withPlanHash = (
  plan: PromotionGraphPlan,
  planHash: string,
): Result.Result<PromotionGraphPlan, MemoryContractError> =>
  plan.schemaVersion === PROMOTION_GRAPH_PLAN_V2_VERSION
    ? construct(() => PromotionGraphPlanV2.make({ ...plan, planHash }))
    : construct(() => PromotionGraphPlanV1.make({ ...plan, planHash }));

/**
 * Normalize a plan and derive or validate its hash.
 *
 * **Details**
 *
 * Mirrors the Python field validators plus `derive_or_validate_hash`. Subject
 * and predicate are stripped, arguments and qualifiers are normalized through
 * {@link normalizePromotionGraphArguments}, endpoints are normalized, and the
 * version rules run: v1 needs a non-empty argument set; v2 needs a subject
 * matching `subjectEntityId`, no self-loop, and arguments equal to
 * qualifiers. A non-blank incoming `planHash` must equal the derived hash.
 *
 * **Example** (Derive a v1 hash)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { PromotionGraphPlanV1, derivePromotionGraphPlan } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const plan = PromotionGraphPlanV1.make({ subjectEntityId: "user", predicate: "lives_in", arguments: { place: "Seattle" } })
 * const derived = derivePromotionGraphPlan(plan)
 * console.log(Result.getOrElse(derived, () => plan).planHash.length) // 64
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const derivePromotionGraphPlan = (
  plan: PromotionGraphPlan,
): Result.Result<PromotionGraphPlan, MemoryContractError> =>
  Result.gen(function* () {
    const subjectEntityId = Str.trim(plan.subjectEntityId);
    const predicate = Str.trim(plan.predicate);
    const normalizedArguments = yield* normalizeArguments(plan.arguments, false);
    const qualifiers = yield* normalizeArguments(plan.qualifiers, false);
    const normalized: PromotionGraphPlan =
      plan.schemaVersion === PROMOTION_GRAPH_PLAN_V2_VERSION
        ? yield* normalizeV2Plan(plan, subjectEntityId, predicate, normalizedArguments, qualifiers)
        : yield* normalizeV1Plan(plan, subjectEntityId, predicate, normalizedArguments, qualifiers);
    const expected = planContractId(normalized);
    if (Str.isNonEmpty(plan.planHash) && plan.planHash !== expected) {
      return yield* fail("promotion graph plan hash mismatch");
    }
    return yield* withPlanHash(normalized, expected);
  });

/**
 * Server-authored proof that one exact short-term revision passed L2 admission.
 *
 * **Details**
 *
 * The admission record of a Short-term to Long-term transition. The server
 * binds the current item revision, content hash, evidence set, supersedes set,
 * and graph plan hash into this receipt and commits the Long-term item plus its
 * graph assertion atomically. The receipt version, planner id, planner
 * version, and decision are singleton literals filled at construction.
 * `receiptId` is `padm_` plus 32 hex characters derived by
 * {@link derivePromotionAdmissionReceipt}.
 *
 * **Gotchas**
 *
 * Evidence ids and supersedes are stored as given; deriving trims, dedupes,
 * and sorts them. Evidence must be non-empty after that normalization.
 *
 * **Example** (Construct an underived receipt)
 *
 * ```ts
 * import { PromotionAdmissionReceipt } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const receipt = PromotionAdmissionReceipt.make({
 *   memoryId: "mem-1",
 *   sourceItemRevision: 3,
 *   outputContentHash: "hash-1",
 *   evidenceIds: ["ev-1"],
 *   graphPlanHash: "plan-1",
 * })
 * console.log(receipt.decision) // "durable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PromotionAdmissionReceipt extends Model<PromotionAdmissionReceipt>("PromotionAdmissionReceipt")(
  {
    receiptVersion: S.tag(PROMOTION_ADMISSION_VERSION).pipe(pg.text(), pg.columnName("receipt_version")),
    receiptId: blankTextColumn("receipt_id", "Derived padm_ id. Blank until derived; a mismatch is rejected."),
    plannerId: S.tag(PROMOTION_PLANNER_ID).pipe(pg.text(), pg.columnName("planner_id")),
    plannerVersion: S.tag(PROMOTION_PLANNER_VERSION).pipe(pg.text(), pg.columnName("planner_version")),
    decision: S.tag("durable").pipe(pg.text(), pg.columnName("decision")),
    memoryId: nonBlankText("PromotionAdmissionMemoryId", "promotion admission fields must not be blank")
      .annotateKey({ description: "Short-term item being admitted." })
      .pipe(pg.text(), pg.columnName("memory_id")),
    sourceItemRevision: positiveIntColumn(
      "source_item_revision",
      "Exact short-term item revision the receipt fences. At least 1.",
    ),
    outputContentHash: nonBlankText("PromotionAdmissionOutputContentHash", "promotion admission fields must not be blank")
      .annotateKey({ description: "Content hash of the admitted output." })
      .pipe(pg.text(), pg.columnName("output_content_hash")),
    evidenceIds: evidenceList("PromotionAdmissionEvidenceIds", "promotion admission requires evidence")
      .annotateKey({ description: "Evidence ids. Trimmed, deduped, and sorted when derived; never empty." })
      .pipe(pg.jsonb(), pg.columnName("evidence_ids")),
    graphPlanHash: nonBlankText("PromotionAdmissionGraphPlanHash", "promotion admission fields must not be blank")
      .annotateKey({ description: "planHash of the bound graph plan." })
      .pipe(pg.text(), pg.columnName("graph_plan_hash")),
    supersedes: stringListColumn(
      "supersedes",
      "Memory ids this admission supersedes. Trimmed, deduped, and sorted when derived.",
    ),
  },
  $I.annote("PromotionAdmissionReceipt", {
    description: "Server-authored proof that one exact short-term revision passed L2 admission.",
  }),
  (columns) => [
    textBoundsCheck("memory_id", { minLength: 1 })(columns.memoryId),
    atLeastCheck("source_item_revision", 1)(columns.sourceItemRevision),
    textBoundsCheck("output_content_hash", { minLength: 1 })(columns.outputContentHash),
    jsonbArrayLengthCheck("evidence_ids", { minimum: 1 })(columns.evidenceIds),
    textBoundsCheck("graph_plan_hash", { minLength: 1 })(columns.graphPlanHash),
  ],
) {}

/**
 * Encoded form of {@link PromotionAdmissionReceipt}.
 *
 * @see {@link PromotionAdmissionReceipt} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PromotionAdmissionReceipt {
  export type Encoded = S.Codec.Encoded<typeof PromotionAdmissionReceipt>;
}

/**
 * Snake-case identity material for `receiptId`. Excludes the id itself.
 *
 * **Example** (Read the payload size)
 *
 * ```ts
 * import { PromotionAdmissionReceipt, promotionAdmissionIdentityPayload } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const receipt = PromotionAdmissionReceipt.make({
 *   memoryId: "mem-1",
 *   sourceItemRevision: 3,
 *   outputContentHash: "hash-1",
 *   evidenceIds: ["ev-1"],
 *   graphPlanHash: "plan-1",
 * })
 * console.log(Object.keys(promotionAdmissionIdentityPayload(receipt)).length) // 10
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const promotionAdmissionIdentityPayload = (receipt: PromotionAdmissionReceipt): S.JsonObject => ({
  receipt_version: receipt.receiptVersion,
  planner_id: receipt.plannerId,
  planner_version: receipt.plannerVersion,
  decision: receipt.decision,
  memory_id: receipt.memoryId,
  source_item_revision: receipt.sourceItemRevision,
  output_content_hash: receipt.outputContentHash,
  evidence_ids: receipt.evidenceIds,
  graph_plan_hash: receipt.graphPlanHash,
  supersedes: receipt.supersedes,
});

/**
 * Normalize a receipt and derive or validate its `padm_` id.
 *
 * **Details**
 *
 * Mirrors the Python field validators plus `derive_or_validate_id`. Text
 * fields are stripped, evidence ids and supersedes are trimmed, deduped, and
 * sorted, and evidence must remain non-empty. The id is `padm_` plus the first
 * 32 hex characters of the `canonical-promotion-admission` contract id over
 * {@link promotionAdmissionIdentityPayload}. A non-blank incoming id must match.
 *
 * **Example** (Derive the receipt id)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { PromotionAdmissionReceipt, derivePromotionAdmissionReceipt } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const receipt = PromotionAdmissionReceipt.make({
 *   memoryId: "mem-1",
 *   sourceItemRevision: 3,
 *   outputContentHash: "hash-1",
 *   evidenceIds: ["ev-2", " ev-1 "],
 *   graphPlanHash: "plan-1",
 * })
 * const derived = derivePromotionAdmissionReceipt(receipt)
 * console.log(Result.getOrElse(derived, () => receipt).receiptId.startsWith("padm_")) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const derivePromotionAdmissionReceipt = (
  receipt: PromotionAdmissionReceipt,
): Result.Result<PromotionAdmissionReceipt, MemoryContractError> =>
  Result.gen(function* () {
    const evidenceIds = normalizeIds(receipt.evidenceIds);
    if (!A.isReadonlyArrayNonEmpty(evidenceIds)) return yield* fail("promotion admission requires evidence");
    const normalized = yield* construct(() =>
      PromotionAdmissionReceipt.make({
        memoryId: Str.trim(receipt.memoryId),
        sourceItemRevision: receipt.sourceItemRevision,
        outputContentHash: Str.trim(receipt.outputContentHash),
        evidenceIds,
        graphPlanHash: Str.trim(receipt.graphPlanHash),
        supersedes: normalizeIds(receipt.supersedes),
        receiptId: "",
      }),
    );
    const expected = `padm_${Str.takeLeft(32)(
      deterministicContractId("canonical-promotion-admission", promotionAdmissionIdentityPayload(normalized)),
    )}`;
    if (Str.isNonEmpty(receipt.receiptId) && receipt.receiptId !== expected) {
      return yield* fail("promotion admission receipt id mismatch");
    }
    return yield* construct(() => PromotionAdmissionReceipt.make({ ...normalized, receiptId: expected }));
  });

const assertionText = (identifier: string) => nonBlankText(identifier, "graph assertion fields must not be blank");

const assertionFields = {
  assertionId: assertionText("MemoryGraphAssertionId")
    .annotateKey({ description: "mga_ id derived from uid, memory id, revision, content hash, and plan hash." })
    .pipe(pg.text(), pg.columnName("assertion_id")),
  uid: assertionText("MemoryGraphAssertionUid")
    .annotateKey({ description: "Account uid." })
    .pipe(pg.text(), pg.columnName("uid")),
  memoryId: assertionText("MemoryGraphAssertionMemoryId")
    .annotateKey({ description: "Long-term memory the assertion is committed with." })
    .pipe(pg.text(), pg.columnName("memory_id")),
  itemRevision: positiveIntColumn("item_revision", "Memory item revision the assertion is fenced to. At least 1."),
  contentHash: assertionText("MemoryGraphAssertionContentHash")
    .annotateKey({ description: "Content hash of the admitted memory." })
    .pipe(pg.text(), pg.columnName("content_hash")),
  evidenceIds: evidenceList("MemoryGraphAssertionEvidenceIds", "graph assertion requires evidence")
    .annotateKey({ description: "Evidence ids. Trimmed, deduped, and sorted when derived; never empty." })
    .pipe(pg.jsonb(), pg.columnName("evidence_ids")),
  subjectEntityId: assertionText("MemoryGraphAssertionSubjectEntityId")
    .annotateKey({ description: "Subject endpoint id copied from the plan." })
    .pipe(pg.text(), pg.columnName("subject_entity_id")),
  predicate: assertionText("MemoryGraphAssertionPredicate")
    .annotateKey({ description: "Relation predicate copied from the plan." })
    .pipe(pg.text(), pg.columnName("predicate")),
  graphPlanHash: assertionText("MemoryGraphAssertionGraphPlanHash")
    .annotateKey({ description: "planHash the assertion was admitted under. Re-derived on every normalize." })
    .pipe(pg.text(), pg.columnName("graph_plan_hash")),
  commitId: assertionText("MemoryGraphAssertionCommitId")
    .annotateKey({ description: "Ledger commit that admitted the memory." })
    .pipe(pg.text(), pg.columnName("commit_id")),
  commitSequence: positiveIntColumn("commit_sequence", "Ledger sequence of the admitting commit. At least 1."),
  status: S.tag("active").pipe(pg.text(), pg.columnName("status")),
  createdAt: UtcTimestamp.annotateKey({ description: "Aware creation instant, stored as UTC." }).pipe(
    pg.timestamp({ mode: "string", withTimezone: true }),
    pg.columnName("created_at"),
  ),
};

type AssertionColumns = {
  readonly assertionId: Parameters<ReturnType<typeof textBoundsCheck>>[0];
  readonly uid: Parameters<ReturnType<typeof textBoundsCheck>>[0];
  readonly memoryId: Parameters<ReturnType<typeof textBoundsCheck>>[0];
  readonly itemRevision: Parameters<ReturnType<typeof atLeastCheck>>[0];
  readonly contentHash: Parameters<ReturnType<typeof textBoundsCheck>>[0];
  readonly evidenceIds: Parameters<ReturnType<typeof jsonbArrayLengthCheck>>[0];
  readonly subjectEntityId: Parameters<ReturnType<typeof textBoundsCheck>>[0];
  readonly predicate: Parameters<ReturnType<typeof textBoundsCheck>>[0];
  readonly graphPlanHash: Parameters<ReturnType<typeof textBoundsCheck>>[0];
  readonly commitId: Parameters<ReturnType<typeof textBoundsCheck>>[0];
  readonly commitSequence: Parameters<ReturnType<typeof atLeastCheck>>[0];
};

const assertionChecks = (columns: AssertionColumns) => [
  textBoundsCheck("assertion_id", { minLength: 1 })(columns.assertionId),
  textBoundsCheck("uid", { minLength: 1 })(columns.uid),
  textBoundsCheck("memory_id", { minLength: 1 })(columns.memoryId),
  atLeastCheck("item_revision", 1)(columns.itemRevision),
  textBoundsCheck("content_hash", { minLength: 1 })(columns.contentHash),
  jsonbArrayLengthCheck("evidence_ids", { minimum: 1 })(columns.evidenceIds),
  textBoundsCheck("subject_entity_id", { minLength: 1 })(columns.subjectEntityId),
  textBoundsCheck("predicate", { minLength: 1 })(columns.predicate),
  textBoundsCheck("graph_plan_hash", { minLength: 1 })(columns.graphPlanHash),
  textBoundsCheck("commit_id", { minLength: 1 })(columns.commitId),
  atLeastCheck("commit_sequence", 1)(columns.commitSequence),
];

/**
 * v1 per-memory knowledge-graph assertion. Argument slots name the objects.
 *
 * **Details**
 *
 * Atomic, authoritative per-memory KG assertion. Shared entity and edge
 * indexes are projections of this document. Keeping the assertion next to
 * the memory commit means an active Long-term item can never exist without a
 * version-fenced graph representation. Graph records emit `node_type`
 * `entity` and one edge per argument slot.
 *
 * **Example** (Read the default status)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { MemoryGraphAssertionV1 } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const assertion = MemoryGraphAssertionV1.make({
 *   assertionId: "mga_1",
 *   uid: "user-1",
 *   memoryId: "mem-1",
 *   itemRevision: 1,
 *   contentHash: "hash-1",
 *   evidenceIds: ["ev-1"],
 *   subjectEntityId: "user",
 *   predicate: "lives_in",
 *   arguments: { place: "Seattle" },
 *   graphPlanHash: "plan-1",
 *   commitId: "commit-1",
 *   commitSequence: 1,
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(assertion.status) // "active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryGraphAssertionV1 extends Model<MemoryGraphAssertionV1>("MemoryGraphAssertionV1")(
  {
    schemaVersion: S.tag(PROMOTION_GRAPH_ASSERTION_VERSION).pipe(pg.text(), pg.columnName("schema_version")),
    ...assertionFields,
    arguments: requiredArgumentsColumn("arguments", "Object slots. Re-checked through the v1 plan rules."),
    subject: optionalJsonColumn(GraphRelationEndpoint, "subject"),
    object: optionalJsonColumn(GraphRelationEndpoint, "object"),
    qualifiers: argumentsColumn("qualifiers", "Extra qualifiers. Not part of the v1 hash."),
  },
  $I.annote("MemoryGraphAssertionV1", {
    description: "v1 per-memory knowledge-graph assertion keyed by argument slots.",
  }),
  assertionChecks,
) {}

/**
 * Encoded form of {@link MemoryGraphAssertionV1}.
 *
 * @see {@link MemoryGraphAssertionV1} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryGraphAssertionV1 {
  export type Encoded = S.Codec.Encoded<typeof MemoryGraphAssertionV1>;
}

/**
 * v2 per-memory knowledge-graph assertion with typed subject and object.
 *
 * **Details**
 *
 * Same atomic, authoritative role as {@link MemoryGraphAssertionV1}. Graph
 * records emit two typed nodes and exactly one edge labelled by the predicate.
 *
 * **Example** (Read the default status)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { GraphRelationEndpoint, MemoryGraphAssertionV2 } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const assertion = MemoryGraphAssertionV2.make({
 *   assertionId: "mga_1",
 *   uid: "user-1",
 *   memoryId: "mem-1",
 *   itemRevision: 1,
 *   contentHash: "hash-1",
 *   evidenceIds: ["ev-1"],
 *   subjectEntityId: "user",
 *   predicate: "lives_in",
 *   arguments: {},
 *   subject: GraphRelationEndpoint.make({ entityId: "user", label: "User", nodeType: "person" }),
 *   object: GraphRelationEndpoint.make({ label: "Seattle", nodeType: "place" }),
 *   graphPlanHash: "plan-1",
 *   commitId: "commit-1",
 *   commitSequence: 1,
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(assertion.status) // "active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryGraphAssertionV2 extends Model<MemoryGraphAssertionV2>("MemoryGraphAssertionV2")(
  {
    schemaVersion: S.tag(PROMOTION_GRAPH_ASSERTION_V2_VERSION).pipe(pg.text(), pg.columnName("schema_version")),
    ...assertionFields,
    arguments: requiredArgumentsColumn("arguments", "Mirror of qualifiers once derived."),
    subject: jsonColumn(GraphRelationEndpoint, "subject"),
    object: jsonColumn(GraphRelationEndpoint, "object"),
    qualifiers: argumentsColumn("qualifiers", "Relation qualifiers. Part of the v2 hash."),
  },
  $I.annote("MemoryGraphAssertionV2", {
    description: "v2 per-memory knowledge-graph assertion with typed subject and object endpoints.",
  }),
  assertionChecks,
) {}

/**
 * Encoded form of {@link MemoryGraphAssertionV2}.
 *
 * @see {@link MemoryGraphAssertionV2} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryGraphAssertionV2 {
  export type Encoded = S.Codec.Encoded<typeof MemoryGraphAssertionV2>;
}

const AssertionVersionKit = LiteralKit([PROMOTION_GRAPH_ASSERTION_VERSION, PROMOTION_GRAPH_ASSERTION_V2_VERSION]);

/**
 * Per-memory graph assertion. `schemaVersion` chooses the member shape.
 *
 * **Details**
 *
 * Canonical graph assertions are derived-state authority: shared nodes and
 * edges are a bounded read-side projection of these documents. `status` is a
 * singleton `active`, not the shape tag.
 *
 * **Gotchas**
 *
 * Python defaults a missing `schema_version` to v1. This decoder requires the
 * key; construction through {@link MemoryGraphAssertionV1} fills it.
 *
 * **Example** (Decode a v1 assertion)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryGraphAssertion } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const assertion = Effect.runSync(
 *   S.decodeUnknownEffect(MemoryGraphAssertion)({
 *     schemaVersion: "canonical_memory_graph_assertion.v1",
 *     assertionId: "mga_1",
 *     uid: "user-1",
 *     memoryId: "mem-1",
 *     itemRevision: 1,
 *     contentHash: "hash-1",
 *     evidenceIds: ["ev-1"],
 *     subjectEntityId: "user",
 *     predicate: "lives_in",
 *     arguments: { place: "Seattle" },
 *     qualifiers: {},
 *     graphPlanHash: "plan-1",
 *     commitId: "commit-1",
 *     commitSequence: 1,
 *     status: "active",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(assertion.schemaVersion) // "canonical_memory_graph_assertion.v1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryGraphAssertion = AssertionVersionKit.mapMembers(
  Tuple.evolve([() => MemoryGraphAssertionV1, () => MemoryGraphAssertionV2]),
).pipe(
  S.toTaggedUnion("schemaVersion"),
  $I.annoteSchema("MemoryGraphAssertion", {
    description: "Per-memory graph assertion. schemaVersion selects the v1 slot form or the v2 typed-endpoint form.",
  }),
);

/**
 * Decoded {@link MemoryGraphAssertion}.
 *
 * @see {@link MemoryGraphAssertion} for the two member shapes.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryGraphAssertion = typeof MemoryGraphAssertion.Type;

const planOfAssertion = (assertion: MemoryGraphAssertion): PromotionGraphPlan =>
  assertion.schemaVersion === PROMOTION_GRAPH_ASSERTION_V2_VERSION
    ? PromotionGraphPlanV2.make({
        subjectEntityId: assertion.subjectEntityId,
        predicate: assertion.predicate,
        arguments: assertion.arguments,
        subject: assertion.subject,
        object: assertion.object,
        qualifiers: assertion.qualifiers,
        planHash: assertion.graphPlanHash,
      })
    : PromotionGraphPlanV1.make({
        subjectEntityId: assertion.subjectEntityId,
        predicate: assertion.predicate,
        arguments: assertion.arguments,
        subject: assertion.subject,
        object: assertion.object,
        qualifiers: assertion.qualifiers,
        planHash: assertion.graphPlanHash,
      });

const trimmedAssertionFields = (assertion: MemoryGraphAssertion) => ({
  assertionId: Str.trim(assertion.assertionId),
  uid: Str.trim(assertion.uid),
  memoryId: Str.trim(assertion.memoryId),
  itemRevision: assertion.itemRevision,
  contentHash: Str.trim(assertion.contentHash),
  evidenceIds: normalizeIds(assertion.evidenceIds),
  graphPlanHash: Str.trim(assertion.graphPlanHash),
  commitId: Str.trim(assertion.commitId),
  commitSequence: assertion.commitSequence,
  status: assertion.status,
  createdAt: assertion.createdAt,
});

/**
 * Re-validate an assertion's plan hash and copy the normalized plan back.
 *
 * **Details**
 *
 * Mirrors the Python field validators plus `validate_plan_hash`. Text fields
 * are stripped, evidence ids are trimmed, deduped, and sorted, and a
 * {@link PromotionGraphPlan} of the matching version is rebuilt from the
 * assertion with `graphPlanHash` as its hash. {@link derivePromotionGraphPlan}
 * then enforces the version rules and the hash match, and its normalized
 * arguments, endpoints, and qualifiers are written back.
 *
 * **Example** (Reject a stale plan hash)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Result from "effect/Result"
 * import { MemoryGraphAssertionV1, deriveMemoryGraphAssertion } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const assertion = MemoryGraphAssertionV1.make({
 *   assertionId: "mga_1",
 *   uid: "user-1",
 *   memoryId: "mem-1",
 *   itemRevision: 1,
 *   contentHash: "hash-1",
 *   evidenceIds: ["ev-1"],
 *   subjectEntityId: "user",
 *   predicate: "lives_in",
 *   arguments: { place: "Seattle" },
 *   graphPlanHash: "stale",
 *   commitId: "commit-1",
 *   commitSequence: 1,
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(Result.isFailure(deriveMemoryGraphAssertion(assertion))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const deriveMemoryGraphAssertion = (
  assertion: MemoryGraphAssertion,
): Result.Result<MemoryGraphAssertion, MemoryContractError> =>
  Result.gen(function* () {
    if (!A.isReadonlyArrayNonEmpty(normalizeIds(assertion.evidenceIds))) {
      return yield* fail("graph assertion requires evidence");
    }
    const plan = yield* construct(() => planOfAssertion(assertion));
    const derived = yield* derivePromotionGraphPlan(plan);
    const fields = trimmedAssertionFields(assertion);
    if (assertion.schemaVersion === PROMOTION_GRAPH_ASSERTION_V2_VERSION) {
      if (derived.schemaVersion !== PROMOTION_GRAPH_PLAN_V2_VERSION) {
        return yield* fail("graph assertion plan version mismatch");
      }
      return yield* construct(() =>
        MemoryGraphAssertionV2.make({
          ...fields,
          subjectEntityId: derived.subjectEntityId,
          predicate: derived.predicate,
          arguments: derived.arguments,
          subject: derived.subject,
          object: derived.object,
          qualifiers: derived.qualifiers,
        }),
      );
    }
    if (derived.schemaVersion !== PROMOTION_GRAPH_PLAN_VERSION) {
      return yield* fail("graph assertion plan version mismatch");
    }
    return yield* construct(() =>
      MemoryGraphAssertionV1.make({
        ...fields,
        subjectEntityId: derived.subjectEntityId,
        predicate: derived.predicate,
        arguments: derived.arguments,
        subject: derived.subject,
        object: derived.object,
        qualifiers: derived.qualifiers,
      }),
    );
  });

/**
 * One projected graph node.
 *
 * **Details**
 *
 * `nodeType` is a {@link CanonicalGraphNodeType} for v2 assertions and the
 * literal `entity` for v1 assertions, which predate the typed vocabulary.
 *
 * **Example** (Construct a node)
 *
 * ```ts
 * import { GraphNodeRecord } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const node = GraphNodeRecord.make({ id: "user", label: "user", nodeType: "entity", aliases: [], memoryIds: ["mem-1"] })
 * console.log(node.nodeType) // "entity"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphNodeRecord extends Model<GraphNodeRecord>("GraphNodeRecord")(
  {
    id: S.String.annotateKey({ description: "Endpoint id." }).pipe(pg.text(), pg.columnName("id")),
    label: S.String.annotateKey({ description: "Readable label." }).pipe(pg.text(), pg.columnName("label")),
    nodeType: S.String.annotateKey({ description: "Typed vocabulary on v2; the literal entity on v1." }).pipe(
      pg.text(),
      pg.columnName("node_type"),
    ),
    aliases: stringListColumn("aliases", "Always empty at projection time."),
    memoryIds: stringListColumn("memory_ids", "Memory ids that assert the node."),
  },
  $I.annote("GraphNodeRecord", { description: "Projected knowledge-graph node." }),
) {}

/**
 * Encoded form of {@link GraphNodeRecord}.
 *
 * @see {@link GraphNodeRecord} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GraphNodeRecord {
  export type Encoded = S.Codec.Encoded<typeof GraphNodeRecord>;
}

/**
 * One projected graph edge.
 *
 * **Example** (Construct an edge)
 *
 * ```ts
 * import { GraphEdgeRecord } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const edge = GraphEdgeRecord.make({ id: "edge_1", sourceId: "user", targetId: "ent_1", label: "lives_in", memoryIds: ["mem-1"] })
 * console.log(edge.label) // "lives_in"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphEdgeRecord extends Model<GraphEdgeRecord>("GraphEdgeRecord")(
  {
    id: S.String.annotateKey({ description: "edge_ plus 24 hex characters over source, target, and label." }).pipe(
      pg.text(),
      pg.columnName("id"),
    ),
    sourceId: S.String.annotateKey({ description: "Subject endpoint id." }).pipe(pg.text(), pg.columnName("source_id")),
    targetId: S.String.annotateKey({ description: "Object endpoint id." }).pipe(pg.text(), pg.columnName("target_id")),
    label: S.String.annotateKey({ description: "Predicate, or predicate:slot on multi-slot v1 plans." }).pipe(
      pg.text(),
      pg.columnName("label"),
    ),
    memoryIds: stringListColumn("memory_ids", "Memory ids that assert the edge."),
  },
  $I.annote("GraphEdgeRecord", { description: "Projected knowledge-graph edge." }),
) {}

/**
 * Encoded form of {@link GraphEdgeRecord}.
 *
 * @see {@link GraphEdgeRecord} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GraphEdgeRecord {
  export type Encoded = S.Codec.Encoded<typeof GraphEdgeRecord>;
}

/**
 * Nodes and edges projected from one assertion.
 *
 * **Example** (Construct an empty projection)
 *
 * ```ts
 * import { GraphRecords } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * console.log(GraphRecords.make({}).nodes.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphRecords extends Model<GraphRecords>("GraphRecords")(
  {
    nodes: jsonList(GraphNodeRecord, "nodes"),
    edges: jsonList(GraphEdgeRecord, "edges"),
  },
  $I.annote("GraphRecords", { description: "Knowledge-graph nodes and edges projected from one assertion." }),
) {}

/**
 * Encoded form of {@link GraphRecords}.
 *
 * @see {@link GraphRecords} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GraphRecords {
  export type Encoded = S.Codec.Encoded<typeof GraphRecords>;
}

const edgeId = (sourceId: string, targetId: string, label: string): string =>
  `edge_${Str.takeLeft(24)(
    deterministicContractId("canonical-graph-edge", { source_id: sourceId, target_id: targetId, label }),
  )}`;

const truthy = (value: S.Json): boolean => {
  if (P.isNull(value) || value === false || value === 0 || value === "") return false;
  if (isJsonArray(value)) return A.isReadonlyArrayNonEmpty(value);
  if (isJsonObject(value)) return Rec.size(value) > 0;
  return true;
};

const pythonStr = (value: S.Json): string =>
  P.isString(value)
    ? value
    : P.isBoolean(value)
      ? value
        ? "True"
        : "False"
      : P.isNull(value)
        ? "None"
        : P.isNumber(value)
          ? String(value)
          : canonicalJson(value);

const truthyAt = (record: S.JsonObject, key: string): O.Option<S.Json> =>
  O.filter(O.fromNullishOr(record[key]), truthy);

const firstTruthy = (record: S.JsonObject, keys: ReadonlyArray<string>): O.Option<S.Json> =>
  A.findFirst(keys, (key) => truthyAt(record, key));

const slotTarget = (
  slot: string,
  raw: S.Json,
): Result.Result<{ readonly label: string; readonly targetId: string }, MemoryContractError> => {
  if (isJsonObject(raw)) {
    const label = O.match(firstTruthy(raw, ["label", "value", "entity_id"]), { onNone: () => slot, onSome: pythonStr });
    return O.match(truthyAt(raw, "entity_id"), {
      onNone: () => Result.map(canonicalGraphEntityId(label), (targetId) => ({ label, targetId })),
      onSome: (entityId) => Result.succeed({ label, targetId: pythonStr(entityId) }),
    });
  }
  const label = pythonStr(raw);
  return Result.map(canonicalGraphEntityId(label), (targetId) => ({ label, targetId }));
};

type V1Projection = {
  readonly nodes: ReadonlyArray<GraphNodeRecord>;
  readonly seen: HashSet.HashSet<string>;
  readonly edges: ReadonlyArray<GraphEdgeRecord>;
};

const node = (id: string, label: string, nodeType: string, memoryId: string): GraphNodeRecord =>
  GraphNodeRecord.make({ id, label, nodeType, aliases: [], memoryIds: [memoryId] });

const edge = (sourceId: string, targetId: string, label: string, memoryId: string): GraphEdgeRecord =>
  GraphEdgeRecord.make({ id: edgeId(sourceId, targetId, label), sourceId, targetId, label, memoryIds: [memoryId] });

const v2Records = (assertion: MemoryGraphAssertionV2): GraphRecords =>
  GraphRecords.make({
    nodes: [
      node(assertion.subject.entityId, assertion.subject.label, assertion.subject.nodeType, assertion.memoryId),
      node(assertion.object.entityId, assertion.object.label, assertion.object.nodeType, assertion.memoryId),
    ],
    edges: [edge(assertion.subject.entityId, assertion.object.entityId, assertion.predicate, assertion.memoryId)],
  });

const v1Records = (assertion: MemoryGraphAssertionV1): Result.Result<GraphRecords, MemoryContractError> => {
  const slots = A.sort(Rec.toEntries(assertion.arguments), entryKey);
  const subjectId = assertion.subjectEntityId;
  const initial: Result.Result<V1Projection, MemoryContractError> = Result.succeed({
    nodes: [node(subjectId, subjectId, "entity", assertion.memoryId)],
    seen: HashSet.make(subjectId),
    edges: [],
  });
  const projected = A.reduce(slots, initial, (accumulated, [slot, raw]) =>
    Result.flatMap(accumulated, (state) =>
      Result.map(slotTarget(slot, raw), ({ label, targetId }) => {
        const edgeLabel = slots.length === 1 ? assertion.predicate : `${assertion.predicate}:${slot}`;
        return {
          nodes: HashSet.has(state.seen, targetId)
            ? state.nodes
            : A.append(state.nodes, node(targetId, label, "entity", assertion.memoryId)),
          seen: HashSet.add(state.seen, targetId),
          edges: A.append(state.edges, edge(subjectId, targetId, edgeLabel, assertion.memoryId)),
        };
      }),
    ),
  );
  return Result.map(projected, (state) => GraphRecords.make({ nodes: state.nodes, edges: state.edges }));
};

/**
 * Derive stable graph nodes and edges without another model call.
 *
 * **Details**
 *
 * v2 emits the typed subject and object nodes and one edge labelled by the
 * predicate. v1 emits the subject as an `entity` node, then one `entity` node
 * and one edge per argument slot in sorted slot order. A slot whose value is
 * an object takes its label from the first truthy of `label`, `value`, or
 * `entity_id`, else the slot name, and its target id from a truthy
 * `entity_id`, else the canonical id of that label. The edge label is the
 * predicate alone when there is a single slot and `predicate:slot` otherwise.
 * Node ids are deduplicated; the first occurrence wins.
 *
 * **Gotchas**
 *
 * Scalar slot values are stringified the Python way for booleans (`True`,
 * `False`) and null (`None`); containers use canonical JSON, and floats use the
 * JavaScript form. A blank label fails with {@link MemoryContractError}.
 *
 * **Example** (Project a single-slot v1 assertion)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Result from "effect/Result"
 * import { MemoryGraphAssertionV1, graphRecords } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const assertion = MemoryGraphAssertionV1.make({
 *   assertionId: "mga_1",
 *   uid: "user-1",
 *   memoryId: "mem-1",
 *   itemRevision: 1,
 *   contentHash: "hash-1",
 *   evidenceIds: ["ev-1"],
 *   subjectEntityId: "user",
 *   predicate: "lives_in",
 *   arguments: { place: "Seattle" },
 *   graphPlanHash: "plan-1",
 *   commitId: "commit-1",
 *   commitSequence: 1,
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * const records = graphRecords(assertion)
 * console.log(Result.getOrElse(records, () => null)?.edges[0]?.label) // "lives_in"
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const graphRecords = (assertion: MemoryGraphAssertion): Result.Result<GraphRecords, MemoryContractError> =>
  assertion.schemaVersion === PROMOTION_GRAPH_ASSERTION_V2_VERSION
    ? Result.succeed(v2Records(assertion))
    : v1Records(assertion);

/**
 * Build a derived admission receipt from a plan and the fenced item facts.
 *
 * **Details**
 *
 * The plan is derived first so `graphPlanHash` is its canonical hash, then
 * the receipt is normalized and its id derived by
 * {@link derivePromotionAdmissionReceipt}.
 *
 * **Example** (Build a receipt)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { PromotionGraphPlanV1, buildPromotionAdmissionReceipt } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const receipt = buildPromotionAdmissionReceipt({
 *   memoryId: "mem-1",
 *   sourceItemRevision: 3,
 *   outputContentHash: "hash-1",
 *   evidenceIds: ["ev-1"],
 *   graphPlan: PromotionGraphPlanV1.make({ subjectEntityId: "user", predicate: "lives_in", arguments: { place: "Seattle" } }),
 *   supersedes: [],
 * })
 * console.log(Result.isSuccess(receipt)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const buildPromotionAdmissionReceipt = (input: {
  readonly memoryId: string;
  readonly sourceItemRevision: number;
  readonly outputContentHash: string;
  readonly evidenceIds: ReadonlyArray<string>;
  readonly graphPlan: PromotionGraphPlan;
  readonly supersedes: ReadonlyArray<string>;
}): Result.Result<PromotionAdmissionReceipt, MemoryContractError> =>
  Result.gen(function* () {
    const plan = yield* derivePromotionGraphPlan(input.graphPlan);
    const receipt = yield* construct(() =>
      PromotionAdmissionReceipt.make({
        memoryId: input.memoryId,
        sourceItemRevision: input.sourceItemRevision,
        outputContentHash: input.outputContentHash,
        evidenceIds: input.evidenceIds,
        graphPlanHash: plan.planHash,
        supersedes: input.supersedes,
      }),
    );
    return yield* derivePromotionAdmissionReceipt(receipt);
  });

/**
 * Build a derived graph assertion for an admitted memory.
 *
 * **Details**
 *
 * The assertion id is `mga_` plus the first 32 hex characters of the
 * `canonical-memory-graph-assertion` contract id over the uid, memory id,
 * item revision, content hash, and plan hash. A v2 plan yields a v2
 * assertion; otherwise v1. Evidence ids are deduped and sorted, and the result
 * passes through {@link deriveMemoryGraphAssertion}.
 *
 * **Example** (Build a v1 assertion)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Result from "effect/Result"
 * import { PromotionGraphPlanV1, buildMemoryGraphAssertion } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const assertion = buildMemoryGraphAssertion({
 *   uid: "user-1",
 *   memoryId: "mem-1",
 *   itemRevision: 1,
 *   contentHash: "hash-1",
 *   evidenceIds: ["ev-1"],
 *   graphPlan: PromotionGraphPlanV1.make({ subjectEntityId: "user", predicate: "lives_in", arguments: { place: "Seattle" } }),
 *   commitId: "commit-1",
 *   commitSequence: 1,
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(Result.getOrElse(assertion, () => null)?.assertionId.startsWith("mga_")) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const buildMemoryGraphAssertion = (input: {
  readonly uid: string;
  readonly memoryId: string;
  readonly itemRevision: number;
  readonly contentHash: string;
  readonly evidenceIds: ReadonlyArray<string>;
  readonly graphPlan: PromotionGraphPlan;
  readonly commitId: string;
  readonly commitSequence: number;
  readonly createdAt: DateTime.Utc;
}): Result.Result<MemoryGraphAssertion, MemoryContractError> =>
  Result.gen(function* () {
    const plan = yield* derivePromotionGraphPlan(input.graphPlan);
    const assertionId = `mga_${Str.takeLeft(32)(
      deterministicContractId("canonical-memory-graph-assertion", {
        uid: input.uid,
        memory_id: input.memoryId,
        item_revision: input.itemRevision,
        content_hash: input.contentHash,
        graph_plan_hash: plan.planHash,
      }),
    )}`;
    const shared = {
      assertionId,
      uid: input.uid,
      memoryId: input.memoryId,
      itemRevision: input.itemRevision,
      contentHash: input.contentHash,
      evidenceIds: sortedUnique(input.evidenceIds),
      subjectEntityId: plan.subjectEntityId,
      predicate: plan.predicate,
      qualifiers: plan.qualifiers,
      graphPlanHash: plan.planHash,
      commitId: input.commitId,
      commitSequence: input.commitSequence,
      createdAt: input.createdAt,
    };
    const assertion: MemoryGraphAssertion =
      plan.schemaVersion === PROMOTION_GRAPH_PLAN_V2_VERSION
        ? yield* construct(() =>
            MemoryGraphAssertionV2.make({
              ...shared,
              arguments: plan.arguments,
              subject: plan.subject,
              object: plan.object,
            }),
          )
        : yield* construct(() =>
            MemoryGraphAssertionV1.make({
              ...shared,
              arguments: plan.arguments,
              subject: plan.subject,
              object: plan.object,
            }),
          );
    return yield* deriveMemoryGraphAssertion(assertion);
  });

const decodePlan = S.decodeUnknownResult(PromotionGraphPlan);
const decodeReceipt = S.decodeUnknownResult(PromotionAdmissionReceipt);

/**
 * Validate the complete server-authored promotion proof for a short-term item.
 *
 * **Details**
 *
 * `promotion.graphPlan` and `promotion.admissionReceipt` are decoded and
 * derived, and the caller's arguments are normalized with the non-empty
 * requirement. The result is true only when the receipt repeats the memory
 * id, revision, output hash, deduped sorted evidence ids, deduped sorted
 * supersedes, and the plan hash; the plan repeats the subject id, predicate,
 * and normalized arguments; and the memory does not supersede itself.
 *
 * **Gotchas**
 *
 * Every decode, derive, or normalization failure yields false, like the
 * Python `except (KeyError, TypeError, ValueError)`. Property names are the
 * camelCase port of the stored keys (`graph_plan` becomes `graphPlan`), as in
 * the admission module. A `None` subject or predicate compares as the empty
 * string, which a valid plan never carries.
 *
 * **Example** (Reject a promotion with no plan)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { validPromotionAdmission } from "@beep/scratchpad/beep/MemoryPromotion.ts"
 *
 * const valid = validPromotionAdmission({
 *   memoryId: "mem-1",
 *   sourceItemRevision: 3,
 *   outputContentHash: "hash-1",
 *   evidenceIds: ["ev-1"],
 *   subjectEntityId: O.some("user"),
 *   predicate: O.some("lives_in"),
 *   arguments: { place: "Seattle" },
 *   supersedes: [],
 *   promotion: {},
 * })
 * console.log(valid) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const validPromotionAdmission = (input: {
  readonly memoryId: string;
  readonly sourceItemRevision: number;
  readonly outputContentHash: string;
  readonly evidenceIds: ReadonlyArray<string>;
  readonly subjectEntityId: O.Option<string>;
  readonly predicate: O.Option<string>;
  readonly arguments: S.JsonObject;
  readonly supersedes: ReadonlyArray<string>;
  readonly promotion: { readonly [key: string]: unknown };
}): boolean =>
  Result.getOrElse(
    Result.gen(function* () {
      const rawPlan = yield* Result.fromOption(Rec.get(input.promotion, "graphPlan"), () =>
        contractError("promotion has no graphPlan"),
      );
      const rawReceipt = yield* Result.fromOption(Rec.get(input.promotion, "admissionReceipt"), () =>
        contractError("promotion has no admissionReceipt"),
      );
      const plan = yield* derivePromotionGraphPlan(yield* decodePlan(rawPlan));
      const receipt = yield* derivePromotionAdmissionReceipt(yield* decodeReceipt(rawReceipt));
      const normalizedArguments = yield* normalizePromotionGraphArguments(input.arguments);
      return (
        receipt.memoryId === input.memoryId &&
        receipt.sourceItemRevision === input.sourceItemRevision &&
        receipt.outputContentHash === input.outputContentHash &&
        Equal.equals(receipt.evidenceIds, sortedUnique(input.evidenceIds)) &&
        receipt.graphPlanHash === plan.planHash &&
        plan.subjectEntityId === O.getOrElse(input.subjectEntityId, () => "") &&
        plan.predicate === O.getOrElse(input.predicate, () => "") &&
        Equal.equals(plan.arguments, normalizedArguments) &&
        Equal.equals(receipt.supersedes, sortedUnique(input.supersedes)) &&
        !A.contains(receipt.supersedes, input.memoryId)
      );
    }),
    () => false,
  );
