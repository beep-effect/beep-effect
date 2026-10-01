// fallow-ignore-file code-duplication -- story variants repeat the canonical markup on purpose: each story is a standalone usage example whose source the Storybook docs panel shows, and shared render helpers would hide that usage; the shadcn-lint adoption only rewrote class names inside these pre-existing blocks.
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@beep/ui/components/hover-card";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `HoverCard` is a non-modal preview overlay built on Base UI's preview-card primitive. Compose
 * `HoverCard` (the root that owns open state) with `HoverCardTrigger` (the element that reveals the
 * card on hover or focus) and `HoverCardContent` (the floating popup rendered in a portal). The card
 * opens when the trigger is hovered or focused and closes when the pointer leaves, making it ideal for
 * rich previews like user profiles or link summaries. The root accepts `open`/`defaultOpen` with
 * `onOpenChange` for state, while `HoverCardContent` exposes `side`, `sideOffset`, `align`, and
 * `alignOffset` to tune placement relative to the trigger.
 *
 * Imported from `@beep/ui/components/hover-card`.
 */
const meta = {
  title: "Components/Overlays/HoverCard",
  component: HoverCard,
  tags: ["autodocs"],
  argTypes: {
    open: {
      control: "boolean",
      description: "Controlled open state of the hover card.",
    },
    defaultOpen: {
      control: "boolean",
      description: "Whether the hover card is initially open in uncontrolled mode.",
      table: { defaultValue: { summary: "false" } },
    },
    onOpenChange: {
      control: false,
      description: "Callback fired whenever the open state changes (hover, focus, or dismissal).",
    },
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default hover card with a link trigger and a rich preview popup. The play test hovers the
 * trigger, asserts the preview content becomes visible, and confirms `onOpenChange` fired.
 */
export const Default: Story = {
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger>
        <span className="underline underline-offset-4">@beep</span>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex flex-col gap-1">
          <p className="font-semibold">@beep</p>
          <p className="text-muted-foreground">The effect-first design system powering this workspace.</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText("@beep");
    expect(trigger).toBeVisible();
    return userEvent
      .hover(trigger)
      .then(() => screen.findByText("The effect-first design system powering this workspace."))
      .then((content) => waitFor(() => expect(content).toBeVisible()))
      .then(() => {
        expect(args.onOpenChange).toHaveBeenCalled();
      });
  },
};

/**
 * Renders with `defaultOpen` so the card is visible on first paint without interaction; the play test
 * asserts the preview content is already on screen.
 */
export const DefaultOpen: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger>
        <span className="underline underline-offset-4">Hover me</span>
      </HoverCardTrigger>
      <HoverCardContent>
        <p>This preview opened automatically when the story mounted.</p>
      </HoverCardContent>
    </HoverCard>
  ),
  play: () =>
    waitFor(() => {
      expect(screen.getByText("This preview opened automatically when the story mounted.")).toBeVisible();
    }),
};

/**
 * Moving the pointer away from the trigger dismisses the card. The play test hovers to open it, then
 * unhovers and asserts the preview is removed from the DOM.
 */
export const Dismissal: Story = {
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger>
        <span className="underline underline-offset-4">Preview link</span>
      </HoverCardTrigger>
      <HoverCardContent>
        <p>Move your pointer away to dismiss this preview.</p>
      </HoverCardContent>
    </HoverCard>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText("Preview link");
    return userEvent
      .hover(trigger)
      .then(() => screen.findByText("Move your pointer away to dismiss this preview."))
      .then((content) => waitFor(() => expect(content).toBeVisible()))
      .then(() => userEvent.unhover(trigger))
      .then(() =>
        waitFor(() => {
          expect(screen.queryByText("Move your pointer away to dismiss this preview.")).toBeNull();
        })
      );
  },
};

/**
 * A realistic profile preview composing an avatar, display name, handle, and metadata inside the
 * popup, demonstrating the kind of rich content hover cards are designed for.
 */
export const ProfilePreview: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger>
        <span className="underline underline-offset-4">@ada</span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="flex gap-3">
          <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium">
            AL
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Ada Lovelace</p>
            <p className="text-muted-foreground text-xs">@ada</p>
            <p className="text-sm">Writing the first algorithm and the occasional preview card.</p>
            <p className="text-muted-foreground text-xs">Joined January 2025</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
  play: () =>
    waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeVisible();
      expect(screen.getByText("Joined January 2025")).toBeVisible();
    }),
};

/**
 * Places the popup above the trigger via `side="top"` on `HoverCardContent`, useful when there is more
 * room above the anchor than below it.
 */
export const SideTop: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger>
        <span className="underline underline-offset-4">Top side</span>
      </HoverCardTrigger>
      <HoverCardContent side="top">
        <p>This preview is positioned above the trigger.</p>
      </HoverCardContent>
    </HoverCard>
  ),
};

/**
 * Anchors the popup to the trigger's start edge with extra distance via `align="start"` and an
 * increased `sideOffset` on `HoverCardContent`.
 */
export const AlignStartWithOffset: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger>
        <span className="underline underline-offset-4">Aligned start</span>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={12}>
        <p>Aligned to the start edge with a larger side offset.</p>
      </HoverCardContent>
    </HoverCard>
  ),
};

/**
 * Fully controlled via the `open` prop with `onOpenChange`; the card stays open regardless of hover
 * because the parent owns the state. The play test asserts the forced-open content is visible.
 */
export const Controlled: Story = {
  args: { open: true },
  render: (args) => (
    <HoverCard {...args}>
      <HoverCardTrigger>
        <span className="underline underline-offset-4">Controlled trigger</span>
      </HoverCardTrigger>
      <HoverCardContent>
        <p>This card is held open by the controlled `open` prop.</p>
      </HoverCardContent>
    </HoverCard>
  ),
  play: () =>
    waitFor(() => {
      expect(screen.getByText("This card is held open by the controlled `open` prop.")).toBeVisible();
    }),
};
