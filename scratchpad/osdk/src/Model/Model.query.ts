/**
 * Typed queries: a query type written once, in code, from which the codecs of its parameters and output are derived.
 *
 * **Details**
 *
 * `Query.parametersCodec` and `Query.outputCodec` turn a query type known
 * only at runtime into codecs of `unknown`. {@link query} makes the same
 * pairing at authoring time from exchange specs, so a call site is checked by
 * the compiler and what comes back is typed.
 *
 * A query shares most of its exchange specs with an action (`Model.string`,
 * `Model.listOf`, `Model.structOf`, `Model.nullable`,
 * `Model.objectReference`, `Model.objectSetOf` ...). This file adds the tags
 * only a query has: sets, maps, unions, sets of interface objects (the row
 * `Query.leafCodec` holds under that tag) and the two aggregation values. A
 * `set` is an `effect/HashSet` and a map (`entrySet` on
 * the wire) an `effect/HashMap`, as `Query.valueCodec` projects them.
 *
 * This replaces OSDK's `QueryDefinition`, its `QueryParam.*` and
 * `QueryResult.*` type algebras and the generated `executeFunction`
 * signatures. {@link queryConformance} checks a hand-written model against the
 * query type the platform serves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import type { QueryDataTypeKind } from "../DataType/DataType.values.ts";
import { DataTypeKind } from "../DataType/DataType.values.ts";
import {
    FunctionVersion,
    InterfaceTypeApiName,
    ParameterId,
    QueryApiName,
    StructFieldApiName,
} from "../Identifier/Identifier.model.ts";
import { leafCodec } from "../Query/Query.behavior.ts";
import type { QueryType, TypeReferenceId } from "../Query/Query.model.ts";
import {
    nonNullAlternative,
    QueryDataType,
    ThreeDimensionalAggregation,
    TwoDimensionalAggregation,
} from "../Query/Query.model.ts";
import type { ParameterSpec } from "./Model.action.ts";
import {
    MissingParameter,
    MissingValueField,
    ReferenceTargetMismatch,
    RequiredMismatch,
    UndeclaredRequiredParameter,
    ValueTagMismatch,
} from "./Model.action.ts";
import type { TypePathStep } from "./Model.policy.ts";
import { ElementStep, FieldStep } from "./Model.policy.ts";
import type { ExchangeSpec, ReferenceTarget, SpecShape, ValueSpec } from "./Model.spec.ts";

const $I = $ScratchpadId.create("osdk/Model/Model.query");

const exchange = <const Kind extends DataTypeKind, Value extends S.Top>(
  kind: Kind,
  value: Value,
  shape: SpecShape
): ExchangeSpec<Kind, Value, Value> => ({ kind, value, member: value, shape });

const leafShape: SpecShape = { type: "leaf" };

// -----------------------------------------------------------------------------
// Collections
// -----------------------------------------------------------------------------

/**
 * Spec of a `set`: a JSON array on the wire and a `HashSet` in the domain, so duplicates on the wire collapse.
 *
 * **Example** (Read a returned set as a HashSet)
 *
 * ```ts import.meta.vitest name="Read a returned set as a HashSet"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const tags = Model.setOf(Model.string)
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(tags.value)(["alpha", "bravo", "alpha"]))
 * const facts = [HashSet.size(decoded), HashSet.has(decoded, "bravo")]
 * facts // => [2, true]
 * ```
 *
 * @param element - Spec of every member.
 * @category constructors
 * @since 0.0.0
 */
export const setOf = <Value extends S.Top>(element: ExchangeSpec<DataTypeKind, Value>) =>
  exchange(
    "set",
    S.Array(element.value).pipe(
      S.decodeTo(
        element.value.pipe(S.toType, S.HashSet),
        SchemaTransformation.transform({
          decode: (members) => HashSet.fromIterable(members),
          encode: (members) => A.fromIterable(members),
        })
      )
    ),
    { type: "list", element }
  );

// The key and value codecs are taken as codecs of known types, not as schema type parameters: the
// entry record is read field by field, which the compiler can only follow for a struct of known fields.
const mapOfImpl = <Key, KeyEncoded, Value, ValueEncoded>(
  key: ExchangeSpec<DataTypeKind, S.Codec<Key, KeyEncoded>>,
  value: ExchangeSpec<DataTypeKind, S.Codec<Value, ValueEncoded>>
) =>
  exchange(
    "entrySet",
    S.Array(S.Struct({ key: key.value, value: value.value })).pipe(
      S.decodeTo(
        S.HashMap(S.toType(key.value), S.toType(value.value)),
        SchemaTransformation.transform({
          decode: (entries) => HashMap.fromIterable(A.map(entries, (entry) => Tuple.make(entry.key, entry.value))),
          encode: (entries) =>
            A.map(A.fromIterable(entries), ([entryKey, entryValue]) => ({ key: entryKey, value: entryValue })),
        })
      )
    ),
    { type: "entries", key, value }
  );

/**
 * Spec of a map: a list of `{ key, value }` entries on the wire (the `entrySet` tag) and a `HashMap` in the domain.
 *
 * **Details**
 *
 * Keys are compared the way `effect/HashMap` compares them, so a key decoded
 * to a rich value (a date, an instant) is found by an equal value.
 *
 * **Example** (Read a returned map as a typed HashMap)
 *
 * ```ts import.meta.vitest name="Read a returned map as a typed HashMap"
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const headcounts = Model.mapOf(Model.string, Model.integer)
 * const decoded = await Effect.runPromise(
 *   S.decodeUnknownEffect(headcounts.value)([
 *     { key: "NYC", value: 120 },
 *     { key: "LON", value: 80 },
 *   ])
 * )
 * O.getOrNull(HashMap.get(decoded, "LON")) // => 80
 * ```
 *
 * @param key - Spec of every entry's key.
 * @param value - Spec of every entry's value.
 * @category constructors
 * @since 0.0.0
 */
export const mapOf: {
  <Value, ValueEncoded>(
    value: ExchangeSpec<DataTypeKind, S.Codec<Value, ValueEncoded>>
  ): <Key, KeyEncoded>(
    key: ExchangeSpec<DataTypeKind, S.Codec<Key, KeyEncoded>>
  ) => ReturnType<typeof mapOfImpl<Key, KeyEncoded, Value, ValueEncoded>>;
  <Key, KeyEncoded, Value, ValueEncoded>(
    key: ExchangeSpec<DataTypeKind, S.Codec<Key, KeyEncoded>>,
    value: ExchangeSpec<DataTypeKind, S.Codec<Value, ValueEncoded>>
  ): ReturnType<typeof mapOfImpl<Key, KeyEncoded, Value, ValueEncoded>>;
} = dual(2, mapOfImpl);

interface ValueOf extends Struct.Lambda {
  <Value extends S.Top>(spec: { readonly value: Value }): Value;
  readonly "~lambda.out": this["~lambda.in"] extends { readonly value: infer Value extends S.Top } ? Value : never;
}

/**
 * Spec of a value that is one of several alternatives, tried in declaration order.
 *
 * **Details**
 *
 * For "a value or nothing" use `Model.nullable`, which reads as an `Option`;
 * this constructor is for alternatives that are all values.
 *
 * **Example** (Accept text or a number)
 *
 * ```ts import.meta.vitest name="Accept text or a number"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const accepts = S.is(Model.unionOf([Model.string, Model.integer]).value)
 * const verdicts = [accepts("NYC"), accepts(7), accepts(true)]
 * verdicts // => [true, true, false]
 * ```
 *
 * @param alternatives - Spec of each alternative.
 * @category constructors
 * @since 0.0.0
 */
export const unionOf = <const Specs extends ReadonlyArray<ExchangeSpec>>(alternatives: Specs) =>
  exchange(
    "union",
    S.Union(
      Tuple.map(
        alternatives,
        Struct.lambda<ValueOf>((alternative) => alternative.value)
      )
    ),
    { type: "union", alternatives }
  );

// -----------------------------------------------------------------------------
// Leaves and references only queries have
// -----------------------------------------------------------------------------

/**
 * Spec of a set of objects that all implement the named interface: a stored set's identifier or an inline definition.
 *
 * **Example** (Pass every object that implements an interface)
 *
 * ```ts import.meta.vitest name="Pass every object that implements an interface"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { interfaceType } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const located = Model.interfaceObjectSetOf("Located")
 * const wire = await Effect.runPromise(S.encodeEffect(located.value)(interfaceType("Located")))
 * const facts = [located.kind, wire]
 * facts // => ["interfaceObjectSet", { type: "interfaceBase", interfaceType: "Located" }]
 * ```
 *
 * @param interfaceType - API name of the interface.
 * @throws When the name is the empty string.
 * @category constructors
 * @since 0.0.0
 */
export const interfaceObjectSetOf = (interfaceType: string) =>
  exchange("interfaceObjectSet", leafCodec.interfaceObjectSet, {
    type: "reference",
    target: O.some(InterfaceTypeApiName.make(interfaceType)),
  });

/**
 * Spec of a grouped measurement: one value per group key, as `Query.TwoDimensionalAggregation`.
 *
 * **Details**
 *
 * The value keeps the wire's `groups` envelope. Keys and values are the
 * ontology-free scalars of `TwoDimensionalAggregation`; the key and value
 * types the query type declares are not tracked by this spec.
 *
 * **Example** (Read a grouped measurement)
 *
 * ```ts import.meta.vitest name="Read a grouped measurement"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const aggregation = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.twoDimensionalAggregation.value)({
 *     groups: [
 *       { key: "Q-AFN", value: 1 },
 *       { key: "Q-AFO", value: 2 },
 *     ],
 *   })
 * )
 * const values = A.map(aggregation.groups, (group) => group.value)
 * values // => [1, 2]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const twoDimensionalAggregation = exchange("twoDimensionalAggregation", TwoDimensionalAggregation, leafShape);

/**
 * Spec of a measurement grouped twice: one value per pair of outer and inner keys.
 *
 * **Details**
 *
 * The value is a `Query.ThreeDimensionalAggregation`, with the wire's `groups` envelope at both levels.
 *
 * **Example** (Read a measurement grouped twice)
 *
 * ```ts import.meta.vitest name="Read a measurement grouped twice"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const aggregation = await Effect.runPromise(
 *   S.decodeUnknownEffect(Model.threeDimensionalAggregation.value)({
 *     groups: [
 *       { key: "Q-AFN", groups: [{ key: { startValue: 0, endValue: 10 }, value: 65 }] },
 *       { key: "Q-AFO", groups: [] },
 *     ],
 *   })
 * )
 * const sizes = A.map(aggregation.groups, (outer) => outer.groups.length)
 * sizes // => [1, 0]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const threeDimensionalAggregation = exchange(
  "threeDimensionalAggregation",
  ThreeDimensionalAggregation,
  leafShape
);

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

interface InputOf extends Struct.Lambda {
  <Input extends S.Top>(parameter: { readonly input: Input }): Input;
  readonly "~lambda.out": this["~lambda.in"] extends { readonly input: infer Input extends S.Top } ? Input : never;
}

/**
 * Maps a record of parameter specs to the record of their query input codecs, key by key.
 *
 * **Details**
 *
 * The query-side twin of `Model.argumentsOf`: a required parameter maps to its
 * value codec, an optional one to an `Option` whose none leaves the key out.
 *
 * **Example** (Build a parameter struct by hand)
 *
 * ```ts import.meta.vitest name="Build a parameter struct by hand"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Parameters = S.Struct(
 *   Model.inputsOf({ n: Model.requiredParameter(Model.integer), limit: Model.optionalParameter(Model.integer) })
 * )
 * const wire = await Effect.runPromise(S.encodeEffect(Parameters)({ n: 3, limit: O.none() }))
 * wire // => { n: 3 }
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const inputsOf: <const Specs extends Readonly<Record<string, ParameterSpec>>>(
  specs: Specs
) => { [K in keyof Specs]: Struct.Apply<InputOf, Specs[K]> } = Struct.map(
  Struct.lambda<InputOf>((parameter) => parameter.input)
);

/**
 * What {@link query} needs to know about a query type.
 *
 * @typeParam ApiName - The query's API name.
 * @typeParam Specs - The spec of every parameter, keyed by parameter identifier.
 * @typeParam OutputKind - The type tag of what the query returns.
 * @typeParam Output - The codec of what the query returns.
 * @category models
 * @since 0.0.0
 */
export interface QueryModelDefinition<
  ApiName extends string,
  Specs extends Readonly<Record<string, ParameterSpec<QueryDataTypeKind>>>,
  OutputKind extends QueryDataTypeKind,
  Output extends S.Top,
> {
  readonly apiName: ApiName;
  readonly version: O.Option<string>;
  readonly parameters: Specs;
  readonly output: ExchangeSpec<OutputKind, Output>;
}

/**
 * Defines a query model and derives the codecs of its parameters and of what it returns.
 *
 * **Details**
 *
 * The result carries the definition as given plus two codecs:
 *
 * - `Parameters`, a struct codec with one key per parameter. A required
 *   parameter is a required key. An optional one is an `Option`: none leaves
 *   the key out, which is not the same message as supplying `null`. Whether
 *   `null` may be supplied is said by the parameter's own spec
 *   (`Model.nullable`), so an optional parameter of a nullable type is an
 *   `Option` of an `Option`.
 * - `Output`, the codec of the value a call returns.
 *
 * `version` pins the version of the function a call runs; none runs the
 * latest. The compiler accepts only tags a query data type can have.
 * `Client.executeQuery` takes the model.
 *
 * **Example** (Define a query and read its output)
 *
 * ```ts import.meta.vitest name="Define a query and read its output"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const TitlesSince = Model.query({
 *   apiName: "titlesSince",
 *   version: O.some("0.0.9"),
 *   parameters: {
 *     since: Model.requiredParameter(Model.timestamp),
 *     limit: Model.optionalParameter(Model.integer),
 *   },
 *   output: Model.setOf(Model.string),
 * })
 * const wire = await Effect.runPromise(
 *   S.encodeEffect(TitlesSince.Parameters)({ since: DateTime.makeUnsafe(0), limit: O.none() })
 * )
 * const titles = await Effect.runPromise(S.decodeUnknownEffect(TitlesSince.Output)(["Director", "Director"]))
 * const facts = [wire, HashSet.size(titles)]
 * facts // => [{ since: "1970-01-01T00:00:00.000Z" }, 1]
 * ```
 *
 * @param definition - The query's name, pinned version, parameter specs and output spec.
 * @category constructors
 * @since 0.0.0
 */
export const query = <
  const ApiName extends string,
  const Specs extends Readonly<Record<string, ParameterSpec<QueryDataTypeKind>>>,
  OutputKind extends QueryDataTypeKind,
  Output extends S.Top,
>(
  definition: QueryModelDefinition<ApiName, Specs, OutputKind, Output>
) => {
  const { apiName, version, parameters, output } = definition;
  const identifier: string = apiName;
  const Parameters = S.Struct(inputsOf<Specs>(parameters)).pipe(
    $I.annoteSchema(`${identifier}Parameters`, {
      description: `The arguments of one call of the ${identifier} query, keyed by parameter.`,
    })
  );
  return { apiName, version, parameters, output, Parameters, Output: output.value };
};

// -----------------------------------------------------------------------------
// Findings
// -----------------------------------------------------------------------------

/**
 * The served query type has another API name than the model declares.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryNameMismatch extends S.Opaque<QueryNameMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("queryNameMismatch"),
    declared: QueryApiName.annotateKey({ description: "API name the model declares." }),
    served: QueryApiName.annotateKey({ description: "API name of the served query type." }),
  }).pipe(
    $I.annoteSchema("QueryNameMismatch", {
      description: "The served query type has another API name than the model declares.",
    })
  )
) {}

/**
 * The model pins another version of the function than the served signature belongs to.
 *
 * @category models
 * @since 0.0.0
 */
export class QueryVersionMismatch extends S.Opaque<QueryVersionMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("queryVersionMismatch"),
    declared: S.String.annotateKey({ description: "Version the model pins." }),
    served: FunctionVersion.annotateKey({ description: "Version the served signature belongs to." }),
  }).pipe(
    $I.annoteSchema("QueryVersionMismatch", {
      description: "The model pins another version of the function than the served signature belongs to.",
    })
  )
) {}

const QueryFindingKind = LiteralKit([
  "queryNameMismatch",
  "queryVersionMismatch",
  "missingParameter",
  "undeclaredRequiredParameter",
  "requiredMismatch",
  "valueTagMismatch",
  "missingValueField",
  "referenceTargetMismatch",
]);

/**
 * One way a query model disagrees with the query type the platform serves.
 *
 * **Details**
 *
 * The findings about values are those of an action (`Model.ActionFinding`).
 * Their `parameter` is none when the place is what the query returns, and
 * their `path` leads into it: the element of a list or set, the field of a
 * struct, the `key` or `value` of a map.
 *
 * **Example** (Describe a query finding with one exhaustive match)
 *
 * ```ts import.meta.vitest name="Describe a query finding with one exhaustive match"
 * import * as O from "effect/Option"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const place = O.match({ onNone: () => "the output", onSome: (parameter: string) => parameter })
 * const describe = Model.QueryFinding.match({
 *   queryNameMismatch: ({ served }) => `serves ${served}`,
 *   queryVersionMismatch: ({ served }) => `serves version ${served}`,
 *   missingParameter: ({ parameter }) => `no parameter ${parameter}`,
 *   undeclaredRequiredParameter: ({ parameter }) => `${parameter} is required and not declared`,
 *   requiredMismatch: ({ parameter, served }) => `${parameter} is ${served ? "required" : "optional"}`,
 *   valueTagMismatch: ({ parameter, declared, served }) => `${place(parameter)} is ${served}, not ${declared}`,
 *   missingValueField: ({ parameter, field }) => `${place(parameter)} has no field ${field}`,
 *   referenceTargetMismatch: ({ parameter, served }) => `${place(parameter)} refers to ${served}`,
 * })
 * const finding = Model.QueryFinding.cases.valueTagMismatch.make({
 *   parameter: O.none(),
 *   path: [],
 *   declared: "integer",
 *   served: "string",
 * })
 * describe(finding) // => "the output is string, not integer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QueryFinding = QueryFindingKind.mapMembers(() =>
  Tuple.make(
    QueryNameMismatch,
    QueryVersionMismatch,
    MissingParameter,
    UndeclaredRequiredParameter,
    RequiredMismatch,
    ValueTagMismatch,
    MissingValueField,
    ReferenceTargetMismatch
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("QueryFinding", {
    description: "One way a query model disagrees with the query type the platform serves.",
  })
);

/**
 * Runtime type of {@link QueryFinding}.
 *
 * @category models
 * @since 0.0.0
 */
export type QueryFinding = typeof QueryFinding.Type;

// -----------------------------------------------------------------------------
// The comparison
// -----------------------------------------------------------------------------

type Findings = ReadonlyArray<QueryFinding>;
type Path = ReadonlyArray<TypePathStep>;
type TypeReferences = QueryType["typeReferences"];

const none: Findings = A.empty();

const unless = (agree: boolean, finding: () => QueryFinding): Findings => (agree ? none : A.of(finding()));

// Follows by-name references to the data type they stand for. A name that leads back to itself is
// left as the reference it is, so the walk always ends.
const resolved = (
  typeReferences: TypeReferences,
  dataType: QueryDataType,
  seen: ReadonlyArray<TypeReferenceId>
): QueryDataType =>
  QueryDataType.guards.typeReference(dataType) && !A.contains(seen, dataType.typeId)
    ? pipe(
        R.get(typeReferences, dataType.typeId),
        O.match({
          onNone: () => dataType,
          onSome: (next) => resolved(typeReferences, next, A.append(seen, dataType.typeId)),
        })
      )
    : dataType;

const servedElement: (dataType: QueryDataType) => O.Option<QueryDataType> = QueryDataType.matchOrElse(
  {
    array: ({ elementType }) => O.some(elementType),
    set: ({ elementType }) => O.some(elementType),
  },
  O.none<QueryDataType>
);

const servedTarget: (dataType: QueryDataType) => O.Option<ReferenceTarget> = QueryDataType.matchOrElse(
  {
    object: ({ objectTypeApiName }) => O.some<ReferenceTarget>(objectTypeApiName),
    objectSet: ({ objectTypeApiName }): O.Option<ReferenceTarget> => objectTypeApiName,
    interfaceObject: ({ interfaceTypeApiName }): O.Option<ReferenceTarget> => interfaceTypeApiName,
    interfaceObjectSet: ({ interfaceTypeApiName }) => O.some<ReferenceTarget>(interfaceTypeApiName),
  },
  O.none<ReferenceTarget>
);

const fieldStep = (name: string): TypePathStep => FieldStep.make({ name: StructFieldApiName.make(name) });

// Compares one spec with the served data type at the same place. A nullable spec is compared with
// what the served union leaves once `null` is set aside; every other spec first by tag, then through
// what it nests.
const compareValue = (
  typeReferences: TypeReferences,
  parameter: O.Option<ParameterId>,
  path: Path,
  declared: ValueSpec,
  servedType: QueryDataType
): Findings => {
  const served = resolved(typeReferences, servedType, A.empty());
  const descend = (step: TypePathStep, nested: ValueSpec, nestedServed: QueryDataType): Findings =>
    compareValue(typeReferences, parameter, A.append(path, step), nested, nestedServed);
  const mismatch = (): Findings =>
    A.of(ValueTagMismatch.make({ parameter, path, declared: declared.kind, served: served.type }));
  return pipe(
    Match.value(declared.shape),
    Match.discriminators("type")({
      nullable: ({ inner }) =>
        O.match(nonNullAlternative(served), {
          onNone: mismatch,
          onSome: (alternative) => compareValue(typeReferences, parameter, path, inner, alternative),
        }),
    }),
    Match.orElse((shape) =>
      declared.kind === served.type
        ? pipe(
            Match.value(shape),
            Match.discriminatorsExhaustive("type")({
              leaf: () => none,
              vector: () => none,
              union: () => none,
              list: ({ element }) =>
                O.match(servedElement(served), {
                  onNone: () => none,
                  onSome: (elementType) => descend(ElementStep.make({}), element, elementType),
                }),
              struct: ({ fields }) =>
                QueryDataType.guards.struct(served)
                  ? A.flatMap(R.toEntries(fields), ([name, field]) =>
                      pipe(
                        A.findFirst(served.fields, (servedField) => servedField.name === name),
                        O.match({
                          onNone: (): Findings =>
                            A.of(MissingValueField.make({ parameter, path, field: StructFieldApiName.make(name) })),
                          onSome: (servedField) => descend(fieldStep(name), field, servedField.fieldType),
                        })
                      )
                    )
                  : none,
              entries: ({ key, value }) =>
                QueryDataType.guards.entrySet(served)
                  ? A.appendAll(
                      descend(fieldStep("key"), key, served.keyType),
                      descend(fieldStep("value"), value, served.valueType)
                    )
                  : none,
              reference: ({ target }) =>
                pipe(
                  O.all({ declaredTarget: target, target: servedTarget(served) }),
                  O.match({
                    onNone: () => none,
                    onSome: ({ declaredTarget, target: stated }) =>
                      unless(declaredTarget === stated, () =>
                        ReferenceTargetMismatch.make({ parameter, path, declared: declaredTarget, served: stated })
                      ),
                  })
                ),
            })
          )
        : mismatch()
    )
  );
};

// What the comparison reads of a query model, whatever its parameters and output are.
interface DeclaredQuery {
  readonly apiName: string;
  readonly version: O.Option<string>;
  readonly parameters: Readonly<Record<string, ParameterSpec>>;
  readonly output: ValueSpec;
}

/**
 * Every way a query model disagrees with a served query type; empty when the model conforms.
 *
 * **Details**
 *
 * The comparison covers what a call relies on:
 *
 * - the query's API name, and its version when the model pins one;
 * - each declared parameter: that it exists, is required exactly when the
 *   server requires it, and has the same data type;
 * - each served parameter the model does not declare: a finding when the
 *   server requires it;
 * - the output's data type.
 *
 * Data types are compared by tag, looking through lists and sets to their
 * element, through structs to each declared field, through maps to their key
 * and value, through a nullable value to what it wraps, and through by-name
 * type references to what they stand for. A reference is also compared by the
 * object type or interface it ranges over, when both sides state one.
 *
 * **Example** (Catch an output that became nullable)
 *
 * ```ts import.meta.vitest name="Catch an output that became nullable"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { QueryType } from "@beep/scratchpad/osdk/src/Query/index"
 *
 * const AddOne = Model.query({
 *   apiName: "addOne",
 *   version: O.some("0.0.9"),
 *   parameters: { n: Model.requiredParameter(Model.integer) },
 *   output: Model.integer,
 * })
 * const served = await Effect.runPromise(
 *   S.decodeUnknownEffect(QueryType)({
 *     apiName: "addOne",
 *     parameters: { n: { dataType: { type: "integer" }, required: true } },
 *     output: { type: "union", unionTypes: [{ type: "integer" }, { type: "null" }] },
 *     rid: "ri.function-registry.main.function.abd64ff3-276e-48c5-afee-5a6ef0b2ea47",
 *     version: "0.1.0",
 *   })
 * )
 * const findings = A.map(Model.queryConformance(AddOne, served), (finding) => finding.type)
 * findings // => ["queryVersionMismatch", "valueTagMismatch"]
 * ```
 *
 * @throws When the model declares an empty query, parameter or struct field name that has to be reported.
 * @category policies
 * @since 0.0.0
 */
export const queryConformance: {
  (queryType: QueryType): (model: DeclaredQuery) => ReadonlyArray<QueryFinding>;
  (model: DeclaredQuery, queryType: QueryType): ReadonlyArray<QueryFinding>;
} = dual(2, (model: DeclaredQuery, queryType: QueryType): ReadonlyArray<QueryFinding> => {
  const { typeReferences } = queryType;
  return A.flatten([
    unless(queryType.apiName === model.apiName, () =>
      QueryNameMismatch.make({ declared: QueryApiName.make(model.apiName), served: queryType.apiName })
    ),
    O.match(model.version, {
      onNone: () => none,
      onSome: (declared) =>
        unless(declared === queryType.version, () =>
          QueryVersionMismatch.make({ declared, served: queryType.version })
        ),
    }),
    A.flatMap(R.toEntries(model.parameters), ([name, declared]) =>
      pipe(
        R.findFirst(queryType.parameters, (_, key) => key === name),
        O.match({
          onNone: (): Findings => A.of(MissingParameter.make({ parameter: ParameterId.make(name) })),
          onSome: ([parameter, served]) =>
            A.appendAll(
              compareValue(typeReferences, O.some(parameter), A.empty(), declared, served.dataType),
              unless((declared.presence === "required") === served.required, () =>
                RequiredMismatch.make({
                  parameter,
                  path: A.empty(),
                  declared: declared.presence === "required",
                  served: served.required,
                })
              )
            ),
        })
      )
    ),
    A.flatMap(R.toEntries(queryType.parameters), ([parameter, served]) =>
      unless(!served.required || R.has(model.parameters, parameter), () =>
        UndeclaredRequiredParameter.make({ parameter })
      )
    ),
    compareValue(typeReferences, O.none(), A.empty(), model.output, queryType.output),
  ]);
});
