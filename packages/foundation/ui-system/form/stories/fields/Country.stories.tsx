import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ country: S.NonEmptyString });

/**
 * The `Country` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const CountryDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { country: "US" }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="country">{(field) => <field.Country label="Country" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Country",
  component: CountryDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof CountryDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByLabelText("Country")).toBeInTheDocument();
  },
};
