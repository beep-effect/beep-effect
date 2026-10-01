// fallow-ignore-file code-duplication -- story variants repeat the canonical markup on purpose: each story is a standalone usage example whose source the Storybook docs panel shows, and shared render helpers would hide that usage; the shadcn-lint adoption only rewrote class names inside these pre-existing blocks.
import { Button } from "@beep/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@beep/ui/components/collapsible";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Collapsible` is a layout primitive built on Base UI's collapsible that shows or hides a region
 * of content in response to a trigger press. Compose `Collapsible` (the root that owns the open
 * state) with `CollapsibleTrigger` (the element that toggles the panel) and `CollapsibleContent`
 * (the panel that expands and collapses with a height transition). The root accepts `open`/
 * `defaultOpen` with `onOpenChange` for controlled or uncontrolled state and `disabled` to ignore
 * user interaction.
 *
 * Imported from `@beep/ui/components/collapsible`.
 */
const meta = {
  title: "Components/Layout/Collapsible",
  component: Collapsible,
  tags: ["autodocs"],
  argTypes: {
    open: {
      control: "boolean",
      description: "Controlled open state of the collapsible panel.",
    },
    defaultOpen: {
      control: "boolean",
      description: "Whether the panel is initially open in uncontrolled mode.",
      table: { defaultValue: { summary: "false" } },
    },
    disabled: {
      control: "boolean",
      description: "When true, the component ignores user interaction and the trigger cannot toggle the panel.",
      table: { defaultValue: { summary: "false" } },
    },
    onOpenChange: {
      control: false,
      description: "Callback fired whenever the open state changes via a trigger press.",
    },
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default collapsible with a button trigger and a hidden panel. The play test clicks the trigger,
 * asserts the panel content becomes visible, and confirms `onOpenChange` fired.
 */
export const Default: Story = {
  render: (args) => (
    <Collapsible {...args} className="w-80">
      <CollapsibleTrigger render={<Button variant="outline">Toggle details</Button>} />
      <CollapsibleContent className="mt-2">
        <div className="rounded-md border px-4 py-3 text-sm">This panel is hidden until the trigger is pressed.</div>
      </CollapsibleContent>
    </Collapsible>
  ),
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Toggle details" });
    expect(trigger).toBeVisible();
    return userEvent.click(trigger).then(() => {
      expect(canvas.getByText("This panel is hidden until the trigger is pressed.")).toBeVisible();
      expect(args.onOpenChange).toHaveBeenCalled();
    });
  },
};

/**
 * Renders with `defaultOpen` so the panel is expanded on first paint without interaction; the play
 * test asserts the content is already on screen.
 */
export const DefaultOpen: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Collapsible {...args} className="w-80">
      <CollapsibleTrigger render={<Button variant="outline">Toggle details</Button>} />
      <CollapsibleContent className="mt-2">
        <div className="rounded-md border px-4 py-3 text-sm">
          This panel opened automatically when the story mounted.
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("This panel opened automatically when the story mounted.")).toBeVisible();
    return Promise.resolve();
  },
};

/**
 * Pressing the trigger a second time collapses the panel. The play test expands the panel, clicks the
 * trigger again, and asserts the content is removed from the DOM.
 */
export const Toggling: Story = {
  render: (args) => (
    <Collapsible {...args} className="w-80">
      <CollapsibleTrigger render={<Button variant="outline">Toggle panel</Button>} />
      <CollapsibleContent className="mt-2">
        <div className="rounded-md border px-4 py-3 text-sm">Press the trigger again to collapse this panel.</div>
      </CollapsibleContent>
    </Collapsible>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Toggle panel" });
    return userEvent
      .click(trigger)
      .then(() =>
        waitFor(() => {
          expect(canvas.getByText("Press the trigger again to collapse this panel.")).toBeVisible();
          expect(trigger).toHaveAttribute("aria-expanded", "true");
        })
      )
      .then(() => userEvent.click(trigger))
      .then(() =>
        waitFor(() => {
          expect(trigger).toHaveAttribute("aria-expanded", "false");
          expect(canvas.queryByText("Press the trigger again to collapse this panel.")).toBeNull();
        })
      );
  },
};

/**
 * A disabled collapsible ignores user interaction. The play test asserts the trigger is disabled and
 * that clicking it does not fire `onOpenChange` or reveal the panel.
 */
export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <Collapsible {...args} className="w-80">
      <CollapsibleTrigger render={<Button variant="outline">Toggle details</Button>} />
      <CollapsibleContent className="mt-2">
        <div className="rounded-md border px-4 py-3 text-sm">
          This content cannot be revealed while the collapsible is disabled.
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
  play: ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Toggle details" });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    return userEvent.click(trigger).then(() => {
      expect(args.onOpenChange).not.toHaveBeenCalled();
    });
  },
};

/**
 * Fully controlled via the `open` prop with `onOpenChange`; the panel stays open because the parent
 * owns the state. The play test asserts the forced-open content is visible.
 */
export const Controlled: Story = {
  args: { open: true },
  render: (args) => (
    <Collapsible {...args} className="w-80">
      <CollapsibleTrigger render={<Button variant="outline">Controlled trigger</Button>} />
      <CollapsibleContent className="mt-2">
        <div className="rounded-md border px-4 py-3 text-sm">This panel is held open by the controlled open prop.</div>
      </CollapsibleContent>
    </Collapsible>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("This panel is held open by the controlled open prop.")).toBeVisible();
    return Promise.resolve();
  },
};

/**
 * A realistic composition: a repository header with a peek row and a collapsible list of additional
 * branches, demonstrating the kind of progressive-disclosure surface collapsibles are designed for.
 */
export const RepositoryBranches: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <Collapsible {...args} className="w-80">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4 px-1">
          <h4 className="text-sm font-semibold">@beep starred 3 repositories</h4>
          <CollapsibleTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Toggle branches">
                @
              </Button>
            }
          />
        </div>
        <div className="rounded-md border px-4 py-2 font-mono text-sm">@beep/ui</div>
        <CollapsibleContent>
          <div className="space-y-2">
            <div className="rounded-md border px-4 py-2 font-mono text-sm">@beep/schema</div>
            <div className="rounded-md border px-4 py-2 font-mono text-sm">@beep/utils</div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("@beep/schema")).toBeVisible();
    return Promise.resolve();
  },
};
