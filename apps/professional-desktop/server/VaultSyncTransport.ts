/**
 * Authenticated vault-sync Api transports for the desktop sidecar: HTTP, remote CLI RPC and MCP.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  layerVaultSyncTransportSession,
  VAULT_SYNC_RPC_PATH,
  VaultSyncHttp,
  VaultSyncMcpLive,
  VaultSyncMembershipLive,
  VaultSyncRpcHttp,
  VaultSyncSessionBinding,
} from "@beep/documents-server/aggregates/Sync";
import { vaultSyncRemoteCli } from "@beep/documents-use-cases/aggregates/VaultSync";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpServer from "effect/ai/McpServer";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { desktopMcpSecurityMiddleware, ontologyMcpAllowedOrigins } from "./OntologyMcpTransport.ts";
import { DesktopRpcSessionTokenRequired, rpcSessionAuthorizationHeader } from "./RpcSessionAuth.ts";
import type * as Redacted from "effect/Redacted";

/**
 * Path of the vault-sync MCP route on the sidecar.
 *
 * @category configuration
 * @since 0.0.0
 */
export const VAULT_SYNC_MCP_PATH = "/vault-sync/mcp" as const;

/**
 * The signed-in desktop principal and its workspace, bound to the launch token.
 *
 * **Details**
 *
 * The same user, organization and workspace the desktop already acts as for contradiction review.
 * The value carries no credential; grants are read live from shared membership on every call.
 *
 * **Example** (Decode the desktop request)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { desktopVaultSyncRequest } from "./VaultSyncTransport.ts"
 * Effect.runPromise(desktopVaultSyncRequest).then((request) => console.log(request.orgId))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const desktopVaultSyncRequest = S.decodeEffect(V.VaultSyncRequest)({
  principal: { kind: "User", userId: 1 },
  actorSourceKind: "User",
  sourceKind: "sidecar",
  orgId: 1,
  workspaceId: 1,
  correlationId: "desktop-launch",
  sessionRef: "desktop-launch",
});

/**
 * Binds the launch token to the desktop principal for every vault-sync session adapter.
 *
 * **Example** (Build the binding)
 *
 * ```ts
 * import * as Layer from "effect/Layer";
 * import * as Redacted from "effect/Redacted";
 * import { layerDesktopVaultSyncBinding } from "./VaultSyncTransport.ts"
 * console.log(Layer.isLayer(layerDesktopVaultSyncBinding(Redacted.make("test-token"))))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerDesktopVaultSyncBinding = (token: Redacted.Redacted<string>) =>
  Layer.effect(
    VaultSyncSessionBinding,
    desktopVaultSyncRequest.pipe(
      Effect.map((request) => VaultSyncSessionBinding.of({ request, token })),
      Effect.orDie
    )
  );

/**
 * HTTP, remote-CLI RPC and Views-only MCP routes over one hosted vault-sync model.
 *
 * **Details**
 *
 * Each route has its own session adapter, so the transport kind recorded in provenance is
 * the route's, never a header's. MCP authenticates as the ontology MCP route does: origin
 * allowlist, launch token and CORS. The layer still needs the hosted vault-sync model and
 * the sidecar SqlClient, which the single-writer activation provides when it mounts this.
 *
 * **Example** (Build the transport layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer";
 * import * as Redacted from "effect/Redacted";
 * import { makeVaultSyncTransportLayer } from "./VaultSyncTransport.ts"
 * console.log(Layer.isLayer(makeVaultSyncTransportLayer({ token: Redacted.make("test-token") })))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeVaultSyncTransportLayer = (options: { readonly token: Redacted.Redacted<string> }) => {
  const http = HttpApiBuilder.layer(VaultSyncHttp.api).pipe(
    Layer.provide(VaultSyncHttp.layer),
    Layer.provide(layerVaultSyncTransportSession("http"))
  );
  const rpc = VaultSyncRpcHttp.pipe(Layer.provide(layerVaultSyncTransportSession("cli")));
  const server = McpServer.layerHttp({
    name: "beep-vault-sync",
    version: "0.0.0",
    path: VAULT_SYNC_MCP_PATH,
    protocols: [McpProtocol.v2025_06_18],
    allowedOrigins: ontologyMcpAllowedOrigins,
  }).pipe(Layer.provide(desktopMcpSecurityMiddleware(options.token).layer), Layer.orDie);
  const mcp = VaultSyncMcpLive.pipe(Layer.provide(layerVaultSyncTransportSession("mcp")), Layer.provide(server));
  return Layer.mergeAll(http, rpc, mcp).pipe(
    Layer.provide(Layer.mergeAll(layerDesktopVaultSyncBinding(options.token), VaultSyncMembershipLive))
  );
};

/**
 * Remote CLI against a running sidecar; the launch token is read per call from the handoff env.
 *
 * **Details**
 *
 * The token stays redacted and is only placed in the Authorization header. A sidecar in IPC
 * mode serves no HTTP, so the remote CLI then fails to connect rather than falling back.
 *
 * **Example** (Build the remote CLI)
 *
 * ```ts
 * import { desktopVaultSyncRemoteCli } from "./VaultSyncTransport.ts"
 * console.log(typeof desktopVaultSyncRemoteCli(3939))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const desktopVaultSyncRemoteCli = (port: number) =>
  vaultSyncRemoteCli({
    url: `http://127.0.0.1:${port}${VAULT_SYNC_RPC_PATH}`,
    headers: Effect.map(DesktopRpcSessionTokenRequired, (token) => ({
      authorization: rpcSessionAuthorizationHeader(token),
    })),
  });
