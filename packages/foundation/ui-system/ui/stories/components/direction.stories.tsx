import { DirectionProvider, useDirection } from "@beep/ui/components/direction";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const DirectionPreview = () => {
  const direction = useDirection();
  return (
    <div dir={direction} className="flex w-64 items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span className="font-medium">Start</span>
      <span data-testid="active-direction" className="text-muted-foreground uppercase">
        {direction}
      </span>
    </div>
  );
};

/**
 * `DirectionProvider` enables RTL (right-to-left) behavior for Base UI components by
 * publishing the active text direction through context. Wrap a subtree in it and set
 * `direction` to `"ltr"` or `"rtl"`; descendants read the value with the `useDirection`
 * hook. The provider renders no DOM of its own — it only supplies context.
 *
 * Imported from `@beep/ui/components/direction`.
 */
const meta = {
  title: "Components/Utility/DirectionProvider",
  component: DirectionProvider,
  tags: ["autodocs"],
  argTypes: {
    direction: {
      control: "inline-radio",
      options: ["ltr", "rtl"],
      description: "The reading direction supplied to descendants via context.",
      table: { defaultValue: { summary: "ltr" } },
    },
    children: {
      control: false,
      description: "Subtree that consumes the direction context.",
    },
  },
  args: {
    direction: "ltr",
    children: <DirectionPreview />,
  },
} satisfies Meta<typeof DirectionProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default left-to-right direction; `useDirection` resolves to `"ltr"`. */
export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const active = canvas.getByTestId("active-direction");
    expect(active).toHaveTextContent("ltr");
    return Promise.resolve();
  },
};

/** Right-to-left direction; descendants read `"rtl"` and the layout mirrors. */
export const RightToLeft: Story = {
  args: { direction: "rtl" },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const active = canvas.getByTestId("active-direction");
    expect(active).toHaveTextContent("rtl");
    return Promise.resolve();
  },
};
