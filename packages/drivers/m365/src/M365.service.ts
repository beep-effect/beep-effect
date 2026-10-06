/**
 * Effect service for Microsoft Graph `v1.0` driver calls.
 *
 * The driver uses raw Graph REST requests through `effect/http`,
 * decodes every JSON payload with `effect/Schema`, and records only technical
 * counts/sizes in spans. It never logs tokens, mail bodies, file bytes, or
 * document content.
 *
 * Two lanes share the verbs. The delegated lane is read-only by scope. The
 * app-only lane adds mailbox writes (calendar events, categories); it never
 * uses `/me` routes, and a create that may or may not have reached Graph fails
 * as `"ambiguous write"` instead of being replayed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $M365Id } from "@beep/identity";
import { LiteralKit, URLStr } from "@beep/schema";
import { addDays } from "@beep/schema/LocalDate";
import { getSomesStruct } from "@beep/utils/Option";
import { Config, Context, Duration, Effect, flow, HashSet, Layer, pipe, SchemaGetter } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import { FetchHttpClient } from "effect/http";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { M365Auth } from "./M365.auth.ts";
import { M365ConfigInput, resolveM365Config } from "./M365.config.ts";
import { M365Error } from "./M365.errors.ts";
import {
  GraphAttachment,
  GraphBodyContentType,
  GraphCategoryColor,
  GraphCollection,
  GraphDrive,
  GraphDriveItem,
  GraphDriveItemVersion,
  GraphEvent,
  GraphEventShowAs,
  GraphListItem,
  GraphMessage,
  GraphOutlookCategory,
  GraphSite,
} from "./M365.schemas.ts";
import type { LocalDate } from "@beep/schema/LocalDate";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import type { M365AuthShape, M365InteractiveAuthorizer } from "./M365.auth.ts";
import type { M365AppOnlyConfigInput } from "./M365.config.ts";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" })).annotate({
  title: "PosInt",
  description: "An integer greater than zero.",
});

const decodeM365ConfigInput = S.decodeEffect(M365ConfigInput);

const $I = $M365Id.create("M365.service");

const QueryValue = S.Union([S.Finite, S.String]).pipe(
  $I.annoteSchema("QueryValue", {
    description: "Scalar Microsoft Graph query-parameter value.",
  })
);
type QueryValue = typeof QueryValue.Type;

const QueryParam = S.Tuple([S.String, S.Option(QueryValue)]).pipe(
  $I.annoteSchema("QueryParam", {
    description: "Microsoft Graph query-parameter key paired with its optional scalar value.",
  })
);
type QueryParam = typeof QueryParam.Type;

const decodeScopesCsv = flow(Str.split(","), A.map(Str.trim), A.filter(Str.isNonEmpty));
const encodeScopesCsv = (scopes: ReadonlyArray<string>): string => A.join(scopes, ",");

const M365ScopesFromCsv = S.String.pipe(
  S.decodeTo(S.Array(S.NonEmptyString), {
    decode: SchemaGetter.transform(decodeScopesCsv),
    encode: SchemaGetter.transform(encodeScopesCsv),
  }),
  $I.annoteSchema("M365ScopesFromCsv", {
    description: "Comma-delimited M365 scope environment value decoded to non-empty scope entries.",
  })
);
const decodeM365ScopesFromCsv = S.decodeEffect(M365ScopesFromCsv);

// The service runtime's token provider and HTTP client are in-process handles,
// never decoded from external input; structural `S.declare`s carry them through
// the runtime schema alongside the already-decoded resolved config.
const M365AuthShapeFromSelf = S.declare((u: unknown): u is M365AuthShape => P.isObject(u)).pipe(
  $I.annoteSchema("M365AuthShapeFromSelf", {
    description: "In-process delegated Graph token-provider shape carried through the service runtime.",
  })
);

const HttpClientFromSelf = S.declare((u: unknown): u is HttpClient.HttpClient => P.isObject(u)).pipe(
  $I.annoteSchema("HttpClientFromSelf", {
    description: "In-process Effect HttpClient carried through the service runtime.",
  })
);

const M365Lane = LiteralKit(["delegated", "app-only"]).pipe(
  $I.annoteSchema("M365Lane", {
    description: "Token lane a Microsoft 365 service instance runs on.",
  })
);

class M365ServiceConfig extends S.Class<M365ServiceConfig>($I`M365ServiceConfig`)(
  {
    graphBaseUrl: URLStr,
    lane: M365Lane,
    maxRetries: S.Natural,
  },
  $I.annote("M365ServiceConfig", {
    description: "Lane-independent settings the Microsoft Graph request executor needs.",
  })
) {}

class M365Runtime extends S.Class<M365Runtime>($I`M365Runtime`)(
  {
    auth: M365AuthShapeFromSelf,
    client: HttpClientFromSelf,
    config: M365ServiceConfig,
  },
  $I.annote("M365Runtime", {
    description: "In-process Microsoft Graph service runtime: token provider, HTTP client, and resolved config.",
  })
) {}

const REQUEST_ACCEPT = "application/json";
const ALL_SITES_SEARCH = "*";
const GRAPH_DRIVE_ITEM_SELECT = "id,name,size,file,folder,@microsoft.graph.downloadUrl";
const DEFAULT_THROTTLE_RETRY_AFTER_SECONDS = 1;
const ENCRYPTED_SKIP_REASON =
  "Graph v1.0 exposes protected/sensitivity-labeled files as encrypted bytes; v1 skips content by protected extension heuristic and never requests tenant-wide decrypt grants.";
const PROTECTED_EXTENSIONS: ReadonlyArray<string> = [
  ".pfile",
  ".pdoc",
  ".pdocx",
  ".ppdf",
  ".pppt",
  ".ppptx",
  ".pxls",
  ".pxlsx",
  ".ptxt",
  ".pjpg",
  ".pjpeg",
  ".ppng",
  ".ptif",
  ".ptiff",
  ".pbmp",
  ".pgif",
];

const isGraphPathSegment = (value: string): boolean =>
  !Str.isEmpty(value) && !Str.includes("/")(value) && !Str.includes("..")(value) && !Str.includes("%")(value);

const GraphPathSegment = S.String.check(
  S.makeFilter(isGraphPathSegment, {
    identifier: $I`GraphPathSegment`,
    title: "Graph path segment",
    description: "A Microsoft Graph path identifier that cannot traverse or inject URL path segments.",
    message: "Graph path identifiers must be non-empty and must not contain '/', '..', or percent-encoded input.",
  })
).pipe(
  $I.annoteSchema("GraphPathSegment", {
    description: "Microsoft Graph path identifier safe for URL path interpolation, excluding pre-encoded segments.",
  })
);

/**
 * Decoded Graph drive collection.
 *
 * **Example** (Make empty drive collection)
 *
 * ```ts
 * import { M365DriveCollection } from "@beep/m365"
 *
 * const collection = M365DriveCollection.make({ value: [] })
 * console.log(collection.value.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365DriveCollection = GraphCollection(GraphDrive).pipe(
  $I.annoteSchema("M365DriveCollection", {
    description: "Decoded Microsoft Graph drive collection envelope.",
  })
);

/**
 * Type for {@link M365DriveCollection}.
 *
 * **Example** (Count collection value length)
 *
 * ```ts
 * import type { M365DriveCollection } from "@beep/m365"
 *
 * const count = (collection: M365DriveCollection) => collection.value.length
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365DriveCollection = typeof M365DriveCollection.Type;

/**
 * Decoded Graph site collection.
 *
 * **Example** (Make empty site collection)
 *
 * ```ts
 * import { M365SiteCollection } from "@beep/m365"
 *
 * const collection = M365SiteCollection.make({ value: [] })
 * console.log(collection.value.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365SiteCollection = GraphCollection(GraphSite).pipe(
  $I.annoteSchema("M365SiteCollection", {
    description: "Decoded Microsoft Graph site collection envelope.",
  })
);

/**
 * Type for {@link M365SiteCollection}.
 *
 * **Example** (Count site collection length)
 *
 * ```ts
 * import type { M365SiteCollection } from "@beep/m365"
 *
 * const count = (collection: M365SiteCollection) => collection.value.length
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365SiteCollection = typeof M365SiteCollection.Type;

/**
 * Decoded Graph drive item collection, including delta envelopes.
 *
 * **Example** (Make empty item collection)
 *
 * ```ts
 * import { M365DriveItemCollection } from "@beep/m365"
 *
 * const collection = M365DriveItemCollection.make({ value: [] })
 * console.log(collection.value.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365DriveItemCollection = GraphCollection(GraphDriveItem).pipe(
  $I.annoteSchema("M365DriveItemCollection", {
    description: "Decoded Microsoft Graph driveItem collection or delta envelope.",
  })
);

/**
 * Type for {@link M365DriveItemCollection}.
 *
 * **Example** (Count drive item length)
 *
 * ```ts
 * import type { M365DriveItemCollection } from "@beep/m365"
 *
 * const count = (collection: M365DriveItemCollection) => collection.value.length
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365DriveItemCollection = typeof M365DriveItemCollection.Type;

/**
 * Decoded Graph drive item version collection.
 *
 * **Example** (Make empty version collection)
 *
 * ```ts
 * import { M365DriveItemVersionCollection } from "@beep/m365"
 *
 * const collection = M365DriveItemVersionCollection.make({ value: [] })
 * console.log(collection.value.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365DriveItemVersionCollection = GraphCollection(GraphDriveItemVersion).pipe(
  $I.annoteSchema("M365DriveItemVersionCollection", {
    description: "Decoded Microsoft Graph driveItem version collection envelope.",
  })
);

/**
 * Type for {@link M365DriveItemVersionCollection}.
 *
 * **Example** (Count version collection length)
 *
 * ```ts
 * import type { M365DriveItemVersionCollection } from "@beep/m365"
 *
 * const count = (collection: M365DriveItemVersionCollection) => collection.value.length
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365DriveItemVersionCollection = typeof M365DriveItemVersionCollection.Type;

/**
 * Decoded Graph message collection.
 *
 * **Example** (Make empty message collection)
 *
 * ```ts
 * import { M365MessageCollection } from "@beep/m365"
 *
 * const collection = M365MessageCollection.make({ value: [] })
 * console.log(collection.value.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365MessageCollection = GraphCollection(GraphMessage).pipe(
  $I.annoteSchema("M365MessageCollection", {
    description: "Decoded Microsoft Graph mail message collection envelope.",
  })
);

/**
 * Type for {@link M365MessageCollection}.
 *
 * **Example** (Count message collection length)
 *
 * ```ts
 * import type { M365MessageCollection } from "@beep/m365"
 *
 * const count = (collection: M365MessageCollection) => collection.value.length
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365MessageCollection = typeof M365MessageCollection.Type;

/**
 * Decoded Graph calendar event collection.
 *
 * **Example** (Make empty event collection)
 *
 * ```ts
 * import { M365EventCollection } from "@beep/m365"
 *
 * const collection = M365EventCollection.make({ value: [] })
 * console.log(collection.value.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365EventCollection = GraphCollection(GraphEvent).pipe(
  $I.annoteSchema("M365EventCollection", {
    description: "Decoded Microsoft Graph calendar event collection envelope.",
  })
);

/**
 * Type for {@link M365EventCollection}.
 *
 * **Example** (Count event collection length)
 *
 * ```ts
 * import type { M365EventCollection } from "@beep/m365"
 *
 * const count = (collection: M365EventCollection) => collection.value.length
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365EventCollection = typeof M365EventCollection.Type;

/**
 * Request for listing drives visible to the signed-in user or a specific site.
 *
 * **Example** (Request drives for site)
 *
 * ```ts
 * import { M365ListDrivesRequest } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365ListDrivesRequest.make({ siteId: O.some("contoso,site,web") })
 * console.log(request.siteId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365ListDrivesRequest extends S.Class<M365ListDrivesRequest>($I`M365ListDrivesRequest`)(
  {
    siteId: S.OptionFromOptionalKey(GraphPathSegment).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Optional SharePoint composite site id; omitted to list the signed-in user's drives.",
    }),
  },
  $I.annote("M365ListDrivesRequest", {
    description: "Request for listing drives visible to the signed-in user or a specific site.",
  })
) {}

/**
 * Request for searching SharePoint sites.
 *
 * **Example** (Search sites by keyword)
 *
 * ```ts
 * import { M365ListSitesRequest } from "@beep/m365"
 *
 * const request = M365ListSitesRequest.make({ search: "legal" })
 * console.log(request.search)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365ListSitesRequest extends S.Class<M365ListSitesRequest>($I`M365ListSitesRequest`)(
  {
    search: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(ALL_SITES_SEARCH)),
      S.withDecodingDefaultTypeKey(Effect.succeed(ALL_SITES_SEARCH))
    ).annotateKey({
      description: "Optional search text; defaults to `*` because Graph v1.0 site listing is search-based.",
    }),
  },
  $I.annote("M365ListSitesRequest", {
    description: "Request for searching SharePoint sites.",
  })
) {}

/**
 * Request for reading one SharePoint site by id.
 *
 * **Example** (Get site by id)
 *
 * ```ts
 * import { M365GetSiteRequest } from "@beep/m365"
 *
 * const request = M365GetSiteRequest.make({ siteId: "contoso,site,web" })
 * console.log(request.siteId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365GetSiteRequest extends S.Class<M365GetSiteRequest>($I`M365GetSiteRequest`)(
  {
    siteId: GraphPathSegment.annotateKey({ description: "SharePoint composite site id." }),
  },
  $I.annote("M365GetSiteRequest", {
    description: "Request for reading one SharePoint site by id.",
  })
) {}

/**
 * Request for drive item delta enumeration.
 *
 * **Example** (Delta request by drive id)
 *
 * ```ts
 * import { M365DeltaDriveItemsRequest } from "@beep/m365"
 *
 * const request = M365DeltaDriveItemsRequest.make({ driveId: "drive-id" })
 * console.log(request.driveId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365DeltaDriveItemsRequest extends S.Class<M365DeltaDriveItemsRequest>($I`M365DeltaDriveItemsRequest`)(
  {
    deltaLink: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Optional Graph-provided delta continuation URL; must target the configured Graph v1.0 origin.",
    }),
    driveId: GraphPathSegment.annotateKey({
      description: "Drive id whose root delta feed is read when deltaLink is absent.",
    }),
  },
  $I.annote("M365DeltaDriveItemsRequest", {
    description: "Request for drive item delta enumeration.",
  })
) {}

/**
 * Request for downloading a drive item's content.
 *
 * **Example** (Download content request)
 *
 * ```ts
 * import { M365DownloadDriveItemContentRequest } from "@beep/m365"
 *
 * const request = M365DownloadDriveItemContentRequest.make({ driveId: "drive-id", itemId: "item-id" })
 * console.log(request.itemId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365DownloadDriveItemContentRequest extends S.Class<M365DownloadDriveItemContentRequest>(
  $I`M365DownloadDriveItemContentRequest`
)(
  {
    driveId: GraphPathSegment.annotateKey({ description: "Drive id containing the item." }),
    itemId: GraphPathSegment.annotateKey({ description: "Drive item id whose content should be downloaded." }),
  },
  $I.annote("M365DownloadDriveItemContentRequest", {
    description: "Request for downloading a drive item's content.",
  })
) {}

/**
 * Request for reading a SharePoint list item with expanded fields.
 *
 * **Example** (Get expanded list item)
 *
 * ```ts
 * import { M365GetListItemRequest } from "@beep/m365"
 *
 * const request = M365GetListItemRequest.make({ itemId: "7", listId: "list-id", siteId: "site-id" })
 * console.log(request.itemId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365GetListItemRequest extends S.Class<M365GetListItemRequest>($I`M365GetListItemRequest`)(
  {
    itemId: GraphPathSegment.annotateKey({ description: "List item id." }),
    listId: GraphPathSegment.annotateKey({ description: "SharePoint list id." }),
    siteId: GraphPathSegment.annotateKey({ description: "SharePoint composite site id." }),
  },
  $I.annote("M365GetListItemRequest", {
    description: "Request for reading a SharePoint list item with expanded fields.",
  })
) {}

/**
 * Request for listing a drive item's immutable versions.
 *
 * **Example** (List item versions request)
 *
 * ```ts
 * import { M365ListDriveItemVersionsRequest } from "@beep/m365"
 *
 * const request = M365ListDriveItemVersionsRequest.make({ driveId: "drive-id", itemId: "item-id" })
 * console.log(request.driveId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365ListDriveItemVersionsRequest extends S.Class<M365ListDriveItemVersionsRequest>(
  $I`M365ListDriveItemVersionsRequest`
)(
  {
    driveId: GraphPathSegment.annotateKey({ description: "Drive id containing the item." }),
    itemId: GraphPathSegment.annotateKey({ description: "Drive item id whose versions should be listed." }),
  },
  $I.annote("M365ListDriveItemVersionsRequest", {
    description: "Request for listing a drive item's immutable versions.",
  })
) {}

/**
 * Request for listing Outlook mail messages.
 *
 * **Example** (List messages with top)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { M365ListMessagesRequest } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const request = M365ListMessagesRequest.make({ top: O.some(PosInt.make(10)) })
 * console.log(request.top)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365ListMessagesRequest extends S.Class<M365ListMessagesRequest>($I`M365ListMessagesRequest`)(
  {
    bodyContentType: S.OptionFromOptionalKey(GraphBodyContentType)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Optional body format to ask Graph for (`text` strips HTML)." }),
    filter: S.OptionFromOptionalKey(S.String)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Optional Graph OData `$filter` query value." }),
    nextLink: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description:
        "Optional `@odata.nextLink` of the previous page; must target the configured Graph origin. When present, filter, orderby and top are ignored.",
    }),
    orderby: S.OptionFromOptionalKey(S.String)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Optional Graph OData `$orderby` query value." }),
    top: S.OptionFromOptionalKey(PosInt)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Optional Graph `$top` page size." }),
    userId: S.OptionFromOptionalKey(GraphPathSegment).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Optional user id/mailbox; omitted to read the signed-in user's messages.",
    }),
  },
  $I.annote("M365ListMessagesRequest", {
    description: "Request for listing Outlook mail messages.",
  })
) {}

/**
 * Request for reading one Outlook mail message.
 *
 * **Example** (Get message by id)
 *
 * ```ts
 * import { M365GetMessageRequest } from "@beep/m365"
 *
 * const request = M365GetMessageRequest.make({ messageId: "message-id" })
 * console.log(request.messageId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365GetMessageRequest extends S.Class<M365GetMessageRequest>($I`M365GetMessageRequest`)(
  {
    bodyContentType: S.OptionFromOptionalKey(GraphBodyContentType)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Optional body format to ask Graph for (`text` strips HTML)." }),
    messageId: GraphPathSegment.annotateKey({ description: "Graph message id." }),
    userId: S.OptionFromOptionalKey(GraphPathSegment).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Optional user id/mailbox; omitted to read the signed-in user's message.",
    }),
  },
  $I.annote("M365GetMessageRequest", {
    description: "Request for reading one Outlook mail message.",
  })
) {}

/**
 * Request for listing Outlook calendar events.
 *
 * **Example** (List events with top)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { M365ListEventsRequest } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const request = M365ListEventsRequest.make({ top: O.some(PosInt.make(10)) })
 * console.log(request.top)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365ListEventsRequest extends S.Class<M365ListEventsRequest>($I`M365ListEventsRequest`)(
  {
    top: S.OptionFromOptionalKey(PosInt)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Optional Graph `$top` page size." }),
    userId: S.OptionFromOptionalKey(GraphPathSegment).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Optional user id/mailbox; omitted to read the signed-in user's calendar events.",
    }),
  },
  $I.annote("M365ListEventsRequest", {
    description: "Request for listing Outlook calendar events.",
  })
) {}

/**
 * Request for reading one Outlook calendar event.
 *
 * **Example** (Get event by id)
 *
 * ```ts
 * import { M365GetEventRequest } from "@beep/m365"
 *
 * const request = M365GetEventRequest.make({ eventId: "event-id" })
 * console.log(request.eventId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365GetEventRequest extends S.Class<M365GetEventRequest>($I`M365GetEventRequest`)(
  {
    eventId: GraphPathSegment.annotateKey({ description: "Graph event id." }),
    userId: S.OptionFromOptionalKey(GraphPathSegment).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Optional user id/mailbox; omitted to read the signed-in user's calendar event.",
    }),
  },
  $I.annote("M365GetEventRequest", {
    description: "Request for reading one Outlook calendar event.",
  })
) {}

/**
 * Decoded Graph master-category collection.
 *
 * **Example** (Make empty category collection)
 *
 * ```ts
 * import { M365OutlookCategoryCollection } from "@beep/m365"
 *
 * const collection = M365OutlookCategoryCollection.make({ value: [] })
 * console.log(collection.value.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365OutlookCategoryCollection = GraphCollection(GraphOutlookCategory).pipe(
  $I.annoteSchema("M365OutlookCategoryCollection", {
    description: "Decoded Microsoft Graph Outlook master-category collection envelope.",
  })
);

/**
 * Type for {@link M365OutlookCategoryCollection}.
 *
 * **Example** (Count category collection length)
 *
 * ```ts
 * import type { M365OutlookCategoryCollection } from "@beep/m365"
 *
 * const count = (collection: M365OutlookCategoryCollection) => collection.value.length
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365OutlookCategoryCollection = typeof M365OutlookCategoryCollection.Type;

/**
 * Decoded Graph message-attachment metadata collection.
 *
 * **Example** (Make empty attachment collection)
 *
 * ```ts
 * import { M365AttachmentCollection } from "@beep/m365"
 *
 * const collection = M365AttachmentCollection.make({ value: [] })
 * console.log(collection.value.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365AttachmentCollection = GraphCollection(GraphAttachment).pipe(
  $I.annoteSchema("M365AttachmentCollection", {
    description: "Decoded Microsoft Graph message-attachment metadata collection envelope.",
  })
);

/**
 * Type for {@link M365AttachmentCollection}.
 *
 * **Example** (Count attachment collection length)
 *
 * ```ts
 * import type { M365AttachmentCollection } from "@beep/m365"
 *
 * const count = (collection: M365AttachmentCollection) => collection.value.length
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365AttachmentCollection = typeof M365AttachmentCollection.Type;

/**
 * Caller-supplied idempotency key for an event create.
 *
 * **Details**
 *
 * The key is written to the event twice: as Graph's `transactionId`, which
 * drops a retried create inside Graph's own short window, and as a
 * single-value extended property, which {@link M365FindEventsByIdempotencyKeyRequest}
 * can look up at any later time. The alphabet is restricted so the key can be
 * embedded in an OData filter without escaping.
 *
 * **Example** (Decode an idempotency key)
 *
 * ```ts
 * import { M365IdempotencyKey } from "@beep/m365"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(M365IdempotencyKey)("docket:3f9a1c2b7d")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365IdempotencyKey = S.String.check(
  S.isPattern(/^[A-Za-z0-9._:-]{8,128}$/, {
    message: "Idempotency keys are 8-128 characters of letters, digits, '.', '_', ':' or '-'.",
  })
).pipe(
  $I.annoteSchema("M365IdempotencyKey", {
    description: "Caller-supplied idempotency key stored on a created Outlook event.",
  })
);

/**
 * Type for {@link M365IdempotencyKey}.
 *
 * **Example** (Type an idempotency key)
 *
 * ```ts
 * import type { M365IdempotencyKey } from "@beep/m365"
 *
 * const length = (key: M365IdempotencyKey) => key.length
 * console.log(length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365IdempotencyKey = typeof M365IdempotencyKey.Type;

/**
 * Id of the single-value extended property that carries an event's
 * {@link M365IdempotencyKey}.
 *
 * **Example** (Read the property id)
 *
 * ```ts
 * import { M365_IDEMPOTENCY_KEY_PROPERTY_ID } from "@beep/m365"
 *
 * console.log(M365_IDEMPOTENCY_KEY_PROPERTY_ID)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const M365_IDEMPOTENCY_KEY_PROPERTY_ID =
  "String {6f1d2c1e-8a4b-4d5e-9c3f-2b7a1e0d4c59} Name BeepIdempotencyKey" as const;

/**
 * Body written to an Outlook event.
 *
 * **Example** (Make a text body)
 *
 * ```ts
 * import { M365EventBody } from "@beep/m365"
 *
 * const body = M365EventBody.make({ content: "Review the source document.", contentType: "text" })
 * console.log(body.contentType) // "text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365EventBody extends S.Class<M365EventBody>($I`M365EventBody`)(
  {
    content: S.String.annotateKey({ description: "Body content (never logged in spans)." }),
    contentType: GraphBodyContentType.annotateKey({ description: "Body content type." }),
  },
  $I.annote("M365EventBody", { description: "Body written to an Outlook event." })
) {}

/**
 * Wall-clock date-time and time zone written to an Outlook event.
 *
 * **Example** (Make an event date-time)
 *
 * ```ts
 * import { M365EventDateTime } from "@beep/m365"
 *
 * const start = M365EventDateTime.make({ dateTime: "2030-01-15T00:00:00", timeZone: "UTC" })
 * console.log(start.timeZone) // "UTC"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365EventDateTime extends S.Class<M365EventDateTime>($I`M365EventDateTime`)(
  {
    dateTime: S.NonEmptyString.annotateKey({ description: "ISO-8601 local date-time without offset." }),
    timeZone: S.NonEmptyString.annotateKey({ description: "IANA or Windows time-zone name." }),
  },
  $I.annote("M365EventDateTime", { description: "Wall-clock date-time and zone written to an Outlook event." })
) {}

type M365AllDayWindow = { readonly end: M365EventDateTime; readonly start: M365EventDateTime };

/**
 * Start and end of an all-day event on one calendar date.
 *
 * **Details**
 *
 * Graph requires an all-day event to start and end at midnight in the same
 * time zone, with the end on the following day.
 *
 * **Example** (All-day window)
 *
 * ```ts
 * import { m365AllDayWindow } from "@beep/m365"
 * import { LocalDate } from "@beep/schema/LocalDate"
 *
 * const window = m365AllDayWindow(LocalDate.make({ year: 2030, month: 1, day: 31 }), "UTC")
 * console.log(window.end.dateTime) // "2030-02-01T00:00:00"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const m365AllDayWindow: {
  (timeZone: string): (date: LocalDate) => M365AllDayWindow;
  (date: LocalDate, timeZone: string): M365AllDayWindow;
} = dual(
  2,
  (date: LocalDate, timeZone: string): M365AllDayWindow => ({
    end: M365EventDateTime.make({ dateTime: `${addDays(date, 1).toISOString()}T00:00:00`, timeZone }),
    start: M365EventDateTime.make({ dateTime: `${date.toISOString()}T00:00:00`, timeZone }),
  })
);

const eventOpt = <Sch extends S.Top>(schema: Sch, description: string) =>
  S.OptionFromOptionalKey(schema).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({ description });

/**
 * Fields of a new Outlook event.
 *
 * **Example** (Draft an all-day tentative event)
 *
 * ```ts
 * import { m365AllDayWindow, M365EventDraft } from "@beep/m365"
 * import { LocalDate } from "@beep/schema/LocalDate"
 * import * as O from "effect/Option"
 *
 * const draft = M365EventDraft.make({
 *   ...m365AllDayWindow(LocalDate.make({ year: 2030, month: 1, day: 15 }), "UTC"),
 *   categories: ["Docket - unverified"],
 *   isAllDay: true,
 *   showAs: O.some("tentative"),
 *   subject: "Response due"
 * })
 * console.log(draft.isAllDay) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365EventDraft extends S.Class<M365EventDraft>($I`M365EventDraft`)(
  {
    subject: S.NonEmptyString.annotateKey({ description: "Event subject (never logged in spans)." }),
    start: M365EventDateTime.annotateKey({ description: "Event start." }),
    end: M365EventDateTime.annotateKey({ description: "Event end; the following midnight for an all-day event." }),
    isAllDay: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ).annotateKey({ description: "Whether the event spans whole days." }),
    categories: S.Array(S.NonEmptyString)
      .pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultTypeKey(Effect.succeed([])))
      .annotateKey({ description: "Outlook category display names to apply." }),
    body: eventOpt(M365EventBody, "Event body."),
    isReminderOn: eventOpt(S.Boolean, "Whether a reminder alert is set."),
    reminderMinutesBeforeStart: eventOpt(S.Natural, "Minutes before the start at which the reminder fires."),
    showAs: eventOpt(GraphEventShowAs, "Free/busy status to show."),
  },
  $I.annote("M365EventDraft", { description: "Fields of a new Outlook event." })
) {}

/**
 * Fields to change on an existing Outlook event; absent fields are left as
 * they are.
 *
 * **Gotchas**
 *
 * `categories` replaces the event's whole category list. Read the event first
 * and keep every category the caller did not add.
 *
 * **Example** (Patch the subject)
 *
 * ```ts
 * import { M365EventPatch } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const patch = M365EventPatch.make({ subject: O.some("Response due (confirmed)") })
 * console.log(O.isSome(patch.subject)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365EventPatch extends S.Class<M365EventPatch>($I`M365EventPatch`)(
  {
    body: eventOpt(M365EventBody, "Replacement event body."),
    categories: eventOpt(S.Array(S.NonEmptyString), "Replacement for the whole category list."),
    end: eventOpt(M365EventDateTime, "Replacement event end."),
    isAllDay: eventOpt(S.Boolean, "Whether the event spans whole days."),
    isReminderOn: eventOpt(S.Boolean, "Whether a reminder alert is set."),
    reminderMinutesBeforeStart: eventOpt(S.Natural, "Minutes before the start at which the reminder fires."),
    showAs: eventOpt(GraphEventShowAs, "Free/busy status to show."),
    start: eventOpt(M365EventDateTime, "Replacement event start."),
    subject: eventOpt(S.NonEmptyString, "Replacement event subject."),
  },
  $I.annote("M365EventPatch", { description: "Fields to change on an existing Outlook event." })
) {}

const mailboxUserId = (description: string) =>
  S.OptionFromOptionalKey(GraphPathSegment).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
    description,
  });

/**
 * Request for creating an Outlook calendar event in the default calendar.
 *
 * **Details**
 *
 * The create is not replayed after an ambiguous failure. Supply an
 * `idempotencyKey`, and on an `"ambiguous write"` error look the key up with
 * `findEventsByIdempotencyKey` before deciding to create again.
 *
 * **Example** (Create event request)
 *
 * ```ts
 * import { M365CreateEventRequest, M365EventDateTime, M365EventDraft } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365CreateEventRequest.make({
 *   event: M365EventDraft.make({
 *     end: M365EventDateTime.make({ dateTime: "2030-01-16T00:00:00", timeZone: "UTC" }),
 *     isAllDay: true,
 *     start: M365EventDateTime.make({ dateTime: "2030-01-15T00:00:00", timeZone: "UTC" }),
 *     subject: "Response due"
 *   }),
 *   idempotencyKey: O.some("docket:3f9a1c2b7d"),
 *   userId: O.some("mailbox-id")
 * })
 * console.log(request.event.subject)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365CreateEventRequest extends S.Class<M365CreateEventRequest>($I`M365CreateEventRequest`)(
  {
    event: M365EventDraft.annotateKey({ description: "Fields of the event to create." }),
    idempotencyKey: S.OptionFromOptionalKey(M365IdempotencyKey)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Optional key stored on the event for retry de-duplication and later lookup." }),
    userId: mailboxUserId("Mailbox user id or address; required on the app-only lane."),
  },
  $I.annote("M365CreateEventRequest", { description: "Request for creating an Outlook calendar event." })
) {}

/**
 * Request for updating fields of an Outlook calendar event.
 *
 * **Example** (Update event request)
 *
 * ```ts
 * import { M365EventPatch, M365UpdateEventRequest } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365UpdateEventRequest.make({
 *   eventId: "event-id",
 *   patch: M365EventPatch.make({ subject: O.some("Response due") }),
 *   userId: O.some("mailbox-id")
 * })
 * console.log(request.eventId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365UpdateEventRequest extends S.Class<M365UpdateEventRequest>($I`M365UpdateEventRequest`)(
  {
    eventId: GraphPathSegment.annotateKey({ description: "Graph event id." }),
    patch: M365EventPatch.annotateKey({ description: "Fields to change." }),
    userId: mailboxUserId("Mailbox user id or address; required on the app-only lane."),
  },
  $I.annote("M365UpdateEventRequest", { description: "Request for updating an Outlook calendar event." })
) {}

/**
 * Request for deleting an Outlook calendar event (Outlook moves it to Deleted
 * Items).
 *
 * **Example** (Delete event request)
 *
 * ```ts
 * import { M365DeleteEventRequest } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365DeleteEventRequest.make({ eventId: "event-id", userId: O.some("mailbox-id") })
 * console.log(request.eventId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365DeleteEventRequest extends S.Class<M365DeleteEventRequest>($I`M365DeleteEventRequest`)(
  {
    eventId: GraphPathSegment.annotateKey({ description: "Graph event id." }),
    userId: mailboxUserId("Mailbox user id or address; required on the app-only lane."),
  },
  $I.annote("M365DeleteEventRequest", { description: "Request for deleting an Outlook calendar event." })
) {}

/**
 * Request for finding the events that carry an {@link M365IdempotencyKey}.
 *
 * **Example** (Find events by key)
 *
 * ```ts
 * import { M365FindEventsByIdempotencyKeyRequest } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365FindEventsByIdempotencyKeyRequest.make({
 *   idempotencyKey: "docket:3f9a1c2b7d",
 *   userId: O.some("mailbox-id")
 * })
 * console.log(request.idempotencyKey)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365FindEventsByIdempotencyKeyRequest extends S.Class<M365FindEventsByIdempotencyKeyRequest>(
  $I`M365FindEventsByIdempotencyKeyRequest`
)(
  {
    idempotencyKey: M365IdempotencyKey.annotateKey({ description: "Key the events were created with." }),
    userId: mailboxUserId("Mailbox user id or address; required on the app-only lane."),
  },
  $I.annote("M365FindEventsByIdempotencyKeyRequest", {
    description: "Request for finding Outlook events by their stored idempotency key.",
  })
) {}

/**
 * Request for listing a mailbox's Outlook master categories.
 *
 * **Example** (List master categories)
 *
 * ```ts
 * import { M365ListMasterCategoriesRequest } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365ListMasterCategoriesRequest.make({ userId: O.some("mailbox-id") })
 * console.log(request.userId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365ListMasterCategoriesRequest extends S.Class<M365ListMasterCategoriesRequest>(
  $I`M365ListMasterCategoriesRequest`
)(
  {
    userId: mailboxUserId("Mailbox user id or address; required on the app-only lane."),
  },
  $I.annote("M365ListMasterCategoriesRequest", {
    description: "Request for listing a mailbox's Outlook master categories.",
  })
) {}

/**
 * A master category to create: its name and preset color.
 *
 * **Example** (Describe a category)
 *
 * ```ts
 * import { M365MasterCategoryDraft } from "@beep/m365"
 *
 * const draft = M365MasterCategoryDraft.make({ color: "preset0", displayName: "Docket - unverified" })
 * console.log(draft.color) // "preset0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365MasterCategoryDraft extends S.Class<M365MasterCategoryDraft>($I`M365MasterCategoryDraft`)(
  {
    color: GraphCategoryColor.pipe(
      S.withConstructorDefault(Effect.succeed("none" as const)),
      S.withDecodingDefaultTypeKey(Effect.succeed("none" as const))
    ).annotateKey({ description: "Preset color; defaults to `none`." }),
    displayName: S.NonEmptyString.annotateKey({ description: "Category name; unique in the mailbox." }),
  },
  $I.annote("M365MasterCategoryDraft", { description: "A master category to create." })
) {}

/**
 * Request for creating one Outlook master category.
 *
 * **Example** (Create master category)
 *
 * ```ts
 * import { M365CreateMasterCategoryRequest, M365MasterCategoryDraft } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365CreateMasterCategoryRequest.make({
 *   category: M365MasterCategoryDraft.make({ displayName: "Docket - unverified" }),
 *   userId: O.some("mailbox-id")
 * })
 * console.log(request.category.displayName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365CreateMasterCategoryRequest extends S.Class<M365CreateMasterCategoryRequest>(
  $I`M365CreateMasterCategoryRequest`
)(
  {
    category: M365MasterCategoryDraft.annotateKey({ description: "The category to create." }),
    userId: mailboxUserId("Mailbox user id or address; required on the app-only lane."),
  },
  $I.annote("M365CreateMasterCategoryRequest", {
    description: "Request for creating one Outlook master category.",
  })
) {}

/**
 * Request for making sure a set of master categories exists, creating only
 * the missing ones. Existing categories are never changed or removed.
 *
 * **Example** (Ensure master categories)
 *
 * ```ts
 * import { M365EnsureMasterCategoriesRequest, M365MasterCategoryDraft } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365EnsureMasterCategoriesRequest.make({
 *   categories: [M365MasterCategoryDraft.make({ displayName: "Docket - unverified" })],
 *   userId: O.some("mailbox-id")
 * })
 * console.log(request.categories.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365EnsureMasterCategoriesRequest extends S.Class<M365EnsureMasterCategoriesRequest>(
  $I`M365EnsureMasterCategoriesRequest`
)(
  {
    categories: S.Array(M365MasterCategoryDraft).annotateKey({ description: "Categories that must exist." }),
    userId: mailboxUserId("Mailbox user id or address; required on the app-only lane."),
  },
  $I.annote("M365EnsureMasterCategoriesRequest", {
    description: "Request for ensuring a set of Outlook master categories exists.",
  })
) {}

/**
 * Result of {@link M365EnsureMasterCategoriesRequest}: which requested
 * categories were already present and which were created.
 *
 * **Example** (Make an ensure result)
 *
 * ```ts
 * import { M365EnsuredMasterCategories } from "@beep/m365"
 *
 * const result = M365EnsuredMasterCategories.make({ created: [], existing: [] })
 * console.log(result.created.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365EnsuredMasterCategories extends S.Class<M365EnsuredMasterCategories>($I`M365EnsuredMasterCategories`)(
  {
    created: S.Array(GraphOutlookCategory).annotateKey({ description: "Categories this call created." }),
    existing: S.Array(S.String).annotateKey({
      description: "Requested display names that were already present (or created concurrently).",
    }),
  },
  $I.annote("M365EnsuredMasterCategories", {
    description: "Result of ensuring a set of Outlook master categories exists.",
  })
) {}

/**
 * Request for replacing the category list of one mail message.
 *
 * **Gotchas**
 *
 * `categories` replaces the whole list. Read the message first and keep every
 * category the caller did not add. Supplying the `changeKey` that read
 * returned makes the write conditional: Graph rejects it with HTTP 412 when
 * the message changed in between.
 *
 * **Example** (Update message categories)
 *
 * ```ts
 * import { M365UpdateMessageCategoriesRequest } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365UpdateMessageCategoriesRequest.make({
 *   categories: ["Docket - entered"],
 *   messageId: "message-id",
 *   userId: O.some("mailbox-id")
 * })
 * console.log(request.categories.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365UpdateMessageCategoriesRequest extends S.Class<M365UpdateMessageCategoriesRequest>(
  $I`M365UpdateMessageCategoriesRequest`
)(
  {
    categories: S.Array(S.NonEmptyString).annotateKey({ description: "The complete new category list." }),
    changeKey: S.OptionFromOptionalKey(S.NonEmptyString)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Optional change key from the last read; sent as `If-Match`." }),
    messageId: GraphPathSegment.annotateKey({ description: "Graph message id." }),
    userId: mailboxUserId("Mailbox user id or address; required on the app-only lane."),
  },
  $I.annote("M365UpdateMessageCategoriesRequest", {
    description: "Request for replacing the category list of one mail message.",
  })
) {}

/**
 * Request for listing a message's attachment metadata (no bytes).
 *
 * **Example** (List attachments)
 *
 * ```ts
 * import { M365ListMessageAttachmentsRequest } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365ListMessageAttachmentsRequest.make({ messageId: "message-id", userId: O.some("mailbox-id") })
 * console.log(request.messageId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365ListMessageAttachmentsRequest extends S.Class<M365ListMessageAttachmentsRequest>(
  $I`M365ListMessageAttachmentsRequest`
)(
  {
    messageId: GraphPathSegment.annotateKey({ description: "Graph message id." }),
    userId: mailboxUserId("Mailbox user id or address; required on the app-only lane."),
  },
  $I.annote("M365ListMessageAttachmentsRequest", {
    description: "Request for listing a message's attachment metadata.",
  })
) {}

/**
 * Request for downloading the raw bytes of one file attachment.
 *
 * **Example** (Download an attachment)
 *
 * ```ts
 * import { M365DownloadMessageAttachmentRequest } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const request = M365DownloadMessageAttachmentRequest.make({
 *   attachmentId: "attachment-id",
 *   messageId: "message-id",
 *   userId: O.some("mailbox-id")
 * })
 * console.log(request.attachmentId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365DownloadMessageAttachmentRequest extends S.Class<M365DownloadMessageAttachmentRequest>(
  $I`M365DownloadMessageAttachmentRequest`
)(
  {
    attachmentId: GraphPathSegment.annotateKey({ description: "Graph attachment id." }),
    messageId: GraphPathSegment.annotateKey({ description: "Graph message id." }),
    userId: mailboxUserId("Mailbox user id or address; required on the app-only lane."),
  },
  $I.annote("M365DownloadMessageAttachmentRequest", {
    description: "Request for downloading the raw bytes of one file attachment.",
  })
) {}

/**
 * Raw bytes of a downloaded message attachment.
 *
 * **Example** (Construct attachment content)
 *
 * ```ts
 * import { M365AttachmentContent } from "@beep/m365"
 *
 * const content = M365AttachmentContent.make({ bytes: new Uint8Array([1, 2, 3]) })
 * console.log(content.bytes.byteLength) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365AttachmentContent extends S.Class<M365AttachmentContent>($I`M365AttachmentContent`)(
  {
    bytes: S.Uint8Array.annotateKey({ description: "Attachment bytes (never logged)." }),
  },
  $I.annote("M365AttachmentContent", { description: "Raw bytes of a downloaded message attachment." })
) {}

/**
 * Successfully downloaded drive item content.
 *
 * **Example** (Construct downloaded content)
 *
 * ```ts
 * import { GraphDriveItem, M365DownloadedContent } from "@beep/m365"
 *
 * const result = new M365DownloadedContent({
 *   bytes: new Uint8Array([1, 2, 3]),
 *   item: GraphDriveItem.make({ id: "item-id" })
 * })
 * console.log(result.bytes.byteLength)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365DownloadedContent extends S.TaggedClass<M365DownloadedContent>($I`M365DownloadedContent`)(
  "M365DownloadedContent",
  {
    bytes: S.Uint8Array.annotateKey({ description: "Downloaded file bytes." }),
    item: GraphDriveItem.annotateKey({ description: "Graph driveItem metadata for the downloaded content." }),
  },
  $I.annote("M365DownloadedContent", {
    description: "Successfully downloaded drive item content.",
  })
) {}

/**
 * Drive item content skipped because it appears protected/encrypted.
 *
 * **Details**
 *
 * Graph `v1.0` does not expose a complete Purview/RMS decrypted-content signal.
 * v1 uses protected file extension heuristics (`.pfile`, `.ppdf`, `.pdocx`,
 * etc.) and intentionally avoids tenant-wide decrypt grants.
 *
 * **Example** (Skipped encrypted item result)
 *
 * ```ts
 * import { GraphDriveItem, M365SkippedEncryptedItem } from "@beep/m365"
 *
 * const result = new M365SkippedEncryptedItem({
 *   item: GraphDriveItem.make({ id: "item-id" }),
 *   reason: "protected extension"
 * })
 * console.log(result.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M365SkippedEncryptedItem extends S.TaggedClass<M365SkippedEncryptedItem>($I`M365SkippedEncryptedItem`)(
  "M365SkippedEncryptedItem",
  {
    item: GraphDriveItem.annotateKey({ description: "Graph driveItem metadata for the skipped item." }),
    reason: S.String.annotateKey({ description: "Sanitized skip reason; never file content." }),
  },
  $I.annote("M365SkippedEncryptedItem", {
    description: "Drive item content skipped because it appears protected or encrypted.",
  })
) {}

/**
 * Download result for a drive item.
 *
 * **Example** (Read download result tag)
 *
 * ```ts
 * import { M365DriveItemDownload, M365DownloadedContent } from "@beep/m365"
 *
 * const tag = (download: M365DriveItemDownload) => download._tag
 * console.log(tag)
 * console.log(M365DownloadedContent)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const M365DriveItemDownload = S.Union([M365DownloadedContent, M365SkippedEncryptedItem]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("M365DriveItemDownload", {
    description: "Download result for a drive item, including protected/encrypted skips.",
  })
);

/**
 * Type for {@link M365DriveItemDownload}.
 *
 * **Example** (Type download result tag)
 *
 * ```ts
 * import type { M365DriveItemDownload } from "@beep/m365"
 *
 * const tag = (download: M365DriveItemDownload) => download._tag
 * console.log(tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type M365DriveItemDownload = typeof M365DriveItemDownload.Type;

/**
 * Public Microsoft 365 driver service shape.
 *
 * **Example** (Keyof service method names)
 *
 * ```ts
 * import type { M365Shape } from "@beep/m365"
 *
 * type MethodName = keyof M365Shape
 * const method: MethodName = "listDrives"
 * console.log(method)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type M365Shape = {
  readonly createEvent: (request: M365CreateEventRequest) => Effect.Effect<GraphEvent, M365Error>;
  readonly createMasterCategory: (
    request: M365CreateMasterCategoryRequest
  ) => Effect.Effect<GraphOutlookCategory, M365Error>;
  readonly deleteEvent: (request: M365DeleteEventRequest) => Effect.Effect<void, M365Error>;
  readonly deltaDriveItems: (request: M365DeltaDriveItemsRequest) => Effect.Effect<M365DriveItemCollection, M365Error>;
  readonly downloadDriveItemContent: (
    request: M365DownloadDriveItemContentRequest
  ) => Effect.Effect<M365DriveItemDownload, M365Error>;
  readonly downloadMessageAttachment: (
    request: M365DownloadMessageAttachmentRequest
  ) => Effect.Effect<M365AttachmentContent, M365Error>;
  readonly ensureMasterCategories: (
    request: M365EnsureMasterCategoriesRequest
  ) => Effect.Effect<M365EnsuredMasterCategories, M365Error>;
  readonly findEventsByIdempotencyKey: (
    request: M365FindEventsByIdempotencyKeyRequest
  ) => Effect.Effect<M365EventCollection, M365Error>;
  readonly getEvent: (request: M365GetEventRequest) => Effect.Effect<GraphEvent, M365Error>;
  readonly getListItem: (request: M365GetListItemRequest) => Effect.Effect<GraphListItem, M365Error>;
  readonly getMessage: (request: M365GetMessageRequest) => Effect.Effect<GraphMessage, M365Error>;
  readonly getSite: (request: M365GetSiteRequest) => Effect.Effect<GraphSite, M365Error>;
  readonly listDriveItemVersions: (
    request: M365ListDriveItemVersionsRequest
  ) => Effect.Effect<M365DriveItemVersionCollection, M365Error>;
  readonly listDrives: (request: M365ListDrivesRequest) => Effect.Effect<M365DriveCollection, M365Error>;
  readonly listEvents: (request: M365ListEventsRequest) => Effect.Effect<M365EventCollection, M365Error>;
  readonly listMasterCategories: (
    request: M365ListMasterCategoriesRequest
  ) => Effect.Effect<M365OutlookCategoryCollection, M365Error>;
  readonly listMessageAttachments: (
    request: M365ListMessageAttachmentsRequest
  ) => Effect.Effect<M365AttachmentCollection, M365Error>;
  readonly listMessages: (request: M365ListMessagesRequest) => Effect.Effect<M365MessageCollection, M365Error>;
  readonly listSites: (request: M365ListSitesRequest) => Effect.Effect<M365SiteCollection, M365Error>;
  readonly updateEvent: (request: M365UpdateEventRequest) => Effect.Effect<GraphEvent, M365Error>;
  readonly updateMessageCategories: (
    request: M365UpdateMessageCategoriesRequest
  ) => Effect.Effect<GraphMessage, M365Error>;
};

// Decode a request schema at the M365 boundary, translating any decode failure into the
// uniform "request encoding" M365Error for the given resource (was 11 identical consts + pipes).
const decodeRequest = <Sch extends S.Top>(schema: Sch, resource: string) => {
  const isDecodedRequest = S.is(schema);

  return (rawRequest: unknown): Effect.Effect<Sch["Type"], M365Error, Sch["DecodingServices"]> =>
    isDecodedRequest(rawRequest)
      ? Effect.succeed(rawRequest)
      : S.decodeEffect(schema)(rawRequest).pipe(
          Effect.mapError((cause) => M365Error.fromReason("request encoding", { cause, resource }))
        );
};

const queryString = (params: ReadonlyArray<QueryParam>): string => {
  const pairs = pipe(
    params,
    A.map((param) =>
      pipe(
        param[1],
        O.map((value) => `${param[0]}=${encodeURIComponent(`${value}`)}`)
      )
    ),
    A.getSomes
  );

  return A.length(pairs) === 0 ? "" : `?${A.join(pairs, "&")}`;
};

const graphUrl = (config: M365ServiceConfig, path: string, params: ReadonlyArray<QueryParam> = []): string =>
  `${config.graphBaseUrl}${path}${queryString(params)}`;

type RequestHeaders = Readonly<Record<string, string>>;

const NO_HEADERS: RequestHeaders = {};

const signedJsonGet = Effect.fnUntraced(function* (
  auth: M365AuthShape,
  url: string,
  headers: RequestHeaders = NO_HEADERS
): Effect.fn.Return<HttpClientRequest.HttpClientRequest, M365Error> {
  const token = yield* auth.acquireToken;
  return pipe(
    HttpClientRequest.get(url),
    HttpClientRequest.bearerToken(token),
    HttpClientRequest.accept(REQUEST_ACCEPT),
    HttpClientRequest.setHeaders(headers)
  );
});

// Raw content routes (`/$value`) answer with the stored media type, so no JSON `Accept` is sent.
const signedBytesGet = Effect.fnUntraced(function* (
  auth: M365AuthShape,
  url: string
): Effect.fn.Return<HttpClientRequest.HttpClientRequest, M365Error> {
  const token = yield* auth.acquireToken;
  return pipe(HttpClientRequest.get(url), HttpClientRequest.bearerToken(token));
});

const M365WriteMethod = LiteralKit(["POST", "PATCH", "DELETE"]).pipe(
  $I.annoteSchema("M365WriteMethod", {
    description: "HTTP methods the Microsoft 365 driver uses for mailbox writes.",
  })
);
type M365WriteMethod = typeof M365WriteMethod.Type;

class M365WriteCall extends S.Class<M365WriteCall>($I`M365WriteCall`)(
  {
    body: S.Option(S.Unknown),
    headers: S.Record(S.String, S.String),
    method: M365WriteMethod,
    resource: S.String,
    url: S.String,
  },
  $I.annote("M365WriteCall", {
    description: "One encoded Microsoft Graph write: method, URL, extra headers and optional JSON body.",
  })
) {}

const signedWrite = Effect.fnUntraced(function* (
  auth: M365AuthShape,
  call: M365WriteCall
): Effect.fn.Return<HttpClientRequest.HttpClientRequest, M365Error> {
  const token = yield* auth.acquireToken;
  const request = pipe(
    HttpClientRequest.make(call.method)(call.url),
    HttpClientRequest.bearerToken(token),
    HttpClientRequest.accept(REQUEST_ACCEPT),
    HttpClientRequest.setHeaders(call.headers)
  );
  return yield* pipe(
    call.body,
    O.match({
      onNone: () => Effect.succeed(request),
      onSome: (body) =>
        HttpClientRequest.bodyJson(request, body).pipe(
          Effect.mapError((cause) =>
            M365Error.fromReason("request encoding", { cause, resource: call.resource, url: call.url })
          )
        ),
    })
  );
});

const unsignedGet = (url: string): Effect.Effect<HttpClientRequest.HttpClientRequest, M365Error> =>
  Effect.succeed(HttpClientRequest.get(url));

const retryAfterSeconds = (response: HttpClientResponse.HttpClientResponse): O.Option<number> =>
  pipe(
    O.fromUndefinedOr(response.headers["retry-after"]),
    O.flatMap((value) => {
      const seconds = Number.parseInt(value, 10);
      return Number.isFinite(seconds) && seconds >= 0 ? O.some(seconds) : O.none<number>();
    })
  );

const ensureSuccess = Effect.fnUntraced(function* (
  response: HttpClientResponse.HttpClientResponse,
  resource: string,
  url: string
): Effect.fn.Return<HttpClientResponse.HttpClientResponse, M365Error> {
  if (response.status >= 200 && response.status < 300) {
    return response;
  }

  if (response.status === 429 || response.status === 503) {
    const retryAfter = retryAfterSeconds(response);
    return yield* M365Error.fromReason("throttled", {
      resource,
      status: response.status,
      url,
      ...getSomesStruct({ retryAfterSeconds: retryAfter }),
    });
  }

  return yield* M365Error.fromReason("response status", { resource, status: response.status, url });
});

const isThrottled = (error: M365Error): boolean => error.reason === "throttled";

// A 429 is an explicit refusal, so replaying a create after it is safe. A 503 or a
// transport failure leaves the outcome of a create unknown.
const isRejectedBeforeProcessing = (error: M365Error): boolean => isThrottled(error) && O.contains(error.status, 429);

const executeWithRetry = Effect.fnUntraced(function* (
  client: HttpClient.HttpClient,
  makeRequest: Effect.Effect<HttpClientRequest.HttpClientRequest, M365Error>,
  resource: string,
  url: string,
  remaining: number,
  isRetryable: (error: M365Error) => boolean = isThrottled
): Effect.fn.Return<HttpClientResponse.HttpClientResponse, M365Error> {
  const request = yield* makeRequest;
  const response = yield* client
    .execute(request)
    .pipe(Effect.mapError((cause) => M365Error.fromReason("transport", { cause, resource, url })));

  return yield* ensureSuccess(response, resource, url).pipe(
    Effect.catchIf(
      (error) => isRetryable(error) && remaining > 0,
      (error) =>
        Effect.sleep(
          Duration.seconds(
            pipe(
              error.retryAfterSeconds,
              O.getOrElse(() => DEFAULT_THROTTLE_RETRY_AFTER_SECONDS)
            )
          )
        ).pipe(Effect.flatMap(() => executeWithRetry(client, makeRequest, resource, url, remaining - 1, isRetryable)))
    )
  );
});

const decodeJsonResponse = Effect.fnUntraced(function* <Schema extends S.Top>(
  response: HttpClientResponse.HttpClientResponse,
  schema: Schema,
  resource: string,
  url: string
): Effect.fn.Return<Schema["Type"], M365Error, Schema["DecodingServices"]> {
  const body = yield* response.json.pipe(
    Effect.mapError((cause) =>
      M365Error.fromReason("response decoding", { cause, resource, status: response.status, url })
    )
  );
  return yield* S.decodeEffect(schema)(body).pipe(
    Effect.mapError((cause) =>
      M365Error.fromReason("response decoding", { cause, resource, status: response.status, url })
    )
  );
});

const isAmbiguousCreateFailure = (error: M365Error): boolean =>
  error.reason === "transport" || (isThrottled(error) && !isRejectedBeforeProcessing(error));

const executeWrite = Effect.fnUntraced(function* (
  runtime: M365Runtime,
  call: M365WriteCall
): Effect.fn.Return<HttpClientResponse.HttpClientResponse, M365Error> {
  yield* Effect.annotateCurrentSpan({
    m365_method: call.method,
    m365_resource: call.resource,
  });
  const execute = (isRetryable: (error: M365Error) => boolean) =>
    executeWithRetry(
      runtime.client,
      signedWrite(runtime.auth, call),
      call.resource,
      call.url,
      runtime.config.maxRetries,
      isRetryable
    );

  // PATCH and DELETE set a final state, so replaying them is harmless. A POST creates:
  // when its outcome is unknown the caller must reconcile before creating again.
  return yield* M365WriteMethod.is.POST(call.method)
    ? execute(isRejectedBeforeProcessing).pipe(
        Effect.mapError((error) =>
          isAmbiguousCreateFailure(error)
            ? M365Error.fromReason("ambiguous write", {
                cause: error,
                resource: call.resource,
                url: call.url,
                ...getSomesStruct({ status: error.status }),
              })
            : error
        )
      )
    : execute(isThrottled);
});

const executeJsonWrite = Effect.fnUntraced(function* <Schema extends S.Top>(
  runtime: M365Runtime,
  call: M365WriteCall,
  schema: Schema
): Effect.fn.Return<Schema["Type"], M365Error, Schema["DecodingServices"]> {
  const response = yield* executeWrite(runtime, call);
  return yield* decodeJsonResponse(response, schema, call.resource, call.url);
});

const executeJson = Effect.fnUntraced(function* <Schema extends S.Top>(
  runtime: M365Runtime,
  url: string,
  schema: Schema,
  resource: string,
  headers: RequestHeaders = NO_HEADERS
): Effect.fn.Return<Schema["Type"], M365Error, Schema["DecodingServices"]> {
  yield* Effect.annotateCurrentSpan({
    m365_resource: resource,
  });
  const response = yield* executeWithRetry(
    runtime.client,
    signedJsonGet(runtime.auth, url, headers),
    resource,
    url,
    runtime.config.maxRetries
  );
  return yield* decodeJsonResponse(response, schema, resource, url);
});

const executeBytes = Effect.fnUntraced(function* (
  runtime: M365Runtime,
  url: string,
  resource: string,
  makeRequest: Effect.Effect<HttpClientRequest.HttpClientRequest, M365Error> = unsignedGet(url)
): Effect.fn.Return<Uint8Array, M365Error> {
  const response = yield* executeWithRetry(runtime.client, makeRequest, resource, url, runtime.config.maxRetries);
  const buffer = yield* response.arrayBuffer.pipe(
    Effect.mapError((cause) =>
      M365Error.fromReason("response decoding", { cause, resource, status: response.status, url })
    )
  );
  const bytes = new Uint8Array(buffer);
  yield* Effect.annotateCurrentSpan({
    m365_download_size_bytes: bytes.byteLength,
  });
  return bytes;
});

const annotateCollectionCount = Effect.fnUntraced(function* <
  Collection extends { readonly value: ReadonlyArray<unknown> },
>(collection: Collection): Effect.fn.Return<Collection> {
  yield* Effect.annotateCurrentSpan({
    m365_result_count: A.length(collection.value),
  });
  return collection;
});

const protectedByExtension = (item: GraphDriveItem): boolean =>
  pipe(
    item.name,
    O.exists((name) => {
      const lower = Str.toLowerCase(name);
      return A.some(PROTECTED_EXTENSIONS, (extension) => Str.endsWith(extension)(lower));
    })
  );

const driveItemDownloadUrl = (item: GraphDriveItem, resource: string, url: string): Effect.Effect<string, M365Error> =>
  pipe(
    item["@microsoft.graph.downloadUrl"],
    O.match({
      onNone: () =>
        M365Error.failEffectFromReason("response decoding", {
          itemId: item.id,
          resource,
          url,
        }),
      onSome: Effect.succeed,
    })
  );

const isTrustedGraphLink = (
  config: M365ServiceConfig,
  link: string,
  resource: string
): Effect.Effect<boolean, M365Error> =>
  Effect.try({
    try: () => {
      const base = new URL(config.graphBaseUrl);
      const candidate = new URL(link);
      const basePathWithBoundary = Str.endsWith("/")(base.pathname) ? base.pathname : `${base.pathname}/`;

      return (
        candidate.origin === base.origin &&
        (candidate.pathname === base.pathname || Str.startsWith(basePathWithBoundary)(candidate.pathname))
      );
    },
    catch: (cause) => M365Error.fromReason("request encoding", { cause, resource, url: link }),
  });

const trustedGraphLink = (
  config: M365ServiceConfig,
  link: string,
  resource: string
): Effect.Effect<string, M365Error> =>
  pipe(
    isTrustedGraphLink(config, link, resource),
    Effect.flatMap((isTrusted) =>
      isTrusted ? Effect.succeed(link) : M365Error.failEffectFromReason("request encoding", { resource, url: link })
    )
  );

const deltaUrl = (config: M365ServiceConfig, request: M365DeltaDriveItemsRequest): Effect.Effect<string, M365Error> =>
  pipe(
    request.deltaLink,
    O.match({
      onNone: () => Effect.succeed(graphUrl(config, `/drives/${request.driveId}/root/delta`)),
      onSome: (link) => trustedGraphLink(config, link, "driveItems"),
    })
  );

// The app-only lane has no signed-in user, so `/me` cannot resolve there: fail before any HTTP.
const signedInUserPath = (
  config: M365ServiceConfig,
  path: string,
  resource: string
): Effect.Effect<string, M365Error> =>
  M365Lane.is["app-only"](config.lane)
    ? M365Error.failEffectFromReason("request encoding", { resource })
    : Effect.succeed(path);

const mailboxPath = (
  config: M365ServiceConfig,
  userId: O.Option<string>,
  suffix: string,
  resource: string
): Effect.Effect<string, M365Error> =>
  pipe(
    userId,
    O.match({
      onNone: () => signedInUserPath(config, `/me/${suffix}`, resource),
      onSome: (id) => Effect.succeed(`/users/${id}/${suffix}`),
    })
  );

const mailboxUrl = (
  config: M365ServiceConfig,
  userId: O.Option<string>,
  suffix: string,
  resource: string,
  params: ReadonlyArray<QueryParam> = []
): Effect.Effect<string, M365Error> =>
  pipe(
    mailboxPath(config, userId, suffix, resource),
    Effect.map((path) => graphUrl(config, path, params))
  );

const bodyContentTypeHeaders: (bodyContentType: O.Option<GraphBodyContentType>) => RequestHeaders = O.match({
  onNone: () => NO_HEADERS,
  onSome: (contentType) => ({ prefer: `outlook.body-content-type="${contentType}"` }),
});

const encodeWriteBody = <Sch extends S.Top>(schema: Sch, resource: string) => {
  const encode = S.encodeEffect(schema);

  return (value: Sch["Type"]): Effect.Effect<Sch["Encoded"], M365Error, Sch["EncodingServices"]> =>
    encode(value).pipe(Effect.mapError((cause) => M365Error.fromReason("request encoding", { cause, resource })));
};

const encodeEventDraft = encodeWriteBody(M365EventDraft, "events");
const encodeEventPatch = encodeWriteBody(M365EventPatch, "events");
const encodeMasterCategoryDraft = encodeWriteBody(M365MasterCategoryDraft, "masterCategories");

const idempotencyKeyFields = O.match({
  onNone: () => ({}),
  onSome: (key: M365IdempotencyKey) => ({
    singleValueExtendedProperties: [{ id: M365_IDEMPOTENCY_KEY_PROPERTY_ID, value: key }],
    transactionId: key,
  }),
});

const idempotencyKeyFilter = (key: M365IdempotencyKey): string =>
  `singleValueExtendedProperties/Any(ep: ep/id eq '${M365_IDEMPOTENCY_KEY_PROPERTY_ID}' and ep/value eq '${key}')`;

const IDEMPOTENCY_KEY_EXPAND = `singleValueExtendedProperties($filter=id eq '${M365_IDEMPOTENCY_KEY_PROPERTY_ID}')`;
const ATTACHMENT_METADATA_SELECT = "id,name,contentType,size,isInline,lastModifiedDateTime";
const CONFLICT_STATUS = 409;

const normalizeCategoryName = flow(Str.trim, Str.toLowerCase);

const changeKeyHeaders: (changeKey: O.Option<string>) => RequestHeaders = O.match({
  onNone: () => NO_HEADERS,
  onSome: (key) => ({ "if-match": `W/"${key}"` }),
});

const loadEnvConfig = Effect.fn("M365.loadEnvConfig")(function* () {
  const tenantId = yield* Config.String("M365_TENANT_ID");
  const clientId = yield* Config.String("M365_CLIENT_ID");
  const authority = yield* Config.String("M365_AUTHORITY").pipe(Config.option);
  const graphBaseUrl = yield* Config.String("M365_GRAPH_BASE_URL").pipe(Config.option);
  const maxRetries = yield* Config.Int("M365_MAX_RETRIES").pipe(Config.option);
  const redirectUri = yield* Config.String("M365_REDIRECT_URI").pipe(Config.option);
  const scopesText = yield* Config.String("M365_SCOPES").pipe(Config.option);
  const tokenCachePath = yield* Config.String("M365_TOKEN_CACHE_PATH").pipe(Config.option);
  const scopes = yield* pipe(
    scopesText,
    O.match({
      onNone: () => Effect.succeed(O.none<ReadonlyArray<string>>()),
      onSome: (value) =>
        decodeM365ScopesFromCsv(value).pipe(
          Effect.asSome,
          Effect.mapError((cause) => M365Error.fromReason("config", { cause }))
        ),
    })
  );

  return yield* decodeM365ConfigInput({
    clientId,
    tenantId,
    ...getSomesStruct({
      authority,
      graphBaseUrl,
      maxRetries,
      redirectUri,
      scopes,
      tokenCachePath,
    }),
  }).pipe(Effect.mapError((cause) => M365Error.fromReason("config", { cause })));
});

const listMasterCategories = Effect.fnUntraced(function* (
  runtime: M365Runtime,
  userId: O.Option<string>
): Effect.fn.Return<M365OutlookCategoryCollection, M365Error> {
  const url = yield* mailboxUrl(runtime.config, userId, "outlook/masterCategories", "masterCategories");
  return yield* executeJson(runtime, url, M365OutlookCategoryCollection, "masterCategories");
});

const createMasterCategory = Effect.fnUntraced(function* (
  runtime: M365Runtime,
  userId: O.Option<string>,
  category: M365MasterCategoryDraft
): Effect.fn.Return<GraphOutlookCategory, M365Error> {
  const url = yield* mailboxUrl(runtime.config, userId, "outlook/masterCategories", "masterCategories");
  const body = yield* encodeMasterCategoryDraft(category);
  return yield* executeJsonWrite(
    runtime,
    M365WriteCall.make({
      body: O.some(body),
      headers: NO_HEADERS,
      method: "POST",
      resource: "masterCategories",
      url,
    }),
    GraphOutlookCategory
  );
});

// Graph answers 409 when the name already exists: another writer created it between
// the list and this create, which is the outcome "ensure" wants.
const createMasterCategoryUnlessPresent = (
  runtime: M365Runtime,
  userId: O.Option<string>,
  category: M365MasterCategoryDraft
): Effect.Effect<O.Option<GraphOutlookCategory>, M365Error> =>
  createMasterCategory(runtime, userId, category).pipe(
    Effect.asSome,
    Effect.catchIf(
      (error) => error.reason === "response status" && O.contains(error.status, CONFLICT_STATUS),
      () => Effect.succeedNone
    )
  );

const makeService = (runtime: M365Runtime): M365Shape => ({
  createEvent: Effect.fn("M365.createEvent")(function* (rawRequest) {
    const request = yield* decodeRequest(M365CreateEventRequest, "events")(rawRequest);
    const url = yield* mailboxUrl(runtime.config, request.userId, "events", "events");
    const event = yield* encodeEventDraft(request.event);
    yield* Effect.annotateCurrentSpan({ m365_has_idempotency_key: O.isSome(request.idempotencyKey) });
    return yield* executeJsonWrite(
      runtime,
      M365WriteCall.make({
        body: O.some({ ...event, ...idempotencyKeyFields(request.idempotencyKey) }),
        headers: NO_HEADERS,
        method: "POST",
        resource: "events",
        url,
      }),
      GraphEvent
    );
  }),
  createMasterCategory: Effect.fn("M365.createMasterCategory")(function* (rawRequest) {
    const request = yield* decodeRequest(M365CreateMasterCategoryRequest, "masterCategories")(rawRequest);
    return yield* createMasterCategory(runtime, request.userId, request.category);
  }),
  deleteEvent: Effect.fn("M365.deleteEvent")(function* (rawRequest) {
    const request = yield* decodeRequest(M365DeleteEventRequest, "events")(rawRequest);
    const url = yield* mailboxUrl(runtime.config, request.userId, `events/${request.eventId}`, "events");
    yield* executeWrite(
      runtime,
      M365WriteCall.make({ body: O.none(), headers: NO_HEADERS, method: "DELETE", resource: "events", url })
    );
  }),
  deltaDriveItems: Effect.fn("M365.deltaDriveItems")(function* (rawRequest) {
    const request = yield* decodeRequest(M365DeltaDriveItemsRequest, "driveItems")(rawRequest);
    const url = yield* deltaUrl(runtime.config, request);
    const collection = yield* executeJson(runtime, url, M365DriveItemCollection, "driveItems");
    return yield* annotateCollectionCount(collection);
  }),
  downloadDriveItemContent: Effect.fn("M365.downloadDriveItemContent")(function* (rawRequest) {
    const request = yield* decodeRequest(M365DownloadDriveItemContentRequest, "driveItems")(rawRequest);
    const url = graphUrl(runtime.config, `/drives/${request.driveId}/items/${request.itemId}`, [
      ["$select", O.some(GRAPH_DRIVE_ITEM_SELECT)],
    ]);
    const item = yield* executeJson(runtime, url, GraphDriveItem, "driveItems");
    yield* Effect.annotateCurrentSpan({
      m365_item_size_bytes: O.getOrUndefined(item.size),
    });

    if (protectedByExtension(item)) {
      return M365SkippedEncryptedItem.make({ item, reason: ENCRYPTED_SKIP_REASON });
    }

    const downloadUrl = yield* driveItemDownloadUrl(item, "driveItems", url);
    const bytes = yield* executeBytes(runtime, downloadUrl, "driveItemContent");
    return M365DownloadedContent.make({ bytes, item });
  }),
  downloadMessageAttachment: Effect.fn("M365.downloadMessageAttachment")(function* (rawRequest) {
    const request = yield* decodeRequest(M365DownloadMessageAttachmentRequest, "attachments")(rawRequest);
    const url = yield* mailboxUrl(
      runtime.config,
      request.userId,
      `messages/${request.messageId}/attachments/${request.attachmentId}/$value`,
      "attachments"
    );
    const bytes = yield* executeBytes(runtime, url, "attachmentContent", signedBytesGet(runtime.auth, url));
    return M365AttachmentContent.make({ bytes });
  }),
  ensureMasterCategories: Effect.fn("M365.ensureMasterCategories")(function* (rawRequest) {
    const request = yield* decodeRequest(M365EnsureMasterCategoriesRequest, "masterCategories")(rawRequest);
    const present = yield* listMasterCategories(runtime, request.userId);
    const presentNames = HashSet.fromIterable(
      A.map(present.value, (category) => normalizeCategoryName(category.displayName))
    );
    const isPresent = (category: M365MasterCategoryDraft): boolean =>
      HashSet.has(presentNames, normalizeCategoryName(category.displayName));
    const attempts = yield* Effect.forEach(A.filter(request.categories, P.not(isPresent)), (category) =>
      createMasterCategoryUnlessPresent(runtime, request.userId, category).pipe(
        Effect.map((created) => ({ created, displayName: category.displayName }))
      )
    );
    const created = A.getSomes(A.map(attempts, (attempt) => attempt.created));
    yield* Effect.annotateCurrentSpan({ m365_created_count: A.length(created) });
    return M365EnsuredMasterCategories.make({
      created,
      existing: pipe(
        A.filter(request.categories, isPresent),
        A.appendAll(A.filter(attempts, (attempt) => O.isNone(attempt.created))),
        A.map((category) => category.displayName)
      ),
    });
  }),
  findEventsByIdempotencyKey: Effect.fn("M365.findEventsByIdempotencyKey")(function* (rawRequest) {
    const request = yield* decodeRequest(M365FindEventsByIdempotencyKeyRequest, "events")(rawRequest);
    const url = yield* mailboxUrl(runtime.config, request.userId, "events", "events", [
      ["$expand", O.some(IDEMPOTENCY_KEY_EXPAND)],
      ["$filter", O.some(idempotencyKeyFilter(request.idempotencyKey))],
    ]);
    const collection = yield* executeJson(runtime, url, M365EventCollection, "events");
    return yield* annotateCollectionCount(collection);
  }),
  getEvent: Effect.fn("M365.getEvent")(function* (rawRequest) {
    const request = yield* decodeRequest(M365GetEventRequest, "events")(rawRequest);
    const url = yield* mailboxUrl(runtime.config, request.userId, `events/${request.eventId}`, "events");
    return yield* executeJson(runtime, url, GraphEvent, "events");
  }),
  getListItem: Effect.fn("M365.getListItem")(function* (rawRequest) {
    const request = yield* decodeRequest(M365GetListItemRequest, "listItems")(rawRequest);
    const url = graphUrl(runtime.config, `/sites/${request.siteId}/lists/${request.listId}/items/${request.itemId}`, [
      ["$expand", O.some("fields")],
    ]);
    return yield* executeJson(runtime, url, GraphListItem, "listItems");
  }),
  getMessage: Effect.fn("M365.getMessage")(function* (rawRequest) {
    const request = yield* decodeRequest(M365GetMessageRequest, "messages")(rawRequest);
    const url = yield* mailboxUrl(runtime.config, request.userId, `messages/${request.messageId}`, "messages");
    return yield* executeJson(runtime, url, GraphMessage, "messages", bodyContentTypeHeaders(request.bodyContentType));
  }),
  getSite: Effect.fn("M365.getSite")(function* (rawRequest) {
    const request = yield* decodeRequest(M365GetSiteRequest, "sites")(rawRequest);
    const url = graphUrl(runtime.config, `/sites/${request.siteId}`);
    return yield* executeJson(runtime, url, GraphSite, "sites");
  }),
  listDriveItemVersions: Effect.fn("M365.listDriveItemVersions")(function* (rawRequest) {
    const request = yield* decodeRequest(M365ListDriveItemVersionsRequest, "driveItemVersions")(rawRequest);
    const url = graphUrl(runtime.config, `/drives/${request.driveId}/items/${request.itemId}/versions`);
    const collection = yield* executeJson(runtime, url, M365DriveItemVersionCollection, "driveItemVersions");
    return yield* annotateCollectionCount(collection);
  }),
  listDrives: Effect.fn("M365.listDrives")(function* (rawRequest) {
    const request = yield* decodeRequest(M365ListDrivesRequest, "drives")(rawRequest);
    const path = yield* pipe(
      request.siteId,
      O.match({
        onNone: () => signedInUserPath(runtime.config, "/me/drives", "drives"),
        onSome: (siteId) => Effect.succeed(`/sites/${siteId}/drives`),
      })
    );
    const collection = yield* executeJson(runtime, graphUrl(runtime.config, path), M365DriveCollection, "drives");
    return yield* annotateCollectionCount(collection);
  }),
  listEvents: Effect.fn("M365.listEvents")(function* (rawRequest) {
    const request = yield* decodeRequest(M365ListEventsRequest, "events")(rawRequest);
    const url = yield* mailboxUrl(runtime.config, request.userId, "events", "events", [["$top", request.top]]);
    const collection = yield* executeJson(runtime, url, M365EventCollection, "events");
    return yield* annotateCollectionCount(collection);
  }),
  listMasterCategories: Effect.fn("M365.listMasterCategories")(function* (rawRequest) {
    const request = yield* decodeRequest(M365ListMasterCategoriesRequest, "masterCategories")(rawRequest);
    const collection = yield* listMasterCategories(runtime, request.userId);
    return yield* annotateCollectionCount(collection);
  }),
  listMessageAttachments: Effect.fn("M365.listMessageAttachments")(function* (rawRequest) {
    const request = yield* decodeRequest(M365ListMessageAttachmentsRequest, "attachments")(rawRequest);
    const url = yield* mailboxUrl(
      runtime.config,
      request.userId,
      `messages/${request.messageId}/attachments`,
      "attachments",
      [["$select", O.some(ATTACHMENT_METADATA_SELECT)]]
    );
    const collection = yield* executeJson(runtime, url, M365AttachmentCollection, "attachments");
    return yield* annotateCollectionCount(collection);
  }),
  listMessages: Effect.fn("M365.listMessages")(function* (rawRequest) {
    const request = yield* decodeRequest(M365ListMessagesRequest, "messages")(rawRequest);
    const url = yield* pipe(
      request.nextLink,
      O.match({
        onNone: () =>
          mailboxUrl(runtime.config, request.userId, "messages", "messages", [
            ["$filter", request.filter],
            ["$orderby", request.orderby],
            ["$top", request.top],
          ]),
        onSome: (link) => trustedGraphLink(runtime.config, link, "messages"),
      })
    );
    const collection = yield* executeJson(
      runtime,
      url,
      M365MessageCollection,
      "messages",
      bodyContentTypeHeaders(request.bodyContentType)
    );
    return yield* annotateCollectionCount(collection);
  }),
  listSites: Effect.fn("M365.listSites")(function* (rawRequest) {
    const request = yield* decodeRequest(M365ListSitesRequest, "sites")(rawRequest);
    const collection = yield* executeJson(
      runtime,
      graphUrl(runtime.config, "/sites", [["search", O.some(request.search)]]),
      M365SiteCollection,
      "sites"
    );
    return yield* annotateCollectionCount(collection);
  }),
  updateEvent: Effect.fn("M365.updateEvent")(function* (rawRequest) {
    const request = yield* decodeRequest(M365UpdateEventRequest, "events")(rawRequest);
    const url = yield* mailboxUrl(runtime.config, request.userId, `events/${request.eventId}`, "events");
    const body = yield* encodeEventPatch(request.patch);
    return yield* executeJsonWrite(
      runtime,
      M365WriteCall.make({ body: O.some(body), headers: NO_HEADERS, method: "PATCH", resource: "events", url }),
      GraphEvent
    );
  }),
  updateMessageCategories: Effect.fn("M365.updateMessageCategories")(function* (rawRequest) {
    const request = yield* decodeRequest(M365UpdateMessageCategoriesRequest, "messages")(rawRequest);
    const url = yield* mailboxUrl(runtime.config, request.userId, `messages/${request.messageId}`, "messages");
    yield* Effect.annotateCurrentSpan({ m365_category_count: A.length(request.categories) });
    return yield* executeJsonWrite(
      runtime,
      M365WriteCall.make({
        body: O.some({ categories: request.categories }),
        headers: changeKeyHeaders(request.changeKey),
        method: "PATCH",
        resource: "messages",
        url,
      }),
      GraphMessage
    );
  }),
});

/**
 * Microsoft Graph `v1.0` driver service (read verbs on both lanes; mailbox
 * writes on the app-only lane).
 *
 * **Example** (Build layer from config)
 *
 * ```ts
 * import { M365, M365ConfigInput } from "@beep/m365"
 *
 * const layer = M365.makeLayer(M365ConfigInput.make({ tenantId: "common", clientId: "client-id" }))
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class M365 extends Context.Service<M365, M365Shape>()($I`M365`) {
  /**
   * Build a testable Microsoft Graph service layer from explicit configuration.
   *
   * **Details**
   *
   * The returned layer requires an injected {@link M365Auth} and
   * `HttpClient.HttpClient`, so unit tests can supply fixed tokens and a fake
   * HTTP transport.
   *
   * **Example** (Make testable Graph layer)
   *
   * ```ts
   * import { M365, M365ConfigInput } from "@beep/m365"
   *
   * const layer = M365.makeLayer(M365ConfigInput.make({ tenantId: "common", clientId: "client-id" }))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config: M365ConfigInput
  ): Layer.Layer<M365, M365Error, M365Auth | HttpClient.HttpClient> =>
    Layer.effect(
      M365,
      Effect.gen(function* () {
        const auth = yield* M365Auth;
        const client = yield* HttpClient.HttpClient;
        const resolved = resolveM365Config(config);
        return M365.of(
          makeService(
            M365Runtime.make({
              auth,
              client,
              config: M365ServiceConfig.make({
                graphBaseUrl: resolved.graphBaseUrl,
                lane: "delegated",
                maxRetries: resolved.maxRetries,
              }),
            })
          )
        );
      })
    );

  /**
   * Build a testable app-only Microsoft Graph service layer.
   *
   * **Details**
   *
   * Requires an injected {@link M365Auth} and `HttpClient.HttpClient`. On this
   * lane every mailbox verb needs a `userId`: a request that would resolve to
   * a `/me` route fails with `"request encoding"` before any HTTP call.
   *
   * **Example** (Make testable app-only layer)
   *
   * ```ts
   * import { M365, M365AppOnlyConfigInput, M365ClientSecretCredential } from "@beep/m365"
   * import { Redacted } from "effect"
   *
   * const layer = M365.makeAppOnlyLayer(
   *   M365AppOnlyConfigInput.make({
   *     clientId: "client-id",
   *     credential: M365ClientSecretCredential.make({ clientSecret: Redacted.make("dev-secret") }),
   *     tenantId: "tenant-id"
   *   })
   * )
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeAppOnlyLayer = (
    config: M365AppOnlyConfigInput
  ): Layer.Layer<M365, never, M365Auth | HttpClient.HttpClient> =>
    Layer.effect(
      M365,
      Effect.gen(function* () {
        const auth = yield* M365Auth;
        const client = yield* HttpClient.HttpClient;
        return M365.of(
          makeService(
            M365Runtime.make({
              auth,
              client,
              config: M365ServiceConfig.make({
                graphBaseUrl: URLStr.make(config.graphBaseUrl),
                lane: "app-only",
                maxRetries: config.maxRetries,
              }),
            })
          )
        );
      })
    );

  /**
   * Build a live app-only Microsoft Graph service layer (client-credentials
   * token provider and `FetchHttpClient`).
   *
   * **Example** (Make live app-only layer)
   *
   * ```ts
   * import { M365, M365AppOnlyConfigInput, M365CertificateCredential } from "@beep/m365"
   * import { Redacted } from "effect"
   *
   * const layer = M365.makeAppOnlyLiveLayer(
   *   M365AppOnlyConfigInput.make({
   *     clientId: "client-id",
   *     credential: M365CertificateCredential.make({
   *       privateKey: Redacted.make("pem-private-key-from-a-protected-store"),
   *       thumbprintSha256: "AB12"
   *     }),
   *     tenantId: "tenant-id"
   *   })
   * )
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeAppOnlyLiveLayer = (config: M365AppOnlyConfigInput): Layer.Layer<M365, M365Error> =>
    M365.makeAppOnlyLayer(config).pipe(
      Layer.provide(M365Auth.makeAppOnlyLayer(config)),
      Layer.provide(FetchHttpClient.layer)
    );

  /**
   * Build a live Microsoft Graph service layer from explicit configuration.
   *
   * **Example** (Make live Graph layer)
   *
   * ```ts
   * import { M365, M365ConfigInput } from "@beep/m365"
   *
   * const layer = M365.makeLiveLayer(M365ConfigInput.make({ tenantId: "common", clientId: "client-id" }))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLiveLayer = (
    config: M365ConfigInput,
    options: { readonly interactiveAuthorizer?: M365InteractiveAuthorizer } = {}
  ): Layer.Layer<M365, M365Error> =>
    M365.makeLayer(config).pipe(
      Layer.provide(M365Auth.makeLayer(config, options)),
      Layer.provide(FetchHttpClient.layer)
    );

  /**
   * Live Microsoft Graph layer backed by ambient Effect Config values.
   *
   * **Details**
   *
   * Required: `M365_TENANT_ID`, `M365_CLIENT_ID`. Optional:
   * `M365_AUTHORITY`, `M365_GRAPH_BASE_URL`, `M365_MAX_RETRIES`,
   * `M365_REDIRECT_URI`, `M365_SCOPES`, and `M365_TOKEN_CACHE_PATH`.
   *
   * **Example** (Ambient config live layer)
   *
   * ```ts
   * import { M365 } from "@beep/m365"
   *
   * console.log(M365.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<M365, M365Error> = Layer.unwrap(
    loadEnvConfig().pipe(
      Effect.map(M365.makeLiveLayer),
      Effect.mapError((cause) => M365Error.fromReason("config", { cause }))
    )
  );
}
