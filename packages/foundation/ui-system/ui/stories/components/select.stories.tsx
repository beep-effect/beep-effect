// fallow-ignore-file code-duplication -- pre-existing story clones on main: the diff-attributed audit charges them to this change because its edited lines fall inside the clone ranges. Story variants repeat the canonical markup on purpose (the Storybook docs panel shows each story's source; shared render helpers would hide that usage). Review by 2026-12-31.
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@beep/ui/components/select";
import { A } from "@beep/utils";
import { expect, screen, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const fruits: ReadonlyArray<string> = ["Apple", "Banana", "Blueberry", "Grapes", "Pineapple"];

const timezoneGroups: ReadonlyArray<{ readonly label: string; readonly items: ReadonlyArray<string> }> = [
  { label: "North America", items: ["EST", "CST", "MST", "PST"] },
  { label: "Europe", items: ["GMT", "CET", "EET"] },
];

/**
 * `Select` is an accessible dropdown built on Base UI's select primitive. Compose `Select` (the
 * root that owns the value) with `SelectTrigger` (the clickable button that shows `SelectValue`),
 * and `SelectContent` (the floating popup) wrapping one `SelectItem` per option. Use `SelectGroup`
 * with `SelectLabel` and `SelectSeparator` to section long option lists. The root accepts
 * `defaultValue`/`value` for selection state and `disabled` to lock interaction.
 *
 * Imported from `@beep/ui/components/select`.
 */
const meta = {
  title: "Components/Forms/Select",
  component: Select,
  tags: ["autodocs"],
  argTypes: {
    defaultValue: {
      control: false,
      description: "Uncontrolled initial selection.",
    },
    value: {
      control: false,
      description: "Controlled selected value.",
    },
    disabled: {
      control: "boolean",
      description: "Disables the trigger and blocks opening the popup.",
      table: { defaultValue: { summary: "false" } },
    },
    readOnly: {
      control: "boolean",
      description: "Displays the current value but prevents choosing another option.",
      table: { defaultValue: { summary: "false" } },
    },
    required: {
      control: "boolean",
      description: "Marks the field as required for form submission.",
      table: { defaultValue: { summary: "false" } },
    },
    multiple: {
      control: "boolean",
      description: "Allows selecting more than one item at a time.",
      table: { defaultValue: { summary: "false" } },
    },
    open: {
      control: "boolean",
      description: "Controls the open state of the popup.",
    },
    defaultOpen: {
      control: "boolean",
      description: "Whether the popup is initially open in uncontrolled mode.",
      table: { defaultValue: { summary: "false" } },
    },
    name: {
      control: "text",
      description: "Identifies the field when a form is submitted.",
    },
  },
  args: {},
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default single-select dropdown. The play test asserts the trigger renders, opens the popup,
 * and reveals the option list.
 */
export const Default: Story = {
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-45" aria-label="Fruit">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {A.map(fruits, (fruit) => (
          <SelectItem key={fruit} value={fruit}>
            {fruit}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Fruit" });
    expect(trigger).toBeVisible();
    return userEvent
      .click(trigger)
      .then(() => screen.findByRole("option", { name: "Apple" }))
      .then((option) => {
        expect(option).toBeInTheDocument();
      });
  },
};

/**
 * Selecting an option closes the popup and writes the chosen label into the trigger. The play test
 * opens the list, clicks an option, and asserts the trigger reflects the selection.
 */
export const Selecting: Story = {
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-45" aria-label="Fruit">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {A.map(fruits, (fruit) => (
          <SelectItem key={fruit} value={fruit}>
            {fruit}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Fruit" });
    return userEvent
      .click(trigger)
      .then(() => screen.findByRole("option", { name: "Banana" }))
      .then((option) => userEvent.click(option))
      .then(() => {
        expect(trigger).toHaveTextContent("Banana");
      });
  },
};

/**
 * Starts with a value preselected via `defaultValue` in uncontrolled mode; the trigger shows the
 * matching label on first render.
 */
export const WithDefaultValue: Story = {
  args: { defaultValue: "Blueberry" },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-45" aria-label="Fruit">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {A.map(fruits, (fruit) => (
          <SelectItem key={fruit} value={fruit}>
            {fruit}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Fruit" });
    expect(trigger).toHaveTextContent("Blueberry");
    return Promise.resolve();
  },
};

/** The small trigger size for dense layouts and toolbars. */
export const SmallSize: Story = {
  render: (args) => (
    <Select {...args}>
      <SelectTrigger size="sm" className="w-45" aria-label="Fruit">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {A.map(fruits, (fruit) => (
          <SelectItem key={fruit} value={fruit}>
            {fruit}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};

/** Sections options into labeled groups separated by a divider. */
export const Grouped: Story = {
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-50" aria-label="Timezone">
        <SelectValue placeholder="Select a timezone" />
      </SelectTrigger>
      <SelectContent>
        {A.map(timezoneGroups, (group, index) => (
          <SelectGroup key={group.label}>
            {index > 0 && <SelectSeparator />}
            <SelectLabel>{group.label}</SelectLabel>
            {A.map(group.items, (zone) => (
              <SelectItem key={zone} value={zone}>
                {zone}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  ),
};

/**
 * Disabled selects dim the trigger and reject interaction. The play test asserts the trigger is
 * disabled and the popup stays closed after a click.
 */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Grapes" },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-45" aria-label="Fruit">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {A.map(fruits, (fruit) => (
          <SelectItem key={fruit} value={fruit}>
            {fruit}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Fruit" });
    expect(trigger).toBeDisabled();
    return userEvent.click(trigger).then(() => {
      expect(screen.queryByRole("option", { name: "Apple" })).toBeNull();
    });
  },
};

/** Read-only mode displays the selected value but blocks choosing a different option. */
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: "Pineapple" },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className="w-45" aria-label="Fruit">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {A.map(fruits, (fruit) => (
          <SelectItem key={fruit} value={fruit}>
            {fruit}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};
