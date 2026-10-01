import { Skeleton } from "@beep/ui/components/skeleton";
import { expect } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Skeleton` is a lightweight placeholder used while content loads. It renders a single
 * `div` with a muted background, rounded corners, and a pulse animation, so you size and
 * shape it entirely through `className` (width, height, radius). Compose several skeletons
 * to mirror the layout of the content they stand in for, such as cards, list rows, or text.
 *
 * Imported from `@beep/ui/components/skeleton`.
 */
const meta = {
  title: "Components/Feedback/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description: "Tailwind classes that size and shape the placeholder (width, height, radius).",
      table: { defaultValue: { summary: "bg-muted rounded-md animate-pulse" } },
    },
  },
  args: {
    className: "h-4 w-48",
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default placeholder: a single rounded, pulsing bar sized via `className`. */
export const Default: Story = {
  play: ({ canvasElement }) => {
    const skeleton = canvasElement.querySelector('[data-slot="skeleton"]');
    expect(skeleton).toBeVisible();
    expect(skeleton).toHaveClass("animate-pulse");
    return Promise.resolve();
  },
};

/** A small circular placeholder standing in for an avatar or icon. */
export const Circle: Story = {
  args: { className: "size-12 rounded-full" },
};

/** A tall, wide block standing in for an image, thumbnail, or media tile. */
export const Block: Story = {
  args: { className: "h-32 w-full max-w-sm" },
};

/** Stacked bars of varying widths that mimic a paragraph of loading text. */
export const TextLines: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  ),
};

/** A circular avatar paired with two lines of text, a common list-row placeholder. */
export const AvatarWithText: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Skeleton shape="circle" className="size-12" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  ),
};

/** A realistic loading card: a media block above a title and two body lines. */
export const Card: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-4 rounded-xl border p-4">
      <Skeleton className="h-40 w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  ),
};
