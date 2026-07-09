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

// Guard IPC stdout before ANY other module loads. The prelude has zero non-stdlib
// imports, so this side-effect import patches stdout before the effect runtime or
// sidecar dependencies can run their module initializers.
import "./IpcStdoutGuard.prelude.ts";

import { ChatRpcs } from "@beep/agents-use-cases/public";
import { OntologyRpcs } from "@beep/ontology-use-cases/aggregates/Session";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Config, Effect, Layer, Logger } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { RuntimeLive } from "@/runtime/Layer";
import { ipcTransport, SidecarStdioLive } from "./IpcStdoutGuard.ts";

// Loopback rpc port; defaults to 3939 (the desktop chat surface's sidecar
// port). Configurable via CHAT_SIDECAR_PORT for tests/dev that need a free port.
const PORT = Effect.runSync(Config.port("CHAT_SIDECAR_PORT").pipe(Config.withDefault(3939)));

const DesktopRpcs = ChatRpcs.merge(OntologyRpcs);

// The DesktopRpcs handler group backed by the app-local runtime. RuntimeLive
// fully provides the chat and ontology handlers, so each transport below only
// adds its own protocol + serialization layers. Shared so rpc/runtime wiring
// lives in exactly one place.
const DesktopRpcServer = RpcServer.layer(DesktopRpcs).pipe(Layer.provide(RuntimeLive));

// HTTP transport (default): one HttpRouter carries the rpc protocol and the CORS
// middleware via layer memoization, served by HttpRouter.serve.
const httpMain = (): Layer.Layer<never> => {
  const Protocol = RpcServer.layerProtocolHttp({ path: "/rpc" }).pipe(Layer.provide(HttpRouter.layer));
  const App = Layer.mergeAll(
    Protocol,
    HttpRouter.cors({
      allowedOrigins: ["*"],
      allowedMethods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["*"],
    }).pipe(Layer.provide(HttpRouter.layer))
  );
  return DesktopRpcServer.pipe(
    Layer.provideMerge(App),
    Layer.provide(HttpRouter.serve(App)),
    // Bun's default 10s idleTimeout severs streamed responses during the silent
    // tail of a turn (no bytes flow while the kernel thinks); 255s is Bun's max
    // and covers the turn budget. Mirrors the POC.
    Layer.provide(BunHttpServer.layer({ port: PORT, idleTimeout: 255 })),
    Layer.provide(RpcSerialization.layerNdjson)
  );
};

// IPC transport: ndjson rpc frames ride stdin/stdout (bridged to the webview by
// the Tauri Rust shell). Logs are pinned to stderr so they never interleave with
// the stdout frame stream the bridge parses.
const ipcMain = (): Layer.Layer<never> =>
  DesktopRpcServer.pipe(
    Layer.provide(RpcServer.layerProtocolStdio),
    Layer.provide(SidecarStdioLive),
    Layer.provide(RpcSerialization.layerNdjson),
    Layer.provide(Logger.layer([Logger.withConsoleError(Logger.formatLogFmt)], { mergeWithExisting: false }))
  );

const Main = ipcTransport ? ipcMain() : httpMain();

BunRuntime.runMain(Layer.launch(Main));
