/**
 * Conformance of a typed model to the object type the platform actually serves.
 *
 * **Details**
 *
 * A model is written by hand and is rid-free: it states the names, tags and
 * links code relies on. The served definition is the truth. OSDK closes the
 * gap by generating code from the ontology and re-generating on change; here
 * the gap is a value: {@link conformance} lists every way a model disagrees
 * with a served definition, so a client can refuse to start, log, or carry on
 * with what still matches. Each declared spec is first read back as the
 * property type it denotes (`Model.typeOf`), so the comparison is one of two
 * property types and never walks a spec.
 *
 * Only disagreements that can break decoding or a request are findings.
 * Properties, struct fields and links the server has and the model does not
 * mention are fine: decoding ignores them.
 *
 * Presence is not compared, because a model has no presence to get wrong. The
 * only spec a model may mark required is its primary key, which the platform
 * guarantees; every other property and every struct field is optional by
 * construction (the compiler rejects a model that says otherwise), whatever
 * nullability the served definition declares.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { PropertyTypeKind } from "../DataType/DataType.values.ts";
import {
  LinkTypeApiName,
  ObjectTypeApiName,
  PropertyApiName,
  StructFieldApiName,
} from "../Identifier/Identifier.model.ts";
import { LinkCardinality } from "../LinkType/LinkType.model.ts";
import { PropertyType } from "../Property/Property.model.ts";
import { typeOf } from "./Model.spec.ts";
import type { ObjectTypeDefinition } from "../ObjectType/ObjectType.model.ts";
import type { LinkSpec } from "./Model.object.ts";
import type { AnyPropertySpec } from "./Model.spec.ts";

const $I = $ScratchpadId.create("osdk/Model/Model.policy");

// -----------------------------------------------------------------------------
// Where in a property type a finding points
// -----------------------------------------------------------------------------

const TypePathStepKind = LiteralKit(["element", "field"]);

/**
 * A step from an array type to the type of its elements.
 *
 * @category models
 * @since 0.0.0
 */
export class ElementStep extends S.Opaque<ElementStep, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("element") }).pipe(
    $I.annoteSchema("ElementStep", { description: "A step from an array type to the type of its elements." })
  )
) {}

/**
 * A step from a struct type to the type of one of its fields.
 *
 * @category models
 * @since 0.0.0
 */
export class FieldStep extends S.Opaque<FieldStep, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("field"),
    name: StructFieldApiName.annotateKey({ description: "Name of the field stepped into." }),
  }).pipe($I.annoteSchema("FieldStep", { description: "A step from a struct type to the type of one of its fields." }))
) {}

/**
 * One step into a nested property type: into an array's elements, or into a struct's field.
 *
 * **Details**
 *
 * A finding about a nested type carries a list of steps from the property's
 * own type down to the place that disagrees. The empty list is the property's
 * type itself.
 *
 * **Example** (Render a path into a nested type)
 *
 * ```ts import.meta.vitest name="Render a path into a nested type"
 * import * as A from "effect/Array"
 * import { StructFieldApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const render = Model.TypePathStep.match({ element: () => "[]", field: ({ name }) => `.${name}` })
 * const path = [
 *   Model.TypePathStep.cases.element.make({}),
 *   Model.TypePathStep.cases.field.make({ name: StructFieldApiName.make("city") }),
 * ]
 * A.join(A.map(path, render), "") // => "[].city"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TypePathStep = TypePathStepKind.mapMembers(() => Tuple.make(ElementStep, FieldStep)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("TypePathStep", {
    description: "One step into a nested property type: into an array's elements, or into a struct's field.",
  })
);

/**
 * Runtime type of {@link TypePathStep}.
 *
 * @category models
 * @since 0.0.0
 */
export type TypePathStep = typeof TypePathStep.Type;

const propertyField = PropertyApiName.annotateKey({ description: "The property the finding is about." });
const pathField = S.Array(TypePathStep).annotateKey({
  description: "Steps from the property's own type down to the place that disagrees; empty for the type itself.",
});
const linkField = LinkTypeApiName.annotateKey({ description: "The link the finding is about." });

// -----------------------------------------------------------------------------
// Findings
// -----------------------------------------------------------------------------

const ConformanceFindingKind = LiteralKit([
  "objectTypeMismatch",
  "primaryKeyMismatch",
  "missingProperty",
  "tagMismatch",
  "missingStructField",
  "vectorDimensionMismatch",
  "missingLink",
  "cardinalityMismatch",
  "targetMismatch",
]);

/**
 * The served definition is of another object type than the model names.
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectTypeMismatch extends S.Opaque<ObjectTypeMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("objectTypeMismatch"),
    declared: ObjectTypeApiName.annotateKey({ description: "API name the model declares." }),
    served: ObjectTypeApiName.annotateKey({ description: "API name of the served object type." }),
  }).pipe(
    $I.annoteSchema("ObjectTypeMismatch", {
      description: "The served definition is of another object type than the model names.",
    })
  )
) {}

/**
 * The model and the served object type disagree on which property is the primary key.
 *
 * @category models
 * @since 0.0.0
 */
export class PrimaryKeyMismatch extends S.Opaque<PrimaryKeyMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("primaryKeyMismatch"),
    declared: PropertyApiName.annotateKey({ description: "Property the model treats as the primary key." }),
    served: PropertyApiName.annotateKey({ description: "Property the served object type uses as its primary key." }),
  }).pipe(
    $I.annoteSchema("PrimaryKeyMismatch", {
      description: "The model and the served object type disagree on which property is the primary key.",
    })
  )
) {}

/**
 * The model declares a property the served object type does not have.
 *
 * @category models
 * @since 0.0.0
 */
export class MissingProperty extends S.Opaque<MissingProperty, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("missingProperty"),
    property: propertyField,
  }).pipe(
    $I.annoteSchema("MissingProperty", {
      description: "The model declares a property the served object type does not have.",
    })
  )
) {}

/**
 * A property, an array element or a struct field has another type tag on the server than in the model.
 *
 * @category models
 * @since 0.0.0
 */
export class TagMismatch extends S.Opaque<TagMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("tagMismatch"),
    property: propertyField,
    path: pathField,
    declared: PropertyTypeKind.annotateKey({ description: "Type tag the model declares at this place." }),
    served: PropertyTypeKind.annotateKey({ description: "Type tag the server has at this place." }),
  }).pipe(
    $I.annoteSchema("TagMismatch", {
      description:
        "A property, an array element or a struct field has another type tag on the server than in the model.",
    })
  )
) {}

/**
 * The model declares a struct field the served struct type does not have.
 *
 * @category models
 * @since 0.0.0
 */
export class MissingStructField extends S.Opaque<MissingStructField, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("missingStructField"),
    property: propertyField,
    path: pathField,
    field: StructFieldApiName.annotateKey({ description: "Field the model declares and the server lacks." }),
  }).pipe(
    $I.annoteSchema("MissingStructField", {
      description: "The model declares a struct field the served struct type does not have.",
    })
  )
) {}

/**
 * The model declares a vector dimension other than the one the server stores, so its codec rejects the stored vectors.
 *
 * @category models
 * @since 0.0.0
 */
export class VectorDimensionMismatch extends S.Opaque<VectorDimensionMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("vectorDimensionMismatch"),
    property: propertyField,
    path: pathField,
    served: S.Int.annotateKey({ description: "Number of components the server stores per vector." }),
  }).pipe(
    $I.annoteSchema("VectorDimensionMismatch", {
      description: "The model declares a vector dimension other than the one the server stores.",
    })
  )
) {}

/**
 * The model declares a link the served object type does not have.
 *
 * @category models
 * @since 0.0.0
 */
export class MissingLink extends S.Opaque<MissingLink, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("missingLink"),
    link: linkField,
  }).pipe(
    $I.annoteSchema("MissingLink", { description: "The model declares a link the served object type does not have." })
  )
) {}

/**
 * A link reaches another number of objects on the server than the model declares.
 *
 * @category models
 * @since 0.0.0
 */
export class CardinalityMismatch extends S.Opaque<CardinalityMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("cardinalityMismatch"),
    link: linkField,
    declared: LinkCardinality.pipe(S.toType).annotateKey({ description: "Cardinality the model declares." }),
    served: LinkCardinality.pipe(S.toType).annotateKey({ description: "Cardinality of the served link side." }),
  }).pipe(
    $I.annoteSchema("CardinalityMismatch", {
      description: "A link reaches another number of objects on the server than the model declares.",
    })
  )
) {}

/**
 * A link leads to another object type on the server than the model declares.
 *
 * @category models
 * @since 0.0.0
 */
export class TargetMismatch extends S.Opaque<TargetMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("targetMismatch"),
    link: linkField,
    declared: ObjectTypeApiName.annotateKey({ description: "Object type the model says the link leads to." }),
    served: ObjectTypeApiName.annotateKey({ description: "Object type the served link side leads to." }),
  }).pipe(
    $I.annoteSchema("TargetMismatch", {
      description: "A link leads to another object type on the server than the model declares.",
    })
  )
) {}

/**
 * One way a model disagrees with the object type the platform serves.
 *
 * **Details**
 *
 * `tagMismatch` covers a property's own type and, through its `path`, the
 * element type of an array and the type of a struct field at any depth.
 *
 * **Example** (Describe a finding with one exhaustive match)
 *
 * ```ts import.meta.vitest name="Describe a finding with one exhaustive match"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const describe = Model.ConformanceFinding.match({
 *   objectTypeMismatch: ({ served }) => `serves ${served}`,
 *   primaryKeyMismatch: ({ served }) => `key is ${served}`,
 *   missingProperty: ({ property }) => `no property ${property}`,
 *   tagMismatch: ({ property, declared, served }) => `${property} is ${served}, not ${declared}`,
 *   missingStructField: ({ property, field }) => `${property} has no field ${field}`,
 *   vectorDimensionMismatch: ({ property, served }) => `${property} has ${served} components`,
 *   missingLink: ({ link }) => `no link ${link}`,
 *   cardinalityMismatch: ({ link, served }) => `${link} reaches ${served}`,
 *   targetMismatch: ({ link, served }) => `${link} leads to ${served}`,
 * })
 * const finding = Model.ConformanceFinding.cases.tagMismatch.make({
 *   property: PropertyApiName.make("age"),
 *   path: [],
 *   declared: "integer",
 *   served: "string",
 * })
 * describe(finding) // => "age is string, not integer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ConformanceFinding = ConformanceFindingKind.mapMembers(() =>
  Tuple.make(
    ObjectTypeMismatch,
    PrimaryKeyMismatch,
    MissingProperty,
    TagMismatch,
    MissingStructField,
    VectorDimensionMismatch,
    MissingLink,
    CardinalityMismatch,
    TargetMismatch
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ConformanceFinding", {
    description: "One way a model disagrees with the object type the platform serves.",
  })
);

/**
 * Runtime type of {@link ConformanceFinding}.
 *
 * @category models
 * @since 0.0.0
 */
export type ConformanceFinding = typeof ConformanceFinding.Type;

// -----------------------------------------------------------------------------
// The comparison
// -----------------------------------------------------------------------------

type Findings = ReadonlyArray<ConformanceFinding>;

const none: Findings = A.empty();

// The finding is built only when the two sides differ, so a name is branded only when it is reported.
const unless = (agree: boolean, finding: () => ConformanceFinding): Findings => (agree ? none : A.of(finding()));

// Compares the type a spec denotes with the served type at the same place. An array is compared through
// its element, a struct through each declared field, a vector by its dimension; any other pair agrees
// exactly when the two tags do.
const compareType = (
  property: PropertyApiName,
  path: ReadonlyArray<TypePathStep>,
  declared: PropertyType,
  served: PropertyType
): Findings => {
  const mismatch = (): Findings =>
    A.of(TagMismatch.make({ property, path, declared: declared.type, served: served.type }));
  return PropertyType.matchOrElse(
    declared,
    {
      array: ({ elementType }) =>
        PropertyType.matchOrElse(
          served,
          {
            array: (servedArray) =>
              compareType(property, A.append(path, ElementStep.make({})), elementType, servedArray.elementType),
          },
          mismatch
        ),
      struct: ({ fields }) =>
        PropertyType.matchOrElse(
          served,
          {
            struct: (servedStruct) =>
              A.flatMap(fields, (field) =>
                pipe(
                  A.findFirst(servedStruct.fields, (candidate) => candidate.apiName === field.apiName),
                  O.match({
                    onNone: (): Findings => A.of(MissingStructField.make({ property, path, field: field.apiName })),
                    onSome: (servedField) =>
                      compareType(
                        property,
                        A.append(path, FieldStep.make({ name: servedField.apiName })),
                        field.dataType,
                        servedField.dataType
                      ),
                  })
                )
              ),
          },
          mismatch
        ),
      vector: ({ dimension }) =>
        PropertyType.matchOrElse(
          served,
          {
            vector: (servedVector) =>
              unless(dimension === servedVector.dimension, () =>
                VectorDimensionMismatch.make({ property, path, served: servedVector.dimension })
              ),
          },
          mismatch
        ),
    },
    () => (declared.type === served.type ? none : mismatch())
  );
};

// What the comparison reads of an object model, whatever its codecs are.
interface DeclaredObject {
  readonly apiName: string;
  readonly primaryKey: string;
  readonly properties: Readonly<Record<string, AnyPropertySpec>>;
  readonly links: Readonly<Record<string, LinkSpec>>;
}

/**
 * Every way a model disagrees with a served object type definition; empty when the model conforms.
 *
 * **Details**
 *
 * The comparison covers what decoding and requests rely on:
 *
 * - the object type's API name and which property is its primary key;
 * - each declared property: that it exists and has the same type tag, looking
 *   through arrays to their element and through structs to each declared
 *   field, and that a declared vector has the served dimension;
 * - each declared link: that it exists, with the same cardinality and target.
 *
 * An empty result means every instance the server sends for this object type
 * decodes with the model, and every property and link the model names can be
 * used in a request.
 *
 * **Example** (Catch a property whose type changed on the server)
 *
 * ```ts import.meta.vitest name="Catch a property whose type changed on the server"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 * import { ObjectTypeDefinition } from "@beep/scratchpad/osdk/src/ObjectType/index"
 *
 * const Employee = Model.object({
 *   apiName: "Employee",
 *   primaryKey: "employeeId",
 *   properties: { employeeId: Model.required(Model.integer), age: Model.integer, nickname: Model.string },
 *   links: { lead: Model.one("Employee") },
 * })
 * const served = await Effect.runPromise(
 *   S.decodeUnknownEffect(ObjectTypeDefinition)({
 *     objectType: {
 *       apiName: "Employee",
 *       displayName: "Employee",
 *       pluralDisplayName: "Employees",
 *       status: "ACTIVE",
 *       icon: { type: "blueprint", color: "blue", name: "person" },
 *       rid: "ri.ontology.main.object-type.employee",
 *       primaryKey: "employeeId",
 *       titleProperty: "employeeId",
 *       properties: {
 *         employeeId: { dataType: { type: "integer" }, rid: "ri.ontology.main.property.employee-id" },
 *         age: { dataType: { type: "string" }, rid: "ri.ontology.main.property.age" },
 *       },
 *     },
 *     linkTypes: [],
 *     implementsInterfaces: [],
 *     implementsInterfaces2: {},
 *     sharedPropertyTypeMapping: {},
 *   })
 * )
 * const findings = A.map(Model.conformance(Employee, served), (finding) => finding.type)
 * findings // => ["tagMismatch", "missingProperty", "missingLink"]
 * ```
 *
 * @throws When the model declares a struct field with the empty name, or an empty property, link or object type name
 *   that has to be reported.
 * @category policies
 * @since 0.0.0
 */
export const conformance: {
  (definition: ObjectTypeDefinition): (model: DeclaredObject) => ReadonlyArray<ConformanceFinding>;
  (model: DeclaredObject, definition: ObjectTypeDefinition): ReadonlyArray<ConformanceFinding>;
} = dual(
  2,
  (model: DeclaredObject, definition: ObjectTypeDefinition): ReadonlyArray<ConformanceFinding> => {
    const { objectType } = definition;
    return A.flatten([
      unless(objectType.apiName === model.apiName, () =>
        ObjectTypeMismatch.make({ declared: ObjectTypeApiName.make(model.apiName), served: objectType.apiName })
      ),
      unless(objectType.primaryKey === model.primaryKey, () =>
        PrimaryKeyMismatch.make({ declared: PropertyApiName.make(model.primaryKey), served: objectType.primaryKey })
      ),
      A.flatMap(R.toEntries(model.properties), ([name, spec]) =>
        pipe(
          R.findFirst(objectType.properties, (_, key) => key === name),
          O.match({
            onNone: (): Findings => A.of(MissingProperty.make({ property: PropertyApiName.make(name) })),
            onSome: ([property, served]) => compareType(property, A.empty(), typeOf(spec), served.dataType),
          })
        )
      ),
      A.flatMap(R.toEntries(model.links), ([name, spec]) =>
        pipe(
          A.findFirst(definition.linkTypes, (side) => side.apiName === name),
          O.match({
            onNone: (): Findings => A.of(MissingLink.make({ link: LinkTypeApiName.make(name) })),
            onSome: (side) =>
              A.appendAll(
                unless(side.cardinality === spec.cardinality, () =>
                  CardinalityMismatch.make({ link: side.apiName, declared: spec.cardinality, served: side.cardinality })
                ),
                unless(side.targetObjectType === spec.target, () =>
                  TargetMismatch.make({
                    link: side.apiName,
                    declared: ObjectTypeApiName.make(spec.target),
                    served: side.targetObjectType,
                  })
                )
              ),
          })
        )
      ),
    ]);
  }
);
