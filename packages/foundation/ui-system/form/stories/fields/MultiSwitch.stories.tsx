import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ channels: S.Array(S.String) });
const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

/**
 * The `MultiSwitch` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const MultiSwitchDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { channels: [] }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="channels">
          {(field) => <field.MultiSwitch label="Channels" options={options} />}
        </form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/MultiSwitch",
  component: MultiSwitchDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof MultiSwitchDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Channels")).toBeInTheDocument();
  },
};
