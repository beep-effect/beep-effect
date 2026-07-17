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
import { MutableHashMap, Number as N, pipe } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { useRef } from "react";
import { makeOperation } from "./AdapterState.ts";
import { boxStyle, compileDrop, positionOf, pressStartsOnButton } from "./DropCompiler.ts";
import { ContentHost } from "./PanelHost.tsx";
import type { DockBox, Panel } from "@beep/dock";
import type React from "react";
import type { DockAtomGraph, DockTabRenderer, DockviewReactProps } from "../DockReact.types.ts";
import type { AdapterState } from "./AdapterState.ts";

const panelIdsEqual = A.makeEquivalence(PanelId.equals);

const tabWidthsFor = (state: AdapterState, groupId: GroupId): MutableHashMap.MutableHashMap<PanelId, number> =>
  O.getOrElse(MutableHashMap.get(state.tabWidths, groupId), () => {
    const widths = MutableHashMap.empty<PanelId, number>();
    MutableHashMap.set(state.tabWidths, groupId, widths);
    return widths;
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
    // fallow-ignore-next-line code-duplication
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
      if (P.not(Eq.equals(0))(event.button) || pressStartsOnButton(event)) return;
      node.setPointerCapture?.(event.pointerId);
      props.graph.registry.set(
        props.state.dragAtom,
        O.some({
          panelId: props.panel.id,
          fromGroupId: props.groupId,
          pointer: positionOf(event),
          // fallow-ignore-next-line code-duplication
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
      style={{ flex: "0 0 auto" }}
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
        // Real pointers: without this the tab's drag compiler captures the
        // pointer on pointerdown and the button's click never fires (jsdom
        // stubs capture, so only a live browser exposes it).
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

// fallow-ignore-next-line complexity
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
  const overflowAtom = props.state.overflowAtom(props.groupId);
  const overflowOpenAtom = props.state.overflowOpenAtom(props.groupId);
  const overflowed = useAtomValue(overflowAtom);
  const overflowOpen = useAtomValue(overflowOpenAtom);
  const setOverflowed = useAtomSet(overflowAtom);
  const setOverflowOpen = useAtomSet(overflowOpenAtom);
  // The overflow atom is keep-alive per group, but its value describes a
  // measurement of a particular strip DOM. Across an unmount/remount the
  // stale value must not hide tabs before this mount has measured — so
  // hiding is gated on a per-mount freshness flag that measureStrip flips.
  const measuredThisMount = useRef(false);
  const tabWidths = tabWidthsFor(props.state, props.groupId);
  if (O.isNone(tabsOption) || (P.isUndefined(props.box) && O.isNone(boxOption))) return null;
  const tabs = tabsOption.value;
  const box = props.box ?? O.getOrThrow(boxOption);
  const panels = TabsNode.panels(tabs);
  const hiddenPanels = Bool.match(measuredThisMount.current, {
    onFalse: A.empty<Panel>,
    onTrue: () =>
      A.filter(
        panels,
        (panel) =>
          Bool.not(PanelId.equals(panel.id, tabs.active.id)) &&
          A.some(overflowed, (panelId) => PanelId.equals(panelId, panel.id))
      ),
  });
  const maximized = DockWorkspace.guards.empty(workspace) ? O.none<GroupId>() : workspace.maximized;
  const toggleMaximized = (): void =>
    submit(
      makeOperation(
        O.exists(maximized, (groupId) => GroupId.equals(groupId, props.groupId))
          ? RestoreMaximizedCommand.make()
          : MaximizeGroupCommand.make({ groupId: props.groupId })
      )
    );
  const activateOverflow = (panel: Panel): void => {
    props.graph.registry.set(props.state.focusedGroupAtom, O.some(props.groupId));
    submit(makeOperation(ActivatePanelCommand.make({ panelId: panel.id })));
    setOverflowOpen(false);
  };
  const measureStrip = (node: HTMLDivElement, width: number): void => {
    A.forEach(panels, (panel) => {
      const tab = node.querySelector<HTMLElement>(`[data-panel-id='${panel.id}']`);
      if (P.isNotNull(tab)) {
        const measured = tab.getBoundingClientRect().width;
        if (N.isGreaterThan(measured, 0)) MutableHashMap.set(tabWidths, panel.id, measured);
      }
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
    // An unmeasured strip (zero width, or no tab has reported a real width
    // yet) must never overflow: before layout settles the honest state is
    // "everything visible", not "everything hidden" — otherwise the first
    // frames flicker every inactive tab into the dropdown.
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
        const capacity = N.max(0, N.subtract(N.subtract(width, actionsWidth), 32));
        const availableForInactive = N.max(0, N.subtract(capacity, activeWidth));
        const visibleInactive = A.reduce(panels, { ids: A.empty<PanelId>(), width: 0 }, (visible, panel) => {
          if (PanelId.equals(panel.id, tabs.active.id)) return visible;
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
          A.filter((panel) => A.every(visibleIds, (panelId) => Bool.not(PanelId.equals(panelId, panel.id)))),
          A.map((panel) => panel.id)
        );
      },
    });
    // The first measurement of a mount must always publish (even an equal
    // value) so the render gated on the freshness flag re-runs with hiding
    // enabled; after that, only genuine changes re-publish.
    const firstMeasurement = Bool.not(measuredThisMount.current);
    measuredThisMount.current = true;
    if (firstMeasurement || Bool.not(panelIdsEqual(overflowed, nextOverflow))) setOverflowed(nextOverflow);
  };
  const stripRef = (node: HTMLDivElement | null): (() => void) | undefined => {
    if (P.isNull(node)) return undefined;
    const observer = new ResizeObserver((entries) =>
      O.map(A.head(entries), (entry) => measureStrip(node, entry.contentRect.width))
    );
    observer.observe(node);
    const initialWidth = node.getBoundingClientRect().width;
    if (N.isGreaterThan(initialWidth, 0)) measureStrip(node, initialWidth);
    return () => observer.disconnect();
  };
  const strip = tabs.metadata.hideHeader ? null : (
    <div
      ref={stripRef}
      role="tablist"
      data-dock-tab-strip=""
      style={{ display: "flex", minWidth: 0 }}
      onDoubleClick={(event) => {
        if (P.not(Eq.equals(true))(props.floating) && Eq.equals(event.currentTarget, event.target)) toggleMaximized();
      }}
    >
      {A.map(
        A.filter(panels, (panel) => A.every(hiddenPanels, (hidden) => Bool.not(PanelId.equals(hidden.id, panel.id)))),
        (panel) => (
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
        )
      )}
      {A.match(hiddenPanels, {
        onEmpty: () => null,
        onNonEmpty: () => (
          <div style={{ position: "relative", flex: "0 0 auto" }}>
            <button
              type="button"
              aria-label={`Show ${A.length(hiddenPanels)} overflowed tabs`}
              aria-expanded={overflowOpen}
              data-dock-overflow=""
              style={{ width: 32 }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setOverflowOpen(Bool.not(overflowOpen))}
            >
              ⋯
            </button>
            {overflowOpen && (
              <div role="menu" style={{ position: "absolute", insetInlineEnd: 0, zIndex: 2 }}>
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
      {P.not(Eq.equals(true))(props.floating) && (
        <div data-dock-actions="" style={{ marginInlineStart: "auto", display: "inline-flex", gap: 2 }}>
          <button
            type="button"
            aria-label={`Float group ${props.groupId}`}
            onClick={() => {
              // Cascade against the existing floating stack and cap to a
              // useful viewport fraction, so a new float never fully occludes
              // an earlier one's header.
              const container = props.graph.registry.get(props.state.containerAtom);
              const step = 32 * (workspace.floating.length % 6);
              submit(
                makeOperation(
                  FloatGroupCommand.make({
                    groupId: props.groupId,
                    anchoredBox: TopLeftAnchoredBox.make({
                      left: box.left + 24 + step,
                      top: box.top + 24 + step,
                      width: Math.min(Math.max(360, box.width - 48), Math.max(360, container.width * 0.55)),
                      height: Math.min(Math.max(240, box.height - 48), Math.max(240, container.height * 0.6)),
                    }),
                  })
                )
              );
            }}
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
        </div>
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
