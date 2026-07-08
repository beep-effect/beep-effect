/**
 * Microsoft 365 MCP tool handlers.
 *
 * @remarks
 * Handlers are thin wrappers around the `@beep/m365` driver. They translate
 * driver errors into the local `M365ToolError` failure schema and annotate
 * spans with counts and sizes only.
 *
 * @category handlers
 * @since 0.1.0
 */

import { M365 } from "@beep/m365";
import { Effect, Match } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import { M365ToolError, M365Toolkit } from "./M365Tools.ts";
import type {
  M365DeltaDriveItemsRequest,
  M365DownloadDriveItemContentRequest,
  M365DriveItemDownload as M365DriveItemDownloadType,
  M365Error,
  M365ListDriveItemVersionsRequest,
  M365ListDrivesRequest,
  M365ListEventsRequest,
  M365ListMessagesRequest,
  M365ListSitesRequest,
} from "@beep/m365";
import type * as Layer from "effect/Layer";
import type * as Tool from "effect/unstable/ai/Tool";

type M365ToolErrorValue = M365ToolError;

const isRetryableM365Error = (error: M365Error): boolean =>
  error.reason === "throttled" || error.reason === "transport";

const toM365ToolError =
  (toolName: string, operation: string) =>
  (error: M365Error): M365ToolErrorValue =>
    M365ToolError.make({
      message: `Microsoft 365 ${operation} failed: ${error.reason}`,
      operation,
      reason: O.some(error.reason),
      retryable: isRetryableM365Error(error),
      toolName,
    });

const finalizeM365Tool =
  (toolName: string, operation: string) =>
  <A2, R>(effect: Effect.Effect<A2, M365Error, R>): Effect.Effect<A2, M365ToolErrorValue, R> =>
    effect.pipe(Effect.mapError(toM365ToolError(toolName, operation)));

const annotateCollection = <Collection extends { readonly value: ReadonlyArray<unknown> }>(
  resource: string,
  collection: Collection
): Effect.Effect<Collection> =>
  Effect.annotateCurrentSpan({
    m365_mcp_resource: resource,
    m365_mcp_result_count: A.length(collection.value),
  }).pipe(Effect.as(collection));

const annotateDownload = (download: M365DriveItemDownloadType): Effect.Effect<M365DriveItemDownloadType> =>
  Match.type<M365DriveItemDownloadType>().pipe(
    Match.withReturnType<Effect.Effect<M365DriveItemDownloadType>>(),
    Match.tagsExhaustive({
      M365DownloadedContent: (result) =>
        Effect.annotateCurrentSpan({
          m365_mcp_download_size_bytes: result.bytes.byteLength,
          m365_mcp_item_size_bytes: pipe(result.item.size, O.getOrUndefined),
          m365_mcp_resource: "drive_item_content",
        }).pipe(Effect.as(download)),
      M365SkippedEncryptedItem: (result) =>
        Effect.annotateCurrentSpan({
          m365_mcp_download_skipped: "encrypted item",
          m365_mcp_item_size_bytes: pipe(result.item.size, O.getOrUndefined),
          m365_mcp_resource: "drive_item_content",
        }).pipe(Effect.as(download)),
    })
  )(download);

/**
 * Live handler layer for the Microsoft 365 MCP toolkit.
 *
 * @example
 * ```ts
 * import { M365ToolkitHandlersLive } from "@beep/m365-mcp"
 * import { M365, M365ConfigInput } from "@beep/m365"
 * import { Layer } from "effect"
 *
 * const layer = M365ToolkitHandlersLive.pipe(
 *   Layer.provide(M365.makeLiveLayer(M365ConfigInput.make({ tenantId: "common", clientId: "client-id" })))
 * )
 * console.log(Layer.isLayer(layer))
 * // true
 * ```
 *
 * @category layers
 * @since 0.1.0
 */
export const M365ToolkitHandlersLive: Layer.Layer<
  Tool.HandlersFor<typeof M365Toolkit.tools>,
  never,
  M365
> = M365Toolkit.toLayer(
  Effect.gen(function* () {
    const m365 = yield* M365;

    return M365Toolkit.of({
      m365_delta_drive_items: Effect.fn("M365Mcp.m365_delta_drive_items")(
        function* (request: M365DeltaDriveItemsRequest) {
          const collection = yield* m365.deltaDriveItems(request);

          return yield* annotateCollection("drive_items", collection);
        },
        finalizeM365Tool("m365_delta_drive_items", "deltaDriveItems")
      ),
      m365_download_drive_item_content: Effect.fn("M365Mcp.m365_download_drive_item_content")(
        function* (request: M365DownloadDriveItemContentRequest) {
          const download = yield* m365.downloadDriveItemContent(request);

          return yield* annotateDownload(download);
        },
        finalizeM365Tool("m365_download_drive_item_content", "downloadDriveItemContent")
      ),
      m365_get_event: Effect.fn("M365Mcp.m365_get_event")(
        m365.getEvent,
        finalizeM365Tool("m365_get_event", "getEvent")
      ),
      m365_get_list_item: Effect.fn("M365Mcp.m365_get_list_item")(
        m365.getListItem,
        finalizeM365Tool("m365_get_list_item", "getListItem")
      ),
      m365_get_message: Effect.fn("M365Mcp.m365_get_message")(
        m365.getMessage,
        finalizeM365Tool("m365_get_message", "getMessage")
      ),
      m365_get_site: Effect.fn("M365Mcp.m365_get_site")(m365.getSite, finalizeM365Tool("m365_get_site", "getSite")),
      m365_list_drive_item_versions: Effect.fn("M365Mcp.m365_list_drive_item_versions")(
        function* (request: M365ListDriveItemVersionsRequest) {
          const collection = yield* m365.listDriveItemVersions(request);

          return yield* annotateCollection("drive_item_versions", collection);
        },
        finalizeM365Tool("m365_list_drive_item_versions", "listDriveItemVersions")
      ),
      m365_list_drives: Effect.fn("M365Mcp.m365_list_drives")(
        function* (request: M365ListDrivesRequest) {
          const collection = yield* m365.listDrives(request);

          return yield* annotateCollection("drives", collection);
        },
        finalizeM365Tool("m365_list_drives", "listDrives")
      ),
      m365_list_events: Effect.fn("M365Mcp.m365_list_events")(
        function* (request: M365ListEventsRequest) {
          const collection = yield* m365.listEvents(request);

          return yield* annotateCollection("events", collection);
        },
        finalizeM365Tool("m365_list_events", "listEvents")
      ),
      m365_list_messages: Effect.fn("M365Mcp.m365_list_messages")(
        function* (request: M365ListMessagesRequest) {
          const collection = yield* m365.listMessages(request);

          return yield* annotateCollection("messages", collection);
        },
        finalizeM365Tool("m365_list_messages", "listMessages")
      ),
      m365_list_sites: Effect.fn("M365Mcp.m365_list_sites")(
        function* (request: M365ListSitesRequest) {
          const collection = yield* m365.listSites(request);

          return yield* annotateCollection("sites", collection);
        },
        finalizeM365Tool("m365_list_sites", "listSites")
      ),
    });
  })
);
