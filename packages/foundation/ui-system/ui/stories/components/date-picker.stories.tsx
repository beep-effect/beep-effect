import { DatePicker } from "@beep/ui/components/date-picker";
import { DateTime } from "effect";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const SAMPLE_DATE = DateTime.toDateUtc(DateTime.makeUnsafe({ year: 2025, month: 1, day: 15 }));

/**
 * `DatePicker` is a single-date field composed from `Popover` and `Calendar`. The trigger
 * shows the selected date (or a placeholder) and opens a calendar popover on click. It works
 * both controlled (`value` + `onValueChange`) and uncontrolled (`defaultValue`).
 *
 * Imported from `@beep/ui/components/date-picker`.
 */
const meta = {
  title: "Components/Forms/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: "date",
      description: "Controlled selected date. Pair with `onValueChange` to manage state externally.",
    },
    defaultValue: {
      control: "date",
      description: "Initial selected date for uncontrolled usage.",
    },
    placeholder: {
      control: "text",
      description: "Text shown on the trigger while no date is selected.",
      table: { defaultValue: { summary: "Pick a date" } },
    },
    disabled: {
      control: "boolean",
      description: "Disables the trigger and prevents opening the calendar.",
      table: { defaultValue: { summary: "false" } },
    },
    className: {
      control: "text",
      description: "Extra classes applied to the trigger button.",
    },
    onValueChange: {
      action: "valueChanged",
      description: "Called with the newly selected `Date` (or `undefined` when cleared).",
    },
  },
  args: {
    placeholder: "Pick a date",
    disabled: false,
    onValueChange: fn(),
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default empty picker. Clicking the trigger opens the calendar popover. */
export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Pick a date" });
    expect(trigger).toBeVisible();
    return userEvent.click(trigger).then(() => {
      const popover = within(document.body);
      return waitFor(() => {
        expect(popover.getByRole("grid")).toBeVisible();
      });
    });
  },
};

/** Uncontrolled picker seeded with an initial date via `defaultValue`. */
export const WithDefaultValue: Story = {
  args: { defaultValue: SAMPLE_DATE },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    expect(trigger).toHaveTextContent("January");
  },
};

/** Controlled picker driven by `value`; the parent owns the selection through `onValueChange`. */
export const Controlled: Story = {
  args: { value: SAMPLE_DATE },
};

/** A custom placeholder communicates intent before any date is chosen. */
export const CustomPlaceholder: Story = {
  args: { placeholder: "Select due date" },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Select due date" })).toBeVisible();
  },
};

/** Disabled pickers cannot be opened and never emit `onValueChange`. */
export const Disabled: Story = {
  args: { disabled: true },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    expect(trigger.matches(":disabled, [aria-disabled='true'], [data-disabled]")).toBe(true);
    return Promise.resolve();
  },
};

/**
 * Selecting a day in the open calendar closes the popover and fires `onValueChange`.
 * Seeded with `defaultValue` so the displayed month (January 2025) is deterministic.
 */
export const SelectsADate: Story = {
  args: { defaultValue: SAMPLE_DATE },
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");
    return userEvent
      .click(trigger)
      .then(() => screen.findByRole("grid"))
      .then((grid) => userEvent.click(within(grid).getAllByRole("button")[0]))
      .then(() =>
        waitFor(() => {
          expect(args.onValueChange).toHaveBeenCalled();
        })
      );
  },
};

/** A wider trigger via `className` shows how the picker stretches to fit a layout. */
export const CustomWidth: Story = {
  args: { className: "w-72" },
};
