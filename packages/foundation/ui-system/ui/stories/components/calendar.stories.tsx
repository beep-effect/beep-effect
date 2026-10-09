import { Calendar } from "@beep/ui/components/calendar";
import { A } from "@beep/utils";
import * as DateTime from "effect/DateTime";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

// `react-day-picker` reads calendar fields from a `Date` in the LOCAL timezone, so a
// UTC-midnight instant can shift to the previous day/month under negative offsets. Pin
// the time to noon UTC so the local calendar day stays stable across timezones.
const atNoonUtc = (year: number, month: number, day: number): Date =>
  DateTime.toDateUtc(DateTime.makeUnsafe({ year, month, day, hour: 12 }));

const JANUARY_2025 = atNoonUtc(2025, 1, 1);
const SAMPLE_DATE = atNoonUtc(2025, 1, 15);
const RANGE_END = atNoonUtc(2025, 1, 20);

/**
 * `Calendar` is a date-grid built on `react-day-picker` with this design system's tokens,
 * Phosphor navigation chevrons, and `Button`-styled day cells. It supports single, multiple,
 * and range selection (`mode`), a label or dropdown caption (`captionLayout`), multi-month
 * layouts (`numberOfMonths`), and per-day disabling. Stories pin `defaultMonth` to January 2025
 * so the rendered grid stays deterministic.
 *
 * Imported from `@beep/ui/components/calendar`.
 */
const meta = {
  title: "Components/Data Display/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  argTypes: {
    mode: {
      control: "select",
      options: ["single", "multiple", "range"],
      description: "Selection behavior: a single day, several days, or a contiguous range.",
      table: { defaultValue: { summary: "single" } },
    },
    captionLayout: {
      control: "select",
      options: ["label", "dropdown", "dropdown-months", "dropdown-years"],
      description: "Render the month/year caption as static text or selectable dropdowns.",
      table: { defaultValue: { summary: "label" } },
    },
    buttonVariant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "destructive", "link"],
      description: "Button variant applied to the previous/next navigation arrows.",
      table: { defaultValue: { summary: "ghost" } },
    },
    numberOfMonths: {
      control: { type: "number", min: 1, max: 3 },
      description: "How many month grids to render side by side.",
      table: { defaultValue: { summary: "1" } },
    },
    showOutsideDays: {
      control: "boolean",
      description: "Show leading/trailing days from adjacent months to fill the grid.",
      table: { defaultValue: { summary: "true" } },
    },
    showWeekNumber: {
      control: "boolean",
      description: "Prepend an ISO week-number column to each row.",
      table: { defaultValue: { summary: "false" } },
    },
    className: {
      control: "text",
      description: "Extra classes applied to the calendar root.",
    },
  },
  args: {
    mode: "single",
    captionLayout: "label",
    buttonVariant: "ghost",
    numberOfMonths: 1,
    showOutsideDays: true,
    showWeekNumber: false,
    defaultMonth: JANUARY_2025,
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default single-selection calendar. Clicking a day marks it selected. */
export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("grid")).toBeVisible();
    const fifteenth = canvas.getByRole("button", { name: /January 15th, 2025/ });
    return userEvent.click(fifteenth).then(() => {
      expect(fifteenth).toHaveAttribute("data-selected-single", "true");
    });
  },
};

/** A pre-selected day renders with the primary highlight. */
export const Selected: Story = {
  args: { selected: SAMPLE_DATE },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("grid")).toBeVisible();
    expect(canvas.getByText("January 2025")).toBeVisible();
  },
};

/** `mode="multiple"` lets several non-contiguous days be selected at once. */
export const Multiple: Story = {
  args: { mode: "multiple", selected: [SAMPLE_DATE, RANGE_END] },
};

/** `mode="range"` selects a contiguous span with distinct start, middle, and end styling. */
export const Range: Story = {
  args: { mode: "range", selected: { from: SAMPLE_DATE, to: RANGE_END } },
};

/** `captionLayout="dropdown"` swaps the static caption for month and year dropdowns. */
export const DropdownCaption: Story = {
  args: { captionLayout: "dropdown" },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getAllByRole("combobox").length === 2).toBe(true);
  },
};

/** Two month grids side by side via `numberOfMonths`, useful for picking a range. */
export const TwoMonths: Story = {
  args: { numberOfMonths: 2, mode: "range", selected: { from: SAMPLE_DATE, to: RANGE_END } },
};

/** An ISO week-number column rendered ahead of each week via `showWeekNumber`. */
export const WithWeekNumbers: Story = {
  args: { showWeekNumber: true },
};

/** Hide adjacent-month days by turning off `showOutsideDays` for a tighter grid. */
export const NoOutsideDays: Story = {
  args: { showOutsideDays: false },
};

/** Disable specific days so they cannot be selected; clicking them does not fire `onSelect`. */
export const WithDisabledDays: Story = {
  args: { disabled: { before: SAMPLE_DATE } },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // `react-day-picker` marks disabled day cells with the native `disabled`
    // attribute (it only adds `aria-disabled` for a focused-and-disabled day).
    const buttons = canvas.getAllByRole("button", { hidden: true });
    const disabled = A.filter(buttons, (button) => button.hasAttribute("disabled"));
    expect(A.isReadonlyArrayNonEmpty(disabled)).toBe(true);
  },
};

/** Navigation arrows restyled with `buttonVariant="outline"`. */
export const OutlineNav: Story = {
  args: { buttonVariant: "outline" },
};

/**
 * Navigating to the next month re-renders the grid with the new caption.
 * Seeded with `defaultMonth` (January 2025) so the destination month is deterministic.
 */
export const NavigatesMonths: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("January 2025")).toBeVisible();
    const next = canvas.getByRole("button", { name: /next/i });
    return userEvent.click(next).then(() => {
      expect(canvas.getByText("February 2025")).toBeVisible();
    });
  },
};
