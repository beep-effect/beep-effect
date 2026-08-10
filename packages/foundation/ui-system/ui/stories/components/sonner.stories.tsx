import { Button } from "@beep/ui/components/button";
import { Toaster } from "@beep/ui/components/sonner";
import { toast } from "sonner";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Toaster` is the toast notification host built on the `sonner` library, themed to follow the
 * active `next-themes` color scheme and the design system's popover tokens. Render a single
 * `Toaster` near the root of the tree, then call the imperative `toast()` API (and its
 * `toast.success`, `toast.error`, `toast.warning`, `toast.info`, `toast.promise` helpers) from
 * anywhere to push notifications. The host accepts `position`, `richColors`, `closeButton`,
 * `expand`, and `duration` to tune presentation. Each story below pairs a trigger button with the
 * `Toaster` so you can fire toasts directly in the canvas.
 *
 * Imported from `@beep/ui/components/sonner`.
 */
const meta = {
  title: "Components/Feedback/Sonner",
  component: Toaster,
  tags: ["autodocs"],
  argTypes: {
    position: {
      control: "select",
      options: ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"],
      description: "Corner or edge of the viewport where toasts stack.",
      table: { defaultValue: { summary: "bottom-right" } },
    },
    richColors: {
      control: "boolean",
      description: "Use semantic background colors for success, error, warning, and info toasts.",
      table: { defaultValue: { summary: "false" } },
    },
    closeButton: {
      control: "boolean",
      description: "Show a dismiss button on each toast.",
      table: { defaultValue: { summary: "false" } },
    },
    expand: {
      control: "boolean",
      description: "Keep stacked toasts expanded instead of collapsing them behind the front toast.",
      table: { defaultValue: { summary: "false" } },
    },
    duration: {
      control: "number",
      description: "Milliseconds a toast stays visible before auto-dismissing.",
      table: { defaultValue: { summary: "4000" } },
    },
  },
  args: {
    position: "bottom-right",
    richColors: false,
    closeButton: false,
    expand: false,
  },
  beforeEach: () => {
    toast.dismiss();
  },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default toast with a title, description, and action. The play test clicks the trigger and
 * asserts the toast message renders in the portal.
 */
export const Default: Story = {
  render: (args) => (
    <>
      <Button
        variant="outline"
        onClick={() =>
          toast("Event has been created", {
            description: "Sunday, December 03, 2023 at 9:00 AM",
            action: { label: "Undo", onClick: () => undefined },
          })
        }
      >
        Show toast
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Show toast" });
    expect(trigger).toBeVisible();
    return userEvent
      .click(trigger)
      .then(() => screen.findByText("Event has been created"))
      .then((message) => waitFor(() => expect(message).toBeVisible()));
  },
};

/**
 * A plain text toast with no description or action, the simplest possible notification.
 */
export const Simple: Story = {
  render: (args) => (
    <>
      <Button variant="outline" onClick={() => toast("Saved to your library")}>
        Show toast
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Show toast" }))
      .then(() => screen.findByText("Saved to your library"))
      .then((message) => waitFor(() => expect(message).toBeVisible()));
  },
};

/**
 * A success toast via `toast.success`, paired with the success icon and (under `richColors`) a
 * green treatment.
 */
export const Success: Story = {
  args: { richColors: true },
  render: (args) => (
    <>
      <Button variant="outline" onClick={() => toast.success("Profile updated successfully")}>
        Show success
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Show success" }))
      .then(() => screen.findByText("Profile updated successfully"))
      .then((message) => waitFor(() => expect(message).toBeVisible()));
  },
};

/**
 * An error toast via `toast.error`, used to surface failures with the error icon.
 */
export const Error: Story = {
  args: { richColors: true },
  render: (args) => (
    <>
      <Button variant="outline" onClick={() => toast.error("Could not save your changes")}>
        Show error
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Show error" }))
      .then(() => screen.findByText("Could not save your changes"))
      .then((message) => waitFor(() => expect(message).toBeVisible()));
  },
};

/**
 * A warning toast via `toast.warning`, used for non-blocking cautions.
 */
export const Warning: Story = {
  args: { richColors: true },
  render: (args) => (
    <>
      <Button variant="outline" onClick={() => toast.warning("Your trial ends in 3 days")}>
        Show warning
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Show warning" }))
      .then(() => screen.findByText("Your trial ends in 3 days"))
      .then((message) => waitFor(() => expect(message).toBeVisible()));
  },
};

/**
 * An informational toast via `toast.info`, used for neutral status updates.
 */
export const Info: Story = {
  args: { richColors: true },
  render: (args) => (
    <>
      <Button variant="outline" onClick={() => toast.info("A new version is available")}>
        Show info
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Show info" }))
      .then(() => screen.findByText("A new version is available"))
      .then((message) => waitFor(() => expect(message).toBeVisible()));
  },
};

/**
 * A toast with a title and supporting description for richer context.
 */
export const WithDescription: Story = {
  render: (args) => (
    <>
      <Button
        variant="outline"
        onClick={() =>
          toast("Invitation sent", {
            description: "We emailed an invite to jordan@example.com.",
          })
        }
      >
        Send invite
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Send invite" }))
      .then(() => screen.findByText("We emailed an invite to jordan@example.com."))
      .then((description) => waitFor(() => expect(description).toBeVisible()));
  },
};

/**
 * A toast with an inline action button. The play test fires the toast, then clicks the Undo action
 * inside the portal.
 */
export const WithAction: Story = {
  render: (args) => (
    <>
      <Button
        variant="outline"
        onClick={() =>
          toast("File moved to trash", {
            action: { label: "Undo", onClick: () => undefined },
          })
        }
      >
        Delete file
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Delete file" }))
      .then(() => screen.findByRole("button", { name: "Undo" }))
      .then((action) => waitFor(() => expect(action).toBeVisible()).then(() => userEvent.click(action)));
  },
};

/**
 * A dismissible toast rendered with `closeButton`. The play test fires the toast, clicks its close
 * button, and asserts the message is removed from the DOM.
 */
export const WithCloseButton: Story = {
  args: { closeButton: true },
  render: (args) => (
    <>
      <Button variant="outline" onClick={() => toast("Connection restored")}>
        Show toast
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Show toast" }))
      .then(() => screen.findByText("Connection restored"))
      .then((message) => waitFor(() => expect(message).toBeVisible()))
      .then(() => screen.findByRole("button", { name: "Close toast" }))
      .then((close) => userEvent.click(close))
      .then(() => waitFor(() => expect(screen.queryByText("Connection restored")).toBeNull()));
  },
};

/**
 * A promise toast via `toast.promise` that shows a loading state and resolves to a success message.
 */
export const Promise: Story = {
  render: (args) => (
    <>
      <Button
        variant="outline"
        onClick={() =>
          toast.promise(globalThis.Promise.resolve({ name: "Report" }), {
            loading: "Generating report...",
            success: (data: { name: string }) => `${data.name} is ready to download`,
            error: "Failed to generate report",
          })
        }
      >
        Generate report
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Generate report" }))
      .then(() => screen.findByText("Report is ready to download"))
      .then((message) => waitFor(() => expect(message).toBeVisible()));
  },
};

/**
 * A toast pinned to the top-center of the viewport, useful for global, page-level announcements.
 */
export const TopCenter: Story = {
  args: { position: "top-center" },
  render: (args) => (
    <>
      <Button variant="outline" onClick={() => toast("Pinned to the top of the page")}>
        Show toast
      </Button>
      <Toaster {...args} />
    </>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Show toast" }))
      .then(() => screen.findByText("Pinned to the top of the page"))
      .then((message) => waitFor(() => expect(message).toBeVisible()));
  },
};
