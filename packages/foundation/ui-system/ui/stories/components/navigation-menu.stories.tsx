// fallow-ignore-file code-duplication -- pre-existing story clones on main: the diff-attributed audit charges them to this change because its edited lines fall inside the clone ranges. Story variants repeat the canonical markup on purpose (the Storybook docs panel shows each story's source; shared render helpers would hide that usage). Review by 2026-12-31.
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@beep/ui/components/navigation-menu";
import { A } from "@beep/utils";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const components: ReadonlyArray<{ readonly title: string; readonly description: string }> = [
  { title: "Alert Dialog", description: "A modal dialog that interrupts the user with important content." },
  { title: "Hover Card", description: "For sighted users to preview content available behind a link." },
  { title: "Progress", description: "Displays an indicator showing the completion progress of a task." },
  { title: "Scroll Area", description: "Visually or semantically separates content." },
];

const overview: ReadonlyArray<{ readonly title: string; readonly href: string }> = [
  { title: "Introduction", href: "#introduction" },
  { title: "Installation", href: "#installation" },
  { title: "Typography", href: "#typography" },
];

/**
 * `NavigationMenu` is a horizontal site navigation bar built on Base UI's navigation menu primitive.
 * Compose `NavigationMenu` (the root, which also renders the floating popup viewport internally) with a
 * single `NavigationMenuList` containing one `NavigationMenuItem` per top-level entry. Inside each item use
 * either a `NavigationMenuTrigger` (a button with an animated caret) paired with `NavigationMenuContent`
 * (the panel revealed on hover/click) for dropdown sections, or a `NavigationMenuLink` for a plain
 * top-level link. `NavigationMenuLink` is also used for the individual links rendered inside a content panel.
 *
 * Imported from `@beep/ui/components/navigation-menu`.
 */
const meta = {
  title: "Components/Navigation/NavigationMenu",
  component: NavigationMenu,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
      description: "Orientation of the navigation menu for arrow-key navigation between items.",
      table: { defaultValue: { summary: "horizontal" } },
    },
    delay: {
      control: "number",
      description: "How long to wait before opening the navigation popup, in milliseconds.",
      table: { defaultValue: { summary: "50" } },
    },
    closeDelay: {
      control: "number",
      description: "How long to wait before closing the navigation popup, in milliseconds.",
      table: { defaultValue: { summary: "50" } },
    },
    defaultValue: {
      control: false,
      description: "The uncontrolled value of the item that should be initially open.",
    },
    value: {
      control: false,
      description: "The controlled value of the item that should be open. When nullish, the menu is closed.",
    },
    onValueChange: {
      control: false,
      description: "Called when the open item value changes.",
    },
  },
  args: {
    delay: 0,
    closeDelay: 0,
  },
} satisfies Meta<typeof NavigationMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default navigation bar with a trigger that reveals a panel of component links. The play test
 * clicks the trigger and asserts the popup reveals its links.
 */
export const Default: Story = {
  render: (args) => (
    <NavigationMenu {...args}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Components</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-100 gap-2 p-2 md:grid-cols-2">
              {A.map(components, (component) => (
                <li key={component.title}>
                  <NavigationMenuLink href="#">
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-sm leading-none">{component.title}</div>
                      <p className="text-muted-foreground text-sm leading-snug">{component.description}</p>
                    </div>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Components/ });
    expect(trigger).toBeVisible();
    return userEvent
      .click(trigger)
      .then(() =>
        screen.findByRole("link", { name: /Alert Dialog/ }).then((link) => waitFor(() => expect(link).toBeVisible()))
      );
  },
};

/**
 * A plain top-level link rendered with `NavigationMenuLink` directly (no trigger or popup). The play
 * test asserts the link is rendered and points at its destination.
 */
export const TopLevelLink: Story = {
  render: (args) => (
    <NavigationMenu {...args}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink href="#docs">Documentation</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Documentation" });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute("href", "#docs");
  },
};

/**
 * A content panel composed as a simple list of section links. The play test opens the panel and
 * asserts the first nested link renders.
 */
export const SimpleListContent: Story = {
  render: (args) => (
    <NavigationMenu {...args}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Getting Started</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-50 gap-1 p-2">
              {A.map(overview, (entry) => (
                <li key={entry.title}>
                  <NavigationMenuLink href={entry.href}>{entry.title}</NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Getting Started/ });
    return userEvent.click(trigger).then(() =>
      screen.findByRole("link", { name: "Introduction" }).then((link) =>
        waitFor(() => {
          expect(link).toBeVisible();
          expect(link).toHaveAttribute("href", "#introduction");
        })
      )
    );
  },
};

/**
 * Hovering a trigger opens its panel without a click, the primary interaction for navigation menus.
 * The play test hovers the trigger and asserts the panel content appears.
 */
export const OpensOnHover: Story = {
  render: (args) => (
    <NavigationMenu {...args}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-50 gap-1 p-2">
              <li>
                <NavigationMenuLink href="#blog">Blog</NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink href="#guides">Guides</NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Resources/ });
    return userEvent
      .hover(trigger)
      .then(() =>
        screen.findByRole("link", { name: "Guides" }).then((link) => waitFor(() => expect(link).toBeVisible()))
      );
  },
};

/**
 * The vertical orientation stacks the list items for use in a sidebar. The play test opens the trigger
 * and asserts the panel content renders.
 */
export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <NavigationMenu {...args}>
      <NavigationMenuList className="flex-col items-stretch">
        <NavigationMenuItem>
          <NavigationMenuTrigger>Account</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-50 gap-1 p-2">
              <li>
                <NavigationMenuLink href="#profile">Profile</NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink href="#billing">Billing</NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#settings">Settings</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Account/ });
    return userEvent
      .click(trigger)
      .then(() =>
        screen.findByRole("link", { name: "Billing" }).then((link) => waitFor(() => expect(link).toBeVisible()))
      );
  },
};

/**
 * A complete navigation bar combining a rich component grid, a simple list panel, and a plain
 * top-level link across several items. The play test opens the Components panel and asserts a featured
 * link renders.
 */
export const FullComposition: Story = {
  render: (args) => (
    <NavigationMenu {...args}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Getting Started</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-50 gap-1 p-2">
              {A.map(overview, (entry) => (
                <li key={entry.title}>
                  <NavigationMenuLink href={entry.href}>{entry.title}</NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Components</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-100 gap-2 p-2 md:grid-cols-2">
              {A.map(components, (component) => (
                <li key={component.title}>
                  <NavigationMenuLink href="#">
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-sm leading-none">{component.title}</div>
                      <p className="text-muted-foreground text-sm leading-snug">{component.description}</p>
                    </div>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#docs">Documentation</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Components/ });
    return userEvent
      .click(trigger)
      .then(() =>
        screen.findByRole("link", { name: /Hover Card/ }).then((link) => waitFor(() => expect(link).toBeVisible()))
      );
  },
};
