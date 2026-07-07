import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const E164PhoneNumber = S.String.check(
  S.isPattern(/^\+[1-9]\d{1,14}$/, {
    description: "A phone number in E.164 format.",
    identifier: "StoryE164PhoneNumber",
    message: "Enter a valid E.164 phone number.",
    title: "E.164 phone number",
  })
);

const Schema = S.Struct({ phone: E164PhoneNumber });

/**
 * The `Phone` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const PhoneDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { phone: "" }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-96 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="phone">{(field) => <field.Phone label="Phone" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Phone",
  component: PhoneDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof PhoneDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Phone");
    return userEvent.type(input, "4155552671").then(() => {
      expect(input).toHaveValue("+1 415 555 2671");
    });
  },
};
