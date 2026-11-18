/**
 * Link instances: one link between two objects, the listings that enumerate links, and the link subscription protocol.
 *
 * **Details**
 *
 * A link type says which objects may be linked. This module is about the links
 * that exist. One link is one value, {@link Link}: the object it starts from,
 * the object it reaches and the link type that connects them, as named from
 * the starting object. The paged listing sends links nested under their source
 * object, the subscription stream sends them one by one with both ends named by
 * key record, and the legacy bulk route reports them beside the object that was
 * asked about. Each of those spellings is a schema here, and the nested one
 * decodes to a flat list of links.
 *
 * The link stream speaks the same protocol as the object-set stream of the
 * `Subscription` concept and reuses its identifiers, its answer to a subscribe
 * message and its closure notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equivalence from "effect/Equivalence";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { LinkTypeApiName, ObjectTypeApiName } from "../Identifier/Identifier.model.ts";
import { ObjectLocator, PrimaryKeyValue } from "../Object/Object.model.ts";
import { ObjectSet } from "../ObjectSet/ObjectSet.model.ts";
import { PageRequest, PageToken } from "../Page/Page.model.ts";
import {
  PrimaryKeyRecord,
  RequestId,
  SubscribeResponses,
  SubscriptionClosed,
  SubscriptionId,
} from "../Subscription/Subscription.model.ts";

const $I = $ScratchpadId.create("osdk/Link/Link.model");

// -----------------------------------------------------------------------------
// One link
// -----------------------------------------------------------------------------

/**
 * One link between two objects: where it starts, where it leads and the link type that connects them.
 *
 * **Details**
 *
 * A link is directed by how it was asked for. `source` is the object the
 * request started from, `target` is the object at the other end, and `linkType`
 * is the name of the link type as the source's object type declares it. The
 * same stored link, read from its other end, has the two objects swapped and
 * carries the name the other object type gives it.
 *
 * Both ends are {@link ObjectLocator}s: a link names its objects, it does not
 * carry them.
 *
 * **Example** (Describe a link)
 *
 * ```ts import.meta.vitest name="Describe a link"
 * import { LinkTypeApiName, ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { Link } from "@beep/scratchpad/osdk/src/Link/index"
 * import { ObjectLocator } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const link = Link.make({
 *   source: ObjectLocator.make({ objectType: ObjectTypeApiName.make("Employee"), primaryKey: 50030 }),
 *   target: ObjectLocator.make({ objectType: ObjectTypeApiName.make("Office"), primaryKey: "NYC" }),
 *   linkType: LinkTypeApiName.make("officeLink"),
 * })
 * const summary = `${link.source.objectType} -${link.linkType}-> ${link.target.objectType}`
 * summary // => "Employee -officeLink-> Office"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Link extends S.Opaque<Link, { readonly brand: unique symbol }>()(
  S.Struct({
    // The two ends stay bare: `annotateKey` on an opaque class would type the field as its plain record.
    source: ObjectLocator,
    target: ObjectLocator,
    linkType: LinkTypeApiName.annotateKey({
      description: "Name of the link type that connects the two, as the source's object type declares it.",
    }),
  }).pipe(
    $I.annoteSchema("Link", {
      description: "One link between two objects: where it starts, where it leads and the link type between them.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// The paged listing
// -----------------------------------------------------------------------------

// All a link row sends of an object: the two reserved keys that identify it.
const IdentityKeys = S.Struct({
  __apiName: S.String,
  __primaryKey: PrimaryKeyValue,
});

// One linked object of a row. The wire marks both keys optional although a link has no meaning without them.
const LinkedObjectRow = S.Struct({
  targetObject: S.optionalKey(IdentityKeys),
  linkType: S.optionalKey(S.String),
});

// One row of the listing: a source object and every object linked to it.
const SourceRow = S.Struct({
  sourceObject: S.optionalKey(IdentityKeys),
  linkedObjects: S.Array(LinkedObjectRow),
});

const SourceRows = S.Array(SourceRow);

type EncodedLocator = typeof ObjectLocator.Encoded;

type EncodedLink = typeof Link.Encoded;

// A link on its way back to the wire: the source it will be grouped under, and its entry in that group.
type RowEntry = {
  readonly sourceObject: typeof IdentityKeys.Type;
  readonly linkedObject: typeof LinkedObjectRow.Type;
};

const locatorOf = ({ __apiName, __primaryKey }: typeof IdentityKeys.Type): EncodedLocator => ({
  objectType: __apiName,
  primaryKey: __primaryKey,
});

const identityOf = ({ objectType, primaryKey }: EncodedLocator): typeof IdentityKeys.Type => ({
  __apiName: objectType,
  __primaryKey: primaryKey,
});

const linksOfRow = ({ sourceObject, linkedObjects }: typeof SourceRow.Type): O.Option<ReadonlyArray<EncodedLink>> =>
  pipe(
    O.fromUndefinedOr(sourceObject),
    O.flatMap((source) =>
      O.all(
        A.map(linkedObjects, ({ targetObject, linkType }) =>
          O.all({
            source: O.some(locatorOf(source)),
            target: O.map(O.fromUndefinedOr(targetObject), locatorOf),
            linkType: O.fromUndefinedOr(linkType),
          })
        )
      )
    )
  );

const rowEntryOf = ({ source, target, linkType }: EncodedLink): RowEntry => ({
  sourceObject: identityOf(source),
  linkedObject: { targetObject: identityOf(target), linkType },
});

const sameSource = Equivalence.mapInput(S.toEquivalence(IdentityKeys), ({ sourceObject }: RowEntry) => sourceObject);

const rowOf = (entries: A.NonEmptyReadonlyArray<RowEntry>): typeof SourceRow.Type => ({
  sourceObject: A.headNonEmpty(entries).sourceObject,
  linkedObjects: A.map(entries, ({ linkedObject }) => linkedObject),
});

/**
 * Codec between the rows a link listing sends, one per source object, and the flat list of {@link Link}s they hold.
 *
 * **Details**
 *
 * The wire nests: each row is a source object followed by the objects linked
 * to it, each with the link type that reaches it. Decoding flattens that into
 * one link per pair, in wire order. The objects travel as their two reserved
 * keys `__apiName` and `__primaryKey` and decode to locators; any other key of
 * such an object is not part of a link and is dropped.
 *
 * Encoding groups ADJACENT links of the same source back under one row, so
 * decoding the result returns the same list in the same order. A row with no
 * linked objects holds no link: it decodes to nothing and is not written back.
 *
 * **Gotchas**
 *
 * The wire marks a row's source object, and each linked object's target and
 * link type, as optional. OSDK asserts they are present. Here a row that lacks
 * one fails to decode, because it cannot be read as a link.
 *
 * **Example** (Flatten a source object's row into links)
 *
 * ```ts import.meta.vitest name="Flatten a source object's row into links"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LinksFromSourceRows } from "@beep/scratchpad/osdk/src/Link/index"
 *
 * const links = await Effect.runPromise(
 *   S.decodeUnknownEffect(LinksFromSourceRows)([
 *     {
 *       sourceObject: { __apiName: "Employee", __primaryKey: 50030 },
 *       linkedObjects: [
 *         { targetObject: { __apiName: "Office", __primaryKey: "NYC" }, linkType: "officeLink" },
 *         { targetObject: { __apiName: "Employee", __primaryKey: 50031 }, linkType: "peeps" },
 *       ],
 *     },
 *   ])
 * )
 * const summary = A.map(links, (link) => [link.source.primaryKey, link.linkType, link.target.primaryKey])
 * summary // => [[50030, "officeLink", "NYC"], [50030, "peeps", 50031]]
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const LinksFromSourceRows = SourceRows.pipe(
  S.decodeTo(
    S.Array(Link),
    SchemaTransformation.transformEffect<ReadonlyArray<EncodedLink>, typeof SourceRows.Type>({
      decode: (rows, options) =>
        pipe(
          O.all(A.map(rows, linksOfRow)),
          O.map(A.flatten),
          Effect.fromOption(
            () =>
              new SchemaIssue.InvalidValue(
                {
                  message:
                    "Expected every row to name its source object, and every linked object its target and link type",
                },
                rows,
                options
              )
          )
        ),
      encode: (links) =>
        Effect.succeed(
          A.match(A.map(links, rowEntryOf), {
            onEmpty: A.empty<typeof SourceRow.Type>,
            onNonEmpty: flow(A.groupWith(sameSource), A.map(rowOf)),
          })
        ),
    })
  ),
  $I.annoteSchema("LinksFromSourceRows", {
    description: "The links of a listing, sent as one row per source object and read as one flat list.",
  })
);

/**
 * Runtime type of {@link LinksFromSourceRows}: a list of {@link Link}s.
 *
 * @category codecs
 * @since 0.0.0
 */
export type LinksFromSourceRows = typeof LinksFromSourceRows.Type;

/**
 * Request for one page of the links that leave the objects of an object set.
 *
 * **Details**
 *
 * The object set selects the source objects, and `linkTypes` names which of
 * their link types to follow. The platform does not serve this request for an
 * object set over an interface, nor for link types stored in the first
 * generation of object storage.
 *
 * **Example** (Ask for two link types of every employee)
 *
 * ```ts import.meta.vitest name="Ask for two link types of every employee"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LinkTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { LoadLinksRequest } from "@beep/scratchpad/osdk/src/Link/index"
 * import { BaseObjectSet } from "@beep/scratchpad/osdk/src/ObjectSet/index"
 *
 * const request = LoadLinksRequest.make({
 *   objectSet: BaseObjectSet.make({ objectType: ObjectTypeApiName.make("Employee") }),
 *   linkTypes: [LinkTypeApiName.make("lead"), LinkTypeApiName.make("peeps")],
 * })
 * const wire = await Effect.runPromise(S.encodeEffect(LoadLinksRequest)(request))
 * wire // => { objectSet: { type: "base", objectType: "Employee" }, links: ["lead", "peeps"] }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LoadLinksRequest extends S.Opaque<LoadLinksRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    objectSet: ObjectSet.annotateKey({ description: "The object set whose objects are the sources." }),
    linkTypes: S.Array(LinkTypeApiName).annotateKey({ description: "The link types to follow from each source." }),
    // The cursor of the paging arguments every list request shares. This route takes no page size.
    ...Struct.pick(PageRequest.fields, ["pageToken"]),
    includeComputeUsage: S.OptionFromOptionalKey(S.Boolean).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Whether the response reports the compute it used; absent means it does not." })
    ),
  }).pipe(
    S.encodeKeys({ linkTypes: "links" }),
    $I.annoteSchema("LoadLinksRequest", {
      description: "Request for one page of the links that leave the objects of an object set.",
    })
  )
) {}

/**
 * One page of the links that leave the objects of an object set.
 *
 * **Details**
 *
 * `data` is the page's rows read as a flat list of links (see
 * {@link LinksFromSourceRows}). Two limits come with the listing: the links
 * may lag behind the latest edits, and when the source objects of one page
 * hold more than 100,000 links between them the page is cut short without
 * saying so.
 *
 * **Example** (Read a page of links)
 *
 * ```ts import.meta.vitest name="Read a page of links"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LinkPage } from "@beep/scratchpad/osdk/src/Link/index"
 *
 * const page = await Effect.runPromise(
 *   S.decodeUnknownEffect(LinkPage)({
 *     data: [
 *       {
 *         sourceObject: { __apiName: "Employee", __primaryKey: 50030 },
 *         linkedObjects: [{ targetObject: { __apiName: "Office", __primaryKey: "NYC" }, linkType: "officeLink" }],
 *       },
 *       { sourceObject: { __apiName: "Employee", __primaryKey: 50031 }, linkedObjects: [] },
 *     ],
 *     nextPageToken: "v1.next",
 *   })
 * )
 * const summary = [page.data.length, O.isSome(page.nextPageToken), O.isNone(page.computeUsage)]
 * summary // => [1, true, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LinkPage extends S.Opaque<LinkPage, { readonly brand: unique symbol }>()(
  S.Struct({
    data: LinksFromSourceRows.annotateKey({ description: "The links of this page, in wire order." }),
    nextPageToken: S.OptionFromOptionalKey(PageToken).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Cursor of the following page, absent when this page is the last." })
    ),
    computeUsage: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Compute seconds the request used, when the request asked for them." })
    ),
  }).pipe(
    $I.annoteSchema("LinkPage", {
      description: "One page of the links that leave the objects of an object set.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// The bulk listing
// -----------------------------------------------------------------------------

/**
 * One link as the bulk listing reports it: the object that was asked about, the link type and the object reached.
 *
 * **Details**
 *
 * The bulk route is OSDK's experimental `getBulkLinks`. It addresses
 * everything by resource identifier and translates the answer back to names on
 * the client, which is why the far end is weaker than a {@link Link}'s target:
 * the name of its object type is absent when the client could not resolve it,
 * and its primary key is whatever value the platform sent, untyped.
 *
 * The rules OSDK applies on this route: every object asked about must be of
 * one object type; only object types with a single key property are
 * supported; a link type name the object type does not declare is an error;
 * one page holds at most 100,000 links.
 *
 * **Example** (Read a bulk link whose far end has no known type)
 *
 * ```ts import.meta.vitest name="Read a bulk link whose far end has no known type"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { BulkLink } from "@beep/scratchpad/osdk/src/Link/index"
 *
 * const link = await Effect.runPromise(
 *   S.decodeUnknownEffect(BulkLink)({
 *     object: { objectType: "Employee", primaryKey: 50030 },
 *     linkApiName: "officeLink",
 *     otherObjectApiName: null,
 *     otherObjectPk: "NYC",
 *   })
 * )
 * const summary = [link.source.primaryKey, link.linkType, O.isNone(link.targetObjectType), link.targetPrimaryKey]
 * summary // => [50030, "officeLink", true, "NYC"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BulkLink extends S.Opaque<BulkLink, { readonly brand: unique symbol }>()(
  S.Struct({
    source: ObjectLocator,
    linkType: LinkTypeApiName.annotateKey({
      description: "Name of the link type, as the source's object type declares it.",
    }),
    targetObjectType: S.OptionFromOptionalNullOr(ObjectTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Object type of the object reached, when its name could be resolved." })
    ),
    targetPrimaryKey: S.Json.annotateKey({
      description: "Primary key of the object reached, as the platform sent it.",
    }),
  }).pipe(
    S.encodeKeys({
      source: "object",
      linkType: "linkApiName",
      targetObjectType: "otherObjectApiName",
      targetPrimaryKey: "otherObjectPk",
    }),
    $I.annoteSchema("BulkLink", {
      description: "One link as the bulk listing reports it: the object asked about, the link type, the far end.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// The link stream: client to server
// -----------------------------------------------------------------------------

/**
 * Which object, with its primary key written by key property: the spelling the link stream uses for both ends.
 *
 * **Details**
 *
 * An {@link ObjectLocator} holds the bare key value. This record holds the key
 * as a record from each key property's name to its value, so it cannot be read
 * as a locator without knowing which property is the key, and a locator cannot
 * be written this way without it either. OSDK builds the record from the
 * object type's key property and reads it back by taking the record's first
 * value.
 *
 * @category models
 * @since 0.0.0
 */
export class KeyedObjectLocator extends S.Opaque<KeyedObjectLocator, { readonly brand: unique symbol }>()(
  S.Struct({
    objectType: ObjectTypeApiName.annotateKey({ description: "The concrete object type the object belongs to." }),
    primaryKey: PrimaryKeyRecord.annotateKey({ description: "Primary key of the object, by key property." }),
  }).pipe(
    $I.annoteSchema("KeyedObjectLocator", {
      description: "Which object, with its primary key written as a record by key property.",
    })
  )
) {}

/**
 * A set of objects and the link types to watch on each of them.
 *
 * **Details**
 *
 * OSDK refuses to build a request with no objects or no link types, and all
 * objects of one request are of one object type. The wire states neither rule,
 * so neither is part of this schema.
 *
 * @category models
 * @since 0.0.0
 */
export class LinkSubscribeRequest extends S.Opaque<LinkSubscribeRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    selectedObjects: S.Array(KeyedObjectLocator).annotateKey({
      description: "The objects whose links to watch; each is the source of the links reported for it.",
    }),
    linkTypes: S.Array(LinkTypeApiName).annotateKey({ description: "The link types to watch on each object." }),
  }).pipe(
    $I.annoteSchema("LinkSubscribeRequest", {
      description: "A set of objects and the link types to watch on each of them.",
    })
  )
) {}

/**
 * The message a client sends over the link stream: every link subscription it wants from now on.
 *
 * **Details**
 *
 * The rules are those of the object-set stream. The message restates all live
 * subscriptions, leaving one out unsubscribes it, and the same message is the
 * heartbeat (OSDK resends it every 45 seconds and closes the socket 15 seconds
 * after the last subscription ends). The server answers with one
 * `subscribeResponses` message that repeats `id` and holds one response per
 * request, in request order.
 *
 * **Example** (Watch one link type of two employees)
 *
 * ```ts import.meta.vitest name="Watch one link type of two employees"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LinkSubscribeRequests } from "@beep/scratchpad/osdk/src/Link/index"
 *
 * const wire = {
 *   id: "00000000-0000-0000-0000-000000000001",
 *   requests: [
 *     {
 *       selectedObjects: [
 *         { objectType: "Employee", primaryKey: { employeeId: 1 } },
 *         { objectType: "Employee", primaryKey: { employeeId: 2 } },
 *       ],
 *       linkTypes: ["lead"],
 *     },
 *   ],
 * }
 * const message = await Effect.runPromise(S.decodeUnknownEffect(LinkSubscribeRequests)(wire))
 * const again = await Effect.runPromise(S.encodeEffect(LinkSubscribeRequests)(message))
 * again // => wire
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LinkSubscribeRequests extends S.Opaque<LinkSubscribeRequests, { readonly brand: unique symbol }>()(
  S.Struct({
    id: RequestId.annotateKey({ description: "Identifier the answering message repeats." }),
    requests: S.Array(LinkSubscribeRequest).annotateKey({
      description: "Every link subscription wanted from now on; the answer follows this order.",
    }),
  }).pipe(
    $I.annoteSchema("LinkSubscribeRequests", {
      description: "Every link subscription a client wants from now on.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// The link stream: server to client
// -----------------------------------------------------------------------------

/**
 * What happened to a link of a watched object.
 *
 * **Details**
 *
 * There is no "changed" state. A link that changes arrives as `removed`
 * followed by `added` within one batch of updates.
 *
 * **Example** (Count how a batch changes the number of links)
 *
 * ```ts import.meta.vitest name="Count how a batch changes the number of links"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LinkState } from "@beep/scratchpad/osdk/src/Link/index"
 *
 * const delta = LinkState.To.match({ added: () => 1, removed: () => -1 })
 * const states = await Effect.runPromise(S.decodeUnknownEffect(S.Array(LinkState))(["REMOVED", "ADDED", "ADDED"]))
 * A.map(states, delta) // => [-1, 1, 1]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LinkState = MappedLiteralKit([
  ["ADDED", "added"],
  ["REMOVED", "removed"],
]).pipe(
  $I.annoteSchema("LinkState", {
    description: "What happened to a link of a watched object.",
  })
);

/**
 * Runtime type of {@link LinkState}.
 *
 * @category models
 * @since 0.0.0
 */
export type LinkState = typeof LinkState.Type;

/**
 * One link of a watched object appeared or disappeared.
 *
 * **Details**
 *
 * `source` is the watched object (the wire's `selectedSide`, one of the
 * request's `selectedObjects`) and `target` is the object at the other end
 * (the wire's `linkedSide`), which matches the direction of a {@link Link}.
 * Both ends are named by key record, not by bare key.
 *
 * **Example** (Read a link update from its watched end)
 *
 * ```ts import.meta.vitest name="Read a link update from its watched end"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LinkUpdate } from "@beep/scratchpad/osdk/src/Link/index"
 *
 * const update = await Effect.runPromise(
 *   S.decodeUnknownEffect(LinkUpdate)({
 *     selectedSide: { objectType: "Employee", primaryKey: { employeeId: 1 } },
 *     linkType: "lead",
 *     linkedSide: { objectType: "Employee", primaryKey: { employeeId: 2 } },
 *     state: "ADDED",
 *   })
 * )
 * const summary = [update.source.primaryKey, update.linkType, update.target.primaryKey, update.state]
 * summary // => [{ employeeId: 1 }, "lead", { employeeId: 2 }, "added"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LinkUpdate extends S.Opaque<LinkUpdate, { readonly brand: unique symbol }>()(
  S.Struct({
    source: KeyedObjectLocator,
    linkType: LinkTypeApiName.annotateKey({
      description: "Name of the link type, as the watched object's type declares it.",
    }),
    target: KeyedObjectLocator,
    state: LinkState.annotateKey({ description: "Whether the link now exists or no longer does." }),
  }).pipe(
    S.encodeKeys({ source: "selectedSide", target: "linkedSide" }),
    $I.annoteSchema("LinkUpdate", {
      description: "One link of a watched object appeared or disappeared.",
    })
  )
) {}

const LinkStreamMessageKind = LiteralKit(["subscribeResponses", "updates", "refresh", "subscriptionClosed"]);

/**
 * A batch of changes to the links of one link subscription.
 *
 * @category models
 * @since 0.0.0
 */
export class LinkUpdates extends S.Opaque<LinkUpdates, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("updates"),
    id: SubscriptionId.annotateKey({ description: "The subscription the changes belong to." }),
    updates: S.Array(LinkUpdate).annotateKey({ description: "The changes, in wire order." }),
  }).pipe(
    $I.annoteSchema("LinkUpdates", { description: "A batch of changes to the links of one link subscription." })
  )
) {}

/**
 * Notice that changes of some link types cannot be listed: the client must load those links again in full.
 *
 * @category models
 * @since 0.0.0
 */
export class RefreshLinks extends S.Opaque<RefreshLinks, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("refresh"),
    id: SubscriptionId.annotateKey({ description: "The subscription that is out of date." }),
    linkTypes: S.Array(LinkTypeApiName).annotateKey({ description: "Link types whose links must be loaded again." }),
  }).pipe(
    $I.annoteSchema("RefreshLinks", {
      description: "Notice that changes of some link types cannot be listed and those links must be loaded again.",
    })
  )
) {}

/**
 * Everything the server sends over the link subscription websocket.
 *
 * **Details**
 *
 * `subscribeResponses` and `subscriptionClosed` are the records of the
 * object-set stream, with the same positional pairing of responses to requests.
 * `updates` and `refresh` are this stream's counterparts of `objectSetChanged`
 * and `refreshObjectSet`.
 *
 * How OSDK reacts differs from the object-set stream in three places. A
 * `success` reports "subscribed" only for a subscription that was still being
 * prepared, and "out of date" for every link type only for one that was
 * reconnecting, so the heartbeat's repeated `success` is silent. An answer to
 * an unknown request identifier is ignored. A message of any other kind fails
 * every subscription and reconnects the socket.
 *
 * **Example** (Route a link stream message)
 *
 * ```ts import.meta.vitest name="Route a link stream message"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LinkStreamMessage } from "@beep/scratchpad/osdk/src/Link/index"
 *
 * const route = LinkStreamMessage.match({
 *   subscribeResponses: ({ responses }) => `${responses.length} request(s) answered`,
 *   updates: ({ updates }) => `${updates.length} link change(s)`,
 *   refresh: ({ linkTypes }) => `reload ${A.join(linkTypes, ", ")}`,
 *   subscriptionClosed: ({ cause }) => `closed by ${cause.type}`,
 * })
 * const message = await Effect.runPromise(
 *   S.decodeUnknownEffect(LinkStreamMessage)({ type: "refresh", id: "sub-1", linkTypes: ["lead", "peeps"] })
 * )
 * route(message) // => "reload lead, peeps"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LinkStreamMessage = LinkStreamMessageKind.mapMembers(() =>
  Tuple.make(SubscribeResponses, LinkUpdates, RefreshLinks, SubscriptionClosed)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("LinkStreamMessage", {
    description: "Everything the server sends over the link subscription websocket.",
  })
);

/**
 * Runtime type of {@link LinkStreamMessage}.
 *
 * @category models
 * @since 0.0.0
 */
export type LinkStreamMessage = typeof LinkStreamMessage.Type;
