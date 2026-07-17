import {
  CommandId,
  DispatchDockCommand,
  DockBox,
  DockCommandEnvelope,
  DockNode,
  DockWorkspace,
  FloatingMember,
  GeometryOptions,
  GroupId,
  makeDockGeometryAtoms,
  makeTitleMinimaAtom,
  PopulatedWorkspace,
  SplitNode,
  TabChrome,
  UserCommandOrigin,
} from "@beep/dock";
import { PretextCaptureLive } from "@beep/pretext/browser";
import { MutableHashMap } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { Atom } from "effect/unstable/reactivity";
import type {
  ActivatePanelCommand,
  ClosePanelCommand,
  DockAtomOperation,
  DockFloatingGroupCommand,
  FloatGroupCommand,
  MaximizeGroupCommand,
  MoveFloatingGroupCommand,
  MovePanelCommand,
  PanelId,
  ResizeSplitCommand,
  RestoreMaximizedCommand,
} from "@beep/dock";
import type { DockAtomGraph, DockTitleMinimaOptions, DockviewAdapterApi } from "../DockReact.types.ts";
import type { FloatingGesture, FloatingOverride, RatioOverride, SashDrag, TabDrag } from "./Gesture.models.ts";

export type AdapterState = {
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
  readonly onReadySlot: { current: ((event: { readonly api: DockviewAdapterApi }) => void) | undefined };
  readonly rootRef: (node: HTMLDivElement | null) => (() => void) | undefined;
};

// crispen: graph identity and lifetime are host concerns; WeakMap avoids structural hashing and retains no disposed graph.
const states = new WeakMap<DockAtomGraph, MutableHashMap.MutableHashMap<string, AdapterState>>();
export let commandCounter = 0;

// crispen: the key is measurement-config values plus the provider's SEMANTIC
// identity (captureKey) — referential layer identity would mint a fresh
// retained state per render whenever a host builds captureLayer inline,
// while omitting the provider entirely would share stale metrics across
// distinct providers.
const stateKey = (gap: number, titleMinima: O.Option<DockTitleMinimaOptions>): string =>
  O.match(titleMinima, {
    onNone: () => `${gap}`,
    onSome: (config) => {
      const captureKey = O.getOrElse(O.fromUndefinedOr(config.captureKey), () => "live");
      const chrome = O.getOrElse(O.fromUndefinedOr(config.chrome), () => TabChrome.make());

      return `${gap}\u0000${config.font}\u0000${config.lineHeight}\u0000${chrome.perTab}\u0000${chrome.strip}\u0000${captureKey}`;
    },
  });

export const makeOperation = (
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

export const adapterState = (
  graph: DockAtomGraph,
  gap: number,
  titleMinima: O.Option<DockTitleMinimaOptions>
): AdapterState => {
  // crispen: geometry inputs remain the adapter identity because the derived atoms close over them.
  const byOptions = O.getOrElse(O.fromUndefinedOr(states.get(graph)), () => {
    const created = MutableHashMap.empty<string, AdapterState>();
    states.set(graph, created);
    return created;
  });
  const key = stateKey(gap, titleMinima);
  const existing = MutableHashMap.get(byOptions, key);
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
    const root = O.getOrElse(
      O.flatMap(override, (candidate) =>
        O.map(DockNode.findSplit(workspace.root, candidate.splitId), (split) =>
          DockNode.replaceSplit(workspace.root, SplitNode.withRatio(split, candidate.ratio))
        )
      ),
      () => workspace.root
    );
    return PopulatedWorkspace.make({
      revision: workspace.revision,
      root,
      maximized: workspace.maximized,
      floating,
    });
  });
  const geometry = O.match(titleMinima, {
    onNone: () =>
      makeDockGeometryAtoms({
        workspaceAtom: projectedWorkspaceAtom,
        containerAtom,
        options: GeometryOptions.make({ gap }),
      }),
    onSome: (config) =>
      makeDockGeometryAtoms({
        workspaceAtom: projectedWorkspaceAtom,
        containerAtom,
        options: GeometryOptions.make({ gap }),
        minimaAtom: makeTitleMinimaAtom({
          workspaceAtom: graph.workspaceAtom,
          captureLayer: O.getOrElse(O.fromUndefinedOr(config.captureLayer), () => PretextCaptureLive),
          font: config.font,
          lineHeight: config.lineHeight,
          chrome: config.chrome,
        }),
      }),
  });
  const readyRoots = new WeakSet<HTMLElement>();
  const onReadySlot: { current: ((event: { readonly api: DockviewAdapterApi }) => void) | undefined } = {
    current: undefined,
  };
  // Stable identity across renders: React 19 only re-runs a ref callback when
  // its identity changes, so wiring the ResizeObserver here (instead of inline
  // in the component) keeps one observer per mounted root.
  const rootRef = (node: HTMLDivElement | null): (() => void) | undefined => {
    if (P.isNull(node)) return undefined;
    if (P.not((root: HTMLElement) => readyRoots.has(root))(node)) {
      readyRoots.add(node);
      onReadySlot.current?.({ api });
    }
    const observer = new ResizeObserver((entries) => {
      const entry = A.head(entries);
      if (O.isNone(entry) || P.not(P.isTruthy)(node.isConnected) || P.isTruthy(node.hidden)) return;
      const { width, height } = entry.value.contentRect;
      const current = graph.registry.get(containerAtom);
      if (
        width > 0 &&
        height > 0 &&
        (P.not(Eq.equals(width))(current.width) || P.not(Eq.equals(height))(current.height))
      ) {
        graph.registry.set(
          containerAtom,
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
    readyRoots,
    api,
    onReadySlot,
    rootRef,
  };
  MutableHashMap.set(byOptions, key, created);
  return created;
};
