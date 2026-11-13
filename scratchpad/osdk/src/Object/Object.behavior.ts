/**
 * The instance codec: one function from "which object type" to the codec of its instances.
 *
 * **Details**
 *
 * `OntologyObject` reads any object without an ontology and leaves property
 * values as JSON. Once the object type is known, each declared property has a
 * value codec, so the same flat wire record decodes to rich values: instants,
 * calendar dates, 64-bit integers, geometry, nested structs.
 *
 * {@link InstanceOf} is that refinement, written once and generic in the codec
 * of the properties. {@link instanceCodec} applies it to the properties codec
 * projected from a served definition, and a typed model applies it to the
 * struct its property specs precipitate. So an object has two decoded shapes
 * and no more: `OntologyObject` when nothing is known of its type, and the
 * instance, `{ locator, rid, title, score, properties, undeclared }`, when
 * its type is known, however it came to be known.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaParser from "effect/SchemaParser";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { ObjectRid, PropertyApiName } from "../Identifier/Identifier.model.ts";
import { fieldCodec, valueCodec } from "../Property/Property.behavior.ts";
import { ObjectLocator, OntologyObject } from "./Object.model.ts";
import type { ObjectTypeApiName } from "../Identifier/Identifier.model.ts";
import type { PropertyDefinition } from "../Property/Property.model.ts";

const $I = $ScratchpadId.create("osdk/Object/Object.behavior");

// -----------------------------------------------------------------------------
// The instance codec, for any codec of the properties
// -----------------------------------------------------------------------------

/**
 * The codec of one declared property of an object: any codec that needs no service.
 *
 * **Details**
 *
 * A row is read with nothing in the environment, and {@link InstanceOf} reads
 * and writes a key on its own to compare it, so the codec of a property value
 * may require no service in either direction. The projections of the kernel
 * (`valueCodec`, `fieldCodec`) and the property specs of the typed layer are
 * bounded by this type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PropertyCodec = S.Codec<unknown, unknown>;

/**
 * What {@link InstanceOf} needs of an object type: its name, its key property and the codec of its properties.
 *
 * **Details**
 *
 * `properties` is a struct schema with one field per declared property. Its
 * field names are the declared names, and its field under `primaryKey` is the
 * codec of the key. Nothing else is stated, so the three cannot disagree.
 *
 * @typeParam Fields - The codec of each declared property, keyed by property name.
 * @category type-level
 * @since 0.0.0
 */
export interface InstanceShape<
  Fields extends Readonly<Record<string, PropertyCodec>> = Readonly<Record<string, PropertyCodec>>,
> {
  /**
   * Name every instance carries in `__apiName`.
   */
  readonly apiName: string;
  /**
   * Name of the property whose value is the primary key.
   */
  readonly primaryKey: string;
  /**
   * Codec of the declared properties: the keys of the wire record that are not reserved and are declared.
   */
  readonly properties: S.Struct<Fields>;
}

const GenericObject = S.toType(OntologyObject);

const decodeGenericObject = S.decodeUnknownEffect(GenericObject);

// A locator from loose parts: the name and the key are checked, nothing is thrown.
const locate = S.decodeUnknownOption(ObjectLocator);

// The value a record holds under a name. The properties of an instance are typed by a struct this module is
// generic in, so the key property is read from them as from any record.
const valueAt = (record: unknown, name: string): O.Option<unknown> =>
  P.isObject(record) ? R.get(record, name) : O.none();

/**
 * The codec of one instance of an object type, for whatever codec reads its properties.
 *
 * **Details**
 *
 * This is the one implementation of "a flat wire record is an instance". The
 * dynamic tier calls it with the properties codec projected from a served
 * definition ({@link instanceCodec}); a typed model calls it with the struct
 * its property specs precipitate (`Model.object`). Both get the same shape:
 *
 * - `locator` is the ordinary `ObjectLocator`: the object type and the key as
 *   the wire scalar that carried it, ready to hand to anything that takes a
 *   locator;
 * - `rid`, `title` and `score` are `Option`s, as in `OntologyObject`;
 * - `properties` is what `shape.properties` decodes the declared keys to, with
 *   the static type of that codec;
 * - `undeclared` keeps every other wire key as JSON and writes it back when
 *   encoding. The wire does not promise that an object carries only declared
 *   properties (derived properties ride in the same record, and a definition
 *   can be older than the data), so rejecting them would claim a guarantee the
 *   platform does not give, and dropping them would lose data on a round trip.
 *
 * Two invariants hold in both directions: the object is of this object type,
 * and the key in `locator`, read with the key property's codec, equals the key
 * property. The comparison is made in the key's own domain, so an instant
 * spelled with and without milliseconds is one key. Encoding also refuses an
 * undeclared key that is named like a declared property.
 *
 * The two invariants tie fields together, so the codec says how to generate
 * itself: an arbitrary derived from it draws the properties and takes the
 * locator from the key property, and every generated instance encodes.
 *
 * **Gotchas**
 *
 * A request that selects a subset of properties can omit the key property,
 * and a response loaded with property securities wraps every value in a
 * secured-value envelope. Neither record is an instance for this codec; both
 * still decode as an `OntologyObject`. A shape whose `primaryKey` names no
 * field of `properties` yields a codec that rejects every record. Each call
 * builds a new schema, so call it once per object type and keep the result.
 *
 * **Example** (Read an office with a codec of your own for its properties)
 *
 * ```ts import.meta.vitest name="Read an office with a codec of your own for its properties"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { InstanceOf } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const Office = InstanceOf({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: S.Struct({ officeId: S.String, capacity: S.OptionFromOptionalNullOr(S.Finite) }),
 * })
 * const office = await Effect.runPromise(
 *   S.decodeEffect(Office)({ __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 120, floors: 3 })
 * )
 * const facts = [office.locator.primaryKey, office.properties.officeId, office.properties.capacity, office.undeclared]
 * facts // => ["NYC", "NYC", O.some(120), { floors: 3 }]
 * ```
 *
 * **Example** (Generate instances whose two keys agree)
 *
 * ```ts import.meta.vitest name="Generate instances whose two keys agree"
 * import * as A from "effect/Array"
 * import * as Arbitrary from "effect/Arbitrary"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { InstanceOf } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const Flight = InstanceOf({
 *   apiName: "Flight",
 *   primaryKey: "departure",
 *   properties: S.Struct({ departure: S.DateTimeUtcFromString }),
 * })
 * const flights = await Effect.runPromise(Arbitrary.sampleEffect(Arbitrary.schema(Flight), { count: 20, seed: 1 }))
 * const wires = await Effect.runPromise(Effect.forEach(flights, (flight) => S.encodeEffect(Flight)(flight)))
 * const agree = A.every(wires, (wire) => wire.__apiName === "Flight" && wire.__primaryKey === wire.departure)
 * agree // => true
 * ```
 *
 * @param shape - The object type's name, its key property and the codec of its declared properties.
 * @returns A codec from the flat wire record to `{ locator, rid, title, score, properties, undeclared }`.
 * @category factories
 * @since 0.0.0
 */
export const InstanceOf = <Fields extends Readonly<Record<string, PropertyCodec>>>(shape: InstanceShape<Fields>) => {
  const { apiName, primaryKey, properties } = shape;
  const declared: Readonly<Record<string, PropertyCodec>> = properties.fields;
  const declaredKey = R.get(declared, primaryKey);
  // A shape whose key property is not declared has no key codec: nothing reads a key, so the agreement
  // check below fails for every record and says why.
  const keyCodec = O.getOrElse(declaredKey, (): PropertyCodec => S.Never);
  const sameKey = S.toEquivalence(keyCodec);
  // The locator holds the key as the wire scalar; the key property's codec reads it and writes it.
  const readKey = S.decodeOption(keyCodec);
  const writeKey = S.encodeOption(keyCodec);

  // Everything of an instance but its locator. An arbitrary instance is drawn from these alone.
  const fields = {
    rid: ObjectRid.pipe(S.toType, S.Option),
    title: S.Option(S.String),
    score: S.Option(S.Finite),
    // The declared keys reach the properties codec as the JSON they are; it reads them as its own encoded side.
    properties: S.Record(PropertyApiName, S.Json).pipe(
      S.decodeTo(properties, SchemaTransformation.passthrough({ strict: false }))
    ),
    undeclared: S.Record(PropertyApiName, S.Json),
  };

  const Parts = S.Struct({
    locator: S.toType(ObjectLocator).check(
      S.makeFilter(
        ({ objectType }) => objectType === apiName,
        $I.annote("InstanceObjectTypeCheck", {
          title: "Instance object type",
          description: "The object is of the object type the codec was built for.",
          message: `Expected an object of type "${apiName}"`,
        })
      )
    ),
    ...fields,
  });

  const Agreed = S.toType(Parts).check(
    S.makeFilter(
      ({ locator, properties: typed }) =>
        O.exists(valueAt(typed, primaryKey), (key) =>
          O.exists(readKey(locator.primaryKey), (located) => sameKey(located, key))
        ),
      $I.annote("PrimaryKeyAgreementCheck", {
        title: "Primary key agreement",
        description: "The key that locates the object, read as a value of its key property, equals that property.",
        message: O.match(declaredKey, {
          onNone: () => `The primary key property "${primaryKey}" is not declared by object type "${apiName}"`,
          onSome: () => `Expected the primary key to equal the value of the "${primaryKey}" property`,
        }),
      })
    )
  );

  const validate = SchemaParser.decodeUnknownEffect(Agreed);

  // The agreement of the two keys ties two fields together, and a check across fields can only reject what was
  // generated. So the checked record is restated as a declaration, the one kind of schema that can say how to
  // generate itself: draw everything but the locator, then locate the object by its own key property.
  const Instance = S.declareConstructor<typeof Agreed.Type>()(
    [],
    () => (input, _, options) => validate(input, options),
    {
      ...$I.annote("Instance", {
        description: "One object of an object type: its locator, its typed properties and its undeclared keys.",
      }),
      toEquivalence: () => S.toEquivalence(Agreed),
      toCodecArbitrary: () =>
        S.link<typeof Agreed.Type>()(S.toType(S.Struct(fields)), {
          decode: SchemaGetter.transformOptional(
            O.flatMap((drawn) =>
              pipe(
                valueAt(drawn.properties, primaryKey),
                O.flatMap(writeKey),
                O.flatMap((key) => locate({ objectType: apiName, primaryKey: key })),
                O.map((locator) => ({
                  ...drawn,
                  locator,
                  // A drawn key that is named like a declared property could not be written back.
                  undeclared: R.filter(drawn.undeclared, (_, name) => !R.has(declared, name)),
                }))
              )
            )
          ),
          encode: SchemaGetter.forbidden(() => "An instance is drawn from its parts; the parts are never read back."),
        }),
    }
  );

  return OntologyObject.pipe(
    S.decodeTo(
      Parts,
      SchemaTransformation.transformEffect<typeof Parts.Encoded, OntologyObject>({
        decode: ({ properties: wire, ...identity }) => {
          const [known, undeclared] = R.partition(wire, (value, name) =>
            R.has(declared, name) ? Result.succeed(value) : Result.fail(value)
          );
          return Effect.succeed({ ...identity, properties: known, undeclared });
        },
        encode: ({ properties: known, undeclared, ...identity }, options) =>
          A.match(A.intersection(R.keys(undeclared), R.keys(declared)), {
            onEmpty: () =>
              Effect.mapError(
                decodeGenericObject({ ...identity, properties: { ...undeclared, ...known } }),
                (error) => error.issue
              ),
            onNonEmpty: (shadowed) =>
              Effect.fail(
                new SchemaIssue.InvalidValue(
                  { message: `Undeclared keys collide with declared properties: ${A.join(shadowed, ", ")}` },
                  undeclared,
                  options
                )
              ),
          }),
      })
    ),
    S.decodeTo(Instance, SchemaTransformation.passthrough())
  );
};

// -----------------------------------------------------------------------------
// The instance codec of a served object type
// -----------------------------------------------------------------------------

/**
 * What {@link instanceCodec} needs to know about an object type: its name, its key property and its properties.
 *
 * **Details**
 *
 * This is a function contract, not a data model: any value with these three
 * fields is accepted, and a decoded object type has them. It keeps the
 * projection independent of everything else an object type carries (display
 * names, datasources, interface implementations).
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ObjectTypeSignature {
  /**
   * Name every instance carries in `__apiName`.
   */
  readonly apiName: ObjectTypeApiName;
  /**
   * Name of the property whose value is the primary key.
   */
  readonly primaryKey: PropertyApiName;
  /**
   * The declared properties, keyed by property name.
   */
  readonly properties: Readonly<Record<PropertyApiName, PropertyDefinition>>;
}

/**
 * The codec of one instance of the given object type: the flat wire record on one side, typed values on the other.
 *
 * **Details**
 *
 * `OntologyObject` reads any object without an ontology and leaves property
 * values as JSON. Once the object type is known, each declared property has a
 * value codec (the kernel's `valueCodec`), so the same flat wire record decodes
 * to rich values. This is {@link InstanceOf} applied to the properties codec
 * the definition projects to:
 *
 * - the key property is required and decoded with its value codec, so a
 *   timestamp key is a `DateTime.Utc` there and a long key a `bigint`;
 * - every other property is decoded with the kernel's `fieldCodec`: absent or
 *   `null` on the wire, an `Option` here.
 *
 * The shape of an instance, its two invariants and what becomes of undeclared
 * keys are those of `InstanceOf`, and they are the same for an instance of a
 * typed model: a row decoded here and by a model whose specs denote the same
 * property types are equal values.
 *
 * **Gotchas**
 *
 * The signature is read at run time, so `properties` is typed as a record of
 * unknown values; a typed model gives the same codec with exact types. A
 * signature whose `primaryKey` names no declared property yields a codec that
 * rejects every record. An explicit `null` property decodes to `None` and is
 * omitted when encoding. Each call builds a new schema, so project once per
 * object type and keep the result.
 *
 * **Example** (Decode a flight to typed values and encode it canonically)
 *
 * ```ts import.meta.vitest name="Decode a flight to typed values and encode it canonically"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StringType, TimestampType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ObjectTypeApiName, PropertyApiName, PropertyTypeRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { instanceCodec } from "@beep/scratchpad/osdk/src/Object/index"
 * import { PropertyDefinition } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const rid = PropertyTypeRid.make("ri.ontology.main.property.example")
 * const flightId = PropertyApiName.make("flightId")
 * const Flight = instanceCodec({
 *   apiName: ObjectTypeApiName.make("Flight"),
 *   primaryKey: flightId,
 *   properties: {
 *     [flightId]: PropertyDefinition.make({ dataType: StringType.make({}), rid }),
 *     [PropertyApiName.make("departure")]: PropertyDefinition.make({ dataType: TimestampType.make({}), rid }),
 *     [PropertyApiName.make("gate")]: PropertyDefinition.make({ dataType: StringType.make({}), rid }),
 *   },
 * })
 * const flight = await Effect.runPromise(
 *   S.decodeEffect(Flight)({
 *     __apiName: "Flight",
 *     __primaryKey: "AA100",
 *     flightId: "AA100",
 *     departure: "2024-05-01T08:30:00Z",
 *     gate: null,
 *   })
 * )
 * const wire = await Effect.runPromise(S.encodeEffect(Flight)(flight))
 * wire // => { __apiName: "Flight", __primaryKey: "AA100", flightId: "AA100", departure: "2024-05-01T08:30:00.000Z" }
 * ```
 *
 * **Example** (Keep a derived value the definition does not declare)
 *
 * ```ts import.meta.vitest name="Keep a derived value the definition does not declare"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StringType } from "@beep/scratchpad/osdk/src/DataType/index"
 * import { ObjectTypeApiName, PropertyApiName, PropertyTypeRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { instanceCodec } from "@beep/scratchpad/osdk/src/Object/index"
 * import { PropertyDefinition } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const rid = PropertyTypeRid.make("ri.ontology.main.property.example")
 * const flightId = PropertyApiName.make("flightId")
 * const Flight = instanceCodec({
 *   apiName: ObjectTypeApiName.make("Flight"),
 *   primaryKey: flightId,
 *   properties: { [flightId]: PropertyDefinition.make({ dataType: StringType.make({}), rid }) },
 * })
 * const flight = await Effect.runPromise(
 *   S.decodeEffect(Flight)({ __apiName: "Flight", __primaryKey: "AA100", flightId: "AA100", delayMinutes: 12 })
 * )
 * flight.undeclared // => { delayMinutes: 12 }
 * ```
 *
 * @param signature - The object type's name, key property and declared properties.
 * @returns A codec from the flat wire record to `{ locator, rid, title, score, properties, undeclared }`.
 * @category projections
 * @since 0.0.0
 */
export const instanceCodec = ({ apiName, primaryKey, properties }: ObjectTypeSignature) =>
  InstanceOf({
    apiName,
    primaryKey,
    properties: S.Struct(
      R.map(properties, ({ dataType }, name) => (name === primaryKey ? valueCodec(dataType) : fieldCodec(dataType)))
    ),
  });
