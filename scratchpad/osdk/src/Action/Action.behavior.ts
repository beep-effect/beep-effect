/**
 * Projections from the parameter types of an action to the codecs of the arguments a request carries.
 *
 * **Details**
 *
 * An action type is data, and the wire types every argument as `any`. The
 * functions here read that data and return schemas, so the arguments of a
 * request are checked and converted by the action type itself:
 *
 * - {@link leafCodec} is the table of the leaf types of both universes: the
 *   rows every universe shares (`sharedCodec` of `Value`) and the rows only an
 *   action has.
 * - {@link argumentCodec} turns one {@link ActionParameterType} into the codec
 *   of one argument.
 * - {@link fieldValueCodec} does the same for the wider universe a struct
 *   parameter's fields are drawn from.
 * - {@link argumentsCodec} turns a whole action type into the codec of its
 *   argument record, required keys and all.
 *
 * Each projection unfolds the types that hold other types and reads every
 * other type from the table by its tag, so a new parameter type is a compile
 * error until its argument codec exists.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { ActionParameterTypeKind } from "../DataType/DataType.values.ts";
import { GeoPoint } from "../Geo/Geo.model.ts";
import { AttachmentRid, ObjectTypeApiName, OntologyScenarioRid } from "../Identifier/Identifier.model.ts";
import { closedRecordCodec, hashSetCodec, structCodec } from "../internal/ProjectedCodec.ts";
import { InterfaceObjectLocator, PrimaryKeyValue } from "../Object/Object.model.ts";
import { ObjectSetArgument } from "../ObjectSet/ObjectSet.model.ts";
import { TimeSeriesReference } from "../TimeSeries/TimeSeries.model.ts";
import { sharedCodec } from "../Value/Value.behavior.ts";
import { VectorOf } from "../Value/Value.model.ts";
import { ActionParameterType, OntologyDataType } from "./Action.model.ts";
import { OntologyDataTypeKind } from "./Action.values.ts";
import type { ActionParameter, ActionType, StructParameterField, StructParameterType } from "./Action.model.ts";

// A field that is not required may be left out of a struct value or be sent as `null`; nothing on the
// wire separates the two. Both decode to none, and none is written as `null`, the spelling the
// platform's own request examples use.
const optionalStructField = (value: S.Codec<unknown, unknown>) =>
  S.OptionFromNullOr(value).pipe(S.withDecodingDefaultKey(Effect.succeed(null)));

const structFieldEntry = ({ name, fieldType, required }: StructParameterField) =>
  Tuple.make(name, required ? fieldValueCodec(fieldType) : optionalStructField(fieldValueCodec(fieldType)));

const structParameterCodec = ({ fields }: StructParameterType): S.Codec<unknown, unknown> =>
  structCodec(A.map(fields, structFieldEntry));

// The tags of a type that holds no other type, in each of the two universes: every tag but the ones the
// projections unfold.
const ParameterLeafKind = ActionParameterTypeKind.omit(["vector", "array", "struct"]);
const FieldLeafKind = OntologyDataTypeKind.omit(["array", "set", "struct"]);

/**
 * The codec of one value of each leaf type an action can state, keyed by the type's tag.
 *
 * **Details**
 *
 * An action has two universes of types: the parameter types and the wider
 * ontology data types of a struct parameter's fields. A leaf type is one whose
 * codec does not depend on anything the type states. This one table holds the
 * leaves of both, so the two projections cannot read a tag they share in two
 * ways. It is the rows every universe shares (`sharedCodec` of `Value`) plus
 * the rows only an action has. A reference travels as what identifies its
 * target: an attachment and a scenario as their identifiers (a property holds
 * an attachment as a reference record), an object as its primary key, an
 * interface object as its object type and primary key, an object type as its
 * name. `any` and `unsupported` promise nothing about the value, which stays
 * JSON. The leaf specs of `Model` that only an argument has are built from
 * this table by key.
 *
 * **Example** (Tell an attachment argument from an attachment property)
 *
 * ```ts import.meta.vitest name="Tell an attachment argument from an attachment property"
 * import * as S from "effect/Schema"
 * import { leafCodec } from "@beep/scratchpad/osdk/src/Action/index"
 * import { leafCodec as propertyLeafCodec } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const rid = "ri.attachments.main.attachment.bb32154e-e043-4b00-9461-93136ca96b6f"
 * const facts = [
 *   S.is(leafCodec.attachment)(rid),
 *   S.is(propertyLeafCodec.attachment)(rid),
 *   leafCodec.decimal === propertyLeafCodec.decimal,
 * ]
 * facts // => [true, false, true]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const leafCodec = Struct.pick(
  {
    ...sharedCodec,
    attachment: AttachmentRid,
    geohash: GeoPoint,
    timeSeriesReference: TimeSeriesReference,
    object: PrimaryKeyValue,
    objectSet: ObjectSetArgument,
    interfaceObject: InterfaceObjectLocator,
    objectType: ObjectTypeApiName,
    scenarioReference: OntologyScenarioRid,
    // crispen: the platform's table of value encodings has no row for a map, so the value stays JSON. Once the
    // encoding is pinned down this becomes a HashMap, as an entry set is for queries.
    map: S.Json,
    any: S.Json,
    unsupported: S.Json,
  },
  A.appendAll(ParameterLeafKind.literals, FieldLeafKind.literals)
);

/**
 * The codec of one value of an ontology data type, the universe the fields of a struct parameter are drawn from.
 *
 * **Details**
 *
 * A leaf type is read from {@link leafCodec} by its tag; an array, a set and
 * a struct are unfolded. This universe is wider than {@link ActionParameterType}: it adds `byte`,
 * `short`, `float`, `binary`, `cipherText`, sets and maps. A set travels as a
 * JSON array and is a `HashSet` in the domain, so duplicates on the wire
 * collapse. `any` and `unsupported` promise nothing about the value, which
 * therefore stays JSON. The static type is loose (`unknown`) because the type
 * descriptor is only known at runtime.
 *
 * **Example** (Decode a set field to a HashSet)
 *
 * ```ts import.meta.vitest name="Decode a set field to a HashSet"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import * as S from "effect/Schema"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { fieldValueCodec, OntologySetType } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const codec = fieldValueCodec(OntologySetType.make({ elementType: StringType.make({}) }))
 * const tags = await Effect.runPromise(S.decodeUnknownEffect(codec)(["alpha", "bravo", "alpha"]))
 * const size = HashSet.isHashSet(tags) ? HashSet.size(tags) : 0
 * size // => 2
 * ```
 *
 * @param dataType - The ontology data type whose values the codec reads and writes.
 * @returns A codec with the wire JSON on the encoded side and the domain value on the type side.
 * @category projections
 * @since 0.0.0
 */
export const fieldValueCodec: (dataType: OntologyDataType) => S.Codec<unknown, unknown> =
  OntologyDataType.matchOrElse(
    {
      array: ({ elementType }) => S.Array(fieldValueCodec(elementType)),
      set: ({ elementType }) => hashSetCodec(fieldValueCodec(elementType)),
      struct: structParameterCodec,
    },
    (leaf) => leafCodec[leaf.type]
  );

/**
 * The codec of one argument of the given parameter type: wire JSON on the encoded side, domain value on the type side.
 *
 * **Details**
 *
 * A leaf type is read from {@link leafCodec} by its tag. The three other
 * types are unfolded, and the facts they state precipitate into the codec. A list's element type
 * becomes the element codec, a struct's fields become a struct codec whose
 * required fields are required keys, and a vector's `dimension` becomes an
 * exact length check. References travel as what identifies their target: an
 * object as its primary key, an interface object as its object type and
 * primary key, an attachment and a scenario as their identifiers, an object
 * type as its name. An object set travels as the identifier of a stored set
 * or as a definition written in place.
 *
 * `long` and `decimal` accept a JSON number as well as the documented string
 * and always write the string. OSDK stringifies decimals only, and only after
 * fetching the action type to learn which arguments are decimals; here the
 * same fact comes from the codec. The static type is loose (`unknown`)
 * because the parameter type is only known at runtime.
 *
 * **Example** (Write a list of decimals the way the platform expects)
 *
 * ```ts import.meta.vitest name="Write a list of decimals the way the platform expects"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DecimalType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { argumentCodec, ArrayParameterType } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const codec = argumentCodec(ArrayParameterType.make({ elementType: DecimalType.make({}) }))
 * const amounts = await Effect.runPromise(S.decodeUnknownEffect(codec)(["2.718281828", 3]))
 * const wire = await Effect.runPromise(S.encodeUnknownEffect(codec)(amounts))
 * wire // => ["2.718281828", "3"]
 * ```
 *
 * @param parameterType - The parameter type whose arguments the codec reads and writes.
 * @returns A codec with the wire JSON on the encoded side and the domain value on the type side.
 * @category projections
 * @since 0.0.0
 */
export const argumentCodec: (parameterType: ActionParameterType) => S.Codec<unknown, unknown> =
  ActionParameterType.matchOrElse(
    {
      vector: ({ dimension }) => VectorOf(dimension),
      array: ({ elementType }) => S.Array(argumentCodec(elementType)),
      struct: structParameterCodec,
    },
    (leaf) => leafCodec[leaf.type]
  );

// A required parameter is a required key. Any other parameter keeps the three intents of a request:
// key absent (leave untouched), `null` (clear) and a value (set).
const argumentField = ({ dataType, required }: ActionParameter) =>
  required ? argumentCodec(dataType) : argumentCodec(dataType).pipe(S.OptionFromNullOr, S.optionalKey);

/**
 * The codec of the argument record of one application of the given action type.
 *
 * **Details**
 *
 * This is the typed form of `ActionArguments`. Every argument is read and
 * written by the codec of its own parameter type, and the record itself
 * states what the action type declares:
 *
 * | Parameter | Domain | Wire |
 * | --- | --- | --- |
 * | required | the value, under a required key | the value |
 * | not required, left untouched | key absent | key absent |
 * | not required, cleared | `Option.none()` | `null` |
 * | not required, set | `Option.some(value)` | the value |
 *
 * A key that names no parameter is rejected in both directions, where a plain
 * struct would drop it: a misspelt argument is a mistake, and the platform
 * refuses it as well. Anything that holds the `parameters` of an action type
 * can be projected.
 *
 * **Example** (Check the arguments of a promotion)
 *
 * ```ts import.meta.vitest name="Check the arguments of a promotion"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ActionType, argumentsCodec } from "@beep/scratchpad/osdk/src/Action/index"
 *
 * const promote = await Effect.runPromise(
 *   S.decodeUnknownEffect(ActionType)({
 *     apiName: "promoteEmployee",
 *     rid: "ri.ontology.main.action-type.7ed72754-7491-428a-bb18-4d7296eb2168",
 *     status: "ACTIVE",
 *     parameters: {
 *       employeeId: { displayName: "Employee ID", dataType: { type: "integer" }, required: true, typeClasses: [] },
 *       newTitle: { displayName: "New Title", dataType: { type: "string" }, required: false, typeClasses: [] },
 *     },
 *     operations: [{ type: "modifyObject", objectTypeApiName: "Employee" }],
 *   })
 * )
 * const accepts = (args: unknown) => O.isSome(S.decodeUnknownOption(argumentsCodec(promote))(args))
 * const verdicts = [
 *   accepts({ employeeId: 50030, newTitle: null }),
 *   accepts({ newTitle: "Director" }),
 *   accepts({ employeeId: 50030, salary: 100 }),
 * ]
 * verdicts // => [true, false, false]
 * ```
 *
 * @param actionType - The action type, or anything else that holds its parameters.
 * @returns A codec of the argument record, keyed by parameter identifier.
 * @category projections
 * @since 0.0.0
 */
export const argumentsCodec = ({
  parameters,
}: Pick<ActionType, "parameters">): S.Codec<Readonly<Record<string, unknown>>, Readonly<Record<string, unknown>>> =>
  closedRecordCodec(R.map(parameters, argumentField));
