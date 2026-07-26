import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ emoji: S.String });

/**
 * The `Emoji` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const EmojiDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { emoji: "" }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="emoji">{(field) => <field.Emoji label="Emoji" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Emoji",
  component: EmojiDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof EmojiDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    return userEvent
      .click(canvas.getByRole("button", { name: /select emoji/i }))
      .then(() => waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()));
  },
};
