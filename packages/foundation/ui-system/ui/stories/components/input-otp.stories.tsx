import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@beep/ui/components/input-otp";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps, ReactNode, SyntheticEvent } from "react";

type InputOTPProps = ComponentProps<typeof InputOTP>;

type InputOTPChildrenProps = Extract<InputOTPProps, { children?: ReactNode }>;

type InputOTPControls = Pick<
  InputOTPProps,
  "maxLength" | "pattern" | "disabled" | "containerClassName" | "onComplete" | "id"
>;

const otpProps = (args: Partial<InputOTPControls>): Omit<InputOTPChildrenProps, "children" | "render"> => {
  const { maxLength = 6, pattern, disabled, containerClassName, onComplete, id } = args;
  return {
    maxLength,
    ...(pattern === undefined ? {} : { pattern }),
    ...(disabled === undefined ? {} : { disabled }),
    ...(containerClassName === undefined ? {} : { containerClassName }),
    ...(onComplete === undefined ? {} : { onComplete }),
    ...(id === undefined ? {} : { id }),
  };
};

const preventSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
  event.preventDefault();
};

/**
 * `InputOTP` is an accessible one-time-password / verification-code field built on the
 * `input-otp` primitive. Compose it from sub-parts: wrap one or more `InputOTPGroup`s in
 * `InputOTP`, place an `InputOTPSlot` (with its `index`) per character, and divide groups
 * with `InputOTPSeparator`. A single hidden input drives all slots, so typing, pasting,
 * and caret movement stay in sync. Use `maxLength` to size the code and `pattern` to
 * restrict allowed characters.
 *
 * Imported from `@beep/ui/components/input-otp`.
 */
const meta = {
  title: "Components/Forms/InputOTP",
  component: InputOTP,
  tags: ["autodocs"],
  argTypes: {
    maxLength: {
      control: { type: "number", min: 1, max: 12 },
      description: "Total number of characters the code accepts; must match the slot count.",
    },
    pattern: {
      control: "text",
      description: "Regex string restricting allowed characters (e.g. digits-only).",
    },
    disabled: {
      control: "boolean",
      description: "Disables the field and dims all slots.",
    },
    textAlign: {
      control: "select",
      options: ["left", "center", "right"],
      description: "Alignment of the active caret within the slots.",
      table: { defaultValue: { summary: "left" } },
    },
    containerClassName: {
      control: false,
      description: "Class applied to the slot container wrapping the groups.",
    },
    children: {
      control: false,
      description: "The composed groups, slots, and separators.",
    },
    onComplete: {
      action: "completed",
      description: "Fires with the full value once every slot is filled.",
    },
  },
  args: {
    maxLength: 6,
    onComplete: fn(),
    children: null,
  },
} satisfies Meta<InputOTPChildrenProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A six-digit code split into two groups of three with a separator. Typing fills the slots and fires `onComplete`. */
export const Default: Story = {
  render: (args) => (
    <InputOTP {...otpProps(args)}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");
    expect(input).toBeVisible();
    return userEvent.type(input, "123456").then(() => {
      expect(input).toHaveValue("123456");
      expect(args.onComplete).toHaveBeenCalledWith("123456");
    });
  },
};

/** A single continuous group of six slots with no separator. */
export const SingleGroup: Story = {
  render: (args) => (
    <InputOTP {...otpProps(args)}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
};

/** A shorter four-digit code, common for PIN entry. */
export const FourDigits: Story = {
  args: { maxLength: 4 },
  render: (args) => (
    <InputOTP {...otpProps(args)}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
      </InputOTPGroup>
    </InputOTP>
  ),
};

/** Restricts input to digits via `pattern`; letters are rejected so only the numeric value is kept. */
export const DigitsOnly: Story = {
  args: { maxLength: 6, pattern: "^\\d+$" },
  render: (args) => (
    <InputOTP {...otpProps(args)}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");
    return userEvent.type(input, "12ab34").then(() => {
      expect(input).toHaveValue("1234");
    });
  },
};

/** A disabled field dims all slots and ignores typing. */
export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <InputOTP {...otpProps(args)}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");
    expect(input).toBeDisabled();
    return userEvent.type(input, "123456").then(() => {
      expect(input).toHaveValue("");
      expect(args.onComplete).not.toHaveBeenCalled();
    });
  },
};

/** A realistic verification card: a labeled six-digit code split into two groups with helper text. */
export const VerificationForm: Story = {
  render: (args) => (
    <form className="flex w-full max-w-sm flex-col items-center gap-3" onSubmit={preventSubmit}>
      <label htmlFor="otp-verify" className="text-sm font-medium">
        Enter your verification code
      </label>
      <InputOTP {...otpProps(args)} id="otp-verify">
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
      <p className="text-muted-foreground text-xs">We sent a 6-digit code to your email.</p>
    </form>
  ),
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText("Enter your verification code");
    expect(label).toBeVisible();
    const input = canvas.getByRole("textbox");
    return userEvent.type(input, "246810").then(() => {
      expect(input).toHaveValue("246810");
      expect(args.onComplete).toHaveBeenCalledWith("246810");
    });
  },
};
