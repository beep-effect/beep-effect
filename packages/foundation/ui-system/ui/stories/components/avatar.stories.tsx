import { Avatar, AvatarFallback, AvatarImage } from "@beep/ui/components/avatar";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Avatar` is a circular media container for representing a user or entity. It is a
 * compound component: compose `AvatarImage` and `AvatarFallback` inside an `Avatar`
 * root. The image is loaded out of band and only swaps in once it resolves
 * successfully; until then (or on error) the `AvatarFallback` — typically the user's
 * initials — is shown. The root is a `size-10` rounded-full `span`; override `className`
 * to resize or reshape it.
 *
 * Imported from `@beep/ui/components/avatar`.
 */
const meta = {
  title: "Components/Data Display/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description: "Additional classes merged onto the root container (e.g. size or shape overrides).",
    },
    children: {
      control: false,
      description: "Composed avatar sub-parts (`AvatarImage` and/or `AvatarFallback`).",
    },
  },
  args: {
    className: "",
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The canonical composition: an `AvatarImage` with an `AvatarFallback`. The fallback
 * renders until the image source resolves, so a stable two-letter initial is always
 * available.
 */
export const Default: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvasElement.querySelector('[data-slot="avatar"]');
    expect(root).not.toBeNull();
    expect(canvas.getByText("CN")).toBeVisible();
  },
};

/**
 * Without a resolvable image the `AvatarFallback` carries the full presentation —
 * commonly the user's initials over a muted background.
 */
export const Fallback: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fallback = canvasElement.querySelector('[data-slot="avatar-fallback"]');
    expect(fallback).not.toBeNull();
    expect(canvas.getByText("JD")).toBeVisible();
  },
};

/**
 * Pairs an `AvatarImage` with an `AvatarFallback`; the fallback is the resilient
 * default while the image loads asynchronously and on load error.
 */
export const WithImage: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://github.com/evilrabbit.png" alt="@evilrabbit" />
      <AvatarFallback>ER</AvatarFallback>
    </Avatar>
  ),
};

/**
 * When the source fails to load the fallback remains visible, guaranteeing the avatar
 * never renders empty.
 */
export const BrokenImage: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://example.invalid/missing.png" alt="Missing user" />
      <AvatarFallback>MU</AvatarFallback>
    </Avatar>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("MU")).toBeVisible();
  },
};

/**
 * `shape="rounded"` swaps the default circle for a `rounded-lg` square; the fallback
 * follows the root's shape.
 */
export const Rounded: Story = {
  args: { shape: "rounded" },
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
  play: ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-slot="avatar"]');
    expect(root).not.toBeNull();
    expect(root).toHaveClass("rounded-lg");
  },
};

/**
 * `size` picks `sm` (`size-8`), `default` (`size-10`), or `lg` (`size-14`), and the
 * fallback text scales with it; here the three sit side by side to show the spectrum.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar size="sm">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("SM")).toBeVisible();
    expect(canvas.getByText("MD")).toBeVisible();
    expect(canvas.getByText("LG")).toBeVisible();
  },
};

/**
 * Overlap multiple avatars with negative spacing and a ring to build a stacked group,
 * a common pattern for showing collaborators on a resource.
 */
export const Group: Story = {
  render: () => (
    <div className="flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background">
      <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" />
        <AvatarFallback>LR</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://github.com/evilrabbit.png" alt="@evilrabbit" />
        <AvatarFallback>ER</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>+3</AvatarFallback>
      </Avatar>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const roots = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(roots.length).toBe(4);
    expect(canvas.getByText("+3")).toBeVisible();
  },
};
