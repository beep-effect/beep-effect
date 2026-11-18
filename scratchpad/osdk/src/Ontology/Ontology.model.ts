/**
 * The ontology as one value: who it is and every type it defines, keyed the way the platform sends them.
 *
 * **Details**
 *
 * OSDK never holds an ontology. Its client fetches one definition at a time
 * through a provider and caches the converted results, so a question that
 * spans types ("which side answers this link", "does anything still name this
 * interface") has no value to ask it of. {@link OntologyDefinition} is that
 * value: the wire's full-metadata record, composed from the definitions the
 * other concepts already model, with nothing converted on the way in.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { ActionType } from "../Action/Action.model.ts";
import { ActionTypeDefinition } from "../Action/Action.rules.ts";
import {
  ActionTypeApiName,
  FoundryBranch,
  FunctionVersion,
  InterfaceTypeApiName,
  LinkTypeApiName,
  ObjectTypeApiName,
  OntologyApiName,
  OntologyRid,
  QueryApiName,
  SharedPropertyTypeApiName,
  ValueTypeApiName,
} from "../Identifier/Identifier.model.ts";
import { InterfaceType } from "../InterfaceType/InterfaceType.model.ts";
import { ObjectTypeDefinition } from "../ObjectType/ObjectType.model.ts";
import { SharedPropertyType } from "../Property/Property.model.ts";
import { QueryType } from "../Query/Query.model.ts";
import { OntologyValueType } from "../ValueType/ValueType.model.ts";

const $I = $ScratchpadId.create("osdk/Ontology/Ontology.model");

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------

/**
 * Who an ontology is: the name clients address it by, its resource identifier and how people know it.
 *
 * **Details**
 *
 * `description` is required here and optional on every other entity; that is
 * the wire's own asymmetry and it is kept.
 *
 * **Example** (Decode the record that names an ontology)
 *
 * ```ts import.meta.vitest name="Decode the record that names an ontology"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OntologyIdentity } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const identity = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyIdentity)({
 *     apiName: "default-ontology",
 *     displayName: "Ontology",
 *     description: "The default ontology",
 *     rid: "ri.ontology.main.ontology.698267cc-6b48-4d98-beff-29beb24e9361",
 *   })
 * )
 * const names = [identity.apiName, identity.displayName]
 * names // => ["default-ontology", "Ontology"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyIdentity extends S.Opaque<OntologyIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    apiName: OntologyApiName.annotateKey({ description: "Name under which clients address the ontology." }),
    displayName: S.String.annotateKey({ description: "Human-readable name." }),
    description: S.String.annotateKey({ description: "What the ontology covers." }),
    rid: OntologyRid.annotateKey({ description: "Resource identifier of the ontology." }),
  }).pipe(
    $I.annoteSchema("OntologyIdentity", {
      description: "Who an ontology is: its API name, its resource identifier and how people know it.",
    })
  )
) {}

/**
 * The ontologies a caller can see, as the platform lists them.
 *
 * **Example** (Read the names out of a listing)
 *
 * ```ts import.meta.vitest name="Read the names out of a listing"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OntologyList } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const listing = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyList)({
 *     data: [
 *       {
 *         apiName: "default-ontology",
 *         displayName: "Ontology",
 *         description: "The default ontology",
 *         rid: "ri.ontology.main.ontology.698267cc-6b48-4d98-beff-29beb24e9361",
 *       },
 *     ],
 *   })
 * )
 * const names = A.map(listing.data, (ontology) => ontology.apiName)
 * names // => ["default-ontology"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyList extends S.Opaque<OntologyList, { readonly brand: unique symbol }>()(
  S.Struct({
    data: S.Array(OntologyIdentity).annotateKey({ description: "The visible ontologies, in the platform's order." }),
  }).pipe(
    $I.annoteSchema("OntologyList", { description: "The ontologies a caller can see, as the platform lists them." })
  )
) {}

/**
 * The branch an ontology definition was read from.
 *
 * **Gotchas**
 *
 * The wire calls the field `rid`, yet its value is whatever identifies the
 * branch: a resource identifier or a branch name. The key is kept as sent.
 *
 * **Example** (Decode the branch of a definition)
 *
 * ```ts import.meta.vitest name="Decode the branch of a definition"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OntologyBranch } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const branch = await Effect.runPromise(S.decodeUnknownEffect(OntologyBranch)({ rid: "ri.branch..branch.1" }))
 * branch.rid // => "ri.branch..branch.1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyBranch extends S.Opaque<OntologyBranch, { readonly brand: unique symbol }>()(
  S.Struct({
    rid: FoundryBranch.annotateKey({ description: "Identifier of the branch: its resource identifier or its name." }),
  }).pipe($I.annoteSchema("OntologyBranch", { description: "The branch an ontology definition was read from." }))
) {}

// -----------------------------------------------------------------------------
// Versioned query names
// -----------------------------------------------------------------------------

/**
 * The name an ontology definition files a query under: an API name, optionally followed by a colon and a version.
 *
 * **Details**
 *
 * This is the wire's key, kept as text. {@link QuerySelectorFromVersionedApiName}
 * reads it into its two parts.
 *
 * @category identifiers
 * @since 0.0.0
 */
export const VersionedQueryApiName = S.NonEmptyString.pipe(
  S.brand("VersionedQueryApiName"),
  $I.annoteSchema("VersionedQueryApiName", {
    description: "The name a query is filed under: an API name, optionally followed by a colon and a version.",
  })
);

/**
 * Runtime type of {@link VersionedQueryApiName}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type VersionedQueryApiName = typeof VersionedQueryApiName.Type;

/**
 * Which query, at which version. No version means the latest one.
 *
 * **Example** (Ask for the latest version by naming none)
 *
 * ```ts import.meta.vitest name="Ask for the latest version by naming none"
 * import * as O from "effect/Option"
 * import { QueryApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { QuerySelector } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const latest = QuerySelector.make({ apiName: QueryApiName.make("addOne") })
 * O.isNone(latest.version) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuerySelector extends S.Opaque<QuerySelector, { readonly brand: unique symbol }>()(
  S.Struct({
    apiName: QueryApiName.annotateKey({ description: "Name under which the query is called." }),
    version: S.OptionFromOptionalKey(FunctionVersion).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The version asked for; none asks for the latest." })
    ),
  }).pipe(
    $I.annoteSchema("QuerySelector", {
      description: "Which query, at which version. No version means the latest one.",
    })
  )
) {}

const isFunctionVersion = S.is(FunctionVersion);

const latestMarker = "latest";

/**
 * Codec between a versioned query name (`addOne`, `addOne:0.0.9`, `group:addOne:latest`) and a {@link QuerySelector}.
 *
 * **Details**
 *
 * The text splits at the LAST colon, because an API name may contain colons
 * and a version never does. What follows that colon must be a version or the
 * word `latest`; a name that contains a colon therefore always carries one of
 * the two, which is the platform's own rule. "Latest" is not a version, so it
 * decodes to no version at all. Writing puts `:latest` back exactly when the
 * API name contains a colon, where leaving it out would make the name's last
 * segment read as a version.
 *
 * **Gotchas**
 *
 * `addOne:latest` decodes like `addOne` and is written back as `addOne`: the
 * suffix is redundant on a name without a colon, and the shorter spelling is
 * the canonical one.
 *
 * **Example** (Split a grouped query name at its last colon)
 *
 * ```ts import.meta.vitest name="Split a grouped query name at its last colon"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { QuerySelectorFromVersionedApiName } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const decode = S.decodeUnknownEffect(QuerySelectorFromVersionedApiName)
 * const pinned = await Effect.runPromise(decode("myGroup:myFunction:1.0.0"))
 * const latest = await Effect.runPromise(decode("myGroup:myFunction:latest"))
 * const parts = [pinned.apiName, O.getOrNull(pinned.version), latest.apiName, O.getOrNull(latest.version)]
 * parts // => ["myGroup:myFunction", "1.0.0", "myGroup:myFunction", null]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const QuerySelectorFromVersionedApiName = S.NonEmptyString.pipe(
  S.decodeTo(
    QuerySelector,
    SchemaTransformation.transformEffect<typeof QuerySelector.Encoded, string>({
      decode: (text, options) =>
        pipe(
          Str.lastIndexOf(":")(text),
          O.match({
            onNone: () => Effect.succeed<typeof QuerySelector.Encoded>({ apiName: text }),
            onSome: (at) => {
              const apiName = Str.slice(0, at)(text);
              const suffix = Str.slice(at + 1)(text);
              if (suffix === latestMarker) {
                return Effect.succeed<typeof QuerySelector.Encoded>({ apiName });
              }
              return isFunctionVersion(suffix)
                ? Effect.succeed<typeof QuerySelector.Encoded>({ apiName, version: suffix })
                : Effect.fail(
                    new SchemaIssue.InvalidValue(
                      {
                        message:
                          'Expected a query name of the form "<apiName>", "<apiName>:<version>" or "<apiName>:latest"',
                      },
                      text,
                      options
                    )
                  );
            },
          })
        ),
      encode: ({ apiName, version }) =>
        Effect.succeed(
          pipe(
            O.fromUndefinedOr(version),
            O.match({
              onNone: () => (Str.includes(":")(apiName) ? `${apiName}:${latestMarker}` : apiName),
              onSome: (pinned) => `${apiName}:${pinned}`,
            })
          )
        ),
    })
  ),
  $I.annoteSchema("QuerySelectorFromVersionedApiName", {
    description: "A query selector written as one name: the API name, then optionally a colon and a version.",
  })
);

/**
 * Runtime type of {@link QuerySelectorFromVersionedApiName}: a {@link QuerySelector}.
 *
 * @category codecs
 * @since 0.0.0
 */
export type QuerySelectorFromVersionedApiName = typeof QuerySelectorFromVersionedApiName.Type;

// -----------------------------------------------------------------------------
// The ontology definition
// -----------------------------------------------------------------------------

/**
 * A whole ontology: its identity and every object, action, query, interface, shared property and value type it defines.
 *
 * **Details**
 *
 * This is the wire's full-metadata record, key for key, with two keys renamed.
 * `identity` is the wire's `ontology`, which inside a value that is itself the
 * ontology would read as a second one. `actionTypeDefinitions` is the wire's
 * `actionTypesFullMetadata`: the action types again, each with its logic rules.
 * The platform fills that record only when the request asked for it.
 *
 * Each record is keyed by API name, except `queryTypes`, whose key may also
 * carry a version ({@link VersionedQueryApiName}).
 *
 * Saved ontology documents leave empty collections out, and documents saved
 * by an older platform lack the records that platform did not know. Every one
 * of the seven records therefore decodes as empty when its key is absent, and
 * every one is written on encode: the canonical form carries all seven keys.
 *
 * **Gotchas**
 *
 * Decoding checks each definition on its own and nothing across definitions:
 * the platform serves partial ontologies (a load request names the types it
 * wants), so a link whose target was not loaded is a fact about the request,
 * not a malformed payload. `validateOntology` reports those facts as data.
 *
 * **Example** (Decode an ontology saved without four of its records and write all seven back)
 *
 * ```ts import.meta.vitest name="Decode an ontology saved without four of its records and write all seven back"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { OntologyDefinition } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const ontology = await Effect.runPromise(
 *   S.decodeUnknownEffect(OntologyDefinition)({
 *     ontology: {
 *       apiName: "default-ontology",
 *       displayName: "Ontology",
 *       description: "The default ontology",
 *       rid: "ri.ontology.main.ontology.698267cc-6b48-4d98-beff-29beb24e9361",
 *     },
 *     objectTypes: {},
 *     actionTypes: {},
 *     queryTypes: {},
 *   })
 * )
 * const wire = await Effect.runPromise(S.encodeEffect(OntologyDefinition)(ontology))
 * const facts = [ontology.identity.apiName, R.size(ontology.actionTypeDefinitions), R.keys(wire).length]
 * facts // => ["default-ontology", 0, 8]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyDefinition extends S.Opaque<OntologyDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    // Who the ontology is. (Bare: annotating the key of a class would type the field as its un-branded record.)
    identity: OntologyIdentity,
    objectTypes: S.Record(ObjectTypeApiName, ObjectTypeDefinition).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<ObjectTypeApiName, ObjectTypeDefinition>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof ObjectTypeDefinition)["Encoded"]>())),
      S.annotateKey({ description: "Every object type, with its link sides and interface implementations." })
    ),
    actionTypes: S.Record(ActionTypeApiName, ActionType).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<ActionTypeApiName, ActionType>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof ActionType)["Encoded"]>())),
      S.annotateKey({ description: "Every action type, with the summary of what it may edit." })
    ),
    actionTypeDefinitions: S.Record(ActionTypeApiName, ActionTypeDefinition).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<ActionTypeApiName, ActionTypeDefinition>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof ActionTypeDefinition)["Encoded"]>())),
      S.annotateKey({
        description: "Every action type with its logic rules; empty unless the request asked for them.",
      })
    ),
    queryTypes: S.Record(VersionedQueryApiName, QueryType).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<VersionedQueryApiName, QueryType>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof QueryType)["Encoded"]>())),
      S.annotateKey({ description: "Every query type, filed under its name and, when pinned, its version." })
    ),
    interfaceTypes: S.Record(InterfaceTypeApiName, InterfaceType).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<InterfaceTypeApiName, InterfaceType>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof InterfaceType)["Encoded"]>())),
      S.annotateKey({ description: "Every interface type." })
    ),
    sharedPropertyTypes: S.Record(SharedPropertyTypeApiName, SharedPropertyType).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<SharedPropertyTypeApiName, SharedPropertyType>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof SharedPropertyType)["Encoded"]>())),
      S.annotateKey({ description: "Every property definition that object and interface types reuse." })
    ),
    branch: S.OptionFromOptionalKey(OntologyBranch).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "The branch the definition was read from, when it was not the default one." })
    ),
    valueTypes: S.Record(ValueTypeApiName, OntologyValueType).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<ValueTypeApiName, OntologyValueType>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, (typeof OntologyValueType)["Encoded"]>())),
      S.annotateKey({ description: "Every value type that properties name to constrain their values." })
    ),
  }).pipe(
    S.encodeKeys({ identity: "ontology", actionTypeDefinitions: "actionTypesFullMetadata" }),
    $I.annoteSchema("OntologyDefinition", {
      description: "A whole ontology: its identity and every type it defines, keyed as the platform sends them.",
    })
  )
) {}

/**
 * Which parts of an ontology to load: the types a caller names, and nothing else.
 *
 * **Details**
 *
 * This is the request that answers with an {@link OntologyDefinition}. Link
 * types are named here although the answer has no link record of its own:
 * they arrive as sides under the object types they start from.
 * `includeActionTypeDefinitions` is the wire's `includeActionTypeFullMetadata`.
 *
 * **Example** (Ask for one object type and one pinned query)
 *
 * ```ts import.meta.vitest name="Ask for one object type and one pinned query"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { OntologySelection, VersionedQueryApiName } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const selection = OntologySelection.make({
 *   objectTypes: [ObjectTypeApiName.make("Employee")],
 *   queryTypes: [VersionedQueryApiName.make("addOne:0.0.9")],
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(OntologySelection)(selection))
 * const sent = [wire.objectTypes, wire.queryTypes, wire.linkTypes, "includeActionTypeFullMetadata" in wire]
 * sent // => [["Employee"], ["addOne:0.0.9"], [], false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologySelection extends S.Opaque<OntologySelection, { readonly brand: unique symbol }>()(
  S.Struct({
    objectTypes: S.Array(ObjectTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<ObjectTypeApiName>())),
      S.annotateKey({ description: "Object types to load." })
    ),
    linkTypes: S.Array(LinkTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<LinkTypeApiName>())),
      S.annotateKey({ description: "Link types to load." })
    ),
    actionTypes: S.Array(ActionTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<ActionTypeApiName>())),
      S.annotateKey({ description: "Action types to load." })
    ),
    queryTypes: S.Array(VersionedQueryApiName).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<VersionedQueryApiName>())),
      S.annotateKey({ description: "Query types to load, each optionally pinned to a version." })
    ),
    interfaceTypes: S.Array(InterfaceTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<InterfaceTypeApiName>())),
      S.annotateKey({ description: "Interface types to load." })
    ),
    includeActionTypeDefinitions: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether to send each action type's logic rules as well, when stated." })
    ),
  }).pipe(
    S.encodeKeys({ includeActionTypeDefinitions: "includeActionTypeFullMetadata" }),
    $I.annoteSchema("OntologySelection", {
      description: "Which parts of an ontology to load: the types a caller names, and nothing else.",
    })
  )
) {}

/**
 * What a read of the whole ontology brings along besides the types themselves.
 *
 * **Details**
 *
 * These are the two switches of the route that returns everything.
 * `includeActionTypeDefinitions` is the wire's `includeActionTypeFullMetadata`
 * and fills `actionTypeDefinitions`; `includeDatasources` adds to every object
 * type the datasources behind it that the caller may see. Both are left to the
 * platform when none. A selective read has no use for this record: an
 * {@link OntologySelection} states its own `includeActionTypeDefinitions`, and
 * the selective route always sends the datasources.
 *
 * **Example** (Ask for the logic rules and leave the datasources to the platform)
 *
 * ```ts import.meta.vitest name="Ask for the logic rules and leave the datasources to the platform"
 * import * as O from "effect/Option"
 * import { OntologyInclusions } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const inclusions = OntologyInclusions.make({ includeActionTypeDefinitions: O.some(true) })
 * const stated = [O.getOrNull(inclusions.includeActionTypeDefinitions), O.isNone(inclusions.includeDatasources)]
 * stated // => [true, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyInclusions extends S.Opaque<OntologyInclusions, { readonly brand: unique symbol }>()(
  S.Struct({
    includeActionTypeDefinitions: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether to send each action type's logic rules as well, when stated." })
    ),
    includeDatasources: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether to send the datasources behind each object type, when stated." })
    ),
  }).pipe(
    $I.annoteSchema("OntologyInclusions", {
      description: "What a read of the whole ontology brings along besides the types themselves.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// API namespaces
// -----------------------------------------------------------------------------

/**
 * A dotted API name taken apart: the namespace it belongs to, when it has one, and its own name inside it.
 *
 * **Example** (Describe a name that has no namespace)
 *
 * ```ts import.meta.vitest name="Describe a name that has no namespace"
 * import * as O from "effect/Option"
 * import { ApiNameParts } from "@beep/scratchpad/osdk/src/Ontology/index"
 *
 * const employee = ApiNameParts.make({ localName: "Employee" })
 * O.isNone(employee.namespace) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiNameParts extends S.Opaque<ApiNameParts, { readonly brand: unique symbol }>()(
  S.Struct({
    namespace: S.Option(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Everything before the last dot, when the name has a dot." })
    ),
    localName: S.String.annotateKey({ description: "Everything after the last dot, or the whole name." }),
  }).pipe(
    $I.annoteSchema("ApiNameParts", {
      description: "A dotted API name taken apart: its namespace, when it has one, and its own name inside it.",
    })
  )
) {}
