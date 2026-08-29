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
import * as R from "effect/Record";
import { useCallback, useEffect, useRef } from "react";
import { makeOperation } from "./AdapterState.ts";
import {
  boxStyle,
  compileDrop,
  exceedsDragThreshold,
  preFloatContextFor,
  pressStartsOnButton,
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

const panelIdsEqual = A.makeEquivalence(PanelId.equals);

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
    // fallow-ignore-next-line code-duplication -- tab dragging owns a distinct cancel handler and drag atom
    const clearDrag = (): void => {
      const current = props.graph.registry.get(props.state.dragAtom);
      props.graph.registry.set(props.state.dragAtom, O.none());
      // Synthetic pointercancel events skip the implicit capture release a
      // real input-source cancel performs, and carry a default pointerId
      // rather than the captured one — release the identity recorded at
      // the press.
      O.match(current, {
        onNone: () => undefined,
        onSome: (drag) => {
          releaseCapture(node, drag.pointerId);
          return undefined;
        },
      });
    };
    // Escape on a PROMOTED drag concludes it but keeps the record so the
    // release's trailing click can be recognized and swallowed; an
    // unpromoted press (no drag chrome shown) clears outright so the
    // release still reads as a plain activation click. pointercancel also
    // clears outright: no click ever follows a pointercancel.
    const cancelWithEscape = (): void => {
      // Every tab registers this document listener, so only the DRAGGED tab's
      // own listener acts — otherwise a sibling concludes the record first and
      // the owner then finds nothing left to restore focus from. A record that
      // already concluded is waiting for its trailing click, not for Escape:
      // after a cross-group drop unmounts the source tab that click may never
      // arrive, and an unrelated Escape (dismissing a menu) must not re-enter
      // cancellation or steal focus on its behalf.
      const current = O.filter(
        props.graph.registry.get(props.state.dragAtom),
        (drag) => !drag.concluded && PanelId.equals(drag.panelId, props.panel.id)
      );
      if (O.isNone(current)) return;
      props.graph.registry.set(
        props.state.dragAtom,
        O.flatMap(current, (drag) => (drag.moved ? O.some(TabDrag.make({ ...drag, concluded: true })) : O.none()))
      );
      // The press moved focus to the dragged tab; hand it back to the
      // group's active tab so the cancelled gesture leaves no focus trace
      // (roving tabindex: focus follows activation). Only the owning tab's
      // listener restores — sibling keydown listeners may already have
      // concluded the drag by the time this one runs, and focusing the
      // active tab is idempotent.
      if (O.exists(current, (drag) => drag.moved)) {
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
      if (O.exists(current, (drag) => drag.concluded && PanelId.equals(drag.panelId, props.panel.id))) {
        props.graph.registry.set(props.state.dragAtom, O.none());
        // The capture target receives a click for the cancelled drag's
        // release; it is not an activation click.
        event.stopPropagation();
        event.preventDefault();
      }
    };
    const move = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.dragAtom);
      if (O.isSome(current) && !current.value.concluded && PanelId.equals(current.value.panelId, props.panel.id)) {
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
      if (O.isNone(current) || !PanelId.equals(current.value.panelId, props.panel.id)) return;
      if (current.value.concluded) {
        // The concluded record stays for the trailing click to consume.
        releaseCapture(node, event.pointerId);
        event.preventDefault();
        return;
      }
      const pointer = relativePositionOf(props.state, event);
      const finalDrag = {
        ...current.value,
        pointer,
        // The release itself can carry the promoting displacement (jsdom
        // tests fire down→up with no intervening move), so re-check here.
        moved: current.value.moved || exceedsDragThreshold(current.value.origin, pointer),
      };
      // A promoted drag concludes but stays recorded: its trailing click
      // must not activate the source tab or re-point focus at the source
      // group after the panel has moved. An unpromoted press clears so the
      // release reads as a plain click.
      props.graph.registry.set(
        props.state.dragAtom,
        finalDrag.moved ? O.some(TabDrag.make({ ...finalDrag, concluded: true })) : O.none()
      );
      releaseCapture(node, event.pointerId);
      if (finalDrag.moved)
        O.map(compileDrop(props.state, props.graph, finalDrag), (command) => submit(makeOperation(command)));
      event.preventDefault();
    };
    const down = (event: PointerEvent): void => {
      // A concluded record whose trailing click never arrived (touch and
      // pen releases produce no click) must not outlive the next press
      // anywhere on the tab — including its buttons, whose presses return
      // early below and would otherwise leave the stale record to swallow
      // the button's own click.
      if (O.exists(props.graph.registry.get(props.state.dragAtom), (drag) => drag.concluded)) {
        props.graph.registry.set(props.state.dragAtom, O.none());
      }
      if (P.not(Eq.equals(0))(event.button) || pressStartsOnButton(event)) return;
      // Chrome anchors a native text selection even when the press starts on
      // a `user-select: none` tab, then extends it across panel content as
      // the drag leaves the strip — cancel the default before capturing.
      event.preventDefault();
      // preventDefault also suppresses the native click-to-focus transfer;
      // restore it so roving tab focus and Enter/Space track the clicked tab
      // instead of re-activating the previously focused one.
      node.focus({ preventScroll: true });
      node.setPointerCapture?.(event.pointerId);
      const pointer = relativePositionOf(props.state, event);
      props.graph.registry.set(
        props.state.dragAtom,
        O.some({
          panelId: props.panel.id,
          fromGroupId: props.groupId,
          pointer,
          origin: pointer,
          moved: false,
          concluded: false,
          pointerId: event.pointerId,
          // fallow-ignore-next-line code-duplication -- pointer-down captures the drag snapshot for the paired move handler
        })
      );
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", clearDrag);
    node.addEventListener("click", click);
    // fallow-ignore-next-line code-duplication -- listener registration and its mirrored teardown must name the same closures inline; extracting them would hide the identity contract that makes removeEventListener work
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
      style={{ flex: "0 0 auto", touchAction: "none" }}
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

// fallow-ignore-next-line complexity -- cognitive 11 = pre-existing hook/JSX tax (fallow counts each of the 11 hook bindings); this branch's only change in this file was a one-line aria-selected on the Tab child and added no branching
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
  // The overflow atom is keep-alive per group, but its value describes a
  // measurement of a particular strip DOM. Across an unmount/remount the
  // stale value must not hide tabs before this mount has measured — so
  // hiding is gated on a per-mount freshness flag that measureStrip flips.
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
    // Rects are recorded root-relative so drop targeting shares the pointer's
    // coordinate space; panels absent from the DOM (overflowed) are cleared so
    // a stale rect can never make a hidden tab look droppable.
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
  // Stable ref + latest-closure pattern: the ResizeObserver must survive
  // re-renders (a per-render callback ref would disconnect/reconnect it on
  // every render, e.g. each dropdown toggle), while measurements must see the
  // current panels/atom values — so the stable callback dispatches through a
  // ref the effect refreshes each render.
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
  // ARIA menu semantics: an open dropdown dismisses on any pointer press
  // outside its own subtree and on Escape.
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
          Bool.not(PanelId.equals(panel.id, tabs.active.id)) &&
          A.some(overflowed, (panelId) => PanelId.equals(panelId, panel.id))
      ),
  });
  return (
    <div
      ref={stripRef}
      role="tablist"
      data-dock-tab-strip=""
      style={{ display: "flex", minWidth: 0 }}
      onDoubleClick={(event) => {
        if (P.not(Eq.equals(true))(props.floating) && Eq.equals(event.currentTarget, event.target))
          props.toggleMaximized();
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
          <div ref={overflowRootRef} style={{ position: "relative", flex: "0 0 auto" }}>
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
      {props.actions}
    </div>
  );
};

// fallow-ignore-next-line complexity -- cognitive 15 = pre-existing branching over tab/box options and floating variants; this branch's only change in this file was a one-line aria-selected on the Tab child and added no branching
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
        O.exists(maximized, (groupId) => GroupId.equals(groupId, props.groupId))
          ? RestoreMaximizedCommand.make()
          : MaximizeGroupCommand.make({ groupId: props.groupId })
      )
    );
  const actions = P.not(Eq.equals(true))(props.floating) && (
    <div data-dock-actions="" style={{ marginInlineStart: "auto", display: "inline-flex", gap: 2 }}>
      <button
        type="button"
        aria-label={`Float group ${props.groupId}`}
        title="Float"
        onClick={() => {
          // Remember where this group sat so Dock can put it back
          // (neighbor, side, and split share) instead of forcing a
          // root-right column — QA finding R1-03.
          O.match(preFloatContextFor(workspace, props.groupId), {
            onNone: () => MutableHashMap.remove(props.state.preFloatPlacements, props.groupId),
            onSome: (context) => MutableHashMap.set(props.state.preFloatPlacements, props.groupId, context),
          });
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
      style={{
        ...boxStyle(box),
        display: "flex",
        flexDirection: Eq.equals(tabs.metadata.headerPosition, "bottom") ? "column-reverse" : "column",
      }}
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
