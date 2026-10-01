import { Button } from "@beep/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@beep/ui/components/item";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Item` is a flexible layout primitive for list rows, cards, and notification surfaces. It is
 * a compound component: wrap content in `ItemContent`, label it with `ItemTitle` and
 * `ItemDescription`, anchor leading media via `ItemMedia` (with `default`, `icon`, or `image`
 * variants), and trail interactive controls with `ItemActions`. Optional `ItemHeader` and
 * `ItemFooter` span the full row. Stack rows inside an `ItemGroup` (a `role="list"` container)
 * and divide them with `ItemSeparator`. The root `Item` supports `render` (Base UI's render
 * prop) to project the styling onto another element, such as a button or anchor.
 *
 * Imported from `@beep/ui/components/item`.
 */
const meta = {
  title: "Components/Layout/Item",
  component: Item,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "muted"],
      description: "Surface treatment of the row: transparent, bordered, or muted fill.",
      table: { defaultValue: { summary: "default" } },
    },
    size: {
      control: "select",
      options: ["default", "sm"],
      description: "Padding and gap density of the row.",
      table: { defaultValue: { summary: "default" } },
    },
    className: {
      control: "text",
      description: "Additional utility classes merged onto the row container.",
    },
    children: {
      control: false,
      description: "Composed parts, e.g. `ItemMedia`, `ItemContent`, and `ItemActions`.",
    },
  },
  args: {
    variant: "default",
    size: "default",
  },
} satisfies Meta<typeof Item>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default row: a title, description, and a trailing action. Clicking the action fires `onClick`. */
export const Default: Story = {
  render: (args) => (
    <Item {...args} className="w-full max-w-md">
      <ItemContent>
        <ItemTitle>Basic Item</ItemTitle>
        <ItemDescription>A simple item with a title and a description.</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" size="sm" onClick={fn()}>
          Action
        </Button>
      </ItemActions>
    </Item>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByText("Basic Item");
    expect(row).toBeVisible();
    const action = canvas.getByRole("button", { name: "Action" });
    return userEvent.click(action).then(() => {
      expect(action).toHaveAttribute("data-slot", "button");
    });
  },
};

/** Bordered surface for standalone rows that need a visible boundary. */
export const Outline: Story = {
  args: { variant: "outline" },
  render: (args) => (
    <Item {...args} className="w-full max-w-md">
      <ItemContent>
        <ItemTitle>Outline Item</ItemTitle>
        <ItemDescription>A bordered row that reads as a discrete card.</ItemDescription>
      </ItemContent>
    </Item>
  ),
};

/** Muted fill that recedes into the background while keeping content legible. */
export const Muted: Story = {
  args: { variant: "muted" },
  render: (args) => (
    <Item {...args} className="w-full max-w-md">
      <ItemContent>
        <ItemTitle>Muted Item</ItemTitle>
        <ItemDescription>A subtly filled row for secondary content.</ItemDescription>
      </ItemContent>
    </Item>
  ),
};

/** The small size tightens padding and gap for dense lists. */
export const Small: Story = {
  args: { variant: "outline", size: "sm" },
  render: (args) => (
    <Item {...args} className="w-full max-w-md">
      <ItemContent>
        <ItemTitle>Compact Item</ItemTitle>
        <ItemDescription>Reduced padding suits dense, scannable lists.</ItemDescription>
      </ItemContent>
    </Item>
  ),
};

/** An `ItemMedia` with the `icon` variant frames a leading glyph in a bordered tile. */
export const WithIconMedia: Story = {
  args: { variant: "outline" },
  render: (args) => (
    <Item {...args} className="w-full max-w-md">
      <ItemMedia variant="icon">@</ItemMedia>
      <ItemContent>
        <ItemTitle>Profile verified</ItemTitle>
        <ItemDescription>Your account has been verified successfully.</ItemDescription>
      </ItemContent>
    </Item>
  ),
};

/** An `ItemMedia` with the `image` variant clips a leading thumbnail into a rounded square. */
export const WithImageMedia: Story = {
  args: { variant: "outline" },
  render: (args) => (
    <Item {...args} className="w-full max-w-md">
      <ItemMedia variant="image">
        <img src="https://placehold.co/40x40/png" alt="Album cover" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Midnight Drive</ItemTitle>
        <ItemDescription>The Synthwave Collective · 2025</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="ghost" size="icon-sm" aria-label="Play track">
          ▶
        </Button>
      </ItemActions>
    </Item>
  ),
};

/** A trailing `ItemActions` cluster pairs a confirm and dismiss action. Clicking confirm fires `onClick`. */
export const WithActions: Story = {
  args: { variant: "outline" },
  render: (args) => (
    <Item {...args} className="w-full max-w-md">
      <ItemContent>
        <ItemTitle>Invitation pending</ItemTitle>
        <ItemDescription>Avery invited you to the Platform team.</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="ghost" size="sm">
          Decline
        </Button>
        <Button size="sm" onClick={fn()}>
          Accept
        </Button>
      </ItemActions>
    </Item>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const decline = canvas.getByRole("button", { name: "Decline" });
    const accept = canvas.getByRole("button", { name: "Accept" });
    expect(decline).toBeVisible();
    expect(accept).toBeVisible();
    return userEvent.click(accept).then(() => {
      expect(accept).toHaveAttribute("data-slot", "button");
    });
  },
};

/** `ItemHeader` and `ItemFooter` span the full row to frame the content with metadata. */
export const WithHeaderAndFooter: Story = {
  args: { variant: "outline" },
  render: (args) => (
    <Item {...args} className="w-full max-w-md flex-col items-stretch">
      <ItemHeader>
        <ItemTitle>Deployment</ItemTitle>
        <ItemDescription>2m ago</ItemDescription>
      </ItemHeader>
      <ItemContent>
        <ItemDescription>Build succeeded and was promoted to production.</ItemDescription>
      </ItemContent>
      <ItemFooter>
        <ItemDescription>main · a1b2c3d</ItemDescription>
        <Button variant="ghost" size="sm">
          View logs
        </Button>
      </ItemFooter>
    </Item>
  ),
};

/**
 * The root `render` prop projects the row styling onto a `button`, making the whole row a single
 * interactive control. Clicking anywhere on the row fires the button's `onClick`.
 */
export const AsButton: Story = {
  args: { variant: "outline", size: "sm" },
  render: (args) => (
    <Item {...args} className="w-full max-w-md text-left" render={<button type="button" onClick={fn()} />}>
      <ItemMedia variant="icon">@</ItemMedia>
      <ItemContent>
        <ItemTitle>Read the documentation</ItemTitle>
      </ItemContent>
      <ItemActions>›</ItemActions>
    </Item>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole("button", { name: /Read the documentation/ });
    expect(row).toBeVisible();
    return userEvent.click(row).then(() => {
      expect(row).toHaveAttribute("data-slot", "item");
    });
  },
};

/** A realistic `ItemGroup` list of rows divided by `ItemSeparator`, exposed as `role="list"`. */
export const Group: Story = {
  render: () => (
    <div className="w-full max-w-md rounded-md border">
      <ItemGroup>
        <Item>
          <ItemMedia variant="icon">A</ItemMedia>
          <ItemContent>
            <ItemTitle>Avery Diaz</ItemTitle>
            <ItemDescription>avery@beep.dev</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="sm">
              Message
            </Button>
          </ItemActions>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemMedia variant="icon">B</ItemMedia>
          <ItemContent>
            <ItemTitle>Blake Nguyen</ItemTitle>
            <ItemDescription>blake@beep.dev</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="sm">
              Message
            </Button>
          </ItemActions>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemMedia variant="icon">C</ItemMedia>
          <ItemContent>
            <ItemTitle>Casey Romero</ItemTitle>
            <ItemDescription>casey@beep.dev</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="sm">
              Message
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("list");
    expect(list).toBeVisible();
    expect(canvas.getByText("Avery Diaz")).toBeVisible();
    expect(canvas.getByText("Casey Romero")).toBeVisible();
    return Promise.resolve();
  },
};
