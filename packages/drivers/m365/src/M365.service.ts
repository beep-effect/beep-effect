/**
 * Effect service for Microsoft Graph `v1.0` read-only driver calls.
 *
 * The driver uses raw Graph REST requests through `effect/unstable/http`,
 * decodes every JSON payload with `effect/Schema`, and records only technical
 * counts/sizes in spans. It never logs tokens, mail bodies, file bytes, or
 * document content.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $M365Id } from "@beep/identity";
import { PosInt, SchemaUtils } from "@beep/schema";
import { getSomesStruct } from "@beep/utils/Option";
import { Config, Context, Duration, Effect, flow, Layer, pipe, SchemaGetter } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { M365Auth } from "./M365.auth.ts";
import { M365ConfigInput, ResolvedM365Config, resolveM365Config } from "./M365.config.ts";
import { M365Error } from "./M365.errors.ts";
import {
  GraphCollection,
  GraphDrive,
  GraphDriveItem,
  GraphDriveItemVersion,
  GraphEvent,
  GraphListItem,
  GraphMessage,
  GraphSite,
} from "./M365.schemas.ts";
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type { M365AuthShape, M365InteractiveAuthorizer } from "./M365.auth.ts";

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

class M365Runtime extends S.Class<M365Runtime>($I`M365Runtime`)(
  {
    auth: M365AuthShapeFromSelf,
    client: HttpClientFromSelf,
    config: ResolvedM365Config,
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
    siteId: S.OptionFromOptionalKey(GraphPathSegment).pipe(SchemaUtils.withNoneDefault).annotateKey({
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
    search: S.String.pipe(SchemaUtils.withKeyDefaults(ALL_SITES_SEARCH)).annotateKey({
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
    deltaLink: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
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
 * import { PosInt } from "@beep/schema"
 * import { M365ListMessagesRequest } from "@beep/m365"
 * import * as O from "effect/Option"
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
    filter: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Optional Graph OData `$filter` query value." }),
    top: S.OptionFromOptionalKey(PosInt)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Optional Graph `$top` page size." }),
    userId: S.OptionFromOptionalKey(GraphPathSegment).pipe(SchemaUtils.withNoneDefault).annotateKey({
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
    messageId: GraphPathSegment.annotateKey({ description: "Graph message id." }),
    userId: S.OptionFromOptionalKey(GraphPathSegment).pipe(SchemaUtils.withNoneDefault).annotateKey({
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
 * import { PosInt } from "@beep/schema"
 * import { M365ListEventsRequest } from "@beep/m365"
 * import * as O from "effect/Option"
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
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Optional Graph `$top` page size." }),
    userId: S.OptionFromOptionalKey(GraphPathSegment).pipe(SchemaUtils.withNoneDefault).annotateKey({
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
    userId: S.OptionFromOptionalKey(GraphPathSegment).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional user id/mailbox; omitted to read the signed-in user's calendar event.",
    }),
  },
  $I.annote("M365GetEventRequest", {
    description: "Request for reading one Outlook calendar event.",
  })
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
  readonly deltaDriveItems: (request: M365DeltaDriveItemsRequest) => Effect.Effect<M365DriveItemCollection, M365Error>;
  readonly downloadDriveItemContent: (
    request: M365DownloadDriveItemContentRequest
  ) => Effect.Effect<M365DriveItemDownload, M365Error>;
  readonly getEvent: (request: M365GetEventRequest) => Effect.Effect<GraphEvent, M365Error>;
  readonly getListItem: (request: M365GetListItemRequest) => Effect.Effect<GraphListItem, M365Error>;
  readonly getMessage: (request: M365GetMessageRequest) => Effect.Effect<GraphMessage, M365Error>;
  readonly getSite: (request: M365GetSiteRequest) => Effect.Effect<GraphSite, M365Error>;
  readonly listDriveItemVersions: (
    request: M365ListDriveItemVersionsRequest
  ) => Effect.Effect<M365DriveItemVersionCollection, M365Error>;
  readonly listDrives: (request: M365ListDrivesRequest) => Effect.Effect<M365DriveCollection, M365Error>;
  readonly listEvents: (request: M365ListEventsRequest) => Effect.Effect<M365EventCollection, M365Error>;
  readonly listMessages: (request: M365ListMessagesRequest) => Effect.Effect<M365MessageCollection, M365Error>;
  readonly listSites: (request: M365ListSitesRequest) => Effect.Effect<M365SiteCollection, M365Error>;
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

const graphUrl = (config: ResolvedM365Config, path: string, params: ReadonlyArray<QueryParam> = []): string =>
  `${config.graphBaseUrl}${path}${queryString(params)}`;

const signedJsonGet = Effect.fnUntraced(function* (
  auth: M365AuthShape,
  url: string
): Effect.fn.Return<HttpClientRequest.HttpClientRequest, M365Error> {
  const token = yield* auth.acquireToken;
  return pipe(
    HttpClientRequest.get(url),
    HttpClientRequest.bearerToken(token),
    HttpClientRequest.accept(REQUEST_ACCEPT)
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

const executeWithRetry = Effect.fnUntraced(function* (
  client: HttpClient.HttpClient,
  makeRequest: Effect.Effect<HttpClientRequest.HttpClientRequest, M365Error>,
  resource: string,
  url: string,
  remaining: number
): Effect.fn.Return<HttpClientResponse.HttpClientResponse, M365Error> {
  const request = yield* makeRequest;
  const response = yield* client
    .execute(request)
    .pipe(Effect.mapError((cause) => M365Error.fromReason("transport", { cause, resource, url })));

  return yield* ensureSuccess(response, resource, url).pipe(
    Effect.catchIf(
      (error) => error.reason === "throttled" && remaining > 0,
      (error) =>
        Effect.sleep(
          Duration.seconds(
            pipe(
              error.retryAfterSeconds,
              O.getOrElse(() => DEFAULT_THROTTLE_RETRY_AFTER_SECONDS)
            )
          )
        ).pipe(Effect.flatMap(() => executeWithRetry(client, makeRequest, resource, url, remaining - 1)))
    )
  );
});

const executeJson = Effect.fnUntraced(function* <Schema extends S.Top>(
  runtime: M365Runtime,
  url: string,
  schema: Schema,
  resource: string
): Effect.fn.Return<Schema["Type"], M365Error, Schema["DecodingServices"]> {
  yield* Effect.annotateCurrentSpan({
    m365_resource: resource,
  });
  const response = yield* executeWithRetry(
    runtime.client,
    signedJsonGet(runtime.auth, url),
    resource,
    url,
    runtime.config.maxRetries
  );
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

const executeBytes = Effect.fnUntraced(function* (
  runtime: M365Runtime,
  url: string,
  resource: string
): Effect.fn.Return<Uint8Array, M365Error> {
  const response = yield* executeWithRetry(runtime.client, unsignedGet(url), resource, url, runtime.config.maxRetries);
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

const isTrustedDeltaLink = (config: ResolvedM365Config, link: string): Effect.Effect<boolean, M365Error> =>
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
    catch: (cause) => M365Error.fromReason("request encoding", { cause, resource: "driveItems", url: link }),
  });

const deltaUrl = (config: ResolvedM365Config, request: M365DeltaDriveItemsRequest): Effect.Effect<string, M365Error> =>
  pipe(
    request.deltaLink,
    O.match({
      onNone: () => Effect.succeed(graphUrl(config, `/drives/${request.driveId}/root/delta`)),
      onSome: (link) =>
        pipe(
          isTrustedDeltaLink(config, link),
          Effect.flatMap((isTrusted) =>
            isTrusted
              ? Effect.succeed(link)
              : M365Error.failEffectFromReason("request encoding", {
                  resource: "driveItems",
                  url: link,
                })
          )
        ),
    })
  );

const mailboxPath = (userId: O.Option<string>, suffix: string): string =>
  pipe(
    userId,
    O.match({
      onNone: () => `/me/${suffix}`,
      onSome: (id) => `/users/${id}/${suffix}`,
    })
  );

const loadEnvConfig = Effect.fn("M365.loadEnvConfig")(function* () {
  const tenantId = yield* Config.string("M365_TENANT_ID");
  const clientId = yield* Config.string("M365_CLIENT_ID");
  const authority = yield* Config.string("M365_AUTHORITY").pipe(Config.option);
  const graphBaseUrl = yield* Config.string("M365_GRAPH_BASE_URL").pipe(Config.option);
  const maxRetries = yield* Config.int("M365_MAX_RETRIES").pipe(Config.option);
  const redirectUri = yield* Config.string("M365_REDIRECT_URI").pipe(Config.option);
  const scopesText = yield* Config.string("M365_SCOPES").pipe(Config.option);
  const tokenCachePath = yield* Config.string("M365_TOKEN_CACHE_PATH").pipe(Config.option);
  const scopes = yield* pipe(
    scopesText,
    O.match({
      onNone: () => Effect.succeed(O.none<ReadonlyArray<string>>()),
      onSome: (value) =>
        S.decodeEffect(M365ScopesFromCsv)(value).pipe(
          Effect.asSome,
          Effect.mapError((cause) => M365Error.fromReason("config", { cause }))
        ),
    })
  );

  return yield* S.decodeEffect(M365ConfigInput)({
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

const makeService = (runtime: M365Runtime): M365Shape => ({
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
  getEvent: Effect.fn("M365.getEvent")(function* (rawRequest) {
    const request = yield* decodeRequest(M365GetEventRequest, "events")(rawRequest);
    const url = graphUrl(runtime.config, mailboxPath(request.userId, `events/${request.eventId}`));
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
    const url = graphUrl(runtime.config, mailboxPath(request.userId, `messages/${request.messageId}`));
    return yield* executeJson(runtime, url, GraphMessage, "messages");
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
    const path = pipe(
      request.siteId,
      O.match({
        onNone: () => "/me/drives",
        onSome: (siteId) => `/sites/${siteId}/drives`,
      })
    );
    const collection = yield* executeJson(runtime, graphUrl(runtime.config, path), M365DriveCollection, "drives");
    return yield* annotateCollectionCount(collection);
  }),
  listEvents: Effect.fn("M365.listEvents")(function* (rawRequest) {
    const request = yield* decodeRequest(M365ListEventsRequest, "events")(rawRequest);
    const url = graphUrl(runtime.config, mailboxPath(request.userId, "events"), [["$top", request.top]]);
    const collection = yield* executeJson(runtime, url, M365EventCollection, "events");
    return yield* annotateCollectionCount(collection);
  }),
  listMessages: Effect.fn("M365.listMessages")(function* (rawRequest) {
    const request = yield* decodeRequest(M365ListMessagesRequest, "messages")(rawRequest);
    const url = graphUrl(runtime.config, mailboxPath(request.userId, "messages"), [
      ["$filter", request.filter],
      ["$top", request.top],
    ]);
    const collection = yield* executeJson(runtime, url, M365MessageCollection, "messages");
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
});

/**
 * Microsoft Graph `v1.0` read-only driver service.
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
        return M365.of(makeService(M365Runtime.make({ auth, client, config: resolveM365Config(config) })));
      })
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
