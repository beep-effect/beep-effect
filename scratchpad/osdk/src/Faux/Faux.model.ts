/**
 * The data of an in-memory platform: an ontology, the objects it holds and the links between them.
 *
 * **Details**
 *
 * A {@link FauxWorld} is everything the in-memory transport answers from. It is
 * plain data with a wire form, so a world is a JSON fixture: the ontology as
 * the platform sends it, the objects as the flat rows the platform returns,
 * and the links as source, link type and target.
 *
 * Nothing here evaluates anything. The evaluators live in `Faux.behavior.ts`
 * and the transport in `Faux.layer.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { Link } from "../Link/Link.model.ts";
import { ObjectLocator, OntologyObject } from "../Object/Object.model.ts";
import { OntologyDefinition } from "../Ontology/Ontology.model.ts";
import { PageToken } from "../Page/Page.model.ts";

const $I = $ScratchpadId.create("osdk/Faux/Faux.model");

// -----------------------------------------------------------------------------
// The names of the failures
// -----------------------------------------------------------------------------

/**
 * Every `errorName` the in-memory transport fails with.
 *
 * **Details**
 *
 * The names without the `Faux` prefix are the platform's own, used for the
 * same situations. The three `Faux` names have no platform
 * counterpart: `FauxUnsupportedFeature` refuses a request the interpreter does
 * not evaluate (its `feature` parameter says which), `FauxUnregisteredHandler`
 * refuses an action or query nobody registered a handler for, and
 * `FauxInvalidWorld` reports a stored value that does not match its property
 * type.
 *
 * **Example** (Tell a refusal from a missing type)
 *
 * ```ts import.meta.vitest name="Tell a refusal from a missing type"
 * import { FauxErrorName } from "@beep/scratchpad/osdk/src/Faux/index"
 *
 * const isRefusal = FauxErrorName.is.FauxUnsupportedFeature
 * const verdicts = [isRefusal("FauxUnsupportedFeature"), isRefusal("ObjectTypeNotFound")]
 * verdicts // => [true, false]
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const FauxErrorName = LiteralKit([
  "ObjectTypeNotFound",
  "InterfaceTypeNotFound",
  "LinkTypeNotFound",
  "PropertiesNotFound",
  "InvalidPropertyFilterValue",
  "PropertyFiltersNotSupported",
  "PropertyBaseTypeNotSupported",
  "InvalidAggregationRange",
  "InvalidPageToken",
  "FauxUnsupportedFeature",
  "FauxUnregisteredHandler",
  "FauxInvalidWorld",
]).pipe(
  $I.annoteSchema("FauxErrorName", {
    description: "Name of a failure the in-memory transport reports, as it appears in an error's errorName.",
  })
);

/**
 * Runtime type of {@link FauxErrorName}.
 *
 * @category errors
 * @since 0.0.0
 */
export type FauxErrorName = typeof FauxErrorName.Type;

// -----------------------------------------------------------------------------
// The world
// -----------------------------------------------------------------------------

/**
 * An ontology together with the objects it holds and the links between them.
 *
 * **Details**
 *
 * Objects of every type share one list, in insertion order, and each row names
 * its own type. That order is the order every evaluation answers in when the
 * request asks for none. A link is stored once, under the side it was created
 * through; traversal through the opposite side is derived from the ontology.
 *
 * A world does not check its rows against the ontology when it is built. A row
 * whose value does not match its property type surfaces as a
 * `FauxInvalidWorld` failure when a request reads that value.
 *
 * **Example** (Decode a world from a fixture)
 *
 * ```ts import.meta.vitest name="Decode a world from a fixture"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FauxWorld } from "@beep/scratchpad/osdk/src/Faux/index"
 *
 * const world = await Effect.runPromise(
 *   S.decodeUnknownEffect(FauxWorld)({
 *     ontology: {
 *       ontology: { apiName: "demo", displayName: "Demo", description: "", rid: "ri.ontology.main.ontology.demo" },
 *       objectTypes: {},
 *       actionTypes: {},
 *       queryTypes: {},
 *       interfaceTypes: {},
 *       sharedPropertyTypes: {},
 *       valueTypes: {},
 *     },
 *     objects: [{ __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 120 }],
 *   })
 * )
 * const facts = [world.objects.length, world.links.length]
 * facts // => [1, 0]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FauxWorld extends S.Opaque<FauxWorld, { readonly brand: unique symbol }>()(
  S.Struct({
    // Stays bare: `annotateKey` on an opaque class would type the field as its plain record.
    ontology: OntologyDefinition,
    objects: S.Array(OntologyObject).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<OntologyObject>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<(typeof OntologyObject)["Encoded"]>())),
      S.annotateKey({ description: "Every object of every type, in insertion order; each row names its type." })
    ),
    links: S.Array(Link).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<Link>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<(typeof Link)["Encoded"]>())),
      S.annotateKey({
        description: "Every link between two objects, stored once under the side it was created through.",
      })
    ),
  }).pipe(
    $I.annoteSchema("FauxWorld", {
      description: "An in-memory platform: an ontology, the objects it holds and the links between them.",
    })
  )
) {}

const sameLocator = S.toEquivalence(ObjectLocator);

/**
 * A world that defines the given ontology and holds no objects and no links.
 *
 * **Example** (Start a world from an ontology)
 *
 * ```ts import.meta.vitest name="Start a world from an ontology"
 * import { empty } from "@beep/scratchpad/osdk/src/Faux/index"
 * import { OntologyApiName, OntologyRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { OntologyDefinition, OntologyIdentity } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const ontology = OntologyDefinition.make({
 *   identity: OntologyIdentity.make({
 *     apiName: OntologyApiName.make("demo"),
 *     displayName: "Demo",
 *     description: "",
 *     rid: OntologyRid.make("ri.ontology.main.ontology.demo"),
 *   }),
 * })
 * const world = empty(ontology)
 * const sizes = [world.objects.length, world.links.length]
 * sizes // => [0, 0]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const empty = (ontology: OntologyDefinition): FauxWorld => FauxWorld.make({ ontology });

/**
 * The world with one more object, or with the object of the same type and primary key replaced.
 *
 * **Details**
 *
 * A replaced object keeps its place in the order; a new one goes last.
 *
 * **Example** (Add an object and then replace it)
 *
 * ```ts import.meta.vitest name="Add an object and then replace it"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as S from "effect/Schema"
 * import { addObject, empty } from "@beep/scratchpad/osdk/src/Faux/index"
 * import { OntologyApiName, OntologyRid } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { OntologyObject } from "@beep/scratchpad/osdk/src/Object/index"
 * import { OntologyDefinition, OntologyIdentity } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const ontology = OntologyDefinition.make({
 *   identity: OntologyIdentity.make({
 *     apiName: OntologyApiName.make("demo"),
 *     displayName: "Demo",
 *     description: "",
 *     rid: OntologyRid.make("ri.ontology.main.ontology.demo"),
 *   }),
 * })
 * const row = S.decodeUnknownEffect(OntologyObject)
 * const [small, large] = await Effect.runPromise(
 *   Effect.all([
 *     row({ __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 120 }),
 *     row({ __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 300 }),
 *   ])
 * )
 * const world = pipe(empty(ontology), addObject(small), addObject(large))
 * const capacities = A.map(world.objects, (office) => office.properties.capacity)
 * capacities // => [300]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const addObject: {
  (object: OntologyObject): (world: FauxWorld) => FauxWorld;
  (world: FauxWorld, object: OntologyObject): FauxWorld;
} = dual(
  2,
  (world: FauxWorld, object: OntologyObject): FauxWorld =>
    FauxWorld.make({
      ...world,
      objects: A.some(world.objects, (held) => sameLocator(held.locator, object.locator))
        ? A.map(world.objects, (held) => (sameLocator(held.locator, object.locator) ? object : held))
        : A.append(world.objects, object),
    })
);

const sameLink = S.toEquivalence(Link);

/**
 * The world with one more link; adding a link the world already holds changes nothing.
 *
 * **Details**
 *
 * The link is stored under the side it names. A link side that the ontology
 * pairs with a reverse side is traversable through both.
 *
 * **Example** (Link an employee to an office)
 *
 * ```ts import.meta.vitest name="Link an employee to an office"
 * import { pipe } from "effect/Function"
 * import { addLink, empty } from "@beep/scratchpad/osdk/src/Faux/index"
 * import {
 *   LinkTypeApiName,
 *   ObjectTypeApiName,
 *   OntologyApiName,
 *   OntologyRid,
 * } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { Link } from "@beep/scratchpad/osdk/src/Link/index"
 * import { ObjectLocator } from "@beep/scratchpad/osdk/src/Object/index"
 * import { OntologyDefinition, OntologyIdentity } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const ontology = OntologyDefinition.make({
 *   identity: OntologyIdentity.make({
 *     apiName: OntologyApiName.make("demo"),
 *     displayName: "Demo",
 *     description: "",
 *     rid: OntologyRid.make("ri.ontology.main.ontology.demo"),
 *   }),
 * })
 * const worksAt = Link.make({
 *   source: ObjectLocator.make({ objectType: ObjectTypeApiName.make("Employee"), primaryKey: 1 }),
 *   linkType: LinkTypeApiName.make("office"),
 *   target: ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "NYC" }),
 * })
 * const world = pipe(empty(ontology), addLink(worksAt), addLink(worksAt))
 * world.links.length // => 1
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const addLink: {
  (link: Link): (world: FauxWorld) => FauxWorld;
  (world: FauxWorld, link: Link): FauxWorld;
} = dual(
  2,
  (world: FauxWorld, link: Link): FauxWorld =>
    A.containsWith(sameLink)(world.links, link)
      ? world
      : FauxWorld.make({ ...world, links: A.append(world.links, link) })
);

// -----------------------------------------------------------------------------
// Page tokens
// -----------------------------------------------------------------------------

const offsetPrefix = "faux-offset-";

const PageOffset = S.Int.check(S.isGreaterThanOrEqualTo(0));

/**
 * The page token of the in-memory transport, read as the number of objects the pages before it held.
 *
 * **Details**
 *
 * Callers treat a page token as opaque, and so does the client. The in-memory
 * transport issues `faux-offset-<n>` and reads it back with this codec; any
 * other text is rejected.
 *
 * **Example** (Read the offset out of a page token)
 *
 * ```ts import.meta.vitest name="Read the offset out of a page token"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OffsetFromPageToken } from "@beep/scratchpad/osdk/src/Faux/index"
 *
 * const offset = await Effect.runPromise(S.decodeUnknownEffect(OffsetFromPageToken)("faux-offset-40"))
 * offset // => 40
 * const token = await Effect.runPromise(S.encodeEffect(OffsetFromPageToken)(60))
 * token // => "faux-offset-60"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const OffsetFromPageToken = S.toType(PageToken).pipe(
  S.decodeTo(
    PageOffset,
    SchemaTransformation.transformEffect({
      decode: (token, options) =>
        pipe(
          O.liftPredicate(token, Str.startsWith(offsetPrefix)),
          O.map(Str.slice(Str.length(offsetPrefix))),
          O.filter((digits) => O.isSome(Str.match(/^\d+$/)(digits))),
          O.flatMap(N.parse),
          Effect.fromOption(
            () =>
              new SchemaIssue.InvalidValue(
                { message: `Expected a page token of the form "${offsetPrefix}<count>"` },
                token,
                options
              )
          )
        ),
      encode: (offset) => Effect.succeed(PageToken.make(`${offsetPrefix}${offset}`)),
    })
  ),
  $I.annoteSchema("OffsetFromPageToken", {
    description: "A page token of the in-memory transport, parsed into the count of objects already returned.",
  })
);

/**
 * Runtime type of {@link OffsetFromPageToken}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type OffsetFromPageToken = typeof OffsetFromPageToken.Type;
