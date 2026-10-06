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
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $M365Id.create("M365.schemas");

/**
 * Build an optional Graph wire field that decodes a missing/`undefined` key to
 * `Option.none`, defaults to `none` on construction, and carries a description.
 */
const opt = <Sch extends S.Top>(schema: Sch, description: string) =>
  S.OptionFromOptionalKey(schema).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({ description });

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
export class GraphUserIdentity extends S.Class<GraphUserIdentity>($I`GraphUserIdentity`)(
  {
    id: opt(S.String, "Actor id."),
    displayName: opt(S.String, "Actor display name."),
    email: opt(S.String, "Actor email address."),
  },
  $I.annote("GraphUserIdentity", { description: "A Graph identity actor (user/application/device)." })
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
export class GraphIdentitySet extends S.Class<GraphIdentitySet>($I`GraphIdentitySet`)(
  {
    application: opt(GraphUserIdentity, "Application actor, if any."),
    device: opt(GraphUserIdentity, "Device actor, if any."),
    user: opt(GraphUserIdentity, "User actor, if any."),
  },
  $I.annote("GraphIdentitySet", { description: "A Graph identitySet of actor facets." })
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
export class GraphItemReference extends S.Class<GraphItemReference>($I`GraphItemReference`)(
  {
    driveId: opt(S.String, "Owning drive id."),
    driveType: opt(S.String, "Owning drive type."),
    id: opt(S.String, "Parent item id."),
    name: opt(S.String, "Parent item name."),
    path: opt(S.String, "Parent path relative to the drive root."),
    siteId: opt(S.String, "Owning SharePoint site id."),
  },
  $I.annote("GraphItemReference", { description: "A Graph itemReference parent locator." })
) {}

/**
 * Graph `file.hashes` content fingerprints.
 *
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
export class GraphFileHashes extends S.Class<GraphFileHashes>($I`GraphFileHashes`)(
  {
    quickXorHash: opt(S.String, "SharePoint/OneDrive QuickXorHash."),
    sha1Hash: opt(S.String, "SHA-1 content hash."),
    sha256Hash: opt(S.String, "SHA-256 content hash."),
  },
  $I.annote("GraphFileHashes", { description: "Graph file content hashes." })
) {}

/**
 * The Graph `file` facet of a driveItem.
 *
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
export class GraphFile extends S.Class<GraphFile>($I`GraphFile`)(
  {
    mimeType: opt(S.String, "Resolved content MIME type."),
    hashes: opt(GraphFileHashes, "Content hashes, if computed."),
  },
  $I.annote("GraphFile", { description: "The Graph file facet of a driveItem." })
) {}

/**
 * The Graph `folder` facet of a driveItem.
 *
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
export class GraphFolder extends S.Class<GraphFolder>($I`GraphFolder`)(
  {
    childCount: opt(GraphNonNegativeInt, "Number of immediate children."),
  },
  $I.annote("GraphFolder", { description: "The Graph folder facet of a driveItem." })
) {}

/**
 * The Graph `deleted` facet, present on delta tombstones.
 *
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
export class GraphDeleted extends S.Class<GraphDeleted>($I`GraphDeleted`)(
  {
    state: opt(S.String, "Deletion state reported by a delta query."),
  },
  $I.annote("GraphDeleted", { description: "The Graph deleted facet on delta tombstones." })
) {}

/**
 * A drive storage `quota` summary.
 *
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
export class GraphQuota extends S.Class<GraphQuota>($I`GraphQuota`)(
  {
    deleted: opt(S.Natural, "Bytes consumed by recycled items."),
    remaining: opt(S.Natural, "Remaining bytes."),
    state: opt(S.String, "Quota state (normal/nearing/critical/exceeded)."),
    total: opt(S.Natural, "Total bytes."),
    used: opt(S.Natural, "Used bytes."),
  },
  $I.annote("GraphQuota", { description: "A drive storage quota summary." })
) {}

/**
 * A Graph `siteCollection` descriptor.
 *
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
export class GraphSiteCollection extends S.Class<GraphSiteCollection>($I`GraphSiteCollection`)(
  {
    hostname: opt(S.String, "Site collection hostname."),
  },
  $I.annote("GraphSiteCollection", { description: "A Graph siteCollection descriptor." })
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
export class GraphEmailAddress extends S.Class<GraphEmailAddress>($I`GraphEmailAddress`)(
  {
    address: opt(S.String, "Email address."),
    name: opt(S.String, "Display name."),
  },
  $I.annote("GraphEmailAddress", { description: "A Graph emailAddress." })
) {}

/**
 * A Graph mail `recipient` wrapper.
 *
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
export class GraphRecipient extends S.Class<GraphRecipient>($I`GraphRecipient`)(
  {
    emailAddress: opt(GraphEmailAddress, "The recipient's email address."),
  },
  $I.annote("GraphRecipient", { description: "A Graph mail recipient wrapper." })
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
export class GraphItemBody extends S.Class<GraphItemBody>($I`GraphItemBody`)(
  {
    content: opt(S.String, "Body content (never logged in spans)."),
    contentType: opt(S.String, "Body content type (text/html)."),
  },
  $I.annote("GraphItemBody", { description: "A Graph itemBody." })
) {}

/**
 * A Graph `dateTimeTimeZone` pair.
 *
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
export class GraphDateTimeTimeZone extends S.Class<GraphDateTimeTimeZone>($I`GraphDateTimeTimeZone`)(
  {
    dateTime: opt(S.String, "ISO-8601 local date-time."),
    timeZone: opt(S.String, "IANA/Windows time-zone identifier."),
  },
  $I.annote("GraphDateTimeTimeZone", { description: "A Graph dateTimeTimeZone pair." })
) {}

/**
 * A Graph event `location` descriptor.
 *
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
export class GraphLocation extends S.Class<GraphLocation>($I`GraphLocation`)(
  {
    displayName: opt(S.String, "Location display name."),
    locationType: opt(S.String, "Location type."),
  },
  $I.annote("GraphLocation", { description: "A Graph event location." })
) {}

/**
 * A Graph `contentTypeInfo` reference on a listItem.
 *
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
export class GraphContentTypeInfo extends S.Class<GraphContentTypeInfo>($I`GraphContentTypeInfo`)(
  {
    id: opt(S.String, "Content type id."),
    name: opt(S.String, "Content type name."),
  },
  $I.annote("GraphContentTypeInfo", { description: "A Graph listItem contentTypeInfo." })
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
 * A OneDrive/SharePoint drive (document library).
 *
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
export class GraphDrive extends S.Class<GraphDrive>($I`GraphDrive`)(
  {
    id: S.String.annotateKey({ description: "Drive id." }),
    createdDateTime: opt(S.String, "Creation timestamp."),
    description: opt(S.String, "Drive description."),
    driveType: opt(S.String, "Drive type (personal/business/documentLibrary)."),
    lastModifiedDateTime: opt(S.String, "Last-modified timestamp."),
    name: opt(S.String, "Drive name."),
    quota: opt(GraphQuota, "Storage quota summary."),
    webUrl: opt(S.String, "Browser URL for the drive."),
  },
  $I.annote("GraphDrive", { description: "A OneDrive/SharePoint drive (document library)." })
) {}

/**
 * A SharePoint site.
 *
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
export class GraphSite extends S.Class<GraphSite>($I`GraphSite`)(
  {
    id: S.String.annotateKey({ description: "Composite site id." }),
    createdDateTime: opt(S.String, "Creation timestamp."),
    description: opt(S.String, "Site description."),
    displayName: opt(S.String, "Site display name."),
    lastModifiedDateTime: opt(S.String, "Last-modified timestamp."),
    name: opt(S.String, "Site name."),
    siteCollection: opt(GraphSiteCollection, "Owning site collection."),
    webUrl: opt(S.String, "Browser URL for the site."),
  },
  $I.annote("GraphSite", { description: "A SharePoint site." })
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
export class GraphDriveItem extends S.Class<GraphDriveItem>($I`GraphDriveItem`)(
  {
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
  },
  $I.annote("GraphDriveItem", { description: "A OneDrive/SharePoint driveItem (file or folder)." })
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
export class GraphDriveItemVersion extends S.Class<GraphDriveItemVersion>($I`GraphDriveItemVersion`)(
  {
    id: S.String.annotateKey({ description: "Version id." }),
    "@microsoft.graph.downloadUrl": opt(S.String, "Short-lived preauthenticated version download URL."),
    lastModifiedBy: opt(GraphIdentitySet, "Last-modifying actor set."),
    lastModifiedDateTime: opt(S.String, "Version timestamp."),
    size: opt(GraphNonNegativeInt, "Version size in bytes."),
  },
  $I.annote("GraphDriveItemVersion", { description: "A driveItem version." })
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
export class GraphListItem extends S.Class<GraphListItem>($I`GraphListItem`)(
  {
    id: S.String.annotateKey({ description: "ListItem id." }),
    contentType: opt(GraphContentTypeInfo, "Content type reference."),
    createdDateTime: opt(S.String, "Creation timestamp."),
    eTag: opt(S.String, "Entity tag."),
    fields: opt(S.Record(S.String, S.Unknown), "Open custom-column values (matter/client/app metadata)."),
    lastModifiedDateTime: opt(S.String, "Last-modified timestamp."),
    parentReference: opt(GraphItemReference, "Parent locator."),
    webUrl: opt(S.String, "Browser URL for the item."),
  },
  $I.annote("GraphListItem", { description: "A SharePoint listItem with open custom-column fields." })
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
export class GraphExtendedProperty extends S.Class<GraphExtendedProperty>($I`GraphExtendedProperty`)(
  {
    id: S.String.annotateKey({ description: "Property id (`<type> {<guid>} Name <name>`)." }),
    value: S.String.annotateKey({ description: "Property value in string form." }),
  },
  $I.annote("GraphExtendedProperty", { description: "A Graph single-value extended property." })
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
 * Type for {@link GraphBodyContentType}.
 *
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
 * Free/busy states an Outlook event can show.
 *
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
 * Type for {@link GraphEventShowAs}.
 *
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
 * Preset colors of an Outlook master category.
 *
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
 * Type for {@link GraphCategoryColor}.
 *
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
export class GraphOutlookCategory extends S.Class<GraphOutlookCategory>($I`GraphOutlookCategory`)(
  {
    displayName: S.String.annotateKey({ description: "Category name; unique in the mailbox, case-insensitive." }),
    color: opt(S.String, "Preset color constant (`none`, `preset0`..`preset24`)."),
    id: opt(S.String, "Category id."),
  },
  $I.annote("GraphOutlookCategory", { description: "An Outlook master category." })
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
export class GraphAttachment extends S.Class<GraphAttachment>($I`GraphAttachment`)(
  {
    id: S.String.annotateKey({ description: "Attachment id." }),
    "@odata.type": opt(S.String, "Attachment kind (`#microsoft.graph.fileAttachment`, item or reference)."),
    contentType: opt(S.String, "Attachment MIME type."),
    isInline: opt(S.Boolean, "Whether the attachment is rendered inline in the body."),
    lastModifiedDateTime: opt(S.String, "Last-modified timestamp."),
    name: opt(S.String, "Attachment file name (never logged)."),
    size: opt(GraphNonNegativeInt, "Attachment size in bytes."),
  },
  $I.annote("GraphAttachment", { description: "Metadata of a message attachment." })
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
export class GraphMessage extends S.Class<GraphMessage>($I`GraphMessage`)(
  {
    id: S.String.annotateKey({ description: "Message id." }),
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
  },
  $I.annote("GraphMessage", { description: "An Outlook mail message (read subset)." })
) {}

/**
 * An Outlook calendar event (read subset).
 *
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
export class GraphEvent extends S.Class<GraphEvent>($I`GraphEvent`)(
  {
    id: S.String.annotateKey({ description: "Event id." }),
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
  },
  $I.annote("GraphEvent", { description: "An Outlook calendar event (read subset)." })
) {}
