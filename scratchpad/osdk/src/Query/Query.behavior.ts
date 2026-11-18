/**
 * Projections from the data types of a query to the codecs of the values a call sends and receives.
 *
 * **Details**
 *
 * A query type is data, and the wire types every argument and every result
 * as `any`. The functions here read that data and return schemas:
 *
 * - {@link leafCodec} is the table of the leaf data types: the rows every
 *   universe shares (`sharedCodec` of `Value`) and the rows only a query has.
 * - {@link valueCodec} turns one {@link QueryDataType} into the codec of one
 *   value, unfolding by-name type references lazily so a type that contains
 *   itself still projects.
 * - {@link parametersCodec} and {@link outputCodec} do so for the two ends of
 *   a whole query type.
 *
 * The projection unfolds the types that hold other types and reads every
 * other type from the table by its tag, so a new data type is a compile error
 * until its value codec exists.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { QueryDataTypeKind } from "../DataType/DataType.values.ts";
import { AttachmentRid } from "../Identifier/Identifier.model.ts";
import { closedRecordCodec, hashSetCodec, structCodec } from "../internal/ProjectedCodec.ts";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";
import { InterfaceObjectLocator, PrimaryKeyValue } from "../Object/Object.model.ts";
import { ObjectSetArgument } from "../ObjectSet/ObjectSet.model.ts";
import { sharedCodec } from "../Value/Value.behavior.ts";
import { nonNullAlternative, QueryAggregationKeyType, QueryDataType } from "./Query.model.ts";
import type {
  QueryAggregationValueType,
  QueryParameter,
  QueryStructField,
  QueryType,
  TypeReferenceId,
} from "./Query.model.ts";

const $I = $ScratchpadId.create("osdk/Query/Query.behavior");

type TypeReferences = QueryType["typeReferences"];

// -----------------------------------------------------------------------------
// Collections
// -----------------------------------------------------------------------------

const hashMapCodec = (key: S.Codec<unknown, unknown>, value: S.Codec<unknown, unknown>): S.Codec<unknown, unknown> =>
  S.Array(S.Struct({ key, value })).pipe(
    S.decodeTo(
      S.HashMap(S.toType(key), S.toType(value)),
      SchemaTransformation.transform({
        decode: (entries) => HashMap.fromIterable(A.map(entries, (entry) => Tuple.make(entry.key, entry.value))),
        encode: (entries) =>
          A.map(A.fromIterable(entries), ([entryKey, entryValue]) => ({ key: entryKey, value: entryValue })),
      })
    )
  );

// -----------------------------------------------------------------------------
// Leaves
// -----------------------------------------------------------------------------

// A query that returns nothing has one possible result. JSON cannot carry `undefined`, so the unit value
// travels as `null`; an absent value is read the same way.
const VoidValue = S.Union([S.Null, S.Undefined]).pipe(
  S.decodeTo(
    S.Undefined,
    SchemaTransformation.transform<undefined, null | undefined>({
      decode: () => undefined,
      encode: () => null,
    })
  )
);

// The tags of a data type that holds no other type: every tag but the ones the projection unfolds.
const LeafKind = QueryDataTypeKind.omit([
  "array",
  "set",
  "entrySet",
  "struct",
  "union",
  "twoDimensionalAggregation",
  "threeDimensionalAggregation",
  "typeReference",
]);

/**
 * The codec of one value of each leaf query data type, keyed by the type's tag.
 *
 * **Details**
 *
 * A leaf type is one whose codec does not depend on anything the type states.
 * The table is the rows every universe shares (`sharedCodec` of `Value`) plus
 * the rows only a query has. A reference travels as what identifies its
 * target: an attachment as its identifier, an object as its primary key, an
 * interface object as its object type and primary key, an object set as the
 * identifier of a stored set or a definition written in place. `null` holds
 * only `null`, `void` holds only `undefined` (written as `null`), and
 * `unsupported` promises nothing, so its value stays JSON. {@link valueCodec}
 * reads the table, and the leaf specs of `Model` that only a query has are
 * built from it by key.
 *
 * **Example** (Read nothing as the unit value and write it as null)
 *
 * ```ts import.meta.vitest name="Read nothing as the unit value and write it as null"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { leafCodec } from "@beep/scratchpad/osdk/src/Query/index"
 * import { sharedCodec } from "@beep/scratchpad/osdk/src/Value/index"
 *
 * const nothing = await Effect.runPromise(S.decodeUnknownEffect(leafCodec.void)(null))
 * const wire = await Effect.runPromise(S.encodeUnknownEffect(leafCodec.void)(nothing))
 * const facts = [nothing === undefined, wire, leafCodec.timestamp === sharedCodec.timestamp]
 * facts // => [true, null, true]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const leafCodec = Struct.pick(
  {
    ...sharedCodec,
    attachment: AttachmentRid,
    object: PrimaryKeyValue,
    objectSet: ObjectSetArgument,
    interfaceObject: InterfaceObjectLocator,
    interfaceObjectSet: ObjectSetArgument,
    null: S.Null,
    void: VoidValue,
    unsupported: S.Json,
  },
  LeafKind.literals
);

// -----------------------------------------------------------------------------
// Aggregations
// -----------------------------------------------------------------------------

// The shape and the rule of `QueryRange`, with the bounds read by the codec the range key declares.
const rangeCodec = (bound: S.Codec<unknown, unknown>) =>
  S.Struct({ startValue: S.OptionFromOptionalKey(bound), endValue: S.OptionFromOptionalKey(bound) }).check(
    S.makeFilter(
      ({ startValue, endValue }) => O.isSome(startValue) || O.isSome(endValue),
      $I.annote("BoundedRangeKeyCheck", {
        title: "Bounded Range Key",
        description: "A range key that states its start, its end or both.",
        message: "A range needs a startValue, an endValue or both",
      })
    )
  );

// A key, a bound and a value of an aggregation are scalars, read from the shared table by their tag.
const aggregationKeyCodec: (keyType: QueryAggregationKeyType) => S.Codec<unknown, unknown> =
  QueryAggregationKeyType.matchOrElse(
    { range: ({ boundType }) => rangeCodec(sharedCodec[boundType.type]) },
    (scalar) => sharedCodec[scalar.type]
  );

const aggregationGroupsCodec = (types: {
  readonly keyType: QueryAggregationKeyType;
  readonly valueType: QueryAggregationValueType;
}) => S.Array(S.Struct({ key: aggregationKeyCodec(types.keyType), value: sharedCodec[types.valueType.type] }));

// -----------------------------------------------------------------------------
// Type references
// -----------------------------------------------------------------------------

const failingCodec = (message: string): S.Codec<unknown, unknown> =>
  S.Never.annotate({ description: message, message });

// Type references a data type reaches without reading any input: its own, and those of the alternatives
// of a union.
const unguardedReferences: (dataType: QueryDataType) => ReadonlyArray<TypeReferenceId> = QueryDataType.matchOrElse(
  {
    typeReference: ({ typeId }) => A.of(typeId),
    union: ({ unionTypes }) => A.flatMap(unionTypes, unguardedReferences),
  },
  A.empty<TypeReferenceId>
);

// A name whose definition leads back to itself without reading any input (`a = a`, `a = b` with
// `b = a | null`) describes no value, and unfolding it would never stop.
const refersOnlyToItself = (typeReferences: TypeReferences, typeId: TypeReferenceId): boolean => {
  const visited = MutableHashSet.empty<TypeReferenceId>();
  const leadsBack = (current: TypeReferenceId): boolean => {
    if (MutableHashSet.has(visited, current)) {
      return false;
    }
    MutableHashSet.add(visited, current);
    return pipe(
      R.get(typeReferences, current),
      O.exists((dataType) => A.some(unguardedReferences(dataType), (next) => next === typeId || leadsBack(next)))
    );
  };
  return leadsBack(typeId);
};

// -----------------------------------------------------------------------------
// The projection
// -----------------------------------------------------------------------------

// One projection per set of named types: every reference to a name shares one codec, which is what makes
// the schema of a recursive type a finite graph.
const projection = (typeReferences: TypeReferences): ((dataType: QueryDataType) => S.Codec<unknown, unknown>) => {
  const resolved = MutableHashMap.empty<TypeReferenceId, S.Codec<unknown, unknown>>();

  const define = (typeId: TypeReferenceId): S.Codec<unknown, unknown> =>
    refersOnlyToItself(typeReferences, typeId)
      ? failingCodec(`Type reference "${typeId}" refers only to itself`)
      : pipe(
          R.get(typeReferences, typeId),
          O.match({
            onNone: () => failingCodec(`Unknown type reference "${typeId}"`),
            onSome: project,
          })
        );

  const referenced = (typeId: TypeReferenceId): S.Codec<unknown, unknown> =>
    pipe(
      MutableHashMap.get(resolved, typeId),
      O.getOrElse(() => {
        const codec = define(typeId);
        MutableHashMap.set(resolved, typeId, codec);
        return codec;
      })
    );

  // A field whose type allows null may also be left out of the struct. Both decode to none, and none is
  // written as `null`, which is what the declared type says.
  const structFieldEntry = ({ name, fieldType }: QueryStructField) =>
    Tuple.make(
      name,
      O.isSome(nonNullAlternative(fieldType))
        ? project(fieldType).pipe(S.withDecodingDefaultKey(Effect.succeed(null)))
        : project(fieldType)
    );

  const project: (dataType: QueryDataType) => S.Codec<unknown, unknown> = QueryDataType.matchOrElse(
    {
      // The hint bounds generated lists and constrains no value: a type may contain itself through a list.
      array: ({ elementType }) => S.Array(project(elementType)).check(RecursiveArraySizeHint),
      set: ({ elementType }) => hashSetCodec(project(elementType)),
      entrySet: ({ keyType, valueType }) => hashMapCodec(project(keyType), project(valueType)),
      struct: ({ fields }) => structCodec(A.map(fields, structFieldEntry)),
      union: (union) =>
        O.match(nonNullAlternative(union), {
          onNone: () => S.Union(A.map(union.unionTypes, project)),
          onSome: (alternative) => S.OptionFromNullOr(project(alternative)),
        }),
      twoDimensionalAggregation: (types) => S.Struct({ groups: aggregationGroupsCodec(types) }),
      threeDimensionalAggregation: ({ keyType, valueType }) =>
        S.Struct({
          groups: S.Array(S.Struct({ key: aggregationKeyCodec(keyType), groups: aggregationGroupsCodec(valueType) })),
        }),
      typeReference: ({ typeId }) => S.suspend(() => referenced(typeId)),
    },
    (leaf) => leafCodec[leaf.type]
  );

  return project;
};

/**
 * The codec of one value of the given query data type: wire JSON on the encoded side, domain value on the type side.
 *
 * **Details**
 *
 * A leaf type is read from {@link leafCodec} by its tag. The other types are
 * unfolded, and the facts they state precipitate into the codec:
 *
 * - a `set` travels as a JSON array and is a `HashSet` in the domain; an
 *   `entrySet` travels as a list of `{ key, value }` entries and is a
 *   `HashMap`;
 * - a `union` that contains the `null` tag is an `Option` of what remains,
 *   whichever position `null` is declared in; any other union tries its
 *   alternatives in declaration order;
 * - an object is its primary key, an interface object its object type and
 *   primary key, an attachment its identifier, and an object set the
 *   identifier of a stored set or a definition written in place;
 * - an aggregation has the shape of `TwoDimensionalAggregation` or
 *   `ThreeDimensionalAggregation`, with keys, range bounds and values read by
 *   the scalar codecs the type declares, so a timestamp key is an instant
 *   and not text;
 * - a `typeReference` is looked up in `typeReferences` when a value first
 *   reaches it, so a type that contains itself projects to a finite schema.
 *
 * `null` holds only `null`, `void` holds only `undefined` (written as
 * `null`), and `unsupported` promises nothing, so its value stays JSON. A
 * reference to a name that is not defined, or to a name that only refers to
 * itself, projects to a codec that rejects every value: the projection stays
 * total where OSDK throws `Unknown typeReference`. The static type is loose
 * (`unknown`) because the data type is only known at runtime.
 *
 * **Example** (Unfold a recursive tree as deep as the value goes)
 *
 * ```ts import.meta.vitest name="Unfold a recursive tree as deep as the value goes"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { QueryType, valueCodec } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const walkTree = await Effect.runPromise(
 *   S.decodeUnknownEffect(QueryType)({
 *     apiName: "walkTree",
 *     parameters: {},
 *     output: { type: "typeReference", typeId: "tree-node" },
 *     rid: "ri.function-registry.main.function.d4f69e63-9531-55ff-0a1c-4896e0a0bee5",
 *     version: "0.1.0",
 *     typeReferences: {
 *       "tree-node": {
 *         type: "struct",
 *         fields: [
 *           { name: "addedOn", fieldType: { type: "date" } },
 *           {
 *             name: "children",
 *             fieldType: { type: "array", subType: { type: "typeReference", typeId: "tree-node" } },
 *           },
 *         ],
 *       },
 *     },
 *   })
 * )
 * const codec = valueCodec(walkTree.output, walkTree.typeReferences)
 * const accepts = (value: unknown) => O.isSome(S.decodeUnknownOption(codec)(value))
 * const leaf = { addedOn: "2021-05-01", children: [] }
 * const verdicts = [
 *   accepts({ addedOn: "2021-04-30", children: [leaf, { addedOn: "2021-05-02", children: [leaf] }] }),
 *   accepts({ addedOn: "2021-04-30", children: [{ addedOn: "May Day", children: [] }] }),
 * ]
 * verdicts // => [true, false]
 * ```
 *
 * @param dataType - The data type whose values the codec reads and writes.
 * @param typeReferences - The named data types of the enclosing query type, which by-name references resolve against.
 * @returns A codec with the wire JSON on the encoded side and the domain value on the type side.
 * @category projections
 * @since 0.0.0
 */
export const valueCodec: {
  (typeReferences: TypeReferences): (dataType: QueryDataType) => S.Codec<unknown, unknown>;
  (dataType: QueryDataType, typeReferences: TypeReferences): S.Codec<unknown, unknown>;
} = dual(
  2,
  (dataType: QueryDataType, typeReferences: TypeReferences): S.Codec<unknown, unknown> =>
    projection(typeReferences)(dataType)
);

/**
 * The codec of the argument record of one call of the given query type.
 *
 * **Details**
 *
 * A required parameter is a required key. A parameter that is not required
 * is an `Option`: none when the call leaves it out, which is not the same
 * message as supplying `null`. Whether `null` may be supplied is a separate
 * statement, made by the parameter's own data type, so an optional parameter
 * of a nullable type is an `Option` of an `Option`. OSDK discards `required`
 * and reads optionality from the type alone.
 *
 * A key that names no parameter is rejected in both directions, where a plain
 * struct would drop it. Anything that holds the `parameters` and the
 * `typeReferences` of a query type can be projected.
 *
 * **Example** (Write the arguments of a call)
 *
 * ```ts import.meta.vitest name="Write the arguments of a call"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { parametersCodec, QueryType } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const countSince = await Effect.runPromise(
 *   S.decodeUnknownEffect(QueryType)({
 *     apiName: "countSince",
 *     parameters: {
 *       since: { dataType: { type: "timestamp" }, required: true },
 *       limit: { dataType: { type: "integer" }, required: false },
 *     },
 *     output: { type: "integer" },
 *     rid: "ri.function-registry.main.function.abd64ff3-276e-48c5-afee-5a6ef0b2ea47",
 *     version: "0.0.9",
 *   })
 * )
 * const wire = await Effect.runPromise(
 *   S.encodeUnknownEffect(parametersCodec(countSince))({ since: DateTime.makeUnsafe(0), limit: O.none() })
 * )
 * wire // => { since: "1970-01-01T00:00:00.000Z" }
 * ```
 *
 * @param queryType - The query type, or anything else that holds its parameters and named types.
 * @returns A codec of the argument record, keyed by parameter identifier.
 * @category projections
 * @since 0.0.0
 */
export const parametersCodec = ({
  parameters,
  typeReferences,
}: Pick<QueryType, "parameters" | "typeReferences">): S.Codec<
  Readonly<Record<string, unknown>>,
  Readonly<Record<string, unknown>>
> => {
  const project = projection(typeReferences);
  const parameterField = ({ dataType, required }: QueryParameter) =>
    required ? project(dataType) : S.OptionFromOptionalKey(project(dataType));
  return closedRecordCodec(R.map(parameters, parameterField));
};

/**
 * The codec of what one call of the given query type returns.
 *
 * **Details**
 *
 * This is {@link valueCodec} applied to the query type's own output and named
 * types, so a result is decoded by the signature that produced it.
 *
 * **Example** (Read a returned map as a HashMap)
 *
 * ```ts import.meta.vitest name="Read a returned map as a HashMap"
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { outputCodec, QueryType } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const headcounts = await Effect.runPromise(
 *   S.decodeUnknownEffect(QueryType)({
 *     apiName: "headcountByOffice",
 *     parameters: {},
 *     output: { type: "entrySet", keyType: { type: "string" }, valueType: { type: "integer" } },
 *     rid: "ri.function-registry.main.function.c3e58d52-8430-44ee-9f0b-3785d9a9bdd2",
 *     version: "0.1.1",
 *   })
 * )
 * const result = await Effect.runPromise(
 *   S.decodeUnknownEffect(outputCodec(headcounts))([
 *     { key: "NYC", value: 120 },
 *     { key: "LON", value: 80 },
 *   ])
 * )
 * const london = HashMap.isHashMap(result) ? O.getOrNull(HashMap.get(result, "LON")) : null
 * london // => 80
 * ```
 *
 * @param queryType - The query type, or anything else that holds its output and named types.
 * @returns A codec with the wire JSON on the encoded side and the domain value on the type side.
 * @category projections
 * @since 0.0.0
 */
export const outputCodec = ({
  output,
  typeReferences,
}: Pick<QueryType, "output" | "typeReferences">): S.Codec<unknown, unknown> => valueCodec(output, typeReferences);
