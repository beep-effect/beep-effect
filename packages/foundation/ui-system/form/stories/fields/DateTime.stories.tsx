import { Form, makeFormOptions, useAppForm } from "@beep/form";
import { DateTimeUtcFromValid } from "@beep/schema/DateTimeUtcFromValid";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const EventSchema = S.Struct({
  startsAt: S.NullOr(S.toType(DateTimeUtcFromValid)),
});

const defaultStartsAt = DateTime.makeUnsafe("2024-02-03T09:30:00.000Z");

/**
 * The `DateTime` field bound through `@beep/form` to the Effect DateTime picker primitive.
 */
const DateTimeDemo = () => {
  const form = useAppForm(
    makeFormOptions({
      schema: EventSchema,
      defaultValues: { startsAt: defaultStartsAt },
      validateOn: "change",
    })
  );

  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="startsAt">{(field) => <field.DateTime label="Starts at" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/DateTime",
  component: DateTimeDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof DateTimeDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByLabelText("Starts at")).toBeInTheDocument();
  },
};
