import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ bio: S.String });

/**
 * The `Textarea` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const TextareaDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { bio: "" }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="bio">{(field) => <field.Textarea label="Bio" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Textarea",
  component: TextareaDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof TextareaDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Bio");
    return userEvent.type(input, "hello").then(() => {
      expect(input).toHaveValue("hello");
    });
  },
};
