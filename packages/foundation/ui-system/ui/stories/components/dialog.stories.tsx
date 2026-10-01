// fallow-ignore-file code-duplication -- story variants repeat the canonical markup on purpose: each story is a standalone usage example whose source the Storybook docs panel shows, and shared render helpers would hide that usage; the shadcn-lint adoption only rewrote class names inside these pre-existing blocks.
import { Button } from "@beep/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@beep/ui/components/dialog";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Dialog` is a modal overlay built on Base UI's dialog primitive. Compose `Dialog` (the root that
 * owns open state) with `DialogTrigger` (the button that opens it) and `DialogContent` (the floating
 * popup, which renders its own overlay and close button). Inside the content, structure copy with
 * `DialogHeader` wrapping `DialogTitle` and `DialogDescription`, and place actions in `DialogFooter`.
 * `DialogClose` dismisses the dialog from anywhere inside it. The root accepts `open`/`defaultOpen`
 * with `onOpenChange` for state, plus `modal` and `disablePointerDismissal` to tune dismissal behavior.
 *
 * Imported from `@beep/ui/components/dialog`.
 */
const meta = {
  title: "Components/Overlays/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  argTypes: {
    open: {
      control: "boolean",
      description: "Controlled open state of the dialog.",
    },
    defaultOpen: {
      control: "boolean",
      description: "Whether the dialog is initially open in uncontrolled mode.",
      table: { defaultValue: { summary: "false" } },
    },
    modal: {
      control: "select",
      options: [true, false, "trap-focus"],
      description: "When true, traps focus and blocks interaction with the rest of the page.",
      table: { defaultValue: { summary: "true" } },
    },
    disablePointerDismissal: {
      control: "boolean",
      description: "When true, clicks outside the popup no longer close the dialog.",
      table: { defaultValue: { summary: "false" } },
    },
    onOpenChange: {
      control: false,
      description: "Callback fired whenever the open state changes.",
    },
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default dialog with a trigger, title, description, and footer actions. The play test opens the
 * dialog, asserts the title is visible, and confirms `onOpenChange` fired.
 */
export const Default: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Make changes to your profile here. Click save when you are done.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button type="button">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open dialog" });
    expect(trigger).toBeVisible();
    return userEvent.click(trigger).then(() =>
      waitFor(() => {
        expect(screen.getByRole("dialog")).toBeVisible();
        expect(screen.getByText("Edit profile")).toBeVisible();
        expect(args.onOpenChange).toHaveBeenCalled();
      })
    );
  },
};

/**
 * Renders with `defaultOpen` so the dialog is visible on first paint without interaction; the play
 * test asserts the title is already on screen.
 */
export const DefaultOpen: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Welcome aboard</DialogTitle>
          <DialogDescription>This dialog opened automatically when the story mounted.</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  ),
  play: () =>
    waitFor(() => {
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(screen.getByText("Welcome aboard")).toBeVisible();
    }),
};

/**
 * Clicking the built-in close button dismisses the dialog. The play test opens it, clicks Close, and
 * asserts the dialog is removed from the DOM.
 */
export const Closing: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Session expiring</DialogTitle>
          <DialogDescription>Your session will end soon. Close this notice to continue.</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open dialog" });
    return userEvent
      .click(trigger)
      .then(() => waitFor(() => expect(screen.getByRole("dialog")).toBeVisible()))
      .then(() => userEvent.click(screen.getAllByRole("button", { name: "Close" })[0] as HTMLElement))
      .then(() =>
        waitFor(() => {
          expect(screen.queryByRole("dialog")).toBeNull();
        })
      );
  },
};

/**
 * A destructive confirmation flow. The footer pairs a Cancel `DialogClose` with a `destructive`
 * action button, signaling an irreversible operation.
 */
export const Destructive: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="destructive">Delete account</Button>} />
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your account and remove your data from our
            servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent.click(canvas.getByRole("button", { name: "Delete account" })).then(() =>
      waitFor(() => {
        expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
      })
    );
  },
};

/**
 * Hides the content close button via `showCloseButton={false}`, forcing dismissal through explicit
 * footer actions instead of the corner icon.
 */
export const WithoutCloseButton: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
      <DialogContent className="sm:max-w-106.25" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Accept the terms</DialogTitle>
          <DialogDescription>You must choose an action below; there is no corner close button.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Decline</Button>} />
          <Button>Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

/**
 * A modal that ignores outside clicks via `disablePointerDismissal`. The play test opens the dialog,
 * clicks the backdrop overlay, and asserts the dialog stays visible.
 */
export const NonDismissible: Story = {
  args: { disablePointerDismissal: true },
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Action required</DialogTitle>
          <DialogDescription>Clicking outside will not close this dialog; use the footer button.</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Open dialog" }))
      .then(() => waitFor(() => expect(screen.getByRole("dialog")).toBeVisible()))
      .then(() => {
        const overlay = document.querySelector("[data-slot='dialog-overlay']");
        expect(overlay).not.toBeNull();
        return userEvent.click(overlay as Element);
      })
      .then(() =>
        waitFor(() => {
          expect(screen.getByRole("dialog")).toBeVisible();
        })
      );
  },
};
