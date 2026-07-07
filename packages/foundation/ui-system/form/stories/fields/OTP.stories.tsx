import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ code: S.String });

/**
 * The `OTP` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const OTPDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { code: "" }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="code">{(field) => <field.OTP label="One-time code" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/OTP",
  component: OTPDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof OTPDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("One-time code")).toBeInTheDocument();
  },
};
