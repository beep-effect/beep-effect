/**
 * Property addressing: the one place where the wire's two spellings of "which property" become one selector.
 *
 * **Details**
 *
 * Every wire record that reads a property (a filter leaf, an aggregation
 * metric, a grouping) names it with one of two mutually exclusive optional
 * keys: `field`, a bare property name, or `propertyIdentifier`, a selector
 * record. The domain has one field, `property`, holding a
 * {@link PropertySelector}. {@link decodeAddressTo} is the struct-level codec
 * step between the two shapes, {@link PropertyAddressFields} is the wire pair
 * a record spreads into its own fields, and {@link PropertyAddressed} builds
 * the common case of a record tagged on `type` in one call.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaParser from "effect/SchemaParser";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { PropertyApiName } from "../Identifier/Identifier.model.ts";
import { PropertyByName, PropertySelector } from "./Property.model.ts";

/**
 * The wire's pair of mutually exclusive keys that address one property, ready to spread into a struct.
 *
 * **Details**
 *
 * Both keys are optional on the wire because exactly one of them is sent.
 * Spread the pair into the wire-side struct of a record and hand that struct
 * to {@link decodeAddressTo}, which checks the "exactly one" rule and replaces
 * the pair with a single `property` selector.
 *
 * **Example** (Spread the address keys into a wire struct)
 *
 * ```ts import.meta.vitest name="Spread the address keys into a wire struct"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PropertyAddressFields } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const Wire = S.Struct({ ...PropertyAddressFields, limit: S.Finite })
 * const encoded = await Effect.runPromise(
 *   S.decodeUnknownEffect(Wire)({ field: "title", limit: 3 }).pipe(Effect.flatMap(S.encodeEffect(Wire)))
 * )
 * encoded // => { field: "title", limit: 3 }
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PropertyAddressFields = {
  field: S.OptionFromOptionalKey(PropertyApiName).pipe(
    S.annotateKey({ description: "Bare name of the addressed property; exclusive with propertyIdentifier." })
  ),
  propertyIdentifier: S.OptionFromOptionalKey(PropertySelector).pipe(
    S.annotateKey({ description: "Selector of the addressed property; exclusive with field." })
  ),
};

// The codec step below is generic in the two record shapes, and TypeScript cannot relate two struct
// types that differ in one key while their other fields are a type parameter. So the transformation
// never asserts a shape. It reads the address through these two views and hands the reshaped record to
// the target's own type-side parser, which drops the keys that do not belong and returns the exact
// type. The price is one more validation of an already decoded record in each direction.
const WireAddress = S.toType(S.Struct(PropertyAddressFields));
const DomainAddress = S.toType(S.Struct({ property: PropertySelector }));

const readWireAddress = SchemaParser.decodeUnknownEffect(WireAddress);
const readDomainAddress = SchemaParser.decodeUnknownEffect(DomainAddress);

const addressIssue = (found: "neither" | "both", input: unknown): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue(
    { message: `Expected exactly one of "field" and "propertyIdentifier" to address a property, got ${found}` },
    input
  );

const selectorOf = (
  address: typeof WireAddress.Type,
  input: unknown
): Effect.Effect<PropertySelector, SchemaIssue.Issue> =>
  O.match(address.field, {
    onNone: () => Effect.fromOption(address.propertyIdentifier, () => addressIssue("neither", input)),
    onSome: (apiName) =>
      O.isSome(address.propertyIdentifier)
        ? Effect.fail(addressIssue("both", input))
        : Effect.succeed(PropertyByName.make({ apiName })),
  });

const byIdentifier = (selector: PropertySelector): typeof WireAddress.Type => ({
  field: O.none(),
  propertyIdentifier: O.some(selector),
});

// A selector by name has the compact spelling `field`; every other selector needs the record. So a
// value decoded from `field` encodes back to `field`, and the long spelling
// `{ propertyIdentifier: { type: "property", apiName } }` normalises to `field` on the way out.
const addressOf: (selector: PropertySelector) => typeof WireAddress.Type = PropertySelector.match({
  property: ({ apiName }) => ({ field: O.some(apiName), propertyIdentifier: O.none() }),
  structField: byIdentifier,
  propertyWithLoadLevel: byIdentifier,
  titleProperty: byIdentifier,
  primaryKeyProperty: byIdentifier,
});

const addressDecodedTo = <
  Wire extends S.Top & { readonly Type: object },
  Domain extends S.Top & { readonly Type: object },
>(
  wire: Wire,
  domain: Domain
) => {
  const target = S.toType(domain);
  const asDomain = SchemaParser.decodeUnknownEffect(target);
  const asWire = SchemaParser.decodeUnknownEffect(S.toType(wire));
  return wire.pipe(
    S.decodeTo(
      target,
      SchemaTransformation.transformEffect({
        decode: (record, options) =>
          readWireAddress(record, options).pipe(
            Effect.flatMap((address) => selectorOf(address, record)),
            Effect.flatMap((property) => asDomain({ ...record, property }, options))
          ),
        encode: (record, options) =>
          Effect.flatMap(readDomainAddress(record, options), ({ property }) =>
            asWire({ ...record, ...addressOf(property) }, options)
          ),
      })
    )
  );
};

/**
 * Joins a wire record addressed by `field` or `propertyIdentifier` to a domain record with one `property`.
 *
 * **Details**
 *
 * `wire` is a struct that spreads {@link PropertyAddressFields} among its own
 * fields; it may rename wire keys with `S.encodeKeys`. `domain` is the struct
 * the record decodes to: the same fields with the pair replaced by
 * `property: PropertySelector`. It may carry its own checks and key
 * descriptions. Decoding accepts either wire key and fails when both or
 * neither is present. Encoding writes `field` for a selector by name and
 * `propertyIdentifier` for every other selector, so the compact spelling is
 * used whenever it can be.
 *
 * The result has a struct on both sides, so it can be a member of an
 * `S.toTaggedUnion("type")` union and the base of an `S.Opaque` class.
 *
 * **Gotchas**
 *
 * Apart from the address, the two structs must declare the same keys with the
 * same decoded types: a key only one side declares is dropped on the way to
 * the other.
 *
 * **Example** (Rename a wire key and address a property in one record)
 *
 * ```ts import.meta.vitest name="Rename a wire key and address a property in one record"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { decodeAddressTo, PropertyAddressFields, PropertySelector } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const Bucketed = S.Struct({ ...PropertyAddressFields, width: S.Finite }).pipe(
 *   S.encodeKeys({ width: "fixedWidth" }),
 *   decodeAddressTo(S.Struct({ property: PropertySelector, width: S.Finite }))
 * )
 * const decoded = await Effect.runPromise(
 *   S.decodeUnknownEffect(Bucketed)({ propertyIdentifier: { type: "property", apiName: "salary" }, fixedWidth: 10 })
 * )
 * const wire = await Effect.runPromise(S.encodeEffect(Bucketed)(decoded))
 * const facts = [decoded, wire]
 * facts // => [{ property: { type: "property", apiName: "salary" }, width: 10 }, { field: "salary", fixedWidth: 10 }]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeAddressTo: {
  <Domain extends S.Top & { readonly Type: object }>(
    domain: Domain
  ): <Wire extends S.Top & { readonly Type: object }>(wire: Wire) => ReturnType<typeof addressDecodedTo<Wire, Domain>>;
  <Wire extends S.Top & { readonly Type: object }, Domain extends S.Top & { readonly Type: object }>(
    wire: Wire,
    domain: Domain
  ): ReturnType<typeof addressDecodedTo<Wire, Domain>>;
} = dual(2, addressDecodedTo);

const propertyAddressed = <const Tag extends string, const Payload extends S.Struct.Fields>(
  tag: Tag,
  payload: Payload
) =>
  addressDecodedTo(
    S.Struct({ type: S.tag(tag), ...PropertyAddressFields, ...payload }),
    S.Struct({ type: S.tag(tag), property: PropertySelector, ...payload })
  );

/**
 * Builds the codec of a wire record that is tagged on `type` and addresses exactly one property.
 *
 * **When to use**
 *
 * Use when the record's wire keys and domain keys are the same apart from the
 * address. A record that renames a key or checks its domain fields builds its
 * two structs by hand and joins them with {@link decodeAddressTo}.
 *
 * **Details**
 *
 * The wire side is a struct with the tag, the payload fields and the optional
 * pair `field` / `propertyIdentifier`. The domain side is a struct with the
 * tag, the payload fields and one `property` selector. The two are joined by
 * {@link decodeAddressTo}, so the reading and writing rules are the ones
 * described there.
 *
 * **Gotchas**
 *
 * The payload must not declare `type`, `property`, `field` or
 * `propertyIdentifier`: the factory owns those keys.
 *
 * **Example** (Read either wire spelling into one selector)
 *
 * ```ts import.meta.vitest name="Read either wire spelling into one selector"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PropertyAddressed } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const LongerThan = PropertyAddressed("longerThan", { length: S.Finite })
 * const decode = S.decodeUnknownEffect(LongerThan)
 * const decoded = await Effect.runPromise(
 *   Effect.all([
 *     decode({ type: "longerThan", field: "title", length: 3 }),
 *     decode({ type: "longerThan", propertyIdentifier: { type: "property", apiName: "title" }, length: 3 }),
 *   ])
 * )
 * const wire = await Effect.runPromise(Effect.forEach(decoded, S.encodeEffect(LongerThan)))
 * wire // => [{ type: "longerThan", field: "title", length: 3 }, { type: "longerThan", field: "title", length: 3 }]
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const PropertyAddressed: {
  <const Payload extends S.Struct.Fields>(
    payload: Payload
  ): <const Tag extends string>(tag: Tag) => ReturnType<typeof propertyAddressed<Tag, Payload>>;
  <const Tag extends string, const Payload extends S.Struct.Fields>(
    tag: Tag,
    payload: Payload
  ): ReturnType<typeof propertyAddressed<Tag, Payload>>;
} = dual(2, propertyAddressed);
