import { TodoItem } from "@beep/ui/components/todo-item";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `TodoItem` renders a single task row with a completion toggle, priority badge, and optional
 * metadata such as due date, project, labels, and subtask progress. It exposes `onClick` for
 * selecting the row and `onToggleComplete` for the completion circle.
 *
 * Imported from `@beep/ui/components/todo-item`.
 */
const meta = {
  title: "Components/Data Display/TodoItem",
  component: TodoItem,
  tags: ["autodocs"],
  argTypes: {
    priority: {
      control: "select",
      options: ["high", "medium", "low", "none"],
      description: "Priority badge tone and toggle border color.",
      table: { defaultValue: { summary: "none" } },
    },
    completed: {
      control: "boolean",
      description: "Marks the task done, dimming the row and striking the title.",
    },
    isSelected: {
      control: "boolean",
      description: "Highlights the row with a focus ring.",
    },
    title: {
      control: "text",
      description: "Primary task label.",
    },
    description: {
      control: "text",
      description: "Optional secondary text shown under the title.",
    },
  },
  args: {
    id: "todo-1",
    title: "Review the quarterly roadmap",
    completed: false,
    priority: "none",
    onClick: fn(),
    onToggleComplete: fn(),
  },
} satisfies Meta<typeof TodoItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default task row. Clicking the row fires `onClick` with the task id. */
export const Default: Story = {
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("Review the quarterly roadmap");
    expect(title).toBeVisible();
    return userEvent.click(title).then(() => {
      expect(args.onClick, "a title click bubbles to the row, a plain region with no button role").toHaveBeenCalledWith(
        "todo-1"
      );
    });
  },
};

/** A completed task is dimmed and its title is struck through. */
export const Completed: Story = {
  args: { id: "todo-2", title: "Ship the release notes", completed: true },
};

/** A high-priority task with a description, due date, project, labels, and subtask progress. */
export const Detailed: Story = {
  args: {
    id: "todo-3",
    title: "Prepare launch checklist",
    description: "Confirm every owner has signed off before the announcement.",
    priority: "high",
    dueDate: "2025-01-15",
    project: { id: "proj-1", name: "Launch" },
    labels: [
      { id: "label-1", name: "urgent" },
      { id: "label-2", name: "marketing" },
    ],
    subtasks: [
      { id: "sub-1", title: "Draft email", completed: true },
      { id: "sub-2", title: "Schedule send", completed: false },
    ],
  },
};

/** The selected state highlights the row with a focus ring for keyboard navigation. */
export const Selected: Story = {
  args: { id: "todo-4", title: "Triage incoming bugs", priority: "medium", isSelected: true },
};
