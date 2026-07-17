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
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { makeOperation } from "./AdapterState.ts";
import { boxStyle, compileDrop, positionOf } from "./DropCompiler.ts";
import { ContentHost } from "./PanelHost.tsx";
import type { DockBox, Panel } from "@beep/dock";
import type React from "react";
import type { DockAtomGraph, DockTabRenderer, DockviewReactProps } from "../DockReact.types.ts";
import type { AdapterState } from "./AdapterState.ts";

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
      if (P.not(Eq.equals(0))(event.button)) return;
      // Presses on tab chrome (the close button) must not start a drag: the
      // pointer capture would retarget the release to the tab and swallow the
      // button's click (native capture beats React-level stopPropagation).
      if (event.target instanceof Element && P.isNotNull(event.target.closest("button"))) return;
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
