/**
 * Professional Desktop React workbench shell bootstrap.
 *
 * The shell is a dock workspace (`@beep/dock` + `@beep/dock-react`): fourteen
 * keep-alive dock panels — Home, Chat ({@link ChatApp}), Vault sync,
 * contradiction triage, and the nine ontology workbench regions — in one
 * workspace whose layout the user can rearrange and which persists to
 * localStorage. The nav rail is the panel launcher: shell panels are direct
 * buttons and the Ontology entry expands to its panel disclosure (focus an
 * open panel, open a closed one). Two atom
 * registries with explicit ownership: application state lives in the root
 * `RegistryProvider`, dock state lives in the graph's private registry —
 * panel content re-enters the app registry, and the shell reads dock atoms
 * through registry-bridging atoms.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */

import { chatProtocolLayerAtom, HttpChatProtocolLive } from "@beep/agents-client";
import { PanelId } from "@beep/dock/Dock.ids";
import { DockNode, DockWorkspace } from "@beep/dock/Dock.tree";
import { TabChrome } from "@beep/dock/Minima";
import { DockviewReact } from "@beep/dock-react/DockviewReact";
import { epistemicProtocolLayerAtom } from "@beep/epistemic-client";
import { ContradictionTriagePanel } from "@beep/epistemic-ui";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { redactCauseForClient } from "@beep/observability/CauseRedaction";
import { HttpOntologyProtocolLive, ontologyProtocolLayerAtom } from "@beep/ontology-client";
import {
  OntologyChangeLogRegion,
  OntologyDocumentRegion,
  OntologyExplorerRegion,
  OntologyGraphRegion,
  OntologyInspectorRegion,
  OntologySourceRegion,
  OntologySparqlRegion,
} from "@beep/ontology-ui";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Button } from "@beep/ui/components/button";
import { Toaster } from "@beep/ui/components/sonner";
import { thunkUndefined } from "@beep/utils/thunk";
import { RegistryContext, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { invoke } from "@tauri-apps/api/core";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Component, lazy, Suspense } from "react";
import { ChatApp } from "./chat/ui/ChatApp.tsx";
import { ChatTurnErrorToasts } from "./chat/ui/ChatTurnErrorToasts.tsx";
import { ThemeToggle } from "./chat/ui/ThemeToggle.tsx";
import { EditorProofPanel } from "./editor-proof/EditorProofPanel.tsx";
import { DocumentIntakeTarget, VaultOnboardingGate } from "./intake/DocumentIntakeTarget.tsx";
import { BrowserFailureSource, reportedBrowserFailureAtoms } from "./runtime/BrowserFailure.atoms.ts";
import { professionalAtomRegistryAtom, professionalBrowserRuntime } from "./runtime/ProfessionalAtomRuntime.ts";
import { VaultSyncPanel } from "./sync/VaultSyncPanel.tsx";
import { makeDesktopHttpProtocolLive } from "./transport/DesktopHttpProtocol.ts";
import { IpcChatProtocolLive } from "./transport/IpcChatClient.ts";
import { IpcSpikePanel } from "./transport/IpcSpikePanel.tsx";
import { SidecarTransport } from "./transport/SidecarTransport.ts";
import {
  DESKTOP_PANELS,
  desktopDockGraphAtom,
  desktopPanelId,
  dockPersistenceBindingAtom,
  isPanelActive,
  isPanelOpen,
  ONTOLOGY_PANELS,
  panelOperation,
  resetDockSnapshotAtom,
} from "./workspace/dock.atoms.ts";
import { dockApiAtom, dockAtomBridge, focusedDockGroupAtom } from "./workspace/dock-react.atoms.ts";
import type { GroupId } from "@beep/dock/Dock.ids";
import type { DockRenderer, DockviewAdapterApi } from "@beep/dock-react/DockReact.types";
import type { JSX, ReactNode } from "react";
import type { DesktopDockGraph, DesktopPanelKey } from "./workspace/dock.atoms.ts";

const $I = $ProfessionalDesktopId.create("App");

const OntologyMetricsRegion = lazy(() =>
  import("@beep/ontology-ui/aggregates/Session/metrics").then(({ OntologyMetricsRegion }) => ({
    default: OntologyMetricsRegion,
  }))
);
const OntologyValidationRegion = lazy(() =>
  import("@beep/ontology-ui/aggregates/Session/validation").then(({ OntologyValidationRegion }) => ({
    default: OntologyValidationRegion,
  }))
);
const CosmosSpike = lazy(() =>
  import("./spikes/CosmosSpike.tsx").then(({ CosmosSpike }) => ({ default: CosmosSpike }))
);
const Graph3DSpike = lazy(() =>
  import("./spikes/Graph3DSpike.tsx").then(({ Graph3DSpike }) => ({ default: Graph3DSpike }))
);

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
const devRpcSessionToken = (): O.Option<string> => {
  const token: unknown = import.meta.env.VITE_BEEP_DESKTOP_RPC_SESSION_TOKEN;
  return O.liftPredicate(token, (value): value is string => isDevMode() && P.isString(value) && value.length > 0);
};

const browserSidecarTransport = (): SidecarTransport =>
  SidecarTransport.make({ ipc: false, rpcSessionToken: devRpcSessionToken() });

const hasDesktopRpcAccess = (transport: SidecarTransport): boolean =>
  transport.ipc || O.isSome(transport.rpcSessionToken);

// effect-first: probe which transport the sidecar speaks. In a Tauri webview
// this invokes the Rust `sidecar_transport` command — bridged through Effect at
// the Tauri Promise boundary and schema-decoded — and in a plain browser it is
// HTTP. Packaged HTTP commands resolve only after the bundled sidecar reports
// that its complete RPC runtime is live, so this existing gate also prevents
// query atoms from racing a cold start. `Effect.suspend` defers the runtime
// check to when the atom runs, keeping the original deferred semantics. A
// rejected invoke or decode failure flows to the atom's `AsyncResult.Failure`
// and renders the unavailable state.
const readSidecarTransport = Effect.suspend(() =>
  hasTauriRuntime()
    ? Effect.tryPromise(() => invoke("sidecar_transport")).pipe(Effect.flatMap(SidecarTransport.decodeUnknownEffect))
    : Effect.sync(browserSidecarTransport)
);

// AsyncResult<SidecarTransport>: Initial = checking, Failure = unavailable,
// Success = ready. Replaces the useState/useEffect transport probe.
const sidecarTransportAtom = professionalBrowserRuntime.atom(readSidecarTransport);

// Write-capable surfaces (vault sync, ontology workbench, contradiction
// triage) are served over HTTP only when the sidecar holds the per-launch
// session token. Without it those panels used to mount anyway and fail RPC by
// RPC — dead buttons, duplicated red errors, and a Vault panel that looked
// "unauthenticated" with no explanation. The honest state is a gate that says
// what this session is and how to unlock it.
const DesktopSessionNotice = ({ label }: { readonly label: string }): JSX.Element => (
  <div
    className="grid h-full min-w-0 place-items-center overflow-hidden p-6 text-center text-sm text-muted-foreground"
    data-testid="desktop-session-required"
  >
    {/* Env-var tokens have no break opportunities; let them wrap inside a
        narrow pane instead of clipping at its edge. */}
    <div className="min-w-0 max-w-md break-words [overflow-wrap:anywhere]">
      <p>{label} needs the desktop shell or an authenticated desktop HTTP session.</p>
      <p className="mt-2 text-xs">
        This browser session is chat-only. Launch the sidecar with BEEP_DESKTOP_RPC_SESSION_TOKEN and start Vite with
        the matching VITE_BEEP_DESKTOP_RPC_SESSION_TOKEN to unlock vault, ontology, and triage surfaces over HTTP.
      </p>
    </div>
  </div>
);

const DesktopSessionGate = ({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}): JSX.Element => {
  const transport = useAtomValue(sidecarTransportAtom);
  const notice = <DesktopSessionNotice label={label} />;
  const thunkNotice = () => notice;

  return AsyncResult.match(transport, {
    onInitial: thunkNotice,
    onFailure: thunkNotice,
    onSuccess: ({ value }) => (hasDesktopRpcAccess(value) ? <>{children}</> : notice),
  });
};

const BrowserFailureReporter = ({
  cause,
  source,
}: {
  readonly cause: unknown;
  readonly source: BrowserFailureSource;
}): null => {
  useAtomMount(reportedBrowserFailureAtoms(source)(cause));
  return null;
};

// The toast portals every shell state renders, exactly once per state.
const ShellChrome = ({ children }: { readonly children: ReactNode }): JSX.Element => (
  <>
    {children}
    <ChatTurnErrorToasts />
    <Toaster richColors />
  </>
);

// One redacted failure card for every bootstrap failure surface.
const ShellFailureCard = ({
  cause,
  heading,
  source,
}: {
  readonly cause: unknown;
  readonly heading: string;
  readonly source: BrowserFailureSource;
}): JSX.Element => {
  const redacted = redactCauseForClient(cause);
  return (
    <>
      <BrowserFailureReporter cause={cause} source={source} />
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="max-w-md rounded-md border bg-card p-4 shadow-sm">
          <h1 className="text-base font-semibold">{heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{redacted.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">Diagnostic ID: {redacted.fingerprint}</p>
        </div>
      </div>
    </>
  );
};

// atom-first: when the probe resolves, point the rpc client at the matching
// protocol layer (IPC in the desktop shell, HTTP in the browser). A mounted
// binding rather than a useEffect; `chatProtocolLayerAtom` already defaults to
// HTTP, so the layer is only rewritten once the transport is confirmed.
const protocolLayerBindingAtom = professionalBrowserRuntime.atom(
  Effect.fnUntraced(function* (get) {
    const transport = yield* get.result(sidecarTransportAtom);
    const sessionToken = transport.rpcSessionToken;
    const protocolLayer = transport.ipc
      ? IpcChatProtocolLive
      : O.match(sessionToken, {
          onNone: () => HttpChatProtocolLive,
          onSome: makeDesktopHttpProtocolLive,
        });
    get.set(
      ontologyProtocolLayerAtom,
      transport.ipc || O.isSome(sessionToken) ? protocolLayer : HttpOntologyProtocolLive
    );
    get.set(epistemicProtocolLayerAtom, protocolLayer);
    get.set(chatProtocolLayerAtom, protocolLayer);
  })
);

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

// Navigating to a panel must FOCUS its group as well as activate its tab —
// a nav click on a panel already active in an unfocused group is otherwise
// a visual no-op (and "current page" would not follow the click).
const focusPanelGroup = (
  graph: DesktopDockGraph,
  api: O.Option<DockviewAdapterApi>,
  workspace: DockWorkspace,
  key: DesktopPanelKey
): void =>
  O.match(DockWorkspace.findTabsForPanel(workspace, desktopPanelId(key)), {
    onNone: thunkUndefined,
    onSome: (tabs) => {
      O.map(api, (adapterApi) => graph.registry.set(adapterApi.atoms.focusedGroup, O.some(tabs.groupId)));
    },
  });

// The Home overview's launch tiles. Ontology's tile targets the Graph panel —
// the workbench's center of gravity — rather than any single tool panel.
const HOME_TILES = [
  {
    description: "Work with the professional assistant and your saved threads.",
    key: "chat",
    label: "Chat",
  },
  {
    description: "Explore and refine the workspace knowledge model.",
    key: "ontology-graph",
    label: "Ontology",
  },
  {
    description: "Review provider connectivity, queue health, and conflicts.",
    key: "sync",
    label: "Vault sync",
  },
] as const;

// The navigation action's real input is one panel key; the dock graph, the
// adapter api, and the workspace are registry state the action reads itself.
const navigateDesktopPanelAtom = professionalBrowserRuntime.fn<DesktopPanelKey>()(
  Effect.fn("professional_desktop.workspace.navigate_panel")(function* (key, ctx) {
    const graph = yield* ctx.result(desktopDockGraphAtom);
    const workspace = ctx(dockAtomBridge(graph, graph.workspaceAtom));
    const api = ctx(dockApiAtom);
    yield* Effect.sync(() => {
      focusPanelGroup(graph, api, workspace, key);
      graph.registry.set(graph.operationAtom, panelOperation(workspace, key));
    });
  })
);

interface InitializeDockApi {
  readonly api: DockviewAdapterApi;
  readonly graph: DesktopDockGraph;
}

const initializeDockApiAtom = professionalBrowserRuntime.fn<InitializeDockApi>()(
  Effect.fnUntraced(function* ({ api, graph }, ctx) {
    ctx.set(dockApiAtom, O.some(api));
    yield* Effect.sync(() => {
      if (O.isSome(graph.registry.get(api.atoms.focusedGroup))) return;
      const workspace = graph.registry.get(graph.workspaceAtom);
      const bootGroup = O.orElse(
        O.map(DockWorkspace.findTabsForPanel(workspace, desktopPanelId("chat")), (tabs) => tabs.groupId),
        () =>
          DockWorkspace.match(workspace, {
            empty: O.none<GroupId>,
            populated: ({ root }) => O.map(A.head(DockNode.tabs(root)), (tabs) => tabs.groupId),
          })
      );
      O.match(bootGroup, {
        onNone: thunkUndefined,
        onSome: (groupId) => graph.registry.set(api.atoms.focusedGroup, O.some(groupId)),
      });
    });
  })
);

const HomeSurface = (): JSX.Element => {
  const navigate = useAtomSet(navigateDesktopPanelAtom);
  return (
    <main className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-primary">Professional Desktop</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your professional workspace</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Move between assisted research, ontology work, and document synchronization from one place.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {A.map(HOME_TILES, (item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.key)}
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
// A fixed retry budget absorbs transient third-party render incidents without
// turning persistent faults into an unbounded remount loop.
const SURFACE_RETRY_LIMIT = 2;

const SurfaceRecoveryState = LiteralKit(["ready", "retrying", "failed"])
  .toTaggedUnion("kind")({
    ready: {},
    retrying: {
      attempt: S.Int,
      cause: S.Unknown,
    },
    failed: {
      cause: S.Unknown,
    },
  })
  .pipe(
    $I.annoteSchema("SurfaceRecoveryState", {
      description: "Exhaustive bounded recovery lifecycle for a desktop render boundary.",
    })
  );

type SurfaceRecoveryState = typeof SurfaceRecoveryState.Type;

interface RecoveryBoundaryProps {
  readonly children: ReactNode;
  readonly label: string;
  readonly resetWorkspace?: undefined | (() => void);
}

class RecoveryAttemptBoundary extends Component<
  { readonly children: ReactNode; readonly onFailure: (cause: Error) => void },
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { readonly failed: true } {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    this.props.onFailure(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

class RecoveryBoundary extends Component<RecoveryBoundaryProps, SurfaceRecoveryState> {
  override state: SurfaceRecoveryState = SurfaceRecoveryState.cases.ready.make({});

  private readonly recover = (error: Error): void => {
    this.setState((state) =>
      SurfaceRecoveryState.match(state, {
        ready: () => SurfaceRecoveryState.cases.retrying.make({ attempt: 1, cause: error }),
        retrying: ({ attempt, cause }) =>
          attempt < SURFACE_RETRY_LIMIT
            ? SurfaceRecoveryState.cases.retrying.make({ attempt: attempt + 1, cause })
            : SurfaceRecoveryState.cases.failed.make({ cause }),
        failed: () => state,
      })
    );
  };

  private readonly retry = (): void => {
    this.setState(SurfaceRecoveryState.cases.ready.make({}));
  };

  override render(): ReactNode {
    return SurfaceRecoveryState.match(this.state, {
      ready: () => (
        <RecoveryAttemptBoundary key={0} onFailure={this.recover}>
          {this.props.children}
        </RecoveryAttemptBoundary>
      ),
      retrying: ({ attempt }) => (
        <RecoveryAttemptBoundary key={attempt} onFailure={this.recover}>
          {this.props.children}
        </RecoveryAttemptBoundary>
      ),
      failed: ({ cause }) => (
        <>
          <BrowserFailureReporter cause={cause} source="workspace" />
          {this.props.resetWorkspace === undefined ? (
            <div className="flex h-full items-center justify-center p-4">
              <div className="max-w-sm rounded-md border bg-card p-4 text-center shadow-sm">
                <p className="text-sm text-muted-foreground">The {this.props.label} surface crashed while rendering.</p>
                <button
                  type="button"
                  className="mt-3 rounded-md border bg-accent px-3 py-1.5 text-sm font-medium"
                  onClick={this.retry}
                >
                  Reload {this.props.label}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md rounded-md border bg-card p-4 shadow-sm">
                <h2 className="text-base font-semibold">The workspace hit an error</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  A surface crashed while rendering. Reset the saved layout to recover — your documents and threads are
                  not affected.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-md border bg-accent px-3 py-1.5 text-sm font-medium"
                  onClick={this.props.resetWorkspace}
                >
                  Reset layout
                </button>
              </div>
            </div>
          )}
        </>
      ),
    });
  }
}

const DockStageBoundary = ({ children }: { readonly children: ReactNode }): JSX.Element => {
  const resetDockSnapshot = useAtomSet(resetDockSnapshotAtom);
  return (
    <RecoveryBoundary label="workspace" resetWorkspace={() => resetDockSnapshot(void 0)}>
      {children}
    </RecoveryBoundary>
  );
};

/**
 * Crash boundary around one dock surface: transient render crashes self-heal
 * with fresh remounts, persistent ones degrade to a manual-reload card.
 *
 * **Example** (Wrap surface in boundary)
 *
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
}): JSX.Element => <RecoveryBoundary label={label}>{children}</RecoveryBoundary>;

const makePanelRenderers = (appRegistry: AppRegistry): Readonly<Record<DesktopPanelKey, DockRenderer>> => {
  const wrap = (label: string, content: ReactNode): JSX.Element => (
    <RegistryContext.Provider value={appRegistry}>
      <SurfaceBoundary label={label}>{content}</SurfaceBoundary>
    </RegistryContext.Provider>
  );
  // Desktop-RPC surfaces gate on the authenticated session instead of
  // mounting into a transport that can only answer chat RPCs.
  const wrapDesktop = (label: string, content: ReactNode): JSX.Element =>
    wrap(label, <DesktopSessionGate label={label}>{content}</DesktopSessionGate>);
  const wrapDesktopLazy = (label: string, content: ReactNode): JSX.Element =>
    wrapDesktop(
      label,
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground" role="status">
            Loading {label}
          </div>
        }
      >
        {content}
      </Suspense>
    );
  // Each ontology region reads the same app-registry atoms it read inside
  // the old monolith, so a region docked anywhere (or floated) stays wired
  // to the same session.
  return {
    home: () => wrap("Home", <HomeSurface />),
    chat: () => wrap("Chat", <ChatApp />),
    "editor-proof": () => wrap("Editor proof", <EditorProofPanel />),
    sync: () =>
      wrapDesktop(
        "Vault sync",
        <VaultOnboardingGate>
          <VaultSyncPanel floating={false} />
        </VaultOnboardingGate>
      ),
    "contradiction-triage": () => wrapDesktop("Contradiction Triage", <ContradictionTriagePanel />),
    "ontology-explorer": () => wrapDesktop("Explorer", <OntologyExplorerRegion />),
    "ontology-document": () => wrapDesktop("Document", <OntologyDocumentRegion />),
    "ontology-graph": () => wrapDesktop("Graph", <OntologyGraphRegion />),
    "ontology-source": () => wrapDesktop("Source", <OntologySourceRegion />),
    "ontology-inspector": () => wrapDesktop("Inspector", <OntologyInspectorRegion />),
    "ontology-sparql": () => wrapDesktop("SPARQL", <OntologySparqlRegion />),
    "ontology-validation": () => wrapDesktopLazy("Validation", <OntologyValidationRegion />),
    "ontology-changelog": () => wrapDesktop("Change Log", <OntologyChangeLogRegion />),
    "ontology-metrics": () => wrapDesktopLazy("Worker Metrics", <OntologyMetricsRegion />),
  };
};

// The family owns one renderer map per graph. Reading the professional registry
// inside the atom keeps renderer identity stable without module-global state.
const panelRendererAtoms = Atom.family((_graph: DesktopDockGraph) =>
  Atom.readable((get) => AsyncResult.map(get(professionalAtomRegistryAtom), makePanelRenderers))
);

// atom-first: the menu's open flag is an atom, not useState — shell chrome
// state lives in the registry like everything else, and no React hook owns
// it.
const ontologyMenuOpenAtom = Atom.make(false).pipe(Atom.keepAlive);
const ontologyMenuElementAtom = Atom.make<O.Option<HTMLDivElement>>(O.none());

const closeOntologyMenuAtom = professionalBrowserRuntime.fn<void>()(
  Effect.fnUntraced(function* (_, ctx) {
    ctx.set(ontologyMenuOpenAtom, false);
  })
);

const toggleOntologyMenuAtom = professionalBrowserRuntime.fn<void>()(
  Effect.fnUntraced(function* (_, ctx) {
    ctx.set(ontologyMenuOpenAtom, !ctx(ontologyMenuOpenAtom));
  })
);

const setOntologyMenuElementAtom = professionalBrowserRuntime.fn<HTMLDivElement | null>()(
  Effect.fnUntraced(function* (element, ctx) {
    ctx.set(ontologyMenuElementAtom, O.fromNullishOr(element));
  })
);

const ontologyMenuDismissBindingAtom = professionalBrowserRuntime.atom((get) =>
  O.match(get(ontologyMenuElementAtom), {
    onNone: () => Effect.void,
    onSome: Effect.fnUntraced(function* (node) {
      const root = node.closest("[data-desktop-ontology-root]") ?? node;
      const press = (event: PointerEvent): void => {
        if (event.target instanceof Node && root.contains(event.target)) return;
        get.registry.set(closeOntologyMenuAtom, void 0);
      };
      const keydown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") get.registry.set(closeOntologyMenuAtom, void 0);
      };
      yield* Effect.sync(() => {
        document.addEventListener("pointerdown", press);
        document.addEventListener("keydown", keydown);
      });
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          document.removeEventListener("pointerdown", press);
          document.removeEventListener("keydown", keydown);
        })
      );
    }),
  })
);

// One entry row of the ontology panel menu: open-state dot plus label.
const OntologyMenuItem = ({
  current,
  onSelect,
  open,
  panel,
}: {
  readonly current: boolean;
  readonly onSelect: () => void;
  readonly open: boolean;
  readonly panel: (typeof DESKTOP_PANELS)[number];
}): JSX.Element => (
  <button
    type="button"
    data-panel-menu-item={panel.key}
    aria-current={current ? "page" : undefined}
    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
    onClick={onSelect}
  >
    <span
      aria-hidden
      className={
        open ? "h-1.5 w-1.5 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full border border-muted-foreground/50"
      }
    />
    {panel.label}
  </button>
);

// The expanded nine-panel disclosure list under the Ontology rail entry.
const OntologyMenuList = ({
  isCurrent,
  onNavigate,
  setElement,
  workspace,
}: {
  readonly isCurrent: (key: DesktopPanelKey) => boolean;
  readonly onNavigate: (key: DesktopPanelKey) => void;
  readonly setElement: (element: HTMLDivElement | null) => void;
  readonly workspace: DockWorkspace;
}): JSX.Element => (
  <div
    id="ontology-panel-disclosure"
    ref={setElement}
    role="group"
    aria-label="Ontology panels"
    className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-md border bg-popover p-1 shadow-md"
  >
    {A.map(ONTOLOGY_PANELS, (panel) => (
      <OntologyMenuItem
        key={panel.key}
        current={isCurrent(panel.key)}
        open={isPanelOpen(workspace, panel.key)}
        onSelect={() => onNavigate(panel.key)}
        panel={panel}
      />
    ))}
  </div>
);

// The nav rail's Ontology entry: expands to the nine-panel menu. An entry
// click focuses an open panel or opens a closed one beside its cluster
// siblings while the disclosure stays open for successive panel picks; the
// menu dismisses on outside press and Escape (ARIA disclosure practices).
// The menu element and dismissal listeners are owned by runtime atoms, so
// opening and closing the menu scopes the listener lifecycle.
// fallow-ignore-next-line complexity -- cognitive 8 = five atom-hook bindings (each +1 in fallow's React model) plus two ternaries and one &&; item row and disclosure list are already extracted, and dropping a hook binding would fuse runtime atoms for the metric's sake
const OntologyMenu = ({
  isCurrent,
  workspace,
}: {
  readonly isCurrent: (key: DesktopPanelKey) => boolean;
  readonly workspace: DockWorkspace;
}): JSX.Element => {
  const open = useAtomValue(ontologyMenuOpenAtom);
  const navigate = useAtomSet(navigateDesktopPanelAtom);
  const setElement = useAtomSet(setOntologyMenuElementAtom);
  const toggle = useAtomSet(toggleOntologyMenuAtom);
  useAtomMount(ontologyMenuDismissBindingAtom);
  const anyCurrent = A.some(ONTOLOGY_PANELS, (panel) => isCurrent(panel.key));
  return (
    <div data-desktop-ontology-root="" className="relative">
      <Button
        aria-controls="ontology-panel-disclosure"
        aria-expanded={open}
        aria-current={anyCurrent ? "page" : undefined}
        data-desktop-ontology-menu=""
        onClick={() => toggle(void 0)}
        size="sm"
        variant={anyCurrent ? "secondary" : "ghost"}
      >
        Ontology
        {/* Launcher affordance: this entry opens a panel menu, unlike the
            plain page buttons beside it (QA finding R1-08). */}
        <span aria-hidden className="ml-1 text-[10px] opacity-70">
          ▾
        </span>
      </Button>
      {open && (
        <OntologyMenuList
          isCurrent={isCurrent}
          onNavigate={(key) => navigate(key)}
          setElement={setElement}
          workspace={workspace}
        />
      )}
    </div>
  );
};

const SHELL_NAV_PANELS = A.filter(DESKTOP_PANELS, (panel) => panel.cluster === "shell");

const DesktopShell = ({
  graph,
  transport,
}: {
  readonly graph: DesktopDockGraph;
  readonly transport: SidecarTransport;
}): JSX.Element => {
  const workspace = useAtomValue(dockAtomBridge(graph, graph.workspaceAtom));
  const initializeDockApi = useAtomSet(initializeDockApiAtom);
  const focusedGroup = useAtomValue(focusedDockGroupAtom(graph));
  const desktopRpcAvailable = hasDesktopRpcAccess(transport);
  const shellNavPanels = A.filter(SHELL_NAV_PANELS, ({ key }) => key !== "contradiction-triage" || desktopRpcAvailable);
  // One current page: the panel active in the FOCUSED group. Before any
  // focus interaction (or if focus clears) fall back to open-anywhere active.
  const isPanelCurrent = (key: DesktopPanelKey): boolean =>
    O.match(focusedGroup, {
      onNone: () => isPanelActive(workspace, key),
      onSome: (groupId) =>
        O.exists(DockWorkspace.findTabs(workspace, groupId), (tabs) =>
          PanelId.equals(tabs.active.id, desktopPanelId(key))
        ),
    });
  const navigate = useAtomSet(navigateDesktopPanelAtom);
  const surfaceRenderers = AsyncResult.getOrThrow(useAtomValue(panelRendererAtoms(graph)));
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
        {/* Keep the viewport shell on one compositor layer. Software-rendered
            browser captures otherwise expose partial text-tile repaints for a
            frame when dock portals swap active content. */}
        <div className="isolate flex h-dvh min-h-0 w-full transform-gpu flex-col overflow-hidden bg-background text-foreground">
          <nav className="flex h-12 shrink-0 items-center gap-1 border-b px-3" aria-label="Desktop pages">
            <span className="mr-3 text-sm font-semibold">BEEP</span>
            {A.map(shellNavPanels, (item) => (
              <Button
                key={item.key}
                aria-current={isPanelCurrent(item.key) ? "page" : undefined}
                onClick={() => navigate(item.key)}
                size="sm"
                variant={isPanelCurrent(item.key) ? "secondary" : "ghost"}
              >
                {item.label}
              </Button>
            ))}
            <OntologyMenu isCurrent={isPanelCurrent} workspace={workspace} />
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
                onReady={({ api }) => initializeDockApi({ api, graph })}
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

// The shell's bootstrap decision as data: registry, then transport probe,
// then protocol binding, folded in order so an earlier failure short-circuits.
const DesktopBootstrapState = LiteralKit(["preparing", "connecting", "binding", "failed", "ready"])
  .toTaggedUnion("kind")({
    preparing: {},
    connecting: {},
    binding: {},
    failed: {
      cause: S.Unknown,
      heading: S.String,
      source: BrowserFailureSource,
    },
    ready: { transport: SidecarTransport },
  })
  .pipe(
    $I.annoteSchema("DesktopBootstrapState", {
      description: "Desktop shell bootstrap decision: registry, transport probe, then protocol binding.",
    })
  );

type DesktopBootstrapState = typeof DesktopBootstrapState.Type;

const desktopBootstrapAtom = Atom.make(
  (get): DesktopBootstrapState =>
    AsyncResult.match(get(professionalAtomRegistryAtom), {
      onInitial: () => DesktopBootstrapState.cases.preparing.make({}),
      onFailure: (failure) =>
        DesktopBootstrapState.cases.failed.make({
          cause: failure.cause,
          heading: "Application state unavailable",
          source: "app_registry",
        }),
      onSuccess: () =>
        AsyncResult.match(get(sidecarTransportAtom), {
          onInitial: () => DesktopBootstrapState.cases.connecting.make({}),
          onFailure: (failure) =>
            DesktopBootstrapState.cases.failed.make({
              cause: failure.cause,
              heading: "Desktop transport unavailable",
              source: "desktop_transport",
            }),
          onSuccess: ({ value: transport }) =>
            AsyncResult.match(get(protocolLayerBindingAtom), {
              onInitial: () => DesktopBootstrapState.cases.binding.make({}),
              onFailure: (failure) =>
                DesktopBootstrapState.cases.failed.make({
                  cause: failure.cause,
                  heading: "Desktop transport unavailable",
                  source: "desktop_transport",
                }),
              onSuccess: () => DesktopBootstrapState.cases.ready.make({ transport }),
            }),
        }),
    })
);

// Inside the graph-registry provider: probe the transport, bind the protocol
// layers into the SAME registry the panel content reads from, and gate the
// shell on the probe. One registry for the whole app — a second one would let
// panels read protocol atoms the bindings never wrote.
const TransportGate = ({ graph }: { readonly graph: DesktopDockGraph }): JSX.Element =>
  DesktopBootstrapState.match(useAtomValue(desktopBootstrapAtom), {
    preparing: () => (
      <ShellChrome>
        <ShellLoading label="Preparing application state" />
      </ShellChrome>
    ),
    connecting: () => (
      <ShellChrome>
        <ShellLoading label="Connecting desktop transport" />
      </ShellChrome>
    ),
    binding: () => (
      <ShellChrome>
        <ShellLoading label="Binding desktop transport" />
      </ShellChrome>
    ),
    failed: (failed) => (
      <ShellChrome>
        <ShellFailureCard cause={failed.cause} heading={failed.heading} source={failed.source} />
      </ShellChrome>
    ),
    ready: (ready) => <DesktopShell graph={graph} transport={ready.transport} />,
  });

/**
 * The desktop application root: builds the dock workspace graph (with any
 * persisted layout restored) and renders the shell inside its registry.
 *
 * **Example** (Reference App component)
 *
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
    return (
      <Suspense fallback={<ShellLoading label="Loading Cosmos spike" />}>
        <CosmosSpike />
      </Suspense>
    );
  }

  if (hasGraph3dSpikeFlag()) {
    return (
      <Suspense fallback={<ShellLoading label="Loading graph-3d spike" />}>
        <Graph3DSpike />
      </Suspense>
    );
  }

  return AsyncResult.match(graphResult, {
    onInitial: () => <ShellLoading label="Preparing workspace" />,
    onFailure: (failure) => (
      <ShellFailureCard cause={failure.cause} heading="Workspace unavailable" source="workspace" />
    ),
    onSuccess: (success) => <TransportGate graph={success.value} />,
  });
}
