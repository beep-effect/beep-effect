/**
 * The envelopes a client exchanges with the platform when it reads objects, and the scope it works in.
 *
 * **Details**
 *
 * Every other concept of this library describes one idea: an object set, an
 * ordering, a property selector, an aggregation, an object. The records here
 * are where those ideas meet on the wire: the body that asks for a page of an
 * object set and the page that answers it, the body that aggregates an object
 * set, and the query parameters that say which ontology, branch, transaction
 * and scenario a request addresses.
 *
 * OSDK builds these bodies inline in `fetchPage` and `aggregate` from eleven
 * `$`-prefixed option keys. Here each body is a schema whose encoded side is
 * the platform's JSON, so the same value can be sent, recorded, compared and
 * generated.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import {
  AccuracyRequirement,
  Aggregation,
  AggregationAccuracy,
  AggregationOrderingChecks,
  GroupBy,
  GroupKey,
  MetricLookup,
} from "../Aggregation/Aggregation.model.ts";
import {
  FoundryBranch,
  ObjectTypeApiName,
  OntologyIdentifier,
  OntologyScenarioRid,
  OntologyTransactionId,
  PropertyApiName,
} from "../Identifier/Identifier.model.ts";
import { ObjectRecord } from "../Object/Object.model.ts";
import { ObjectSet, OrderBy } from "../ObjectSet/ObjectSet.model.ts";
import { Page, PageRequest, TotalCount } from "../Page/Page.model.ts";
import { PropertyByName, PropertyLoadLevel, PropertySelector } from "../Property/Property.model.ts";
import { PropertySecurities } from "../Security/Security.model.ts";

const $I = $ScratchpadId.create("osdk/Client/Client.model");

// -----------------------------------------------------------------------------
// The scope of a client
// -----------------------------------------------------------------------------

/**
 * Where a client's requests land: which ontology, and optionally which branch, transaction and scenario.
 *
 * **Details**
 *
 * OSDK keeps these as loose fields of its `MinimalClient` and copies them into
 * every call. The platform reads the ontology from the route and the other
 * three from the query parameters `branch`, `transactionId` and `scenarioRid`,
 * which is what the encoded side of this record spells. An absent key means
 * the default branch, no open transaction and no scenario.
 *
 * **Example** (Scope requests to a branch)
 *
 * ```ts import.meta.vitest name="Scope requests to a branch"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OntologyScope } from "@beep/scratchpad/osdk/src/Client/index"
 * import { FoundryBranch, OntologyApiName, OntologyTransactionId } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const scope = OntologyScope.make({
 *   ontology: OntologyApiName.make("default-ontology"),
 *   branch: O.some(FoundryBranch.make("ri.branch..branch.1")),
 *   transaction: O.some(OntologyTransactionId.make("txn-42")),
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(OntologyScope)(scope))
 * wire // => { ontology: "default-ontology", branch: "ri.branch..branch.1", transactionId: "txn-42" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyScope extends S.Opaque<OntologyScope, { readonly brand: unique symbol }>()(
  S.Struct({
    ontology: OntologyIdentifier.annotateKey({
      description: "The ontology every request addresses, by API name or resource identifier.",
    }),
    branch: S.OptionFromOptionalKey(FoundryBranch).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Branch to read from and write to; the default branch when absent." })
    ),
    transaction: S.OptionFromOptionalKey(OntologyTransactionId).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Open transaction whose uncommitted edits the requests see and extend." })
    ),
    scenario: S.OptionFromOptionalKey(OntologyScenarioRid).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Scenario whose hypothetical edits the requests see and extend." })
    ),
  }).pipe(
    S.encodeKeys({ transaction: "transactionId", scenario: "scenarioRid" }),
    $I.annoteSchema("OntologyScope", {
      description:
        "Where a client's requests land: which ontology, and optionally which branch, transaction and scenario.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Loading the objects of an object set
// -----------------------------------------------------------------------------

/**
 * Whether references to media come back ready to read.
 *
 * **Details**
 *
 * When signing is requested, every media reference in the response carries a
 * short-lived read token, so the content can be fetched without a second
 * authorisation round trip.
 *
 * **Example** (Ask for signed media references)
 *
 * ```ts import.meta.vitest name="Ask for signed media references"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ReferenceSigningOptions } from "@beep/scratchpad/osdk/src/Client/index"
 *
 * const signing = ReferenceSigningOptions.make({ signMediaReferences: O.some(true) })
 * const wire = await Effect.runPromise(S.encodeEffect(ReferenceSigningOptions)(signing))
 * wire // => { signMediaReferences: true }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReferenceSigningOptions extends S.Opaque<ReferenceSigningOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    signMediaReferences: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether media references carry a read token; they do not when absent." })
    ),
  }).pipe(
    $I.annoteSchema("ReferenceSigningOptions", {
      description: "Whether references to media come back ready to read.",
    })
  )
) {}

// The wire asks the opposite question (`excludeRid`), so the two sides are each other's negation.
const IncludeRid = S.Boolean.pipe(
  S.decodeTo(S.Boolean, SchemaTransformation.transform({ decode: Bool.not, encode: Bool.not }))
);

// What a caller may say about a read besides which objects to read. The typed facade takes exactly
// these, and the load request adds the object set and the flags that change the shape of a row.
// `pageSize` and `pageToken` are the paging arguments every list request shares (`PageRequest`).
const fetchFields = {
  selection: S.Array(PropertySelector).pipe(
    S.withConstructorDefault(Effect.succeed(A.empty<PropertySelector>())),
    S.withDecodingDefaultKey(Effect.succeed(A.empty<PropertySelector.Encoded>())),
    S.annotateKey({ description: "Properties to return; none asks for the platform's default set." })
  ),
  orderBy: S.OptionFromOptionalKey(OrderBy).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "How to order the objects; the platform's own order when absent." })
  ),
  ...PageRequest.fields,
  includeRid: IncludeRid.pipe(
    S.withConstructorDefault(Effect.succeed(false)),
    S.withDecodingDefaultKey(Effect.succeed(false)),
    S.annotateKey({ description: "Whether each object comes back with its resource identifier." })
  ),
  snapshot: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(false)),
    S.withDecodingDefaultKey(Effect.succeed(false)),
    S.annotateKey({ description: "Whether every page of the read sees the same frozen view of the objects." })
  ),
  defaultLoadLevel: S.OptionFromOptionalKey(PropertyLoadLevel).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({
      description: "How much of each composite property to load unless a selector says otherwise.",
    })
  ),
  loadOntologyDefinedDerivedProperties: S.OptionFromOptionalKey(S.Boolean).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({
      description: "Whether derived properties the ontology defines are computed; the platform decides when absent.",
    })
  ),
};

/**
 * What a caller may ask of a read besides which objects to read: selection, order, paging and freshness.
 *
 * **Details**
 *
 * These are OSDK's `$select`, `$orderBy`, `$pageSize`, `$nextPageToken`,
 * `$includeRid`, `$snapshot`, `$EXPERIMENTAL_defaultLoadLevel` and
 * `$UNSTABLE_loadOntologyDefinedDerivedProperties`, as one value with defaults.
 * `$applyModifiers` is not a separate option: a load level is part of a
 * selector (`PropertyAtLoadLevel`), so it travels in `selection`.
 *
 * This record never reaches the wire by itself. It is the options half of a
 * {@link LoadObjectsRequest}, whose fields have the same names.
 *
 * **Example** (Ask for small pages ordered by name)
 *
 * ```ts import.meta.vitest name="Ask for small pages ordered by name"
 * import * as O from "effect/Option"
 * import { FetchOptions } from "@beep/scratchpad/osdk/src/Client/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { OrderByFields, PropertyOrdering } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const options = FetchOptions.make({
 *   pageSize: O.some(50),
 *   orderBy: O.some(
 *     OrderByFields.make({
 *       fields: [PropertyOrdering.make({ property: PropertyApiName.make("fullName"), direction: O.some("asc") })],
 *     })
 *   ),
 * })
 * const facts = [options.pageSize, options.includeRid, options.snapshot, options.selection.length]
 * facts // => [O.some(50), false, false, 0]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FetchOptions extends S.Opaque<FetchOptions, { readonly brand: unique symbol }>()(
  S.Struct(fetchFields).pipe(
    S.toType,
    $I.annoteSchema("FetchOptions", {
      description:
        "What a caller may ask of a read besides which objects to read: selection, order, paging, freshness.",
    })
  )
) {}

// Every field of a load request under its domain name. The request's own schema adds the wire's
// legacy `select` key below.
const LoadFields = S.Struct({
  objectSet: ObjectSet.annotateKey({ description: "Which objects to read." }),
  ...fetchFields,
  loadPropertySecurities: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(false)),
    S.withDecodingDefaultKey(Effect.succeed(false)),
    S.annotateKey({
      description: "Whether each property value comes back wrapped with a pointer into the page's security table.",
    })
  ),
  includeComputeUsage: S.OptionFromOptionalKey(S.Boolean).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Whether the page reports the compute it used; it does not when absent." })
  ),
  referenceSigningOptions: S.OptionFromOptionalKey(ReferenceSigningOptions).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Whether media references come back ready to read; they do not when absent." })
  ),
});

// The wire's first way to select properties: a list of bare names. `selectV2` replaced it, but the
// key is still required, so a request always carries it.
const LegacySelection = S.Array(PropertyApiName).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<PropertyApiName>())),
  S.withDecodingDefaultKey(Effect.succeed(A.empty<string>()))
);

const LoadObjectsBody = S.Struct({ ...LoadFields.fields, select: LegacySelection }).pipe(
  S.encodeKeys({ selection: "selectV2", includeRid: "excludeRid" })
);

/**
 * Body of the request that loads one page of the objects of an object set.
 *
 * **Details**
 *
 * This is the wire's `LoadObjectSetRequestV2`, with three differences that
 * remove ways to say the same thing twice or backwards:
 *
 * - The wire has two selection keys, the legacy `select` (bare names) and
 *   `selectV2` (selectors). Here there is one field, `selection`. Decoding
 *   reads legacy names as by-name selectors, ahead of the entries of
 *   `selectV2`. Encoding always writes `select: []` and the whole selection
 *   under `selectV2`, which is the form OSDK sends.
 * - The wire's `excludeRid` is `includeRid` here, negated in both directions.
 *   An absent `excludeRid` means the platform includes resource identifiers,
 *   so it decodes to `true`. A request built with `make` leaves them out unless
 *   asked, as OSDK does, because the platform answers faster without them.
 * - `includeRid`, `snapshot` and `loadPropertySecurities` are always written,
 *   again as OSDK sends them, so one request has one wire form.
 *
 * **Gotchas**
 *
 * `loadPropertySecurities` changes the shape of every property value in the
 * answer (each is wrapped with an index into the page's security table). A
 * codec that reads plain property values cannot read such a page.
 *
 * **Example** (Encode the request for the first page of every employee)
 *
 * ```ts import.meta.vitest name="Encode the request for the first page of every employee"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LoadObjectsRequest } from "@beep/scratchpad/osdk/src/Client/index"
 * import { ObjectTypeApiName, PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { BaseObjectSet } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 * import { PropertyByName } from "@beep/scratchpad/osdk/src/Property/index"
 *
 * const request = LoadObjectsRequest.make({
 *   objectSet: BaseObjectSet.make({ objectType: ObjectTypeApiName.make("Employee") }),
 *   selection: [PropertyByName.make({ apiName: PropertyApiName.make("fullName") })],
 *   pageSize: O.some(100),
 *   includeRid: true,
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(LoadObjectsRequest)(request))
 * const expected = {
 *   objectSet: { type: "base", objectType: "Employee" },
 *   select: [],
 *   selectV2: [{ type: "property", apiName: "fullName" }],
 *   pageSize: 100,
 *   excludeRid: false,
 *   snapshot: false,
 *   loadPropertySecurities: false,
 * }
 * wire // => expected
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LoadObjectsRequest extends S.Opaque<LoadObjectsRequest, { readonly brand: unique symbol }>()(
  LoadObjectsBody.pipe(
    S.decodeTo(
      S.toType(LoadFields),
      SchemaTransformation.transform<typeof LoadFields.Type, typeof LoadObjectsBody.Type>({
        decode: ({ select, selection, ...rest }) => ({
          ...rest,
          selection: A.appendAll(
            A.map(select, (apiName) => PropertyByName.make({ apiName })),
            selection
          ),
        }),
        encode: (request) => ({ ...request, select: A.empty<PropertyApiName>() }),
      })
    ),
    $I.annoteSchema("LoadObjectsRequest", {
      description: "Body of the request that loads one page of the objects of an object set.",
    })
  )
) {}

/**
 * The concrete object types the platform touched while it evaluated an object set.
 *
 * **Details**
 *
 * The list covers the object types that implement an interface the set names,
 * and those reached by link traversals and derived properties. A listed type
 * may have no object on the page.
 *
 * **Example** (Read the object types behind an interface set)
 *
 * ```ts import.meta.vitest name="Read the object types behind an interface set"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ObjectSetEntities } from "@beep/scratchpad/osdk/src/Client/index"
 *
 * const entities = await Effect.runPromise(
 *   S.decodeUnknownEffect(ObjectSetEntities)({ objectTypeApiNames: ["Employee", "Contractor"] })
 * )
 * entities.objectTypeApiNames // => ["Employee", "Contractor"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObjectSetEntities extends S.Opaque<ObjectSetEntities, { readonly brand: unique symbol }>()(
  S.Struct({
    objectTypeApiNames: S.Array(ObjectTypeApiName).annotateKey({
      description: "Every concrete object type the evaluation of the set referred to.",
    }),
  }).pipe(
    $I.annoteSchema("ObjectSetEntities", {
      description: "The concrete object types the platform touched while it evaluated an object set.",
    })
  )
) {}

const loadObjectsResponseImpl = <const Identifier extends string, Row extends S.Constraint>(
  identifier: Identifier,
  row: Row
) => {
  const schemaIdentifier: string = identifier;
  return S.Struct({
    // `data` and `nextPageToken` are the page every list endpoint answers with. A general page may leave the
    // count out; this endpoint always reports it, so the key is required here.
    ...Page(identifier, row).fields,
    totalCount: TotalCount.annotateKey({ description: "Number of objects in the whole object set." }),
    propertySecurities: S.Array(PropertySecurities).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<PropertySecurities>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<(typeof PropertySecurities)["Encoded"]>())),
      S.annotateKey({ description: "Security table that secured property values of this page point into." })
    ),
    computeUsage: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Compute-seconds the request used, when the request asked for them." })
    ),
    objectSetEntities: S.OptionFromOptionalKey(ObjectSetEntities).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Object types the set's evaluation touched; first page only, absent when unknown." })
    ),
  }).pipe(
    $I.annoteSchema(schemaIdentifier, {
      description: "One page of the objects of an object set, as the platform answers a load request.",
    })
  );
};

/**
 * Builds the schema of the answer to a {@link LoadObjectsRequest}, for whatever codec reads one of its rows.
 *
 * **Details**
 *
 * This is the wire's `LoadObjectSetResponseV2` with its row left open: the
 * shared page shape (`Page(identifier, row)`) with the count made required,
 * plus the security table, the compute usage and the entities of the set. The
 * envelope is the same whatever a row decodes to, so it is stated once and the
 * row codec is its parameter.
 *
 * {@link LoadObjectsResponse} is this factory at the flat wire record, which
 * is what a transport returns. Given the instance codec of a model, the same
 * factory reads a whole answer to typed instances in one step, each row
 * decoded once.
 *
 * `propertySecurities` is the table that secured property values point into;
 * it is empty unless the request asked for securities, and a platform that
 * predates the key may omit it, which decodes to the empty table.
 * `objectSetEntities` arrives on the first page only, and its absence means
 * "unknown", not "none".
 *
 * **Example** (Read a whole answer to typed offices)
 *
 * ```ts import.meta.vitest name="Read a whole answer to typed offices"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LoadObjectsResponseOf } from "@beep/scratchpad/osdk/src/Client/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Office = Model.object({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: { officeId: Model.required(Model.string), capacity: Model.integer },
 *   links: {},
 * })
 * const OfficePage = LoadObjectsResponseOf("OfficePage", Office.Instance)
 * const page = await Effect.runPromise(
 *   S.decodeEffect(OfficePage)({
 *     data: [{ __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 120 }],
 *     totalCount: "1",
 *   })
 * )
 * const facts = [A.map(page.data, (office) => office.properties.capacity), page.totalCount === BigInt(1)]
 * facts // => [[O.some(120)], true]
 * ```
 *
 * **Example** (Name the row codec first)
 *
 * ```ts import.meta.vitest name="Name the row codec first"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LoadObjectsResponseOf } from "@beep/scratchpad/osdk/src/Client/index"
 * import { OntologyObject } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const pageOfObjects = LoadObjectsResponseOf(OntologyObject)
 * const ObjectPage = pageOfObjects("ObjectPage")
 * const page = await Effect.runPromise(
 *   S.decodeEffect(ObjectPage)({ data: [{ __apiName: "Office", __primaryKey: "NYC" }], totalCount: "1" })
 * )
 * const keys = A.map(page.data, (object) => object.locator.primaryKey)
 * keys // => ["NYC"]
 * ```
 *
 * @typeParam Identifier - Identifier the answer's schema is annotated with.
 * @typeParam Row - Schema of one row of the answer.
 * @param identifier - Name that tells this answer's schema apart from the answer at any other row.
 * @param row - Schema that decodes one row.
 * @returns A struct schema of the page fields, the count, the security table, the compute usage and the entities.
 * @category factories
 * @since 0.0.0
 */
export const LoadObjectsResponseOf: {
  <Row extends S.Constraint>(
    row: Row
  ): <const Identifier extends string>(
    identifier: Identifier
  ) => ReturnType<typeof loadObjectsResponseImpl<Identifier, Row>>;
  <const Identifier extends string, Row extends S.Constraint>(
    identifier: Identifier,
    row: Row
  ): ReturnType<typeof loadObjectsResponseImpl<Identifier, Row>>;
} = dual(2, loadObjectsResponseImpl);

/**
 * One page of the objects of an object set as a transport returns it: every row the flat wire record.
 *
 * **Details**
 *
 * This is {@link LoadObjectsResponseOf} at `ObjectRecord`, the answer of the
 * transport's `loadObjects`. The envelope is decoded (the cursor is a
 * `PageToken`, the count a `bigint`) and the rows are not: each is the record
 * the platform sent, checked to be one and otherwise untouched. A transport
 * does not know what a property holds, so it reads nothing into a row. The
 * read facade decodes each row once, with the codec of the set that was read:
 * a model's instance codec, or `OntologyObject` for an untyped set.
 *
 * **Example** (Decode a page and read its cursor)
 *
 * ```ts import.meta.vitest name="Decode a page and read its cursor"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LoadObjectsResponse } from "@beep/scratchpad/osdk/src/Client/index"
 *
 * const page = await Effect.runPromise(
 *   S.decodeEffect(LoadObjectsResponse)({
 *     data: [{ __apiName: "Employee", __primaryKey: 50030, employeeId: 50030, fullName: "John Doe" }],
 *     nextPageToken: "v1.next",
 *     totalCount: "2",
 *     propertySecurities: [],
 *   })
 * )
 * const facts = [
 *   A.map(page.data, (row) => [row.__primaryKey, row.fullName]),
 *   O.getOrNull(page.nextPageToken),
 *   page.totalCount === BigInt(2),
 * ]
 * facts // => [[[50030, "John Doe"]], "v1.next", true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LoadObjectsResponse extends S.Opaque<LoadObjectsResponse, { readonly brand: unique symbol }>()(
  LoadObjectsResponseOf("LoadObjectsResponse", ObjectRecord)
) {}

// -----------------------------------------------------------------------------
// Aggregating an object set
// -----------------------------------------------------------------------------

/**
 * Body of an aggregation over the objects of an object set.
 *
 * **Details**
 *
 * This is the wire's `AggregateObjectSetRequestV2`. It differs from the
 * aggregation over one object type (`AggregateRequest`) only in what it
 * aggregates: an object set in place of an optional filter. The metrics, the
 * groupings and the rules that tie them together are the same, and the same
 * checks apply. The wire key for the metrics is the singular `aggregation`.
 *
 * **Example** (Count employees per team)
 *
 * ```ts import.meta.vitest name="Count employees per team"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { count, exact } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { AggregateObjectSetRequest } from "@beep/scratchpad/osdk/src/Client/index"
 * import { ObjectTypeApiName, PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { BaseObjectSet } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const request = AggregateObjectSetRequest.make({
 *   objectSet: BaseObjectSet.make({ objectType: ObjectTypeApiName.make("Employee") }),
 *   aggregations: [count()],
 *   groupBy: [exact(PropertyApiName.make("team"), {})],
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(AggregateObjectSetRequest)(request))
 * const expected = {
 *   objectSet: { type: "base", objectType: "Employee" },
 *   aggregation: [{ type: "count", name: "count" }],
 *   groupBy: [{ type: "exact", field: "team" }],
 * }
 * wire // => expected
 * ```
 *
 * @invariant A metric orders the result only when there is at most one grouping.
 * @invariant A metric never orders the result when a grouping keeps a null group.
 * @category models
 * @since 0.0.0
 */
export class AggregateObjectSetRequest extends S.Opaque<AggregateObjectSetRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    objectSet: ObjectSet.annotateKey({ description: "Which objects to aggregate." }),
    aggregations: S.Array(Aggregation).annotateKey({ description: "The metrics to compute for each group." }),
    groupBy: S.Array(GroupBy).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<GroupBy>())),
      S.annotateKey({ description: "The groupings, outermost first; none aggregates every object into one row." })
    ),
    accuracy: S.OptionFromOptionalKey(AccuracyRequirement).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether approximate results are acceptable; they are when absent." })
    ),
    includeComputeUsage: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether the answer reports the compute it used; it does not when absent." })
    ),
  })
    .check(AggregationOrderingChecks)
    .pipe(
      S.encodeKeys({ aggregations: "aggregation" }),
      $I.annoteSchema("AggregateObjectSetRequest", {
        description: "Body of an aggregation over the objects of an object set.",
      })
    )
) {}

/**
 * One group of an aggregation, with its metrics regrouped into a lookup by property and metric.
 *
 * **Details**
 *
 * The platform answers with a flat list of named values per group
 * (`AggregationRow`). This is the same group after the names were read back
 * into structure, which is the form a caller wants to consume.
 *
 * **Example** (Describe a group and its count)
 *
 * ```ts import.meta.vitest name="Describe a group and its count"
 * import * as O from "effect/Option"
 * import { GroupKey, MetricLookup } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { AggregatedGroup } from "@beep/scratchpad/osdk/src/Client/index"
 *
 * const group = AggregatedGroup.make({
 *   group: { [GroupKey.make("team")]: "platform" },
 *   metrics: MetricLookup.make({ count: O.some(12) }),
 * })
 * const facts = [group.group, group.metrics.count]
 * facts // => [{ team: "platform" }, O.some(12)]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AggregatedGroup extends S.Opaque<AggregatedGroup, { readonly brand: unique symbol }>()(
  S.Struct({
    group: S.Record(GroupKey, S.Json).annotateKey({
      description: "The value that identifies the group, per grouping of the request.",
    }),
    // Stays bare: `annotateKey` on an opaque class would type the field as its plain record.
    metrics: MetricLookup,
  }).pipe(
    $I.annoteSchema("AggregatedGroup", {
      description: "One group of an aggregation, with its metrics regrouped into a lookup by property and metric.",
    })
  )
) {}

/**
 * What an aggregation found, group by group, and how much to trust it.
 *
 * **Example** (Read the groups of a result)
 *
 * ```ts import.meta.vitest name="Read the groups of a result"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import { GroupKey, MetricLookup } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { AggregatedGroup, AggregationResult } from "@beep/scratchpad/osdk/src/Client/index"
 *
 * const result = AggregationResult.make({
 *   accuracy: "accurate",
 *   groups: [
 *     AggregatedGroup.make({
 *       group: { [GroupKey.make("team")]: "platform" },
 *       metrics: MetricLookup.make({ count: O.some(12) }),
 *     }),
 *   ],
 * })
 * const facts = [result.accuracy, A.map(result.groups, ({ metrics }) => metrics.count)]
 * facts // => ["accurate", [O.some(12)]]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AggregationResult extends S.Opaque<AggregationResult, { readonly brand: unique symbol }>()(
  S.Struct({
    accuracy: AggregationAccuracy.annotateKey({ description: "Whether the groups are exact or an approximation." }),
    excludedItems: S.OptionFromOptionalKey(S.Int.check(S.isGreaterThanOrEqualTo(0))).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "How many objects were left out of the result, when the platform reports it." })
    ),
    groups: S.Array(AggregatedGroup).annotateKey({
      description: "One entry per group; a single entry when the request had no groupings.",
    }),
  }).pipe(
    $I.annoteSchema("AggregationResult", {
      description: "What an aggregation found, group by group, and how much to trust it.",
    })
  )
) {}
