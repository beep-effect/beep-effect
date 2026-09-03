import {
  ComponentPanelView,
  FloatingMember,
  GroupId,
  HorizontalSplitLayout,
  makeDockAtoms,
  Panel,
  PanelConstraints,
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
import { Duration, Effect } from "effect";
import * as O from "effect/Option";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { DockAtomGraph, DockPanelProps, DockRenderer, DockTabProps } from "@beep/dock-react";
import "./dock.stories.css";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type React from "react";

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

// Pin the story host to fixed dimensions so play geometry never depends on
// the test viewport; throws when the story markup is missing its host.
const pinHost = (canvasElement: HTMLElement, width: string, height?: string): HTMLElement => {
  const host = canvasElement.querySelector<HTMLElement>(".dock-story");
  if (host === null) throw new Error("Missing dock story host");
  host.style.width = width;
  if (height !== undefined) host.style.height = height;
  return host;
};

const openOverflowMenu = (trigger: HTMLElement): Effect.Effect<void> =>
  trigger.getAttribute("aria-expanded") === "true" ? Effect.void : Effect.promise(() => userEvent.click(trigger));

// Query a live handle at execution time (not construction time) so retried
// attempts never reuse a node a strip re-measure has detached.
const queried = (find: () => HTMLElement | null, missing: string): Effect.Effect<HTMLElement, string> =>
  Effect.suspend(() => O.fromNullOr(find()).pipe(Effect.fromOption(() => missing)));

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

const maximizedWorkspace = PopulatedWorkspace.make({
  root: SplitNode.make({
    splitId: SplitId.make("story-max-root"),
    layout: HorizontalSplitLayout.make({
      leftRatio: SplitRatio.make(5_000),
      left: TabsNode.make({
        groupId: GroupId.make("story-max-main"),
        active: textPanel("story-max-panel", "Focus", "This group is maximized; the neighbor is parked until Restore."),
      }),
      right: TabsNode.make({
        groupId: GroupId.make("story-max-side"),
        active: textPanel("story-max-side-panel", "Parked", "Hidden while the neighbor holds the maximize."),
      }),
    }),
  }),
  maximized: O.some(GroupId.make("story-max-main")),
});

const tabsWorkspace = PopulatedWorkspace.make({
  root: TabsNode.make({
    groupId: GroupId.make("story-tabs"),
    active: textPanel("story-tab-alpha", "Alpha", "Custom chrome renders every tab in this strip."),
    after: [
      textPanel("story-tab-beta", "Beta", "Second tab under custom chrome."),
      textPanel("story-tab-gamma", "Gamma", "Third tab under custom chrome."),
    ],
  }),
});

const constrainedWorkspace = PopulatedWorkspace.make({
  root: SplitNode.make({
    splitId: SplitId.make("story-constrained-split"),
    layout: HorizontalSplitLayout.make({
      left: TabsNode.make({
        groupId: GroupId.make("story-constrained"),
        active: Panel.make({
          id: PanelId.make("story-constrained-panel"),
          title: "Constrained",
          view: TextPanelView.make({ text: "This panel cannot shrink below 300 pixels." }),
          constraints: O.some(PanelConstraints.make({ minWidth: O.some(300) })),
        }),
      }),
      right: TabsNode.make({
        groupId: GroupId.make("story-constrained-neighbor"),
        active: textPanel("story-constrained-neighbor-panel", "Neighbor", "Drag the sash toward the constraint."),
      }),
    }),
  }),
});

const overflowWorkspace = PopulatedWorkspace.make({
  root: TabsNode.make({
    groupId: GroupId.make("story-overflow"),
    active: textPanel("story-overflow-alpha", "Overflow Alpha", "Active tabs remain visible."),
    after: [
      textPanel("story-overflow-beta", "Overflow Beta", "Measured overflow entry."),
      textPanel("story-overflow-gamma", "Overflow Gamma", "Measured overflow entry."),
      textPanel("story-overflow-delta", "Overflow Delta", "Activate me from the dropdown."),
    ],
  }),
});

const quadrantWorkspace = PopulatedWorkspace.make({
  root: SplitNode.make({
    splitId: SplitId.make("story-quadrant-split"),
    layout: HorizontalSplitLayout.make({
      left: TabsNode.make({
        groupId: GroupId.make("story-quadrant-source"),
        active: textPanel("story-quadrant-source-panel", "Drag Source", "Drag over every target quadrant."),
      }),
      right: TabsNode.make({
        groupId: GroupId.make("story-quadrant-target"),
        active: textPanel("story-quadrant-target-panel", "Drop Target", "Four directional preview zones."),
      }),
    }),
  }),
});

const graphs = {
  workspace: Effect.runSync(makeDockAtoms(workspace)),
  empty: Effect.runSync(makeDockAtoms()),
  maximized: Effect.runSync(makeDockAtoms(maximizedWorkspace)),
  tabs: Effect.runSync(makeDockAtoms(tabsWorkspace)),
  constrained: Effect.runSync(makeDockAtoms(constrainedWorkspace)),
  overflow: Effect.runSync(makeDockAtoms(overflowWorkspace)),
  quadrants: Effect.runSync(makeDockAtoms(quadrantWorkspace)),
};

const StoryWatermark = () => (
  <div className="dock-story-notes">
    <h2>Empty workspace</h2>
    <p>No groups are docked. Hosts supply this watermark via `watermarkComponent`.</p>
  </div>
);

const ChipTab = (props: DockTabProps) => (
  <span data-testid={`chip-${props.api.id}`}>
    ◈ {props.title} <em>#{props.api.id}</em>
  </span>
);

const DockStory = (props: {
  readonly graph: DockAtomGraph;
  readonly watermark?: React.FunctionComponent | undefined;
  readonly tab?: React.FunctionComponent<DockTabProps> | undefined;
}) => (
  <div className="dock-story">
    <DockviewReact
      graph={props.graph}
      components={components}
      watermarkComponent={props.watermark}
      defaultTabComponent={props.tab}
      options={{ gap: 8 }}
    />
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
  args: { graph: graphs.workspace },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void expect(canvas.getByText("Notes")).toBeVisible();
    void expect(canvas.getByText("Outline")).toBeVisible();
    void expect(canvas.getByText("Terminal")).toBeVisible();
    // "Scratch" appears twice by design — floating header chrome plus the tab —
    // so text queries are ambiguous. Assert each surface through its own
    // handle; the tab's accessible name also concatenates its close button's
    // label, hence the regex.
    void expect(canvas.getByRole("tab", { name: /Scratch/ })).toBeVisible();
    void expect(canvasElement.querySelector("[data-floating-title]")).toHaveTextContent("Scratch");
  },
};

/** Empty workspace rendering the host-supplied watermark component. */
export const EmptyWatermark: Story = {
  args: { graph: graphs.empty, watermark: StoryWatermark },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void expect(canvas.getByText("Empty workspace")).toBeVisible();
  },
};

/** One group holds the maximize; its docked neighbor is parked out of the projection. */
export const MaximizedGroup: Story = {
  args: { graph: graphs.maximized },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void expect(canvas.getByText("Focus")).toBeVisible();
    void expect(canvas.queryByText("Parked")).toBeNull();
  },
};

/** Every tab in the strip renders through the host's `defaultTabComponent`. */
export const CustomTabs: Story = {
  args: { graph: graphs.tabs, tab: ChipTab },
  play: ({ canvasElement }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const canvas = within(canvasElement);
        // This story is about custom tab renderers, not overflow: pin a host
        // wide enough for all three chips at any test viewport, then await
        // the (measurement-driven) strip settling with everything visible.
        pinHost(canvasElement, "960px");
        yield* Effect.promise(() =>
          waitFor(() => {
            expect(canvas.getByTestId("chip-story-tab-alpha")).toBeVisible();
            expect(canvas.getByTestId("chip-story-tab-beta")).toBeVisible();
            expect(canvas.getByTestId("chip-story-tab-gamma")).toBeVisible();
          })
        );
      })
    ),
};

/** A sash gesture cannot violate a panel's kernel minimum width. */
export const ConstrainedSash: Story = {
  args: { graph: graphs.constrained },
  play: ({ canvasElement }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const canvas = within(canvasElement);
        const sash = canvasElement.querySelector<HTMLElement>("[data-sash-id='story-constrained-split']");
        const panel = canvasElement.querySelector<HTMLElement>("[data-group-id='story-constrained']");
        if (sash === null || panel === null) {
          throw new Error("Missing constrained sash story geometry");
        }
        // Pin the host and wait out the same measurement race as
        // DropQuadrants, then read the sash position at gesture time — a
        // cached box can drift from a mid-play re-measure.
        pinHost(canvasElement, "960px", "640px");
        yield* Effect.promise(() => waitFor(() => expect(panel.getBoundingClientRect().width).toBeGreaterThan(100)));
        const sashBox = (): DOMRect => sash.getBoundingClientRect();
        yield* Effect.promise(() =>
          userEvent.pointer([
            { keys: "[MouseLeft>]", target: sash, coords: { clientX: sashBox().left, clientY: sashBox().top } },
            { target: sash, coords: { clientX: 0, clientY: sashBox().top } },
            { keys: "[/MouseLeft]", target: sash, coords: { clientX: 0, clientY: sashBox().top } },
          ])
        );
        yield* Effect.promise(() =>
          waitFor(() => expect(panel.getBoundingClientRect().width).toBeGreaterThanOrEqual(300))
        );
        expect(canvas.getByText("Constrained")).toBeVisible();
      })
    ),
};

/** Narrowing a measured strip exposes overflow and can activate a hidden tab. */
export const TabOverflow: Story = {
  args: { graph: graphs.overflow },
  play: ({ canvasElement }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const canvas = within(canvasElement);
        pinHost(canvasElement, "320px");
        yield* Effect.promise(() => canvas.findByRole("button", { name: /overflowed tabs/ }));
        // The pinned strip keeps re-measuring after the trigger first
        // appears, and each measure pass can re-mount it — so a handle
        // captured once goes stale and its clicks dispatch into a detached
        // node (CI's full chromium re-measures later than the local headless
        // shell, which is why only CI saw the menu never open). Every attempt
        // therefore re-queries both the trigger and the menu item fresh.
        const deltaActive = (): boolean =>
          canvasElement.querySelector("[data-panel-id='story-overflow-delta']")?.getAttribute("data-active") === "true";
        const activateOverflowDelta = Effect.gen(function* () {
          if (deltaActive()) return;
          const trigger = yield* queried(
            () => canvas.queryByRole("button", { name: /overflowed tabs/ }),
            "overflow trigger not mounted"
          );
          yield* openOverflowMenu(trigger);
          // The open flag is registry-backed, so the menu mounts on the next
          // render rather than inside the trigger's click turn. Give that
          // render a frame, then query a fresh item handle for this attempt.
          yield* Effect.sleep(Duration.millis(100));
          const item = yield* queried(
            () => canvas.queryByRole("menuitem", { name: "Overflow Delta" }),
            "Overflow Delta menu item did not mount"
          );
          yield* Effect.promise(() => userEvent.click(item));
          yield* Effect.sleep(Duration.millis(50));
          if (!deltaActive()) {
            return yield* Effect.fail("Overflow Delta did not activate");
          }
        });
        yield* activateOverflowDelta.pipe(Effect.retry({ times: 14 }));
      })
    ),
};

/** Each group quarter previews the exact half-box compiled for that split. */
export const DropQuadrants: Story = {
  args: { graph: graphs.quadrants },
  play: ({ canvasElement }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const source = canvasElement.querySelector<HTMLElement>("[data-panel-id='story-quadrant-source-panel']");
        const target = canvasElement.querySelector<HTMLElement>("[data-group-id='story-quadrant-target']");
        if (source === null || target === null) throw new Error("Missing quadrant story geometry");
        // Pin the host so the quadrant math never depends on the test
        // viewport, then wait out the ResizeObserver measurement race.
        pinHost(canvasElement, "960px", "640px");
        yield* Effect.promise(() => waitFor(() => expect(target.getBoundingClientRect().width).toBeGreaterThan(100)));
        // Never cache boxes: a mid-play re-measure (viewport settle, strip
        // measurement) moves the live geometry away from any snapshot, so
        // expected and actual must derive from the same read.
        const targetBox = (): DOMRect => target.getBoundingClientRect();
        const preview = (): DOMRect => {
          const indicator = canvasElement.querySelector<HTMLElement>("[data-drop-indicator]");
          if (indicator === null) throw new Error("Missing compiled drop preview");
          return indicator.getBoundingClientRect();
        };
        yield* Effect.promise(() =>
          userEvent.pointer({
            keys: "[MouseLeft>]",
            target: source,
            coords: { clientX: source.getBoundingClientRect().left, clientY: source.getBoundingClientRect().top },
          })
        );
        yield* Effect.promise(() =>
          userEvent.pointer({
            target: source,
            coords: { clientX: targetBox().left + 2, clientY: targetBox().top + targetBox().height / 2 },
          })
        );
        yield* Effect.promise(() =>
          waitFor(() => {
            const box = targetBox();
            expect(preview().width).toBeCloseTo(box.width / 2, 0);
            expect(preview().left).toBeCloseTo(box.left, 0);
          })
        );
        yield* Effect.promise(() =>
          userEvent.pointer({
            target: source,
            coords: { clientX: targetBox().right - 34, clientY: targetBox().top + targetBox().height / 2 },
          })
        );
        yield* Effect.promise(() => waitFor(() => expect(preview().right).toBeCloseTo(targetBox().right, 0)));
        yield* Effect.promise(() =>
          userEvent.pointer({
            target: source,
            coords: { clientX: targetBox().left + targetBox().width / 2, clientY: targetBox().top + 34 },
          })
        );
        yield* Effect.promise(() =>
          waitFor(() => {
            const box = targetBox();
            expect(preview().height).toBeCloseTo(box.height / 2, 0);
            expect(preview().top).toBeCloseTo(box.top, 0);
          })
        );
        yield* Effect.promise(() =>
          userEvent.pointer({
            target: source,
            coords: { clientX: targetBox().left + targetBox().width / 2, clientY: targetBox().bottom - 34 },
          })
        );
        yield* Effect.promise(() => waitFor(() => expect(preview().bottom).toBeCloseTo(targetBox().bottom, 0)));
        yield* Effect.promise(() =>
          userEvent.pointer({
            keys: "[/MouseLeft]",
            target: source,
            coords: { clientX: targetBox().left + targetBox().width / 2, clientY: targetBox().bottom - 34 },
          })
        );
      })
    ),
};
