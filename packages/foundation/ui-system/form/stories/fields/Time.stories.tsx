import { Form, makeFormOptions, useAppForm } from "@beep/form";
import { DateTimeUtcFromValid } from "@beep/schema/DateTimeUtcFromValid";
import * as DateTime from "effect/DateTime";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const ReminderSchema = S.Struct({
  reminderTime: DateTimeUtcFromValid.pipe(S.toType, S.NullOr),
});

const defaultReminderTime = DateTime.makeUnsafe("2024-02-03T14:15:00.000Z");

/**
 * The `Time` field bound through `@beep/form` to the Effect DateTime picker primitive.
 */
const TimeDemo = () => {
  const form = useAppForm(
    makeFormOptions({
      schema: ReminderSchema,
      defaultValues: { reminderTime: defaultReminderTime },
      validateOn: "change",
    })
  );

  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="reminderTime">{(field) => <field.Time label="Reminder time" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Time",
  component: TimeDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof TimeDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByLabelText("Reminder time")).toBeInTheDocument();
  },
};
