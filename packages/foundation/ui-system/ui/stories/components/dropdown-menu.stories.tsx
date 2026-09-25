import { Button } from "@beep/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@beep/ui/components/dropdown-menu";
import { A } from "@beep/utils";
import { useAtom } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import * as React from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const accountActions: ReadonlyArray<{ readonly label: string; readonly shortcut: string }> = [
  { label: "Profile", shortcut: "⇧⌘P" },
  { label: "Billing", shortcut: "⌘B" },
  { label: "Settings", shortcut: "⌘S" },
];

const people: ReadonlyArray<string> = ["Pedro Duarte", "Colm Tuite"];

/**
 * `DropdownMenu` is an accessible menu opened from a button, built on Base UI's menu primitive. Compose
 * `DropdownMenu` (the root) with `DropdownMenuTrigger` (the button that toggles the menu, typically given
 * a `render` prop so it adopts `Button` styling) and `DropdownMenuContent` (the floating popup). Inside the
 * popup, use `DropdownMenuItem` for actions (with optional `inset`, `variant="destructive"`, and a trailing
 * `DropdownMenuShortcut`), `DropdownMenuCheckboxItem` / `DropdownMenuRadioGroup` + `DropdownMenuRadioItem`
 * for stateful choices, `DropdownMenuGroup` with `DropdownMenuLabel` and `DropdownMenuSeparator` to section
 * the list, and `DropdownMenuSub` + `DropdownMenuSubTrigger` + `DropdownMenuSubContent` for nested submenus.
 *
 * Imported from `@beep/ui/components/dropdown-menu`.
 */
const meta = {
  title: "Components/Overlays/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  argTypes: {
    open: {
      control: "boolean",
      description: "Controls the open state of the menu popup.",
    },
    defaultOpen: {
      control: "boolean",
      description: "Whether the popup is initially open in uncontrolled mode.",
      table: { defaultValue: { summary: "false" } },
    },
    modal: {
      control: "boolean",
      description: "Whether the menu traps focus and blocks interaction with the rest of the page.",
      table: { defaultValue: { summary: "true" } },
    },
    onOpenChange: {
      control: false,
      description: "Called when the open state changes.",
    },
  },
  args: {},
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default dropdown menu with a mix of grouped actions and shortcuts. The play test clicks the
 * trigger and asserts the popup reveals its items.
 */
export const Default: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="outline">Open</Button>} />
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {A.map(accountActions, (action) => (
            <DropdownMenuItem key={action.label}>
              {action.label}
              <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open" });
    expect(trigger).toBeVisible();
    return userEvent
      .click(trigger)
      .then(() =>
        screen.findByRole("menuitem", { name: /Profile/ }).then((item) => waitFor(() => expect(item).toBeVisible()))
      );
  },
};

/**
 * Items can be disabled to block selection while keeping them visible. The play test opens the menu
 * and asserts the disabled item is present but not actionable.
 */
export const DisabledItem: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="outline">Open</Button>} />
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem>GitHub</DropdownMenuItem>
        <DropdownMenuItem>Support</DropdownMenuItem>
        <DropdownMenuItem disabled>API</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open" });
    return userEvent
      .click(trigger)
      .then(() =>
        screen
          .findByRole("menuitem", { name: "API" })
          .then((item) => waitFor(() => expect(item).toHaveAttribute("data-disabled")))
      );
  },
};

/** A destructive action item rendered in the `destructive` variant to signal an irreversible action. */
export const DestructiveItem: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="outline">Open</Button>} />
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem>Open</DropdownMenuItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          Delete
          <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

/**
 * Checkbox items hold their own checked state and show a check indicator when active. The play test
 * opens the menu and toggles a checkbox item, asserting its checked state flips.
 */
export const WithCheckboxes: Story = {
  render: (args) => {
    const dropdownCheckboxStateAtom = React.useMemo(
      () =>
        Atom.make({
          showBookmarks: true,
          showFullUrls: false,
        }),
      []
    );
    const [checkboxState, setCheckboxState] = useAtom(dropdownCheckboxStateAtom);
    return (
      <DropdownMenu {...args}>
        <DropdownMenuTrigger render={<Button variant="outline">View</Button>} />
        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={checkboxState.showBookmarks}
            onCheckedChange={(showBookmarks) => setCheckboxState((state) => ({ ...state, showBookmarks }))}
          >
            Show Bookmarks
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={checkboxState.showFullUrls}
            onCheckedChange={(showFullUrls) => setCheckboxState((state) => ({ ...state, showFullUrls }))}
          >
            Show Full URLs
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "View" });
    return userEvent.click(trigger).then(() =>
      screen.findByRole("menuitemcheckbox", { name: "Show Full URLs" }).then((item) => {
        expect(item).toHaveAttribute("aria-checked", "false");
        return userEvent.click(item).then(() =>
          waitFor(() => {
            const checkbox = screen.getByRole("menuitemcheckbox", { name: "Show Full URLs" });
            expect(checkbox).toHaveAttribute("aria-checked", "true");
          })
        );
      })
    );
  },
};

/**
 * A radio group lets exactly one item be selected at a time, labeled and sectioned with a group
 * label. The play test opens the menu and asserts the preselected radio item is checked.
 */
export const WithRadioGroup: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="outline">Assign</Button>} />
      <DropdownMenuContent className="w-56">
        <DropdownMenuRadioGroup defaultValue="Pedro Duarte">
          <DropdownMenuLabel inset>People</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {A.map(people, (person) => (
            <DropdownMenuRadioItem key={person} value={person}>
              {person}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Assign" });
    return userEvent
      .click(trigger)
      .then(() =>
        screen
          .findByRole("menuitemradio", { name: "Pedro Duarte" })
          .then((item) => waitFor(() => expect(item).toHaveAttribute("aria-checked", "true")))
      );
  },
};

/**
 * A nested submenu opened from a `DropdownMenuSubTrigger`. The play test opens the root menu, clicks
 * the sub-trigger, and asserts the submenu items appear.
 */
export const WithSubmenu: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="outline">Open</Button>} />
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem>Team</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Invite users</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuItem>Email</DropdownMenuItem>
            <DropdownMenuItem>Message</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>More...</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem>
          New Team
          <DropdownMenuShortcut>⌘T</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open" });
    return userEvent
      .click(trigger)
      .then(() => screen.findByRole("menuitem", { name: "Invite users" }))
      .then((subTrigger) => userEvent.click(subTrigger))
      .then(() => screen.findByRole("menuitem", { name: "More..." }))
      .then((item) => waitFor(() => expect(item).toBeVisible()));
  },
};

/**
 * A complete account menu combining a labeled group with shortcuts, a submenu, a separated section
 * of links, and a destructive log-out action. The play test opens the menu and asserts the labeled
 * section renders.
 */
export const FullComposition: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="outline">My Account</Button>} />
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {A.map(accountActions, (action) => (
            <DropdownMenuItem key={action.label}>
              {action.label}
              <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>Team</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Invite users</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuItem>Email</DropdownMenuItem>
              <DropdownMenuItem>Message</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>More...</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>GitHub</DropdownMenuItem>
        <DropdownMenuItem>Support</DropdownMenuItem>
        <DropdownMenuItem disabled>API</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "My Account" });
    return userEvent
      .click(trigger)
      .then(() =>
        screen
          .findByText("My Account", { selector: "[data-slot='dropdown-menu-label']" })
          .then((label) => waitFor(() => expect(label).toBeVisible()))
      );
  },
};
