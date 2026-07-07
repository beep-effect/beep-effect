import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ darkMode: S.Boolean });

/**
 * The `Switch` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const SwitchDemo = () => {
  const form = useAppForm(
    makeFormOptions({ schema: Schema, defaultValues: { darkMode: false }, validateOn: "change" })
  );
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="darkMode">{(field) => <field.Switch label="Dark mode" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Switch",
  component: SwitchDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof SwitchDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Dark mode")).toBeInTheDocument();
  },
};
