/**
 * Bun sidecar entry for the desktop chat surface.
 *
 * SPEC (increment 6b-3): serve the {@link ChatRpcs} group backed by the app-local
 * {@link RuntimeLive} runtime (live assistant-turn kernel + Drizzle ThreadStore +
 * Drizzle usage-record sink, all over one PGlite-backed database with migrations
 * applied on boot).
 *
 * The transport is selected by `CHAT_TRANSPORT` (default `http`):
 * - `http` — the original idiom: `RpcServer.layerProtocolHttp({ path: "/rpc" })`
 *   + `RpcSerialization.layerNdjson`, served by the Bun HTTP server on loopback
 *   `:3939` with permissive CORS and a generous `idleTimeout` so streamed turns
 *   are not severed during silent tails. The webview rides this over `fetch`.
 * - `ipc` — `RpcServer.layerProtocolStdio` over the same ndjson serialization:
 *   rpc frames flow on the process's stdin/stdout, which the Tauri Rust shell
 *   bridges to the webview (see `src-tauri/src/lib.rs`). Logs are forced onto
 *   stderr so they never corrupt the stdout frame stream.
 *
 * Run keyless for dev with `bun run dev:sidecar` (sets `CHAT_AGENT=fixture`); the
 * default `CHAT_AGENT=anthropic` requires `AI_ANTHROPIC_API_KEY`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import "./IpcStdoutGuard.prelude.ts";

import { ChatRpcs } from "@beep/agents-use-cases/public";
import { ExecutionAuthorityConfigLive } from "@beep/execution-authority-config/layer";
import { ExecutionLedgerDrizzle } from "@beep/execution-authority-server/ExecutionLedger";
import { OntologyMcpConfigLive } from "@beep/ontology-config/layer";
import { OntologyMcpMutationsEnabledConfig } from "@beep/ontology-config/server";
import { Workspace } from "@beep/workspace-server";
import { BunHttpServer, BunRuntime, BunServices } from "@effect/platform-bun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as HttpMiddleware from "effect/http/HttpMiddleware";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import { RuntimeLive, VaultSyncDesktopHostLive } from "@/runtime/Layer";
import { SidecarReadyMarker } from "@/runtime/Migrations";
import { PgliteDrizzleLive } from "@/runtime/Pglite";
import { DesktopRpcs } from "./DesktopRpcs.ts";
import { ipcTransport, SidecarStdioLive } from "./IpcStdoutGuard.ts";
import { makeOntologyMcpTransportLayer, OntologyMcpTransportOptions } from "./OntologyMcpTransport.ts";
import { DesktopRpcSessionToken, RpcSessionAuthLayer } from "./RpcSessionAuth.ts";
import { makeVaultSyncTransportLayer } from "./VaultSyncTransport.ts";
import type { ServeError } from "effect/http/HttpServerError";
import type * as Redacted from "effect/Redacted";
import type { DesktopStartupError } from "@/runtime/Layer";

const PORT = Effect.runSync(Config.Port("CHAT_SIDECAR_PORT").pipe(Config.withDefault(3939)));
const RPC_SESSION_TOKEN = Effect.runSync(DesktopRpcSessionToken);
// decision: http-idle-timeout-at-bun-max
const bunMaxIdleTimeoutSeconds = 255;

// decision: http-desktop-rpcs-require-launch-token
const DesktopRpcServer = RpcServer.layer(DesktopRpcs).pipe(Layer.provide(RuntimeLive));
const ChatOnlyRpcServer = RpcServer.layer(ChatRpcs).pipe(Layer.provide(RuntimeLive));

// decision: http-rpc-handlers-inside-served-app
const httpMain = (): Layer.Layer<never, DesktopStartupError | ServeError> => {
  const RpcCors = HttpRouter.middleware(
    HttpMiddleware.cors({
      allowedOrigins: ["*"],
      allowedMethods: ["POST", "OPTIONS"],
      allowedHeaders: ["*"],
    })
  );
  const Protocol = RpcServer.layerProtocolHttp({ path: "/rpc" }).pipe(
    Layer.provide(RpcCors.layer),
    Layer.provide(HttpRouter.layer)
  );
  const RpcPreflight = HttpRouter.add("OPTIONS", "/rpc", HttpServerResponse.empty({ status: 204 })).pipe(
    Layer.provide(RpcCors.layer),
    Layer.provide(HttpRouter.layer)
  );
  const RpcServerLive: Layer.Layer<never, DesktopStartupError, RpcServer.Protocol> = O.isSome(RPC_SESSION_TOKEN)
    ? DesktopRpcServer
    : ChatOnlyRpcServer;
  const Auth = O.match(RPC_SESSION_TOKEN, {
    onNone: () => Layer.empty,
    onSome: (token: Redacted.Redacted<string>) => RpcSessionAuthLayer(token).pipe(Layer.provide(HttpRouter.layer)),
  });
  const OntologyMcp = O.match(RPC_SESSION_TOKEN, {
    onNone: () => Layer.empty,
    onSome: (token: Redacted.Redacted<string>) =>
      makeOntologyMcpTransportLayer(OntologyMcpTransportOptions.make({ token })).pipe(
        Layer.provide(OntologyMcpConfigLive),
        Layer.provide(ExecutionLedgerDrizzle),
        Layer.provide(ExecutionAuthorityConfigLive),
        Layer.provide(PgliteDrizzleLive),
        Layer.provide(HttpRouter.layer)
      ),
  });
  const VaultSyncTransport = O.match(RPC_SESSION_TOKEN, {
    onNone: () => Layer.empty,
    onSome: (token: Redacted.Redacted<string>) =>
      makeVaultSyncTransportLayer({ token }).pipe(
        Layer.provide(VaultSyncDesktopHostLive),
        Layer.provide(Workspace.WorkspaceVaultStoreDrizzleLayer),
        Layer.provide(PgliteDrizzleLive),
        Layer.provide(BunServices.layer),
        Layer.provide(HttpRouter.layer),
        // decision: vault-sync-transport-failure-is-non-fatal
        Layer.catchCause((cause) =>
          Layer.effectDiscard(
            Effect.logError("vault sync transport is unavailable").pipe(
              Effect.annotateLogs({ cause: Cause.pretty(cause) })
            )
          )
        )
      ),
  });
  const App = Layer.mergeAll(Protocol, RpcPreflight, Auth, OntologyMcp, VaultSyncTransport);
  return HttpRouter.serve(RpcServerLive.pipe(Layer.provideMerge(App))).pipe(
    Layer.provide(BunHttpServer.layer({ hostname: "127.0.0.1", port: PORT, idleTimeout: bunMaxIdleTimeoutSeconds })),
    Layer.provide(RpcSerialization.layerNdjson),
    Layer.provide(BunCrypto.layer)
  );
};

// decision: ipc-stdout-reserved-for-protocol-frames
const ipcMain = (): Layer.Layer<never, DesktopStartupError> =>
  DesktopRpcServer.pipe(
    Layer.provide(RpcServer.layerProtocolStdio),
    Layer.provide(SidecarStdioLive),
    Layer.provide(RpcSerialization.layerNdjson),
    Layer.provide(
      Logger.layer([Logger.withConsoleError(Logger.formatLogFmt), Logger.tracerLogger], { mergeWithExisting: false })
    )
  );

const Main = (ipcTransport ? ipcMain() : httpMain()).pipe(
  Layer.tap(
    Effect.fnUntraced(function* () {
      const ontologyMcpMutationsEnabled = yield* OntologyMcpMutationsEnabledConfig;
      yield* Effect.logInfo("professional desktop sidecar ready").pipe(
        Effect.annotateLogs({
          auth_enabled: O.isSome(RPC_SESSION_TOKEN),
          ontology_mcp_mutations_enabled: ontologyMcpMutationsEnabled,
          port: PORT,
          transport: ipcTransport ? "ipc" : "http",
        })
      );
      yield* Effect.addFinalizer(() =>
        Effect.logInfo("professional desktop sidecar stopping").pipe(
          Effect.annotateLogs({ transport: ipcTransport ? "ipc" : "http" })
        )
      );
      yield* Console.error(SidecarReadyMarker);
    })
  ),
  Layer.withSpan("professional_desktop.sidecar.runtime")
);

Main.pipe(Layer.launch, BunRuntime.runMain);
