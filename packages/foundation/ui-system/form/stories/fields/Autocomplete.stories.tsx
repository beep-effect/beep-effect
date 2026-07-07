import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ query: S.String });
const options = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
];

/**
 * The `Autocomplete` field (free-text with suggestions) bound through `@beep/form`.
 */
const AutocompleteDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { query: "" }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="query">{(field) => <field.Autocomplete label="Search" options={options} />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/Autocomplete",
  component: AutocompleteDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof AutocompleteDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Search")).toBeInTheDocument();
  },
};
