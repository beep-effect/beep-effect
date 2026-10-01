import { Orb } from "@beep/ui/components/orb";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Orb` is an animated WebGL sphere built on `@react-three/fiber`. It renders a soft,
 * gradient-lit orb whose motion responds to an optional `agentState`
 * (`thinking` / `listening` / `talking`) and to input/output volume levels. Supply a
 * fixed `seed` for deterministic motion and a `colors` tuple to theme the gradient.
 *
 * Imported from `@beep/ui/components/orb`.
 */
const meta = {
  title: "Components/Data Display/Orb",
  component: Orb,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="size-80">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    agentState: {
      control: "select",
      options: [null, "thinking", "listening", "talking"],
      description: "Drives the orb's animation in auto volume mode.",
      table: { defaultValue: { summary: "null" } },
    },
    volumeMode: {
      control: "inline-radio",
      options: ["auto", "manual"],
      description: "Whether volume is derived automatically or supplied manually.",
      table: { defaultValue: { summary: "auto" } },
    },
    seed: {
      control: "number",
      description: "Deterministic seed for the orb's noise offsets.",
    },
    resizeDebounce: {
      control: "number",
      description: "Debounce in milliseconds for canvas resize handling.",
      table: { defaultValue: { summary: "100" } },
    },
  },
  args: {
    seed: 42,
    agentState: null,
    volumeMode: "auto",
    colors: ["#CADCFC", "#A0B9D1"],
  },
} satisfies Meta<typeof Orb>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default idle orb with the standard blue gradient and a fixed seed for stable rendering. */
export const Default: Story = {};

/** Listening state: the orb pulses inward to reflect incoming audio. */
export const Listening: Story = {
  args: { agentState: "listening" },
};

/** Talking state: the orb animates more energetically for outgoing speech. */
export const Talking: Story = {
  args: { agentState: "talking" },
};

/** Manual volume mode driven by explicit input/output levels instead of `agentState`. */
export const ManualVolume: Story = {
  args: { volumeMode: "manual", manualInput: 0.6, manualOutput: 0.8 },
};

/** A warm custom gradient supplied via the `colors` tuple. */
export const CustomColors: Story = {
  args: { colors: ["#FCD3A0", "#D19A6B"] },
};
