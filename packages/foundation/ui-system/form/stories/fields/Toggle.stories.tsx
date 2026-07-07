import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ bold: S.Boolean });

/**
 * The `Toggle` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const ToggleDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { bold: false }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="bold">{(field) => <field.Toggle label="Bold" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Toggle",
  component: ToggleDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof ToggleDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Bold")).toBeInTheDocument();
  },
};
