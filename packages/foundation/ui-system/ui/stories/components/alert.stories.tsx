import { Alert, AlertAction, AlertDescription, AlertTitle } from "@beep/ui/components/alert";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const onReloadClick = fn();

/**
 * `Alert` is a feedback surface that calls out a single, contextual message with
 * `role="alert"` semantics. It is a compound component: compose an optional leading
 * `<svg>` icon, an `AlertTitle`, an `AlertDescription`, and an optional `AlertAction`
 * inside the `Alert` root. The root lays its children out on a CSS grid that reserves a
 * leading column for an icon and a trailing slot for the action, so sub-parts align
 * automatically regardless of which are present.
 *
 * The only styling prop on the root is `variant`, which switches between the neutral
 * `default` surface and a `destructive` treatment that tints the title, description,
 * and icon.
 *
 * Imported from `@beep/ui/components/alert`.
 */
const meta = {
  title: "Components/Feedback/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive"],
      description: "Visual treatment of the alert; `destructive` tints for errors and failures.",
      table: { defaultValue: { summary: "default" } },
    },
    className: {
      control: "text",
      description: "Additional classes merged onto the root surface (e.g. width constraints).",
    },
    children: {
      control: false,
      description: "Composed alert sub-parts (icon, title, description, action).",
    },
  },
  args: {
    variant: "default",
    className: "w-full max-w-xl",
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The canonical composition: a leading icon, a title, and a description on the neutral
 * default surface.
 */
export const Default: Story = {
  render: (args) => (
    <Alert {...args}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <title>Success</title>
        <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <AlertTitle>Success! Your changes have been saved</AlertTitle>
      <AlertDescription>This is an alert with an icon, title, and description.</AlertDescription>
    </Alert>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole("alert");
    expect(alert).toBeVisible();
    expect(canvas.getByText("Success! Your changes have been saved")).toBeVisible();
    expect(canvas.getByText("This is an alert with an icon, title, and description.")).toBeVisible();
  },
};

/** A minimal alert with only a title and an icon, useful for terse confirmations. */
export const TitleOnly: Story = {
  render: (args) => (
    <Alert {...args}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <title>Information</title>
        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <AlertTitle>This alert has a title and an icon. No description.</AlertTitle>
    </Alert>
  ),
};

/** An alert with a title and description but no icon, leaving the leading column unused. */
export const WithoutIcon: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>You can add components to your app using the CLI.</AlertDescription>
    </Alert>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("alert")).toBeVisible();
    expect(canvas.getByText("Heads up")).toBeVisible();
  },
};

/**
 * The `destructive` variant tints the title, description, and icon to signal an error or
 * failed action.
 */
export const Destructive: Story = {
  args: { variant: "destructive" },
  render: (args) => (
    <Alert {...args}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <title>Error</title>
        <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
      <AlertTitle>Unable to process your payment.</AlertTitle>
      <AlertDescription>
        <p>Please verify your billing information and try again.</p>
        <ul className="list-inside list-disc text-sm">
          <li>Check your card details</li>
          <li>Ensure sufficient funds</li>
          <li>Verify your billing address</li>
        </ul>
      </AlertDescription>
    </Alert>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole("alert");
    expect(alert).toHaveAttribute("data-slot", "alert");
    expect(canvas.getByText("Unable to process your payment.")).toBeVisible();
  },
};

/**
 * `AlertAction` pins an interactive control to the top-right corner of the alert; the
 * root reserves trailing padding so the action never overlaps the message. Clicking the
 * action fires its `onClick`.
 */
export const WithAction: Story = {
  args: {
    children: undefined,
  },
  render: (args) => (
    <Alert {...args}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <title>Update</title>
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
      </svg>
      <AlertTitle>A new version is available</AlertTitle>
      <AlertDescription>Reload to get the latest features and fixes.</AlertDescription>
      <AlertAction>
        <button
          type="button"
          onClick={onReloadClick}
          className="border-input rounded-md border px-2.5 py-1 text-xs font-medium"
        >
          Reload
        </button>
      </AlertAction>
    </Alert>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const action = canvas.getByRole("button", { name: "Reload" });
    expect(action).toBeVisible();
    return userEvent.click(action).then(() => {
      expect(onReloadClick).toHaveBeenCalledOnce();
    });
  },
};
