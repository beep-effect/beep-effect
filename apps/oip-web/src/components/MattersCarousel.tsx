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

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@beep/ui/components/carousel";
import * as React from "react";

const navButton =
  "size-11 border-[color-mix(in_oklab,var(--oip-gold)_55%,transparent)] bg-[color-mix(in_oklab,var(--oip-soil)_72%,black)] text-[var(--oip-gold)] shadow-lg backdrop-blur-sm transition-colors hover:border-[var(--oip-gold)] hover:bg-[var(--oip-gold)] hover:text-[var(--oip-soil)] disabled:opacity-40 [&_svg]:size-5";

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
      <CarouselContent className="-ml-5">
        {React.Children.map(children, (child) => (
          <CarouselItem className="basis-full pl-5 sm:basis-1/2 lg:basis-1/3">{child}</CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className={`left-2 top-1/2 -translate-y-1/2 lg:hidden ${navButton}`} />
      <CarouselNext className={`right-2 top-1/2 -translate-y-1/2 lg:hidden ${navButton}`} />
    </Carousel>
  );
}
