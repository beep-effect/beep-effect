/**
 * Projections from an agent data type to the codecs of its values, and the failures and defaults of session polling.
 *
 * **Details**
 *
 * OSDK converts agent values with two hand-written recursive walkers
 * (`toDataValueAgents`, `fromDataValueAgents`) that must agree with each other
 * and with the generated TypeScript types. Here an {@link AgentDataType} is
 * data and {@link valueCodec} is one match over it: the types that hold other
 * types and the two references are unfolded, and every scalar is read from the
 * table every universe shares (`sharedCodec` of `Value`) by its tag. Both
 * directions, the guard and the static shape fall out of the codec it returns,
 * and adding a data type is a compile error until its value codec exists.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { ObjectSetRid } from "../Identifier/Identifier.model.ts";
import { structCodec } from "../internal/ProjectedCodec.ts";
import { sharedCodec } from "../Value/Value.behavior.ts";
import {
  AgentConsistencyKey,
  AgentDataType,
  AgentEventId,
  AgentObjectReference,
  AgentSessionId,
  AgentSessionStatus,
} from "./Agent.model.ts";
import type { AgentParameter, AgentStructField } from "./Agent.model.ts";

const $I = $ScratchpadId.create("osdk/Agent/Agent.behavior");

type FieldEntry = readonly [name: string, codec: S.Codec<unknown, unknown>];

const fieldEntries = (fields: ReadonlyArray<AgentStructField>): ReadonlyArray<FieldEntry> =>
  A.map(fields, (field) => Tuple.make(field.name, fieldCodec(field.dataType)));

// -----------------------------------------------------------------------------
// Value codecs
// -----------------------------------------------------------------------------

/**
 * The codec of one value of the given agent data type: wire JSON on the encoded side, domain value on the type side.
 *
 * **Details**
 *
 * Facts stated by the type precipitate into the codec. The scalars are the
 * rows of the shared table, so a `long` is a `bigint`, a `date` a `LocalDate` and
 * a `timestamp` a `DateTime.Utc`. `nullable` becomes an `Option` over JSON
 * `null`, `list` an array, `record` a record with text keys, and `struct` a
 * struct of its fields (see {@link fieldCodec}). A `discriminatedUnion` becomes
 * a union of structs, each carrying its discriminator value as a literal under
 * the discriminator key. An `object` becomes an {@link AgentObjectReference}
 * that must name the declared object type, and an `objectSet` the RID of an
 * object set.
 *
 * The static type is necessarily loose (`unknown`), because the data type is
 * only known at runtime.
 *
 * **Gotchas**
 *
 * A struct decodes its declared fields and drops the rest, where OSDK passes
 * undeclared keys through. A union with no members has no values at all. A
 * `nullable` of a `nullable` has two absences and the wire one `null`: both
 * encode to it, and it decodes as the inner one (`Some(None)`). Whether the
 * referenced ontology is the client's is not checked here: the type names it
 * by API name, the value by RID, and only a client can resolve one to the
 * other.
 *
 * **Example** (Project a discriminated union to its codec)
 *
 * ```ts import.meta.vitest name="Project a discriminated union to its codec"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AgentDataType, valueCodec } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const party = await Effect.runPromise(
 *   S.decodeUnknownEffect(AgentDataType)({
 *     type: "discriminatedUnion",
 *     discriminatorKey: "kind",
 *     members: [
 *       { discriminatorValue: "customer", fields: [{ name: "customerId", dataType: { type: "long" } }] },
 *       { discriminatorValue: "employee", fields: [{ name: "badge", dataType: { type: "string" } }] },
 *     ],
 *   })
 * )
 * const codec = valueCodec(party)
 * const wire = { kind: "customer", customerId: "9007199254740993" }
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(codec)(wire))
 * const again = await Effect.runPromise(S.encodeUnknownEffect(codec)(decoded))
 * const facts = [decoded, again, S.is(codec)({ kind: "supplier" })]
 * facts // => [{ kind: "customer", customerId: BigInt("9007199254740993") }, wire, false]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const valueCodec: (dataType: AgentDataType) => S.Codec<unknown, unknown> = AgentDataType.matchOrElse(
  {
    nullable: ({ wrappedType }) => S.OptionFromNullOr(valueCodec(wrappedType)),
    list: ({ elementType }) => S.Array(valueCodec(elementType)),
    record: ({ valueType }) => S.Record(S.String, valueCodec(valueType)),
    struct: ({ fields }) => structCodec(fieldEntries(fields)),
    // The discriminator entry comes last, so it is the one that holds the discriminator key.
    discriminatedUnion: ({ discriminatorKey, members }) =>
      A.match(members, {
        onEmpty: () => S.Never,
        onNonEmpty: (declared) =>
          S.Union(
            A.map(declared, (member) =>
              S.Struct(
                R.fromEntries(
                  A.append(
                    fieldEntries(member.fields),
                    Tuple.make(discriminatorKey, S.Literal(member.discriminatorValue))
                  )
                )
              )
            )
          ),
      }),
    object: ({ objectTypeApiName }) =>
      AgentObjectReference.check(
        S.makeFilter(
          (reference) => reference.objectTypeApiName === objectTypeApiName,
          $I.annote("DeclaredObjectTypeCheck", {
            title: "Declared object type",
            description: "An object reference whose object type is the one its agent data type declares.",
            message: `Expected a reference to an object of type ${objectTypeApiName}`,
          })
        )
      ),
    // An agent names an object set by its identifier, where an action and a query also take a definition.
    objectSet: () => ObjectSetRid,
  },
  (scalar) => sharedCodec[scalar.type]
);

/**
 * The codec of an agent data type as a field of a struct: a `nullable` field may be absent on the wire.
 *
 * **Details**
 *
 * A field is required unless its type is `nullable`. OSDK omits a nullable
 * field it was given no value for, so decoding accepts both an absent key and
 * an explicit `null` as `None`. Encoding writes `null`, which is the value the
 * declared type itself admits. Every other type projects exactly as
 * {@link valueCodec} does.
 *
 * **Example** (Decode an absent nullable field to none)
 *
 * ```ts import.meta.vitest name="Decode an absent nullable field to none"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { AgentNullableType, fieldCodec } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const Row = S.Struct({ note: fieldCodec(AgentNullableType.make({ wrappedType: StringType.make({}) })) })
 * const row = await Effect.runPromise(S.decodeUnknownEffect(Row)({}))
 * const wire = await Effect.runPromise(S.encodeUnknownEffect(Row)(row))
 * const facts = [O.isNone(row.note), wire]
 * facts // => [true, { note: null }]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const fieldCodec = (dataType: AgentDataType) =>
  AgentDataType.matchOrElse(
    dataType,
    {
      nullable: ({ wrappedType }) =>
        S.OptionFromNullOr(valueCodec(wrappedType)).pipe(S.withDecodingDefaultKey(Effect.succeed(null))),
    },
    () => valueCodec(dataType)
  );

/**
 * The codec of a session's arguments record, projected from an agent version's argument definitions.
 *
 * **Details**
 *
 * The arguments of a session are a struct whose fields are the declared
 * arguments, so this is {@link fieldCodec} applied per argument: an argument is
 * a required key unless its type is `nullable`. An agent with no arguments
 * takes the empty record.
 *
 * **Example** (Decode the arguments of a session)
 *
 * ```ts import.meta.vitest name="Decode the arguments of a session"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AgentParameter, argumentsCodec } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const parameters = await Effect.runPromise(
 *   S.decodeUnknownEffect(S.Array(AgentParameter))([
 *     { name: "tags", dataType: { type: "list", elementType: { type: "string" } } },
 *     { name: "limit", dataType: { type: "nullable", wrappedType: { type: "integer" } } },
 *   ])
 * )
 * const codec = argumentsCodec(parameters)
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(codec)({ tags: ["vip"] }))
 * const wire = await Effect.runPromise(S.encodeUnknownEffect(codec)(decoded))
 * wire // => { tags: ["vip"], limit: null }
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const argumentsCodec = (parameters: ReadonlyArray<AgentParameter>): S.Codec<unknown, unknown> =>
  structCodec(A.map(parameters, (parameter) => Tuple.make(parameter.name, fieldCodec(parameter.dataType))));

// -----------------------------------------------------------------------------
// Session status
// -----------------------------------------------------------------------------

/**
 * Whether a session has ended, in which case it accepts no further events.
 *
 * **Example** (Tell a live session from an ended one)
 *
 * ```ts import.meta.vitest name="Tell a live session from an ended one"
 * import { isTerminal } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const verdicts = [isTerminal("live"), isTerminal("completed"), isTerminal("failed"), isTerminal("canceled")]
 * verdicts // => [false, true, true, true]
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isTerminal: (status: AgentSessionStatus) => boolean = AgentSessionStatus.match({
  live: () => false,
  completed: () => true,
  failed: () => true,
  canceled: () => true,
});

// -----------------------------------------------------------------------------
// Polling
// -----------------------------------------------------------------------------

/**
 * How long a state read or an event send keeps polling before it fails, when the caller does not say: 30 seconds.
 *
 * **Details**
 *
 * Both operations poll: a state read until the platform answers `available`,
 * an event send until it answers `accepted`. At least one request is always
 * made, and the deadline is checked after each answer that asks for another
 * attempt, so a zero timeout means "try exactly once".
 *
 * **Example** (Read the default polling timeout)
 *
 * ```ts import.meta.vitest name="Read the default polling timeout"
 * import * as Duration from "effect/Duration"
 * import { defaultPollTimeout } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const millis = Duration.toMillis(defaultPollTimeout)
 * millis // => 30000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultPollTimeout: Duration.Duration = Duration.seconds(30);

/**
 * How long a state read or an event send waits between two polling attempts, when the caller does not say: 1 second.
 *
 * **Example** (Read the default polling interval)
 *
 * ```ts import.meta.vitest name="Read the default polling interval"
 * import * as Duration from "effect/Duration"
 * import { defaultPollInterval } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const millis = Duration.toMillis(defaultPollInterval)
 * millis // => 1000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultPollInterval: Duration.Duration = Duration.seconds(1);

/**
 * Reading a session's state did not yield an available state within the timeout.
 *
 * **Details**
 *
 * OSDK throws a bare `AgentGetStateTimeoutError` with no payload. This failure
 * carries what a caller needs to try again: the session, the timeout that
 * elapsed and the consistency key that was being waited for, when there was
 * one. Reading state has no side effect, so a retry is always safe.
 *
 * **Example** (Recover the session from a state timeout)
 *
 * ```ts import.meta.vitest name="Recover the session from a state timeout"
 * import * as Duration from "effect/Duration"
 * import * as Effect from "effect/Effect"
 * import { AgentSessionId, AgentStateTimeout } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const failure = AgentStateTimeout.make({
 *   sessionId: AgentSessionId.make("session-1"),
 *   timeout: Duration.seconds(30),
 * })
 * const recovered = await Effect.runPromise(
 *   Effect.catchTag(Effect.fail(failure), "AgentStateTimeout", (error) => Effect.succeed(error.sessionId))
 * )
 * const facts = [recovered, failure.message]
 * facts // => ["session-1", "Agent session state reading timed out after 30s"]
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AgentStateTimeout extends S.TaggedError<AgentStateTimeout, { readonly brand: unique symbol }>(
  $I`AgentStateTimeout`
)(
  "AgentStateTimeout",
  {
    sessionId: AgentSessionId.annotateKey({ description: "The session whose state was being read." }),
    timeout: S.Duration.annotateKey({ description: "How long the read kept polling before it gave up." }),
    consistencyKey: S.OptionFromOptionalKey(AgentConsistencyKey).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The consistency key the read was waiting for, when it asked for one." })
    ),
  },
  $I.annoteError<AgentStateTimeout>("AgentStateTimeout", {
    description: "Reading a session's state did not yield an available state within the timeout.",
  })
) {
  override get message(): string {
    return `Agent session state reading timed out after ${Duration.format(this.timeout)}`;
  }
}

/**
 * Sending an event to a session was not accepted within the timeout.
 *
 * **Details**
 *
 * OSDK throws a bare `AgentSendEventTimeoutError` with no payload. This failure
 * carries the event's identifier, because that identifier is the idempotency
 * key: sending the same event again with the same identifier cannot deliver it
 * twice, while a fresh identifier could.
 *
 * **Example** (Recover the event identifier from an event timeout)
 *
 * ```ts import.meta.vitest name="Recover the event identifier from an event timeout"
 * import * as Duration from "effect/Duration"
 * import * as Effect from "effect/Effect"
 * import { AgentEventId, AgentEventTimeout, AgentSessionId } from "@beep/scratchpad/osdk/src/Agent/index"
 *
 * const failure = AgentEventTimeout.make({
 *   sessionId: AgentSessionId.make("session-1"),
 *   eventId: AgentEventId.make("0b7f1b0e-6a52-4d4f-9a53-0c1f2f6a9d11"),
 *   timeout: Duration.seconds(30),
 * })
 * const recovered = await Effect.runPromise(
 *   Effect.catchTag(Effect.fail(failure), "AgentEventTimeout", (error) => Effect.succeed(error.eventId))
 * )
 * const facts = [recovered, failure.message]
 * facts // => ["0b7f1b0e-6a52-4d4f-9a53-0c1f2f6a9d11", "Agent event sending timed out after 30s"]
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AgentEventTimeout extends S.TaggedError<AgentEventTimeout, { readonly brand: unique symbol }>(
  $I`AgentEventTimeout`
)(
  "AgentEventTimeout",
  {
    sessionId: AgentSessionId.annotateKey({ description: "The session the event was being sent to." }),
    eventId: AgentEventId.annotateKey({
      description: "Idempotency key of the event; reuse it to send the event again.",
    }),
    timeout: S.Duration.annotateKey({ description: "How long the send kept polling before it gave up." }),
  },
  $I.annoteError<AgentEventTimeout>("AgentEventTimeout", {
    description: "Sending an event to a session was not accepted within the timeout.",
  })
) {
  override get message(): string {
    return `Agent event sending timed out after ${Duration.format(this.timeout)}`;
  }
}
