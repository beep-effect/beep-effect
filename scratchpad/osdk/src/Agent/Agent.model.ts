/**
 * Agents: published agent definitions, the sessions opened against them, the events sent to a session and its state.
 *
 * **Details**
 *
 * The surface is beta in OSDK, so this module models the wire and nothing
 * else. OSDK layers sugar on top of it: a context item's `contextItemType`
 * becomes `type`, a status record becomes a bare string, an event becomes a
 * record with exactly one key, and the consistency key disappears into a
 * closure. Here the wire records are the domain records, and the one recursive
 * idea, {@link AgentDataType}, is a tagged union that every value codec is
 * projected from.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import {
  BooleanType,
  DateType,
  DoubleType,
  FloatType,
  IntegerType,
  LongType,
  ShortType,
  StringType,
  TimestampType,
} from "../DataType/DataType.model.ts";
import {
  ObjectTypeApiName,
  OntologyApiName,
  OntologyIdentifier,
  OntologyRid,
  PrincipalId,
  PropertyApiName,
} from "../Identifier/Identifier.model.ts";
import { RecursiveArraySizeHint } from "../internal/RecursionHint.ts";
import { PrimaryKeyValue } from "../Object/Object.model.ts";

const $I = $ScratchpadId.create("osdk/Agent/Agent.model");

const distinctBy = <Item>(items: ReadonlyArray<Item>, key: (item: Item) => string): boolean =>
  A.length(A.dedupe(A.map(items, key))) === A.length(items);

// -----------------------------------------------------------------------------
// Identifiers
// -----------------------------------------------------------------------------

/**
 * API name of an agent, the human-chosen handle used in request paths.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AgentApiName = S.NonEmptyString.pipe(
  S.brand("AgentApiName"),
  $I.annoteSchema("AgentApiName", {
    description: "API name of an agent, the human-chosen handle used in request paths.",
  })
);

/**
 * Runtime type of {@link AgentApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AgentApiName = typeof AgentApiName.Type;

/**
 * Resource identifier of an agent, stable across renames of its API name.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AgentRid = S.NonEmptyString.pipe(
  S.brand("AgentRid"),
  $I.annoteSchema("AgentRid", {
    description: "Resource identifier of an agent, stable across renames of its API name.",
  })
);

/**
 * Runtime type of {@link AgentRid}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AgentRid = typeof AgentRid.Type;

/**
 * Version of a published agent: `<major>.<minor>.<patch>` with an optional `-<tag>` suffix.
 *
 * **Example** (Accept release and tagged agent versions)
 *
 * ```ts import.meta.vitest name="Accept release and tagged agent versions"
 * import * as S from "effect/Schema"
 * import { AgentVersion } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const isVersion = S.is(AgentVersion)
 * const verdicts = [isVersion("1.2.3"), isVersion("1.2.3-rc1"), isVersion("latest")]
 * verdicts // => [true, true, false]
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AgentVersion = S.NonEmptyString.check(
  S.isPattern(
    /^\d+\.\d+\.\d+(?:-[0-9a-zA-Z][0-9a-zA-Z.-]*)?$/,
    $I.annote("AgentVersionCheck", {
      title: "Agent Version",
      description: "A version of the form <major>.<minor>.<patch> with an optional -<tag> suffix.",
      message: "Expected an agent version such as 1.2.3 or 1.2.3-rc1",
    })
  )
).pipe(
  S.brand("AgentVersion"),
  $I.annoteSchema("AgentVersion", {
    description: "Version of a published agent: major.minor.patch with an optional tag suffix.",
  })
);

/**
 * Runtime type of {@link AgentVersion}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AgentVersion = typeof AgentVersion.Type;

/**
 * Identifier of one session opened against an agent.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AgentSessionId = S.NonEmptyString.pipe(
  S.brand("AgentSessionId"),
  $I.annoteSchema("AgentSessionId", { description: "Identifier of one session opened against an agent." })
);

/**
 * Runtime type of {@link AgentSessionId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AgentSessionId = typeof AgentSessionId.Type;

/**
 * Name of an input an agent accepts when a session is created.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AgentArgumentName = S.NonEmptyString.pipe(
  S.brand("AgentArgumentName"),
  $I.annoteSchema("AgentArgumentName", {
    description: "Name of an input an agent accepts when a session is created.",
  })
);

/**
 * Runtime type of {@link AgentArgumentName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AgentArgumentName = typeof AgentArgumentName.Type;

/**
 * Name of a kind of event an agent declares, which selects the payload type of events of that kind.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AgentEventType = S.NonEmptyString.pipe(
  S.brand("AgentEventType"),
  $I.annoteSchema("AgentEventType", {
    description: "Name of a kind of event an agent declares, which selects the payload type of such events.",
  })
);

/**
 * Runtime type of {@link AgentEventType}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AgentEventType = typeof AgentEventType.Type;

/**
 * Caller-generated idempotency key of an event.
 *
 * **Details**
 *
 * Within a session only the first event submitted with a given identifier is
 * handled, so a retry of the same event must reuse its identifier and a new
 * event must never do so.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AgentEventId = S.NonEmptyString.pipe(
  S.brand("AgentEventId"),
  $I.annoteSchema("AgentEventId", {
    description: "Caller-generated idempotency key of an event; a retry of the same event reuses it.",
  })
);

/**
 * Runtime type of {@link AgentEventId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AgentEventId = typeof AgentEventId.Type;

/**
 * Name of a kind of context item an agent declares, which selects the data type of items of that kind.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AgentContextItemType = S.NonEmptyString.pipe(
  S.brand("AgentContextItemType"),
  $I.annoteSchema("AgentContextItemType", {
    description: "Name of a kind of context item an agent declares, which selects the data type of such items.",
  })
);

/**
 * Runtime type of {@link AgentContextItemType}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AgentContextItemType = typeof AgentContextItemType.Type;

/**
 * Identifier of one context item within a session.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AgentContextItemId = S.NonEmptyString.pipe(
  S.brand("AgentContextItemId"),
  $I.annoteSchema("AgentContextItemId", { description: "Identifier of one context item within a session." })
);

/**
 * Runtime type of {@link AgentContextItemId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AgentContextItemId = typeof AgentContextItemId.Type;

/**
 * Opaque marker of a point in a session's observed state.
 *
 * **Details**
 *
 * Accepting an event returns a key; passing that key to a later state read
 * asks for state at least that recent. Keys are not ordered, so a caller that
 * sends events concurrently has to decide which key it means to wait for.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AgentConsistencyKey = S.NonEmptyString.pipe(
  S.brand("AgentConsistencyKey"),
  $I.annoteSchema("AgentConsistencyKey", {
    description: "Opaque marker of a point in a session's observed state, used to read state at least that recent.",
  })
);

/**
 * Runtime type of {@link AgentConsistencyKey}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AgentConsistencyKey = typeof AgentConsistencyKey.Type;

// -----------------------------------------------------------------------------
// Data types
// -----------------------------------------------------------------------------

/**
 * The `type` tags of the 16 data types an agent can declare.
 *
 * **Details**
 *
 * Nine scalars, a nullable wrapper, three containers (`list`, `record`,
 * `struct`), a discriminated union and two ontology references. Four of the
 * tags (`nullable`, `list`, `record`, `discriminatedUnion`) belong to no other
 * type universe modelled here, so this is a local vocabulary and not a pick
 * from `DataTypeKind`.
 *
 * **Example** (Count the agent data type tags)
 *
 * ```ts import.meta.vitest name="Count the agent data type tags"
 * import { AgentDataTypeKind } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const facts = [AgentDataTypeKind.literals.length, AgentDataTypeKind.is.discriminatedUnion("discriminatedUnion")]
 * facts // => [16, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentDataTypeKind = LiteralKit([
  "boolean",
  "short",
  "integer",
  "long",
  "float",
  "double",
  "string",
  "date",
  "timestamp",
  "nullable",
  "list",
  "record",
  "struct",
  "discriminatedUnion",
  "object",
  "objectSet",
]).pipe(
  $I.annoteSchema("AgentDataTypeKind", {
    description: "The type tags of the data types an agent can declare for arguments, events, state and context.",
  })
);

/**
 * Runtime type of {@link AgentDataTypeKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type AgentDataTypeKind = typeof AgentDataTypeKind.Type;

const suspendedAgentDataType = S.suspend((): S.Codec<AgentDataType, AgentDataType.Encoded> => AgentDataType);

/**
 * Agent data type of a value that may be null.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentNullableType extends S.Opaque<AgentNullableType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("nullable"),
    wrappedType: suspendedAgentDataType.annotateKey({ description: "Data type of the value when it is not null." }),
  }).pipe($I.annoteSchema("AgentNullableType", { description: "Agent data type of a value that may be null." }))
) {}

/**
 * Companion namespace for {@link AgentNullableType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AgentNullableType {
  /**
   * Encoded form of {@link AgentNullableType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "nullable";
    readonly wrappedType: AgentDataType.Encoded;
  }
}

/**
 * Agent data type of a homogeneous list, which travels as a JSON array.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentListType extends S.Opaque<AgentListType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("list"),
    elementType: suspendedAgentDataType.annotateKey({ description: "Data type of every element." }),
  }).pipe(
    $I.annoteSchema("AgentListType", {
      description: "Agent data type of a homogeneous list, which travels as a JSON array.",
    })
  )
) {}

/**
 * Companion namespace for {@link AgentListType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AgentListType {
  /**
   * Encoded form of {@link AgentListType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "list";
    readonly elementType: AgentDataType.Encoded;
  }
}

/**
 * Agent data type of a map from arbitrary text keys to values of one type, which travels as a JSON object.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentRecordType extends S.Opaque<AgentRecordType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("record"),
    valueType: suspendedAgentDataType.annotateKey({ description: "Data type of every value in the record." }),
  }).pipe(
    $I.annoteSchema("AgentRecordType", {
      description: "Agent data type of a map from arbitrary text keys to values of one type.",
    })
  )
) {}

/**
 * Companion namespace for {@link AgentRecordType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AgentRecordType {
  /**
   * Encoded form of {@link AgentRecordType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "record";
    readonly valueType: AgentDataType.Encoded;
  }
}

/**
 * One named, typed field of an agent struct or of a discriminated union member.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentStructField extends S.Opaque<AgentStructField, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.annotateKey({ description: "Key of the field in the JSON object that carries the struct." }),
    dataType: suspendedAgentDataType.annotateKey({ description: "Data type of the field's value." }),
  }).pipe(
    $I.annoteSchema("AgentStructField", {
      description: "One named, typed field of an agent struct or of a discriminated union member.",
    })
  )
) {}

/**
 * Companion namespace for {@link AgentStructField}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AgentStructField {
  /**
   * Encoded form of {@link AgentStructField}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly name: string;
    readonly dataType: AgentDataType.Encoded;
  }
}

// A struct travels as a JSON object, which cannot hold a key twice, so two fields with one name could not both
// carry a value. The size hint only bounds generated trees.
const AgentStructFields = S.Array(AgentStructField).check(
  RecursiveArraySizeHint,
  S.makeFilter(
    (fields: ReadonlyArray<AgentStructField>) => distinctBy(fields, (field) => field.name),
    $I.annote("UniqueAgentFieldNamesCheck", {
      title: "Unique agent field names",
      description: "No two fields of one agent struct or union member share a name.",
      message: "Expected every field to have a distinct name",
    })
  )
);

/**
 * Agent data type of a JSON object with a fixed set of named, individually typed fields.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentStructType extends S.Opaque<AgentStructType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("struct"),
    fields: AgentStructFields.annotateKey({ description: "Fields of the struct, in declaration order." }),
  }).pipe(
    $I.annoteSchema("AgentStructType", {
      description: "Agent data type of a JSON object with a fixed set of named, individually typed fields.",
    })
  )
) {}

/**
 * Companion namespace for {@link AgentStructType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AgentStructType {
  /**
   * Encoded form of {@link AgentStructType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "struct";
    readonly fields: ReadonlyArray<AgentStructField.Encoded>;
  }
}

/**
 * One alternative of an agent discriminated union: the discriminator value that selects it and its other fields.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentUnionMember extends S.Opaque<AgentUnionMember, { readonly brand: unique symbol }>()(
  S.Struct({
    discriminatorValue: S.String.annotateKey({
      description: "Value of the discriminator key that selects this alternative.",
    }),
    fields: AgentStructFields.annotateKey({
      description: "Fields of the alternative besides the discriminator, in declaration order.",
    }),
  }).pipe(
    $I.annoteSchema("AgentUnionMember", {
      description: "One alternative of an agent discriminated union: its discriminator value and its other fields.",
    })
  )
) {}

/**
 * Companion namespace for {@link AgentUnionMember}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AgentUnionMember {
  /**
   * Encoded form of {@link AgentUnionMember}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly discriminatorValue: string;
    readonly fields: ReadonlyArray<AgentStructField.Encoded>;
  }
}

/**
 * Agent data type of a JSON object that is one of several alternatives, told apart by one key.
 *
 * **Details**
 *
 * A value is an object in which the key named by `discriminatorKey` holds a
 * member's `discriminatorValue` and the remaining keys are that member's
 * fields, for example `{ "type": "customer", "customerId": 123 }`. Two
 * invariants keep such a value readable: discriminator values are distinct, and
 * no member declares a field under the discriminator key itself.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentDiscriminatedUnionType extends S.Opaque<
  AgentDiscriminatedUnionType,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("discriminatedUnion"),
    discriminatorKey: S.String.annotateKey({
      description: "Key whose value tells the alternatives apart in the JSON object.",
    }),
    members: S.Array(AgentUnionMember)
      .check(
        RecursiveArraySizeHint,
        S.makeFilter(
          (members: ReadonlyArray<AgentUnionMember>) => distinctBy(members, (member) => member.discriminatorValue),
          $I.annote("UniqueDiscriminatorValuesCheck", {
            title: "Unique discriminator values",
            description: "No two members of one agent discriminated union share a discriminator value.",
            message: "Expected every union member to have a distinct discriminator value",
          })
        )
      )
      .annotateKey({ description: "The alternatives, in declaration order." }),
  }).pipe(
    S.check(
      S.makeFilter(
        ({ discriminatorKey, members }) =>
          A.every(members, (member) => A.every(member.fields, (field) => field.name !== discriminatorKey)),
        $I.annote("DiscriminatorKeyReservedCheck", {
          title: "Discriminator key reserved",
          description: "No member of an agent discriminated union declares a field under the discriminator key.",
          message: "Expected no union member field to be named after the discriminator key",
        })
      )
    ),
    $I.annoteSchema("AgentDiscriminatedUnionType", {
      description: "Agent data type of a JSON object that is one of several alternatives, told apart by one key.",
    })
  )
) {}

/**
 * Companion namespace for {@link AgentDiscriminatedUnionType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AgentDiscriminatedUnionType {
  /**
   * Encoded form of {@link AgentDiscriminatedUnionType}, declared explicitly because the type is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly type: "discriminatedUnion";
    readonly discriminatorKey: string;
    readonly members: ReadonlyArray<AgentUnionMember.Encoded>;
  }
}

/**
 * Agent data type of a reference to one object of a given object type.
 *
 * **Details**
 *
 * The type names its ontology by API name, while a value ({@link AgentObjectReference})
 * names it by RID. Reconciling the two needs the ontology in hand, which is the
 * client's job.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentObjectType extends S.Opaque<AgentObjectType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("object"),
    ontologyApiName: OntologyApiName.annotateKey({ description: "Ontology the object type belongs to." }),
    objectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type of the referenced object." }),
  }).pipe(
    $I.annoteSchema("AgentObjectType", {
      description: "Agent data type of a reference to one object of a given object type.",
    })
  )
) {}

/**
 * Agent data type of a set of objects of a given object type, which travels as an object set RID.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentObjectSetType extends S.Opaque<AgentObjectSetType, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("objectSet"),
    ontologyApiName: OntologyApiName.annotateKey({ description: "Ontology the object type belongs to." }),
    objectTypeApiName: ObjectTypeApiName.annotateKey({ description: "Object type of the objects in the set." }),
  }).pipe(
    $I.annoteSchema("AgentObjectSetType", {
      description: "Agent data type of a set of objects of a given object type, which travels as an object set RID.",
    })
  )
) {}

/**
 * Everything an agent can declare as the shape of an argument, an event payload, its state or a context item.
 *
 * **Details**
 *
 * The wire names this `DataType`. Nullability is a type here and not a flag:
 * a value may be null exactly when its type is `nullable`. The scalar members
 * are the shared tag records of `DataType`; the seven others are declared
 * here.
 *
 * **Example** (Decode a declared type and take it apart)
 *
 * ```ts import.meta.vitest name="Decode a declared type and take it apart"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AgentDataType } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const declared = await Effect.runPromise(
 *   S.decodeUnknownEffect(AgentDataType)({
 *     type: "list",
 *     elementType: { type: "nullable", wrappedType: { type: "long" } },
 *   })
 * )
 * const describe: (dataType: AgentDataType) => string = AgentDataType.match({
 *   boolean: () => "boolean",
 *   short: () => "short",
 *   integer: () => "integer",
 *   long: () => "long",
 *   float: () => "float",
 *   double: () => "double",
 *   string: () => "string",
 *   date: () => "date",
 *   timestamp: () => "timestamp",
 *   nullable: ({ wrappedType }) => `${describe(wrappedType)}?`,
 *   list: ({ elementType }) => `${describe(elementType)}[]`,
 *   record: ({ valueType }) => `{ [key]: ${describe(valueType)} }`,
 *   struct: () => "struct",
 *   discriminatedUnion: () => "union",
 *   object: ({ objectTypeApiName }) => objectTypeApiName,
 *   objectSet: ({ objectTypeApiName }) => `Set<${objectTypeApiName}>`,
 * })
 * const facts = [describe(declared), AgentDataType.isAnyOf(["list", "record"])(declared)]
 * facts // => ["long?[]", true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentDataType = AgentDataTypeKind.mapMembers(() =>
  Tuple.make(
    BooleanType,
    ShortType,
    IntegerType,
    LongType,
    FloatType,
    DoubleType,
    StringType,
    DateType,
    TimestampType,
    AgentNullableType,
    AgentListType,
    AgentRecordType,
    AgentStructType,
    AgentDiscriminatedUnionType,
    AgentObjectType,
    AgentObjectSetType
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AgentDataType", {
    description: "The shape an agent declares for an argument, an event payload, its state or a context item.",
  })
);

/**
 * Runtime type of {@link AgentDataType}.
 *
 * @category models
 * @since 0.0.0
 */
export type AgentDataType =
  | BooleanType
  | ShortType
  | IntegerType
  | LongType
  | FloatType
  | DoubleType
  | StringType
  | DateType
  | TimestampType
  | AgentNullableType
  | AgentListType
  | AgentRecordType
  | AgentStructType
  | AgentDiscriminatedUnionType
  | AgentObjectType
  | AgentObjectSetType;

/**
 * Companion namespace for {@link AgentDataType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AgentDataType {
  /**
   * Encoded (wire) form of {@link AgentDataType}, declared explicitly because the union is recursive.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | (typeof BooleanType)["Encoded"]
    | (typeof ShortType)["Encoded"]
    | (typeof IntegerType)["Encoded"]
    | (typeof LongType)["Encoded"]
    | (typeof FloatType)["Encoded"]
    | (typeof DoubleType)["Encoded"]
    | (typeof StringType)["Encoded"]
    | (typeof DateType)["Encoded"]
    | (typeof TimestampType)["Encoded"]
    | AgentNullableType.Encoded
    | AgentListType.Encoded
    | AgentRecordType.Encoded
    | AgentStructType.Encoded
    | AgentDiscriminatedUnionType.Encoded
    | (typeof AgentObjectType)["Encoded"]
    | (typeof AgentObjectSetType)["Encoded"];
}

// -----------------------------------------------------------------------------
// Definitions
// -----------------------------------------------------------------------------

/**
 * One input an agent accepts when a session is created: its name and the type of its value.
 *
 * **Details**
 *
 * The wire names this `ArgumentDefinition`. An argument is required unless its
 * type is `nullable`.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentParameter extends S.Opaque<AgentParameter, { readonly brand: unique symbol }>()(
  S.Struct({
    name: AgentArgumentName.annotateKey({ description: "Key of the argument in a session's arguments record." }),
    dataType: AgentDataType.annotateKey({ description: "What the argument holds." }),
  }).pipe(
    $I.annoteSchema("AgentParameter", {
      description: "One input an agent accepts when a session is created: its name and the type of its value.",
    })
  )
) {}

/**
 * One kind of event an agent accepts: its name and the type of its payload.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEventDefinition extends S.Opaque<AgentEventDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    eventType: AgentEventType.annotateKey({ description: "Name that events of this kind carry." }),
    payloadType: AgentDataType.annotateKey({ description: "What the payload of such an event holds." }),
  }).pipe(
    $I.annoteSchema("AgentEventDefinition", {
      description: "One kind of event an agent accepts: its name and the type of its payload.",
    })
  )
) {}

/**
 * One kind of context item an agent produces: its name and the type of its data.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentContextItemDefinition extends S.Opaque<
  AgentContextItemDefinition,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    contextItemType: AgentContextItemType.annotateKey({ description: "Name that items of this kind carry." }),
    dataType: AgentDataType.annotateKey({ description: "What the data of such an item holds." }),
  }).pipe(
    $I.annoteSchema("AgentContextItemDefinition", {
      description: "One kind of context item an agent produces: its name and the type of its data.",
    })
  )
) {}

/**
 * A published version of an agent: what it accepts, what it can be told, and the shape of what it exposes.
 *
 * **Details**
 *
 * This is the record the platform returns for an agent API name and version
 * (the wire's `AgentDefinitionVersion`). It is the schema of a session: the
 * arguments, every event payload, the agent state and every context item are
 * decoded with codecs projected from the types declared here. Names are
 * distinct within each of the three lists, because each is used as a lookup.
 *
 * **Example** (Read the declared argument names of an agent version)
 *
 * ```ts import.meta.vitest name="Read the declared argument names of an agent version"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AgentDefinition } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const definition = await Effect.runPromise(
 *   S.decodeUnknownEffect(AgentDefinition)({
 *     version: "1.2.0",
 *     createdTime: "2026-03-04T05:06:07.000Z",
 *     createdBy: "f05f8da4-b84c-4fca-9c77-8af0b13d11de",
 *     argumentDefinitions: [
 *       { name: "customer", dataType: { type: "object", ontologyApiName: "crm", objectTypeApiName: "Customer" } },
 *       { name: "note", dataType: { type: "nullable", wrappedType: { type: "string" } } },
 *     ],
 *     eventDefinitions: [{ eventType: "userMessage", payloadType: { type: "string" } }],
 *     agentStateType: { type: "struct", fields: [{ name: "summary", dataType: { type: "string" } }] },
 *     contextItemDefinitions: [],
 *   })
 * )
 * const names = A.map(definition.argumentDefinitions, (argument) => argument.name)
 * names // => ["customer", "note"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentDefinition extends S.Opaque<AgentDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    version: AgentVersion.annotateKey({ description: "The version this record describes." }),
    createdTime: S.DateTimeUtcFromString.annotateKey({ description: "Instant the version was published." }),
    createdBy: PrincipalId.annotateKey({ description: "Who published the version." }),
    argumentDefinitions: S.Array(AgentParameter)
      .check(
        S.makeFilter(
          (parameters: ReadonlyArray<AgentParameter>) => distinctBy(parameters, (parameter) => parameter.name),
          $I.annote("UniqueAgentArgumentNamesCheck", {
            title: "Unique agent argument names",
            description: "No two arguments of one agent version share a name.",
            message: "Expected every argument to have a distinct name",
          })
        )
      )
      .annotateKey({ description: "Inputs accepted when a session is created, in declaration order." }),
    eventDefinitions: S.Array(AgentEventDefinition)
      .check(
        S.makeFilter(
          (events: ReadonlyArray<AgentEventDefinition>) => distinctBy(events, (event) => event.eventType),
          $I.annote("UniqueAgentEventTypesCheck", {
            title: "Unique agent event types",
            description: "No two event definitions of one agent version share an event type.",
            message: "Expected every event definition to have a distinct event type",
          })
        )
      )
      .annotateKey({ description: "Kinds of event a session of this version accepts." }),
    agentStateType: AgentDataType.annotateKey({ description: "What the agent state of a session holds." }),
    contextItemDefinitions: S.Array(AgentContextItemDefinition)
      .check(
        S.makeFilter(
          (items: ReadonlyArray<AgentContextItemDefinition>) => distinctBy(items, (item) => item.contextItemType),
          $I.annote("UniqueAgentContextItemTypesCheck", {
            title: "Unique agent context item types",
            description: "No two context item definitions of one agent version share a context item type.",
            message: "Expected every context item definition to have a distinct context item type",
          })
        )
      )
      .annotateKey({ description: "Kinds of context item a session of this version produces." }),
  }).pipe(
    $I.annoteSchema("AgentDefinition", {
      description: "A published version of an agent: its arguments, events, state type and context item types.",
    })
  )
) {}

/**
 * Which agent a caller means: its API name and the version to run.
 *
 * **Details**
 *
 * This is the handle generated code holds (OSDK's `AgentDefinition` constant,
 * minus its `type: "agent"` tag, its user-agent metadata and its phantom
 * signatures). It is not a wire record; it is what a client turns into an
 * {@link AgentIdentifier} and a definition lookup.
 *
 * **Example** (Name an agent version)
 *
 * ```ts import.meta.vitest name="Name an agent version"
 * import { AgentApiName, AgentReference, AgentVersion } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const triage = AgentReference.make({ apiName: AgentApiName.make("triage"), version: AgentVersion.make("1.2.0") })
 * const label = `${triage.apiName}@${triage.version}`
 * label // => "triage@1.2.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentReference extends S.Opaque<AgentReference, { readonly brand: unique symbol }>()(
  S.Struct({
    apiName: AgentApiName.annotateKey({ description: "API name of the agent." }),
    version: AgentVersion.annotateKey({ description: "Version of the agent the caller was built against." }),
  }).pipe(
    $I.annoteSchema("AgentReference", {
      description: "Which agent a caller means: its API name and the version to run.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Sessions
// -----------------------------------------------------------------------------

const agentAddressFields = {
  ontology: OntologyIdentifier.annotateKey({ description: "Ontology the agent lives in, by RID or API name." }),
  agentApiName: AgentApiName.annotateKey({ description: "API name of the agent within that ontology." }),
};

/**
 * An agent named by its ontology and API name, as a session reports it.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentApiNameIdentifier extends S.Opaque<AgentApiNameIdentifier, { readonly brand: unique symbol }>()(
  S.Struct(agentAddressFields).pipe(
    $I.annoteSchema("AgentApiNameIdentifier", {
      description: "An agent named by its ontology and API name, as a session reports it.",
    })
  )
) {}

/**
 * How a request names the agent to open a session with.
 *
 * **Details**
 *
 * The wire declares a tagged union with a single member, `agentApiName`. One
 * tagged record states the same thing; a second way of naming an agent would
 * arrive as a second tag.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentIdentifier extends S.Opaque<AgentIdentifier, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("agentApiName"), ...agentAddressFields }).pipe(
    $I.annoteSchema("AgentIdentifier", { description: "How a request names the agent to open a session with." })
  )
) {}

/**
 * Request to open a session: which agent, which version, and the arguments it starts with.
 *
 * **Details**
 *
 * Argument values are JSON here. Their precise codec is projected from the
 * agent version's argument definitions, which a request record cannot know.
 *
 * **Example** (Encode a session request)
 *
 * ```ts import.meta.vitest name="Encode a session request"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CreateAgentSessionRequest } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const wire = {
 *   agent: { type: "agentApiName", ontology: "ri.ontology.main.ontology.def0ca71", agentApiName: "triage" },
 *   arguments: { customerId: 123 },
 *   agentVersion: "1.2.0",
 * }
 * const request = await Effect.runPromise(S.decodeUnknownEffect(CreateAgentSessionRequest)(wire))
 * const again = await Effect.runPromise(S.encodeEffect(CreateAgentSessionRequest)(request))
 * again // => wire
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateAgentSessionRequest extends S.Opaque<CreateAgentSessionRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    agent: AgentIdentifier,
    arguments: S.Record(AgentArgumentName, S.Json).annotateKey({
      description: "Argument values by argument name, in the wire form of their declared types.",
    }),
    agentVersion: AgentVersion.annotateKey({ description: "Version of the agent to run." }),
  }).pipe(
    $I.annoteSchema("CreateAgentSessionRequest", {
      description: "Request to open a session: which agent, which version, and the arguments it starts with.",
    })
  )
) {}

/**
 * A session opened against an agent: its identifier and the agent version it runs.
 *
 * **Details**
 *
 * A session keeps the version it was created with, so its state is decoded
 * with that version's definition and not with the version a caller was built
 * against.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentSession extends S.Opaque<AgentSession, { readonly brand: unique symbol }>()(
  S.Struct({
    id: AgentSessionId.annotateKey({ description: "Identifier of the session." }),
    agentRid: AgentRid.annotateKey({ description: "Resource identifier of the agent the session runs." }),
    agentApiNameIdentifier: S.OptionFromOptionalKey(AgentApiNameIdentifier).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The agent by ontology and API name, when the platform reports it." })
    ),
    agentVersion: AgentVersion.annotateKey({ description: "Version of the agent the session was created with." }),
  }).pipe(
    $I.annoteSchema("AgentSession", {
      description: "A session opened against an agent: its identifier and the agent version it runs.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

/**
 * An event sent to a session: an idempotency key, the kind of event and its payload.
 *
 * **Details**
 *
 * OSDK's `sendEvent` takes a record with exactly one key, `{ [eventType]: payload }`,
 * and generates the identifier itself. That record is client sugar over this
 * envelope and is not modelled. The payload is JSON here; its precise codec is
 * projected from the event definition with the same event type.
 *
 * **Example** (Decode an event envelope)
 *
 * ```ts import.meta.vitest name="Decode an event envelope"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AgentEvent } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const event = await Effect.runPromise(
 *   S.decodeUnknownEffect(AgentEvent)({
 *     id: "0b7f1b0e-6a52-4d4f-9a53-0c1f2f6a9d11",
 *     eventType: "userMessage",
 *     payload: { text: "hello" },
 *   })
 * )
 * const parts = [event.eventType, event.payload]
 * parts // => ["userMessage", { text: "hello" }]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEvent extends S.Opaque<AgentEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    id: AgentEventId.annotateKey({ description: "Idempotency key chosen by the caller and reused on retries." }),
    eventType: AgentEventType.annotateKey({ description: "Which declared kind of event this is." }),
    payload: S.Json.annotateKey({ description: "Payload in the wire form of the event's declared payload type." }),
  }).pipe(
    $I.annoteSchema("AgentEvent", {
      description: "An event sent to a session: an idempotency key, the kind of event and its payload.",
    })
  )
) {}

/**
 * Request body that sends one event to a session.
 *
 * @category models
 * @since 0.0.0
 */
export class SendAgentEventRequest extends S.Opaque<SendAgentEventRequest, { readonly brand: unique symbol }>()(
  S.Struct({ event: AgentEvent }).pipe(
    $I.annoteSchema("SendAgentEventRequest", { description: "Request body that sends one event to a session." })
  )
) {}

const AgentEventResultKind = LiteralKit(["accepted", "sessionNotReady"]);

/**
 * The session accepted the event for handling.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEventAccepted extends S.Opaque<AgentEventAccepted, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("accepted"),
    consistencyKey: AgentConsistencyKey.annotateKey({
      description: "Marker of state that reflects the event; pass it to a state read to wait for that state.",
    }),
  }).pipe($I.annoteSchema("AgentEventAccepted", { description: "The session accepted the event for handling." }))
) {}

/**
 * The session has not started yet and cannot accept events; send the same event again after a short delay.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentSessionNotReady extends S.Opaque<AgentSessionNotReady, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("sessionNotReady") }).pipe(
    $I.annoteSchema("AgentSessionNotReady", {
      description: "The session has not started yet and cannot accept events.",
    })
  )
) {}

/**
 * What happened to a sent event: accepted, or refused because the session is not ready.
 *
 * **Example** (Decide whether to send an event again)
 *
 * ```ts import.meta.vitest name="Decide whether to send an event again"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AgentEventResult } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const shouldRetry = AgentEventResult.match({ accepted: () => false, sessionNotReady: () => true })
 * const results = await Effect.runPromise(
 *   Effect.all([
 *     S.decodeUnknownEffect(AgentEventResult)({ type: "accepted", consistencyKey: "ck-17" }),
 *     S.decodeUnknownEffect(AgentEventResult)({ type: "sessionNotReady" }),
 *   ])
 * )
 * const verdicts = [shouldRetry(results[0]), shouldRetry(results[1])]
 * verdicts // => [false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentEventResult = AgentEventResultKind.mapMembers(() =>
  Tuple.make(AgentEventAccepted, AgentSessionNotReady)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AgentEventResult", {
    description: "What happened to a sent event: accepted, or refused because the session is not ready.",
  })
);

/**
 * Runtime type of {@link AgentEventResult}.
 *
 * @category models
 * @since 0.0.0
 */
export type AgentEventResult = typeof AgentEventResult.Type;

/**
 * Response body of sending one event to a session.
 *
 * @category models
 * @since 0.0.0
 */
export class SendAgentEventResponse extends S.Opaque<SendAgentEventResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    result: AgentEventResult.annotateKey({ description: "Whether the session accepted the event." }),
  }).pipe(
    $I.annoteSchema("SendAgentEventResponse", { description: "Response body of sending one event to a session." })
  )
) {}

// -----------------------------------------------------------------------------
// Session state
// -----------------------------------------------------------------------------

/**
 * Where a session is in its life: able to do more work, or ended in one of three ways.
 *
 * **Details**
 *
 * A `live` session can do more work and may be suspended waiting for an event.
 * `completed`, `failed` and `canceled` are terminal: such a session accepts no
 * further events.
 *
 * **Example** (Classify a session status)
 *
 * ```ts import.meta.vitest name="Classify a session status"
 * import { AgentSessionStatus } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const acceptsEvents = AgentSessionStatus.match({
 *   live: () => true,
 *   completed: () => false,
 *   failed: () => false,
 *   canceled: () => false,
 * })
 * const verdicts = [acceptsEvents("live"), acceptsEvents("canceled"), AgentSessionStatus.is.failed("failed")]
 * verdicts // => [true, false, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentSessionStatus = LiteralKit(["live", "completed", "failed", "canceled"]).pipe(
  $I.annoteSchema("AgentSessionStatus", {
    description: "Where a session is in its life: able to do more work, or ended in one of three ways.",
  })
);

/**
 * Runtime type of {@link AgentSessionStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type AgentSessionStatus = typeof AgentSessionStatus.Type;

/**
 * Codec between the wire's status record and an {@link AgentSessionStatus}.
 *
 * **Details**
 *
 * The wire spells the status as a union of four empty records
 * (`{ "type": "live" }`). Nothing varies but the tag, so the domain value is
 * the tag itself and the record is only the encoding.
 *
 * **Example** (Decode the status record into its literal)
 *
 * ```ts import.meta.vitest name="Decode the status record into its literal"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AgentSessionStatusFromRecord } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const status = await Effect.runPromise(S.decodeUnknownEffect(AgentSessionStatusFromRecord)({ type: "completed" }))
 * status // => "completed"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const AgentSessionStatusFromRecord = S.Struct({ type: AgentSessionStatus }).pipe(
  S.decodeTo(
    S.toType(AgentSessionStatus),
    SchemaTransformation.transform({
      decode: ({ type }) => type,
      encode: (type) => ({ type }),
    })
  ),
  $I.annoteSchema("AgentSessionStatusFromRecord", {
    description: "The status of a session, decoded from the wire's empty tagged record.",
  })
);

/**
 * Runtime type of {@link AgentSessionStatusFromRecord}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type AgentSessionStatusFromRecord = typeof AgentSessionStatusFromRecord.Type;

/**
 * The agent's own state within a session, wrapped as the wire wraps it.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentState extends S.Opaque<AgentState, { readonly brand: unique symbol }>()(
  S.Struct({
    data: S.Json.annotateKey({ description: "State in the wire form of the agent's declared state type." }),
  }).pipe(
    $I.annoteSchema("AgentState", {
      description: "The agent's own state within a session, wrapped as the wire wraps it.",
    })
  )
) {}

/**
 * A unit of context in a session, such as a user message or a tool call.
 *
 * **Details**
 *
 * The keys are the wire's. OSDK renames `contextItemType` to `type` on the way
 * out; here `type` stays reserved for discriminators.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentContextItem extends S.Opaque<AgentContextItem, { readonly brand: unique symbol }>()(
  S.Struct({
    contextItemType: AgentContextItemType.annotateKey({ description: "Which declared kind of item this is." }),
    data: S.Json.annotateKey({ description: "Data in the wire form of the item kind's declared data type." }),
  }).pipe(
    $I.annoteSchema("AgentContextItem", {
      description: "A unit of context in a session, such as a user message or a tool call.",
    })
  )
) {}

const AgentStateResponseKind = LiteralKit(["available", "behind", "notReady"]);

/**
 * The observed state of a session: its arguments, status, agent state and ordered context items.
 *
 * **Details**
 *
 * This is the `available` answer to a state read (the wire's
 * `SessionStateAvailable`). Arguments, agent state and context item data are
 * JSON here; their precise codecs are projected from the definition of the
 * agent version the session runs. Context items are stored by identifier and
 * ordered separately, as on the wire.
 *
 * **Example** (Decode an observed session state)
 *
 * ```ts import.meta.vitest name="Decode an observed session state"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AgentSessionState } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const state = await Effect.runPromise(
 *   S.decodeUnknownEffect(AgentSessionState)({
 *     type: "available",
 *     arguments: { customerId: 123 },
 *     consistencyKey: "ck-17",
 *     agentState: { data: { summary: "open" } },
 *     contextItems: { "item-1": { contextItemType: "userMessage", data: "hello" } },
 *     contextItemOrder: ["item-1"],
 *     status: { type: "live" },
 *   })
 * )
 * const facts = [state.status, state.agentState.data, state.contextItemOrder]
 * facts // => ["live", { summary: "open" }, ["item-1"]]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentSessionState extends S.Opaque<AgentSessionState, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("available"),
    arguments: S.Record(AgentArgumentName, S.Json).annotateKey({
      description: "The arguments the session was created with, by argument name.",
    }),
    consistencyKey: AgentConsistencyKey.annotateKey({ description: "Marker of the state this record observes." }),
    agentState: AgentState,
    contextItems: S.Record(AgentContextItemId, AgentContextItem).annotateKey({
      description: "Every context item of the session, by identifier.",
    }),
    contextItemOrder: S.Array(AgentContextItemId).annotateKey({
      description: "Identifiers of the context items in the order they should be read.",
    }),
    status: AgentSessionStatusFromRecord.annotateKey({ description: "Where the session is in its life." }),
  }).pipe(
    $I.annoteSchema("AgentSessionState", {
      description: "The observed state of a session: its arguments, status, agent state and ordered context items.",
    })
  )
) {}

/**
 * The platform has not yet observed the requested consistency key; read again after a short delay.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentStateBehind extends S.Opaque<AgentStateBehind, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("behind") }).pipe(
    $I.annoteSchema("AgentStateBehind", {
      description: "The platform has not yet observed the requested consistency key.",
    })
  )
) {}

/**
 * The session has not started yet, so it has no state to read; read again after a short delay.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentStateNotReady extends S.Opaque<AgentStateNotReady, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("notReady") }).pipe(
    $I.annoteSchema("AgentStateNotReady", {
      description: "The session has not started yet, so it has no state to read.",
    })
  )
) {}

/**
 * The answer to a state read: the state, or one of two reasons to read again.
 *
 * **Example** (Keep polling until state is available)
 *
 * ```ts import.meta.vitest name="Keep polling until state is available"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AgentStateResponse } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const shouldPollAgain = AgentStateResponse.match({
 *   available: () => false,
 *   behind: () => true,
 *   notReady: () => true,
 * })
 * const response = await Effect.runPromise(S.decodeUnknownEffect(AgentStateResponse)({ type: "behind" }))
 * const verdicts = [shouldPollAgain(response), AgentStateResponse.guards.available(response)]
 * verdicts // => [true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentStateResponse = AgentStateResponseKind.mapMembers(() =>
  Tuple.make(AgentSessionState, AgentStateBehind, AgentStateNotReady)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("AgentStateResponse", {
    description: "The answer to a state read: the state, or one of two reasons to read again.",
  })
);

/**
 * Runtime type of {@link AgentStateResponse}.
 *
 * @category models
 * @since 0.0.0
 */
export type AgentStateResponse = typeof AgentStateResponse.Type;

// -----------------------------------------------------------------------------
// Object references
// -----------------------------------------------------------------------------

/**
 * A value of an agent `object` type: which object, by ontology, object type and primary key.
 *
 * **Details**
 *
 * The agents wire has its own spelling of "which object". The primary key is a
 * record from the key property's API name to the key value, and it holds exactly
 * one entry: an object type has one primary key property. OSDK accepts only text
 * and number keys here; the kernel's primary key codec is used instead, so a
 * long, date or timestamp key is written in its canonical text.
 *
 * **Gotchas**
 *
 * The entry count is taken over property names. An empty string is not a
 * property name, and a record schema drops a key that is not one, so
 * `{ "": 1, "customerId": 123 }` decodes as its single named entry.
 *
 * **Example** (Require exactly one primary key entry)
 *
 * ```ts import.meta.vitest name="Require exactly one primary key entry"
 * import * as S from "effect/Schema"
 * import { AgentObjectReference } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const isReference = S.is(AgentObjectReference)
 * const customer = {
 *   ontologyRid: "ri.ontology.main.ontology.def0ca71-bafa-4a0b-9575-5174961ac9d2",
 *   objectTypeApiName: "Customer",
 *   primaryKey: { customerId: 123 },
 * }
 * const verdicts = [
 *   isReference(customer),
 *   isReference({ ...customer, primaryKey: {} }),
 *   isReference({ ...customer, primaryKey: { customerId: 123, region: "EU" } }),
 * ]
 * verdicts // => [true, false, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentObjectReference extends S.Opaque<AgentObjectReference, { readonly brand: unique symbol }>()(
  S.Struct({
    ontologyRid: OntologyRid.annotateKey({ description: "Ontology the object lives in." }),
    objectTypeApiName: ObjectTypeApiName.annotateKey({ description: "The concrete object type of the object." }),
    primaryKey: S.Record(PropertyApiName, PrimaryKeyValue)
      .check(
        S.isMinProperties(
          1,
          $I.annote("PrimaryKeyEntryPresentCheck", {
            title: "Primary key entry present",
            description: "A primary key record that names the key property and its value.",
            message: "Expected exactly one primary key entry, found none",
          })
        ),
        S.isMaxProperties(
          1,
          $I.annote("SinglePrimaryKeyEntryCheck", {
            title: "Single primary key entry",
            description: "A primary key record with no entry besides the key property and its value.",
            message: "Expected exactly one primary key entry, found several",
          })
        )
      )
      .annotateKey({ description: "The key property's API name mapped to the value that identifies the object." }),
  }).pipe(
    $I.annoteSchema("AgentObjectReference", {
      description: "A value of an agent object type: which object, by ontology, object type and primary key.",
    })
  )
) {}
