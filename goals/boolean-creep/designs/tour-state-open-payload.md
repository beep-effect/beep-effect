# Instance

- id: `tour-state-open-payload`
- file:line: `packages/foundation/ui-system/ui/src/components/tour.tsx:38`
- symbol: `TourState`
- members: `isOpen`, `activeTourId`
- evidence: E3/E1 at `tour.tsx:61-64,280-297` — every close writes
  `false + null`; every successful start writes `true + tourId`.

# Current shape

`TourState` stores `activeTourId: string | null`, `currentStepIndex`, and
`isOpen`.

# Cardinality gap

The flag and nullable payload represent four coarse combinations;
only closed-without-id and open-with-id are legal. Step index belongs only to
the open case.

# Target schema

Define named `TourClosedState` and `TourOpenState` classes and combine them
with `S.toTaggedUnion("state")`. The closed case has only `state: "closed"`;
the open case owns `tourId` and `currentStepIndex`. Use `S.tag(...)` so case
constructors omit the discriminator. Do not add derived `isOpen` or nullable-id
fields. The scoped Atom stores the decoded union.

# Migration inventory

- `tour.tsx:38-67` — replace the type and `closedTourState` bag with the named
  union and closed case.
- `tour.tsx:256-265` — match/narrow once; resolve the active tour only from the
  open payload.
- `tour.tsx:266-297` — update next, previous, close, and start to construct or
  update exact cases; preserve missing/empty-tour logging.
- `tour.tsx:313` onward — render the overlay from the open case and its step
  index without an `isOpen` guard.
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

Add component cases for closed, successful start, next/previous, final-step
close, explicit close, unknown tour, and an empty tour. Run the full
`@beep/ui` package verification. This is gesture-bearing UI: record portless
browser QA for starting, stepping, backing, and closing a tour, then extract
and judge with `requiredCount: 0`.

# Risk and sequencing

Land in Tier 1C. Preserve focus, overlay positioning, scrolling, and logging;
the migration changes only the state carrier. Add the package's patch
changeset unless it is explicitly ignored by repository policy.
