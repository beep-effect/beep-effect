import { OrbBackground } from "@beep/ui/components/orb-background";
import { expect, within } from "storybook/test";
import type { OrbTone } from "@beep/ui/components/orb-background";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";

/**
 * `OrbBackground` is a purely decorative, theme-aware backdrop of soft, blurred,
 * glowing orbs — the kind of ambient "aurora" glow used behind hero sections and
 * empty states. It fills its nearest positioned ancestor, sits behind content
 * (`-z-10`), ignores pointer events, and is hidden from assistive technology.
 *
 * On dark surfaces the orb layers blend additively (`screen`) for a luminous
 * bloom; on light surfaces they blend normally as a soft tint, so the effect
 * reads well in **both** color schemes — flip the theme toolbar to compare.
 * Orbs fade and scale in once, then drift forever (unless `animated` is `false`
 * or the viewer prefers reduced motion).
 *
 * Place it as the first child of a `relative isolate overflow-hidden` container.
 *
 * Imported from `@beep/ui/components/orb-background`.
 */
const meta = {
  title: "Components/Layout/Orb Background",
  component: OrbBackground,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["green", "emerald", "teal", "sky", "violet", "amber", "rose"],
      description: "Hue family for the glow.",
      table: { defaultValue: { summary: "green" } },
    },
    intensity: {
      control: "inline-radio",
      options: ["subtle", "medium", "vivid"],
      description: "Visual strength — drives per-orb alpha and lightness.",
      table: { defaultValue: { summary: "medium" } },
    },
    animated: {
      control: "boolean",
      description: "Fade in and drift forever, or fade in once and hold still.",
      table: { defaultValue: { summary: "true" } },
    },
  },
  args: {
    tone: "green",
    intensity: "medium",
    animated: true,
  },
} satisfies Meta<typeof OrbBackground>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A framed stage that mimics a real hero surface: a `relative isolate
 * overflow-hidden` panel with the orb backdrop behind centered content. This is
 * exactly how you compose the component in an app.
 */
function Stage({
  children,
  height = 380,
  ...orbProps
}: React.ComponentProps<typeof OrbBackground> & {
  readonly children?: React.ReactNode;
  readonly height?: number;
}) {
  return (
    <div
      className="bg-card text-card-foreground border-border relative isolate flex h-(--stage-height) items-center justify-center overflow-hidden rounded-xl border"
      style={{ "--stage-height": `${height}px` } as React.CSSProperties}
    >
      <OrbBackground {...orbProps} />
      {children}
    </div>
  );
}

function HeroCopy() {
  return (
    <div className="relative z-10 max-w-md px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">One Prompt. One App.</h1>
      <p className="text-muted-foreground mt-2 text-sm">Powered by your workspace.</p>
    </div>
  );
}

/**
 * The default green glow behind hero copy. Toggle the Storybook theme to confirm
 * it reads in both light and dark. The play test asserts the backdrop is
 * decorative (aria-hidden, pointer-events-none) and renders its orb layers.
 */
export const Default: Story = {
  render: (args) => (
    <div className="p-6">
      <Stage {...args}>
        <HeroCopy />
      </Stage>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Decorative: not exposed to the a11y tree, so query the DOM directly.
    const backdrop = canvasElement.querySelector<HTMLElement>('[data-slot="orb-background"]');
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop).toHaveAttribute("data-tone", "green");
    expect(backdrop?.className).toContain("pointer-events-none");
    const orbs = canvasElement.querySelectorAll('[data-slot="orb-background-orb"]');
    expect(orbs.length).toBe(3);
    // Content sits above the backdrop and remains readable.
    expect(canvas.getByRole("heading", { name: "One Prompt. One App." })).toBeVisible();
    return Promise.resolve();
  },
};

/** Every hue family at a glance. Same layout and motion, different base hue. */
export const Tones: Story = {
  render: () => {
    const tones: ReadonlyArray<OrbTone> = ["green", "emerald", "teal", "sky", "violet", "amber", "rose"];
    return (
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {tones.map((tone) => (
          <Stage key={tone} tone={tone} height={200}>
            <span className="bg-background/60 relative z-10 rounded-md px-2 py-1 text-xs font-medium capitalize backdrop-blur-sm">
              {tone}
            </span>
          </Stage>
        ))}
      </div>
    );
  },
};

/** The three intensity steps side by side, from a faint wash to a saturated bloom. */
export const Intensities: Story = {
  render: () => (
    <div className="grid gap-4 p-6 sm:grid-cols-3">
      {(["subtle", "medium", "vivid"] as const).map((intensity) => (
        <Stage key={intensity} intensity={intensity} height={220}>
          <span className="bg-background/60 relative z-10 rounded-md px-2 py-1 text-xs font-medium capitalize backdrop-blur-sm">
            {intensity}
          </span>
        </Stage>
      ))}
    </div>
  ),
};

/**
 * `animated={false}` fades the orbs in once and then holds them still — useful
 * for screenshots, print, or low-power surfaces. (Reduced-motion viewers get
 * this behavior automatically regardless of the prop.)
 */
export const Static: Story = {
  args: { animated: false },
  render: (args) => (
    <div className="p-6">
      <Stage {...args}>
        <HeroCopy />
      </Stage>
    </div>
  ),
  play: ({ canvasElement }) => {
    const orbs = canvasElement.querySelectorAll<HTMLElement>('[data-slot="orb-background-orb"]');
    expect(orbs.length).toBe(3);
    // Every orb opts out of the idle drift; only the one-shot intro is wired up.
    for (const orb of orbs) {
      expect(orb).toHaveAttribute("data-animated", "false");
    }
    return Promise.resolve();
  },
};

/**
 * A full-bleed hero composition showing the component in context with layered
 * content, a CTA, and a vivid glow. This is the "looks good" reference.
 */
export const HeroSection: Story = {
  render: (args) => (
    <div className="p-6">
      <div className="bg-background relative isolate flex min-h-115 flex-col items-center justify-center overflow-hidden rounded-2xl border">
        <OrbBackground {...args} />
        <div className="relative z-10 flex max-w-lg flex-col items-center gap-5 px-6 text-center">
          <span className="border-border bg-background/60 text-muted-foreground rounded-full border px-3 py-1 text-xs backdrop-blur-sm">
            Ambient billing copilot
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            Build, ship, and bill in one continuous flow.
          </h1>
          <p className="text-muted-foreground text-sm text-pretty">
            A glowing, theme-aware backdrop that stays out of the way of your content while adding depth and motion.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium"
            >
              Get started
            </button>
            <button
              type="button"
              className="border-border text-foreground rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Learn more
            </button>
          </div>
        </div>
      </div>
    </div>
  ),
  args: { tone: "green", intensity: "vivid" },
};

/**
 * Live playground — drive `tone`, `intensity`, and `animated` from the Controls
 * panel, and toggle light/dark from the theme toolbar.
 */
export const Playground: Story = {
  render: (args) => (
    <div className="p-6">
      <Stage {...args}>
        <HeroCopy />
      </Stage>
    </div>
  ),
};
