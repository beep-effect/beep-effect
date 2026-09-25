import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@beep/ui/components/menubar";
import { A } from "@beep/utils";
import { useAtom } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import * as React from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const fileActions: ReadonlyArray<{ readonly label: string; readonly shortcut: string }> = [
  { label: "New Tab", shortcut: "⌘T" },
  { label: "New Window", shortcut: "⌘N" },
];

const profiles: ReadonlyArray<string> = ["Andy", "Benoit", "Luis"];

/**
 * `Menubar` is a desktop-style application menu bar built on Base UI's menubar primitive. Compose
 * `Menubar` (the horizontal container) with one `MenubarMenu` per top-level menu. Inside each menu use
 * `MenubarTrigger` (the always-visible top-level button) and `MenubarContent` (the floating popup).
 * Within the popup, use `MenubarItem` for actions (with optional `inset`, `variant="destructive"`, and a
 * trailing `MenubarShortcut`), `MenubarCheckboxItem` and `MenubarRadioGroup` + `MenubarRadioItem` for
 * stateful choices, `MenubarLabel` and `MenubarSeparator` to section the list, and `MenubarSub` +
 * `MenubarSubTrigger` + `MenubarSubContent` for nested submenus.
 *
 * Imported from `@beep/ui/components/menubar`.
 */
const meta = {
  title: "Components/Overlays/Menubar",
  component: Menubar,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
      description: "Orientation of the menu bar for arrow-key navigation between menus.",
      table: { defaultValue: { summary: "horizontal" } },
    },
    modal: {
      control: "boolean",
      description: "Whether an open menu traps focus and blocks interaction with the rest of the page.",
      table: { defaultValue: { summary: "true" } },
    },
  },
  args: {},
} satisfies Meta<typeof Menubar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default application menu bar with File, Edit, and View menus. The play test clicks the File
 * trigger and asserts the popup reveals its items.
 */
export const Default: Story = {
  render: (args) => (
    <Menubar {...args}>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          {A.map(fileActions, (action) => (
            <MenubarItem key={action.label}>
              {action.label}
              <MenubarShortcut>{action.shortcut}</MenubarShortcut>
            </MenubarItem>
          ))}
          <MenubarSeparator />
          <MenubarItem>
            Print...
            <MenubarShortcut>⌘P</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Undo
            <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Redo
            <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem inset>Toggle Fullscreen</MenubarItem>
          <MenubarItem inset>Hide Sidebar</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("menuitem", { name: "File" });
    expect(trigger).toBeVisible();
    return userEvent
      .click(trigger)
      .then(() =>
        screen.findByRole("menuitem", { name: /New Tab/ }).then((item) => waitFor(() => expect(item).toBeVisible()))
      );
  },
};

/**
 * Items can be disabled to block selection while keeping them visible. The play test opens the menu
 * and asserts the disabled item is present but not actionable.
 */
export const DisabledItem: Story = {
  render: (args) => (
    <Menubar {...args}>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>New Tab</MenubarItem>
          <MenubarItem>New Window</MenubarItem>
          <MenubarItem disabled>New Incognito Window</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("menuitem", { name: "File" });
    return userEvent
      .click(trigger)
      .then(() =>
        screen
          .findByRole("menuitem", { name: "New Incognito Window" })
          .then((item) => waitFor(() => expect(item).toHaveAttribute("data-disabled")))
      );
  },
};

/** A destructive action item rendered in the `destructive` variant to signal an irreversible action. */
export const DestructiveItem: Story = {
  render: (args) => (
    <Menubar {...args}>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Open</MenubarItem>
          <MenubarItem>Rename</MenubarItem>
          <MenubarSeparator />
          <MenubarItem variant="destructive">
            Delete
            <MenubarShortcut>⌘⌫</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
};

/**
 * Checkbox items hold their own checked state and show a check indicator when active. The play test
 * opens the menu and toggles a checkbox item, asserting its checked state flips.
 */
export const WithCheckboxes: Story = {
  render: (args) => {
    const menubarCheckboxStateAtom = React.useMemo(
      () =>
        Atom.make({
          showBookmarks: true,
          showFullUrls: false,
        }),
      []
    );
    const [checkboxState, setCheckboxState] = useAtom(menubarCheckboxStateAtom);
    return (
      <Menubar {...args}>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarGroup>
              <MenubarLabel>Appearance</MenubarLabel>
            </MenubarGroup>
            <MenubarSeparator />
            <MenubarCheckboxItem
              checked={checkboxState.showBookmarks}
              onCheckedChange={(showBookmarks) => setCheckboxState((state) => ({ ...state, showBookmarks }))}
            >
              Always Show Bookmarks Bar
            </MenubarCheckboxItem>
            <MenubarCheckboxItem
              checked={checkboxState.showFullUrls}
              onCheckedChange={(showFullUrls) => setCheckboxState((state) => ({ ...state, showFullUrls }))}
            >
              Always Show Full URLs
            </MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("menuitem", { name: "View" });
    return userEvent.click(trigger).then(() =>
      screen.findByRole("menuitemcheckbox", { name: "Always Show Full URLs" }).then((item) => {
        expect(item).toHaveAttribute("aria-checked", "false");
        item.focus();
        return userEvent.keyboard("{Enter}").then(() =>
          waitFor(() => {
            const checkbox = screen.getByRole("menuitemcheckbox", { name: "Always Show Full URLs" });
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
    <Menubar {...args}>
      <MenubarMenu>
        <MenubarTrigger>Profiles</MenubarTrigger>
        <MenubarContent>
          <MenubarRadioGroup defaultValue="Benoit">
            {A.map(profiles, (person) => (
              <MenubarRadioItem key={person} value={person}>
                {person}
              </MenubarRadioItem>
            ))}
          </MenubarRadioGroup>
          <MenubarSeparator />
          <MenubarItem inset>Add Profile...</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("menuitem", { name: "Profiles" });
    return userEvent
      .click(trigger)
      .then(() =>
        screen
          .findByRole("menuitemradio", { name: "Benoit" })
          .then((item) => waitFor(() => expect(item).toHaveAttribute("aria-checked", "true")))
      );
  },
};

/**
 * A nested submenu opened from a `MenubarSubTrigger`. The play test opens the root menu, clicks the
 * sub-trigger, and asserts the submenu items appear.
 */
export const WithSubmenu: Story = {
  render: (args) => (
    <Menubar {...args}>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>New Tab</MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger>Share</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Email link</MenubarItem>
              <MenubarItem>Messages</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Notes</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarItem>
            Print...
            <MenubarShortcut>⌘P</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("menuitem", { name: "File" });
    return userEvent
      .click(trigger)
      .then(() => screen.findByRole("menuitem", { name: "Share" }))
      .then((subTrigger) => userEvent.click(subTrigger))
      .then(() => screen.findByRole("menuitem", { name: "Notes" }))
      .then((item) => waitFor(() => expect(item).toBeVisible()));
  },
};

/**
 * A complete application menu bar combining shortcuts, a submenu, checkbox and radio state, and a
 * destructive action across several top-level menus. The play test opens the Edit menu and asserts a
 * shortcut-bearing item renders.
 */
export const FullComposition: Story = {
  render: (args) => (
    <Menubar {...args}>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          {A.map(fileActions, (action) => (
            <MenubarItem key={action.label}>
              {action.label}
              <MenubarShortcut>{action.shortcut}</MenubarShortcut>
            </MenubarItem>
          ))}
          <MenubarItem disabled>New Incognito Window</MenubarItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>Share</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem>Email link</MenubarItem>
              <MenubarItem>Messages</MenubarItem>
              <MenubarItem>Notes</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem variant="destructive">
            Delete
            <MenubarShortcut>⌘⌫</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Undo
            <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Redo
            <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Cut</MenubarItem>
          <MenubarItem>Copy</MenubarItem>
          <MenubarItem>Paste</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarCheckboxItem>Always Show Bookmarks Bar</MenubarCheckboxItem>
          <MenubarCheckboxItem defaultChecked>Always Show Full URLs</MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarItem inset>
            Reload
            <MenubarShortcut>⌘R</MenubarShortcut>
          </MenubarItem>
          <MenubarItem inset>Toggle Fullscreen</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Profiles</MenubarTrigger>
        <MenubarContent>
          <MenubarRadioGroup defaultValue="Benoit">
            {A.map(profiles, (person) => (
              <MenubarRadioItem key={person} value={person}>
                {person}
              </MenubarRadioItem>
            ))}
          </MenubarRadioGroup>
          <MenubarSeparator />
          <MenubarItem inset>Edit...</MenubarItem>
          <MenubarItem inset>Add Profile...</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("menuitem", { name: "Edit" });
    return userEvent
      .click(trigger)
      .then(() =>
        screen.findByRole("menuitem", { name: /Undo/ }).then((item) => waitFor(() => expect(item).toBeVisible()))
      );
  },
};
