import { Effect } from "effect";
import * as P from "effect/Predicate";
import { createRoot } from "react-dom/client";
import {
  ComponentPanelView,
  FloatingMember,
  GroupId,
  HorizontalSplitLayout,
  makeDockAtoms,
  Panel,
  PanelId,
  PopulatedWorkspace,
  RendererKey,
  SplitId,
  SplitNode,
  SplitRatio,
  TabChrome,
  TabsNode,
  TextPanelView,
  TopLeftAnchoredBox,
  VerticalSplitLayout,
} from "../../dockview/poc/index.ts";
import {
  type DockAtomGraph,
  type DockPanelProps,
  type DockRenderer,
  DockviewReact,
} from "../../dockview-react/src/index.ts";
import "./demo.css";

const textPanel = (id: string, title: string, body: string): Panel =>
  Panel.make({ id: PanelId.make(id), title, view: TextPanelView.make({ text: body }) });

const NotesPanel = (props: DockPanelProps) => (
  <article className="demo-notes">
    <h2>Measured minima, live</h2>
    <p>
      This group's tab titles are measured through <code>@beep/pretext</code> live capture (16px Arial). Drag the sash
      to the right of this group toward it: the group stops shrinking at the sum of its measured tab titles plus chrome
      — the no-truncation floor.
    </p>
    <p>
      Everything else is the plain adapter: drag tabs between groups, drop on edges to split, Float / Maximize from the
      strip, drag the floating pane by its header, Escape cancels any gesture.
    </p>
    <p className="demo-notes-meta">panel {props.api.id}</p>
  </article>
);

const components: Readonly<Record<string, DockRenderer>> = { notes: NotesPanel };

const workspace = PopulatedWorkspace.make({
  root: SplitNode.make({
    splitId: SplitId.make("demo-root"),
    layout: HorizontalSplitLayout.make({
      leftRatio: SplitRatio.make(3_000),
      left: TabsNode.make({
        groupId: GroupId.make("demo-editor"),
        active: Panel.make({
          id: PanelId.make("demo-notes"),
          title: "The dragon slithers through moonlit caverns",
          view: ComponentPanelView.make({ renderer: RendererKey.make("notes") }),
        }),
        after: [textPanel("demo-brief", "Brief", "A second tab, so the strip has real width to defend.")],
      }),
      right: SplitNode.make({
        splitId: SplitId.make("demo-side"),
        layout: VerticalSplitLayout.make({
          topRatio: SplitRatio.make(6_000),
          top: TabsNode.make({
            groupId: GroupId.make("demo-outline"),
            active: textPanel("demo-outline-panel", "Outline", "Docked neighbor. Squeeze the editor against me."),
            after: [textPanel("demo-log", "Log", "Reorder me, or drop me on an edge to split.")],
          }),
          bottom: TabsNode.make({
            groupId: GroupId.make("demo-terminal"),
            active: textPanel("demo-terminal-panel", "Terminal", "Bottom pane of the vertical split."),
          }),
        }),
      }),
    }),
  }),
  floating: [
    FloatingMember.make({
      anchoredBox: TopLeftAnchoredBox.make({ left: 140, top: 120, width: 340, height: 240 }),
      root: TabsNode.make({
        groupId: GroupId.make("demo-float"),
        active: textPanel("demo-float-panel", "Scratch", "Floating pane: drag my header, resize my corner, Dock me."),
      }),
    }),
  ],
});

const App = ({ graph }: { readonly graph: DockAtomGraph }) => (
  <main className="demo-shell">
    <header className="demo-header">
      <h1>Dockview — computable workspace geometry</h1>
      <p>
        Kernel geometry is pure schema math; group width floors come from real text measurement via{" "}
        <code>options.titleMinima</code>.
      </p>
    </header>
    <section className="demo-stage">
      <DockviewReact
        graph={graph}
        components={components}
        options={{
          gap: 8,
          titleMinima: {
            font: "16px Arial",
            lineHeight: 20,
            chrome: TabChrome.make({ perTab: 48, strip: 8 }),
          },
        }}
      />
    </section>
  </main>
);

const boot = Effect.gen(function* () {
  const graph = yield* makeDockAtoms(workspace);
  const host = document.getElementById("root");
  if (P.isNull(host)) return yield* Effect.die(new Error("Missing #root mount node"));
  createRoot(host).render(<App graph={graph} />);
});

void Effect.runPromise(boot);
