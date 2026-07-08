/**
 * Tour primitive: a step-by-step guided-tour overlay with popover-anchored callouts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Button } from "@beep/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@beep/ui/components/card";
import { Popover, PopoverContent } from "@beep/ui/components/popover";
import { A } from "@beep/utils";
import { make as makeScopedAtom, useAtom, useAtomMount, useAtomValue } from "@effect/atom-react";
import { XIcon } from "@phosphor-icons/react";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { Atom } from "effect/unstable/reactivity";
import Link from "next/link";
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/index.ts";
import { requireReactContext } from "../lib/react-invariant.ts";

const TourContext = React.createContext<{
  readonly start: (tourId: string) => void;
  readonly close: () => void;
} | null>(null);

type TourState = {
  readonly activeTourId: string | null;
  readonly currentStepIndex: number;
  readonly isOpen: boolean;
};

type TourTargetRect = {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly toJSON: () => void;
};

type TourTarget = {
  readonly rect: TourTargetRect;
  readonly radius: number;
};

const closedTourState: TourState = {
  activeTourId: null,
  currentStepIndex: 0,
  isOpen: false,
};

const TourScope = makeScopedAtom(() => Atom.make<TourState>(closedTourState));

const tourTargetsAtom = Atom.family((_stepId: string) => Atom.make<ReadonlyArray<TourTarget>>(A.empty()));

const tourOverlayPositionAtom = Atom.family((stepId: string) =>
  Atom.make((get) => {
    let needsScroll = true;

    const updatePosition = () => {
      const escapedStepId = CSS.escape(stepId);
      const elements = document.querySelectorAll(`[data-tour-step-id='${escapedStepId}']`);

      if (elements.length === 0) {
        get.set(tourTargetsAtom(stepId), A.empty());
        return;
      }

      let validElements = A.empty<{
        readonly rect: TourTargetRect;
        readonly radius: number;
        readonly element: Element;
      }>();

      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;

        const style = window.getComputedStyle(element);
        const radius = Number(style.borderRadius) || 4;

        validElements = A.append(validElements, {
          rect: {
            width: rect.width,
            height: rect.height,
            x: rect.left,
            y: rect.top,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            toJSON: () => {},
          },
          radius,
          element,
        });
      }

      get.set(
        tourTargetsAtom(stepId),
        A.map(validElements, ({ rect, radius }) => ({ rect, radius }))
      );

      if (A.isArrayNonEmpty(validElements) && needsScroll) {
        validElements[0].element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        needsScroll = false;
      }
    };

    updatePosition();

    const handleResizeOrScroll = () => updatePosition();
    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);

    const observer = new MutationObserver(() => updatePosition());
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    const resizeObserver = new ResizeObserver(() => updatePosition());
    resizeObserver.observe(document.body);

    get.addFinalizer(() => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
      observer.disconnect();
      resizeObserver.disconnect();
    });
  })
);

const tourBodyOverflowLockAtom = Atom.make((get) => {
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  get.addFinalizer(() => {
    document.body.style.overflow = previousOverflow;
  });
});

/**
 * Use tour hook.
 *
 * @example
 * ```tsx
 * import { useTour } from "@beep/ui/components/tour"
 *
 * console.log(useTour)
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
function useTour() {
  const context = React.useContext(TourContext);
  return requireReactContext(context, { message: "useTour must be used within a TourProvider" });
}

/**
 * Step type.
 *
 * @example
 * ```ts
 * import type { Step } from "@beep/ui/components/tour"
 *
 * const step: Step = { id: "welcome", title: "Welcome", content: "Let's get started." }
 *
 * console.log(step.id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
interface Step {
  readonly align?: undefined | React.ComponentProps<typeof PopoverContent>["align"];
  readonly alignOffset?: undefined | React.ComponentProps<typeof PopoverContent>["alignOffset"];
  readonly className?: undefined | string;
  readonly content: React.ReactNode;
  readonly id: string;
  readonly nextLabel?: undefined | React.ReactNode;
  readonly nextRoute?: undefined | string;
  readonly previousLabel?: undefined | React.ReactNode;
  readonly previousRoute?: undefined | string;
  readonly side?: undefined | React.ComponentProps<typeof PopoverContent>["side"];
  readonly sideOffset?: undefined | React.ComponentProps<typeof PopoverContent>["sideOffset"];
  readonly title: React.ReactNode;
}

/**
 * Tour type.
 *
 * @example
 * ```ts
 * import type { Step, Tour } from "@beep/ui/components/tour"
 *
 * const steps: Step[] = [{ id: "welcome", title: "Welcome", content: "Let's get started." }]
 * const tour: Tour = { id: "onboarding", steps }
 *
 * console.log(tour.steps.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
interface Tour {
  readonly id: string;
  readonly steps: Step[];
}

/**
 * Tour provider export.
 *
 * @example
 * ```tsx
 * import { TourProvider } from "@beep/ui/components/tour"
 *
 * console.log(TourProvider)
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
function TourProvider({ tours, children }: { readonly tours: Tour[]; readonly children: React.ReactNode }) {
  return (
    <TourScope.Provider>
      <TourProviderInner tours={tours}>{children}</TourProviderInner>
    </TourScope.Provider>
  );
}

function TourProviderInner({ tours, children }: { readonly tours: Tour[]; readonly children: React.ReactNode }) {
  const [tourState, setTourState] = useAtom(TourScope.use());
  const { activeTourId, currentStepIndex, isOpen } = tourState;

  const activeTour = pipe(
    tours,
    A.findFirst((tour) => tour.id === activeTourId),
    O.getOrUndefined
  );
  const steps = activeTour?.steps || [];

  function next() {
    if (currentStepIndex < steps.length - 1) {
      setTourState((current) => ({ ...current, currentStepIndex: current.currentStepIndex + 1 }));
    } else {
      setTourState(closedTourState);
    }
  }

  function previous() {
    if (currentStepIndex > 0) {
      setTourState((current) => ({ ...current, currentStepIndex: current.currentStepIndex - 1 }));
    }
  }

  function close() {
    setTourState(closedTourState);
  }

  function start(tourId: string) {
    const tour = pipe(
      tours,
      A.findFirst((tour) => tour.id === tourId),
      O.getOrUndefined
    );
    if (tour !== undefined) {
      if (tour.steps.length > 0) {
        setTourState({
          activeTourId: tourId,
          currentStepIndex: 0,
          isOpen: true,
        });
      } else {
        Effect.runSync(Effect.logError(`Tour with id '${tourId}' has no steps.`));
      }
    } else {
      Effect.runSync(Effect.logError(`Tour with id '${tourId}' not found.`));
    }
  }

  return (
    <TourContext.Provider
      value={{
        start,
        close,
      }}
    >
      {children}
      {isOpen && activeTour && steps.length > 0 && (
        <TourOverlay
          step={steps[currentStepIndex]!}
          currentStepIndex={currentStepIndex}
          totalSteps={steps.length}
          onNext={next}
          onPrevious={previous}
          onClose={close}
        />
      )}
    </TourContext.Provider>
  );
}

function TourOverlay({
  step,
  currentStepIndex,
  totalSteps,
  onNext,
  onPrevious,
  onClose,
}: {
  readonly step: Step;
  readonly currentStepIndex: number;
  readonly totalSteps: number;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onClose: () => void;
}) {
  const targets = useAtomValue(tourTargetsAtom(step.id));

  useAtomMount(tourOverlayPositionAtom(step.id));
  useAtomMount(tourBodyOverflowLockAtom);

  const portalDocument = (globalThis as { readonly document?: Document }).document;
  if (P.isUndefined(portalDocument)) return null;
  if (targets.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <svg aria-hidden="true" focusable="false" className="absolute inset-0 size-full">
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {A.map(targets, (target, i) => (
              <rect
                key={i}
                x={target.rect.left}
                y={target.rect.top}
                width={target.rect.width}
                height={target.rect.height}
                rx={target.radius}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect width="100%" height="100%" mask="url(#tour-mask)" className="fill-black opacity-20" />
        {A.map(targets, (target, i) => (
          <rect
            key={i}
            x={target.rect.left}
            y={target.rect.top}
            width={target.rect.width}
            height={target.rect.height}
            rx={target.radius}
            className="stroke-primary fill-none stroke-2"
          />
        ))}
      </svg>
      {A.isReadonlyArrayNonEmpty(targets) && (
        <Popover key={step.id} open={true}>
          <PopoverContent
            className={cn("px-0", step.className)}
            side={step.side}
            sideOffset={step.sideOffset}
            align={step.align}
            alignOffset={step.alignOffset}
            anchor={{
              getBoundingClientRect: () =>
                targets[0]?.rect ?? {
                  top: 0,
                  left: 0,
                  width: 0,
                  height: 0,
                  bottom: 0,
                  right: 0,
                  x: 0,
                  y: 0,
                  toJSON: () => {},
                },
            }}
            initialFocus={false}
            finalFocus={false}
            render={<Card />}
          >
            <CardHeader>
              <CardTitle>{step.title}</CardTitle>
              <CardDescription>
                Step {currentStepIndex + 1} of {totalSteps}
              </CardDescription>
              <CardAction>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <XIcon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>{step.content}</CardContent>
            <CardFooter className="justify-between">
              {currentStepIndex > 0 &&
                O.fromNullishOr(step.previousRoute).pipe(
                  O.match({
                    onNone: () => (
                      <Button variant="outline" onClick={onPrevious}>
                        {step.previousLabel ?? "Previous"}
                      </Button>
                    ),
                    onSome: (previousRoute) => (
                      <Button
                        variant="outline"
                        onClick={onPrevious}
                        render={() => <Link href={previousRoute}>{step.previousLabel ?? "Previous"}</Link>}
                      />
                    ),
                  })
                )}
              {O.fromNullishOr(step.nextRoute).pipe(
                O.match({
                  onSome: (nextRoute) => (
                    <Button
                      className="ml-auto"
                      onClick={onNext}
                      render={() => (
                        <Link href={nextRoute}>
                          {step.nextLabel ?? (currentStepIndex === totalSteps - 1 ? "Finish" : "Next")}
                        </Link>
                      )}
                    />
                  ),
                  onNone: () => (
                    <Button className="ml-auto" onClick={onNext}>
                      {step.nextLabel ?? (currentStepIndex === totalSteps - 1 ? "Finish" : "Next")}
                    </Button>
                  ),
                })
              )}
            </CardFooter>
          </PopoverContent>
        </Popover>
      )}
    </div>,
    portalDocument.body
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { type Step, type Tour, TourProvider, useTour };
