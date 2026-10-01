/**
 * Auto-advancing carousel of selected matters for the OIP public home page.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// fallow-ignore-file unused-file -- temporarily unmounted carousel is retained for review-gate re-enable
/**
 * Selected-matters carousel for the OIP public home page.
 *
 * Temporarily unmounted from {@link OipHomePage} (the selected-matters section is
 * commented out pending review-gate sign-off); retained for re-enable.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { Carousel, CarouselContent, CarouselItem, useCarousel } from "@beep/ui/components/carousel";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import * as React from "react";

// OIP-local glass chevrons: a plain button on `useCarousel()` so the gold-on-soil
// chrome never forwards a className into the design-system Button.
const navButton =
  "absolute top-1/2 inline-flex size-11 -translate-y-1/2 touch-manipulation select-none items-center justify-center rounded-full border border-oip-gold/55 bg-oip-soil-deep bg-clip-padding text-oip-gold shadow-lg outline-none backdrop-blur-sm transition-colors hover:border-oip-gold hover:bg-oip-gold hover:text-oip-soil focus-visible:ring-3 focus-visible:ring-oip-gold disabled:pointer-events-none disabled:opacity-40 lg:hidden [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0";

function MattersPreviousButton() {
  const { scrollPrev, canScrollPrev } = useCarousel();

  return (
    <button
      className={`left-2 ${navButton}`}
      data-slot="carousel-previous"
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      type="button"
    >
      <CaretLeftIcon />
      <span className="sr-only">Previous slide</span>
    </button>
  );
}

function MattersNextButton() {
  const { scrollNext, canScrollNext } = useCarousel();

  return (
    <button
      className={`right-2 ${navButton}`}
      data-slot="carousel-next"
      disabled={!canScrollNext}
      onClick={scrollNext}
      type="button"
    >
      <CaretRightIcon />
      <span className="sr-only">Next slide</span>
    </button>
  );
}

/**
 * Wraps server-rendered matter cards in a swipeable carousel with chevron navigation.
 *
 * **Details**
 *
 * Each child becomes one slide. The card markup stays in the server component so the
 * schema-class content never crosses the client boundary; this wrapper only supplies
 * the carousel mechanics and left/right controls. The slide list follows `children`,
 * so adding records through the Sanity CMS extends the carousel without code changes.
 *
 * **Example** (Wrapping children in MattersCarousel)
 *
 * ```tsx
 * import { MattersCarousel } from "@beep/oip-web/components/MattersCarousel"
 *
 * const carousel = (
 *   <MattersCarousel>
 *     <a href="https://example.com">Matter</a>
 *   </MattersCarousel>
 * )
 * console.log(carousel.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function MattersCarousel({ children }: { readonly children: React.ReactNode }) {
  return (
    <Carousel className="mt-10" opts={{ align: "start", loop: false }} aria-label="Selected matters">
      <CarouselContent>
        {React.Children.map(children, (child) => (
          <CarouselItem className="basis-full sm:basis-1/2 lg:basis-1/3">{child}</CarouselItem>
        ))}
      </CarouselContent>
      <MattersPreviousButton />
      <MattersNextButton />
    </Carousel>
  );
}
