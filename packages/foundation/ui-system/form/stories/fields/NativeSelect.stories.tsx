import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ plan: S.String });
const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

/**
 * The `NativeSelect` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const NativeSelectDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { plan: "" }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="plan">{(field) => <field.NativeSelect label="Plan" options={options} />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/NativeSelect",
  component: NativeSelectDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof NativeSelectDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Plan")).toBeInTheDocument();
  },
};
