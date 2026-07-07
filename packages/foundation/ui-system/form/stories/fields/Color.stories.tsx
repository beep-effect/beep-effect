import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as Color from "@beep/schema/Color";
import * as S from "effect/Schema";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ color: Color.NormalizeHexColor });

/**
 * The `Color` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const ColorDemo = () => {
  const form = useAppForm(
    makeFormOptions({ schema: Schema, defaultValues: { color: "#33bbff" }, validateOn: "change" })
  );
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="color">{(field) => <field.Color label="Accent color" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Color",
  component: ColorDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof ColorDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Accent color");
    return userEvent
      .clear(input)
      .then(() => userEvent.type(input, "#3bf"))
      .then(() => {
        expect(input).toHaveValue("#33bbff");
      });
  },
};
