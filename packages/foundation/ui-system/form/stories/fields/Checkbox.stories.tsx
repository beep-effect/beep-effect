import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ accept: S.Boolean });

/**
 * The `Checkbox` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const CheckboxDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { accept: false }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="accept">{(field) => <field.Checkbox label="Accept the terms" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Checkbox",
  component: CheckboxDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof CheckboxDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Accept the terms")).toBeInTheDocument();
  },
};
