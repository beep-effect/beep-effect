import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import { type Effect, Match } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import type React from "react";
import { createPortal } from "react-dom";
import {
  ActivatePanelCommand,
  AnchoredBox,
  ClosePanelCommand,
  CommandId,
  DispatchDockCommand,
  type DockAtomOperation,
  DockBox,
  DockCommandEnvelope,
  DockFloatingGroupCommand,
  type DockGeometry,
  DockNode,
  DockSide,
  DockWorkspace,
  FloatGroupCommand,
  FloatingMember,
  GeometryOptions,
  GroupId,
  GroupRootSplitPlacement,
  MaximizeGroupCommand,
  MoveFloatingGroupCommand,
  MovePanelCommand,
  type makeDockAtoms,
  makeDockGeometryAtoms,
  type Panel,
  PanelId,
  type PanelParameters,
  PanelView,
  PopulatedWorkspace,
  ResizeSplitCommand,
  RestoreMaximizedCommand,
  RootSplitPlacement,
  SplitId,
  SplitLayout,
  SplitNode,
  SplitPlacement,
  SplitRatio,
  TabPlacement,
  TabsNode,
  TopLeftAnchoredBox,
  UserCommandOrigin,
} from "../../dockview/poc/index.ts";

/**
 * Atom graph consumed by the React dock adapter.
 *
 * @example
 * ```ts
 * import type { DockAtomGraph } from "./DockviewReact.tsx"
 *
 * type WorkspaceAtom = DockAtomGraph["workspaceAtom"]
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export type DockAtomGraph = Effect.Success<ReturnType<typeof makeDockAtoms>>;

const $I = $ScratchpadId.create("dockview-react/DockviewReact");

/**
 * Renderer-facing API for one dock panel.
 *
 * @example
 * ```ts
 * import { DockPanelApi } from "./DockviewReact.tsx"
 * import { PanelId } from "../../dockview/poc/index.ts"
 *
 * const api = DockPanelApi.make({ id: PanelId.make("panel-1") })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DockPanelApi extends S.Class<DockPanelApi>($I`DockPanelApi`)(
  {
    id: PanelId,
  },
  $I.annote("DockPanelApi", {
    description: "Renderer-facing API identifying the dock panel currently being rendered.",
  })
) {}

/**
 * Properties supplied to a dock panel renderer.
 *
 * @example
 * ```ts
 * import type { DockPanelProps } from "./DockviewReact.tsx"
 *
 * type PanelApi = DockPanelProps["api"]
 * type ContainerApi = DockPanelProps["containerApi"]
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export type DockPanelProps = {
  readonly params: PanelParameters;
  readonly api: DockPanelApi;
  readonly containerApi: DockviewAdapterApi;
};

/**
 * Panel-renderer properties extended with the tab title.
 *
 * @example
 * ```ts
 * import type { DockTabProps } from "./DockviewReact.tsx"
 *
 * type TabTitle = DockTabProps["title"]
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export type DockTabProps = DockPanelProps & { readonly title: string };

/**
 * React component contract for rendering panel content.
 *
 * @example
 * ```ts
 * import type { DockRenderer } from "./DockviewReact.tsx"
 *
 * type RendererProps = Parameters<DockRenderer>[0]
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export type DockRenderer = React.FunctionComponent<DockPanelProps>;

/**
 * React component contract for rendering a panel tab.
 *
 * @example
 * ```ts
 * import type { DockTabRenderer } from "./DockviewReact.tsx"
 *
 * type RendererProps = Parameters<DockTabRenderer>[0]
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export type DockTabRenderer = React.FunctionComponent<DockTabProps>;

/**
 * Imperative adapter surface exposed to panel renderers and `onReady` handlers.
 *
 * @example
 * ```ts
 * import type { DockviewAdapterApi } from "./DockviewReact.tsx"
 *
 * type Submit = DockviewAdapterApi["submit"]
 * type WorkspaceAtom = DockviewAdapterApi["atoms"]["workspace"]
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
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

/**
 * Configuration and renderer registry accepted by {@link DockviewReact}.
 *
 * @example
 * ```ts
 * import type { DockviewReactProps } from "./DockviewReact.tsx"
 *
 * type ComponentRegistry = DockviewReactProps["components"]
 * type ReadyHandler = DockviewReactProps["onReady"]
 * ```
 *
 * @category components
 * @since 0.0.0
 */
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
  readonly floatingGestureAtom: Atom.Writable<O.Option<FloatingGesture>>;
  readonly floatingOverrideAtom: Atom.Writable<O.Option<FloatingOverride>>;
  readonly geometry: ReturnType<typeof makeDockGeometryAtoms>;
  readonly targets: MutableHashMap.MutableHashMap<PanelId, HTMLElement>;
  readonly readyRoots: WeakSet<HTMLElement>;
  readonly api: DockviewAdapterApi;
};

class PointerPosition extends S.Class<PointerPosition>($I`PointerPosition`)(
  {
    left: S.Finite,
    top: S.Finite,
  },
  $I.annote("PointerPosition", {
    description: "Finite client-space coordinates captured from a pointer event.",
  })
) {}

class TabDrag extends S.Class<TabDrag>($I`TabDrag`)(
  {
    panelId: PanelId,
    fromGroupId: GroupId,
    pointer: PointerPosition,
  },
  $I.annote("TabDrag", {
    description: "Active tab-drag state, including its source group and latest pointer position.",
  })
) {}

class SashDragBase extends S.Class<SashDragBase>($I`SashDragBase`)(
  {
    splitId: SplitId,
    start: PointerPosition,
    initialRatio: SplitRatio,
    extent: S.Finite,
    moved: S.Boolean,
  },
  $I.annote("SashDragBase", {
    description: "Shared state captured while resizing a split sash.",
  })
) {}

class SashDragHorizontal extends SashDragBase.extend<SashDragHorizontal>($I`SashDragHorizontal`)(
  {
    axis: S.tag("horizontal"),
  },
  $I.annote("SashDragHorizontal", {
    description: "Sash-resize gesture whose pointer delta is measured horizontally.",
  })
) {}

class SashDragVertical extends SashDragBase.extend<SashDragVertical>($I`SashDragVertical`)(
  {
    axis: S.tag("vertical"),
  },
  $I.annote("SashDragVertical", {
    description: "Sash-resize gesture whose pointer delta is measured vertically.",
  })
) {}

const SashDrag = S.Union([SashDragHorizontal, SashDragVertical]).pipe(
  S.toTaggedUnion("axis"),
  $I.annoteSchema("SashDrag", {
    description: "Axis-discriminated state for an in-progress split-sash resize gesture.",
  })
);
type SashDrag = typeof SashDrag.Type;

class RatioOverride extends S.Class<RatioOverride>($I`RatioOverride`)(
  {
    splitId: SplitId,
    ratio: SplitRatio,
  },
  $I.annote("RatioOverride", {
    description: "Transient split-ratio preview applied while a sash is moving.",
  })
) {}

class FloatingGestureBase extends S.Class<FloatingGestureBase>($I`FloatingGestureBase`)(
  {
    groupId: GroupId,
    start: PointerPosition,
    initial: AnchoredBox,
    initialBox: DockBox,
    moved: S.Boolean,
  },
  $I.annote("FloatingGestureBase", {
    description: "Shared pointer and geometry state for moving or resizing a floating group.",
  })
) {}

class FloatingGestureMove extends FloatingGestureBase.extend<FloatingGestureMove>($I`FloatingGestureMove`)(
  {
    mode: S.tag("move"),
  },
  $I.annote("FloatingGestureMove", {
    description: "Gesture state for translating a floating group.",
  })
) {}

class FloatingGestureResize extends FloatingGestureBase.extend<FloatingGestureResize>($I`FloatingGestureResize`)(
  {
    mode: S.tag("resize"),
  },
  $I.annote("FloatingGestureResize", {
    description: "Gesture state for resizing a floating group.",
  })
) {}

const FloatingGesture = S.Union([FloatingGestureMove, FloatingGestureResize]).pipe(
  S.toTaggedUnion("mode"),
  $I.annoteSchema("FloatingGesture", {
    description: "Mode-discriminated gesture state for a floating dock group.",
  })
);

type FloatingGesture = typeof FloatingGesture.Type;

class FloatingOverride extends S.Class<FloatingOverride>($I`FloatingOverride`)(
  {
    groupId: GroupId,
    anchoredBox: AnchoredBox,
  },
  $I.annote("FloatingOverride", {
    description: "Transient anchored-box preview for a floating dock group.",
  })
) {}

// crispen: graph identity and lifetime are host concerns; WeakMap avoids structural hashing and retains no disposed graph.
const states = new WeakMap<DockAtomGraph, MutableHashMap.MutableHashMap<number, AdapterState>>();
let commandCounter = 0;

const makeOperation = (
  command:
    | ActivatePanelCommand
    | ClosePanelCommand
    | MovePanelCommand
    | ResizeSplitCommand
    | FloatGroupCommand
    | DockFloatingGroupCommand
    | MoveFloatingGroupCommand
    | MaximizeGroupCommand
    | RestoreMaximizedCommand
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
  // crispen: gap remains the adapter identity because geometry atoms close over it; remove the inner cache when options become reactive.
  const byGap = O.getOrElse(O.fromUndefinedOr(states.get(graph)), () => {
    const created = MutableHashMap.empty<number, AdapterState>();
    states.set(graph, created);
    return created;
  });
  const existing = MutableHashMap.get(byGap, gap);
  if (O.isSome(existing)) return existing.value;
  const containerAtom = Atom.make(DockBox.make()).pipe(Atom.keepAlive);
  const focusedGroupAtom = Atom.make<O.Option<GroupId>>(O.none()).pipe(Atom.keepAlive);
  const dragAtom = Atom.make<O.Option<TabDrag>>(O.none()).pipe(Atom.keepAlive);
  const resizeAtom = Atom.make<O.Option<SashDrag>>(O.none()).pipe(Atom.keepAlive);
  const ratioOverrideAtom = Atom.make<O.Option<RatioOverride>>(O.none()).pipe(Atom.keepAlive);
  const floatingGestureAtom = Atom.make<O.Option<FloatingGesture>>(O.none()).pipe(Atom.keepAlive);
  const floatingOverrideAtom = Atom.make<O.Option<FloatingOverride>>(O.none()).pipe(Atom.keepAlive);
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
    const floatingOverride = get(floatingOverrideAtom);
    const floating = O.match(floatingOverride, {
      onNone: () => workspace.floating,
      onSome: (candidate) =>
        A.map(workspace.floating, (member) =>
          A.some(DockNode.tabs(member.root), (tabs) => GroupId.equals(tabs.groupId, candidate.groupId))
            ? FloatingMember.make({ anchoredBox: candidate.anchoredBox, root: member.root })
            : member
        ),
    });
    if (DockWorkspace.guards.empty(workspace)) return { ...workspace, floating };
    const root = O.match(override, {
      onNone: () => workspace.root,
      onSome: (candidate) =>
        O.match(DockNode.findSplit(workspace.root, candidate.splitId), {
          onNone: () => workspace.root,
          onSome: (split) => DockNode.replaceSplit(workspace.root, SplitNode.withRatio(split, candidate.ratio)),
        }),
    });
    return PopulatedWorkspace.make({
      revision: workspace.revision,
      root,
      maximized: workspace.maximized,
      floating,
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
    floatingGestureAtom,
    floatingOverrideAtom,
    geometry,
    targets: MutableHashMap.empty<PanelId, HTMLElement>(),
    readyRoots: new WeakSet<HTMLElement>(),
    api,
  };
  MutableHashMap.set(byGap, gap, created);
  return created;
};

const targetFor = (state: AdapterState, panelId: PanelId): HTMLElement => {
  const existing = MutableHashMap.get(state.targets, panelId);
  if (O.isSome(existing)) return existing.value;
  const target = document.createElement("div");
  target.dataset.panelTarget = panelId;
  MutableHashMap.set(state.targets, panelId, target);
  return target;
};

const boxStyle = (box: DockBox): React.CSSProperties => ({
  position: "absolute",
  left: box.left,
  top: box.top,
  width: box.width,
  height: box.height,
});

const positionOf = (event: PointerEvent): PointerPosition => ({
  left: event.clientX,
  top: event.clientY,
});
const contains = (box: DockBox, point: PointerPosition): boolean =>
  point.left >= box.left &&
  point.left <= box.left + box.width &&
  point.top >= box.top &&
  point.top <= box.top + box.height;
const clampRatio = (ratio: number): SplitRatio => SplitRatio.make(Math.min(9_000, Math.max(1_000, Math.round(ratio))));
const freshSplitId = (): SplitId => SplitId.make(`dockview-react-split-${commandCounter + 1}`);
const freshGroupId = (): GroupId => GroupId.make(`dockview-react-group-${commandCounter + 1}`);
const freshFloatingSplitId = (): SplitId => SplitId.make(`dockview-react-floating-split-${commandCounter + 1}`);
const topLeftBox = (box: DockBox, container: DockBox): AnchoredBox =>
  TopLeftAnchoredBox.make({
    left: box.left - container.left,
    top: box.top - container.top,
    width: box.width,
    height: box.height,
  });

const floatingHit = (geometry: DockGeometry, point: PointerPosition) =>
  A.findFirst(A.reverse(geometry.floating), (candidate) => contains(candidate.box, point));

const compileDrop = (state: AdapterState, graph: DockAtomGraph, drag: TabDrag): O.Option<MovePanelCommand> => {
  const geometry = graph.registry.get(state.geometry.geometryAtom);
  const container = graph.registry.get(state.containerAtom);
  const point = drag.pointer;
  const outer = Math.min(32, Math.min(container.width, container.height) / 6);
  const rootSide: O.Option<DockSide> = Match.value(point).pipe(
    Match.when(
      ({ left }) => left <= container.left + outer,
      () => O.some(DockSide.Enum.left)
    ),
    Match.when(
      ({ left }) => left >= container.left + container.width - outer,
      () => O.some(DockSide.Enum.right)
    ),
    Match.when(
      ({ top }) => top <= container.top + outer,
      () => O.some(DockSide.Enum.top)
    ),
    Match.when(
      ({ top }) => top >= container.top + container.height - outer,
      () => O.some(DockSide.Enum.bottom)
    ),
    Match.orElse((): O.Option<DockSide> => O.none())
  );
  const floating = floatingHit(geometry, point);
  const group = O.match(floating, {
    onNone: () => A.findFirst(geometry.groups, (candidate) => contains(candidate.box, point)),
    onSome: (member) => A.findFirst(member.groups, (candidate) => contains(candidate.box, point)),
  });
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
          target: TabPlacement.make({
            groupId: group.value.groupId,
            index: O.some(index),
          }),
        })
      );
    }
  }
  if (O.isNone(floating) && O.isSome(rootSide)) {
    return O.some(
      MovePanelCommand.make({
        panelId: drag.panelId,
        target: RootSplitPlacement.make({
          side: rootSide.value,
          splitId: freshSplitId(),
          newGroupId: freshGroupId(),
        }),
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
  const side: O.Option<DockSide> = Match.value({ x, y }).pipe(
    Match.when(
      ({ x }) => x <= edgeX,
      () => O.some(DockSide.Enum.left)
    ),
    Match.when(
      ({ x }) => x >= box.width - edgeX,
      () => O.some(DockSide.Enum.right)
    ),
    Match.when(
      ({ y }) => y <= edgeY,
      () => O.some(DockSide.Enum.top)
    ),
    Match.when(
      ({ y }) => y >= contentHeight - edgeY,
      () => O.some(DockSide.Enum.bottom)
    ),
    Match.orElse((): O.Option<DockSide> => O.none())
  );
  if (O.isSome(side)) {
    return O.some(
      MovePanelCommand.make({
        panelId: drag.panelId,
        target: SplitPlacement.make({
          referenceGroupId: groupId,
          newGroupId: freshGroupId(),
          splitId: freshSplitId(),
          side: side.value,
        }),
      })
    );
  }
  return GroupId.equals(groupId, drag.fromGroupId)
    ? O.none()
    : O.some(
        MovePanelCommand.make({
          panelId: drag.panelId,
          target: TabPlacement.make({ groupId }),
        })
      );
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
  return A.match(boxes, {
    onEmpty: () => 0,
    onNonEmpty: (nonEmpty) => {
      const left = Math.min(...A.map(nonEmpty, (box) => box.left));
      const top = Math.min(...A.map(nonEmpty, (box) => box.top));
      const right = Math.max(...A.map(nonEmpty, (box) => box.left + box.width));
      const bottom = Math.max(...A.map(nonEmpty, (box) => box.top + box.height));
      return SplitLayout.match(split.layout, {
        horizontal: () => right - left,
        vertical: () => bottom - top,
      });
    },
  });
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
    if (P.isNull(host)) return undefined;
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
        if (active || Eq.equals(panel.renderMode, "always")) host.appendChild(targetFor(props.state, panel.id));
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
    if (P.or(Eq.equals("Enter"), Eq.equals(" "))(event.key)) activate();
  };
  const close = (): void => submit(makeOperation(ClosePanelCommand.make({ panelId: props.panel.id })));
  const pointerRef = (node: HTMLDivElement | null): (() => void) | undefined => {
    if (P.isNull(node)) return undefined;
    const cancel = (): void => props.graph.registry.set(props.state.dragAtom, O.none());
    const keydown = (event: KeyboardEvent): void => {
      if (Eq.equals(event.key, "Escape")) cancel();
    };
    const move = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.dragAtom);
      if (O.isSome(current) && PanelId.equals(current.value.panelId, props.panel.id)) {
        props.graph.registry.set(
          props.state.dragAtom,
          O.some({
            ...current.value,
            pointer: positionOf(event),
          })
        );
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
      if (P.not(Eq.equals(0))(event.button)) return;
      node.setPointerCapture?.(event.pointerId);
      props.graph.registry.set(
        props.state.dragAtom,
        O.some({
          panelId: props.panel.id,
          fromGroupId: props.groupId,
          pointer: positionOf(event),
        })
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
      {O.match(O.fromUndefinedOr(Renderer), {
        onNone: () => props.panel.title,
        onSome: (TabRenderer) => (
          <TabRenderer
            params={PanelView.match(props.panel.view, {
              component: ({ input }) => input,
              text: () => ({}),
            })}
            api={{ id: props.panel.id }}
            containerApi={props.state.api}
            title={props.panel.title}
          />
        ),
      })}
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

const GroupPane = (
  props: DockviewReactProps & {
    readonly groupId: GroupId;
    readonly state: AdapterState;
    readonly box?: DockBox | undefined;
    readonly floating?: boolean | undefined;
  }
) => {
  const tabsOption = useAtomValue(props.graph.tabsAtom(props.groupId));
  const boxOption = useAtomValue(props.state.geometry.groupBoxAtom(props.groupId));
  const workspace = useAtomValue(props.graph.workspaceAtom);
  const submit = useAtomSet(props.graph.operationAtom);
  if (O.isNone(tabsOption) || (P.isUndefined(props.box) && O.isNone(boxOption))) return null;
  const tabs = tabsOption.value;
  const box = props.box ?? O.getOrThrow(boxOption);
  const maximized = DockWorkspace.guards.empty(workspace) ? O.none<GroupId>() : workspace.maximized;
  const toggleMaximized = (): void =>
    submit(
      makeOperation(
        O.exists(maximized, (groupId) => GroupId.equals(groupId, props.groupId))
          ? RestoreMaximizedCommand.make()
          : MaximizeGroupCommand.make({ groupId: props.groupId })
      )
    );
  const strip = tabs.metadata.hideHeader ? null : (
    <div
      role="tablist"
      onDoubleClick={(event) => {
        if (P.not(Eq.equals(true))(props.floating) && Eq.equals(event.currentTarget, event.target)) toggleMaximized();
      }}
    >
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
      {P.not(Eq.equals(true))(props.floating) && (
        <>
          <button
            type="button"
            aria-label={`Float group ${props.groupId}`}
            onClick={() =>
              submit(
                makeOperation(
                  FloatGroupCommand.make({
                    groupId: props.groupId,
                    anchoredBox: TopLeftAnchoredBox.make({
                      left: box.left + 24,
                      top: box.top + 24,
                      width: Math.max(32, box.width - 48),
                      height: Math.max(32, box.height - 48),
                    }),
                  })
                )
              )
            }
          >
            Float
          </button>
          <button
            type="button"
            aria-label={`${O.isSome(maximized) ? "Restore" : "Maximize"} group ${props.groupId}`}
            onClick={toggleMaximized}
          >
            {O.isSome(maximized) ? "Restore" : "Maximize"}
          </button>
        </>
      )}
    </div>
  );
  return (
    <section
      data-group-id={props.groupId}
      data-header-position={tabs.metadata.headerPosition}
      data-locked={tabs.metadata.locked}
      onPointerDown={() => props.graph.registry.set(props.state.focusedGroupAtom, O.some(props.groupId))}
      style={{
        ...boxStyle(box),
        display: "flex",
        flexDirection: Eq.equals(tabs.metadata.headerPosition, "bottom") ? "column-reverse" : "column",
      }}
    >
      {strip}
      <ContentHost graph={props.graph} groupId={props.groupId} state={props.state} />
    </section>
  );
};

const FloatingPane = (
  props: DockviewReactProps & {
    readonly state: AdapterState;
    readonly index: number;
    readonly anchoredBox: AnchoredBox;
    readonly root: DockNode;
  }
) => {
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  const submit = useAtomSet(props.graph.operationAtom);
  const memberOption = A.get(geometry.floating, props.index);
  const groupIdOption = O.map(A.head(DockNode.tabs(props.root)), (tabs) => tabs.groupId);
  if (O.isNone(memberOption) || O.isNone(groupIdOption)) return null;
  const member = memberOption.value;
  const groupId = groupIdOption.value;
  const container = props.graph.registry.get(props.state.containerAtom);
  const finish = (node: HTMLElement, event: PointerEvent): void => {
    const gesture = props.graph.registry.get(props.state.floatingGestureAtom);
    if (O.isNone(gesture) || !GroupId.equals(gesture.value.groupId, groupId)) return;
    const override = props.graph.registry.get(props.state.floatingOverrideAtom);
    props.graph.registry.set(props.state.floatingGestureAtom, O.none());
    props.graph.registry.set(props.state.floatingOverrideAtom, O.none());
    node.releasePointerCapture?.(event.pointerId);
    if (gesture.value.moved && O.isSome(override)) {
      submit(
        makeOperation(
          MoveFloatingGroupCommand.make({
            groupId,
            anchoredBox: override.value.anchoredBox,
          })
        )
      );
    }
  };
  const gestureRef =
    (mode: FloatingGesture["mode"]) =>
    (node: HTMLDivElement | null): (() => void) | undefined => {
      if (P.isNull(node)) return undefined;
      const cancel = (): void => {
        props.graph.registry.set(props.state.floatingGestureAtom, O.none());
        props.graph.registry.set(props.state.floatingOverrideAtom, O.none());
      };
      const keydown = (event: KeyboardEvent): void => {
        if (Eq.equals(event.key, "Escape")) cancel();
      };
      const move = (event: PointerEvent): void => {
        const gesture = props.graph.registry.get(props.state.floatingGestureAtom);
        if (
          O.isNone(gesture) ||
          !GroupId.equals(gesture.value.groupId, groupId) ||
          P.not(Eq.equals(mode))(gesture.value.mode)
        )
          return;
        const dx = event.clientX - gesture.value.start.left;
        const dy = event.clientY - gesture.value.start.top;
        const next = Eq.equals(mode, "move")
          ? DockBox.make({
              ...gesture.value.initialBox,
              left: gesture.value.initialBox.left + dx,
              top: gesture.value.initialBox.top + dy,
            })
          : DockBox.make({
              ...gesture.value.initialBox,
              width: Math.max(32, gesture.value.initialBox.width + dx),
              height: Math.max(32, gesture.value.initialBox.height + dy),
            });
        props.graph.registry.set(
          props.state.floatingGestureAtom,
          O.some({
            ...gesture.value,
            moved: gesture.value.moved || P.not(Eq.equals(0))(dx) || P.not(Eq.equals(0))(dy),
          })
        );
        props.graph.registry.set(
          props.state.floatingOverrideAtom,
          O.some({
            groupId,
            anchoredBox: topLeftBox(next, container),
          })
        );
      };
      const down = (event: PointerEvent): void => {
        if (P.not(Eq.equals(0))(event.button)) return;
        event.stopPropagation();
        node.setPointerCapture?.(event.pointerId);
        props.graph.registry.set(
          props.state.floatingGestureAtom,
          O.some({
            groupId,
            mode,
            start: positionOf(event),
            initial: props.anchoredBox,
            initialBox: member.box,
            moved: false,
          })
        );
      };
      const up = (event: PointerEvent): void => finish(node, event);
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
  return (
    <div
      data-floating-pane={groupId}
      style={{ ...boxStyle(member.box), zIndex: props.index + 1 }}
      onPointerDown={() =>
        submit(
          makeOperation(
            MoveFloatingGroupCommand.make({
              groupId,
              anchoredBox: props.anchoredBox,
            })
          )
        )
      }
    >
      <div ref={gestureRef("move")} data-floating-header={groupId} style={{ height: 32, cursor: "move" }}>
        <button
          type="button"
          aria-label={`Dock group ${groupId}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() =>
            submit(
              makeOperation(
                DockFloatingGroupCommand.make({
                  groupId,
                  target: GroupRootSplitPlacement.make({
                    side: "right",
                    splitId: freshFloatingSplitId(),
                  }),
                })
              )
            )
          }
        >
          Dock
        </button>
      </div>
      {A.map(member.groups, (group) => (
        <GroupPane
          key={group.groupId}
          {...props}
          groupId={group.groupId}
          floating
          box={DockBox.make({
            left: group.box.left - member.box.left,
            top: group.box.top - member.box.top,
            width: group.box.width,
            height: group.box.height,
          })}
        />
      ))}
      <div
        ref={gestureRef("resize")}
        data-floating-resize={groupId}
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: "nwse-resize",
        }}
      />
    </div>
  );
};

const Sash = (props: { readonly graph: DockAtomGraph; readonly state: AdapterState; readonly splitId: SplitId }) => {
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  const sash = A.findFirst(geometry.sashes, (candidate) => SplitId.equals(candidate.splitId, props.splitId));
  if (O.isNone(sash)) return null;
  const attach = (node: HTMLDivElement | null): (() => void) | undefined => {
    if (P.isNull(node)) return undefined;
    const move = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.resizeAtom);
      if (O.isNone(current) || !SplitId.equals(current.value.splitId, props.splitId) || current.value.extent <= 0)
        return;
      const delta = SashDrag.match(current.value, {
        horizontal: () => event.clientX - current.value.start.left,
        vertical: () => event.clientY - current.value.start.top,
      });
      const ratio = clampRatio(current.value.initialRatio + (delta * 10_000) / current.value.extent);
      props.graph.registry.set(
        props.state.resizeAtom,
        O.some({ ...current.value, moved: current.value.moved || P.not(Eq.equals(0))(delta) })
      );
      props.graph.registry.set(
        props.state.ratioOverrideAtom,
        O.some({
          splitId: props.splitId,
          ratio,
        })
      );
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
          makeOperation(
            ResizeSplitCommand.make({
              splitId: props.splitId,
              ratio: override.value.ratio,
            })
          )
        );
      }
    };
    const down = (event: PointerEvent): void => {
      if (P.not(Eq.equals(0))(event.button)) return;
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
      style={{
        ...boxStyle(sash.value.box),
        cursor: Eq.equals(sash.value.axis, "horizontal") ? "col-resize" : "row-resize",
      }}
    />
  );
};

const DropOverlay = (props: { readonly state: AdapterState }) => {
  const drag = useAtomValue(props.state.dragAtom);
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  if (O.isNone(drag)) return null;
  const group = O.match(floatingHit(geometry, drag.value.pointer), {
    onNone: () => A.findFirst(geometry.groups, (candidate) => contains(candidate.box, drag.value.pointer)),
    onSome: (member) => A.findFirst(member.groups, (candidate) => contains(candidate.box, drag.value.pointer)),
  });
  const box = O.match(group, {
    onNone: () =>
      DockBox.make({
        left: drag.value.pointer.left - 8,
        top: drag.value.pointer.top - 8,
        width: 16,
        height: 16,
      }),
    onSome: (candidate) => candidate.box,
  });
  return <div data-drop-indicator="true" style={{ ...boxStyle(box), pointerEvents: "none" }} />;
};

const DockviewRoot = (
  props: DockviewReactProps & {
    readonly state: AdapterState;
  }
) => {
  const workspace = useAtomValue(props.graph.workspaceAtom);
  const panels = useAtomValue(props.graph.panelsAtom);
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  const groups: ReadonlyArray<TabsNode> = DockWorkspace.match(workspace, {
    empty: (): ReadonlyArray<TabsNode> => A.empty(),
    populated: ({ root }): ReadonlyArray<TabsNode> => DockNode.tabs(root),
  });
  const Watermark = props.watermarkComponent;
  const rootRef = (node: HTMLDivElement | null): (() => void) | undefined => {
    if (P.isNull(node)) return undefined;
    if (P.not((root: HTMLElement) => props.state.readyRoots.has(root))(node)) {
      props.state.readyRoots.add(node);
      props.onReady?.({ api: props.state.api });
    }
    const observer = new ResizeObserver((entries) => {
      const entry = A.head(entries);
      if (O.isNone(entry) || P.not(P.isTruthy)(node.isConnected) || P.isTruthy(node.hidden)) return;
      const { width, height } = entry.value.contentRect;
      const current = props.graph.registry.get(props.state.containerAtom);
      if (
        width > 0 &&
        height > 0 &&
        (P.not(Eq.equals(width))(current.width) || P.not(Eq.equals(height))(current.height))
      ) {
        props.graph.registry.set(
          props.state.containerAtom,
          DockBox.make({
            width,
            height,
          })
        );
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  };
  return (
    <div ref={rootRef} data-testid="dockview-react" style={{ position: "relative", width: "100%", height: "100%" }}>
      {A.match(groups, {
        onEmpty: () =>
          O.match(O.fromUndefinedOr(Watermark), {
            onNone: () => <div>Empty workspace</div>,
            onSome: (EmptyRenderer) => <EmptyRenderer />,
          }),
        onNonEmpty: (tabsNodes) =>
          A.map(tabsNodes, (tabs) => <GroupPane key={tabs.groupId} {...props} groupId={tabs.groupId} />),
      })}
      {A.map(workspace.floating, (member, index) => (
        <FloatingPane
          key={O.getOrElse(
            O.map(A.head(DockNode.tabs(member.root)), (tabs) => tabs.groupId),
            () => index
          )}
          {...props}
          index={index}
          anchoredBox={member.anchoredBox}
          root={member.root}
        />
      ))}
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

/**
 * Renders a dock workspace backed by a serialized Atom graph.
 *
 * @remarks
 * Adapter state is cached by graph identity and geometry gap so portal hosts
 * remain stable across React remounts and dock topology changes.
 *
 * @example
 * ```ts
 * import { DockviewReact } from "./DockviewReact.tsx"
 *
 * type Props = Parameters<typeof DockviewReact>[0]
 * type Graph = Props["graph"]
 * ```
 *
 * @category components
 * @since 0.0.0
 */
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
