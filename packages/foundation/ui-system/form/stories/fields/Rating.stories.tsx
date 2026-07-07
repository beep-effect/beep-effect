import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ rating: S.Finite });

/**
 * The `Rating` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const RatingDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { rating: 3 }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="rating">{(field) => <field.Rating label="Rating" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Rating",
  component: RatingDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof RatingDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByLabelText("5 of 5");
    return userEvent.click(option).then(() => {
      expect(option).toHaveAttribute("data-checked");
    });
  },
};
