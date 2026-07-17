/**
 * Professional Desktop React workbench shell bootstrap.
 *
 * The shell is a dock workspace (`@beep/dock` + `@beep/dock-react`): the four
 * desktop surfaces — Home, Chat ({@link ChatApp}), Ontology, Vault sync — are
 * keep-alive dock panels in one workspace whose layout the user can rearrange
 * and which persists to localStorage. Two atom registries with explicit
 * ownership: application state lives in the root `RegistryProvider`, dock
 * state lives in the graph's private registry — panel content re-enters the
 * app registry, and the shell reads dock atoms through `useDockAtom`.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */

import { chatProtocolLayerAtom, HttpChatProtocolLive } from "@beep/agents-client";
import { DockNode, DockWorkspace, PanelId, TabChrome } from "@beep/dock";
import { DockviewReact } from "@beep/dock-react";
import { redactCauseForClient } from "@beep/observability";
import { HttpOntologyProtocolLive, ontologyProtocolLayerAtom } from "@beep/ontology-client";
import { OntologyWorkbench } from "@beep/ontology-ui";
import { Button } from "@beep/ui/components/button";
import { Toaster } from "@beep/ui/components/sonner";
import { RegistryContext, useAtomMount, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Component, Fragment, useContext, useMemo, useRef, useState } from "react";
import { ChatApp } from "./chat/ui/ChatApp.tsx";
import { ChatTurnErrorToasts } from "./chat/ui/ChatTurnErrorToasts.tsx";
import { ThemeToggle } from "./chat/ui/ThemeToggle.tsx";
import { DocumentIntakeTarget } from "./intake/DocumentIntakeTarget.tsx";
import { CosmosSpike } from "./spikes/CosmosSpike.tsx";
import { Graph3DSpike } from "./spikes/Graph3DSpike.tsx";
import { VaultSyncPanel } from "./sync/VaultSyncPanel.tsx";
import { makeDesktopHttpProtocolLive } from "./transport/DesktopHttpProtocol.ts";
import { IpcChatProtocolLive } from "./transport/IpcChatClient.ts";
import { IpcSpikePanel } from "./transport/IpcSpikePanel.tsx";
import { SidecarTransport } from "./transport/SidecarTransport.ts";
import {
  DESKTOP_SURFACES,
  DOCK_SNAPSHOT_KEY,
  desktopDockGraphAtom,
  dockPersistenceBindingAtom,
  isSurfaceActive,
  surfaceOperation,
  surfacePanelId,
} from "./workspace/dock.atoms.ts";
import { useDockAtom, useFocusedDockGroup } from "./workspace/useDockAtom.ts";
import type { DockRenderer, DockviewAdapterApi } from "@beep/dock-react";
import type { JSX, ReactNode } from "react";
import type { DesktopDockGraph, DesktopSurface } from "./workspace/dock.atoms.ts";

type AppRegistry = DesktopDockGraph["registry"];

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

const hasGraph3dSpikeFlag = (): boolean =>
  isDevMode() &&
  (import.meta.env.VITE_GRAPH3D_SPIKE === "1" ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("graph3d-spike")));

const ShellLoading = ({ label }: { readonly label: string }): JSX.Element => (
  <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse" />
      {label}
    </div>
  </div>
);

// Navigating to a surface must FOCUS its group as well as activate its tab —
// a nav click on a surface already active in an unfocused group is otherwise
// a visual no-op (and "current page" would not follow the click).
const focusSurfaceGroup = (
  graph: DesktopDockGraph,
  api: DockviewAdapterApi | undefined,
  workspace: DockWorkspace,
  surface: DesktopSurface
): void =>
  O.match(DockWorkspace.findTabsForPanel(workspace, surfacePanelId(surface)), {
    onNone: () => undefined,
    onSome: (tabs) => {
      if (api !== undefined) graph.registry.set(api.atoms.focusedGroup, O.some(tabs.groupId));
    },
  });

const HomeSurface = ({
  graph,
  apiRef,
}: {
  readonly graph: DesktopDockGraph;
  readonly apiRef: { readonly current: DockviewAdapterApi | undefined };
}): JSX.Element => {
  const workspace = useDockAtom(graph, graph.workspaceAtom);
  const open = (surface: DesktopSurface): void => {
    focusSurfaceGroup(graph, apiRef.current, workspace, surface);
    graph.registry.set(graph.operationAtom, surfaceOperation(workspace, surface));
  };
  return (
    <main className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-primary">Professional Desktop</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your professional workspace</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Move between assisted research, ontology work, and document synchronization from one place.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {A.map(A.drop(DESKTOP_SURFACES, 1), (item) => (
            <button
              key={item.surface}
              type="button"
              onClick={() => open(item.surface)}
              className="rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <h2 className="font-semibold">{item.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              <span className="mt-4 inline-block text-sm font-medium text-primary">Open {item.label} →</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
};

// A panel exception must degrade to a recoverable card, never a blank shell:
// the nav stays mounted and the user can reset the persisted layout.
class DockStageBoundary extends Component<{ readonly children: ReactNode }, { readonly failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md rounded-md border bg-card p-4 shadow-sm">
            <h2 className="text-base font-semibold">The workspace hit an error</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A surface crashed while rendering. Reset the saved layout to recover — your documents and threads are not
              affected.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md border bg-accent px-3 py-1.5 text-sm font-medium"
              onClick={() => {
                globalThis.localStorage.removeItem(DOCK_SNAPSHOT_KEY);
                globalThis.location.reload();
              }}
            >
              Reset layout
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const DockWatermark = (): JSX.Element => (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
    All surfaces are closed — reopen one from the navigation above.
  </div>
);

// Panel content re-enters the APP registry: the adapter provides the dock
// graph's private registry to everything it portals, but chat/ontology/sync
// state (and the protocol-layer bindings that configure them) live in the
// root RegistryProvider. Without this wrapper each surface would silently
// instantiate detached copies of its atoms inside the graph registry.
// Surface crash resilience in two nested boundaries. The inner retrier
// absorbs transient incidents (dock moves can trip third-party StrictMode
// bugs, e.g. MUI X useDisposable in the ontology tree) by remounting the
// subtree fresh; React itself bounds consecutive recovery attempts and
// re-throws past the retrier when a crash persists, which the outer card
// catches and turns into a manual reload.
class SurfaceRetry extends Component<{ readonly children: ReactNode }, { readonly attempt: number }> {
  override state = { attempt: 0 };
  static getDerivedStateFromError(): null {
    return null;
  }
  override componentDidCatch(): void {
    this.setState((previous) => ({ attempt: previous.attempt + 1 }));
  }
  override render(): ReactNode {
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

class SurfaceCard extends Component<
  { readonly children: ReactNode; readonly label: string },
  { readonly failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center p-4">
          <div className="max-w-sm rounded-md border bg-card p-4 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">The {this.props.label} surface crashed while rendering.</p>
            <button
              type="button"
              className="mt-3 rounded-md border bg-accent px-3 py-1.5 text-sm font-medium"
              onClick={() => this.setState({ failed: false })}
            >
              Reload {this.props.label}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Crash boundary around one dock surface: transient render crashes self-heal
 * with fresh remounts, persistent ones degrade to a manual-reload card.
 *
 * @example
 * ```tsx
 * import { SurfaceBoundary } from "@/App"
 *
 * const wrapped = <SurfaceBoundary label="Chat"><div /></SurfaceBoundary>
 * console.log(wrapped.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const SurfaceBoundary = ({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}): JSX.Element => (
  <SurfaceCard label={label}>
    <SurfaceRetry>{children}</SurfaceRetry>
  </SurfaceCard>
);

const makeSurfaceRenderers = (
  graph: DesktopDockGraph,
  appRegistry: AppRegistry,
  apiRef: { readonly current: DockviewAdapterApi | undefined }
): Readonly<Record<DesktopSurface, DockRenderer>> => ({
  home: () => (
    <RegistryContext.Provider value={appRegistry}>
      <SurfaceBoundary label="Home">
        <HomeSurface graph={graph} apiRef={apiRef} />
      </SurfaceBoundary>
    </RegistryContext.Provider>
  ),
  chat: () => (
    <RegistryContext.Provider value={appRegistry}>
      <SurfaceBoundary label="Chat">
        <ChatApp />
      </SurfaceBoundary>
    </RegistryContext.Provider>
  ),
  ontology: () => (
    <RegistryContext.Provider value={appRegistry}>
      <SurfaceBoundary label="Ontology">
        <OntologyWorkbench />
      </SurfaceBoundary>
    </RegistryContext.Provider>
  ),
  sync: () => (
    <RegistryContext.Provider value={appRegistry}>
      <SurfaceBoundary label="Vault sync">
        <VaultSyncPanel floating={false} />
      </SurfaceBoundary>
    </RegistryContext.Provider>
  ),
});

const DesktopShell = ({
  graph,
  transport,
}: {
  readonly graph: DesktopDockGraph;
  readonly transport: SidecarTransport;
}): JSX.Element => {
  const workspace = useDockAtom(graph, graph.workspaceAtom);
  const appRegistry = useContext(RegistryContext);
  const [dockApi, setDockApi] = useState<DockviewAdapterApi | undefined>(undefined);
  const dockApiRef = useRef<DockviewAdapterApi | undefined>(undefined);
  const focusedGroup = useFocusedDockGroup(graph, dockApi);
  // One current page: the surface active in the FOCUSED group. Before any
  // focus interaction (or if focus clears) fall back to open-anywhere active.
  const isSurfaceCurrent = (surface: DesktopSurface): boolean =>
    O.match(focusedGroup, {
      onNone: () => isSurfaceActive(workspace, surface),
      onSome: (groupId) =>
        O.exists(DockWorkspace.findTabs(workspace, groupId), (tabs) =>
          PanelId.equals(tabs.active.id, surfacePanelId(surface))
        ),
    });
  // Stable renderer identities: a fresh components map per render would hand
  // React new component types on every workspace change, remounting every
  // panel subtree and destroying the state keep-alive exists to preserve.
  const surfaceRenderers = useMemo(() => makeSurfaceRenderers(graph, appRegistry, dockApiRef), [graph, appRegistry]);
  // Debounced snapshot persistence for every workspace change (drag, split,
  // float, activate, close) — the reload-restores-layout half of the contract.
  useAtomMount(dockPersistenceBindingAtom(graph));

  return (
    <>
      <DocumentIntakeTarget>
        {/* The shell owns the viewport, and nothing outside it scrolls. `h-dvh` rather
            than `h-screen` so a mobile browser's collapsing chrome cannot push the app
            taller than the space it actually has, and `overflow-hidden` so a surface
            that misjudges its height gets clipped instead of growing a second, outer
            scrollbar over the top of the pane that was already scrolling. Everything
            inside scrolls in its own pane. */}
        <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">
          <nav className="flex h-12 shrink-0 items-center gap-1 border-b px-3" aria-label="Desktop pages">
            <span className="mr-3 text-sm font-semibold">BEEP</span>
            {A.map(DESKTOP_SURFACES, (item) => (
              <Button
                key={item.surface}
                aria-current={isSurfaceCurrent(item.surface) ? "page" : undefined}
                onClick={() => {
                  focusSurfaceGroup(graph, dockApi, workspace, item.surface);
                  graph.registry.set(graph.operationAtom, surfaceOperation(workspace, item.surface));
                }}
                size="sm"
                variant={isSurfaceCurrent(item.surface) ? "secondary" : "ghost"}
              >
                {item.label}
              </Button>
            ))}
            {/* Theming belongs to the shell, not to one surface. It used to live in
                the chat header, so Home, Ontology and Vault sync had no way to reach
                it at all. */}
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </nav>
          <div className="desktop-dock min-h-0 flex-1">
            <DockStageBoundary>
              <DockviewReact
                graph={graph}
                components={surfaceRenderers}
                watermarkComponent={DockWatermark}
                onReady={({ api }) => {
                  dockApiRef.current = api;
                  setDockApi(api);
                  // Exactly one current page from boot: focus the first group
                  // after fresh boot AND after snapshot restore.
                  if (O.isNone(graph.registry.get(api.atoms.focusedGroup))) {
                    const ws = graph.registry.get(graph.workspaceAtom);
                    DockWorkspace.match(ws, {
                      empty: () => undefined,
                      populated: ({ root }) =>
                        O.match(A.head(DockNode.tabs(root)), {
                          onNone: () => undefined,
                          onSome: (tabs) => graph.registry.set(api.atoms.focusedGroup, O.some(tabs.groupId)),
                        }),
                    });
                  }
                }}
                options={{
                  gap: 6,
                  // Synchronous floor while font capture settles, and strip
                  // chrome that includes the Float/Maximize action rail.
                  minGroupExtent: 180,
                  titleMinima: {
                    font: "12px ui-sans-serif, system-ui, sans-serif",
                    lineHeight: 16,
                    chrome: TabChrome.make({ perTab: 44, strip: 128 }),
                  },
                }}
              />
            </DockStageBoundary>
          </div>
        </div>
      </DocumentIntakeTarget>
      <ChatTurnErrorToasts />
      <Toaster richColors />
      {transport.ipc && hasIpcSpikeFlag() ? <IpcSpikePanel /> : null}
    </>
  );
};

// Inside the graph-registry provider: probe the transport, bind the protocol
// layers into the SAME registry the panel content reads from, and gate the
// shell on the probe. One registry for the whole app — a second one would let
// panels read protocol atoms the bindings never wrote.
const TransportGate = ({ graph }: { readonly graph: DesktopDockGraph }): JSX.Element => {
  const transport = useAtomValue(sidecarTransportAtom);
  useAtomMount(protocolLayerBindingAtom);

  return AsyncResult.match(transport, {
    onInitial: () => (
      <>
        <ShellLoading label="Connecting desktop transport" />
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
    onSuccess: (success) => <DesktopShell graph={graph} transport={success.value} />,
  });
};

/**
 * The desktop application root: builds the dock workspace graph (with any
 * persisted layout restored) and renders the shell inside its registry.
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
  // Hooks precede the spike check (rules-of-hooks); the dock graph atom
  // starting on the spike route mirrors M2, where the transport probe did.
  const graphResult = useAtomValue(desktopDockGraphAtom);

  if (hasCosmosSpikeFlag()) {
    return <CosmosSpike />;
  }

  if (hasGraph3dSpikeFlag()) {
    return <Graph3DSpike />;
  }

  return AsyncResult.match(graphResult, {
    onInitial: () => <ShellLoading label="Preparing workspace" />,
    onFailure: (failure) => {
      const redacted = redactCauseForClient(failure.cause);
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
          <div className="max-w-md rounded-md border bg-card p-4 shadow-sm">
            <h1 className="text-base font-semibold">Workspace unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{redacted.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">Diagnostic ID: {redacted.fingerprint}</p>
          </div>
        </div>
      );
    },
    onSuccess: (success) => <TransportGate graph={success.value} />,
  });
}
