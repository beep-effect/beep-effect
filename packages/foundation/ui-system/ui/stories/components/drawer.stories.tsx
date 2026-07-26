import { Button } from "@beep/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@beep/ui/components/drawer";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Drawer` is a sliding panel overlay built on the `vaul` primitive. Compose `Drawer` (the root that
 * owns open state) with `DrawerTrigger` (the control that opens it) and `DrawerContent` (the floating
 * panel, which renders its own overlay). Inside the content, structure copy with `DrawerHeader`
 * wrapping `DrawerTitle` and `DrawerDescription`, and place actions in `DrawerFooter`. `DrawerClose`
 * dismisses the drawer from anywhere inside it. The root accepts `open`/`defaultOpen` with
 * `onOpenChange` for state, plus `direction` to slide from any edge, and `modal`/`dismissible` to
 * tune dismissal behavior.
 *
 * Imported from `@beep/ui/components/drawer`.
 */
const meta = {
  title: "Components/Overlays/Drawer",
  component: Drawer,
  tags: ["autodocs"],
  argTypes: {
    direction: {
      control: "select",
      options: ["top", "bottom", "left", "right"],
      description: "Edge the drawer slides in from.",
      table: { defaultValue: { summary: "bottom" } },
    },
    open: {
      control: "boolean",
      description: "Controlled open state of the drawer.",
    },
    defaultOpen: {
      control: "boolean",
      description: "Whether the drawer is initially open in uncontrolled mode.",
      table: { defaultValue: { summary: "false" } },
    },
    modal: {
      control: "boolean",
      description: "When true, traps focus and blocks interaction with the rest of the page.",
      table: { defaultValue: { summary: "true" } },
    },
    dismissible: {
      control: "boolean",
      description: "Allows closing the drawer by dragging, clicking the overlay, or pressing Escape.",
      table: { defaultValue: { summary: "true" } },
    },
    onOpenChange: {
      control: false,
      description: "Callback fired whenever the open state changes.",
    },
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default bottom drawer with a trigger, title, description, and footer actions. The play test opens
 * the drawer, asserts the title is visible, and confirms `onOpenChange` fired.
 */
export const Default: Story = {
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Edit profile</DrawerTitle>
            <DrawerDescription>Make changes to your profile here. Save when you are done.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button>Save changes</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  ),
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open drawer" });
    expect(trigger).toBeVisible();
    return userEvent.click(trigger).then(() =>
      waitFor(() => {
        expect(screen.getByText("Edit profile")).toBeVisible();
        expect(args.onOpenChange).toHaveBeenCalled();
      })
    );
  },
};

/**
 * Renders with `defaultOpen` so the drawer is visible on first paint without interaction; the play test
 * asserts the title is already on screen.
 */
export const DefaultOpen: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Welcome aboard</DrawerTitle>
            <DrawerDescription>This drawer opened automatically when the story mounted.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Got it</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  ),
  play: () => waitFor(() => expect(screen.getByText("Welcome aboard")).toBeVisible()),
};

/**
 * Slides in from the right edge via `direction="right"`, suited to side panels and detail views. The
 * play test opens it and asserts the panel content is visible.
 */
export const RightSide: Story = {
  args: { direction: "right" },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open panel</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filters</DrawerTitle>
          <DrawerDescription>Refine the results shown in the table.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button>Apply</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Open panel" }))
      .then(() => waitFor(() => expect(screen.getByText("Filters")).toBeVisible()));
  },
};

/**
 * Slides in from the left edge via `direction="left"`, a common pattern for navigation menus.
 */
export const LeftSide: Story = {
  args: { direction: "left" },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open menu</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Navigation</DrawerTitle>
          <DrawerDescription>Jump to a section of the app.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

/**
 * Slides down from the top edge via `direction="top"`, useful for notifications or command surfaces.
 */
export const TopSide: Story = {
  args: { direction: "top" },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open banner</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>What is new</DrawerTitle>
            <DrawerDescription>A summary of the latest changes drops from the top.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Dismiss</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  ),
};

/**
 * Clicking the `DrawerClose` button dismisses the drawer. The play test opens it, clicks Cancel, and
 * asserts the content is removed from the DOM.
 */
export const Closing: Story = {
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Session expiring</DrawerTitle>
            <DrawerDescription>Your session will end soon. Close this notice to continue.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Open drawer" }))
      .then(() => waitFor(() => expect(screen.getByText("Session expiring")).toBeVisible()))
      .then(() => userEvent.click(screen.getByRole("button", { name: "Cancel" })))
      .then(() =>
        waitFor(() => {
          expect(screen.queryByText("Session expiring")).toBeNull();
        })
      );
  },
};

/**
 * A destructive confirmation flow. The footer pairs a Cancel `DrawerClose` with a `destructive` action
 * button, signaling an irreversible operation. The play test opens it and asserts the Delete action is
 * visible.
 */
export const Destructive: Story = {
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger asChild>
        <Button variant="destructive">Delete account</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Are you absolutely sure?</DrawerTitle>
            <DrawerDescription>
              This action cannot be undone. This will permanently delete your account and remove your data from our
              servers.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button variant="destructive">Delete</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Delete account" }))
      .then(() => waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeVisible()));
  },
};

/**
 * A non-dismissible drawer that ignores overlay clicks and Escape via `dismissible={false}`. The play
 * test opens the drawer, presses Escape, and asserts it stays visible.
 */
export const NonDismissible: Story = {
  args: { dismissible: false },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger asChild>
        <Button variant="outline">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Action required</DrawerTitle>
            <DrawerDescription>Pressing Escape will not close this drawer; use the footer button.</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Acknowledge</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: "Open drawer" }))
      .then(() => waitFor(() => expect(screen.getByText("Action required")).toBeVisible()))
      .then(() => userEvent.keyboard("{Escape}"))
      .then(() => {
        // Asserted synchronously on purpose: the drawer must NOT close, so a
        // retrying waitFor would mask a drawer that closes and reopens.
        expect(screen.getByText("Action required")).toBeVisible();
      });
  },
};
