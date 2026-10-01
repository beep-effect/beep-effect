import { ScrollArea, ScrollBar } from "@beep/ui/components/scroll-area";
import { A } from "@beep/utils";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const tags = A.makeBy(50, (index) => `v1.2.0-beta.${index + 1}`);

const artworks = A.makeBy(12, (index) => ({
  id: index + 1,
  artist: `Artist ${index + 1}`,
}));

/**
 * `ScrollArea` wraps overflowing content in a styled, cross-browser scroll container built on
 * Base UI's accessible scroll-area primitive. It renders a `relative` root with a focusable
 * viewport (the `scroll-area-viewport` slot) plus a custom themed `ScrollBar`, so native
 * scrollbars are replaced with consistent thin thumbs. Constrain the root with a fixed height
 * or width (for example `h-72` or `w-96`) and the viewport scrolls its children automatically.
 * Pair it with a horizontal `ScrollBar` for content that overflows on the x-axis.
 *
 * Imported from `@beep/ui/components/scroll-area`.
 */
const meta = {
  title: "Components/Layout/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description: "Classes merged onto the `relative` root; set a fixed height/width to enable scrolling.",
    },
    overflowEdgeThreshold: {
      control: { type: "number", min: 0, step: 1 },
      description: "Pixels of overflow that must be passed before edge data attributes are applied.",
      table: { defaultValue: { summary: "0" } },
    },
    children: {
      control: false,
      description: "Content rendered inside the scrollable viewport.",
    },
  },
  args: {
    className: "h-72 w-64 rounded-md border",
  },
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default vertical scroll area: a fixed-height bordered box scrolling a tall list of tags. */
export const Default: Story = {
  render: (args) => (
    <ScrollArea {...args}>
      <div className="p-4">
        <h4 className="mb-4 font-medium text-sm leading-none">Tags</h4>
        {A.map(tags, (tag) => (
          <div key={tag} className="border-border border-b py-2 text-sm last:border-b-0">
            {tag}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Tags")).toBeVisible();
    expect(canvas.getByText("v1.2.0-beta.1")).toBeVisible();
    return Promise.resolve();
  },
};

/** Vertical scrolling over a structured list of records inside a roomier viewport. */
export const VerticalList: Story = {
  args: { className: "h-72 w-80 rounded-md border" },
  render: (args) => (
    <ScrollArea {...args}>
      <div className="p-4">
        <h4 className="mb-4 font-medium text-sm leading-none">Recent artists</h4>
        {A.map(artworks, (artwork) => (
          <div key={artwork.id} className="border-border flex items-center gap-3 border-b py-3 last:border-b-0">
            <div className="bg-muted size-9 rounded-full" />
            <div className="text-sm">{artwork.artist}</div>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

/** A horizontal scroll area: a wide row of cards with an explicit horizontal `ScrollBar`. */
export const Horizontal: Story = {
  args: { className: "w-96 whitespace-nowrap rounded-md border" },
  render: (args) => (
    <ScrollArea {...args}>
      <div className="flex w-max gap-4 p-4">
        {A.map(artworks, (artwork) => (
          <figure key={artwork.id} className="shrink-0">
            <div className="bg-muted h-32 w-40 overflow-hidden rounded-md" />
            <figcaption className="text-muted-foreground pt-2 text-xs">{artwork.artist}</figcaption>
          </figure>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
};

/** Content that overflows on both axes, combining vertical and horizontal `ScrollBar`s. */
export const BothAxes: Story = {
  args: { className: "h-72 w-96 rounded-md border" },
  render: (args) => (
    <ScrollArea {...args}>
      <div className="w-160 p-4">
        <h4 className="mb-4 font-medium text-sm leading-none">Wide table</h4>
        {A.map(artworks, (artwork) => (
          <div key={artwork.id} className="border-border flex gap-6 border-b py-2 text-sm last:border-b-0">
            <span className="w-24 shrink-0">#{artwork.id}</span>
            <span className="w-64 shrink-0">{artwork.artist}</span>
            <span className="w-64 shrink-0 truncate">Acrylic on canvas, mixed media composition</span>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
};

/** Short content that fits the viewport, so no scrollbar thumb is needed. */
export const NoOverflow: Story = {
  args: { className: "h-72 w-64 rounded-md border" },
  render: (args) => (
    <ScrollArea {...args}>
      <div className="p-4 text-sm">
        <h4 className="mb-2 font-medium leading-none">Summary</h4>
        <p className="text-muted-foreground">This content fits within the viewport, so the scrollbar stays hidden.</p>
      </div>
    </ScrollArea>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Summary")).toBeVisible();
    return Promise.resolve();
  },
};
