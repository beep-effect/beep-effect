import { Button } from "@beep/ui/components/button";
import { TourProvider, useTour } from "@beep/ui/components/tour";
import { A } from "@beep/utils";
import type { Step, Tour } from "@beep/ui/components/tour";
import type { Meta, StoryObj } from "@storybook/react-vite";

const onboardingSteps: ReadonlyArray<Step> = [
  {
    id: "compose",
    title: "Compose a message",
    content: "Start a new conversation from this button.",
  },
  {
    id: "inbox",
    title: "Your inbox",
    content: "All incoming messages land here, newest first.",
    nextLabel: "Finish",
  },
];

const tours: ReadonlyArray<Tour> = [{ id: "onboarding", steps: [...onboardingSteps] }];

function StartTourButton() {
  const { start } = useTour();
  return (
    <Button type="button" onClick={() => start("onboarding")}>
      Start tour
    </Button>
  );
}

/**
 * `Tour` is a guided product walkthrough built from a `TourProvider` plus the `useTour` hook.
 * Define one or more `Tour` objects (each an `id` and an ordered list of `Step`s) and pass them to
 * `TourProvider`, which owns the active-step state and renders a spotlight overlay. Any descendant
 * calls `useTour().start(tourId)` to launch a walkthrough; the overlay highlights the element whose
 * `data-tour-step-id` matches the current step's `id` and anchors a popover card (title, content,
 * step counter, and Previous/Next/Finish controls) to it. `useTour().close()` dismisses it early.
 *
 * Imported from `@beep/ui/components/tour`.
 */
const meta = {
  title: "Components/Overlays/Tour",
  component: TourProvider,
  tags: ["autodocs"],
  argTypes: {
    tours: {
      control: false,
      description: "The walkthroughs available to start, each with an `id` and ordered `steps`.",
    },
    children: {
      control: false,
      description: "The application subtree that can launch tours and host the highlighted targets.",
    },
  },
  args: {
    tours: [...tours],
    children: null,
  },
} satisfies Meta<typeof TourProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default setup: a `TourProvider` wrapping a trigger button and two targets whose
 * `data-tour-step-id` values line up with the configured steps. Clicking "Start tour" spotlights the
 * matching element and shows the step popover.
 */
export const Default: Story = {
  render: (args) => (
    <TourProvider tours={args.tours}>
      <div className="flex flex-col gap-4 p-6">
        <StartTourButton />
        <div className="flex gap-4">
          <Button type="button" variant="secondary" data-tour-step-id="compose">
            Compose
          </Button>
          <Button type="button" variant="outline" data-tour-step-id="inbox">
            Inbox
          </Button>
        </div>
      </div>
    </TourProvider>
  ),
};

/**
 * The provider renders its children untouched until a tour begins, so it is safe to wrap an entire
 * application shell. Here a single labelled target is the only highlightable element.
 */
export const SingleTarget: Story = {
  render: (args) => (
    <TourProvider tours={args.tours}>
      <div className="flex flex-col items-start gap-4 p-6">
        <StartTourButton />
        <Button type="button" variant="outline" data-tour-step-id="compose">
          Compose
        </Button>
      </div>
    </TourProvider>
  ),
};

/**
 * A consumer can branch on tour membership: this variant maps the configured step ids onto target
 * buttons so each step has a matching highlight target rendered ahead of time.
 */
export const StepTargets: Story = {
  render: (args) => (
    <TourProvider tours={args.tours}>
      <div className="flex flex-col gap-4 p-6">
        <StartTourButton />
        <div className="flex flex-wrap gap-3">
          {A.map(onboardingSteps, (step) => (
            <Button key={step.id} type="button" variant="ghost" data-tour-step-id={step.id}>
              {step.id}
            </Button>
          ))}
        </div>
      </div>
    </TourProvider>
  ),
};
