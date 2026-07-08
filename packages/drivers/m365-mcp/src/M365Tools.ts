/**
 * Schema-first Microsoft 365 MCP tool declarations.
 *
 * @remarks
 * The toolkit mirrors the read side of `@beep/m365`. No write, mutation, or
 * ingestion verbs are exposed here.
 *
 * @category tools
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import {
  GraphEvent,
  GraphListItem,
  GraphMessage,
  GraphSite,
  M365DeltaDriveItemsRequest,
  M365DownloadDriveItemContentRequest,
  M365DriveCollection,
  M365DriveItemCollection,
  M365DriveItemDownload,
  M365DriveItemVersionCollection,
  M365ErrorReason,
  M365EventCollection,
  M365GetEventRequest,
  M365GetListItemRequest,
  M365GetMessageRequest,
  M365GetSiteRequest,
  M365ListDriveItemVersionsRequest,
  M365ListDrivesRequest,
  M365ListEventsRequest,
  M365ListMessagesRequest,
  M365ListSitesRequest,
  M365MessageCollection,
  M365SiteCollection,
} from "@beep/m365";
import { annotateFourHints, readOnlyToolHints } from "@beep/mcp-kit";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";

const $I = $M365McpId.create("M365Tools");

/**
 * Structured failure returned by Microsoft 365 MCP tools.
 *
 * @example
 * ```ts
 * import { M365ToolError } from "@beep/m365-mcp"
 * import * as O from "effect/Option"
 *
 * const failure = M365ToolError.make({
 *   message: "Microsoft 365 listDrives failed: throttled",
 *   operation: "listDrives",
 *   reason: O.some("throttled"),
 *   retryable: true,
 *   toolName: "m365_list_drives"
 * })
 *
 * console.log(failure.retryable)
 * // true
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export class M365ToolError extends S.Class<M365ToolError>($I`M365ToolError`)(
  {
    message: S.NonEmptyString.annotateKey({
      description: "Human-readable failure message safe to return to an MCP tool caller.",
    }),
    operation: S.NonEmptyString.annotateKey({
      description: "Driver operation that failed.",
    }),
    reason: S.OptionFromOptionalKey(M365ErrorReason).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Stable failure category or driver error reason.",
    }),
    retryable: S.Boolean.annotateKey({
      description: "Whether retrying the same tool call may reasonably succeed.",
    }),
    toolName: S.NonEmptyString.annotateKey({
      description: "MCP tool that returned the failure.",
    }),
  },
  $I.annote("M365ToolError", {
    description: "Structured Microsoft 365 MCP tool failure with retry metadata.",
  })
) {}

/**
 * Lists SharePoint and OneDrive drives visible through the configured tenant.
 *
 * @example
 * ```ts
 * import { M365ListDrivesTool } from "@beep/m365-mcp"
 *
 * console.log(M365ListDrivesTool.name)
 * // "m365_list_drives"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365ListDrivesTool = annotateFourHints(
  Tool.make("m365_list_drives", {
    description: "List Microsoft 365 drives for an optional site.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365ListDrivesRequest,
    success: M365DriveCollection,
  }),
  readOnlyToolHints
);

/**
 * Lists SharePoint sites visible through the configured tenant.
 *
 * @example
 * ```ts
 * import { M365ListSitesTool } from "@beep/m365-mcp"
 *
 * console.log(M365ListSitesTool.name)
 * // "m365_list_sites"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365ListSitesTool = annotateFourHints(
  Tool.make("m365_list_sites", {
    description: "List Microsoft 365 SharePoint sites.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365ListSitesRequest,
    success: M365SiteCollection,
  }),
  readOnlyToolHints
);

/**
 * Loads a single SharePoint site by id or path.
 *
 * @example
 * ```ts
 * import { M365GetSiteTool } from "@beep/m365-mcp"
 *
 * console.log(M365GetSiteTool.name)
 * // "m365_get_site"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365GetSiteTool = annotateFourHints(
  Tool.make("m365_get_site", {
    description: "Get a Microsoft 365 SharePoint site.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365GetSiteRequest,
    success: GraphSite,
  }),
  readOnlyToolHints
);

/**
 * Reads a drive delta feed for changed drive items.
 *
 * @example
 * ```ts
 * import { M365DeltaDriveItemsTool } from "@beep/m365-mcp"
 *
 * console.log(M365DeltaDriveItemsTool.name)
 * // "m365_delta_drive_items"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365DeltaDriveItemsTool = annotateFourHints(
  Tool.make("m365_delta_drive_items", {
    description: "Read Microsoft 365 drive item delta changes.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365DeltaDriveItemsRequest,
    success: M365DriveItemCollection,
  }),
  readOnlyToolHints
);

/**
 * Downloads drive item bytes or reports that an encrypted item was skipped.
 *
 * @example
 * ```ts
 * import { M365DownloadDriveItemContentTool } from "@beep/m365-mcp"
 *
 * console.log(M365DownloadDriveItemContentTool.name)
 * // "m365_download_drive_item_content"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365DownloadDriveItemContentTool = annotateFourHints(
  Tool.make("m365_download_drive_item_content", {
    description: "Download Microsoft 365 drive item content bytes.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365DownloadDriveItemContentRequest,
    success: M365DriveItemDownload,
  }),
  readOnlyToolHints
);

/**
 * Loads a drive item's SharePoint list item fields.
 *
 * @example
 * ```ts
 * import { M365GetListItemTool } from "@beep/m365-mcp"
 *
 * console.log(M365GetListItemTool.name)
 * // "m365_get_list_item"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365GetListItemTool = annotateFourHints(
  Tool.make("m365_get_list_item", {
    description: "Get Microsoft 365 list item fields for a drive item.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365GetListItemRequest,
    success: GraphListItem,
  }),
  readOnlyToolHints
);

/**
 * Lists versions for a drive item.
 *
 * @example
 * ```ts
 * import { M365ListDriveItemVersionsTool } from "@beep/m365-mcp"
 *
 * console.log(M365ListDriveItemVersionsTool.name)
 * // "m365_list_drive_item_versions"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365ListDriveItemVersionsTool = annotateFourHints(
  Tool.make("m365_list_drive_item_versions", {
    description: "List Microsoft 365 drive item versions.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365ListDriveItemVersionsRequest,
    success: M365DriveItemVersionCollection,
  }),
  readOnlyToolHints
);

/**
 * Lists Outlook mail messages.
 *
 * @example
 * ```ts
 * import { M365ListMessagesTool } from "@beep/m365-mcp"
 *
 * console.log(M365ListMessagesTool.name)
 * // "m365_list_messages"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365ListMessagesTool = annotateFourHints(
  Tool.make("m365_list_messages", {
    description: "List Microsoft 365 Outlook mail messages.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365ListMessagesRequest,
    success: M365MessageCollection,
  }),
  readOnlyToolHints
);

/**
 * Loads a single Outlook mail message.
 *
 * @example
 * ```ts
 * import { M365GetMessageTool } from "@beep/m365-mcp"
 *
 * console.log(M365GetMessageTool.name)
 * // "m365_get_message"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365GetMessageTool = annotateFourHints(
  Tool.make("m365_get_message", {
    description: "Get a Microsoft 365 Outlook mail message.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365GetMessageRequest,
    success: GraphMessage,
  }),
  readOnlyToolHints
);

/**
 * Lists Outlook calendar events.
 *
 * @example
 * ```ts
 * import { M365ListEventsTool } from "@beep/m365-mcp"
 *
 * console.log(M365ListEventsTool.name)
 * // "m365_list_events"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365ListEventsTool = annotateFourHints(
  Tool.make("m365_list_events", {
    description: "List Microsoft 365 Outlook calendar events.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365ListEventsRequest,
    success: M365EventCollection,
  }),
  readOnlyToolHints
);

/**
 * Loads a single Outlook calendar event.
 *
 * @example
 * ```ts
 * import { M365GetEventTool } from "@beep/m365-mcp"
 *
 * console.log(M365GetEventTool.name)
 * // "m365_get_event"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365GetEventTool = annotateFourHints(
  Tool.make("m365_get_event", {
    description: "Get a Microsoft 365 Outlook calendar event.",
    failure: M365ToolError,
    failureMode: "return",
    parameters: M365GetEventRequest,
    success: GraphEvent,
  }),
  readOnlyToolHints
);

/**
 * Read-only Microsoft 365 MCP toolkit.
 *
 * @example
 * ```ts
 * import { M365Toolkit } from "@beep/m365-mcp"
 *
 * console.log(Object.keys(M365Toolkit.tools).includes("m365_list_drives"))
 * // true
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export const M365Toolkit = Toolkit.make(
  M365ListDrivesTool,
  M365ListSitesTool,
  M365GetSiteTool,
  M365DeltaDriveItemsTool,
  M365DownloadDriveItemContentTool,
  M365GetListItemTool,
  M365ListDriveItemVersionsTool,
  M365ListMessagesTool,
  M365GetMessageTool,
  M365ListEventsTool,
  M365GetEventTool
);

/**
 * Read-only Microsoft 365 MCP toolkit type.
 *
 * @example
 * ```ts
 * import { M365Toolkit } from "@beep/m365-mcp"
 *
 * const toolkit: M365Toolkit = M365Toolkit
 * console.log(Object.keys(toolkit.tools).length)
 * // 11
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export type M365Toolkit = typeof M365Toolkit;
