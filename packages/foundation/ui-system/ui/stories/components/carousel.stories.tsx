import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@beep/ui/components/carousel";
import { A } from "@beep/utils";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Carousel` is a slide/scroll container built on Embla. It is a compound component: wrap one
 * `CarouselContent` (the scroll viewport) holding one `CarouselItem` per slide inside the root
 * `Carousel`, then drop in `CarouselPrevious` and `CarouselNext` for navigation. The root owns the
 * Embla instance and exposes scroll state through context, so the previous/next buttons auto-disable
 * at the edges. Set `orientation` to switch between horizontal (default) and vertical scrolling, and
 * pass `opts` to forward Embla options such as `loop` or `align`.
 *
 * Imported from `@beep/ui/components/carousel`.
 */
const meta = {
  title: "Components/Data Display/Carousel",
  component: Carousel,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Scroll axis; also flips the navigation button placement and arrow-key direction.",
      table: { defaultValue: { summary: "horizontal" } },
    },
    opts: {
      control: false,
      description: "Embla carousel options forwarded to the underlying instance (e.g. `loop`, `align`).",
    },
    plugins: {
      control: false,
      description: "Embla plugins to extend behavior (e.g. autoplay, wheel gestures).",
    },
    setApi: {
      control: false,
      description: "Callback invoked with the Embla API once it initializes, for external control.",
    },
    className: {
      control: "text",
      description: "Additional classes merged onto the root region (commonly width constraints).",
    },
    children: {
      control: false,
      description: "Composed sub-parts: a `CarouselContent` of `CarouselItem`s plus navigation buttons.",
    },
  },
  args: {
    orientation: "horizontal",
    className: "w-full max-w-xs",
    style: { width: 320 },
  },
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

const slides: ReadonlyArray<number> = A.makeBy(5, (index) => index + 1);

/**
 * The canonical horizontal carousel with five numbered slides and edge-aware navigation. The play
 * test asserts the first slide is visible and confirms `Previous slide` starts disabled at the
 * start edge.
 */
export const Default: Story = {
  render: (args) => (
    <Carousel {...args}>
      <CarouselContent>
        {A.map(slides, (slide) => (
          <CarouselItem key={slide}>
            <div className="bg-muted flex aspect-square items-center justify-center rounded-md p-6">
              <span className="text-4xl font-semibold">{slide}</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const previous = canvas.getByRole("button", { name: "Previous slide" });
    const next = canvas.getByRole("button", { name: "Next slide" });
    expect(canvas.getByText("1")).toBeVisible();
    expect(previous).toBeDisabled();
    expect(next).toBeVisible();
  },
};

/**
 * Multiple slides share the viewport via `basis` utilities on each `CarouselItem`, paging a third of
 * the track at a time.
 */
export const MultipleSlides: Story = {
  args: { className: "w-full max-w-sm" },
  render: (args) => (
    <Carousel {...args}>
      <CarouselContent>
        {A.map(slides, (slide) => (
          <CarouselItem key={slide} className="basis-1/3">
            <div className="bg-muted flex aspect-square items-center justify-center rounded-md p-6">
              <span className="text-2xl font-semibold">{slide}</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

/**
 * A vertical carousel scrolls along the y-axis; the navigation buttons move above and below the
 * track and respond to up/down arrow keys. The play test asserts both buttons render.
 */
export const Vertical: Story = {
  args: { orientation: "vertical", className: "w-full max-w-xs" },
  render: (args) => (
    <Carousel {...args}>
      <CarouselContent className="h-50">
        {A.map(slides, (slide) => (
          <CarouselItem key={slide} className="basis-1/2">
            <div className="bg-muted flex items-center justify-center rounded-md p-6">
              <span className="text-2xl font-semibold">{slide}</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Previous slide" })).toBeVisible();
    expect(canvas.getByRole("button", { name: "Next slide" })).toBeVisible();
    return Promise.resolve();
  },
};

/**
 * With `loop` enabled in `opts`, the track wraps from the last slide back to the first, so the
 * `Previous slide` button stays enabled even at the starting position. The play test confirms it is
 * not disabled.
 */
export const Loop: Story = {
  args: { opts: { loop: true } },
  render: (args) => (
    <Carousel {...args}>
      <CarouselContent>
        {A.map(slides, (slide) => (
          <CarouselItem key={slide}>
            <div className="bg-muted flex aspect-square items-center justify-center rounded-md p-6">
              <span className="text-4xl font-semibold">{slide}</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "Previous slide" })).toBeEnabled();
    return Promise.resolve();
  },
};

/**
 * Slides can hold any content. Here each `CarouselItem` renders a richer card-style panel with a
 * caption rather than a single number.
 */
export const RichContent: Story = {
  render: (args) => (
    <Carousel {...args}>
      <CarouselContent>
        {A.map(slides, (slide) => (
          <CarouselItem key={slide}>
            <div className="border-border bg-card flex flex-col gap-2 rounded-lg border p-6">
              <span className="text-muted-foreground text-sm">Slide {slide} of 5</span>
              <span className="text-lg font-semibold">Featured item {slide}</span>
              <p className="text-muted-foreground text-sm">
                A short description for slide {slide}, demonstrating arbitrary slide content.
              </p>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};
