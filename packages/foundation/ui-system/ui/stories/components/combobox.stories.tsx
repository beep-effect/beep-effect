import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxValue,
  useComboboxAnchor,
} from "@beep/ui/components/combobox";
import { A } from "@beep/utils";
import { expect, screen, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const frameworks: ReadonlyArray<string> = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro", "SolidStart"];

const fruitGroups: ReadonlyArray<{ readonly label: string; readonly items: ReadonlyArray<string> }> = [
  { label: "Citrus", items: ["Orange", "Lemon", "Lime", "Grapefruit"] },
  { label: "Berries", items: ["Strawberry", "Blueberry", "Raspberry"] },
];

/**
 * `Combobox` is an editable, filterable select built on Base UI's accessible combobox primitive.
 * Compose `Combobox` (root, fed by an `items` array) with `ComboboxInput` (the text field plus
 * trigger/clear affordances), `ComboboxContent` (the floating popup), `ComboboxList`,
 * `ComboboxEmpty`, and one `ComboboxItem` per option. Use `ComboboxGroup` + `ComboboxLabel` to
 * section options, and the `multiple` mode with `ComboboxChips`/`ComboboxChip`/`ComboboxChipsInput`
 * for tag-style multi-selection.
 *
 * Imported from `@beep/ui/components/combobox`.
 */
const meta = {
  title: "Components/Forms/Combobox",
  component: Combobox,
  tags: ["autodocs"],
  argTypes: {
    items: {
      control: false,
      description: "Source options used for filtering and rendering the list.",
    },
    multiple: {
      control: "boolean",
      description: "Allow selecting more than one item, surfaced as removable chips.",
      table: { defaultValue: { summary: "false" } },
    },
    disabled: {
      control: "boolean",
      description: "Disables the input, trigger, and all interaction.",
      table: { defaultValue: { summary: "false" } },
    },
    readOnly: {
      control: "boolean",
      description: "Renders the current value but prevents editing or opening.",
      table: { defaultValue: { summary: "false" } },
    },
    defaultValue: {
      control: false,
      description: "Uncontrolled initial selection.",
    },
    open: {
      control: "boolean",
      description: "Controls the open state of the popup.",
    },
  },
  args: {
    items: frameworks,
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default single-select combobox. Clicking the trigger opens the popup; the play test asserts
 * the field renders and opening reveals the option list.
 */
export const Default: Story = {
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput placeholder="Select framework..." aria-label="Framework" />
      <ComboboxContent>
        <ComboboxEmpty>No framework found.</ComboboxEmpty>
        <ComboboxList>
          {A.map(frameworks, (framework) => (
            <ComboboxItem key={framework} value={framework}>
              {framework}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "Framework" });
    expect(input).toBeVisible();
    const trigger = canvas.getByRole("button");
    return userEvent
      .click(trigger)
      .then(() => screen.findByRole("listbox"))
      .then((listbox) => {
        expect(listbox).toBeInTheDocument();
        expect(input).toHaveAttribute("aria-expanded", "true");
      });
  },
};

/**
 * Typing into the input filters the option list. The play test types a query and asserts only the
 * matching option survives.
 */
export const Filtering: Story = {
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput placeholder="Search framework..." aria-label="Framework" />
      <ComboboxContent>
        <ComboboxEmpty>No framework found.</ComboboxEmpty>
        <ComboboxList>
          {(framework: string) => (
            <ComboboxItem key={framework} value={framework}>
              {framework}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "Framework" });
    return userEvent
      .click(input)
      .then(() => userEvent.type(input, "Rem"))
      .then(() => screen.findByRole("option", { name: "Remix" }))
      .then((option) => {
        expect(option).toBeVisible();
        expect(screen.queryByRole("option", { name: "Astro" })).toBeNull();
      });
  },
};

/**
 * Selecting an option closes the popup and writes the value back into the input. The play test opens
 * the list, clicks an option, and asserts the input reflects the selection.
 */
export const Selecting: Story = {
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput placeholder="Select framework..." aria-label="Framework" />
      <ComboboxContent>
        <ComboboxEmpty>No framework found.</ComboboxEmpty>
        <ComboboxList>
          {A.map(frameworks, (framework) => (
            <ComboboxItem key={framework} value={framework}>
              {framework}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "Framework" });
    const trigger = canvas.getByRole("button");
    return userEvent
      .click(trigger)
      .then(() => screen.findByRole("option", { name: "Astro" }))
      .then((option) => userEvent.click(option))
      .then(() => {
        expect(input).toHaveValue("Astro");
      });
  },
};

/** Starts with a value preselected via `defaultValue` in uncontrolled mode. */
export const WithDefaultValue: Story = {
  args: { defaultValue: "Next.js" },
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput placeholder="Select framework..." aria-label="Framework" />
      <ComboboxContent>
        <ComboboxEmpty>No framework found.</ComboboxEmpty>
        <ComboboxList>
          {A.map(frameworks, (framework) => (
            <ComboboxItem key={framework} value={framework}>
              {framework}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "Framework" });
    expect(input).toHaveValue("Next.js");
    return Promise.resolve();
  },
};

/** Shows a clear button alongside the trigger to reset the current selection. */
export const WithClear: Story = {
  args: { defaultValue: "Remix" },
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput showClear placeholder="Select framework..." aria-label="Framework" />
      <ComboboxContent>
        <ComboboxEmpty>No framework found.</ComboboxEmpty>
        <ComboboxList>
          {A.map(frameworks, (framework) => (
            <ComboboxItem key={framework} value={framework}>
              {framework}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

/** Sections options into labeled groups separated by a divider. */
export const Grouped: Story = {
  render: () => (
    <Combobox items={A.flatMap(fruitGroups, (group) => group.items)}>
      <ComboboxInput placeholder="Pick a fruit..." aria-label="Fruit" />
      <ComboboxContent>
        <ComboboxEmpty>No fruit found.</ComboboxEmpty>
        <ComboboxList>
          {A.map(fruitGroups, (group, index) => (
            <ComboboxGroup key={group.label}>
              {index > 0 && <ComboboxSeparator />}
              <ComboboxLabel>{group.label}</ComboboxLabel>
              {A.map(group.items, (fruit) => (
                <ComboboxItem key={fruit} value={fruit}>
                  {fruit}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

/**
 * Multi-select mode renders selections as removable chips above the input. The play test opens the
 * popup and selects two options, asserting both chips appear.
 */
export const Multiple: Story = {
  render: () => {
    const anchor = useComboboxAnchor();
    return (
      <Combobox items={frameworks} multiple>
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {(value: ReadonlyArray<string>) =>
              A.map(value, (framework) => (
                <ComboboxChip key={framework} aria-label={framework}>
                  {framework}
                </ComboboxChip>
              ))
            }
          </ComboboxValue>
          <ComboboxChipsInput placeholder="Add frameworks..." aria-label="Frameworks" />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>No framework found.</ComboboxEmpty>
          <ComboboxList>
            {A.map(frameworks, (framework) => (
              <ComboboxItem key={framework} value={framework}>
                {framework}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    );
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "Frameworks" });
    return userEvent
      .click(input)
      .then(() => screen.findByRole("option", { name: "Remix" }))
      .then((option) => userEvent.click(option))
      .then(() => screen.findByRole("option", { name: "Astro" }))
      .then((option) => userEvent.click(option))
      .then(() => {
        expect(canvas.getByText("Remix")).toBeVisible();
        expect(canvas.getByText("Astro")).toBeVisible();
      });
  },
};

/**
 * Disabled comboboxes dim the field and reject interaction. The play test asserts the input is
 * disabled and stays collapsed after a click.
 */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Remix" },
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput disabled placeholder="Select framework..." aria-label="Framework" />
      <ComboboxContent>
        <ComboboxEmpty>No framework found.</ComboboxEmpty>
        <ComboboxList>
          {A.map(frameworks, (framework) => (
            <ComboboxItem key={framework} value={framework}>
              {framework}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "Framework" });
    expect(input).toBeDisabled();
    return userEvent.click(input, { pointerEventsCheck: 0 }).then(() => {
      expect(input).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("option")).toBeNull();
    });
  },
};

/** Read-only mode displays the selected value but blocks editing and opening. */
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: "Astro" },
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput placeholder="Select framework..." aria-label="Framework" />
      <ComboboxContent>
        <ComboboxEmpty>No framework found.</ComboboxEmpty>
        <ComboboxList>
          {A.map(frameworks, (framework) => (
            <ComboboxItem key={framework} value={framework}>
              {framework}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

/** Hides the dropdown trigger for a bare typeahead-style field. */
export const NoTrigger: Story = {
  render: (args) => (
    <Combobox {...args}>
      <ComboboxInput showTrigger={false} placeholder="Type to search..." aria-label="Framework" />
      <ComboboxContent>
        <ComboboxEmpty>No framework found.</ComboboxEmpty>
        <ComboboxList>
          {A.map(frameworks, (framework) => (
            <ComboboxItem key={framework} value={framework}>
              {framework}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};
