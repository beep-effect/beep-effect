import { DockWorkspace, GroupId, PanelId, PanelView } from "@beep/dock";
import { useAtomValue } from "@effect/atom-react";
import { MutableHashMap } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { createPortal } from "react-dom";
import type { Panel } from "@beep/dock";
import type { DockAtomGraph, DockRenderer } from "../DockReact.types.ts";
import type { AdapterState } from "./AdapterState.ts";

const targetFor = (state: AdapterState, panelId: PanelId): HTMLElement => {
  const existing = MutableHashMap.get(state.targets, panelId);
  if (O.isSome(existing)) return existing.value;
  const target = document.createElement("div");
  target.dataset.panelTarget = panelId;
  MutableHashMap.set(state.targets, panelId, target);
  return target;
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
      O.match(R.get(props.components, renderer), {
        onNone: () => <div role="alert">Missing renderer: {renderer}</div>,
        onSome: (Renderer) => <Renderer params={input} api={{ id: panel.id }} containerApi={state.api} />,
      }),
  });
};

export const PanelPortal = (props: {
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

export const ContentHost = (props: {
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
