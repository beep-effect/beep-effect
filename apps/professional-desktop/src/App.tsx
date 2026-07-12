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
import { redactCauseForClient } from "@beep/observability";
import { HttpOntologyProtocolLive, ontologyProtocolLayerAtom } from "@beep/ontology-client";
import { OntologyWorkbench } from "@beep/ontology-ui";
import { Button } from "@beep/ui/components/button";
import { Toaster } from "@beep/ui/components/sonner";
import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { ChatApp } from "./chat/ui/ChatApp.tsx";
import { ChatTurnErrorToasts } from "./chat/ui/ChatTurnErrorToasts.tsx";
import { DocumentIntakeTarget } from "./intake/DocumentIntakeTarget.tsx";
import { CosmosSpike } from "./spikes/CosmosSpike.tsx";
import { VaultSyncPanel } from "./sync/VaultSyncPanel.tsx";
import { makeDesktopHttpProtocolLive } from "./transport/DesktopHttpProtocol.ts";
import { IpcChatProtocolLive } from "./transport/IpcChatClient.ts";
import { IpcSpikePanel } from "./transport/IpcSpikePanel.tsx";
import { SidecarTransport } from "./transport/SidecarTransport.ts";
import type { JSX } from "react";

const hasTauriRuntime = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const isDevMode = (): boolean => {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Vite injects DEV on import.meta.env.
  const value = import.meta.env.DEV;

  return P.isBoolean(value) ? value : value === "true";
};

// Dev-only browser-mode session token: lets the agent-run browser smoke reach
// the full desktop RPC group over HTTP (the shell normally injects this through
// the Tauri `sidecar_transport` probe). Gated on Vite DEV so production web
// builds never embed a token; without it browser HTTP stays chat-only.
const devRpcSessionToken = (): string | undefined => {
  const token: unknown = import.meta.env.VITE_BEEP_DESKTOP_RPC_SESSION_TOKEN;
  return isDevMode() && P.isString(token) && token.length > 0 ? token : undefined;
};

const browserSidecarTransport = (): SidecarTransport => {
  const token = devRpcSessionToken();
  return token === undefined
    ? SidecarTransport.make({ ipc: false })
    : SidecarTransport.make({ ipc: false, rpcSessionToken: token });
};

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
    : Effect.sync(browserSidecarTransport)
);

// AsyncResult<SidecarTransport>: Initial = checking, Failure = unavailable,
// Success = ready. Replaces the useState/useEffect transport probe.
const sidecarTransportAtom = Atom.make(readSidecarTransport);
type DesktopSurface = "home" | "chat" | "ontology" | "sync";

const DEFAULT_SURFACE: DesktopSurface = "chat";

const isDesktopSurface = (value: string): value is DesktopSurface =>
  value === "home" || value === "chat" || value === "ontology" || value === "sync";

// The nav items are anchors, so every click already writes `#<surface>` to the
// address bar. Reading it back is what makes the URL authoritative: without
// this, a reload at `#sync` rendered Chat, and Back left the URL and the
// rendered surface disagreeing (with the old nav item still marked current).
const surfaceFromHash = (): DesktopSurface => {
  const raw = window.location.hash.replace(/^#/, "");
  return isDesktopSurface(raw) ? raw : DEFAULT_SURFACE;
};

const desktopSurfaceAtom = Atom.make<DesktopSurface>(surfaceFromHash());

// atom-first: a mounted binding rather than a useEffect. Syncs the surface from
// the URL on mount and on every hash change (which covers back/forward too).
const hashRoutingBindingAtom = Atom.make((get) => {
  const apply = (): void => get.set(desktopSurfaceAtom, surfaceFromHash());
  apply();
  window.addEventListener("hashchange", apply);
  get.addFinalizer(() => window.removeEventListener("hashchange", apply));
  return undefined;
});

const desktopNavigationItems: ReadonlyArray<{
  readonly description: string;
  readonly label: string;
  readonly surface: DesktopSurface;
}> = [
  { description: "Return to the workspace overview.", label: "Home", surface: "home" },
  { description: "Work with the professional assistant and your saved threads.", label: "Chat", surface: "chat" },
  { description: "Explore and refine the workspace knowledge model.", label: "Ontology", surface: "ontology" },
  { description: "Review provider connectivity, queue health, and conflicts.", label: "Vault sync", surface: "sync" },
];

// atom-first: when the probe resolves, point the rpc client at the matching
// protocol layer (IPC in the desktop shell, HTTP in the browser). A mounted
// binding rather than a useEffect; `chatProtocolLayerAtom` already defaults to
// HTTP, so the layer is only rewritten once the transport is confirmed.
const protocolLayerBindingAtom = Atom.make((get) => {
  const apply = (): void => {
    const result = get.once(sidecarTransportAtom);
    if (AsyncResult.isSuccess(result)) {
      const protocolLayer = result.value.ipc
        ? IpcChatProtocolLive
        : O.match(O.fromUndefinedOr(result.value.rpcSessionToken), {
            onNone: () => HttpChatProtocolLive,
            onSome: makeDesktopHttpProtocolLive,
          });
      get.set(
        ontologyProtocolLayerAtom,
        result.value.ipc || O.isSome(O.fromUndefinedOr(result.value.rpcSessionToken))
          ? protocolLayer
          : HttpOntologyProtocolLive
      );
      get.set(chatProtocolLayerAtom, protocolLayer);
    }
  };
  apply();
  get.subscribe(sidecarTransportAtom, apply);
  return undefined;
});

const hasIpcSpikeFlag = (): boolean =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("ipc");

const hasCosmosSpikeFlag = (): boolean =>
  isDevMode() &&
  (import.meta.env.VITE_COSMOS_SPIKE === "1" ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cosmos-spike")));

const TransportLoading = (): JSX.Element => (
  <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse" />
      Connecting desktop transport
    </div>
  </div>
);

const HomeSurface = (): JSX.Element => (
  <main className="h-full overflow-y-auto p-6">
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-medium text-primary">Professional Desktop</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your professional workspace</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Move between assisted research, ontology work, and document synchronization from one place.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {A.drop(desktopNavigationItems, 1).map((item) => (
          <a
            key={item.surface}
            href={`#${item.surface}`}
            className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <h2 className="font-semibold">{item.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            <span className="mt-4 inline-block text-sm font-medium text-primary">Open {item.label} →</span>
          </a>
        ))}
      </div>
    </div>
  </main>
);

const DesktopShell = ({ transport }: { readonly transport: SidecarTransport }): JSX.Element => {
  const surface = useAtomValue(desktopSurfaceAtom);
  // The anchors below already write `#<surface>`; this binding reads it back, so
  // the hash is the single source of truth for which surface renders (and
  // reload/back/forward all land where the URL says).
  useAtomMount(hashRoutingBindingAtom);

  return (
    <>
      <DocumentIntakeTarget>
        <div className="flex h-screen min-h-0 w-full flex-col bg-background text-foreground">
          <nav className="flex h-12 shrink-0 items-center gap-1 border-b px-3" aria-label="Desktop pages">
            <span className="mr-3 text-sm font-semibold">BEEP</span>
            {desktopNavigationItems.map((item) => (
              <Button
                key={item.surface}
                aria-current={surface === item.surface ? "page" : undefined}
                nativeButton={false}
                render={<a href={`#${item.surface}`} />}
                size="sm"
                variant={surface === item.surface ? "secondary" : "ghost"}
              >
                {item.label}
              </Button>
            ))}
          </nav>
          <div className="min-h-0 flex-1">
            {surface === "home" ? <HomeSurface /> : null}
            {surface === "chat" ? <ChatApp /> : null}
            {surface === "ontology" ? <OntologyWorkbench /> : null}
            {surface === "sync" ? <VaultSyncPanel floating={false} /> : null}
          </div>
        </div>
      </DocumentIntakeTarget>
      <ChatTurnErrorToasts />
      <Toaster richColors />
      {transport.ipc && hasIpcSpikeFlag() ? <IpcSpikePanel /> : null}
    </>
  );
};

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

  if (hasCosmosSpikeFlag()) {
    return <CosmosSpike />;
  }

  return AsyncResult.match(transport, {
    onInitial: () => (
      <>
        <TransportLoading />
        <ChatTurnErrorToasts />
        <Toaster richColors />
      </>
    ),
    onFailure: (failure) => {
      const redacted = redactCauseForClient(failure.cause);
      return (
        <>
          <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
            <div className="max-w-md rounded-md border bg-card p-4 shadow-sm">
              <h1 className="text-base font-semibold">Desktop transport unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">{redacted.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">Diagnostic ID: {redacted.fingerprint}</p>
            </div>
          </div>
          <ChatTurnErrorToasts />
          <Toaster richColors />
        </>
      );
    },
    onSuccess: (success) => <DesktopShell transport={success.value} />,
  });
}
