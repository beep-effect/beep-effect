import { EditorComposer } from "@beep/editor/composer";
import { expect, fn, within } from "storybook/test";
import { draftReplyInitialState as initialState } from "./fixtures.ts";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Editor/EditorComposer",
  component: EditorComposer,
  tags: ["autodocs"],
  args: { onSerializedChange: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "Editable composer over the `@beep/lexical-schema` v1 vocabulary with history, lists, links, and markdown shortcuts; `onSerializedChange` emits schema-decoded states.",
      },
    },
  },
} satisfies Meta<typeof EditorComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { placeholder: "Message the workspace…" },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void expect(canvas.getByText("Message the workspace…")).toBeVisible();
  },
};

export const WithInitialState: Story = {
  args: { initialState },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void expect(canvas.getByText("Draft a reply…")).toBeVisible();
  },
};
