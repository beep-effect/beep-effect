import { Form, makeFormOptions, useAppForm } from "@beep/form";
import * as S from "effect/Schema";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const Schema = S.Struct({ avatar: S.Array(S.Unknown) });
const previewSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#f59e0b"/></svg>';

/**
 * The `UploadAvatar` field bound through `@beep/form` to its `@beep/ui` primitive.
 */
const UploadAvatarDemo = () => {
  const form = useAppForm(makeFormOptions({ schema: Schema, defaultValues: { avatar: [] }, validateOn: "change" }));
  return (
    <form.AppForm>
      <Form className="flex w-80 flex-col gap-4" onSubmit={() => form.handleSubmit()}>
        <form.AppField name="avatar">{(field) => <field.UploadAvatar label="Avatar" />}</form.AppField>
      </Form>
    </form.AppForm>
  );
};

const meta = {
  title: "Form/UploadAvatar",
  component: UploadAvatarDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof UploadAvatarDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: /choose image/i })).toBeInTheDocument();
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    if (input === null) {
      return Promise.resolve();
    }
    return userEvent.upload(input, new File([previewSvg], "avatar.svg", { type: "image/svg+xml" })).then(() => {
      expect(canvas.getByAltText("avatar.svg")).toBeInTheDocument();
    });
  },
};
