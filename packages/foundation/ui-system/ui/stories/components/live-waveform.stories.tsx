import { LiveWaveform } from "@beep/ui/components/live-waveform";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `LiveWaveform` renders idle, processing, and microphone-driven audio states
 * on a canvas. The processing stories exercise its animation without requesting
 * microphone permission, which makes them suitable for deterministic browser QA.
 *
 * Imported from `@beep/ui/components/live-waveform`.
 */
const meta = {
  title: "Components/Data Display/LiveWaveform",
  component: LiveWaveform,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ color: "#2563eb", padding: 24, width: 520 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    active: false,
    barColor: "#2563eb",
    height: 96,
    processing: false,
  },
} satisfies Meta<typeof LiveWaveform>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle state with the dotted baseline and no generated samples. */
export const Idle: Story = {};

/** Symmetric processing animation used before a microphone stream is ready. */
export const ProcessingStatic: Story = {
  args: { processing: true, mode: "static" },
};

/** Right-to-left processing animation in scrolling mode. */
export const ProcessingScrolling: Story = {
  args: { processing: true, mode: "scrolling" },
};
