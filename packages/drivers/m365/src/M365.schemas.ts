/**
 * Schema models for the Microsoft Graph `v1.0` resources decoded by the
 * driver. Each model decodes a least-privilege subset of the upstream Graph
 * resource (excess properties are ignored). Optional Graph fields decode to
 * `Option` so consumers branch idiomatically; `id` stays required.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $M365Id } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $M365Id.create("M365.schemas");

const opt = <Sch extends S.Top>(schema: Sch, description: string) =>
  S.OptionFromOptionalNullOr(schema, { onNoneEncoding: "omit" })
    .pipe(S.withConstructorDefault(Effect.succeedNone))
    .annotateKey({ description });

const GraphNonNegativeInt = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("GraphNonNegativeInt", {
    description: "Microsoft Graph count or byte-size integer, preserving public number form.",
  })
);

/**
 * A Graph `identity` (user/application/device actor with optional id, name, email).
 *
 * **Example** (Empty identity make)
 *
 * ```ts
 * import { GraphUserIdentity } from "@beep/m365"
 *
 * console.log(GraphUserIdentity.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphUserIdentity extends S.Opaque<GraphUserIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    id: opt(S.String, "Actor id."),
    displayName: opt(S.String, "Actor display name."),
    email: opt(S.String, "Actor email address."),
  }).pipe($I.annoteSchema("GraphUserIdentity", { description: "A Graph identity actor (user/application/device)." }))
) {}

/**
 * A Graph `identitySet` (the actor facets attached to created/modified events).
 *
 * **Example** (Empty identity set make)
 *
 * ```ts
 * import { GraphIdentitySet } from "@beep/m365"
 *
 * console.log(GraphIdentitySet.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphIdentitySet extends S.Opaque<GraphIdentitySet, { readonly brand: unique symbol }>()(
  S.Struct({
    application: opt(GraphUserIdentity, "Application actor, if any."),
    device: opt(GraphUserIdentity, "Device actor, if any."),
    user: opt(GraphUserIdentity, "User actor, if any."),
  }).pipe($I.annoteSchema("GraphIdentitySet", { description: "A Graph identitySet of actor facets." }))
) {}

/**
 * A Graph `itemReference` (parent locator for a driveItem/listItem).
 *
 * **Example** (Empty item reference make)
 *
 * ```ts
 * import { GraphItemReference } from "@beep/m365"
 *
 * console.log(GraphItemReference.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphItemReference extends S.Opaque<GraphItemReference, { readonly brand: unique symbol }>()(
  S.Struct({
    driveId: opt(S.String, "Owning drive id."),
    driveType: opt(S.String, "Owning drive type."),
    id: opt(S.String, "Parent item id."),
    name: opt(S.String, "Parent item name."),
    path: opt(S.String, "Parent path relative to the drive root."),
    siteId: opt(S.String, "Owning SharePoint site id."),
  }).pipe($I.annoteSchema("GraphItemReference", { description: "A Graph itemReference parent locator." }))
) {}

/**
 * **Example** (Empty file hashes make)
 *
 * ```ts
 * import { GraphFileHashes } from "@beep/m365"
 *
 * console.log(GraphFileHashes.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphFileHashes extends S.Opaque<GraphFileHashes, { readonly brand: unique symbol }>()(
  S.Struct({
    quickXorHash: opt(S.String, "SharePoint/OneDrive QuickXorHash."),
    sha1Hash: opt(S.String, "SHA-1 content hash."),
    sha256Hash: opt(S.String, "SHA-256 content hash."),
  }).pipe($I.annoteSchema("GraphFileHashes", { description: "Graph file content hashes." }))
) {}

/**
 * **Example** (Empty file facet make)
 *
 * ```ts
 * import { GraphFile } from "@beep/m365"
 *
 * console.log(GraphFile.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphFile extends S.Opaque<GraphFile, { readonly brand: unique symbol }>()(
  S.Struct({
    mimeType: opt(S.String, "Resolved content MIME type."),
    hashes: opt(GraphFileHashes, "Content hashes, if computed."),
  }).pipe($I.annoteSchema("GraphFile", { description: "The Graph file facet of a driveItem." }))
) {}

/**
 * **Example** (Empty folder facet make)
 *
 * ```ts
 * import { GraphFolder } from "@beep/m365"
 *
 * console.log(GraphFolder.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphFolder extends S.Opaque<GraphFolder, { readonly brand: unique symbol }>()(
  S.Struct({
    childCount: opt(GraphNonNegativeInt, "Number of immediate children."),
  }).pipe($I.annoteSchema("GraphFolder", { description: "The Graph folder facet of a driveItem." }))
) {}

/**
 * **Example** (Empty deleted facet make)
 *
 * ```ts
 * import { GraphDeleted } from "@beep/m365"
 *
 * console.log(GraphDeleted.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphDeleted extends S.Opaque<GraphDeleted, { readonly brand: unique symbol }>()(
  S.Struct({
    state: opt(S.String, "Deletion state reported by a delta query."),
  }).pipe($I.annoteSchema("GraphDeleted", { description: "The Graph deleted facet on delta tombstones." }))
) {}

/**
 * **Example** (Empty quota make)
 *
 * ```ts
 * import { GraphQuota } from "@beep/m365"
 *
 * console.log(GraphQuota.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphQuota extends S.Opaque<GraphQuota, { readonly brand: unique symbol }>()(
  S.Struct({
    deleted: opt(S.Natural, "Bytes consumed by recycled items."),
    remaining: opt(S.Natural, "Remaining bytes."),
    state: opt(S.String, "Quota state (normal/nearing/critical/exceeded)."),
    total: opt(S.Natural, "Total bytes."),
    used: opt(S.Natural, "Used bytes."),
  }).pipe($I.annoteSchema("GraphQuota", { description: "A drive storage quota summary." }))
) {}

/**
 * **Example** (Empty site collection make)
 *
 * ```ts
 * import { GraphSiteCollection } from "@beep/m365"
 *
 * console.log(GraphSiteCollection.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphSiteCollection extends S.Opaque<GraphSiteCollection, { readonly brand: unique symbol }>()(
  S.Struct({
    hostname: opt(S.String, "Site collection hostname."),
  }).pipe($I.annoteSchema("GraphSiteCollection", { description: "A Graph siteCollection descriptor." }))
) {}

/**
 * The plain-text attorney-authored portion of a message (Graph `uniqueBody`).
 *
 * **Details**
 *
 * `contentType` is the literal `text`: a response carrying an HTML
 * `uniqueBody` fails to decode, so a caller can never fall back to stripping
 * markup or to the full `body`.
 *
 * **Example** (Make a text body)
 *
 * ```ts
 * import { GraphUniqueTextBody } from "@beep/m365"
 *
 * console.log(GraphUniqueTextBody.make({ contentType: "text", content: "Approved.\n" }).content)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphUniqueTextBody extends S.Opaque<GraphUniqueTextBody, { readonly brand: unique symbol }>()(
  S.Struct({
    contentType: S.tag("text").annotateKey({ description: "Must be plain text; HTML is refused." }),
    content: S.String.annotateKey({ description: "Text the sender wrote, without the quoted thread." }),
  }).pipe($I.annoteSchema("GraphUniqueTextBody", { description: "A plain-text Graph uniqueBody." }))
) {}

/**
 * A required Graph address wrapper (`{ emailAddress: { address } }`).
 *
 * **Example** (Make an address)
 *
 * ```ts
 * import { GraphRequiredAddress } from "@beep/m365"
 *
 * console.log(GraphRequiredAddress.make({ emailAddress: { address: "a@b.co" } }).emailAddress.address)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphRequiredAddress extends S.Opaque<GraphRequiredAddress, { readonly brand: unique symbol }>()(
  S.Struct({
    emailAddress: S.Struct({ address: S.NonEmptyString }).annotateKey({ description: "The address." }),
  }).pipe($I.annoteSchema("GraphRequiredAddress", { description: "A Graph recipient whose address is required." }))
) {}

/**
 * The fields of a message needed to verify who wrote what: sender addresses,
 * the plain-text `uniqueBody`, and the message identity.
 *
 * **Example** (Make an authored-text message)
 *
 * ```ts
 * import { GraphMessageAuthoredText, GraphRequiredAddress, GraphUniqueTextBody } from "@beep/m365"
 *
 * const message = GraphMessageAuthoredText.make({
 *   id: "AAMk",
 *   internetMessageId: "<a@b>",
 *   receivedDateTime: "2026-10-06T12:00:00Z",
 *   from: GraphRequiredAddress.make({ emailAddress: { address: "a@b.co" } }),
 *   sender: GraphRequiredAddress.make({ emailAddress: { address: "a@b.co" } }),
 *   uniqueBody: GraphUniqueTextBody.make({ contentType: "text", content: "Approved." })
 * })
 * console.log(message.internetMessageId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphMessageAuthoredText extends S.Opaque<GraphMessageAuthoredText, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString.annotateKey({ description: "Graph message id." }),
    internetMessageId: S.NonEmptyString.annotateKey({ description: "RFC 5322 Message-ID." }),
    receivedDateTime: S.NonEmptyString.annotateKey({ description: "Receipt time." }),
    from: GraphRequiredAddress.annotateKey({ description: "Graph `from`." }),
    sender: GraphRequiredAddress.annotateKey({ description: "Graph `sender`." }),
    uniqueBody: GraphUniqueTextBody.annotateKey({ description: "Plain-text unique body." }),
  }).pipe(
    $I.annoteSchema("GraphMessageAuthoredText", {
      description: "Sender addresses, identity, and plain-text uniqueBody of one message.",
    })
  )
) {}

/**
 * A Graph `emailAddress` (name + address pair).
 *
 * **Example** (Empty email address make)
 *
 * ```ts
 * import { GraphEmailAddress } from "@beep/m365"
 *
 * console.log(GraphEmailAddress.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphEmailAddress extends S.Opaque<GraphEmailAddress, { readonly brand: unique symbol }>()(
  S.Struct({
    address: opt(S.String, "Email address."),
    name: opt(S.String, "Display name."),
  }).pipe($I.annoteSchema("GraphEmailAddress", { description: "A Graph emailAddress." }))
) {}

/**
 * **Example** (Empty recipient make)
 *
 * ```ts
 * import { GraphRecipient } from "@beep/m365"
 *
 * console.log(GraphRecipient.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphRecipient extends S.Opaque<GraphRecipient, { readonly brand: unique symbol }>()(
  S.Struct({
    emailAddress: opt(GraphEmailAddress, "The recipient's email address."),
  }).pipe($I.annoteSchema("GraphRecipient", { description: "A Graph mail recipient wrapper." }))
) {}

/**
 * A Graph `itemBody` (mail/event body content + type). Spans never log content.
 *
 * **Example** (Empty item body make)
 *
 * ```ts
 * import { GraphItemBody } from "@beep/m365"
 *
 * console.log(GraphItemBody.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphItemBody extends S.Opaque<GraphItemBody, { readonly brand: unique symbol }>()(
  S.Struct({
    content: opt(S.String, "Body content (never logged in spans)."),
    contentType: opt(S.String, "Body content type (text/html)."),
  }).pipe($I.annoteSchema("GraphItemBody", { description: "A Graph itemBody." }))
) {}

/**
 * **Example** (Empty dateTimeTimeZone make)
 *
 * ```ts
 * import { GraphDateTimeTimeZone } from "@beep/m365"
 *
 * console.log(GraphDateTimeTimeZone.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphDateTimeTimeZone extends S.Opaque<GraphDateTimeTimeZone, { readonly brand: unique symbol }>()(
  S.Struct({
    dateTime: opt(S.String, "ISO-8601 local date-time."),
    timeZone: opt(S.String, "IANA/Windows time-zone identifier."),
  }).pipe($I.annoteSchema("GraphDateTimeTimeZone", { description: "A Graph dateTimeTimeZone pair." }))
) {}

/**
 * **Example** (Empty location make)
 *
 * ```ts
 * import { GraphLocation } from "@beep/m365"
 *
 * console.log(GraphLocation.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphLocation extends S.Opaque<GraphLocation, { readonly brand: unique symbol }>()(
  S.Struct({
    displayName: opt(S.String, "Location display name."),
    locationType: opt(S.String, "Location type."),
  }).pipe($I.annoteSchema("GraphLocation", { description: "A Graph event location." }))
) {}

/**
 * **Example** (Empty content type info make)
 *
 * ```ts
 * import { GraphContentTypeInfo } from "@beep/m365"
 *
 * console.log(GraphContentTypeInfo.make({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphContentTypeInfo extends S.Opaque<GraphContentTypeInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    id: opt(S.String, "Content type id."),
    name: opt(S.String, "Content type name."),
  }).pipe($I.annoteSchema("GraphContentTypeInfo", { description: "A Graph listItem contentTypeInfo." }))
) {}

/**
 * Generic Microsoft Graph OData collection envelope (`{ value, @odata.* }`).
 *
 * **Details**
 *
 * Covers both standard list responses (`@odata.nextLink`) and delta responses
 * (`@odata.deltaLink`); continuation links decode to `Option`.
 *
 * **Example** (Collection of drives)
 *
 * ```ts
 * import { GraphCollection, GraphDrive } from "@beep/m365"
 *
 * const Drives = GraphCollection(GraphDrive)
 * console.log(Drives)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraphCollection = <Item extends S.Top>(item: Item) =>
  S.Struct({
    "@odata.context": opt(S.String, "OData metadata context URL."),
    "@odata.count": opt(GraphNonNegativeInt, "Total count when `$count` was requested."),
    "@odata.deltaLink": opt(S.String, "Delta continuation link (end of a delta page)."),
    "@odata.nextLink": opt(S.String, "Pagination continuation link."),
    value: S.Array(item).annotateKey({ description: "The page of decoded resources." }),
  });

/**
 * **Example** (Make drive with id)
 *
 * ```ts
 * import { GraphDrive } from "@beep/m365"
 *
 * const drive = GraphDrive.make({ id: "b!abc" })
 * console.log(drive.id) // "b!abc"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphDrive extends S.Opaque<GraphDrive, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.annotateKey({ description: "Drive id." }),
    createdDateTime: opt(S.String, "Creation timestamp."),
    description: opt(S.String, "Drive description."),
    driveType: opt(S.String, "Drive type (personal/business/documentLibrary)."),
    lastModifiedDateTime: opt(S.String, "Last-modified timestamp."),
    name: opt(S.String, "Drive name."),
    quota: opt(GraphQuota, "Storage quota summary."),
    webUrl: opt(S.String, "Browser URL for the drive."),
  }).pipe($I.annoteSchema("GraphDrive", { description: "A OneDrive/SharePoint drive (document library)." }))
) {}

/**
 * **Example** (Make site with id)
 *
 * ```ts
 * import { GraphSite } from "@beep/m365"
 *
 * const site = GraphSite.make({ id: "contoso,abc,def" })
 * console.log(site.id) // "contoso,abc,def"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphSite extends S.Opaque<GraphSite, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.annotateKey({ description: "Composite site id." }),
    createdDateTime: opt(S.String, "Creation timestamp."),
    description: opt(S.String, "Site description."),
    displayName: opt(S.String, "Site display name."),
    lastModifiedDateTime: opt(S.String, "Last-modified timestamp."),
    name: opt(S.String, "Site name."),
    siteCollection: opt(GraphSiteCollection, "Owning site collection."),
    webUrl: opt(S.String, "Browser URL for the site."),
  }).pipe($I.annoteSchema("GraphSite", { description: "A SharePoint site." }))
) {}

/**
 * A OneDrive/SharePoint `driveItem` (file or folder). Carries provenance anchors
 * (`id`, `eTag`/`cTag`), the optional preauthenticated download URL, and the
 * delta `deleted` facet.
 *
 * **Example** (Make drive item with id)
 *
 * ```ts
 * import { GraphDriveItem } from "@beep/m365"
 *
 * const item = GraphDriveItem.make({ id: "01ABC" })
 * console.log(item.id) // "01ABC"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphDriveItem extends S.Opaque<GraphDriveItem, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.annotateKey({ description: "DriveItem id." }),
    "@microsoft.graph.downloadUrl": opt(S.String, "Short-lived preauthenticated content download URL."),
    cTag: opt(S.String, "Content tag (changes on content edits)."),
    createdBy: opt(GraphIdentitySet, "Creating actor set."),
    createdDateTime: opt(S.String, "Creation timestamp."),
    deleted: opt(GraphDeleted, "Deletion facet on delta tombstones."),
    eTag: opt(S.String, "Entity tag (changes on any edit)."),
    file: opt(GraphFile, "File facet when the item is a file."),
    folder: opt(GraphFolder, "Folder facet when the item is a folder."),
    lastModifiedBy: opt(GraphIdentitySet, "Last-modifying actor set."),
    lastModifiedDateTime: opt(S.String, "Last-modified timestamp."),
    name: opt(S.String, "Item name."),
    parentReference: opt(GraphItemReference, "Parent locator."),
    size: opt(GraphNonNegativeInt, "Item size in bytes."),
    webUrl: opt(S.String, "Browser URL for the item."),
  }).pipe($I.annoteSchema("GraphDriveItem", { description: "A OneDrive/SharePoint driveItem (file or folder)." }))
) {}

/**
 * A `driveItem` version (immutable provenance anchor across edits).
 *
 * **Example** (Make version with id)
 *
 * ```ts
 * import { GraphDriveItemVersion } from "@beep/m365"
 *
 * const version = GraphDriveItemVersion.make({ id: "1.0" })
 * console.log(version.id) // "1.0"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphDriveItemVersion extends S.Opaque<GraphDriveItemVersion, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.annotateKey({ description: "Version id." }),
    "@microsoft.graph.downloadUrl": opt(S.String, "Short-lived preauthenticated version download URL."),
    lastModifiedBy: opt(GraphIdentitySet, "Last-modifying actor set."),
    lastModifiedDateTime: opt(S.String, "Version timestamp."),
    size: opt(GraphNonNegativeInt, "Version size in bytes."),
  }).pipe($I.annoteSchema("GraphDriveItemVersion", { description: "A driveItem version." }))
) {}

/**
 * A SharePoint `listItem` with its open custom-column `fields` (matter/client/
 * application-number metadata rides here as `driveItem`'s superclass).
 *
 * **Example** (Make list item with id)
 *
 * ```ts
 * import { GraphListItem } from "@beep/m365"
 *
 * const listItem = GraphListItem.make({ id: "7" })
 * console.log(listItem.id) // "7"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphListItem extends S.Opaque<GraphListItem, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.annotateKey({ description: "ListItem id." }),
    contentType: opt(GraphContentTypeInfo, "Content type reference."),
    createdDateTime: opt(S.String, "Creation timestamp."),
    eTag: opt(S.String, "Entity tag."),
    fields: opt(S.Record(S.String, S.Unknown), "Open custom-column values (matter/client/app metadata)."),
    lastModifiedDateTime: opt(S.String, "Last-modified timestamp."),
    parentReference: opt(GraphItemReference, "Parent locator."),
    webUrl: opt(S.String, "Browser URL for the item."),
  }).pipe($I.annoteSchema("GraphListItem", { description: "A SharePoint listItem with open custom-column fields." }))
) {}

/**
 * A Graph single-value extended property (`id` names the property, `value` is
 * its string form).
 *
 * **Example** (Make extended property)
 *
 * ```ts
 * import { GraphExtendedProperty } from "@beep/m365"
 *
 * const property = GraphExtendedProperty.make({ id: "String {guid} Name Key", value: "abc" })
 * console.log(property.value) // "abc"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphExtendedProperty extends S.Opaque<GraphExtendedProperty, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.annotateKey({ description: "Property id (`<type> {<guid>} Name <name>`)." }),
    value: S.String.annotateKey({ description: "Property value in string form." }),
  }).pipe($I.annoteSchema("GraphExtendedProperty", { description: "A Graph single-value extended property." }))
) {}

/**
 * Body content types Graph accepts and returns for message and event bodies.
 *
 * **Example** (Guard a content type)
 *
 * ```ts
 * import { GraphBodyContentType } from "@beep/m365"
 *
 * console.log(GraphBodyContentType.is.text("text")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraphBodyContentType = LiteralKit(["text", "html"]).pipe(
  $I.annoteSchema("GraphBodyContentType", { description: "Graph item body content type." })
);

/**
 * **Example** (Type a content type)
 *
 * ```ts
 * import type { GraphBodyContentType } from "@beep/m365"
 *
 * const contentType: GraphBodyContentType = "text"
 * console.log(contentType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GraphBodyContentType = typeof GraphBodyContentType.Type;

/**
 * **Example** (Guard a show-as value)
 *
 * ```ts
 * import { GraphEventShowAs } from "@beep/m365"
 *
 * console.log(GraphEventShowAs.is.tentative("tentative")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraphEventShowAs = LiteralKit(["free", "tentative", "busy", "oof", "workingElsewhere", "unknown"]).pipe(
  $I.annoteSchema("GraphEventShowAs", { description: "Outlook event free/busy status." })
);

/**
 * **Example** (Type a show-as value)
 *
 * ```ts
 * import type { GraphEventShowAs } from "@beep/m365"
 *
 * const showAs: GraphEventShowAs = "tentative"
 * console.log(showAs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GraphEventShowAs = typeof GraphEventShowAs.Type;

/**
 * **Example** (Guard a category color)
 *
 * ```ts
 * import { GraphCategoryColor } from "@beep/m365"
 *
 * console.log(GraphCategoryColor.is.preset0("preset0")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraphCategoryColor = LiteralKit([
  "none",
  "preset0",
  "preset1",
  "preset2",
  "preset3",
  "preset4",
  "preset5",
  "preset6",
  "preset7",
  "preset8",
  "preset9",
  "preset10",
  "preset11",
  "preset12",
  "preset13",
  "preset14",
  "preset15",
  "preset16",
  "preset17",
  "preset18",
  "preset19",
  "preset20",
  "preset21",
  "preset22",
  "preset23",
  "preset24",
]).pipe($I.annoteSchema("GraphCategoryColor", { description: "Outlook master-category preset color." }));

/**
 * **Example** (Type a category color)
 *
 * ```ts
 * import type { GraphCategoryColor } from "@beep/m365"
 *
 * const color: GraphCategoryColor = "preset0"
 * console.log(color)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GraphCategoryColor = typeof GraphCategoryColor.Type;

/**
 * An Outlook master category (an entry of the mailbox's category list).
 *
 * **Example** (Make master category)
 *
 * ```ts
 * import { GraphOutlookCategory } from "@beep/m365"
 *
 * const category = GraphOutlookCategory.make({ displayName: "Docket - unverified" })
 * console.log(category.displayName)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphOutlookCategory extends S.Opaque<GraphOutlookCategory, { readonly brand: unique symbol }>()(
  S.Struct({
    displayName: S.String.annotateKey({ description: "Category name; unique in the mailbox, case-insensitive." }),
    color: opt(S.String, "Preset color constant (`none`, `preset0`..`preset24`)."),
    id: opt(S.String, "Category id."),
  }).pipe($I.annoteSchema("GraphOutlookCategory", { description: "An Outlook master category." }))
) {}

/**
 * Metadata of a message attachment (never its bytes).
 *
 * **Example** (Make attachment metadata)
 *
 * ```ts
 * import { GraphAttachment } from "@beep/m365"
 *
 * const attachment = GraphAttachment.make({ id: "AAMk" })
 * console.log(attachment.id) // "AAMk"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphAttachment extends S.Opaque<GraphAttachment, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.annotateKey({ description: "Attachment id." }),
    "@odata.type": opt(S.String, "Attachment kind (`#microsoft.graph.fileAttachment`, item or reference)."),
    contentType: opt(S.String, "Attachment MIME type."),
    isInline: opt(S.Boolean, "Whether the attachment is rendered inline in the body."),
    lastModifiedDateTime: opt(S.String, "Last-modified timestamp."),
    name: opt(S.String, "Attachment file name (never logged)."),
    size: opt(GraphNonNegativeInt, "Attachment size in bytes."),
  }).pipe($I.annoteSchema("GraphAttachment", { description: "Metadata of a message attachment." }))
) {}

/**
 * **Example** (Make mail folder with id)
 *
 * ```ts
 * import { GraphMailFolder } from "@beep/m365"
 *
 * const folder = GraphMailFolder.make({ id: "AAMk" })
 * console.log(folder.id) // "AAMk"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphMailFolder extends S.Opaque<GraphMailFolder, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.annotateKey({ description: "Mail folder id." }),
    childFolderCount: opt(GraphNonNegativeInt, "Number of immediate child folders."),
    displayName: opt(S.String, "Folder display name."),
    parentFolderId: opt(S.String, "Id of the parent mail folder."),
    totalItemCount: opt(GraphNonNegativeInt, "Number of items in the folder."),
    unreadItemCount: opt(GraphNonNegativeInt, "Number of unread items in the folder."),
  }).pipe($I.annoteSchema("GraphMailFolder", { description: "An Outlook mail folder (read subset)." }))
) {}

/**
 * An Outlook mail message (read subset). Body/preview are decoded but spans
 * never record their content.
 *
 * **Example** (Make message with id)
 *
 * ```ts
 * import { GraphMessage } from "@beep/m365"
 *
 * const message = GraphMessage.make({ id: "AAMk" })
 * console.log(message.id) // "AAMk"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphMessage extends S.Opaque<GraphMessage, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.annotateKey({ description: "Message id." }),
    bccRecipients: opt(S.Array(GraphRecipient), "Blind-carbon-copy recipients (present on drafts and sent items)."),
    body: opt(GraphItemBody, "Message body (never logged)."),
    bodyPreview: opt(S.String, "Truncated body preview (never logged)."),
    categories: opt(S.Array(S.String), "Outlook category display names applied to the message."),
    ccRecipients: opt(S.Array(GraphRecipient), "Carbon-copy recipients."),
    changeKey: opt(S.String, "Version tag; changes on every edit (optimistic concurrency)."),
    conversationId: opt(S.String, "Owning conversation id."),
    from: opt(GraphRecipient, "Originating sender."),
    hasAttachments: opt(S.Boolean, "Whether the message has attachments."),
    importance: opt(S.String, "Importance (low/normal/high)."),
    internetMessageId: opt(S.String, "RFC 2822 internet message id."),
    isDraft: opt(S.Boolean, "Whether the message is a draft."),
    isRead: opt(S.Boolean, "Whether the message has been read."),
    parentFolderId: opt(S.String, "Id of the mail folder holding the message."),
    receivedDateTime: opt(S.String, "Receipt timestamp."),
    sender: opt(GraphRecipient, "Actual sending mailbox."),
    sentDateTime: opt(S.String, "Sent timestamp."),
    subject: opt(S.String, "Message subject."),
    toRecipients: opt(S.Array(GraphRecipient), "Primary recipients."),
    webLink: opt(S.String, "Browser URL for the message."),
  }).pipe($I.annoteSchema("GraphMessage", { description: "An Outlook mail message (read subset)." }))
) {}

/**
 * **Details**
 *
 * A host reads this to tell a meeting from an appointment: Graph mails every
 * attendee when a meeting changes. The driver never writes attendees.
 *
 * **Example** (Make an attendee)
 *
 * ```ts
 * import { GraphEmailAddress, GraphEventAttendee } from "@beep/m365"
 * import * as O from "effect/Option"
 *
 * const attendee = GraphEventAttendee.make({
 *   emailAddress: GraphEmailAddress.makeOption({ address: O.some("guest@example.test") }),
 *   type: O.some("required")
 * })
 * console.log(O.isSome(attendee.type)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphEventAttendee extends S.Opaque<GraphEventAttendee, { readonly brand: unique symbol }>()(
  S.Struct({
    emailAddress: opt(GraphEmailAddress, "The attendee's email address (never logged)."),
    type: opt(S.String, "Attendee type (required/optional/resource)."),
  }).pipe(
    $I.annoteSchema("GraphEventAttendee", { description: "One attendee of an Outlook calendar event (read subset)." })
  )
) {}

/**
 * **Example** (Make event with id)
 *
 * ```ts
 * import { GraphEvent } from "@beep/m365"
 *
 * const event = GraphEvent.make({ id: "AAMk" })
 * console.log(event.id) // "AAMk"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphEvent extends S.Opaque<GraphEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.annotateKey({ description: "Event id." }),
    attendees: opt(S.Array(GraphEventAttendee), "Attendees; Graph mails each of them when a meeting changes."),
    body: opt(GraphItemBody, "Event body (never logged)."),
    bodyPreview: opt(S.String, "Truncated body preview (never logged)."),
    categories: opt(S.Array(S.String), "Outlook category display names applied to the event."),
    changeKey: opt(S.String, "Version tag; changes on every edit (optimistic concurrency)."),
    end: opt(GraphDateTimeTimeZone, "End date-time."),
    iCalUId: opt(S.String, "Calendar-wide unique id shared by all instances of the event."),
    importance: opt(S.String, "Importance (low/normal/high)."),
    isAllDay: opt(S.Boolean, "Whether the event spans the whole day."),
    isCancelled: opt(S.Boolean, "Whether the event is cancelled."),
    isOnlineMeeting: opt(S.Boolean, "Whether an online meeting is attached."),
    isReminderOn: opt(S.Boolean, "Whether a reminder alert is set."),
    location: opt(GraphLocation, "Event location."),
    organizer: opt(GraphRecipient, "Organizing mailbox."),
    reminderMinutesBeforeStart: opt(GraphNonNegativeInt, "Minutes before the start at which the reminder fires."),
    seriesMasterId: opt(S.String, "Series master id for recurring events."),
    showAs: opt(S.String, "Free/busy status."),
    singleValueExtendedProperties: opt(
      S.Array(GraphExtendedProperty),
      "Single-value extended properties, present only when expanded."
    ),
    start: opt(GraphDateTimeTimeZone, "Start date-time."),
    subject: opt(S.String, "Event subject."),
    transactionId: opt(S.String, "Client-supplied id Graph uses to drop a retried create."),
    type: opt(S.String, "Event type (singleInstance/occurrence/exception/seriesMaster)."),
    webLink: opt(S.String, "Browser URL for the event."),
  }).pipe($I.annoteSchema("GraphEvent", { description: "An Outlook calendar event (read subset)." }))
) {}

/**
 * A single-value Outlook extended property.
 *
 * **Example** (Construct GraphContactProperty)
 *
 * ```ts
 * import { GraphContactProperty } from "@beep/m365"
 * console.log(GraphContactProperty.make({ id: "fixture-property", value: "fixture-run" }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphContactProperty extends S.Opaque<GraphContactProperty, { readonly brand: unique symbol }>()(
  S.Struct({ id: S.NonEmptyString, value: S.String }).pipe(
    $I.annoteSchema("GraphContactProperty", { description: "An Outlook application marker." })
  )
) {}

/**
 * **Example** (Construct GraphContact)
 *
 * ```ts
 * import { GraphContact } from "@beep/m365"
 * console.log(GraphContact.make({ id: "fixture-contact" }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphContact extends S.Opaque<GraphContact, { readonly brand: unique symbol }>()(
  S.Struct({
    rawJson: opt(S.Record(S.String, S.Unknown), "Full Graph contact JSON for private export; never logged."),
    id: S.NonEmptyString,
    displayName: opt(S.String, "Contact display name."),
    givenName: opt(S.String, "Given name."),
    surname: opt(S.String, "Surname."),
    companyName: opt(S.String, "Company name."),
    emailAddresses: opt(S.Array(GraphEmailAddress), "Email addresses."),
    businessPhones: opt(S.Array(S.String), "Business phones."),
    homePhones: opt(S.Array(S.String), "Home phones."),
    mobilePhone: opt(S.String, "Mobile phone."),
    categories: opt(S.Array(S.String), "Rollback category and existing categories."),
    parentFolderId: opt(S.String, "Parent folder id."),
    createdDateTime: opt(S.String, "Creation time."),
    lastModifiedDateTime: opt(S.String, "Last modification time."),
    changeKey: opt(S.String, "Optimistic concurrency version."),
    singleValueExtendedProperties: opt(S.Array(GraphContactProperty), "Expanded application markers."),
  }).pipe(
    $I.annoteSchema("GraphContact", { description: "A personal mailbox contact with null-safe optional Graph fields." })
  )
) {}

/**
 * **Example** (Construct GraphContactFolder)
 *
 * ```ts
 * import { GraphContactFolder } from "@beep/m365"
 * console.log(GraphContactFolder.make({ id: "fixture-folder" }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphContactFolder extends S.Opaque<GraphContactFolder, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    displayName: opt(S.String, "Folder name."),
    parentFolderId: opt(S.String, "Parent folder id."),
  }).pipe(
    $I.annoteSchema("GraphContactFolder", { description: "A personal contact folder, including nested folders." })
  )
) {}
