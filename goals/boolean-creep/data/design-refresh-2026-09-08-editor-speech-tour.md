# Editor, speech, and tour UI design refresh — 2026-09-08

## Source and scope

- Reviewed merged checkout:
  `7440cb8c4302ce64b87860069a464bafbf65f576`
- Reviewed main corpus:
  `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- The four owned UI source surfaces are unchanged from the initial
  `05405bf322da0ca7eb88b8bb402145081e8fded6` checkout /
  `be8995e66aeefedf0dabf131deaeaaf25c8e6fc8` main review.
- The frozen install uses `@elevenlabs/client@1.25.0`; its live exports and
  event types remain compatible with `use-scribe.ts`.
- Refreshed only:
  - `foundation-ui-system-speech-input-connection.md`
  - `foundation-ui-system-menus-open.md`
  - `r3-foundation-mention-plugin-lookup-phase.md`
  - `tour-state-open-payload.md`
- No source, test, inventory, lifecycle/status, dependency, lockfile,
  generated-file, or Git-ref change was made.

## Speech input connection

The 4 / 3 evidence remains correct. `SpeechInputContextValue.isConnecting`
and `.isConnected` are both projected from the existing three-member
`ScribeStatus`. That owner is a repo-local plain TypeScript union in
`use-scribe.ts:77`; it is not imported from `@elevenlabs/client`. The
corrected design promotes that exact owner to an exported `LiteralKit` value
plus derived same-name type, preserving `idle|connecting|connected` and the
existing type export. The context reuses the promoted owner, and no duplicate
status family is introduced.

The migration map now covers every status writer and guard in
`use-scribe.ts`, plus every context read: root styling, record
click/disable/scale/label, all three icons, preview inert/width/ARIA state, and
cancel inert/visibility. Writers use `ScribeStatus.Enum.*`; guards use
`ScribeStatus.is.*`. `useScribe` remains the sole state-machine owner.

The refresh records the async compatibility boundary at
`speech-input.tsx:208,238-307`. Request-id invalidation, transcript reset,
disconnect ordering, callback payload timing, swallowed start errors, and
unmount cleanup stay unchanged. In particular, a request which is stale before
`connect` still reaches the next continuation, invokes
`scribe.disconnect()`, and skips `onStart`; this state-carrier migration
does not silently repair that broader behavior.

The component/unit plan covers idle, delayed token/connecting, connected,
partial and committed transcripts, stop, cancel, every connection failure, and
out-of-order starts. The recorded browser plan uses a portless Storybook
fixture with deterministic microphone and client-boundary doubles installed
before component load. It drives the real buttons through idle, connecting,
connected, preview, stop/restart, cancel, failure/retry, and stale start
completion, then runs record -> extract -> judge with `requiredCount: 0`.

## Exclusive editor menu ownership

The 4 / 3 evidence remains correct. The only writes are slash and mention
`onOpen`/`onClose` callbacks at `typeahead.tsx:491-498,608-612`. The
design stores `O.Option<TypeaheadMenu>`, opens with an exact owner, and closes
with one functional `O.filter` update. This preserves last-open-wins,
idempotence, and prevents a delayed close from clearing a newer owner.

The complete consumer map distinguishes two mechanisms:

- `anyMenuOpenAtom` drives only the combobox ARIA observer at
  `typeahead.tsx:669-738`.
- Enter-to-send does not trust that atom. It confirms a visible listbox through
  `isTypeaheadMenuVisible` at `atoms.ts:757-800`, because Lexical may omit a
  close callback after trigger removal.

The design retains slash query clearing and mention `Atom.Reset` on close
even when owner-aware filtering preserves another menu. Tests cover every
option, repeated opens, both stale-close orders, reset side effects, ARIA
observer lifetime, and the DOM fallback. Recorded QA drives slash and mention
switching, keyboard selection, Escape, trigger removal, stale ownership, ARIA
relations, and Enter-to-send through the portless editor surface.

## Mention lookup phase

The original pending/failed pair had a 4 / 3 gap. Round 25 adds its settled
complement alias to the same cluster, giving 8 / 3 without changing the
three-phase target or guard-deletion plan. The previous target code had a
behavioral error. Effect `AsyncResult.Success` can carry `waiting: true`
during a refresh. The current code hides its previous candidates through
`settled && AsyncResult.isSuccess`. Deriving options from `isSuccess` alone
would display query A's candidates while query B is waiting.

The corrected design derives one waiting/failure/ready literal and exposes
success options only when that phase is ready. It retains
`mentionLookupFn`'s per-editor latest-write-wins interruption, both
`Atom.Reset` sites, typed source/decode failures and logging, and the current
rule that interruption renders no failure notice.

Tests and recorded QA now include waiting over a previous success, query A
settling after query B, old rejection after supersession, ordinary failure and
retry, Escape, trigger removal, and unmount. The browser sequence records
loading/failure notices, candidates, combobox/listbox ownership, keyboard
selection and inserted mention text, then requires a green extracted/judged
round with no required findings.

## Tour state

The 4 / 2 evidence remains correct. Initialization, explicit close, final-step
completion, and successful start construct only closed-without-payload or
open-with-id-and-index.

The target is now concrete: internal named `TourClosedState` and
`TourOpenState` schema classes, an `S.toTaggedUnion("state")` union, an
`S.Int` step index, and schema-derived guards. `S.Int` is required because
a stale previous callback can drive a newly opened tour from zero to -1;
narrowing it to `NonNegativeInt` would change the current reachable failure.
Closed owns no id or index. No internal transform or wire codec is needed.

The transition table preserves successful start, next, previous, final
finish, explicit close, exact error logging, and the rule that unknown or empty
start leaves an existing tour unchanged. It also preserves the current stale
callback race: an old overlay's captured branch increments/decrements whichever
open tour is latest, or closes it when the old overlay considered itself
final. Adding owner/index checks would be a separate bug fix.

The only carrier-required difference is internal and unobservable: a stale
increment/decrement which observes a closed member now returns it unchanged
because closed no longer owns an index. The old bag could mutate its hidden
closed index, but no source reads that index while closed. Negative indices on
the open member remain admitted so the current stale-previous behavior and
subsequent indexed-render throw are not normalized away.

The current `steps[currentStepIndex]!` behavior also remains. If props shorten
a nonempty active tour below the stored index, `TourOverlay` receives
`undefined` and throws on `step.id`; a silent option fallback is a separate
bug fix. For a valid step with no matching target, position and body-lock atoms
still mount before `TourOverlay` returns null.

The full read/write map includes the state declaration/scope, derived active
tour and steps, every transition, conditional overlay render, and the
position/focus/route/label surface retained without semantic edits. Component
tests pin the stale-callback effects and stale-index throw. Recorded Storybook
QA covers ordinary start, next, previous, finish, X close, public close,
restart, narrow layout, and a missing target, with highlight, counter, labels,
body overflow, focus, and console assertions.

## Metadata follow-up

Round 25 expands only the mention cluster; the corrected full cardinalities are:

- menus: 4 representable / 3 legal;
- speech: 4 / 3;
- mention phase including settled: 8 / 3;
- tour: 4 / 2.

The existing evidence lines remain current. The speech
`targetShape: "literalkit"` is now concrete and law-compliant: promote the
existing repo-owned `ScribeStatus` declaration in place, preserve its public
name/type/literals, and reuse it from the context. No inventory vocabulary
exception remains.

## Separate tour opportunities

Two existing defects are deliberately excluded from this representation
migration:

- a delayed next/previous callback can mutate or close a newer tour because its
  branch uses the old overlay while its functional updater uses the latest
  Atom value;
- shortening a nonempty active tour below the stored index passes `undefined`
  through the non-null assertion and throws at `TourOverlay.step.id`.

They should receive their own behavior decision and tests before repair. The
valid-step/missing-target body-lock behavior is also preserved rather than
being bundled into either fix.

## Validation

Before the latest concurrent inventory admission,
`bun goals/boolean-creep/ops/validate-designs.ts` passed with
`design coverage OK: 104 qualified ids`. After this correction it reports
one unrelated missing surface across 105 qualified ids:
`html-link-imagesizes-disposition: missing designs/html-link-imagesizes-disposition.md`.
None of the three files owned by this correction reference that id. Scoped
`git diff --check` passes for both corrected designs and this handoff.
