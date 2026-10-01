import { Button } from "@beep/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@beep/ui/components/empty";
import { ArrowUpRightIcon, CloudArrowUpIcon, FolderIcon, MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Empty` is a layout primitive for empty, zero, and not-found states. It centers a
 * stack of composable parts — `EmptyHeader`, `EmptyMedia`, `EmptyTitle`,
 * `EmptyDescription`, and `EmptyContent` — inside a dashed, balanced container. Compose
 * the parts to communicate why a surface is empty and what the user can do next.
 *
 * Imported from `@beep/ui/components/empty`.
 */
const meta = {
  title: "Components/Feedback/Empty",
  component: Empty,
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description: "Extra classes merged onto the dashed centering container.",
    },
    children: {
      control: false,
      description: "Composed `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, and `EmptyContent` parts.",
    },
  },
  args: {},
} satisfies Meta<typeof Empty>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The canonical empty state: an icon media badge, a title, a description, and primary
 * plus secondary actions. The play function asserts the heading renders and clicks the
 * primary action once.
 */
export const Default: Story = {
  args: {
    children: (
      <>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderIcon />
          </EmptyMedia>
          <EmptyTitle>No Projects Yet</EmptyTitle>
          <EmptyDescription>
            You have not created any projects yet. Get started by creating your first project.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <Button onClick={fn()}>
              <PlusIcon />
              Create Project
            </Button>
            <Button variant="outline">Import Project</Button>
          </div>
        </EmptyContent>
      </>
    ),
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("No Projects Yet");
    expect(title).toBeVisible();
    const create = canvas.getByRole("button", { name: /create project/i });
    return userEvent.click(create).then(() => {
      expect(create).toBeVisible();
    });
  },
};

/**
 * The plain `default` media variant renders the icon without the muted rounded badge,
 * keeping the focus on the title and description.
 */
export const PlainMedia: Story = {
  args: {
    children: (
      <EmptyHeader>
        <EmptyMedia variant="default">
          <CloudArrowUpIcon className="size-10 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>Nothing uploaded</EmptyTitle>
        <EmptyDescription>Drag files here or use the upload button to add your first file.</EmptyDescription>
      </EmptyHeader>
    ),
  },
};

/**
 * A search results empty state. The play function types into the rendered search input
 * to exercise interaction and confirms the entered value.
 */
export const NoSearchResults: Story = {
  args: {
    children: (
      <>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MagnifyingGlassIcon />
          </EmptyMedia>
          <EmptyTitle>No results found</EmptyTitle>
          <EmptyDescription>We could not find anything matching your search. Try a different term.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <input
            aria-label="Search"
            placeholder="Search projects"
            className="h-9 w-full rounded-md border px-3 text-sm"
          />
        </EmptyContent>
      </>
    ),
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Search" });
    expect(input).toBeVisible();
    return userEvent.type(input, "design").then(() => {
      expect(input).toHaveValue("design");
    });
  },
};

/**
 * A minimal empty state with only a title and description — useful inside compact cards
 * or table bodies where media and actions would be too heavy.
 */
export const TitleOnly: Story = {
  args: {
    children: (
      <EmptyHeader>
        <EmptyTitle>Your inbox is clear</EmptyTitle>
        <EmptyDescription>New messages will appear here as they arrive.</EmptyDescription>
      </EmptyHeader>
    ),
  },
};

/**
 * An empty state whose `EmptyDescription` embeds an inline link, which the component
 * styles with an underline and primary hover color.
 */
export const WithInlineLink: Story = {
  args: {
    children: (
      <>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderIcon />
          </EmptyMedia>
          <EmptyTitle>No documents</EmptyTitle>
          <EmptyDescription>
            Connect a folder to sync documents automatically. <a href="#docs">Read the guide</a> to learn more.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="link" size="sm">
            Learn More
            <ArrowUpRightIcon />
          </Button>
        </EmptyContent>
      </>
    ),
  },
};

/**
 * Override the dashed container with a solid background and border via `className` for
 * empty states that need to read as a filled panel rather than a placeholder outline.
 */
export const SolidPanel: Story = {
  args: {
    className: "rounded-xl border border-solid bg-muted/40",
    children: (
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PlusIcon />
        </EmptyMedia>
        <EmptyTitle>Start something new</EmptyTitle>
        <EmptyDescription>
          This panel uses a solid border and tinted surface instead of the default dashed outline.
        </EmptyDescription>
      </EmptyHeader>
    ),
  },
};
