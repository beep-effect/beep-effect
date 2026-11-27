import {
  ActivatePanelCommand,
  ClosePanelCommand,
  DockWorkspace,
  FloatGroupCommand,
  GroupId,
  MaximizeGroupCommand,
  PanelId,
  PanelView,
  RestoreMaximizedCommand,
  TabsNode,
  TopLeftAnchoredBox,
} from "@beep/dock";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { useCallback, useEffect, useRef } from "react";
import { DockPanelApi } from "../DockReact.types.ts";
import { makeOperation } from "./AdapterState.ts";
import {
  compileDrop,
  exceedsDragThreshold,
  preFloatContextFor,
  pressStartsOnButton,
  preventNativeSelection,
  px,
  relativePositionOf,
  releaseCapture,
} from "./DropCompiler.ts";
import { TabDrag, TabRect } from "./Gesture.models.ts";
import { FloatIcon, MaximizeIcon, RestoreIcon } from "./Icons.tsx";
import { ContentHost } from "./PanelHost.tsx";
import type { DockBox, Panel } from "@beep/dock";
import type React from "react";
import type { DockAtomGraph, DockTabRenderer, DockviewReactProps } from "../DockReact.types.ts";
import type { AdapterState } from "./AdapterState.ts";

const OVERFLOW_TRIGGER_WIDTH = 32;

const panelIdsEqual = A.makeEquivalence(S.toEquivalence(PanelId));

const tabWidthsFor = (state: AdapterState, groupId: GroupId): MutableHashMap.MutableHashMap<PanelId, number> =>
  O.getOrElse(MutableHashMap.get(state.tabWidths, groupId), () => {
    const widths = MutableHashMap.empty<PanelId, number>();
    MutableHashMap.set(state.tabWidths, groupId, widths);
    return widths;
  });

const tabRectsFor = (state: AdapterState, groupId: GroupId): MutableHashMap.MutableHashMap<PanelId, TabRect> =>
  O.getOrElse(MutableHashMap.get(state.tabRects, groupId), () => {
    const rects = MutableHashMap.empty<PanelId, TabRect>();
    MutableHashMap.set(state.tabRects, groupId, rects);
    return rects;
  });

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
    const clearDrag = (): void => {
      const recordedDrag = props.graph.registry.get(props.state.dragAtom);
      props.graph.registry.set(props.state.dragAtom, O.none());
      O.match(recordedDrag, {
        onNone: () => undefined,
        onSome: (drag) => {
          releaseCapture(node, drag.pointerId);
          return undefined;
        },
      });
    };
    const cancelWithEscape = (): void => {
      const liveDragOfThisTab = O.filter(
        props.graph.registry.get(props.state.dragAtom),
        (drag) => !drag.concluded && S.toEquivalence(PanelId)(drag.panelId, props.panel.id)
      );
      if (O.isNone(liveDragOfThisTab)) return;
      props.graph.registry.set(
        props.state.dragAtom,
        O.flatMap(liveDragOfThisTab, (drag) =>
          drag.moved ? TabDrag.makeOption({ ...drag, concluded: true }) : O.none()
        )
      );
      if (O.exists(liveDragOfThisTab, (drag) => drag.moved)) {
        const active = node
          .closest("[data-group-id]")
          ?.querySelector<HTMLElement>("[data-panel-id][data-active='true']");
        active?.focus({ preventScroll: true });
      }
    };
    const keydown = (event: KeyboardEvent): void => {
      if (Eq.equals(event.key, "Escape")) cancelWithEscape();
    };
    const click = (event: MouseEvent): void => {
      const current = props.graph.registry.get(props.state.dragAtom);
      if (O.exists(current, (drag) => drag.concluded && S.toEquivalence(PanelId)(drag.panelId, props.panel.id))) {
        props.graph.registry.set(props.state.dragAtom, O.none());
        event.stopPropagation();
        event.preventDefault();
      }
    };
    const move = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.dragAtom);
      if (
        O.isSome(current) &&
        !current.value.concluded &&
        S.toEquivalence(PanelId)(current.value.panelId, props.panel.id)
      ) {
        const pointer = relativePositionOf(props.state, event);
        props.graph.registry.set(
          props.state.dragAtom,
          O.some({
            ...current.value,
            pointer,
            moved: current.value.moved || exceedsDragThreshold(current.value.origin, pointer),
          })
        );
      }
    };
    const up = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.dragAtom);
      if (O.isNone(current) || !S.toEquivalence(PanelId)(current.value.panelId, props.panel.id)) return;
      if (current.value.concluded) {
        releaseCapture(node, event.pointerId);
        event.preventDefault();
        return;
      }
      const pointer = relativePositionOf(props.state, event);
      const promotedOnRelease = exceedsDragThreshold(current.value.origin, pointer);
      const finalDrag = {
        ...current.value,
        pointer,
        moved: current.value.moved || promotedOnRelease,
      };
      props.graph.registry.set(
        props.state.dragAtom,
        finalDrag.moved ? TabDrag.makeOption({ ...finalDrag, concluded: true }) : O.none()
      );
      releaseCapture(node, event.pointerId);
      if (finalDrag.moved)
        O.map(compileDrop(props.state, props.graph, finalDrag), (command) => submit(makeOperation(command)));
      event.preventDefault();
    };
    const clearConcludedBeforeButtonGuard = (): void => {
      if (O.exists(props.graph.registry.get(props.state.dragAtom), (drag) => drag.concluded)) {
        props.graph.registry.set(props.state.dragAtom, O.none());
      }
    };
    const down = (event: PointerEvent): void => {
      clearConcludedBeforeButtonGuard();
      if (P.not(Eq.equals(0))(event.button) || pressStartsOnButton(event)) return;
      preventNativeSelection(event);
      node.focus({ preventScroll: true });
      node.setPointerCapture?.(event.pointerId);
      const pointer = relativePositionOf(props.state, event);
      props.graph.registry.set(
        props.state.dragAtom,
        TabDrag.makeOption({
          panelId: props.panel.id,
          fromGroupId: props.groupId,
          pointer,
          origin: pointer,
          moved: false,
          concluded: false,
          pointerId: event.pointerId,
          // fallow-ignore-next-line code-duplication -- pointer-down captures the drag snapshot for its paired move handler, like the floating pane. Owner: @beep/dock-react. Exit: share one drag-snapshot hook once a third pane needs it.
        })
      );
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", clearDrag);
    node.addEventListener("click", click);
    // fallow-ignore-next-line code-duplication -- listener registration and its teardown must name the same closures inline so removeEventListener matches them. Owner: @beep/dock-react. Exit: replace with an atom-owned listener scope that releases its own listeners.
    document.addEventListener("keydown", keydown);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", clearDrag);
      node.removeEventListener("click", click);
      document.removeEventListener("keydown", keydown);
    };
  };
  const Renderer = O.getOrElse(
    O.flatMap(props.panel.tabComponent, (key) =>
      O.flatMap(O.fromUndefinedOr(props.tabComponents), (components) => R.get(components, key))
    ),
    () => props.defaultTabComponent
  );
  return (
    <div
      role="tab"
      aria-selected={props.active}
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
            api={DockPanelApi.make({ id: props.panel.id })}
            containerApi={props.state.api}
            title={props.panel.title}
          />
        ),
      })}
      <button
        type="button"
        aria-label={`Close ${props.panel.title}`}
        onPointerDown={(event) => event.stopPropagation()}
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

// fallow-ignore-next-line complexity -- fallow's React model adds one cognitive point per hook binding; cognitive 11 comes from 11 hook bindings with cyclomatic 1, so splitting would only fragment hook ownership (#1855 detector frontier). Owner: @beep/dock-react. Exit: remove when the component sheds bindings or fallow stops counting hook bindings as branches.
const TabStrip = (
  props: DockviewReactProps & {
    readonly groupId: GroupId;
    readonly state: AdapterState;
    readonly tabs: TabsNode;
    readonly floating: boolean;
    readonly toggleMaximized: () => void;
    readonly actions: React.ReactNode;
  }
) => {
  const submit = useAtomSet(props.graph.operationAtom);
  const overflowAtom = props.state.overflowAtom(props.groupId);
  const overflowOpenAtom = props.state.overflowOpenAtom(props.groupId);
  const overflowed = useAtomValue(overflowAtom);
  const overflowOpen = useAtomValue(overflowOpenAtom);
  const setOverflowed = useAtomSet(overflowAtom);
  const setOverflowOpen = useAtomSet(overflowOpenAtom);
  const measuredThisMount = useRef(false);
  const overflowRootRef = useRef<HTMLDivElement | null>(null);
  const tabs = props.tabs;
  const panels = TabsNode.panels(tabs);
  const activateOverflow = (panel: Panel): void => {
    props.graph.registry.set(props.state.focusedGroupAtom, O.some(props.groupId));
    submit(makeOperation(ActivatePanelCommand.make({ panelId: panel.id })));
    setOverflowOpen(false);
  };
  const measureStrip = (node: HTMLDivElement, width: number): void => {
    const tabWidths = tabWidthsFor(props.state, props.groupId);
    const tabRects = tabRectsFor(props.state, props.groupId);
    const rootLeft = pipe(
      O.fromNullOr(props.state.rootNode.current),
      O.match({
        onNone: () => 0,
        onSome: (root) => root.getBoundingClientRect().left,
      })
    );
    A.forEach(panels, (panel) => {
      const tab = node.querySelector<HTMLElement>(`[data-panel-id='${panel.id}']`);
      if (P.isNotNull(tab)) {
        const rect = tab.getBoundingClientRect();
        if (N.isGreaterThan(rect.width, 0)) {
          MutableHashMap.set(tabWidths, panel.id, rect.width);
          MutableHashMap.set(tabRects, panel.id, TabRect.make({ left: rect.left - rootLeft, width: rect.width }));
        }
        return;
      }
      MutableHashMap.remove(tabRects, panel.id);
    });
    const actionsWidth = O.match(O.fromNullOr(node.querySelector<HTMLElement>("[data-dock-actions]")), {
      onNone: () => 0,
      onSome: (actions) => actions.getBoundingClientRect().width,
    });
    const totalTabsWidth = A.reduce(panels, 0, (total, panel) =>
      N.sum(
        total,
        pipe(
          MutableHashMap.get(tabWidths, panel.id),
          O.getOrElse(() => 0)
        )
      )
    );
    const unmeasured =
      N.isLessThanOrEqualTo(width, 0) || A.every(panels, (panel) => O.isNone(MutableHashMap.get(tabWidths, panel.id)));
    const allFit = unmeasured || N.isLessThanOrEqualTo(N.sum(totalTabsWidth, actionsWidth), width);
    const nextOverflow = Bool.match(allFit, {
      onTrue: A.empty<PanelId>,
      onFalse: () => {
        const activeWidth = pipe(
          MutableHashMap.get(tabWidths, tabs.active.id),
          O.getOrElse(() => 0)
        );
        const capacity = N.max(0, N.subtract(N.subtract(width, actionsWidth), OVERFLOW_TRIGGER_WIDTH));
        const availableForInactive = N.max(0, N.subtract(capacity, activeWidth));
        const visibleInactive = A.reduce(panels, { ids: A.empty<PanelId>(), width: 0 }, (visible, panel) => {
          if (S.toEquivalence(PanelId)(panel.id, tabs.active.id)) return visible;
          const panelWidth = pipe(
            MutableHashMap.get(tabWidths, panel.id),
            O.getOrElse(() => 0)
          );
          if (N.isGreaterThan(N.sum(visible.width, panelWidth), availableForInactive)) return visible;
          return { ids: A.append(visible.ids, panel.id), width: N.sum(visible.width, panelWidth) };
        });
        const visibleIds = A.append(visibleInactive.ids, tabs.active.id);
        return pipe(
          panels,
          A.filter((panel) => A.every(visibleIds, (panelId) => Bool.not(S.toEquivalence(PanelId)(panelId, panel.id)))),
          A.map((panel) => panel.id)
        );
      },
    });
    const firstMeasurementMustRerender = Bool.not(measuredThisMount.current);
    measuredThisMount.current = true;
    if (firstMeasurementMustRerender || Bool.not(panelIdsEqual(overflowed, nextOverflow))) setOverflowed(nextOverflow);
  };
  const measureStripLatest = useRef(measureStrip);
  useEffect(() => {
    measureStripLatest.current = measureStrip;
  });
  const stripRef = useCallback((node: HTMLDivElement | null): (() => void) | undefined => {
    if (P.isNull(node)) return undefined;
    const observer = new ResizeObserver((entries) =>
      O.map(A.head(entries), (entry) => measureStripLatest.current(node, entry.contentRect.width))
    );
    observer.observe(node);
    const initialWidth = node.getBoundingClientRect().width;
    if (N.isGreaterThan(initialWidth, 0)) measureStripLatest.current(node, initialWidth);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (Bool.not(overflowOpen)) return undefined;
    const press = (event: PointerEvent): void => {
      const root = overflowRootRef.current;
      if (P.isNotNull(root) && event.target instanceof Node && root.contains(event.target)) return;
      setOverflowOpen(false);
    };
    const keydown = (event: KeyboardEvent): void => {
      if (Eq.equals(event.key, "Escape")) setOverflowOpen(false);
    };
    document.addEventListener("pointerdown", press);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("keydown", keydown);
    };
  }, [overflowOpen, setOverflowOpen]);
  const hiddenPanels = Bool.match(measuredThisMount.current, {
    onFalse: A.empty<Panel>,
    onTrue: () =>
      A.filter(
        panels,
        (panel) =>
          Bool.not(S.toEquivalence(PanelId)(panel.id, tabs.active.id)) &&
          A.some(overflowed, (panelId) => S.toEquivalence(PanelId)(panelId, panel.id))
      ),
  });
  return (
    <div
      ref={stripRef}
      role="tablist"
      data-dock-tab-strip=""
      onDoubleClick={(event) => {
        if (P.not(Eq.equals(true))(props.floating) && Eq.equals(event.currentTarget, event.target))
          props.toggleMaximized();
      }}
    >
      {A.map(
        A.filter(panels, (panel) =>
          A.every(hiddenPanels, (hidden) => Bool.not(S.toEquivalence(PanelId)(hidden.id, panel.id)))
        ),
        (panel) => (
          <Tab
            key={panel.id}
            graph={props.graph}
            groupId={props.groupId}
            panel={panel}
            active={S.toEquivalence(PanelId)(panel.id, tabs.active.id)}
            state={props.state}
            tabComponents={props.tabComponents}
            defaultTabComponent={props.defaultTabComponent}
          />
        )
      )}
      {A.match(hiddenPanels, {
        onEmpty: () => null,
        onNonEmpty: () => (
          <div ref={overflowRootRef} data-dock-overflow-root="">
            <button
              type="button"
              aria-label={`Show ${A.length(hiddenPanels)} overflowed tabs`}
              aria-expanded={overflowOpen}
              data-dock-overflow=""
              style={{ "--dock-overflow-width": px(OVERFLOW_TRIGGER_WIDTH) } as React.CSSProperties}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setOverflowOpen(Bool.not(overflowOpen))}
            >
              ⋯
            </button>
            {overflowOpen && (
              <div role="menu">
                {A.map(hiddenPanels, (panel) => (
                  <button
                    key={panel.id}
                    type="button"
                    role="menuitem"
                    data-panel-id={panel.id}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => activateOverflow(panel)}
                  >
                    {panel.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ),
      })}
      {props.actions}
    </div>
  );
};

// fallow-ignore-next-line complexity -- cognitive 14 comes from branching over tab and box options and the floating variants. Owner: @beep/dock-react. Exit: split the floating variant into its own component when its options diverge further.
export const GroupPane = (
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
        O.exists(maximized, (groupId) => S.toEquivalence(GroupId)(groupId, props.groupId))
          ? RestoreMaximizedCommand.make({})
          : MaximizeGroupCommand.make({ groupId: props.groupId })
      )
    );
  const actions = P.not(Eq.equals(true))(props.floating) && (
    <div data-dock-actions="">
      <button
        type="button"
        aria-label={`Float group ${props.groupId}`}
        title="Float"
        onClick={() => {
          O.match(preFloatContextFor(workspace, props.groupId), {
            onNone: () => MutableHashMap.remove(props.state.preFloatPlacements, props.groupId),
            onSome: (context) => MutableHashMap.set(props.state.preFloatPlacements, props.groupId, context),
          });
          const container = props.graph.registry.get(props.state.containerAtom);
          const cascadeOffset = 32 * (workspace.floating.length % 6);
          submit(
            makeOperation(
              FloatGroupCommand.make({
                groupId: props.groupId,
                anchoredBox: TopLeftAnchoredBox.make({
                  left: box.left + 24 + cascadeOffset,
                  top: box.top + 24 + cascadeOffset,
                  width: Math.min(Math.max(360, box.width - 48), Math.max(360, container.width * 0.55)),
                  height: Math.min(Math.max(240, box.height - 48), Math.max(240, container.height * 0.6)),
                }),
              })
            )
          );
        }}
      >
        <FloatIcon />
      </button>
      <button
        type="button"
        aria-label={`${O.isSome(maximized) ? "Restore" : "Maximize"} group ${props.groupId}`}
        title={O.isSome(maximized) ? "Restore" : "Maximize"}
        onClick={toggleMaximized}
      >
        {O.isSome(maximized) ? <RestoreIcon /> : <MaximizeIcon />}
      </button>
    </div>
  );
  return (
    <section
      data-group-id={props.groupId}
      data-header-position={tabs.metadata.headerPosition}
      data-locked={tabs.metadata.locked}
      onPointerDown={() => props.graph.registry.set(props.state.focusedGroupAtom, O.some(props.groupId))}
      style={
        {
          "--dock-left": px(box.left),
          "--dock-top": px(box.top),
          "--dock-width": px(box.width),
          "--dock-height": px(box.height),
        } as React.CSSProperties
      }
    >
      {tabs.metadata.hideHeader ? null : (
        <TabStrip
          {...props}
          tabs={tabs}
          floating={Eq.equals(props.floating, true)}
          toggleMaximized={toggleMaximized}
          actions={actions}
        />
      )}
      <ContentHost graph={props.graph} groupId={props.groupId} state={props.state} />
    </section>
  );
};
