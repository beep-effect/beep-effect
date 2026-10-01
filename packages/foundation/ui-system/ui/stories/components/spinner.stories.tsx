import { Spinner } from "@beep/ui/components/spinner";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Spinner` is a lightweight loading indicator built on the Phosphor `SpinnerGapIcon`. It
 * spins continuously via the `animate-spin` utility and exposes itself to assistive tech with
 * `role="status"` and an "Loading" accessible name. Size it with `size` (or width/height
 * classes through `className`), tune stroke emphasis with `weight`, and recolor it with
 * `color` or a text-color class — it inherits `currentColor` by default, so it adapts to the
 * surrounding text color when dropped inside buttons or labels.
 *
 * Imported from `@beep/ui/components/spinner`.
 */
const meta = {
  title: "Components/Feedback/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "number",
      description: "Diameter in pixels (overrides the default `size-4` class).",
    },
    weight: {
      control: "select",
      options: ["thin", "light", "regular", "bold", "fill", "duotone"],
      description: "Stroke weight of the icon glyph.",
      table: { defaultValue: { summary: "regular" } },
    },
    color: {
      control: "color",
      description: "Stroke color of the icon. Defaults to `currentColor`.",
    },
    mirrored: {
      control: "boolean",
      description: "Horizontally flips the icon glyph.",
    },
    className: {
      control: "text",
      description: "Tailwind classes layered on top of `size-4 animate-spin` (sizing, color).",
      table: { defaultValue: { summary: "size-4 animate-spin" } },
    },
  },
  args: {},
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default spinner: a 1rem icon that spins and announces itself as "Loading". */
export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const spinner = canvas.getByRole("status", { name: "Loading" });
    expect(spinner).toBeVisible();
    expect(spinner).toHaveClass("animate-spin");
    return Promise.resolve();
  },
};

/** A small spinner suited to dense inline contexts. */
export const Small: Story = {
  args: { className: "size-3 animate-spin" },
};

/** A large spinner for prominent, full-section loading states. */
export const Large: Story = {
  args: { className: "size-8 animate-spin" },
};

/** A heavier stroke weight for higher contrast at small sizes. */
export const Bold: Story = {
  args: { weight: "bold", className: "size-6 animate-spin" },
};

/** Tinted via a text-color class so the spinner matches an accent color. */
export const Colored: Story = {
  args: { className: "size-6 animate-spin text-primary" },
};

/** A row of spinners at increasing sizes to compare scale. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="size-3" />
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
    </div>
  ),
};

/** Paired with text to form a complete inline loading message. */
export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2 text-muted-foreground text-sm">
      <Spinner />
      <span>Loading…</span>
    </div>
  ),
};

/** Inside a pending button, where the spinner inherits the button's text color. */
export const InButton: Story = {
  render: () => (
    <button
      type="button"
      disabled
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm disabled:opacity-70"
    >
      <Spinner />
      Saving…
    </button>
  ),
};
