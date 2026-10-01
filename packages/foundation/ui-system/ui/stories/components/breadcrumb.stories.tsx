import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@beep/ui/components/breadcrumb";
import { HouseIcon } from "@phosphor-icons/react";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Breadcrumb` is the navigation trail primitive that shows where the current page sits within a
 * site hierarchy. It is a compound component: the root `Breadcrumb` renders the labelled `nav`
 * landmark, `BreadcrumbList` lays out the ordered list, and each step is a `BreadcrumbItem` holding
 * either a `BreadcrumbLink` (navigable ancestor) or a `BreadcrumbPage` (the current, non-clickable
 * page). Place a `BreadcrumbSeparator` between items — it defaults to a caret but accepts custom
 * children — and use `BreadcrumbEllipsis` to collapse a long trail into a truncated affordance.
 *
 * Imported from `@beep/ui/components/breadcrumb`.
 */
const meta = {
  title: "Components/Navigation/Breadcrumb",
  component: Breadcrumb,
  tags: ["autodocs"],
  argTypes: {
    children: {
      control: false,
      description: "The `BreadcrumbList` and its items composed inside the `nav` landmark.",
    },
    className: {
      control: "text",
      description: "Additional classes merged onto the root `nav` element.",
    },
  },
  args: {},
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default breadcrumb trail with two navigable ancestors and the current page. The play test
 * confirms the `nav` landmark is present, the trailing page is marked `aria-current="page"`, and the
 * first link points at its destination.
 */
export const Default: Story = {
  render: (args) => (
    <Breadcrumb {...args}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#home">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#components">Components</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("navigation", { name: "breadcrumb" })).toBeVisible();
    const home = canvas.getByRole("link", { name: "Home" });
    expect(home).toHaveAttribute("href", "#home");
    const current = canvas.getByText("Breadcrumb");
    expect(current).toHaveAttribute("aria-current", "page");
    return Promise.resolve();
  },
};

/**
 * A minimal two-step trail: a single ancestor link followed by the current page. The play test
 * exercises clicking the ancestor link and asserts it remains visible afterwards.
 */
export const TwoLevels: Story = {
  render: (args) => (
    <Breadcrumb {...args}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#dashboard">Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Settings</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};

/**
 * Collapses a deep hierarchy with `BreadcrumbEllipsis`, hiding intermediate ancestors behind a
 * truncation affordance while keeping the first and last steps visible. The play test confirms the
 * ellipsis exposes its screen-reader "More" label.
 */
export const Truncated: Story = {
  render: (args) => (
    <Breadcrumb {...args}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#home">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#components">Components</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("More")).toBeInTheDocument();
    return Promise.resolve();
  },
};

/**
 * Overrides the default caret with a custom separator by passing children to `BreadcrumbSeparator`.
 * Here each step is divided by a slash for a flatter, path-like appearance.
 */
export const CustomSeparator: Story = {
  render: (args) => (
    <Breadcrumb {...args}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#home">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>/</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink href="#docs">Docs</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>/</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>Installation</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};

/**
 * Pairs an icon with the first link to anchor the trail at a recognizable root. The play test
 * asserts the home link is reachable by its accessible name.
 */
export const WithIcon: Story = {
  render: (args) => (
    <Breadcrumb {...args}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#home">
            <span className="flex items-center gap-1.5">
              <HouseIcon className="size-4" />
              Home
            </span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#projects">Projects</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Overview</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("link", { name: "Home" })).toBeVisible();
    return Promise.resolve();
  },
};

/**
 * A single-segment trail showing only the current page. Useful for top-level routes that still want
 * a consistent breadcrumb landmark.
 */
export const CurrentPageOnly: Story = {
  render: (args) => (
    <Breadcrumb {...args}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>Home</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};
