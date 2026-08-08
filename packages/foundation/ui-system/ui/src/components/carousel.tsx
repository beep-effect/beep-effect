/**
 * Carousel primitive: an Embla-backed carousel root, viewport, and navigation controls.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Button } from "@beep/ui/components/button";
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Atom } from "effect/unstable/reactivity";
import useEmblaCarousel from "embla-carousel-react";
import * as React from "react";
import { cn } from "../lib/index.ts";
import { requireReactContext } from "../lib/react-invariant.ts";
import type { UseEmblaCarouselType } from "embla-carousel-react";

/**
 * Embla carousel API instance exposed after the carousel initializes.
 *
 * **Example** (Guard undefined carousel API)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import type { CarouselApi } from "@beep/ui/components/carousel"
 *
 * const canAdvance = (api: CarouselApi) => api?.canScrollNext() ?? false
 * const current = canAdvance(undefined)
 * strictEqual(current, false)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
  readonly opts?: undefined | CarouselOptions;
  readonly plugins?: undefined | CarouselPlugin;
  readonly orientation?: undefined | "horizontal" | "vertical";
  readonly setApi?: ((api: CarouselApi) => void) | undefined;
};

type CarouselContextProps = {
  readonly carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  readonly api: ReturnType<typeof useEmblaCarousel>[1];
  readonly scrollPrev: () => void;
  readonly scrollNext: () => void;
  readonly canScrollPrev: boolean;
  readonly canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

type CarouselState = {
  readonly canScrollNext: boolean;
  readonly canScrollPrev: boolean;
};

const readCarouselState = (api: CarouselApi): CarouselState =>
  api === undefined
    ? { canScrollNext: false, canScrollPrev: false }
    : { canScrollNext: api.canScrollNext(), canScrollPrev: api.canScrollPrev() };

// Process-unique scope generator. `React.useId()` is only unique within a
// single React root (default `identifierPrefix`), so two independent roots
// (e.g. SSR/hydration) can collide on their first carousel and share these
// module-scoped `Atom.family` entries. This monotonic counter, captured once
// per mounted instance via `useRef`, guarantees a unique key across every root
// that shares this module's atom-family cache. The key is never serialized for
// hydration (the atoms hold client-only Embla state), so it needs no
// server/client consistency — only per-instance stability and uniqueness.
let carouselScopeCounter = 0;
const nextCarouselScope = (): string => {
  carouselScopeCounter += 1;
  return `carousel-${carouselScopeCounter}`;
};

const carouselStateAtom = Atom.family((_scope: string) =>
  Atom.make<CarouselState>({ canScrollNext: false, canScrollPrev: false })
);

const carouselApiAtom = Atom.family((_scope: string) => Atom.make<CarouselApi>(undefined));

const carouselSetApiAtom = Atom.family((_scope: string) => Atom.make<CarouselProps["setApi"]>(undefined));

// Stable per-instance side-effect atom: subscribes to the embla `api` and wires
// the select/reInit listeners exactly once per `api` change, restoring the prior
// `[api]` dependency semantics without recreating an atom on every render.
const carouselEffectAtom = Atom.family((scope: string) =>
  Atom.make((get) => {
    const stateAtom = carouselStateAtom(scope);
    let detach: (() => void) | undefined;

    get.subscribe(
      carouselApiAtom(scope),
      (current) => {
        detach?.();
        detach = undefined;

        if (current === undefined) {
          return;
        }

        get.set(stateAtom, readCarouselState(current));
        get.once(carouselSetApiAtom(scope))?.(current);

        const onSelect = () => get.set(stateAtom, readCarouselState(current));
        current.on("reInit", onSelect);
        current.on("select", onSelect);
        detach = () => {
          current.off("select", onSelect);
          current.off("reInit", onSelect);
        };
      },
      { immediate: true }
    );

    get.addFinalizer(() => detach?.());
  })
);

/**
 * Read the nearest carousel controls and scroll state.
 *
 * **Gotchas**
 *
 * This hook requires a parent {@link Carousel}; it reports a React context
 * invariant when called outside that provider.
 *
 * **Example** (Next button with hook)
 *
 * ```tsx
 * import { Carousel, CarouselContent, CarouselItem, useCarousel } from "@beep/ui/components/carousel"
 *
 * function CarouselStatus() {
 *   const { canScrollNext, scrollNext } = useCarousel()
 *   return <button disabled={!canScrollNext} onClick={scrollNext}>Next</button>
 * }
 *
 * export function CarouselWithStatus() {
 *   return (
 *     <Carousel>
 *       <CarouselContent>
 *         <CarouselItem>First</CarouselItem>
 *         <CarouselItem>Second</CarouselItem>
 *       </CarouselContent>
 *       <CarouselStatus />
 *     </Carousel>
 *   )
 * }
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
function useCarousel() {
  const context = React.useContext(CarouselContext);
  return requireReactContext(context, { message: "useCarousel must be used within a <Carousel />" });
}

/**
 * Embla-backed carousel provider with keyboard navigation.
 *
 * **Example** (Horizontal with navigation)
 *
 * ```tsx
 * import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@beep/ui/components/carousel"
 *
 * export function MatterCarousel() {
 *   return (
 *     <Carousel opts={{ align: "start" }} orientation="horizontal">
 *       <CarouselContent>
 *         <CarouselItem>Summary</CarouselItem>
 *         <CarouselItem>Timeline</CarouselItem>
 *       </CarouselContent>
 *       <CarouselPrevious />
 *       <CarouselNext />
 *     </Carousel>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Carousel({
  orientation = "horizontal",
  opts,
  setApi,
  plugins,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & CarouselProps) {
  // Lazily allocate a process-unique scope once per instance and keep it stable
  // across renders. This avoids `React.useId()` cross-root collisions that would
  // otherwise alias these module-scoped atoms between independent React roots.
  const scopeRef = React.useRef<string | null>(null);
  if (scopeRef.current === null) {
    scopeRef.current = nextCarouselScope();
  }
  const scope = scopeRef.current;
  const carouselState = useAtomValue(carouselStateAtom(scope));
  const pushApi = useAtomSet(carouselApiAtom(scope));
  const pushSetApi = useAtomSet(carouselSetApiAtom(scope));
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins
  );

  // Bridge render values into the per-instance atoms from a committed effect
  // boundary (not the render body) so the writes never run during a discarded
  // or replayed render under Strict/Concurrent Mode. The stable
  // `carouselEffectAtom` subscribes to `api` and wires the select/reInit
  // listeners exactly once per `api` change.
  React.useLayoutEffect(() => {
    pushSetApi(setApi);
    pushApi(api);
  }, [api, setApi, pushApi, pushSetApi]);

  const scrollPrev = () => api?.scrollPrev();

  const scrollNext = () => api?.scrollNext();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollNext();
    }
  };

  useAtomMount(carouselEffectAtom(scope));

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api: api,
        opts,
        orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev: carouselState.canScrollPrev,
        canScrollNext: carouselState.canScrollNext,
      }}
    >
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

/**
 * Scroll viewport and flex track for carousel items.
 *
 * **Example** (Two-slide content track)
 *
 * ```tsx
 * import { CarouselContent, CarouselItem } from "@beep/ui/components/carousel"
 *
 * export function CarouselSlides() {
 *   return (
 *     <CarouselContent>
 *       <CarouselItem>Overview</CarouselItem>
 *       <CarouselItem>Documents</CarouselItem>
 *     </CarouselContent>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
  const { carouselRef, orientation } = useCarousel();

  return (
    <div ref={carouselRef} className="overflow-hidden" data-slot="carousel-content">
      <div className={cn("flex", orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col", className)} {...props} />
    </div>
  );
}

/**
 * Single slide inside a carousel content track.
 *
 * **Example** (Half-width carousel item)
 *
 * ```tsx
 * import { CarouselItem } from "@beep/ui/components/carousel"
 *
 * export function HalfWidthCarouselItem() {
 *   return <CarouselItem className="basis-1/2">Revenue</CarouselItem>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation } = useCarousel();

  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn("min-w-0 shrink-0 grow-0 basis-full", orientation === "horizontal" ? "pl-4" : "pt-4", className)}
      {...props}
    />
  );
}

/**
 * Previous-slide control wired to the surrounding carousel.
 *
 * **Example** (Ghost previous control)
 *
 * ```tsx
 * import { CarouselPrevious } from "@beep/ui/components/carousel"
 *
 * export function PreviousSlideButton() {
 *   return <CarouselPrevious variant="ghost" size="icon-sm" aria-label="Previous matter" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CarouselPrevious({
  className,
  variant = "outline",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel();

  return (
    <Button
      data-slot="carousel-previous"
      variant={variant}
      size={size}
      className={cn(
        "rounded-full absolute touch-manipulation",
        orientation === "horizontal"
          ? "top-1/2 -left-12 -translate-y-1/2"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <CaretLeftIcon />
      <span className="sr-only">Previous slide</span>
    </Button>
  );
}

/**
 * Next-slide control wired to the surrounding carousel.
 *
 * **Example** (Ghost next control)
 *
 * ```tsx
 * import { CarouselNext } from "@beep/ui/components/carousel"
 *
 * export function NextSlideButton() {
 *   return <CarouselNext variant="ghost" size="icon-sm" aria-label="Next matter" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CarouselNext({
  className,
  variant = "outline",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { orientation, scrollNext, canScrollNext } = useCarousel();

  return (
    <Button
      data-slot="carousel-next"
      variant={variant}
      size={size}
      className={cn(
        "rounded-full absolute touch-manipulation",
        orientation === "horizontal"
          ? "top-1/2 -right-12 -translate-y-1/2"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <CaretRightIcon />
      <span className="sr-only">Next slide</span>
    </Button>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Carousel, type CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, useCarousel };
