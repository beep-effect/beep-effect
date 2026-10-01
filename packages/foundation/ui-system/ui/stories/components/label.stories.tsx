import { Label } from "@beep/ui/components/label";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Label` is a thin styling wrapper over the native `<label>` element. It applies
 * consistent typography (`text-sm`, `font-medium`, `leading-none`) and automatically
 * dims and disables itself when a peer or grouped control is disabled via
 * `peer-disabled` and `group-data-[disabled=true]` styles. Associate it with a form
 * control through `htmlFor` so clicking the label focuses the control.
 *
 * Imported from `@beep/ui/components/label`.
 */
const meta = {
  title: "Components/Forms/Label",
  component: Label,
  tags: ["autodocs"],
  argTypes: {
    htmlFor: {
      control: "text",
      description: "Associates the label with a form control by the control's `id`.",
    },
    children: {
      control: "text",
      description: "Label text or content.",
    },
    className: {
      control: "text",
      description: "Additional Tailwind classes merged onto the label.",
    },
  },
  args: {
    children: "Email address",
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default label, rendering its text with the standard form typography. */
export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText("Email address");
    expect(label).toBeVisible();
  },
};

/**
 * A label associated with an input via `htmlFor`. Clicking the label focuses the
 * linked control, demonstrating native label-to-control association.
 */
export const WithControl: Story = {
  args: { htmlFor: "email" },
  render: (args) => (
    <div className="grid gap-2">
      <Label {...args} />
      <input id="email" type="email" placeholder="you@example.com" className="h-9 rounded-md border px-3 text-sm" />
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText("Email address");
    const input = canvas.getByPlaceholderText("you@example.com");
    expect(label).toBeVisible();
    expect(input).not.toHaveFocus();
    return userEvent.click(label).then(() => {
      expect(input).toHaveFocus();
    });
  },
};

/**
 * A label paired with a checkbox. The flex layout aligns the control and text, and
 * clicking the label toggles the checkbox.
 */
export const WithCheckbox: Story = {
  args: { htmlFor: "terms", children: "Accept terms and conditions" },
  render: (args) => (
    <Label {...args}>
      <input id="terms" type="checkbox" className="size-4" />
      {args.children}
    </Label>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    return userEvent.click(canvas.getByText("Accept terms and conditions")).then(() => {
      expect(checkbox).toBeChecked();
    });
  },
};

/**
 * When the associated control is a disabled peer, the label dims via `peer-disabled`
 * styling to communicate the inactive state.
 */
export const DisabledPeer: Story = {
  args: { htmlFor: "disabled-input" },
  render: (args) => (
    <div className="grid gap-2">
      <input id="disabled-input" type="text" disabled className="peer h-9 rounded-md border px-3 text-sm" />
      <Label {...args} />
    </div>
  ),
};

/** A label with supplementary helper text beneath the primary form label. */
export const WithDescription: Story = {
  args: { htmlFor: "username" },
  render: (args) => (
    <div className="grid gap-1.5">
      <Label {...args}>Username</Label>
      <input id="username" type="text" placeholder="jane.doe" className="h-9 rounded-md border px-3 text-sm" />
      <p className="text-muted-foreground text-xs">This is your public display name.</p>
    </div>
  ),
};
