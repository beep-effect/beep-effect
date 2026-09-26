import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@beep/ui/components/context-menu";
import { A } from "@beep/utils";
import { useAtom } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import { useId } from "react";
import { expect, fireEvent, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const contextCheckboxStateAtom = Atom.family((_id: string) =>
  Atom.make({
    showBookmarks: true,
    showFullUrls: false,
  })
);

const editActions: ReadonlyArray<{ readonly label: string; readonly shortcut: string }> = [
  { label: "Cut", shortcut: "⌘X" },
  { label: "Copy", shortcut: "⌘C" },
  { label: "Paste", shortcut: "⌘V" },
];

const people: ReadonlyArray<string> = ["Pedro Duarte", "Colm Tuite"];

/**
 * `ContextMenu` is an accessible right-click menu built on Base UI's context-menu primitive. Compose
 * `ContextMenu` (the root) with `ContextMenuTrigger` (the surface that opens the menu on right-click)
 * and `ContextMenuContent` (the floating popup). Inside the popup, use `ContextMenuItem` for actions
 * (with optional `inset`, `variant="destructive"`, and a trailing `ContextMenuShortcut`),
 * `ContextMenuCheckboxItem` / `ContextMenuRadioGroup` + `ContextMenuRadioItem` for stateful choices,
 * `ContextMenuGroup` with `ContextMenuLabel` and `ContextMenuSeparator` to section the list, and
 * `ContextMenuSub` + `ContextMenuSubTrigger` + `ContextMenuSubContent` for nested submenus.
 *
 * Imported from `@beep/ui/components/context-menu`.
 */
const meta = {
  title: "Components/Overlays/ContextMenu",
  component: ContextMenu,
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
    onOpenChange: {
      control: false,
      description: "Called when the open state changes.",
    },
  },
  args: {},
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default context menu with a mix of actions and shortcuts. The play test right-clicks the
 * trigger surface and asserts the popup reveals its items.
 */
export const Default: Story = {
  render: (args) => (
    <ContextMenu {...args}>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem>
          Back
          <ContextMenuShortcut>⌘[</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          Forward
          <ContextMenuShortcut>⌘]</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          Reload
          <ContextMenuShortcut>⌘R</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText("Right click here");
    expect(trigger).toBeVisible();
    fireEvent.contextMenu(trigger);
    return screen.findByRole("menuitem", { name: /Back/ }).then((item) => waitFor(() => expect(item).toBeVisible()));
  },
};

/**
 * Items can be disabled to block selection while keeping them visible. The play test opens the menu
 * and asserts the disabled item is present but not actionable.
 */
export const DisabledItem: Story = {
  render: (args) => (
    <ContextMenu {...args}>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {A.map(editActions, (action) => (
          <ContextMenuItem key={action.label} disabled={action.label === "Paste"}>
            {action.label}
            <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText("Right click here");
    fireEvent.contextMenu(trigger);
    return screen.findByRole("menuitem", { name: /Paste/ }).then((item) => {
      expect(item).toHaveAttribute("data-disabled");
    });
  },
};

/** A destructive action item rendered in the `destructive` variant to signal an irreversible action. */
export const DestructiveItem: Story = {
  render: (args) => (
    <ContextMenu {...args}>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem>Open</ContextMenuItem>
        <ContextMenuItem>Rename</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">
          Delete
          <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};

/**
 * Checkbox items hold their own checked state and show a check indicator when active. The play test
 * opens the menu and toggles a checkbox item, asserting its checked state flips.
 */
export const WithCheckboxes: Story = {
  render: (args) => {
    const storyInstanceId = useId();
    const [checkboxState, setCheckboxState] = useAtom(contextCheckboxStateAtom(storyInstanceId));
    return (
      <ContextMenu {...args}>
        <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
          Right click here
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuCheckboxItem
            checked={checkboxState.showBookmarks}
            onCheckedChange={(showBookmarks) => setCheckboxState((state) => ({ ...state, showBookmarks }))}
          >
            Show Bookmarks
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem
            checked={checkboxState.showFullUrls}
            onCheckedChange={(showFullUrls) => setCheckboxState((state) => ({ ...state, showFullUrls }))}
          >
            Show Full URLs
          </ContextMenuCheckboxItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText("Right click here");
    fireEvent.contextMenu(trigger);
    return screen.findByRole("menuitemcheckbox", { name: "Show Full URLs" }).then((item) => {
      expect(item).toHaveAttribute("aria-checked", "false");
      return userEvent.click(item).then(() =>
        waitFor(() => {
          const checkbox = screen.getByRole("menuitemcheckbox", { name: "Show Full URLs" });
          expect(checkbox).toHaveAttribute("aria-checked", "true");
        })
      );
    });
  },
};

/**
 * A radio group lets exactly one item be selected at a time, labeled and sectioned with a group
 * label. The play test opens the menu and asserts the preselected radio item is checked.
 */
export const WithRadioGroup: Story = {
  render: (args) => (
    <ContextMenu {...args}>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuRadioGroup defaultValue="Pedro Duarte">
          <ContextMenuLabel inset>People</ContextMenuLabel>
          <ContextMenuSeparator />
          {A.map(people, (person) => (
            <ContextMenuRadioItem key={person} value={person}>
              {person}
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText("Right click here");
    fireEvent.contextMenu(trigger);
    return screen.findByRole("menuitemradio", { name: "Pedro Duarte" }).then((item) => {
      expect(item).toHaveAttribute("aria-checked", "true");
    });
  },
};

/**
 * A nested submenu opened from a `ContextMenuSubTrigger`. The play test opens the root menu, hovers
 * the sub-trigger, and asserts the submenu items appear.
 */
export const WithSubmenu: Story = {
  render: (args) => (
    <ContextMenu {...args}>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem>New Tab</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>More Tools</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            <ContextMenuItem>Save Page...</ContextMenuItem>
            <ContextMenuItem>Create Shortcut...</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>Developer Tools</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText("Right click here");
    fireEvent.contextMenu(trigger);
    return screen
      .findByRole("menuitem", { name: "More Tools" })
      .then((subTrigger) => userEvent.click(subTrigger))
      .then(() => screen.findByRole("menuitem", { name: "Developer Tools" }))
      .then((item) => waitFor(() => expect(item).toBeVisible()));
  },
};

/**
 * A complete composition combining grouped actions, shortcuts, a submenu, checkboxes, a radio group,
 * and a destructive item. The play test opens the menu and asserts the labeled section renders.
 */
export const FullComposition: Story = {
  render: (args) => (
    <ContextMenu {...args}>
      <ContextMenuTrigger className="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuGroup>
          <ContextMenuItem inset>
            Back
            <ContextMenuShortcut>⌘[</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset disabled>
            Forward
            <ContextMenuShortcut>⌘]</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset>
            Reload
            <ContextMenuShortcut>⌘R</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSub>
          <ContextMenuSubTrigger inset>More Tools</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            <ContextMenuItem>Save Page...</ContextMenuItem>
            <ContextMenuItem>Create Shortcut...</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem defaultChecked>Show Bookmarks</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem>Show Full URLs</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuRadioGroup defaultValue="Pedro Duarte">
          <ContextMenuLabel inset>People</ContextMenuLabel>
          {A.map(people, (person) => (
            <ContextMenuRadioItem key={person} value={person}>
              {person}
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText("Right click here");
    fireEvent.contextMenu(trigger);
    return screen.findByRole("menuitem", { name: /Back/ }).then((item) =>
      waitFor(() => {
        const menu = item.closest("[role='menu']");
        expect(menu).not.toBeNull();
        const label = within(menu as HTMLElement).getByText("People");
        expect(label).toBeVisible();
      })
    );
  },
};
