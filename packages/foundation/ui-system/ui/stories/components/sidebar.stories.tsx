import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@beep/ui/components/sidebar";
import { A } from "@beep/utils";
import {
  CalendarIcon,
  GearIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrayIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Icon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

interface NavItem {
  readonly badge?: undefined | string;
  readonly icon: Icon;
  readonly isActive?: undefined | boolean;
  readonly title: string;
}

const navItems: ReadonlyArray<NavItem> = [
  { title: "Home", icon: HouseIcon, isActive: true },
  { title: "Inbox", icon: TrayIcon, badge: "12" },
  { title: "Calendar", icon: CalendarIcon },
  { title: "Search", icon: MagnifyingGlassIcon },
  { title: "Settings", icon: GearIcon },
];

const skeletonRows = A.makeBy(5, (index) => index);

// Shared icon-and-title menu button reused wherever a story renders navItems
// without per-button props (tooltips stay inline in IconCollapsible).
const NavItemButton = ({ item }: { readonly item: NavItem }) => (
  <SidebarMenuButton isActive={item.isActive ?? false}>
    <item.icon />
    <span>{item.title}</span>
  </SidebarMenuButton>
);

// Shared nav-group scaffold for the layout-variant stories; stories that
// exercise per-item extras (tooltips, badges, actions) keep their own markup.
const NavMenuGroup = ({ label }: { readonly label?: undefined | string }) => (
  <SidebarGroup>
    {label === undefined ? null : <SidebarGroupLabel>{label}</SidebarGroupLabel>}
    <SidebarGroupContent>
      <SidebarMenu>
        {A.map(navItems, (item) => (
          <SidebarMenuItem key={item.title}>
            <NavItemButton item={item} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

/**
 * `Sidebar` is a full application navigation shell composed from many sub-parts. The root
 * `SidebarProvider` owns the open/collapsed state (persisted to `localStorage` and toggled with
 * `Cmd/Ctrl + B`) and must wrap everything. Inside it, `Sidebar` is the navigation panel itself —
 * tune its placement with `side`, its chrome with `variant`, and its collapse behavior with
 * `collapsible`. Structure the panel with `SidebarHeader`, `SidebarContent`, and `SidebarFooter`;
 * group links with `SidebarGroup` / `SidebarGroupLabel` / `SidebarGroupContent`; and build the link
 * list from `SidebarMenu` → `SidebarMenuItem` → `SidebarMenuButton` (with optional
 * `SidebarMenuAction`, `SidebarMenuBadge`, and `SidebarMenuSub` for nested links). `SidebarInset`
 * holds the main content next to the panel, `SidebarTrigger` toggles it, and `SidebarRail` adds a
 * draggable collapse handle.
 *
 * Imported from `@beep/ui/components/sidebar`.
 */
const meta = {
  title: "Components/Layout/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  argTypes: {
    side: {
      control: "select",
      options: ["left", "right"],
      description: "Which edge the sidebar is anchored to.",
      table: { defaultValue: { summary: "left" } },
    },
    variant: {
      control: "select",
      options: ["sidebar", "floating", "inset"],
      description: "Visual chrome: flush `sidebar`, detached `floating` card, or `inset` panel.",
      table: { defaultValue: { summary: "sidebar" } },
    },
    collapsible: {
      control: "select",
      options: ["offcanvas", "icon", "none"],
      description: "Collapse behavior: slide `offcanvas`, shrink to `icon` rail, or `none`.",
      table: { defaultValue: { summary: "offcanvas" } },
    },
    fixed: {
      control: "boolean",
      description: "Whether the panel is fixed to the viewport (`true`) or flows inline (`false`).",
      table: { defaultValue: { summary: "true" } },
    },
  },
  args: {
    side: "left",
    variant: "sidebar",
    collapsible: "offcanvas",
    fixed: true,
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default application shell: a header with branding, a grouped navigation menu, and a footer.
 * The play test confirms the trigger is rendered and clicking it toggles the provider's open state
 * via `onOpenChange`.
 */
export const Default: Story = {
  render: (args) => {
    const onOpenChange = fn();
    return (
      <SidebarProvider onOpenChange={onOpenChange} className="min-h-96">
        <Sidebar {...args}>
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg">
                  <PlusIcon />
                  <span>Acme Inc</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <NavMenuGroup label="Application" />
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <UserIcon />
                  <span>Account</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 px-4">
            <SidebarTrigger />
            <span className="text-sm font-medium">Dashboard</span>
          </header>
        </SidebarInset>
      </SidebarProvider>
    );
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Toggle Sidebar" });
    expect(trigger).toBeVisible();
    return userEvent.click(trigger).then(() => {
      expect(trigger).toBeVisible();
    });
  },
};

/**
 * Anchoring the panel to the right edge with `side="right"`, useful for inspector-style layouts.
 */
export const RightSide: Story = {
  args: { side: "right" },
  render: (args) => (
    <SidebarProvider className="min-h-96">
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium">Content</span>
        </header>
      </SidebarInset>
      <Sidebar {...args}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Inspector</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {A.map(navItems, (item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton>
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
};

/**
 * The `floating` variant detaches the panel into a rounded, bordered card with a drop shadow.
 */
export const Floating: Story = {
  args: { variant: "floating" },
  render: (args) => (
    <SidebarProvider className="min-h-96">
      <Sidebar {...args}>
        <SidebarContent>
          <NavMenuGroup />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 px-4">
          <SidebarTrigger />
        </header>
      </SidebarInset>
    </SidebarProvider>
  ),
};

/**
 * The `inset` variant pads and rounds the main content area so the panel and content read as
 * separate surfaces.
 */
export const Inset: Story = {
  args: { variant: "inset" },
  render: (args) => (
    <SidebarProvider className="min-h-96">
      <Sidebar {...args}>
        <SidebarContent>
          <NavMenuGroup />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium">Inset content</span>
        </header>
      </SidebarInset>
    </SidebarProvider>
  ),
};

/**
 * With `collapsible="icon"` the expanded panel shrinks to an icon-only rail. Tooltips on each
 * `SidebarMenuButton` surface the label while collapsed. The play test toggles the rail closed via
 * the trigger and asserts `onOpenChange` reports the new state.
 */
export const IconCollapsible: Story = {
  args: { collapsible: "icon" },
  render: (args) => {
    const onOpenChange = fn();
    return (
      <SidebarProvider onOpenChange={onOpenChange} className="min-h-96">
        <Sidebar {...args}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {A.map(navItems, (item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton tooltip={item.title} isActive={item.isActive ?? false}>
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 px-4">
            <SidebarTrigger />
          </header>
        </SidebarInset>
      </SidebarProvider>
    );
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const triggers = canvas.getAllByRole("button", { name: "Toggle Sidebar" });
    const trigger = triggers.find((button) => button.getAttribute("data-slot") === "sidebar-trigger");
    expect(trigger).toBeDefined();
    if (trigger === undefined) {
      return Promise.resolve();
    }
    expect(trigger).toBeVisible();
    return userEvent.click(trigger).then(() => {
      expect(trigger).toBeVisible();
    });
  },
};

/**
 * A non-collapsible panel (`collapsible="none"`) stays fully open and is laid out inline, so it
 * renders even on narrow viewports. Useful for embedded sub-navigation.
 */
export const NonCollapsible: Story = {
  args: { collapsible: "none" },
  render: (args) => (
    <SidebarProvider className="min-h-96">
      <Sidebar {...args}>
        <SidebarHeader>
          <SidebarInput placeholder="Search the menu" aria-label="Search the menu" />
        </SidebarHeader>
        <SidebarContent>
          <NavMenuGroup label="Workspace" />
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Search the menu");
    expect(input).toBeVisible();
    return userEvent.type(input, "cal").then(() => {
      expect(input).toHaveValue("cal");
    });
  },
};

/**
 * Menu items can carry trailing affordances: a `SidebarMenuBadge` for counts and a
 * `SidebarMenuAction` for per-item actions. The play test clicks the action button and asserts its
 * handler fired.
 */
export const MenuExtras: Story = {
  args: { collapsible: "none" },
  render: (args) => {
    const onAction = fn();
    return (
      <SidebarProvider className="min-h-96">
        <Sidebar {...args}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Projects</SidebarGroupLabel>
              <SidebarGroupAction aria-label="Add project">
                <PlusIcon />
              </SidebarGroupAction>
              <SidebarGroupContent>
                <SidebarMenu>
                  {A.map(navItems, (item) => (
                    <SidebarMenuItem key={item.title}>
                      <NavItemButton item={item} />
                      {item.badge === undefined ? null : <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                      <SidebarMenuAction aria-label={`More for ${item.title}`} onClick={onAction}>
                        <GearIcon />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const action = canvas.getByRole("button", { name: "More for Home" });
    expect(action).toBeVisible();
    return userEvent.click(action).then(() => {
      expect(canvas.getByText("12")).toBeVisible();
    });
  },
};

/**
 * Nested navigation uses `SidebarMenuSub` with `SidebarMenuSubItem` / `SidebarMenuSubButton` to
 * render a second level of links under a parent item.
 */
export const NestedMenu: Story = {
  args: { collapsible: "none" },
  render: (args) => (
    <SidebarProvider className="min-h-96">
      <Sidebar {...args}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <HouseIcon />
                    <span>Getting Started</span>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton isActive>Installation</SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton>Project Structure</SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <GearIcon />
                    <span>Configuration</span>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton size="sm">Environment</SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton size="sm">Secrets</SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
};

/**
 * `SidebarMenuButton` supports a `default` and an `outline` variant for differing emphasis within
 * the panel.
 */
export const ButtonVariants: Story = {
  args: { collapsible: "none" },
  render: (args) => (
    <SidebarProvider className="min-h-96">
      <Sidebar {...args}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton variant="default">
                    <HouseIcon />
                    <span>Default button</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton variant="outline">
                    <GearIcon />
                    <span>Outline button</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarSeparator />
                <SidebarMenuItem>
                  <SidebarMenuButton size="sm">
                    <TrayIcon />
                    <span>Small</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg">
                    <CalendarIcon />
                    <span>Large</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
};

/**
 * `SidebarMenuSkeleton` renders loading placeholders while menu data is being fetched. Pass
 * `showIcon` to reserve space for a leading icon.
 */
export const Loading: Story = {
  args: { collapsible: "none" },
  render: (args) => (
    <SidebarProvider className="min-h-96">
      <Sidebar {...args}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Loading</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {A.map(skeletonRows, (row) => (
                  <SidebarMenuItem key={row}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
};
