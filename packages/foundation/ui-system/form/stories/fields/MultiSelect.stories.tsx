import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ tags: S.Array(S.String) });
const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

/**
 * The `MultiSelect` field (multiple selection with chips) bound through `@beep/form`.
 */
const MultiSelectDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { tags: [] }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="tags">{(field) => <field.MultiSelect label="Tags" options={options} />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/MultiSelect",
  component: MultiSelectDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof MultiSelectDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Tags")).toBeInTheDocument();
  },
};
