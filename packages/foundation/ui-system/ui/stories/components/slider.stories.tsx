import { Slider } from "@beep/ui/components/slider";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Slider` wraps Base UI's accessible slider into a single component that renders the
 * track, the filled indicator, and one thumb per value. Provide `defaultValue` (or
 * `value` for a controlled slider) as a number for a single thumb or an array for a
 * range. Tune the scale with `min`, `max`, and `step`, and constrain range thumbs with
 * `minStepsBetweenValues`.
 *
 * Imported from `@beep/ui/components/slider`.
 */
const meta = {
  title: "Components/Forms/Slider",
  component: Slider,
  tags: ["autodocs"],
  argTypes: {
    defaultValue: {
      control: false,
      description: "Uncontrolled initial value; a number for a single thumb or an array for a range.",
    },
    value: {
      control: false,
      description: "Controlled value; pair with `onValueChange` to manage state externally.",
    },
    min: {
      control: "number",
      description: "Minimum allowed value and the origin for steps.",
      table: { defaultValue: { summary: "0" } },
    },
    max: {
      control: "number",
      description: "Maximum allowed value.",
      table: { defaultValue: { summary: "100" } },
    },
    step: {
      control: "number",
      description: "Granularity the slider snaps to when stepping through values.",
      table: { defaultValue: { summary: "1" } },
    },
    minStepsBetweenValues: {
      control: "number",
      description: "Minimum number of steps kept between thumbs on a range slider.",
      table: { defaultValue: { summary: "0" } },
    },
    orientation: {
      control: "inline-radio",
      options: ["horizontal", "vertical"],
      description: "Layout direction of the slider track.",
      table: { defaultValue: { summary: "horizontal" } },
    },
    disabled: {
      control: "boolean",
      description: "Disables interaction and dims the slider.",
      table: { defaultValue: { summary: "false" } },
    },
    onValueChange: {
      action: "valueChange",
      description: "Fires while the value changes via drag, keyboard, or track press.",
    },
    onValueCommitted: {
      action: "valueCommitted",
      description: "Fires once the value is committed on pointer release or keyboard input.",
    },
  },
  args: {
    defaultValue: 50,
    min: 0,
    max: 100,
    step: 1,
    orientation: "horizontal",
    disabled: false,
    onValueChange: fn(),
    onValueCommitted: fn(),
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default single-thumb slider. Pressing an arrow key moves the thumb and fires `onValueChange`. */
export const Default: Story = {
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const thumb = O.getOrThrow(A.head(canvas.getAllByRole("slider")));
    expect(thumb).toBeVisible();
    thumb.focus();
    return userEvent.keyboard("{ArrowRight}").then(() => {
      expect(args.onValueChange).toHaveBeenCalled();
    });
  },
};

/** A range slider rendered from an array `defaultValue`, producing one thumb per value. */
export const Range: Story = {
  args: { defaultValue: [25, 75] },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const thumbs = canvas.getAllByRole("slider");
    expect(thumbs.length).toBe(2);
    return Promise.resolve();
  },
};

/** Coarse steps make the slider snap to multiples of `step` from `min`. */
export const Stepped: Story = {
  args: { defaultValue: 40, step: 10 },
};

/** A custom scale using non-default `min` and `max` bounds. */
export const CustomRange: Story = {
  args: { defaultValue: 6, min: 0, max: 10, step: 1 },
};

/** A range slider that keeps a minimum gap between its two thumbs. */
export const MinDistance: Story = {
  args: { defaultValue: [30, 70], minStepsBetweenValues: 10 },
};

/** The vertical orientation, useful for compact level or volume controls. */
export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (renderArgs) => (
    <div className="h-48">
      <Slider {...renderArgs} />
    </div>
  ),
};

/** Disabled sliders are dimmed and ignore keyboard interaction. */
export const Disabled: Story = {
  args: { disabled: true },
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const thumb = O.getOrThrow(A.head(canvas.getAllByRole("slider")));
    thumb.focus();
    return userEvent.keyboard("{ArrowRight}").then(() => {
      expect(args.onValueChange).not.toHaveBeenCalled();
    });
  },
};
