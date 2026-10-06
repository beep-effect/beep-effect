/**
 * Microsoft 365 outbox MCP stdio server wiring.
 *
 * **Details**
 *
 * A second server beside the read-only one. It has its own toolkit, its own
 * instructions and its own Entra registration, and it runs on the driver's
 * app-only lane for one configured mailbox.
 *
 * @category layers
 * @since 0.1.0
 */

import { M365 } from "@beep/m365";
import { sanitizedToolkit } from "@beep/mcp-kit";
import { Layer } from "effect";
import * as McpServer from "effect/ai/McpServer";
import { dual } from "effect/Function";
import { m365McpProtocols } from "./internal/McpProtocols.ts";
import { OutboxAttachmentSource } from "./OutboxAttachmentSource.ts";
import { OutboxAuditIds, OutboxAuditLog } from "./OutboxAuditLog.ts";
import { makeOutboxToolkitHandlers, OutboxHandlerSettings } from "./OutboxHandlers.ts";
import { OutboxToolkit } from "./OutboxTools.ts";
import type { M365Error } from "@beep/m365";
import type { Crypto, FileSystem, Path } from "effect";
import type { Stdio } from "effect/Stdio";
import type { OutboxAttachmentError } from "./OutboxAttachmentSource.ts";
import type { OutboxAuditError } from "./OutboxAuditLog.ts";
import type { OutboxConfig } from "./OutboxConfig.ts";
import type { M365McpServerConfig } from "./Server.ts";

/**
 * Instructions the outbox host advertises through `server/discover`.
 *
 * **Example** (Reading the advertised instructions)
 *
 * ```ts
 * import { M365_OUTBOX_MCP_INSTRUCTIONS } from "@beep/m365-mcp/OutboxServer"
 *
 * console.log(M365_OUTBOX_MCP_INSTRUCTIONS.startsWith("Microsoft 365 outbox"))
 * // true
 * ```
 *
 * @category constants
 * @since 0.1.0
 */
export const M365_OUTBOX_MCP_INSTRUCTIONS =
  "Microsoft 365 outbox for one configured mailbox: prepare a mail draft with attachments from local paths, read or delete that draft, send it, and create or update calendar events. Only m365_outbox_send_draft sends mail. It sends exactly the stored draft and refuses when the draft differs from the expect block, so restate the recipients, subject and attachments (name, size and sha256 exactly as create_draft or get_draft returned them). After an outcome of unknown, call m365_outbox_get_draft: a draft that is gone was sent. Never send again blindly. Clients may open with an initialize handshake or call tools directly; both work.";

/**
 * Services the outbox handlers need: the driver, the attachment source and the
 * audit log.
 *
 * **Example** (Name the handler services)
 *
 * ```ts
 * import type { OutboxServices } from "@beep/m365-mcp/OutboxServer"
 * import type { Layer } from "effect"
 *
 * const describe = (layer: Layer.Layer<OutboxServices>) => layer
 * console.log(describe)
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export type OutboxServices = M365 | OutboxAttachmentSource | OutboxAuditLog;

/**
 * Registrations only: the sanitized outbox toolkit and its handlers for one
 * mailbox, with no transport attached.
 *
 * **Example** (Mounting the registrations without a transport)
 *
 * ```ts
 * import { OutboxHandlerSettings } from "@beep/m365-mcp/OutboxHandlers"
 * import { makeOutboxRegistrations } from "@beep/m365-mcp/OutboxServer"
 * import { Layer } from "effect"
 *
 * const settings = OutboxHandlerSettings.make({ mailbox: "mailbox@example.test" })
 * console.log(Layer.isLayer(makeOutboxRegistrations(settings)))
 * // true
 * ```
 *
 * @category layers
 * @since 0.1.0
 */
export const makeOutboxRegistrations = (
  settings: OutboxHandlerSettings
): Layer.Layer<never, never, OutboxServices | Crypto.Crypto> =>
  sanitizedToolkit(OutboxToolkit).pipe(Layer.provide(makeOutboxToolkitHandlers(settings)), Layer.orDie);

/**
 * Builds the outbox stdio MCP server layer.
 *
 * **Details**
 *
 * The host answers `2026-07-28` first (`server/discover`, no session) and
 * also the handshake-era versions `2025-11-25`, `2025-06-18`, `2025-03-26` and
 * `2024-11-05`, because Claude Code and Claude Desktop open every MCP server
 * with `initialize`. A host that lists only `2026-07-28` refuses that
 * handshake and the client reports the server as failed.
 *
 * **Example** (Building the outbox server layer)
 *
 * ```ts
 * import { M365McpServerConfig } from "@beep/m365-mcp"
 * import { OutboxHandlerSettings } from "@beep/m365-mcp/OutboxHandlers"
 * import { makeOutboxServerLayer } from "@beep/m365-mcp/OutboxServer"
 * import { Layer } from "effect"
 *
 * const layer = makeOutboxServerLayer(
 *   M365McpServerConfig.make({ name: "beep-m365-outbox", version: "0.1.0" }),
 *   OutboxHandlerSettings.make({ mailbox: "mailbox@example.test" })
 * )
 * console.log(Layer.isLayer(layer))
 * // true
 * ```
 *
 * @category layers
 * @since 0.1.0
 */
export const makeOutboxServerLayer: {
  (
    settings: OutboxHandlerSettings
  ): (config: M365McpServerConfig) => Layer.Layer<never, never, OutboxServices | Crypto.Crypto | Stdio>;
  (
    config: M365McpServerConfig,
    settings: OutboxHandlerSettings
  ): Layer.Layer<never, never, OutboxServices | Crypto.Crypto | Stdio>;
} = dual(
  2,
  (
    config: M365McpServerConfig,
    settings: OutboxHandlerSettings
  ): Layer.Layer<never, never, OutboxServices | Crypto.Crypto | Stdio> =>
    makeOutboxRegistrations(settings).pipe(
      Layer.provide(
        McpServer.layerStdio({
          name: config.name,
          version: config.version,
          instructions: M365_OUTBOX_MCP_INSTRUCTIONS,
          protocols: m365McpProtocols,
        })
      ),
      Layer.orDie
    )
);

/**
 * The handler settings a resolved outbox configuration implies.
 *
 * **Example** (Derive handler settings)
 *
 * ```ts
 * import { outboxHandlerSettings } from "@beep/m365-mcp/OutboxServer"
 *
 * console.log(typeof outboxHandlerSettings)
 * // "function"
 * ```
 *
 * @category configuration
 * @since 0.1.0
 */
export const outboxHandlerSettings = (config: OutboxConfig): OutboxHandlerSettings =>
  OutboxHandlerSettings.make({
    mailbox: config.mailbox,
    maxAttachments: config.attachments.maxAttachments,
    maxMessageAttachmentBytes: config.attachments.maxMessageAttachmentBytes,
  });

/**
 * Builds the live services of the outbox from its configuration: the app-only
 * driver for the outbox registration, the attachment source and the audit
 * log.
 *
 * **Details**
 *
 * The layer fails when an attachment root cannot be enforced or the audit
 * directory cannot be created, so the server does not start in either case.
 *
 * **Example** (Building the live services)
 *
 * ```ts
 * import { makeOutboxLiveServices } from "@beep/m365-mcp/OutboxServer"
 *
 * console.log(typeof makeOutboxLiveServices)
 * // "function"
 * ```
 *
 * @category layers
 * @since 0.1.0
 */
export const makeOutboxLiveServices = (
  config: OutboxConfig
): Layer.Layer<
  OutboxServices,
  M365Error | OutboxAttachmentError | OutboxAuditError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto
> =>
  Layer.mergeAll(
    M365.makeAppOnlyLiveLayer(config.appOnly),
    OutboxAttachmentSource.layer(config.attachments),
    OutboxAuditLog.layer(config.auditDirectory).pipe(Layer.provide(OutboxAuditIds.layer))
  );
