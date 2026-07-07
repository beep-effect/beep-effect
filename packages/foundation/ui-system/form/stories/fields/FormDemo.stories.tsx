import { Form, makeFormOptions, useAppForm } from "@beep/form";
import { withKeyDefaults } from "@beep/schema/SchemaUtils";
import * as S from "effect/Schema";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const ProfileSchema = S.Struct({
  name: withKeyDefaults(S.NonEmptyString, ""),
  age: withKeyDefaults(S.Finite, 18),
  subscribed: withKeyDefaults(S.Boolean, false),
  notifications: withKeyDefaults(S.Boolean, false),
});

/**
 * End-to-end demo: a schema-first form whose fields are bound to `@beep/ui`
 * primitives through `@beep/form`. The schema supplies both validation and the
 * default values.
 */
const ProfileForm = () => {
  const form = useAppForm(
    makeFormOptions({
      schema: ProfileSchema,
      defaultValues: { name: "", age: 18, subscribed: false, notifications: false },
      validateOn: "change",
    })
  );

  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="name">{(field) => <field.Text label="Name" placeholder="Ada Lovelace" />}</form.AppField>
        <form.AppField name="age">{(field) => <field.Number label="Age" />}</form.AppField>
        <form.AppField name="subscribed">{(field) => <field.Checkbox label="Subscribe to updates" />}</form.AppField>
        <form.AppField name="notifications">{(field) => <field.Switch label="Enable notifications" />}</form.AppField>
        <form.Submit>Save</form.Submit>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Demo",
  component: ProfileForm,
  tags: ["autodocs"],
} satisfies Meta<typeof ProfileForm>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Typing into the bound text field updates its value through TanStack's field state.
 */
export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByLabelText("Name");
    return userEvent.type(name, "Grace Hopper").then(() => {
      expect(name).toHaveValue("Grace Hopper");
    });
  },
};
