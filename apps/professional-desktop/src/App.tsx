/**
 * Professional Desktop React workbench shell bootstrap.
 *
 * Mounts the desktop chat surface ({@link ChatApp}), wired to the
 * `@beep/agents-client` atoms and `@beep/editor`. The chat surface renders its
 * own loading/empty/streaming states without a live sidecar; live interaction
 * needs the rpc server (built separately).
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */

import { chatProtocolLayerAtom, HttpChatProtocolLive } from "@beep/agents-client";
import { Toaster } from "@beep/ui/components/sonner";
import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { Cause, Effect } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { ChatApp } from "./chat/ui/ChatApp.tsx";
import { ChatTurnErrorToasts } from "./chat/ui/ChatTurnErrorToasts.tsx";
import { IpcChatProtocolLive } from "./transport/IpcChatClient.ts";
import { IpcSpikePanel } from "./transport/IpcSpikePanel.tsx";
import { SidecarTransport } from "./transport/SidecarTransport.ts";
import type { JSX } from "react";

const hasTauriRuntime = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// effect-first: probe which transport the sidecar speaks. In a Tauri webview
// this invokes the Rust `sidecar_transport` command — bridged through Effect at
// the Tauri Promise boundary and schema-decoded — and in a plain browser it is
// HTTP. `Effect.suspend` defers the runtime check to when the atom runs, keeping
// the original deferred semantics. A rejected invoke or decode failure flows to
// the atom's `AsyncResult.Failure` and renders the unavailable state.
const readSidecarTransport = Effect.suspend(() =>
  hasTauriRuntime()
    ? Effect.tryPromise(() => import("@tauri-apps/api/core")).pipe(
        Effect.flatMap(({ invoke }) => Effect.tryPromise(() => invoke("sidecar_transport"))),
        Effect.flatMap(SidecarTransport.decodeUnknownEffect)
      )
    : Effect.succeed(SidecarTransport.make({ ipc: false }))
);

// AsyncResult<SidecarTransport>: Initial = checking, Failure = unavailable,
// Success = ready. Replaces the useState/useEffect transport probe.
const sidecarTransportAtom = Atom.make(readSidecarTransport);

// atom-first: when the probe resolves, point the rpc client at the matching
// protocol layer (IPC in the desktop shell, HTTP in the browser). A mounted
// binding rather than a useEffect; `chatProtocolLayerAtom` already defaults to
// HTTP, so the layer is only rewritten once the transport is confirmed.
const protocolLayerBindingAtom = Atom.make((get) => {
  const apply = (): void => {
    const result = get.once(sidecarTransportAtom);
    if (AsyncResult.isSuccess(result)) {
      get.set(chatProtocolLayerAtom, result.value.ipc ? IpcChatProtocolLive : HttpChatProtocolLive);
    }
  };
  apply();
  get.subscribe(sidecarTransportAtom, apply);
  return undefined;
});

const hasIpcSpikeFlag = (): boolean =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("ipc");

const TransportLoading = (): JSX.Element => (
  <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse" />
      Connecting desktop transport
    </div>
  </div>
);

/**
 * The desktop application root. A thin wrapper that mounts the chat surface.
 *
 * @example
 * ```tsx
 * import { App } from "@/App"
 *
 * console.log(App.name) // "App"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function App(): JSX.Element {
  const transport = useAtomValue(sidecarTransportAtom);
  // bind the rpc protocol layer to the resolved transport (see binding above).
  useAtomMount(protocolLayerBindingAtom);

  return AsyncResult.match(transport, {
    onInitial: () => (
      <>
        <TransportLoading />
        <ChatTurnErrorToasts />
        <Toaster richColors />
      </>
    ),
    onFailure: (failure) => (
      <>
        <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
          <div className="max-w-md rounded-md border bg-card p-4 shadow-sm">
            <h1 className="text-base font-semibold">Desktop transport unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{Cause.pretty(failure.cause)}</p>
          </div>
        </div>
        <ChatTurnErrorToasts />
        <Toaster richColors />
      </>
    ),
    onSuccess: (success) => (
      <>
        <ChatApp />
        <ChatTurnErrorToasts />
        <Toaster richColors />
        {success.value.ipc && hasIpcSpikeFlag() ? <IpcSpikePanel /> : null}
      </>
    ),
  });
}
