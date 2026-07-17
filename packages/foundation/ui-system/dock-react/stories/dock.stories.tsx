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
  TabsNode,
  TextPanelView,
  TopLeftAnchoredBox,
  VerticalSplitLayout,
} from "@beep/dock";
import { DockviewReact } from "@beep/dock-react";
import { Effect } from "effect";
import { expect, within } from "storybook/test";
import type { DockPanelProps, DockRenderer } from "@beep/dock-react";
import "./dock.stories.css";
import type { Meta, StoryObj } from "@storybook/react-vite";

const textPanel = (id: string, title: string, body: string): Panel =>
  Panel.make({ id: PanelId.make(id), title, view: TextPanelView.make({ text: body }) });

const NotesPanel = (props: DockPanelProps) => (
  <article className="dock-story-notes">
    <h2>Schema-first dock workspace</h2>
    <p>
      Drag tabs between groups, drop on edges to split, Float / Maximize from the strip, drag the floating pane by its
      header, resize with the sashes — Escape cancels any gesture. Every layout mutation is a kernel command; the DOM is
      a projection of the workspace schema.
    </p>
    <p className="dock-story-notes-meta">panel {props.api.id}</p>
  </article>
);

const components: Readonly<Record<string, DockRenderer>> = { notes: NotesPanel };

const workspace = PopulatedWorkspace.make({
  root: SplitNode.make({
    splitId: SplitId.make("story-root"),
    layout: HorizontalSplitLayout.make({
      leftRatio: SplitRatio.make(3_000),
      left: TabsNode.make({
        groupId: GroupId.make("story-editor"),
        active: Panel.make({
          id: PanelId.make("story-notes"),
          title: "Notes",
          view: ComponentPanelView.make({ renderer: RendererKey.make("notes") }),
        }),
        after: [textPanel("story-brief", "Brief", "A second tab, so the strip has real width to defend.")],
      }),
      right: SplitNode.make({
        splitId: SplitId.make("story-side"),
        layout: VerticalSplitLayout.make({
          topRatio: SplitRatio.make(6_000),
          top: TabsNode.make({
            groupId: GroupId.make("story-outline"),
            active: textPanel("story-outline-panel", "Outline", "Docked neighbor. Squeeze the editor against me."),
            after: [textPanel("story-log", "Log", "Reorder me, or drop me on an edge to split.")],
          }),
          bottom: TabsNode.make({
            groupId: GroupId.make("story-terminal"),
            active: textPanel("story-terminal-panel", "Terminal", "Bottom pane of the vertical split."),
          }),
        }),
      }),
    }),
  }),
  floating: [
    FloatingMember.make({
      anchoredBox: TopLeftAnchoredBox.make({ left: 120, top: 100, width: 320, height: 220 }),
      root: TabsNode.make({
        groupId: GroupId.make("story-float"),
        active: textPanel("story-float-panel", "Scratch", "Floating pane: drag my header, resize my corner, Dock me."),
      }),
    }),
  ],
});

const graph = Effect.runSync(makeDockAtoms(workspace));

const DockStory = () => (
  <div className="dock-story">
    <DockviewReact graph={graph} components={components} options={{ gap: 8 }} />
  </div>
);

const meta = {
  title: "Dock/DockviewReact",
  component: DockStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Hook-free React adapter over the `@beep/dock` kernel: the workspace tree is a schema value, every gesture compiles to a kernel command, and the DOM (groups, tabs, sashes, floating panes) is a pure projection of the resulting geometry. Capture-free composition — no `titleMinima` measurement wired.",
      },
    },
  },
} satisfies Meta<typeof DockStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Docked splits plus one floating pane — the full topology in one frame. */
export const Workspace: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void expect(canvas.getByText("Notes")).toBeVisible();
    void expect(canvas.getByText("Outline")).toBeVisible();
    void expect(canvas.getByText("Terminal")).toBeVisible();
    void expect(canvas.getByText("Scratch")).toBeVisible();
  },
};
