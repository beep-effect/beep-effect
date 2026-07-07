import { Form, makeFormOptions, useAppForm } from "@beep/form";
import { DateTimeUtcFromValid } from "@beep/schema/DateTimeUtcFromValid";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const ScheduleSchema = S.Struct({
  startDate: S.NullOr(S.toType(DateTimeUtcFromValid)),
});

const defaultStartDate = DateTime.makeUnsafe("2024-02-03T00:00:00.000Z");

/**
 * The `Date` field bound through `@beep/form` to the Effect DateTime picker primitive.
 */
const DateDemo = () => {
  const form = useAppForm(
    makeFormOptions({
      schema: ScheduleSchema,
      defaultValues: { startDate: defaultStartDate },
      validateOn: "change",
    })
  );

  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="startDate">{(field) => <field.Date label="Start date" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Date",
  component: DateDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof DateDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByLabelText("Start date")).toBeInTheDocument();
  },
};
