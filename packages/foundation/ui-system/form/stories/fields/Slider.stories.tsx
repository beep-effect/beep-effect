import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ volume: S.Finite });

/**
 * The `Slider` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const SliderDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { volume: 50 }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="volume">{(field) => <field.Slider label="Volume" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Slider",
  component: SliderDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof SliderDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Volume")).toBeInTheDocument();
  },
};
