// fallow-ignore-file code-duplication -- pre-existing story clones on main: the diff-attributed audit charges them to this change because its edited lines fall inside the clone ranges. Story variants repeat the canonical markup on purpose (the Storybook docs panel shows each story's source; shared render helpers would hide that usage). Review by 2026-12-31.
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@beep/ui/components/resizable";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `ResizablePanelGroup`, `ResizablePanel`, and `ResizableHandle` compose draggable split
 * layouts on top of `react-resizable-panels`. A `ResizablePanelGroup` lays out its child
 * `ResizablePanel`s along an `orientation` ("horizontal" or "vertical"), and each pair of
 * panels is separated by a `ResizableHandle` the user drags to reflow the layout. Panels
 * accept `defaultSize`, `minSize`, `maxSize`, and `collapsible`, and groups can nest for
 * grid-like editor and dashboard shells.
 *
 * Imported from `@beep/ui/components/resizable`.
 */
const meta = {
  title: "Components/Layout/ResizablePanelGroup",
  component: ResizablePanelGroup,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Axis along which the child panels are arranged and resized.",
      table: { defaultValue: { summary: "horizontal" } },
    },
    disabled: {
      control: "boolean",
      description: "Disables resize interaction for every panel and handle in the group.",
    },
    className: {
      control: "text",
      description: "Additional classes merged onto the group container.",
    },
    children: {
      control: false,
      description: "Composed `ResizablePanel` and `ResizableHandle` elements.",
    },
  },
  args: {
    orientation: "horizontal",
    className: "h-50 max-w-md rounded-lg border md:min-w-112.5",
  },
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A horizontal split of two equal panels. The drag handle exposes a `separator` role. */
export const Default: Story = {
  render: (args) => (
    <ResizablePanelGroup {...args}>
      <ResizablePanel defaultSize="50%">
        <div className="flex h-50 items-center justify-center p-6">
          <span className="font-semibold">One</span>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize="50%">
        <div className="flex h-50 items-center justify-center p-6">
          <span className="font-semibold">Two</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("One")).toBeVisible();
    expect(canvas.getByText("Two")).toBeVisible();
    const handle = canvas.getByRole("separator");
    expect(handle).toBeVisible();
    return userEvent.click(handle).then(() => {
      expect(canvas.getByText("Two")).toBeVisible();
    });
  },
};

/** A vertical split stacks panels top-to-bottom with a row-resize handle. */
export const Vertical: Story = {
  args: {
    orientation: "vertical",
    className: "max-w-md rounded-lg border md:min-w-112.5",
  },
  // react-resizable-panels forces an inline `height: 100%` on the group, so a height
  // class on the group is ignored; for a vertical split the height must come from a
  // sized parent or the flex-grow panels collapse to zero.
  render: (args) => (
    <div className="h-100">
      <ResizablePanelGroup {...args}>
        <ResizablePanel defaultSize="35%">
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold">Header</span>
          </div>
        </ResizablePanel>
        <ResizableHandle orientation="vertical" />
        <ResizablePanel defaultSize="65%">
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold">Body</span>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};

/** Adds the centered grip affordance to the handle via `withHandle`. */
export const WithHandle: Story = {
  render: (args) => (
    <ResizablePanelGroup {...args}>
      <ResizablePanel defaultSize="50%">
        <div className="flex h-50 items-center justify-center p-6">
          <span className="font-semibold">Sidebar</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="50%">
        <div className="flex h-50 items-center justify-center p-6">
          <span className="font-semibold">Content</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

/** Panels can declare `minSize`/`maxSize` to clamp how far a handle drag can reflow them. */
export const MinMaxSizes: Story = {
  render: (args) => (
    <ResizablePanelGroup {...args}>
      <ResizablePanel defaultSize="30%" minSize="20%" maxSize="40%">
        <div className="flex h-50 items-center justify-center p-6">
          <span className="font-semibold">Nav (20-40%)</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="70%">
        <div className="flex h-50 items-center justify-center p-6">
          <span className="font-semibold">Main</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

/** A collapsible panel snaps shut once dragged below its `minSize`. */
export const Collapsible: Story = {
  render: (args) => (
    <ResizablePanelGroup {...args}>
      <ResizablePanel collapsible defaultSize="25%" minSize="15%" collapsedSize="0%">
        <div className="flex h-50 items-center justify-center p-6">
          <span className="font-semibold">Files</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="75%">
        <div className="flex h-50 items-center justify-center p-6">
          <span className="font-semibold">Editor</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

/** Nesting a vertical group inside a horizontal panel builds a three-pane editor shell. */
export const NestedGroups: Story = {
  args: {
    className: "h-65 max-w-md rounded-lg border md:min-w-112.5",
  },
  render: (args) => (
    <ResizablePanelGroup {...args}>
      <ResizablePanel defaultSize="50%">
        <div className="flex h-65 items-center justify-center p-6">
          <span className="font-semibold">One</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="50%">
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize="25%">
            <div className="flex h-full items-center justify-center p-6">
              <span className="font-semibold">Two</span>
            </div>
          </ResizablePanel>
          <ResizableHandle orientation="vertical" withHandle />
          <ResizablePanel defaultSize="75%">
            <div className="flex h-full items-center justify-center p-6">
              <span className="font-semibold">Three</span>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("One")).toBeVisible();
    expect(canvas.getByText("Two")).toBeVisible();
    expect(canvas.getByText("Three")).toBeVisible();
    return Promise.resolve();
  },
};

/** Disabling the group freezes the layout; handles no longer respond to drags. */
export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <ResizablePanelGroup {...args}>
      <ResizablePanel defaultSize="50%">
        <div className="flex h-50 items-center justify-center p-6">
          <span className="font-semibold">Left</span>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="50%">
        <div className="flex h-50 items-center justify-center p-6">
          <span className="font-semibold">Right</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};
