# Instance

- id: `tour-state-open-payload`
- file:line: `packages/foundation/ui-system/ui/src/components/tour.tsx:38`
- symbol: `TourState`
- members: `isOpen`, `activeTourId`
- evidence: E3/E1 at
  `packages/foundation/ui-system/ui/src/components/tour.tsx:61-67,266-297`
  — initialization/final-step/explicit close use the one closed bag and every
  successful nonempty start writes the full open payload.

Reviewed against merged checkout `7440cb8c4302ce64b87860069a464bafbf65f576`
and main corpus `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`;
the owned tour source is unchanged from the earlier
`05405bf322da0ca7eb88b8bb402145081e8fded6` /
`be8995e66aeefedf0dabf131deaeaaf25c8e6fc8` review.

# Current shape

`TourState` stores `activeTourId: string | null`, `currentStepIndex`, and
`isOpen`.

# Cardinality gap

The flag and nullable payload represent four coarse combinations;
only closed-without-id and open-with-id are legal. Step index belongs only to
the open case.

# Target schema

Define named `TourClosedState` and `TourOpenState` classes and combine them
with `S.toTaggedUnion("state")`. Reuse the established `$UiId` identity
composer used by other `@beep/ui` components.

```ts
const $I = $UiId.create("components/tour")

class TourClosedState extends S.Class<TourClosedState>($I`TourClosedState`)(
  { state: S.tag("closed") },
  $I.annote("TourClosedState", { description: "A tour provider with no active tour." })
) {
  static readonly is = S.is(TourClosedState)
}

class TourOpenState extends S.Class<TourOpenState>($I`TourOpenState`)(
  {
    state: S.tag("open"),
    tourId: S.String,
    currentStepIndex: S.Int,
  },
  $I.annote("TourOpenState", { description: "The active tour and its current step." })
) {
  static readonly is = S.is(TourOpenState)
}

const TourState = S.Union([TourClosedState, TourOpenState]).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("TourState", { description: "Closed or active guided-tour state." })
)
type TourState = typeof TourState.Type

const closedTourState = TourClosedState.make({})
```

The closed case owns no payload; the open case owns `tourId` and
`currentStepIndex`. `S.tag(...)` supplies the discriminator to the case
constructors. Do not add compatibility getters for `isOpen`, a nullable id,
or a closed-state step index. This is internal decoded Atom state, so no
transformation codec is needed.

Resolve the active tour and captured `steps` only from the open member, but
retain the current render predicate and indexed read:
`open && activeTour && steps.length > 0` followed by
`steps[currentStepIndex]!`. If `tours` changes to a shorter nonempty list
while the stored index is out of range, `TourOverlay` receives `undefined`
and throws when it reads `step.id` at line 342. Silently rendering nothing
would be a separate bug fix and is not part of this carrier migration.

A valid current step whose target selector matches no element still enters
`TourOverlay`, mounts the existing position and body-overflow atoms, and then
returns `null` at lines 342-349. Preserve that ordering; the invisible
overlay/body-lock policy is also a separate UI decision.

Preserve the current callback closure semantics. `next` decides whether to
increment or close from the render-captured index and step-count, then its
functional update increments whichever open tour is current. `previous`
likewise decides from the captured index and decrements whichever open tour is
current. Therefore a delayed callback from an earlier overlay can advance,
decrement, or close a newly started tour. Owner/index checks would repair that
race and are outside this representation change.

The tagged union strictly requires one internal adjustment: a closed member has
no index to increment or decrement. When one of those stale functional
updaters observes a closed member, return that closed member unchanged. The old
code could mutate its hidden closed-state index; no source reads that index
while closed, so this required carrier difference has no observable UI effect.

Keep the open index as `S.Int`, not `NonNegativeInt`. A stale previous
callback captured after step zero can run after another tour starts at index
zero and decrement that latest open index to -1. The current code then reaches
the unsafe indexed render and throws. Rejecting the negative index would change
that reachable behavior, so the representation must admit it until the stale
callback defect is addressed separately.

| action decided by captured overlay | latest Atom member | result |
| --- | --- | --- |
| start known nonempty tour | either | open requested tour at step 0 |
| start unknown or empty tour | either | unchanged; preserve exact error log |
| nonfinal next | open, including a newer tour | latest open tour, latest index + 1 |
| final next | either, including a newer tour | closed |
| previous captured after step 0 | open, including a newer tour | latest open tour, latest index - 1 |
| nonfinal next/previous | closed | closed; required because closed has no index |
| previous captured at step 0 | either | unchanged |
| explicit close | either | closed |

# Migration inventory

- `packages/foundation/ui-system/ui/src/components/tour.tsx:9-31` — import
  `$UiId` and `effect/Schema`; reuse existing schema and identity package
  conventions. No package-manifest dependency change belongs
  here.
- `packages/foundation/ui-system/ui/src/components/tour.tsx:38-67` — replace
  the structural type and three-field closed bag with the two named classes,
  tagged union, schema-derived guards, and closed constructor.
- `packages/foundation/ui-system/ui/src/components/tour.tsx:255-265` —
  narrow/match once and resolve `activeTour`, `steps`, and the current index
  only from the open payload.
- `packages/foundation/ui-system/ui/src/components/tour.tsx:266-303` —
  reconstruct exact cases in next, previous, close, and start. Preserve each
  decision's captured index/step-count semantics and its effect on the latest
  open member. Return a latest closed member unchanged where its removed index
  makes the old hidden update impossible. Preserve exact missing-tour and
  empty-tour messages and leave active state unchanged for either invalid
  start.
- `packages/foundation/ui-system/ui/src/components/tour.tsx:305-323` — replace
  only the `isOpen` part of the render predicate with open-member narrowing;
  retain active-tour lookup, `steps.length > 0`, and
  `steps[currentStepIndex]!` exactly.
- `packages/foundation/ui-system/ui/src/components/tour.tsx:327-466` — no
  semantic edit: retain target lookup, scroll/resize positioning, body overflow
  lock, focus configuration, route links, labels, and button ordering.
- `packages/foundation/ui-system/ui/stories/components/tour.stories.tsx:24-125`
  — retain the three current consumers and use the existing Default story as
  the primary recorded-QA surface.
- Search package barrels before exporting; keep the model internal unless a
  live consumer requires it.

# Guard-deletion accounting

- Delete `isOpen` and the `isOpen && activeTour` render conjunction.
- Delete the `activeTourId: null`/`isOpen: false` close-write invariant and the
  paired `activeTourId: tourId`/`isOpen: true` start write.
- Delete closed-state step-index storage; only the open payload owns it.

# Encoded-side impact

none (internal React state)

# Test impact

There are stories but no direct tour component tests. Add component cases for:

- closed initial render;
- known nonempty start at step zero;
- next, previous, first-step previous no-op, and final-step close;
- explicit close from every step;
- unknown and empty starts logging the existing exact message while leaving an
  already-open tour unchanged;
- restarting with another valid tour at step zero;
- delayed next/previous callbacks from an old overlay retaining the current
  race: they update or close a newer open tour according to the old overlay's
  captured branch; the required closed-member no-op has no visible effect;
- active id removal and empty steps retaining no-overlay behavior; shortened
  nonempty steps with a stale index retaining the current render throw;
- a valid step with no target retaining its current mounted-atom,
  body-locked, no-visible-overlay behavior;
- route-backed previous/next controls preserving the same state transition and
  link destination.

For recorded browser QA, run the portless Storybook Default story with real
pointer/keyboard input. Record closed initial layout; start; Next to step 2;
Previous to step 1; Next then Finish; restart and close with the X control;
restart and close with the public `useTour().close` control added to the QA
fixture. Do not fold a stale-callback repair or shortened-steps fallback into
this recording; component regression tests pin those current behaviors. At
every frame assert the highlighted
`data-tour-step-id`, title, “Step n of m” text, visible button labels, body
overflow restoration, and focus/console health. Include a narrow viewport and
one missing-target step to preserve the invisible-overlay behavior and its
current body-lock lifetime. Complete record -> extract -> judge and retain a
green round with `requiredCount: 0`.

# Risk and sequencing

Land in Tier 1C. Preserve focus, overlay positioning, scrolling, route
navigation, labels, and logging. The state transition and every consumer must
land atomically because the closed member intentionally removes both payload
fields. The implementation changes an internal private-package carrier and
does not require a dependency, lockfile, generated-file, or encoded-shape
change.
