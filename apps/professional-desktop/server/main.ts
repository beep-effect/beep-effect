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

// Guard IPC stdout before application and sidecar service modules load. The
// prelude's functional utility imports are covered by the IPC stdio integration
// test, which proves startup emits only protocol frames on stdout.
import "./IpcStdoutGuard.prelude.ts";

import { ChatRpcs } from "@beep/agents-use-cases/public";
import { EpistemicConfigLive } from "@beep/epistemic-config/layer";
import { ExecutionLedgerDrizzle } from "@beep/epistemic-server/ExecutionLedger";
import { OntologyMcpConfigLive } from "@beep/ontology-config/layer";
import { OntologyMcpMutationsEnabledConfig } from "@beep/ontology-config/server";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import { HttpMiddleware, HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { RuntimeLive } from "@/runtime/Layer";
import { SidecarReadyMarker } from "@/runtime/Migrations";
import { PgliteDrizzleLive } from "@/runtime/Pglite";
import { DesktopRpcs } from "./DesktopRpcs.ts";
import { ipcTransport, SidecarStdioLive } from "./IpcStdoutGuard.ts";
import { makeOntologyMcpTransportLayer } from "./OntologyMcpTransport.ts";
import { DesktopRpcSessionToken, RpcSessionAuthLayer } from "./RpcSessionAuth.ts";
import type * as Redacted from "effect/Redacted";
import type { DesktopStartupError } from "@/runtime/Layer";

// Loopback rpc port; defaults to 3939 (the desktop chat surface's sidecar
// port). Configurable via CHAT_SIDECAR_PORT for tests/dev that need a free port.
const PORT = Effect.runSync(Config.port("CHAT_SIDECAR_PORT").pipe(Config.withDefault(3939)));
const RPC_SESSION_TOKEN = Effect.runSync(DesktopRpcSessionToken);

// The full desktop group includes write-capable workspace vault, document
// intake, vault sync, ontology workbench, and contradiction-triage RPCs. HTTP only exposes that
// group when the per-launch bearer token is configured; otherwise dev HTTP falls back to
// chat-only RPCs so loopback HTTP never exposes non-chat writes without an
// unguessable shell-issued token.
// IPC keeps the full group because it is reachable only through the Tauri shell
// bridge, where `sidecar_send` also requires the same per-launch token.
const DesktopRpcServer = RpcServer.layer(DesktopRpcs).pipe(Layer.provide(RuntimeLive));
const ChatOnlyRpcServer = RpcServer.layer(ChatRpcs).pipe(Layer.provide(RuntimeLive));

// HTTP transport (default): one HttpRouter carries the rpc protocol and the CORS
// middleware via layer memoization, served by HttpRouter.serve.
const httpMain = (): Layer.Layer<never, DesktopStartupError> => {
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
      makeOntologyMcpTransportLayer({ token }).pipe(
        Layer.provide(OntologyMcpConfigLive),
        Layer.provide(ExecutionLedgerDrizzle),
        Layer.provide(EpistemicConfigLive),
        // The same module-level const RuntimeLive provides: layer memoization
        // builds one PGlite instance shared by the rpc handlers and the
        // governed MCP gate's execution ledger.
        Layer.provide(PgliteDrizzleLive),
        Layer.provide(HttpRouter.layer)
      ),
  });
  const App = Layer.mergeAll(Protocol, RpcPreflight, Auth, OntologyMcp);
  return RpcServerLive.pipe(
    Layer.provideMerge(App),
    Layer.provide(HttpRouter.serve(App)),
    // Bun's default 10s idleTimeout severs streamed responses during the silent
    // tail of a turn (no bytes flow while the kernel thinks); 255s is Bun's max
    // and covers the turn budget. Mirrors the POC.
    Layer.provide(BunHttpServer.layer({ hostname: "127.0.0.1", port: PORT, idleTimeout: 255 })),
    Layer.provide(RpcSerialization.layerNdjson)
  );
};

// IPC transport: ndjson rpc frames ride stdin/stdout (bridged to the webview by
// the Tauri Rust shell). Logs are pinned to stderr so they never interleave with
// the stdout frame stream the bridge parses.
const ipcMain = (): Layer.Layer<never, DesktopStartupError> =>
  DesktopRpcServer.pipe(
    Layer.provide(RpcServer.layerProtocolStdio),
    Layer.provide(SidecarStdioLive),
    Layer.provide(RpcSerialization.layerNdjson),
    Layer.provide(Logger.layer([Logger.withConsoleError(Logger.formatLogFmt)], { mergeWithExisting: false }))
  );

const Main = (ipcTransport ? ipcMain() : httpMain()).pipe(
  Layer.tap(
    Effect.fnUntraced(function* () {
      // Read the declaration rather than the OntologyMcpConfig service: the IPC
      // branch never mounts the MCP transport, so requiring the service here
      // would infect a transport that has no ontology MCP surface at all.
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
      yield* Effect.sync(() => {
        process.stderr.write(`${SidecarReadyMarker}\n`);
      });
    })
  ),
  Layer.withSpan("professional_desktop.sidecar.runtime")
);

BunRuntime.runMain(Layer.launch(Main));
