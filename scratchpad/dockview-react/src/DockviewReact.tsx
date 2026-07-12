import { NonNegativeInt } from "@beep/schema";
import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { Atom } from "effect/unstable/reactivity";
import type React from "react";
import { createPortal } from "react-dom";
import {
  ActivatePanelCommand,
  ClosePanelCommand,
  CommandId,
  DispatchDockCommand,
  type DockAtomOperation,
  DockBox,
  DockCommandEnvelope,
  DockNode,
  DockWorkspace,
  GeometryOptions,
  GroupId,
  MovePanelCommand,
  type makeDockAtoms,
  makeDockGeometryAtoms,
  type Panel,
  PanelId,
  type PanelParameters,
  PanelView,
  PopulatedWorkspace,
  ResizeSplitCommand,
  RootSplitPlacement,
  SplitId,
  SplitLayout,
  SplitNode,
  SplitPlacement,
  SplitRatio,
  TabPlacement,
  TabsNode,
  UserCommandOrigin,
} from "../../dockview/poc/index.ts";

export type DockAtomGraph = Effect.Success<ReturnType<typeof makeDockAtoms>>;

export type DockPanelApi = { readonly id: PanelId };
export type DockPanelProps = {
  readonly params: PanelParameters;
  readonly api: DockPanelApi;
  readonly containerApi: DockviewAdapterApi;
};
export type DockTabProps = DockPanelProps & { readonly title: string };
export type DockRenderer = React.FunctionComponent<DockPanelProps>;
export type DockTabRenderer = React.FunctionComponent<DockTabProps>;

export type DockviewAdapterApi = {
  readonly submit: (operation: DockAtomOperation) => void;
  readonly awaitIdle: Effect.Effect<void>;
  readonly atoms: {
    readonly workspace: DockAtomGraph["workspaceAtom"];
    readonly panels: DockAtomGraph["panelsAtom"];
    readonly focusedGroup: Atom.Writable<O.Option<GroupId>>;
    readonly drag: Atom.Writable<O.Option<TabDrag>>;
    readonly ratioOverride: Atom.Writable<O.Option<RatioOverride>>;
  };
};

export type DockviewReactProps = {
  readonly graph: DockAtomGraph;
  readonly components: Readonly<Record<string, DockRenderer>>;
  readonly tabComponents?: Readonly<Record<string, DockTabRenderer>> | undefined;
  readonly watermarkComponent?: React.FunctionComponent | undefined;
  readonly defaultTabComponent?: DockTabRenderer | undefined;
  readonly onReady?: ((event: { readonly api: DockviewAdapterApi }) => void) | undefined;
  readonly options?: { readonly gap?: number | undefined } | undefined;
};

type AdapterState = {
  readonly containerAtom: Atom.Writable<DockBox>;
  readonly focusedGroupAtom: Atom.Writable<O.Option<GroupId>>;
  readonly dragAtom: Atom.Writable<O.Option<TabDrag>>;
  readonly resizeAtom: Atom.Writable<O.Option<SashDrag>>;
  readonly ratioOverrideAtom: Atom.Writable<O.Option<RatioOverride>>;
  readonly geometry: ReturnType<typeof makeDockGeometryAtoms>;
  readonly targets: Map<PanelId, HTMLElement>;
  readonly readyRoots: WeakSet<HTMLElement>;
  readonly api: DockviewAdapterApi;
};

type PointerPosition = { readonly left: number; readonly top: number };
type TabDrag = {
  readonly panelId: PanelId;
  readonly fromGroupId: GroupId;
  readonly pointer: PointerPosition;
};
type SashDrag = {
  readonly splitId: SplitId;
  readonly axis: "horizontal" | "vertical";
  readonly start: PointerPosition;
  readonly initialRatio: SplitRatio;
  readonly extent: number;
  readonly moved: boolean;
};
type RatioOverride = { readonly splitId: SplitId; readonly ratio: SplitRatio };

const states = new WeakMap<DockAtomGraph, Map<number, AdapterState>>();
let commandCounter = 0;

const makeOperation = (
  command: ActivatePanelCommand | ClosePanelCommand | MovePanelCommand | ResizeSplitCommand
): DockAtomOperation => {
  commandCounter += 1;
  const id = `dockview-react-${commandCounter}`;
  return DispatchDockCommand.make({
    envelope: DockCommandEnvelope.make({
      commandId: CommandId.make(id),
      origin: UserCommandOrigin.make({ interactionId: id }),
      command,
    }),
  });
};

const adapterState = (graph: DockAtomGraph, gap: number): AdapterState => {
  // crispen: gap remains the adapter identity because geometry atoms close over it; remove the inner Map when options become reactive.
  let byGap = states.get(graph);
  if (byGap === undefined) {
    byGap = new Map();
    states.set(graph, byGap);
  }
  const existing = byGap.get(gap);
  if (existing !== undefined) return existing;
  const containerAtom = Atom.make(DockBox.make({ left: 0, top: 0, width: 0, height: 0 })).pipe(Atom.keepAlive);
  const focusedGroupAtom = Atom.make<O.Option<GroupId>>(O.none()).pipe(Atom.keepAlive);
  const dragAtom = Atom.make<O.Option<TabDrag>>(O.none()).pipe(Atom.keepAlive);
  const resizeAtom = Atom.make<O.Option<SashDrag>>(O.none()).pipe(Atom.keepAlive);
  const ratioOverrideAtom = Atom.make<O.Option<RatioOverride>>(O.none()).pipe(Atom.keepAlive);
  const api: DockviewAdapterApi = {
    submit: (operation) => graph.registry.set(graph.operationAtom, operation),
    awaitIdle: graph.awaitIdle,
    atoms: {
      workspace: graph.workspaceAtom,
      panels: graph.panelsAtom,
      focusedGroup: focusedGroupAtom,
      drag: dragAtom,
      ratioOverride: ratioOverrideAtom,
    },
  };
  const projectedWorkspaceAtom = Atom.readable((get) => {
    const workspace = get(graph.workspaceAtom);
    const override = get(ratioOverrideAtom);
    if (DockWorkspace.guards.empty(workspace) || O.isNone(override)) return workspace;
    return O.match(DockNode.findSplit(workspace.root, override.value.splitId), {
      onNone: () => workspace,
      onSome: (split) =>
        PopulatedWorkspace.make({
          revision: workspace.revision,
          root: DockNode.replaceSplit(workspace.root, SplitNode.withRatio(split, override.value.ratio)),
        }),
    });
  });
  const geometry = makeDockGeometryAtoms({
    workspaceAtom: projectedWorkspaceAtom,
    containerAtom,
    options: GeometryOptions.make({ gap }),
  });
  const created = {
    containerAtom,
    focusedGroupAtom,
    dragAtom,
    resizeAtom,
    ratioOverrideAtom,
    geometry,
    targets: new Map(),
    readyRoots: new WeakSet(),
    api,
  };
  byGap.set(gap, created);
  return created;
};

const targetFor = (state: AdapterState, panelId: PanelId): HTMLElement => {
  const existing = state.targets.get(panelId);
  if (existing !== undefined) return existing;
  const target = document.createElement("div");
  target.dataset.panelTarget = panelId;
  state.targets.set(panelId, target);
  return target;
};

const boxStyle = (box: DockBox): React.CSSProperties => ({
  position: "absolute",
  left: box.left,
  top: box.top,
  width: box.width,
  height: box.height,
});

const positionOf = (event: PointerEvent): PointerPosition => ({ left: event.clientX, top: event.clientY });
const contains = (box: DockBox, point: PointerPosition): boolean =>
  point.left >= box.left &&
  point.left <= box.left + box.width &&
  point.top >= box.top &&
  point.top <= box.top + box.height;
const clampRatio = (ratio: number): SplitRatio => SplitRatio.make(Math.min(9_000, Math.max(1_000, Math.round(ratio))));
const freshSplitId = (): SplitId => SplitId.make(`dockview-react-split-${commandCounter + 1}`);
const freshGroupId = (): GroupId => GroupId.make(`dockview-react-group-${commandCounter + 1}`);

const compileDrop = (state: AdapterState, graph: DockAtomGraph, drag: TabDrag): O.Option<MovePanelCommand> => {
  const geometry = graph.registry.get(state.geometry.geometryAtom);
  const container = graph.registry.get(state.containerAtom);
  const point = drag.pointer;
  const outer = Math.min(32, Math.min(container.width, container.height) / 6);
  const rootSide =
    point.left <= container.left + outer
      ? "left"
      : point.left >= container.left + container.width - outer
        ? "right"
        : point.top <= container.top + outer
          ? "top"
          : point.top >= container.top + container.height - outer
            ? "bottom"
            : undefined;
  const group = A.findFirst(geometry.groups, (candidate) => contains(candidate.box, point));
  if (O.isSome(group)) {
    const tabs = graph.registry.get(graph.tabsAtom(group.value.groupId));
    const headerHeight = Math.min(32, group.value.box.height);
    if (point.top <= group.value.box.top + headerHeight && O.isSome(tabs)) {
      const count = A.length(TabsNode.panels(tabs.value));
      const rawIndex =
        group.value.box.width <= 0
          ? 0
          : Math.floor(((point.left - group.value.box.left) / group.value.box.width) * count);
      const index = NonNegativeInt.make(Math.min(count, Math.max(0, rawIndex)));
      return O.some(
        MovePanelCommand.make({
          panelId: drag.panelId,
          target: TabPlacement.make({ groupId: group.value.groupId, index: O.some(index) }),
        })
      );
    }
  }
  if (rootSide !== undefined) {
    return O.some(
      MovePanelCommand.make({
        panelId: drag.panelId,
        target: RootSplitPlacement.make({ side: rootSide, splitId: freshSplitId(), newGroupId: freshGroupId() }),
      })
    );
  }
  if (O.isNone(group)) return O.none();
  const { box, groupId } = group.value;
  const headerHeight = Math.min(32, box.height);
  const contentTop = box.top + headerHeight;
  const contentHeight = Math.max(0, box.height - headerHeight);
  const x = point.left - box.left;
  const y = point.top - contentTop;
  const edgeX = box.width * 0.25;
  const edgeY = contentHeight * 0.25;
  const side =
    x <= edgeX
      ? "left"
      : x >= box.width - edgeX
        ? "right"
        : y <= edgeY
          ? "top"
          : y >= contentHeight - edgeY
            ? "bottom"
            : undefined;
  if (side !== undefined) {
    return O.some(
      MovePanelCommand.make({
        panelId: drag.panelId,
        target: SplitPlacement.make({
          referenceGroupId: groupId,
          newGroupId: freshGroupId(),
          splitId: freshSplitId(),
          side,
        }),
      })
    );
  }
  return GroupId.equals(groupId, drag.fromGroupId)
    ? O.none()
    : O.some(MovePanelCommand.make({ panelId: drag.panelId, target: TabPlacement.make({ groupId }) }));
};

const splitExtent = (graph: DockAtomGraph, state: AdapterState, split: SplitNode): number => {
  const geometry = graph.registry.get(state.geometry.geometryAtom);
  const boxes = A.flatMap(DockNode.tabs(split), (tabs) =>
    O.match(
      A.findFirst(geometry.groups, (group) => GroupId.equals(group.groupId, tabs.groupId)),
      {
        onNone: A.empty,
        onSome: (group) => A.of(group.box),
      }
    )
  );
  if (boxes.length === 0) return 0;
  const left = Math.min(...A.map(boxes, (box) => box.left));
  const top = Math.min(...A.map(boxes, (box) => box.top));
  const right = Math.max(...A.map(boxes, (box) => box.left + box.width));
  const bottom = Math.max(...A.map(boxes, (box) => box.top + box.height));
  return split.layout.axis === "horizontal" ? right - left : bottom - top;
};

const PanelContent = (props: {
  readonly panel: Panel;
  readonly components: Readonly<Record<string, DockRenderer>>;
  readonly state: AdapterState;
}) => {
  const { panel, state } = props;
  return PanelView.match(panel.view, {
    text: ({ text }) => <div data-testid={`panel-${panel.id}`}>{text}</div>,
    component: ({ input, renderer }) =>
      O.match(O.fromUndefinedOr(props.components[renderer]), {
        onNone: () => <div role="alert">Missing renderer: {renderer}</div>,
        onSome: (Renderer) => <Renderer params={input} api={{ id: panel.id }} containerApi={state.api} />,
      }),
  });
};

const PanelPortal = (props: {
  readonly graph: DockAtomGraph;
  readonly panel: Panel;
  readonly components: Readonly<Record<string, DockRenderer>>;
  readonly state: AdapterState;
}) => {
  const workspace = useAtomValue(props.graph.workspaceAtom);
  const active = O.exists(DockWorkspace.findTabsForPanel(workspace, props.panel.id), ({ groupId }) =>
    O.exists(props.graph.registry.get(props.graph.activePanelAtom(groupId)), (panel) =>
      PanelId.equals(panel.id, props.panel.id)
    )
  );
  const target = targetFor(props.state, props.panel.id);
  target.hidden = !active;
  target.dataset.renderMode = props.panel.renderMode;
  return createPortal(
    <PanelContent panel={props.panel} components={props.components} state={props.state} />,
    target,
    props.panel.id
  );
};

const ContentHost = (props: {
  readonly graph: DockAtomGraph;
  readonly groupId: GroupId;
  readonly state: AdapterState;
}) => {
  const workspace = useAtomValue(props.graph.workspaceAtom);
  const attach = (host: HTMLDivElement | null): (() => void) | undefined => {
    if (host === null) return undefined;
    // crispen: imperative DOM ownership stays explicit at this lifecycle boundary; replace only when Atom owns a keyed child collection.
    for (const panel of props.graph.registry.get(props.graph.panelsAtom)) {
      if (
        O.exists(DockWorkspace.findTabsForPanel(workspace, panel.id), ({ groupId }) =>
          GroupId.equals(groupId, props.groupId)
        )
      ) {
        const active = O.exists(props.graph.registry.get(props.graph.activePanelAtom(props.groupId)), (candidate) =>
          PanelId.equals(candidate.id, panel.id)
        );
        if (active || panel.renderMode === "always") host.appendChild(targetFor(props.state, panel.id));
        else targetFor(props.state, panel.id).remove();
      }
    }
    return () => {
      for (const child of A.fromIterable(host.children)) child.remove();
    };
  };
  return <div data-content-host={props.groupId} ref={attach} style={{ flex: 1, minHeight: 0 }} />;
};

const Tab = (props: {
  readonly graph: DockAtomGraph;
  readonly groupId: GroupId;
  readonly panel: Panel;
  readonly active: boolean;
  readonly state: AdapterState;
  readonly tabComponents: Readonly<Record<string, DockTabRenderer>> | undefined;
  readonly defaultTabComponent: DockTabRenderer | undefined;
}) => {
  const submit = useAtomSet(props.graph.operationAtom);
  const activate = (): void => {
    props.graph.registry.set(props.state.focusedGroupAtom, O.some(props.groupId));
    submit(makeOperation(ActivatePanelCommand.make({ panelId: props.panel.id })));
  };
  const activateFromKeyboard = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") activate();
  };
  const close = (): void => submit(makeOperation(ClosePanelCommand.make({ panelId: props.panel.id })));
  const pointerRef = (node: HTMLDivElement | null): (() => void) | undefined => {
    if (node === null) return undefined;
    const cancel = (): void => props.graph.registry.set(props.state.dragAtom, O.none());
    const keydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") cancel();
    };
    const move = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.dragAtom);
      if (O.isSome(current) && PanelId.equals(current.value.panelId, props.panel.id)) {
        props.graph.registry.set(props.state.dragAtom, O.some({ ...current.value, pointer: positionOf(event) }));
      }
    };
    const up = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.dragAtom);
      if (O.isNone(current) || !PanelId.equals(current.value.panelId, props.panel.id)) return;
      const finalDrag = { ...current.value, pointer: positionOf(event) };
      props.graph.registry.set(props.state.dragAtom, O.none());
      node.releasePointerCapture?.(event.pointerId);
      O.map(compileDrop(props.state, props.graph, finalDrag), (command) => submit(makeOperation(command)));
      event.preventDefault();
    };
    const down = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      node.setPointerCapture?.(event.pointerId);
      props.graph.registry.set(
        props.state.dragAtom,
        O.some({ panelId: props.panel.id, fromGroupId: props.groupId, pointer: positionOf(event) })
      );
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    document.addEventListener("keydown", keydown);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      document.removeEventListener("keydown", keydown);
    };
  };
  const Renderer = O.getOrElse(
    O.flatMap(props.panel.tabComponent, (key) =>
      O.flatMap(O.fromUndefinedOr(props.tabComponents), (components) => O.fromUndefinedOr(components[key]))
    ),
    () => props.defaultTabComponent
  );
  return (
    <div
      role="tab"
      tabIndex={props.active ? 0 : -1}
      data-active={props.active}
      data-panel-id={props.panel.id}
      ref={pointerRef}
      onClick={activate}
      onKeyDown={activateFromKeyboard}
    >
      {Renderer === undefined ? (
        props.panel.title
      ) : (
        <Renderer
          params={PanelView.match(props.panel.view, { component: ({ input }) => input, text: () => ({}) })}
          api={{ id: props.panel.id }}
          containerApi={props.state.api}
          title={props.panel.title}
        />
      )}
      <button
        type="button"
        aria-label={`Close ${props.panel.title}`}
        onClick={(event) => {
          event.stopPropagation();
          close();
        }}
      >
        ×
      </button>
    </div>
  );
};

const GroupPane = (props: DockviewReactProps & { readonly groupId: GroupId; readonly state: AdapterState }) => {
  const tabsOption = useAtomValue(props.graph.tabsAtom(props.groupId));
  const boxOption = useAtomValue(props.state.geometry.groupBoxAtom(props.groupId));
  if (O.isNone(tabsOption) || O.isNone(boxOption)) return null;
  const tabs = tabsOption.value;
  const strip = tabs.metadata.hideHeader ? null : (
    <div role="tablist">
      {A.map(TabsNode.panels(tabs), (panel) => (
        <Tab
          key={panel.id}
          graph={props.graph}
          groupId={props.groupId}
          panel={panel}
          active={PanelId.equals(panel.id, tabs.active.id)}
          state={props.state}
          tabComponents={props.tabComponents}
          defaultTabComponent={props.defaultTabComponent}
        />
      ))}
    </div>
  );
  return (
    <section
      data-group-id={props.groupId}
      data-header-position={tabs.metadata.headerPosition}
      data-locked={tabs.metadata.locked}
      onPointerDown={() => props.graph.registry.set(props.state.focusedGroupAtom, O.some(props.groupId))}
      style={{
        ...boxStyle(boxOption.value),
        display: "flex",
        flexDirection: tabs.metadata.headerPosition === "bottom" ? "column-reverse" : "column",
      }}
    >
      {strip}
      <ContentHost graph={props.graph} groupId={props.groupId} state={props.state} />
    </section>
  );
};

const Sash = (props: { readonly graph: DockAtomGraph; readonly state: AdapterState; readonly splitId: SplitId }) => {
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  const sash = A.findFirst(geometry.sashes, (candidate) => SplitId.equals(candidate.splitId, props.splitId));
  if (O.isNone(sash)) return null;
  const attach = (node: HTMLDivElement | null): (() => void) | undefined => {
    if (node === null) return undefined;
    const move = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.resizeAtom);
      if (O.isNone(current) || !SplitId.equals(current.value.splitId, props.splitId) || current.value.extent <= 0)
        return;
      const delta =
        current.value.axis === "horizontal"
          ? event.clientX - current.value.start.left
          : event.clientY - current.value.start.top;
      const ratio = clampRatio(current.value.initialRatio + (delta * 10_000) / current.value.extent);
      props.graph.registry.set(
        props.state.resizeAtom,
        O.some({ ...current.value, moved: current.value.moved || delta !== 0 })
      );
      props.graph.registry.set(props.state.ratioOverrideAtom, O.some({ splitId: props.splitId, ratio }));
    };
    const up = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.resizeAtom);
      if (O.isNone(current) || !SplitId.equals(current.value.splitId, props.splitId)) return;
      const override = props.graph.registry.get(props.state.ratioOverrideAtom);
      props.graph.registry.set(props.state.resizeAtom, O.none());
      props.graph.registry.set(props.state.ratioOverrideAtom, O.none());
      node.releasePointerCapture?.(event.pointerId);
      if (current.value.moved && O.isSome(override)) {
        props.graph.registry.set(
          props.graph.operationAtom,
          makeOperation(ResizeSplitCommand.make({ splitId: props.splitId, ratio: override.value.ratio }))
        );
      }
    };
    const down = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const workspace = props.graph.registry.get(props.graph.workspaceAtom);
      if (DockWorkspace.guards.empty(workspace)) return;
      const split = DockNode.findSplit(workspace.root, props.splitId);
      if (O.isNone(split)) return;
      const extent = splitExtent(props.graph, props.state, split.value);
      if (extent <= 0) return;
      node.setPointerCapture?.(event.pointerId);
      props.graph.registry.set(
        props.state.resizeAtom,
        O.some({
          splitId: props.splitId,
          axis: split.value.layout.axis,
          start: positionOf(event),
          initialRatio: SplitLayout.ratio(split.value.layout),
          extent,
          moved: false,
        })
      );
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
    };
  };
  return (
    <div
      ref={attach}
      data-sash-id={props.splitId}
      data-axis={sash.value.axis}
      style={{ ...boxStyle(sash.value.box), cursor: sash.value.axis === "horizontal" ? "col-resize" : "row-resize" }}
    />
  );
};

const DropOverlay = (props: { readonly state: AdapterState }) => {
  const drag = useAtomValue(props.state.dragAtom);
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  if (O.isNone(drag)) return null;
  const group = A.findFirst(geometry.groups, (candidate) => contains(candidate.box, drag.value.pointer));
  const box = O.match(group, {
    onNone: () =>
      DockBox.make({ left: drag.value.pointer.left - 8, top: drag.value.pointer.top - 8, width: 16, height: 16 }),
    onSome: (candidate) => candidate.box,
  });
  return <div data-drop-indicator="true" style={{ ...boxStyle(box), pointerEvents: "none" }} />;
};

const DockviewRoot = (props: DockviewReactProps & { readonly state: AdapterState }) => {
  const workspace = useAtomValue(props.graph.workspaceAtom);
  const panels = useAtomValue(props.graph.panelsAtom);
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  const groups: ReadonlyArray<TabsNode> = DockWorkspace.match(workspace, {
    empty: (): ReadonlyArray<TabsNode> => A.empty(),
    populated: ({ root }): ReadonlyArray<TabsNode> => DockNode.tabs(root),
  });
  const Watermark = props.watermarkComponent;
  const rootRef = (node: HTMLDivElement | null): (() => void) | undefined => {
    if (node === null) return undefined;
    if (props.state.readyRoots.has(node) === false) {
      props.state.readyRoots.add(node);
      props.onReady?.({ api: props.state.api });
    }
    const observer = new ResizeObserver((entries) => {
      const entry = A.head(entries);
      if (O.isNone(entry) || node.isConnected === false || node.hidden === true) return;
      const { width, height } = entry.value.contentRect;
      const current = props.graph.registry.get(props.state.containerAtom);
      if (width > 0 && height > 0 && (current.width !== width || current.height !== height)) {
        props.graph.registry.set(props.state.containerAtom, DockBox.make({ left: 0, top: 0, width, height }));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  };
  return (
    <div ref={rootRef} data-testid="dockview-react" style={{ position: "relative", width: "100%", height: "100%" }}>
      {A.match(groups, {
        onEmpty: () => (Watermark === undefined ? <div>Empty workspace</div> : <Watermark />),
        onNonEmpty: (tabsNodes) =>
          A.map(tabsNodes, (tabs) => <GroupPane key={tabs.groupId} {...props} groupId={tabs.groupId} />),
      })}
      {A.map(panels, (panel) => (
        <PanelPortal
          key={panel.id}
          graph={props.graph}
          panel={panel}
          components={props.components}
          state={props.state}
        />
      ))}
      {A.map(geometry.sashes, (sash) => (
        <Sash key={sash.splitId} graph={props.graph} state={props.state} splitId={sash.splitId} />
      ))}
      <DropOverlay state={props.state} />
    </div>
  );
};

export const DockviewReact = (props: DockviewReactProps) => {
  const gap = O.getOrElse(
    O.flatMap(O.fromUndefinedOr(props.options), ({ gap }) => O.fromUndefinedOr(gap)),
    () => 0
  );
  const state = adapterState(props.graph, gap);
  return (
    <RegistryContext.Provider value={props.graph.registry}>
      <DockviewRoot {...props} state={state} />
    </RegistryContext.Provider>
  );
};
