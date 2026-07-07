import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ quantity: S.Finite });

/**
 * The `Number` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const NumberDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { quantity: 1 }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="quantity">{(field) => <field.Number label="Quantity" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Number",
  component: NumberDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof NumberDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Quantity")).toBeInTheDocument();
  },
};
