import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@beep/ui/components/card";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Card` is a layout surface that groups related content into a bordered, rounded
 * container. It is a compound component: compose `CardHeader`, `CardTitle`,
 * `CardDescription`, `CardAction`, `CardContent`, and `CardFooter` inside a `Card`
 * to build a complete card. The header uses a CSS grid that automatically reserves
 * a trailing column for `CardAction` and stacks the title above the description.
 *
 * The only styling prop on the root is `size`, which switches between the default
 * and a denser `sm` spacing scale (propagated to every sub-part via container data
 * attributes).
 *
 * Imported from `@beep/ui/components/card`.
 */
const meta = {
  title: "Components/Layout/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
      description: "Spacing density applied to the card and all of its sub-parts.",
      table: { defaultValue: { summary: "default" } },
    },
    className: {
      control: "text",
      description: "Additional classes merged onto the root surface (e.g. width constraints).",
    },
    children: {
      control: false,
      description: "Composed card sub-parts (header, content, footer, etc.).",
    },
  },
  args: {
    size: "default",
    className: "w-full max-w-sm",
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The canonical composition: a header with a title, description, and trailing action,
 * a content body, and a footer with primary actions.
 */
export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Login to your account</CardTitle>
        <CardDescription>Enter your email below to login to your account</CardDescription>
        <CardAction>
          <button type="button" className="text-sm underline underline-offset-4">
            Sign Up
          </button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="m@example.com"
              className="border-input rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input id="password" type="password" className="border-input rounded-md border px-3 py-2 text-sm" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col">
        <div className="flex w-full flex-col gap-2">
          <button type="button" className="bg-primary text-primary-foreground w-full rounded-md py-2 text-sm">
            Login
          </button>
        </div>
      </CardFooter>
    </Card>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Login to your account")).toBeVisible();
    expect(canvas.getByText("Enter your email below to login to your account")).toBeVisible();
    expect(canvas.getByRole("button", { name: "Sign Up" })).toBeVisible();
    expect(canvas.getByRole("button", { name: "Login" })).toBeVisible();
  },
};

/** A minimal card with only a header, useful for compact summaries. */
export const HeaderOnly: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>You have 3 unread messages.</CardDescription>
      </CardHeader>
    </Card>
  ),
};

/** A card with body content but no footer, for read-only informational surfaces. */
export const WithContent: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Project status</CardTitle>
        <CardDescription>Current sprint overview.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          All planned work is on track. The deployment pipeline is green and no blockers are open.
        </p>
      </CardContent>
    </Card>
  ),
};

/**
 * A card whose footer carries the primary actions, separated from the body by the
 * footer's top border and muted background.
 */
export const WithFooter: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Create project</CardTitle>
        <CardDescription>Deploy your new project in one click.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Name your project and choose a region to get started.</p>
      </CardContent>
      <CardFooter className="justify-between">
        <button type="button" className="border-input rounded-md border px-3 py-2 text-sm">
          Cancel
        </button>
        <button type="button" className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm">
          Deploy
        </button>
      </CardFooter>
    </Card>
  ),
};

/**
 * `CardAction` slots an interactive control into the header's trailing grid column,
 * vertically aligned with the title and description.
 */
export const WithAction: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Team members</CardTitle>
        <CardDescription>Invite your team to collaborate.</CardDescription>
        <CardAction>
          <button type="button" className="border-input rounded-md border px-3 py-1.5 text-sm">
            Invite
          </button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">3 members currently have access to this workspace.</p>
      </CardContent>
    </Card>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const action = canvas.getByRole("button", { name: "Invite" });
    expect(action).toBeVisible();
    expect(canvas.getByText("Team members")).toBeVisible();
  },
};

/**
 * The `sm` size applies a denser spacing scale to the card and every sub-part, ideal
 * for sidebars and compact dashboards.
 */
export const Small: Story = {
  args: { size: "sm" },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Storage</CardTitle>
        <CardDescription>4.2 GB of 10 GB used</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Upgrade your plan to unlock additional storage.</p>
      </CardContent>
      <CardFooter>
        <button type="button" className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm">
          Upgrade
        </button>
      </CardFooter>
    </Card>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvasElement.querySelector('[data-slot="card"]');
    expect(card).not.toBeNull();
    expect(card).toHaveAttribute("data-size", "sm");
    expect(canvas.getByText("Storage")).toBeVisible();
  },
};
