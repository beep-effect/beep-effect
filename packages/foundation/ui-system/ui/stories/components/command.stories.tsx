// fallow-ignore-file code-duplication -- story variants repeat the canonical markup on purpose: each story is a standalone usage example whose source the Storybook docs panel shows, and shared render helpers would hide that usage; the shadcn-lint adoption only rewrote class names inside these pre-existing blocks.
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@beep/ui/components/command";
import { CalculatorIcon, CalendarIcon, CreditCardIcon, GearIcon, SmileyIcon, UserIcon } from "@phosphor-icons/react";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Command` is a fast, accessible command palette built on `cmdk`. It is a compound component:
 * compose the `Command` root with `CommandInput` (the search field), `CommandList` (the scrollable
 * results region), `CommandEmpty` (the no-results fallback), one or more `CommandGroup`s with a
 * `heading`, `CommandItem`s for each action, `CommandSeparator` between groups, and
 * `CommandShortcut` to surface a keyboard hint. Wrap the same composition in `CommandDialog` to
 * present the palette inside a modal overlay. Typing into the input filters items automatically.
 *
 * Imported from `@beep/ui/components/command`.
 */
const meta = {
  title: "Components/Overlays/Command",
  component: Command,
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: false,
      description: "Controlled value of the currently selected item.",
    },
    onValueChange: {
      control: false,
      description: "Fires with the highlighted item value as the selection changes.",
    },
    loop: {
      control: "boolean",
      description: "Wrap keyboard navigation from the last item back to the first.",
      table: { defaultValue: { summary: "false" } },
    },
    label: {
      control: "text",
      description: "Accessible label announced to assistive technology for the command list.",
    },
    className: {
      control: false,
      description: "Additional classes merged onto the command root container.",
    },
  },
  args: {
    label: "Command palette",
  },
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

const onSelectSpy = fn();

/**
 * The default inline command palette with grouped actions, shortcuts, and a disabled item. The play
 * test asserts the input renders and that the first group's items are visible.
 */
export const Default: Story = {
  render: (args) => (
    <div className="overflow-hidden rounded-xl border shadow-md md:min-w-112.5">
      <Command {...args}>
        <CommandInput placeholder="Type a command or search..." aria-label="Command" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>
              <CalendarIcon />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem>
              <SmileyIcon />
              <span>Search Emoji</span>
            </CommandItem>
            <CommandItem disabled>
              <CalculatorIcon />
              <span>Calculator</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <UserIcon />
              <span>Profile</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <CreditCardIcon />
              <span>Billing</span>
              <CommandShortcut>⌘B</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <GearIcon />
              <span>Settings</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Type a command or search...");
    expect(input).toBeVisible();
    expect(canvas.getByText("Calendar")).toBeVisible();
    expect(canvas.getByText("Profile")).toBeVisible();
    return Promise.resolve();
  },
};

/**
 * Typing into the input filters the list down to matching items. The play test types a query and
 * asserts only the matching item survives while the others are removed.
 */
export const Filtering: Story = {
  render: (args) => (
    <div className="overflow-hidden rounded-xl border shadow-md md:min-w-112.5">
      <Command {...args}>
        <CommandInput placeholder="Type a command or search..." aria-label="Command" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>
              <CalendarIcon />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem>
              <SmileyIcon />
              <span>Search Emoji</span>
            </CommandItem>
            <CommandItem>
              <CalculatorIcon />
              <span>Calculator</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Type a command or search...");
    return userEvent.type(input, "Cal").then(() => {
      expect(canvas.getByText("Calendar")).toBeVisible();
      expect(canvas.getByText("Calculator")).toBeVisible();
      expect(canvas.queryByText("Search Emoji")).toBeNull();
    });
  },
};

/**
 * When no item matches the query, `CommandEmpty` is shown in place of the list. The play test types
 * an unmatched query and asserts the empty fallback appears.
 */
export const EmptyState: Story = {
  render: (args) => (
    <div className="overflow-hidden rounded-xl border shadow-md md:min-w-112.5">
      <Command {...args}>
        <CommandInput placeholder="Type a command or search..." aria-label="Command" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>
              <CalendarIcon />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem>
              <SmileyIcon />
              <span>Search Emoji</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Type a command or search...");
    return userEvent.type(input, "zzzzz").then(() => {
      expect(canvas.getByText("No results found.")).toBeVisible();
      expect(canvas.queryByText("Calendar")).toBeNull();
    });
  },
};

/**
 * Selecting an item invokes its `onSelect` handler. The play test clicks an item and asserts the
 * spy fired with the item's value.
 */
export const Selecting: Story = {
  render: () => (
    <div className="overflow-hidden rounded-xl border shadow-md md:min-w-112.5">
      <Command>
        <CommandInput placeholder="Type a command or search..." aria-label="Command" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem value="Calendar" onSelect={onSelectSpy}>
              <CalendarIcon />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem value="Search Emoji" onSelect={onSelectSpy}>
              <SmileyIcon />
              <span>Search Emoji</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole("option", { name: "Calendar" });
    onSelectSpy.mockClear();
    return userEvent.click(option).then(() => {
      expect(onSelectSpy).toHaveBeenCalledWith("Calendar");
    });
  },
};

/**
 * Disabled items are dimmed and reject selection. The play test clicks the disabled item and
 * asserts its `onSelect` handler never fires.
 */
export const DisabledItem: Story = {
  render: () => (
    <div className="overflow-hidden rounded-xl border shadow-md md:min-w-112.5">
      <Command>
        <CommandInput placeholder="Type a command or search..." aria-label="Command" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem disabled value="Calculator" onSelect={onSelectSpy}>
              <CalculatorIcon />
              <span>Calculator</span>
            </CommandItem>
            <CommandItem value="Calendar">
              <CalendarIcon />
              <span>Calendar</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole("option", { name: "Calculator" });
    expect(option).toHaveAttribute("aria-disabled", "true");
    onSelectSpy.mockClear();
    return userEvent.click(option, { pointerEventsCheck: 0 }).then(() => {
      expect(onSelectSpy).not.toHaveBeenCalled();
    });
  },
};

/** A single ungrouped list with keyboard wrap-around enabled via `loop`. */
export const WithLoop: Story = {
  args: { loop: true },
  render: (args) => (
    <div className="overflow-hidden rounded-xl border shadow-md md:min-w-112.5">
      <Command {...args}>
        <CommandInput placeholder="Search actions..." aria-label="Command" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem>
              <UserIcon />
              <span>Profile</span>
            </CommandItem>
            <CommandItem>
              <CreditCardIcon />
              <span>Billing</span>
            </CommandItem>
            <CommandItem>
              <GearIcon />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
};

/**
 * `CommandDialog` presents the palette inside a modal overlay. The play test opens the dialog and
 * asserts the input and items become visible in the portal.
 */
export const InDialog: Story = {
  render: () => (
    <CommandDialog open>
      <Command>
        <CommandInput placeholder="Type a command or search..." aria-label="Command" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>
              <CalendarIcon />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem>
              <SmileyIcon />
              <span>Search Emoji</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <UserIcon />
              <span>Profile</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <GearIcon />
              <span>Settings</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  ),
  play: () =>
    screen.findByPlaceholderText("Type a command or search...").then((input) => {
      expect(input).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Calendar" })).toBeInTheDocument();
    }),
};
