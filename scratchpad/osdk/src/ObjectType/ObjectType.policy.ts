/**
 * Authoring rules for object types: what a name may look like, which words are taken and how long text may be.
 *
 * **Details**
 *
 * None of this is part of the wire codec. The platform returns object types
 * whose names predate or ignore these rules (lower-case object type names,
 * resource identifiers such as `"rid"`), so decoding accepts any non-empty
 * name. The rules here are the ones the authoring tools enforce before an
 * ontology is published. They are exported as check groups to apply where
 * authoring happens: `S.String.check(ObjectTypeApiNameChecks)` for one name,
 * `ObjectType.check(ObjectTypeAuthoringChecks)` for a whole object type.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { constTrue, flow } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ObjectType } from "./ObjectType.model.ts";

const $I = $ScratchpadId.create("osdk/ObjectType/ObjectType.policy");

// -----------------------------------------------------------------------------
// Reserved words
// -----------------------------------------------------------------------------

/**
 * Words no API name may be, whatever its letter case, because the platform uses them itself.
 *
 * **Details**
 *
 * Only a whole name is rejected: `object` and `Object` are taken, `objectId`
 * is not.
 *
 * **Example** (List the reserved words)
 *
 * ```ts import.meta.vitest name="List the reserved words"
 * import { ReservedKeyword } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const facts = [ReservedKeyword.literals.length, ReservedKeyword.is.rid("rid"), ReservedKeyword.is.rid("RID")]
 * facts // => [9, true, false]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ReservedKeyword = LiteralKit([
  "ontology",
  "object",
  "property",
  "link",
  "relation",
  "rid",
  "primarykey",
  "typeid",
  "ontologyobject",
]).pipe(
  $I.annoteSchema("ReservedKeyword", {
    description: "Words no API name may be, whatever its letter case, because the platform uses them itself.",
  })
);

/**
 * Runtime type of {@link ReservedKeyword}.
 *
 * @category validation
 * @since 0.0.0
 */
export type ReservedKeyword = typeof ReservedKeyword.Type;

const isReservedKeyword: P.Predicate<string> = flow(Str.toLowerCase, S.is(ReservedKeyword));

const reservedWords = "ontology, object, property, link, relation, rid, primarykey, typeid, ontologyobject";

// -----------------------------------------------------------------------------
// API names
// -----------------------------------------------------------------------------

/**
 * What the authoring tools accept as the API name of an object type.
 *
 * **Details**
 *
 * A name is one to a hundred characters: a letter, then letters and digits,
 * optionally followed by dot-separated segments of letters and digits (the
 * leading segments are a namespace). Underscores are not allowed, and the
 * name must not be a reserved word.
 *
 * **Example** (Check object type names)
 *
 * ```ts import.meta.vitest name="Check object type names"
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { ObjectTypeApiNameChecks } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const isValid = S.is(S.String.check(ObjectTypeApiNameChecks))
 * const verdicts = A.map(["Employee", "com.acme.Employee", "employee_record", "Object", "9Lives"], isValid)
 * verdicts // => [true, true, false, false, false]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ObjectTypeApiNameChecks = S.makeFilterGroup<string>(
  [
    S.isPattern(
      /^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)*$/u,
      $I.annote("ObjectTypeApiNameShapeCheck", {
        title: "Object Type API Name Shape",
        description: "A letter, then letters and digits, optionally followed by dot-separated segments of the same.",
        message:
          "An object type API name must start with a letter and use only letters, digits and dots between segments",
      })
    ),
    S.isMaxLength(
      100,
      $I.annote("ObjectTypeApiNameLengthCheck", {
        title: "Object Type API Name Length",
        description: "At most 100 characters, namespace included.",
        message: "An object type API name must be at most 100 characters long",
      })
    ),
    S.makeFilter(
      P.not(isReservedKeyword),
      $I.annote("ObjectTypeApiNameReservedCheck", {
        title: "Object Type API Name Not Reserved",
        description: "Not one of the words the platform reserves, in any letter case.",
        message: `An object type API name must not be a reserved word (${reservedWords})`,
      })
    ),
  ],
  $I.annote("ObjectTypeApiNameChecks", {
    title: "Object Type API Name",
    description: "What the authoring tools accept as the API name of an object type.",
  })
);

/**
 * What the authoring tools accept as the API name of a property.
 *
 * **Details**
 *
 * A name is one to a hundred characters: a letter, then letters, digits and
 * underscores, and not a reserved word. The same rule governs interface
 * property names.
 *
 * **Example** (Check property names)
 *
 * ```ts import.meta.vitest name="Check property names"
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { PropertyApiNameChecks } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const isValid = S.is(S.String.check(PropertyApiNameChecks))
 * const verdicts = A.map(["employeeId", "start_date", "full.name", "PrimaryKey", "_hidden"], isValid)
 * verdicts // => [true, true, false, false, false]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PropertyApiNameChecks = S.makeFilterGroup<string>(
  [
    S.isPattern(
      /^[a-zA-Z][a-zA-Z0-9_]{0,99}$/u,
      $I.annote("PropertyApiNameShapeCheck", {
        title: "Property API Name Shape",
        description: "A letter, then letters, digits and underscores: one to a hundred characters in all.",
        message:
          "A property API name must start with a letter, use only letters, digits and underscores, and be at most 100 characters long",
      })
    ),
    S.makeFilter(
      P.not(isReservedKeyword),
      $I.annote("PropertyApiNameReservedCheck", {
        title: "Property API Name Not Reserved",
        description: "Not one of the words the platform reserves, in any letter case.",
        message: `A property API name must not be a reserved word (${reservedWords})`,
      })
    ),
  ],
  $I.annote("PropertyApiNameChecks", {
    title: "Property API Name",
    description: "What the authoring tools accept as the API name of a property.",
  })
);

/**
 * What the authoring tools accept as the API name of one side of a link type.
 *
 * **Details**
 *
 * The rule is the one for property names: a letter, then letters, digits and
 * underscores, one to a hundred characters, and not a reserved word. It is a
 * separate group so a failure names the right thing.
 *
 * **Example** (Check link side names)
 *
 * ```ts import.meta.vitest name="Check link side names"
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { LinkApiNameChecks } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const isValid = S.is(S.String.check(LinkApiNameChecks))
 * const verdicts = A.map(["occupants", "visited_offices", "link", "lead-of"], isValid)
 * verdicts // => [true, true, false, false]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const LinkApiNameChecks = S.makeFilterGroup<string>(
  [
    S.isPattern(
      /^[a-zA-Z][a-zA-Z0-9_]{0,99}$/u,
      $I.annote("LinkApiNameShapeCheck", {
        title: "Link API Name Shape",
        description: "A letter, then letters, digits and underscores: one to a hundred characters in all.",
        message:
          "A link API name must start with a letter, use only letters, digits and underscores, and be at most 100 characters long",
      })
    ),
    S.makeFilter(
      P.not(isReservedKeyword),
      $I.annote("LinkApiNameReservedCheck", {
        title: "Link API Name Not Reserved",
        description: "Not one of the words the platform reserves, in any letter case.",
        message: `A link API name must not be a reserved word (${reservedWords})`,
      })
    ),
  ],
  $I.annote("LinkApiNameChecks", {
    title: "Link API Name",
    description: "What the authoring tools accept as the API name of one side of a link type.",
  })
);

/**
 * What the authoring tools accept as the API name of an interface an object type implements.
 *
 * **Details**
 *
 * The shape is the one for object type names with underscores allowed: a
 * letter, then letters, digits and underscores, optionally followed by
 * dot-separated segments of the same, one to a hundred characters in all, and
 * not a reserved word.
 *
 * **Example** (Check interface names)
 *
 * ```ts import.meta.vitest name="Check interface names"
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * import { InterfaceApiNameChecks } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const isValid = S.is(S.String.check(InterfaceApiNameChecks))
 * const verdicts = A.map(["FooInterface", "com.acme.Has_Location", "Relation", "Foo..Bar"], isValid)
 * verdicts // => [true, true, false, false]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const InterfaceApiNameChecks = S.makeFilterGroup<string>(
  [
    S.isPattern(
      /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*$/u,
      $I.annote("InterfaceApiNameShapeCheck", {
        title: "Interface API Name Shape",
        description:
          "A letter, then letters, digits and underscores, optionally followed by dot-separated segments of the same.",
        message:
          "An interface API name must start with a letter and use only letters, digits, underscores and dots between segments",
      })
    ),
    S.isMaxLength(
      100,
      $I.annote("InterfaceApiNameLengthCheck", {
        title: "Interface API Name Length",
        description: "At most 100 characters, namespace included.",
        message: "An interface API name must be at most 100 characters long",
      })
    ),
    S.makeFilter(
      P.not(isReservedKeyword),
      $I.annote("InterfaceApiNameReservedCheck", {
        title: "Interface API Name Not Reserved",
        description: "Not one of the words the platform reserves, in any letter case.",
        message: `An interface API name must not be a reserved word (${reservedWords})`,
      })
    ),
  ],
  $I.annote("InterfaceApiNameChecks", {
    title: "Interface API Name",
    description: "What the authoring tools accept as the API name of an interface an object type implements.",
  })
);

// -----------------------------------------------------------------------------
// Text lengths
// -----------------------------------------------------------------------------

const encoder = new TextEncoder();

// The platform's limits count UTF-8 bytes, not characters: accented and non-Latin text reaches them sooner.
const fitsUtf8Bytes =
  (limit: number): P.Predicate<string> =>
  (text) =>
    encoder.encode(text).byteLength <= limit;

/**
 * How long the display name of an object type, a link side or an interface may be: 1000 bytes of UTF-8.
 *
 * **Example** (Measure a display name in bytes)
 *
 * ```ts import.meta.vitest name="Measure a display name in bytes"
 * import * as S from "effect/Schema"
 * import * as Str from "effect/String"
 * import { DisplayNameChecks } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const fits = S.is(S.String.check(DisplayNameChecks))
 * const verdicts = [fits(Str.repeat(1000)("a")), fits(Str.repeat(501)("é")), fits(Str.repeat(1001)("a"))]
 * verdicts // => [true, false, false]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const DisplayNameChecks = S.makeFilterGroup<string>(
  [
    S.makeFilter(
      fitsUtf8Bytes(1000),
      $I.annote("DisplayNameLengthCheck", {
        title: "Display Name Length",
        description: "At most 1000 bytes when encoded as UTF-8.",
        message: "A display name must be at most 1000 UTF-8 bytes long",
        arbitraryConstraint: { maxLength: 333 },
      })
    ),
  ],
  $I.annote("DisplayNameChecks", {
    title: "Display Name",
    description: "How long the display name of an object type, a link side or an interface may be.",
  })
);

/**
 * How long the display name of a property may be: 1500 bytes of UTF-8.
 *
 * **Example** (Allow a property a longer display name)
 *
 * ```ts import.meta.vitest name="Allow a property a longer display name"
 * import * as S from "effect/Schema"
 * import * as Str from "effect/String"
 * import { DisplayNameChecks, PropertyDisplayNameChecks } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const name = Str.repeat(1200)("a")
 * const verdicts = [S.is(S.String.check(DisplayNameChecks))(name), S.is(S.String.check(PropertyDisplayNameChecks))(name)]
 * verdicts // => [false, true]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PropertyDisplayNameChecks = S.makeFilterGroup<string>(
  [
    S.makeFilter(
      fitsUtf8Bytes(1500),
      $I.annote("PropertyDisplayNameLengthCheck", {
        title: "Property Display Name Length",
        description: "At most 1500 bytes when encoded as UTF-8.",
        message: "A property display name must be at most 1500 UTF-8 bytes long",
        arbitraryConstraint: { maxLength: 500 },
      })
    ),
  ],
  $I.annote("PropertyDisplayNameChecks", {
    title: "Property Display Name",
    description: "How long the display name of a property may be.",
  })
);

/**
 * How long the description of an object type, a property, a link side or an interface may be: 10000 bytes of UTF-8.
 *
 * **Example** (Reject an oversized description)
 *
 * ```ts import.meta.vitest name="Reject an oversized description"
 * import * as S from "effect/Schema"
 * import * as Str from "effect/String"
 * import { DescriptionChecks } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const fits = S.is(S.String.check(DescriptionChecks))
 * const verdicts = [fits("A full-time or part-time employee of our firm"), fits(Str.repeat(10001)("a"))]
 * verdicts // => [true, false]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const DescriptionChecks = S.makeFilterGroup<string>(
  [
    S.makeFilter(
      fitsUtf8Bytes(10000),
      $I.annote("DescriptionLengthCheck", {
        title: "Description Length",
        description: "At most 10000 bytes when encoded as UTF-8.",
        message: "A description must be at most 10000 UTF-8 bytes long",
        arbitraryConstraint: { maxLength: 3333 },
      })
    ),
  ],
  $I.annote("DescriptionChecks", {
    title: "Description",
    description: "How long the description of an object type, a property, a link side or an interface may be.",
  })
);

// -----------------------------------------------------------------------------
// A whole object type
// -----------------------------------------------------------------------------

const isAuthoredObjectTypeApiName = S.is(S.String.check(ObjectTypeApiNameChecks));
const isAuthoredPropertyApiName = S.is(S.String.check(PropertyApiNameChecks));
const isAuthoredDisplayName = S.is(S.String.check(DisplayNameChecks));
const isAuthoredPropertyDisplayName = S.is(S.String.check(PropertyDisplayNameChecks));
const isAuthoredDescription = S.is(S.String.check(DescriptionChecks));

const whenPresent = (isValid: P.Predicate<string>): ((text: O.Option<string>) => boolean) =>
  flow(O.map(isValid), O.getOrElse(constTrue));

/**
 * Everything the naming and length rules ask of one object type, as a single group to apply while authoring.
 *
 * **Details**
 *
 * The group checks the object type's API name, the API name of every declared
 * property, both display names and the description, and each property's
 * display name and description. It adds nothing about structure: the key
 * invariants already belong to the object type itself.
 *
 * **Example** (Accept a wire-valid object type the authoring tools would refuse)
 *
 * ```ts import.meta.vitest name="Accept a wire-valid object type the authoring tools would refuse"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectType, ObjectTypeAuthoringChecks } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const wire = {
 *   apiName: "Office",
 *   displayName: "Office",
 *   pluralDisplayName: "Offices",
 *   status: "ACTIVE",
 *   icon: { type: "blueprint", color: "blue", name: "office" },
 *   rid: "ri.ontology.main.object-type.office",
 *   primaryKey: "rid",
 *   titleProperty: "rid",
 *   properties: { rid: { dataType: { type: "string" }, rid: "ri.ontology.main.property.rid" } },
 * }
 * const office = await Effect.runPromise(S.decodeUnknownEffect(ObjectType)(wire))
 * const verdicts = [S.is(ObjectType)(office), S.is(ObjectType.check(ObjectTypeAuthoringChecks))(office)]
 * verdicts // => [true, false]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ObjectTypeAuthoringChecks = S.makeFilterGroup<ObjectType>(
  [
    S.makeFilter(
      ({ apiName }: ObjectType) => isAuthoredObjectTypeApiName(apiName),
      $I.annote("AuthoredObjectTypeApiNameCheck", {
        title: "Authored Object Type API Name",
        description: "An object type whose API name the authoring tools accept.",
        message:
          "The object type API name must start with a letter, use only letters, digits and dots, be at most 100 characters long and not be a reserved word",
      })
    ),
    S.makeFilter(
      ({ properties }: ObjectType) => A.every(R.keys(properties), isAuthoredPropertyApiName),
      $I.annote("AuthoredPropertyApiNamesCheck", {
        title: "Authored Property API Names",
        description: "An object type whose every property has an API name the authoring tools accept.",
        message:
          "Every property API name must start with a letter, use only letters, digits and underscores, be at most 100 characters long and not be a reserved word",
      })
    ),
    S.makeFilter(
      ({ displayName, pluralDisplayName }: ObjectType) =>
        isAuthoredDisplayName(displayName) && isAuthoredDisplayName(pluralDisplayName),
      $I.annote("AuthoredObjectTypeDisplayNamesCheck", {
        title: "Authored Object Type Display Names",
        description: "An object type whose singular and plural display names fit the platform's limit.",
        message: "The display name and the plural display name must each be at most 1000 UTF-8 bytes long",
      })
    ),
    S.makeFilter(
      ({ description }: ObjectType) => whenPresent(isAuthoredDescription)(description),
      $I.annote("AuthoredObjectTypeDescriptionCheck", {
        title: "Authored Object Type Description",
        description: "An object type whose description, when it has one, fits the platform's limit.",
        message: "The description must be at most 10000 UTF-8 bytes long",
      })
    ),
    S.makeFilter(
      ({ properties }: ObjectType) =>
        A.every(
          R.values(properties),
          (definition) =>
            whenPresent(isAuthoredPropertyDisplayName)(definition.displayName) &&
            whenPresent(isAuthoredDescription)(definition.description)
        ),
      $I.annote("AuthoredPropertyTextCheck", {
        title: "Authored Property Text",
        description: "An object type whose every property has a display name and a description within the limits.",
        message:
          "Every property display name must be at most 1500 UTF-8 bytes long and every property description at most 10000",
      })
    ),
  ],
  $I.annote("ObjectTypeAuthoringChecks", {
    title: "Object Type Authoring Rules",
    description: "Everything the naming and length rules ask of one object type.",
  })
);
