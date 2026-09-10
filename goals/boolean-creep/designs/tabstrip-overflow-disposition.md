# Instance

- id: `tabstrip-overflow-disposition`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:358`
- symbol: `TabStrip.measureStrip`
- members: `unmeasured`, `allFit`
- evidence classes:
  - E4 at `GroupPane.tsx:358-360` — `allFit = unmeasured || widthFits`, so unmeasured implies all-fit.
  - E2 at `GroupPane.tsx:361-386` — overflow allocation runs only when all-fit is false, which implies a measured strip.

# Current shape

`measureStrip` records live tab widths/rects and action width at lines 316-353. It derives `unmeasured` and `allFit` at lines 354-360, then matches `allFit` to either no overflow or the allocation algorithm at lines 361-386. The overflow arm always keeps the active tab, subtracts action width and a 32px overflow-button reservation, greedily fits inactive tabs in panel order, and returns the hidden ids.

The per-mount `measuredThisMount` ref at lines 303-307 and 387-392 is a separate freshness fact. It prevents a keep-alive overflow atom from hiding tabs before the current DOM mount measures, and forces the first measurement to publish even when its array equals the stored value. The stable callback/latest-closure ResizeObserver at lines 394-412 persists across renders and disconnects on unmount. Rendering at lines 432-501 gates hidden panels on freshness and owns overflow menu gestures.

# Cardinality gap

Two booleans represent four combinations. Three are legal: `unmeasured` (true,true), `fits` (false,true), and `overflow` (false,false). Unmeasured plus not-all-fit is unreachable.

# Target schema

Add one private annotated `TabStripOverflowDisposition = LiteralKit(["unmeasured", "fits", "overflow"])` in `GroupPane.tsx`. It is derived inside `measureStrip`:

- width at or below zero, or no cached real tab width, selects `unmeasured`;
- otherwise total tab width plus action width at or below available width selects `fits`;
- otherwise select `overflow`.

Match the disposition exhaustively. `unmeasured` and `fits` both produce an empty overflow list, preserving initial flicker suppression. Only `overflow` runs the existing allocation block unchanged. Do not fold `measuredThisMount` into this disposition: disposition describes one measurement input, while the ref records whether this DOM mount has ever published.

# Migration inventory

- `GroupPane.tsx:1-39` — import `LiteralKit` from `@beep/schema`; add the private annotated kit near the existing local helpers. No dependency or barrel change.
- `GroupPane.tsx:316-353` — preserve width cache, root-relative rectangles, removal of hidden-tab rectangles, action width, and total-width calculation.
- `GroupPane.tsx:354-386` — replace both booleans and `Bool.match(allFit)` with one disposition derivation and exhaustive LiteralKit match. Preserve active width, `32` reservation, inactive capacity, greedy order, active inclusion, and hidden-id order exactly.
- `GroupPane.tsx:387-412` — no behavior change: preserve first-measurement publication, stable ref/latest closure, synchronous positive initial measurement, ResizeObserver lifetime, and disconnect cleanup.
- `GroupPane.tsx:432-501` — no behavior change: preserve freshness-gated hiding, active-tab visibility, overflow label/count, menu activation, outside press, Escape dismissal, and pointer propagation.
- `internal/AdapterState.ts:50,192,306-308` — no edit: retain keep-alive overflow atoms and cross-render width cache.
- `test/DockviewReact.test.tsx:104-131` — retain measured overflow and activation coverage; add explicit unmeasured/fits transitions, exact 32px reservation boundary, active visibility, and remount freshness.
- `test/DockviewReact.test.tsx:243-260` — retain StrictMode observer cleanup and assert no extra observer churn.
- `test/Gestures.test.tsx:252-303` — retain cached width/rect and hidden-tab drop-target behavior.
- `src/index.ts` — no export; disposition remains private.

Targeted source/barrel search found no existing overflow phase owner. The nearby `dock-tab-drag-phase` design changes gesture lifecycle in `Gesture.models.ts`; it shares the component but is a separate domain and must not be combined with measurement disposition.

# Guard-deletion accounting

Delete `unmeasured` and `allFit` at lines 358-360, the implication encoded by `unmeasured || widthFits`, and the `Bool.match(allFit)` branch at line 361. One literal derivation and match owns the three legal outcomes. Retain `measuredThisMount`, `firstMeasurement`, and the freshness render guard: they enforce cross-render publication rather than restating measurement fit.

# Encoded-side impact

None. This is private derived render control. Overflow atoms, cached widths, DOM attributes, ARIA label, panel order, and operations remain unchanged. Initial frames still show all tabs; measured fit emits no overflow; measured overflow reserves exactly 32px and keeps the active tab.

# Test impact

Extend public component tests through the ResizeObserver harness. Prove zero width and no measured tab widths show every tab without an overflow button; measured fit clears stale overflow; measured overflow preserves the exact capacity algorithm and active tab; a remount does not apply keep-alive hidden ids until its first measurement; the first equal measurement republishes; later equal measurements do not churn state. Preserve overflow click/menu activation, outside press/Escape behavior, drop-target geometry, and observer count returning to zero.

This is gesture-bearing UI because the overflow trigger/menu activates tabs. During implementation run the `browser-qa-loop` through the portless package script and retain record, extract, and judge evidence with `requiredCount: 0`.

# Risk and sequencing

Tier 1 private derived refactor. Coordinate with `dock-tab-drag-phase` because both touch `GroupPane.tsx`, but keep their models and commits reviewable. Main risks are first-frame flicker, stale hidden tabs after remount, changing the 32px capacity boundary, or reconnecting observers each render. No new state, public API, dependency, generated file, or generic helper is introduced.
