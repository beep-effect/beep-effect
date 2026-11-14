/**
 * The read facade: reads that take an object set paired with the codec of its rows and return decoded objects.
 *
 * **Details**
 *
 * The transport answers a load request with rows as the platform sent them,
 * because the wire does not say what a property holds. A codec does. The
 * functions here put the two together: they send the request through
 * `OntologyTransport`, decode every returned row once with the codec the set
 * carries, and report anything that does not fit as a `DecodeError` naming the
 * row, never as a defect.
 *
 * The instance reads ({@link fetchPage}, {@link stream}, {@link fetchOne})
 * take the set whole: the pair of an object set and the model its rows decode
 * with. A typed set, as `Model.all` and the set combinators build it, carries
 * the instance codec of its model. {@link untyped} pairs a plain object set
 * with `OntologyObject`, the codec that needs no ontology. The reads have one
 * path for both, and never take the object set and the codec separately, so a
 * read cannot name one model and load the objects of another.
 * {@link count} and {@link aggregate} decode no row and name properties by
 * plain API name, so no codec takes part: they take the plain object set,
 * `set.objectSet` of a typed set.
 *
 * OSDK's counterpart is the `ObjectSet` class with `fetchPage`, `fetchOne`,
 * `asyncIter` and `aggregate` methods bound to a client. Here they are plain
 * functions that need the transport in their environment, so the same call
 * runs against the platform or against an in-memory ontology.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Tuple from "effect/Tuple";
import { count as countObjects, regroupMetrics, ungroupedRow } from "../Aggregation/Aggregation.behavior.ts";
import { ObjectTypeApiName } from "../Identifier/Identifier.model.ts";
import { ObjectLocator, OntologyObject } from "../Object/Object.model.ts";
import { DecodeError, MultipleObjectsFound, ObjectNotFound } from "./Client.errors.ts";
import {
  AggregatedGroup,
  AggregateObjectSetRequest,
  AggregationResult,
  FetchOptions,
  LoadObjectsRequest,
} from "./Client.model.ts";
import { OntologyTransport } from "./Client.service.ts";
import type { Aggregation, GroupBy } from "../Aggregation/Aggregation.model.ts";
import type { ObjectRecord } from "../Object/Object.model.ts";
import type { ObjectSet, OrderBy } from "../ObjectSet/ObjectSet.model.ts";

/**
 * What the facade needs of a model: the codec of one row and, when the model is of one object type, its name.
 *
 * **Details**
 *
 * A model built with `Model.object` satisfies this, and so does a model
 * narrowed to some of its properties. `Instance` reads the platform's flat
 * object record, `ObjectRecord`, which is what its encoded side says, and it
 * needs no service. `apiName` is the object type the model describes; the
 * model of an untyped read ({@link untyped}) describes none and leaves it out.
 *
 * @typeParam A - What one row decodes to.
 * @category models
 * @since 0.0.0
 */
export interface InstanceModel<A = unknown> {
  /**
   * API name of the object type the model describes; absent for the model of an untyped read.
   */
  readonly apiName?: string;
  /**
   * Codec of one row: from the flat wire record to what the model makes of it.
   */
  readonly Instance: S.ConstraintCodec<A, ObjectRecord>;
}

/**
 * What the facade needs of a set to read: which objects, and the model their rows decode with.
 *
 * **Details**
 *
 * A set built with `Model.all` and its combinators satisfies this, so the
 * facade does not depend on the typed layer's code, and {@link untyped}
 * builds one from a plain object set. The two travel together on purpose: the
 * codec that decodes the rows is the one the set was built with, and a read
 * has no way to be given another one.
 *
 * A set ordered with `Model.orderBy` also carries `orderBy`, the sort keys the
 * compiler checked against the set's model. A read of such a set sends that
 * ordering, in place of `options.orderBy`; a set without one is read in the
 * order the options ask for.
 *
 * @typeParam A - What one row of the set decodes to.
 * @category models
 * @since 0.0.0
 */
export interface InstanceSet<A = unknown> {
  /**
   * The model the rows of the set decode with.
   */
  readonly model: InstanceModel<A>;
  /**
   * Which objects to read: the plain value a request carries.
   */
  readonly objectSet: ObjectSet;
  /**
   * The ordering a read of the set sends, when the set carries one.
   */
  readonly orderBy?: OrderBy;
}

// The model of a read that knows no object type: every row is an `OntologyObject`.
const Untyped: InstanceModel<OntologyObject> = { Instance: OntologyObject };

/**
 * Pairs a plain object set with the codec that needs no ontology, so the same reads return `OntologyObject`s.
 *
 * **Details**
 *
 * The result is a set the instance reads take, like a typed one. Its rows
 * decode with `OntologyObject`: identity apart from properties, property
 * values as JSON. So {@link fetchPage}, {@link stream} and {@link fetchOne}
 * have one path and two codecs, and reading without a model is a choice of
 * codec, not a second set of functions.
 *
 * An untyped set names no object type. A `fetchOne` of it that finds none or
 * several fails with an error whose `objectType` is none.
 *
 * **Example** (Read a page of offices with no model)
 *
 * ```ts import.meta.vitest name="Read a page of offices with no model"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import { pipe } from "effect/Function"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 * import {
 *   FetchOptions,
 *   fetchPage,
 *   LoadObjectsResponse,
 *   OntologyTransport,
 *   untyped,
 * } from "@beep/scratchpad/osdk/src/Client/index"
 * import { objectType } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const Canned = Layer.mock(OntologyTransport, {
 *   loadObjects: () =>
 *     Effect.orDie(
 *       S.decodeEffect(LoadObjectsResponse)({
 *         data: [{ __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 120 }],
 *         totalCount: "1",
 *       })
 *     ),
 * })
 * const page = await Effect.runPromise(
 *   Effect.scoped(
 *     Effect.flatMap(Layer.build(Canned), (context) =>
 *       Effect.provide(pipe(objectType("Office"), untyped, fetchPage(FetchOptions.make({}))), context)
 *     )
 *   )
 * )
 * const facts = A.map(page.data, (office) => [office.locator.primaryKey, office.properties])
 * facts // => [["NYC", { officeId: "NYC", capacity: 120 }]]
 * ```
 *
 * @param objectSet - Which objects to read.
 * @category constructors
 * @since 0.0.0
 */
export const untyped = (objectSet: ObjectSet): InstanceSet<OntologyObject> => ({ model: Untyped, objectSet });

// -----------------------------------------------------------------------------
// Pages
// -----------------------------------------------------------------------------

const locate = S.decodeOption(ObjectLocator);

// Which object a row is, as its own two identity keys say. A row whose `__apiName` is empty names none.
const locatorOf = (row: ObjectRecord): O.Option<ObjectLocator> =>
  locate({ objectType: row.__apiName, primaryKey: row.__primaryKey });

// A row reaches here as the record the platform sent and is decoded once, with the codec of the set's model.
// A row that does not fit leaves as a `DecodeError` that names it.
const decodeRows = Effect.fnUntraced(function* <A>(model: InstanceModel<A>, rows: ReadonlyArray<ObjectRecord>) {
  const decodeRow = S.decodeEffect(model.Instance);
  return yield* Effect.forEach(rows, (row, index) =>
    Effect.mapError(decodeRow(row), (cause) =>
      DecodeError.make({ message: cause.message, cause, index: O.some(index), locator: locatorOf(row) })
    )
  );
});

// The ordering a read sends: the one the set carries, which the typed layer checked against the set's
// model, and otherwise the one the options ask for.
const orderingOf = (set: InstanceSet, options: FetchOptions): O.Option<OrderBy> =>
  O.orElse(O.fromUndefinedOr(set.orderBy), () => options.orderBy);

const fetchPageImpl = Effect.fn("Client.fetchPage")(function* <A>(set: InstanceSet<A>, options: FetchOptions) {
  const transport = yield* OntologyTransport;
  const response = yield* transport.loadObjects(
    LoadObjectsRequest.make({ ...options, orderBy: orderingOf(set, options), objectSet: set.objectSet })
  );
  const data = yield* decodeRows(set.model, response.data);
  return { data, nextPageToken: response.nextPageToken, totalCount: O.some(response.totalCount) };
});

/**
 * Loads one page of a set and decodes every row once, with the codec of the set's model.
 *
 * **Details**
 *
 * The result has the shape of a `Page`: `data` holds what the rows decode to,
 * in the platform's order, `nextPageToken` is present when more pages exist,
 * and `totalCount` is the size of the whole object set. Pass the token back in
 * `options.pageToken` to read the next page, or use {@link stream}. A typed
 * set yields the instances of its model; a set built with {@link untyped}
 * yields `OntologyObject`s.
 *
 * The set is taken whole, so the model that decodes the page is the model the
 * set was built from; data-last, the set is what a pipeline pipes in. The
 * transport hands each row on as the record the platform sent, and the row is
 * decoded here and nowhere else. A row that does not fit the model (the server
 * changed, or the pair was written by hand) fails the whole page with a
 * `DecodeError` whose `index` says which row it was and whose `locator` says
 * which object, when the row's own keys name one.
 *
 * **Example** (Read a page of typed offices)
 *
 * ```ts import.meta.vitest name="Read a page of typed offices"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import {
 *   FetchOptions,
 *   fetchPage,
 *   LoadObjectsResponse,
 *   OntologyTransport,
 * } from "@beep/scratchpad/osdk/src/Client/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Office = Model.object({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: { officeId: Model.required(Model.string), capacity: Model.integer },
 *   links: {},
 * })
 * const Canned = Layer.mock(OntologyTransport, {
 *   loadObjects: () =>
 *     Effect.orDie(
 *       S.decodeUnknownEffect(LoadObjectsResponse)({
 *         data: [{ __apiName: "Office", __primaryKey: "NYC", officeId: "NYC", capacity: 120 }],
 *         totalCount: "1",
 *         propertySecurities: [],
 *       })
 *     ),
 * })
 * const page = await Effect.runPromise(
 *   Effect.scoped(
 *     Effect.flatMap(Layer.build(Canned), (context) =>
 *       Effect.provide(fetchPage(Model.all(Office), FetchOptions.make({})), context)
 *     )
 *   )
 * )
 * const facts = A.map(page.data, (office) => [office.properties.officeId, office.properties.capacity])
 * facts // => [["NYC", O.some(120)]]
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const fetchPage: {
  (options: FetchOptions): <A>(set: InstanceSet<A>) => ReturnType<typeof fetchPageImpl<A>>;
  <A>(set: InstanceSet<A>, options: FetchOptions): ReturnType<typeof fetchPageImpl<A>>;
} = dual(2, fetchPageImpl);

// -----------------------------------------------------------------------------
// Streams
// -----------------------------------------------------------------------------

// The state of the pagination is the token to ask for next: none for the first page, then whatever
// each page hands back, until a page hands back none.
const pagesFrom = <A>(set: InstanceSet<A>, options: FetchOptions) =>
  Stream.paginate(options.pageToken, (pageToken) =>
    Effect.map(fetchPageImpl(set, FetchOptions.make({ ...options, pageToken })), (page) =>
      Tuple.make(page.data, O.map(page.nextPageToken, O.some))
    )
  );

const streamImpl = <A>(set: InstanceSet<A>, options: FetchOptions) =>
  pagesFrom(set, FetchOptions.make({ ...options, snapshot: true }));

/**
 * Streams every object of a set, decoded with the set's model, following page tokens until none is left.
 *
 * **Details**
 *
 * The stream requests a page only when its consumer needs one, so taking the
 * first few instances reads no more pages than those instances span. It starts
 * at `options.pageToken` (the first page when none) and asks for
 * `options.pageSize` objects per page.
 *
 * A stream always reads from a snapshot, whatever `options.snapshot` says, as
 * OSDK's `asyncIter` does: without one, objects edited while the stream runs
 * can repeat or go missing between pages.
 *
 * **Example** (Follow two pages of offices)
 *
 * ```ts import.meta.vitest name="Follow two pages of offices"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import * as Stream from "effect/Stream"
 * import {
 *   FetchOptions,
 *   LoadObjectsResponse,
 *   OntologyTransport,
 *   stream,
 * } from "@beep/scratchpad/osdk/src/Client/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Office = Model.object({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: { officeId: Model.required(Model.string) },
 *   links: {},
 * })
 * const office = (officeId: string) => ({ __apiName: "Office", __primaryKey: officeId, officeId })
 * const first = { data: [office("NYC")], nextPageToken: "v1.second", totalCount: "2", propertySecurities: [] }
 * const second = { data: [office("LDN")], totalCount: "2", propertySecurities: [] }
 * const Canned = Layer.mock(OntologyTransport, {
 *   loadObjects: ({ pageToken }) =>
 *     Effect.orDie(S.decodeUnknownEffect(LoadObjectsResponse)(O.isNone(pageToken) ? first : second)),
 * })
 * const offices = await Effect.runPromise(
 *   Effect.scoped(
 *     Effect.flatMap(Layer.build(Canned), (context) =>
 *       Effect.provide(Stream.runCollect(stream(Model.all(Office), FetchOptions.make({}))), context)
 *     )
 *   )
 * )
 * const keys = A.map(offices, (found) => found.properties.officeId)
 * keys // => ["NYC", "LDN"]
 * ```
 *
 * @category streams
 * @since 0.0.0
 */
export const stream: {
  (options: FetchOptions): <A>(set: InstanceSet<A>) => ReturnType<typeof streamImpl<A>>;
  <A>(set: InstanceSet<A>, options: FetchOptions): ReturnType<typeof streamImpl<A>>;
} = dual(2, streamImpl);

// -----------------------------------------------------------------------------
// Exactly one object
// -----------------------------------------------------------------------------

const fetchOneImpl = Effect.fn("Client.fetchOne")(function* <A>(set: InstanceSet<A>, options: FetchOptions) {
  // Two objects are enough to know the set does not hold exactly one, and the stream reads on past a
  // short page, so a page that comes back with fewer objects than it could hold is not mistaken for the end.
  const found = yield* pipe(
    pagesFrom(set, FetchOptions.make({ ...options, pageSize: O.some(2), pageToken: O.none() })),
    Stream.take(2),
    Stream.runCollect
  );
  // The object type the read was typed by: the one its model describes, and none for an untyped set.
  const objectType = O.map(O.fromUndefinedOr(set.model.apiName), ObjectTypeApiName.make);
  return yield* A.match(found, {
    onEmpty: () => Effect.fail(ObjectNotFound.make({ objectType })),
    onNonEmpty: (objects) =>
      objects.length === 1
        ? Effect.succeed(A.headNonEmpty(objects))
        : Effect.fail(MultipleObjectsFound.make({ objectType })),
  });
});

/**
 * Loads the single object of a set, decoded with the set's model.
 *
 * **Details**
 *
 * The set must hold exactly one object: none fails with `ObjectNotFound`,
 * more than one with `MultipleObjectsFound`. Both name the object type of the
 * set's model, and none when the set is untyped. To read one object by its
 * primary key, filter the model's set on the key property with `Model.where`
 * and pass or pipe the result here.
 *
 * `options.pageSize` and `options.pageToken` are ignored: the read asks for
 * two objects from the start, which is the fewest that tells one from several.
 *
 * **Example** (Tell one office from none)
 *
 * ```ts import.meta.vitest name="Tell one office from none"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 * import {
 *   FetchOptions,
 *   fetchOne,
 *   LoadObjectsResponse,
 *   OntologyTransport,
 * } from "@beep/scratchpad/osdk/src/Client/index"
 * import * as Model from "@beep/scratchpad/osdk/src/Model/index"
 *
 * const Office = Model.object({
 *   apiName: "Office",
 *   primaryKey: "officeId",
 *   properties: { officeId: Model.required(Model.string) },
 *   links: {},
 * })
 * const serving = (data: ReadonlyArray<unknown>) =>
 *   Layer.mock(OntologyTransport, {
 *     loadObjects: () =>
 *       Effect.orDie(
 *         S.decodeUnknownEffect(LoadObjectsResponse)({ data, totalCount: `${data.length}`, propertySecurities: [] })
 *       ),
 *   })
 * const read = (data: ReadonlyArray<unknown>) =>
 *   Effect.scoped(
 *     Effect.flatMap(Layer.build(serving(data)), (context) =>
 *       Effect.provide(fetchOne(Model.all(Office), FetchOptions.make({})), context)
 *     )
 *   )
 * const one = await Effect.runPromise(read([{ __apiName: "Office", __primaryKey: "NYC", officeId: "NYC" }]))
 * const none = await Effect.runPromise(Effect.flip(read([])))
 * const facts = [one.properties.officeId, none._tag]
 * facts // => ["NYC", "ObjectNotFound"]
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const fetchOne: {
  (options: FetchOptions): <A>(set: InstanceSet<A>) => ReturnType<typeof fetchOneImpl<A>>;
  <A>(set: InstanceSet<A>, options: FetchOptions): ReturnType<typeof fetchOneImpl<A>>;
} = dual(2, fetchOneImpl);

// -----------------------------------------------------------------------------
// Aggregations
// -----------------------------------------------------------------------------

const isObjectCount = S.is(S.Int.check(S.isGreaterThanOrEqualTo(0)));

/**
 * Counts the objects of an object set.
 *
 * **Details**
 *
 * The count is one aggregation with no grouping, so no object is loaded and
 * no model is needed: the argument is the plain object set, `set.objectSet`
 * of a typed set. An answer that carries no whole, non-negative count fails
 * with a `DecodeError`.
 *
 * **Example** (Count the offices)
 *
 * ```ts import.meta.vitest name="Count the offices"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as S from "effect/Schema"
 * import { AggregateResponse } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { count, OntologyTransport } from "@beep/scratchpad/osdk/src/Client/index"
 * import { objectType } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const Canned = Layer.mock(OntologyTransport, {
 *   aggregate: () =>
 *     Effect.orDie(
 *       S.decodeUnknownEffect(AggregateResponse)({
 *         accuracy: "ACCURATE",
 *         data: [{ group: {}, metrics: [{ name: "count", value: 42 }] }],
 *       })
 *     ),
 * })
 * const offices = await Effect.runPromise(
 *   Effect.scoped(
 *     Effect.flatMap(Layer.build(Canned), (context) => Effect.provide(count(objectType("Office")), context))
 *   )
 * )
 * offices // => 42
 * ```
 *
 * @param objectSet - Which objects to count.
 * @category queries
 * @since 0.0.0
 */
export const count = Effect.fn("Client.count")(function* (objectSet: ObjectSet) {
  const transport = yield* OntologyTransport;
  const response = yield* transport.aggregate(
    AggregateObjectSetRequest.make({ objectSet, aggregations: [countObjects()] })
  );
  return yield* pipe(
    ungroupedRow(response),
    O.flatMap((row) => regroupMetrics(row).count),
    O.filter(isObjectCount),
    Effect.fromOption(() =>
      DecodeError.make({ message: "The aggregation answer holds no object count", cause: response })
    )
  );
});

const decodeAggregateRequest = S.decodeUnknownEffect(S.toType(AggregateObjectSetRequest));

const aggregateImpl = Effect.fn("Client.aggregate")(function* (
  objectSet: ObjectSet,
  aggregations: ReadonlyArray<Aggregation>,
  groupBy: ReadonlyArray<GroupBy>
) {
  const transport = yield* OntologyTransport;
  // The request has rules that tie ordering metrics to groupings. Breaking one is the caller's
  // mistake, reported as a typed failure before anything is sent.
  const request = yield* Effect.mapError(
    decodeAggregateRequest({ objectSet, aggregations, groupBy, accuracy: O.none(), includeComputeUsage: O.none() }),
    (cause) => DecodeError.make({ message: cause.message, cause })
  );
  const response = yield* transport.aggregate(request);
  return AggregationResult.make({
    accuracy: response.accuracy,
    excludedItems: response.excludedItems,
    groups: A.map(response.data, (row) => AggregatedGroup.make({ group: row.group, metrics: regroupMetrics(row) })),
  });
});

/**
 * Computes metrics over the objects of an object set, per group, and regroups them into lookups.
 *
 * **Details**
 *
 * Each group of the result carries its metrics as a `MetricLookup`: the count,
 * the conventionally named metrics by property and metric, and every other
 * metric under its own name. Build the metrics with the constructors of the
 * aggregation concept (`count()`, `avg(property)`, ...) so their names follow
 * the convention.
 *
 * Metrics and groupings name properties by plain API name and the result
 * holds numbers, not instances, so no model takes part: the argument is the
 * plain object set, `set.objectSet` of a typed set.
 *
 * A request that breaks a rule of aggregation (a metric that orders the
 * result across two groupings, or beside a null group) is not sent: the call
 * fails with a `DecodeError` that states the rule.
 *
 * **Example** (Average salary per team)
 *
 * ```ts import.meta.vitest name="Average salary per team"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 * import { AggregateResponse, avg, exact } from "@beep/scratchpad/osdk/src/Aggregation/index"
 * import { aggregate, OntologyTransport } from "@beep/scratchpad/osdk/src/Client/index"
 * import { PropertyApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { objectType } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const salary = PropertyApiName.make("salary")
 * const Canned = Layer.mock(OntologyTransport, {
 *   aggregate: () =>
 *     Effect.orDie(
 *       S.decodeUnknownEffect(AggregateResponse)({
 *         accuracy: "ACCURATE",
 *         data: [{ group: { team: "platform" }, metrics: [{ name: "salary.avg", value: 91000 }] }],
 *       })
 *     ),
 * })
 * const result = await Effect.runPromise(
 *   Effect.scoped(
 *     Effect.flatMap(Layer.build(Canned), (context) =>
 *       Effect.provide(
 *         aggregate(objectType("Employee"), [avg(salary)], [exact(PropertyApiName.make("team"), {})]),
 *         context
 *       )
 *     )
 *   )
 * )
 * const facts = A.map(result.groups, ({ group, metrics }) => [
 *   group,
 *   O.flatMap(R.get(metrics.properties, salary), (values) => values.avg),
 * ])
 * facts // => [[{ team: "platform" }, O.some(91000)]]
 * ```
 *
 * @param objectSet - Which objects to aggregate.
 * @param aggregations - The metrics to compute for each group.
 * @param groupBy - The groupings, outermost first; none aggregates every object into one group.
 * @category queries
 * @since 0.0.0
 */
export const aggregate: {
  (
    aggregations: ReadonlyArray<Aggregation>,
    groupBy: ReadonlyArray<GroupBy>
  ): (objectSet: ObjectSet) => ReturnType<typeof aggregateImpl>;
  (
    objectSet: ObjectSet,
    aggregations: ReadonlyArray<Aggregation>,
    groupBy: ReadonlyArray<GroupBy>
  ): ReturnType<typeof aggregateImpl>;
} = dual(3, aggregateImpl);
