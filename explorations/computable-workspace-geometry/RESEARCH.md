# Research — pretext technical map, the isomorphism, the cost audit

Self-contained: written so a cold session (any model) can act on this without
the originating conversation. Sources: firsthand reads of the local clone at
`~/YeeBois/dev/pretext` (README.md, thoughts.md, RESEARCH.md, AGENTS.md,
src/measurement.ts, status/dashboard.json) plus an Explore-agent full-tree map,
2026-07-12.

## 1. What pretext is (@chenglou/pretext v0.0.8, MIT, zero runtime deps)

Pure-TS multiline text measurement & layout that side-steps DOM measurement
(`getBoundingClientRect`/`offsetHeight` → reflow). **Not** a shaping engine:
no font-file parsing, no HarfBuzz (tried, rejected — didn't match browsers),
no WASM. The trick is deliberately parasitic:

- **`prepare(text, font)`** — one-time impure phase: `Intl.Segmenter`
  segmentation → glue/kinsoku/punctuation preprocessing → canvas
  `measureText()` per segment (hits the browser's font engine *without
  touching the layout tree*) → cached widths in `Map<font, Map<segment,
  metrics>>`. Width-independent output; horizontal-only.
- **`layout(prepared, maxWidth, lineHeight)`** — hot path: greedy first-fit
  line breaker, pure arithmetic over cached widths. No DOM, no canvas, no
  strings, no allocations. NOT Knuth-Plass (justification is demo-only).
- Key files: `src/analysis.ts` (segmentation/glue, 1339 ln),
  `src/line-break.ts` (walker, 1219 ln), `src/layout.ts` (API, 899 ln),
  `src/measurement.ts` (canvas + caches + engine profile, 272 ln),
  `src/bidi.ts` (pdf.js-derived UBA subset; render metadata only — line
  breaking does not consume levels).
- Rich APIs: `layoutNextLineRange()` (per-line variable width — the
  float/obstacle/multi-column primitive; cursor-chained), `walkLineRanges()`/
  `measureLineStats()` (non-materializing — shrinkwrap, "tightest width that
  still fits", missing from the web platform), `@chenglou/pretext/rich-inline`
  (chips/mentions/code-spans, atomic `break:'never'`, `extraWidth` pill
  chrome — inline-only by design).
- Numbers (`status/dashboard.json`, `benchmarks/chrome.json`): accuracy
  **7680/7680 exact** vs DOM in Chrome, Safari AND Firefox; `layout()`
  ~0.1ms per 500-paragraph batch (~200ns/paragraph); `prepare()` 9.45ms cold
  per 500; claimed 300–600× vs DOM measurement. Worker-capable
  (OffscreenCanvas).

### The purity boundary, precisely

`layout()` is pure. `prepare()` is **per-engine**: `getEngineProfile()`
UA-sniffs (Safari line-fit epsilon 1/64 vs 0.005; Chromium CJK quote-carry),
and canvas widths are engine/OS-specific. Pretext trades cross-machine
determinism for **exact per-browser fidelity**, validated by
browser-as-oracle sweeps with checked-in snapshots (`accuracy/*.json`,
`corpora/*`, `PLATFORM_BUGS.md` as committed bug ledger). Server-side: open
TODO; no headless backend matches real browsers (HarfBuzz rejected for this).

Key reframe: **the font metrics are themselves serializable data.**
`PreparedText` is parallel arrays of measured widths. Measure once in the
user's actual engine, ship the cache, and every downstream consumer — agent,
test, server — computes layout exact *for that user's screen*. The impurity
is not eliminated; it is quarantined as a value at the edge (same shape as
the dock kernel's host-supplied `DockBox`, same shape as Prose-to-Proof's
oracle-at-the-boundary).

### Methodology kinship (why this repo should trust it)

Browser as ground-truth oracle for iterating a pure reimplementation;
accuracy/corpus dashboards checked in; platform bugs in a committed ledger;
"README as public source of truth"; AGENTS.md demanding root-cause fixes and
holistic simplification passes. Cheng Lou's thoughts.md: *"The cost of
verifiable software will trend toward zero"*; README: canvas-as-oracle is
*"a very AI-friendly iteration method."* This is yeet/proof-loop epistemics,
independently evolved. He arrived at "truth outside the DOM; DOM as
projection; oracle at the boundary; costs in a ledger" — for text.

## 2. The isomorphism (the golden snitch)

The dock kernel's central claim (scratchpad/dockview/README.md): *"DOM state
is a projection of dock state, never the source of topology."* Its geometry
is already pure: `(DockNode, containerBox, gap) → DockGeometry`. Exactly one
fact on the web still forced the DOM to remain an *oracle*: nobody could know
how tall text is without asking the browser. That fact underlies
`cachedVisibleSize`, DOM-interleaved sash constraint systems, every
virtualizer's measure-cache, and all four beep-effect6 layout bugs
(min-content collapse, inert truncate, shrink-to-fit bubble, out-of-flow
header — each was "the browser was the only oracle and we asked it wrong").

Pretext deletes that fact. The composition closes:

- **Docks** — space = pure function of schema (built: dock kernel)
- **Blocks** — content = schema (built: @beep/md, @beep/lexical-schema)
- **Pretext** — text metrics = pure function of a prepared, shippable value

Workspace value + container box + font-metric cache → every panel box, every
block height, every line break — **computed headlessly**. The workspace is
not merely serializable; its *rendered geometry* is data. Upgrades
workspace-substrate §4: an agent doesn't operate the workspace blind — it can
compute what the user will see *before* acting ("will this title truncate at
240px?", "how tall is this thread?", "what ratio fits both panels?"). Agents
gain sight — per-engine-honest sight (see purity boundary above).

Pretext's own demos are the professional desktop's surfaces: `markdown-chat`
(virtualized rich chat), `bubbles` (bubble shrinkwrap), `rich-note`
(rich-inline), `editorial-engine`/`dynamic-layout` (obstacle-aware flow at
60fps — the dragon). The 2026 convergence is not coincidence: pretext exists
because AI made browser-free layout verification cheap and valuable; beep
needs browser-free layout because agents need the workspace legible as data.

## 3. The divergence-cost audit (the question that opened this packet)

Question: setting aside effort/maintenance, are the dock kernel's ledger
"costs" (scratchpad/dockview/README.md §Divergences) real? Audit verdict —
four classes:

**A. Not costs — better semantics (stop apologizing).** Proportional
hidden-group ratios (vs dockview's `cachedVisibleSize`: exact restore, zero
cached state); publish-once event timing (will/did pairs exist because
dockview interleaves DOM and state mutation — a projection architecture
structurally doesn't need them); whole-record parameter replacement;
merge-keeps-destination-metadata; non-empty groups by construction.

**B. Fidelity deltas eliminable at the host layer, no kernel change.**
MRU-on-close: the lossless outcome feed *is* a recency log — MRU activation
is a feed-consumer policy. Global focus: host envelope
`{ snapshot, activeGroup }`. Both are what the feed and policy layer were
built for.

**C. Real limits that are unwritten pure math.** The `[1000, 9000]`
SplitRatio bound genuinely forbids a 40px rail in a 2000px window — but
that's proportion conflated with pixel constraints; the fix is min/max-px
clamps in the pure geometry projection. Dockview's constraint system is
DOM-entangled *only because* content-aware minimums traditionally required
DOM measurement — pretext makes content-aware constraints ("this tab strip
needs 142px") pure inputs to a pure solver. The "deeper splitview constraint
system" triaged as out-of-scope is just math. Three-way rows: `rows()`
normalizing view already exists; N-ary is presentation, not model.

**D. Genuinely platform-bound (the honest residue — every dock system pays
these; ours pays least).** (1) Oracle maintenance: doesn't vanish, moves into
a committed regression-swept ledger (pretext proves this trade works).
(2) a11y: live regions, keyboard docking — real projection-layer work, no
cleverness dissolves it. (3) Popout windows / iframe-webview state loss on
reparent: the cost of content whose truth lives in the DOM. For blocks-native
panels, popout is lossless re-projection *by construction* — the famous hard
problem dissolves for first-party content and remains only for foreign DOM.

**Bottom line:** the ledger contains choices, host-layerable deltas,
unwritten arithmetic, and two irreducible platform debts. Almost no true
costs. Conventional knowledge ("you must adopt the incumbent or pay forever")
is wrong here for the same reason it was wrong about text layout.

## 4. Implications (candidate value, unordered)

- Exact virtualization for threads/documents (heights without measurement).
- Layout regressions become **unit tests** — the beep-effect6 bug class
  becomes assertable math (vitest, no jsdom rendering, no screenshots).
- Agent sight: compute-before-act over the visible workspace; agents choose
  panel sizes/splits to fit content.
- Content-aware dock constraints as pure solver inputs (kills the last
  "kernel can't do constraints without DOM" argument).
- Bubble shrinkwrap / `measureLineStats` for chat surfaces (the exact bug
  class fixed by hand in beep-effect6 round 2).
- Canvas/SVG/server render targets for blocks; popout re-projection.
- PreparedText-style metrics cache as a schema value → workspace snapshots
  can carry their own sight.

## 5. Open questions (also in ops/manifest.json)

1. **Integration seam**: dependency vs vendor vs effect-native rebuild. Note
   the calculus differs from dockview: pretext is MIT, zero-dep, tiny
   surface, and its irreplaceable asset is the *validated accuracy corpus +
   preprocessing rules*, not architecture we'd want to re-own. Leading
   instinct: consume/wrap, don't rewrite; schema-wrap the boundary
   (PreparedText codec) rather than the internals.
2. **Metrics-cache shipping format**: schema for (font, segment→width,
   engineProfile, emojiCorrection) so sight is reproducible per user engine.
3. **First proving consumer**: thread virtualization, shrinkwrap, dock
   constraints, or layout-as-tests. (Cheapest end-to-end proof probably
   layout-as-tests: no product surface changes, immediate CI value.)
4. Caveats to carry: per-engine fidelity only (no cross-machine determinism);
   no server backend yet; greedy breaker only; `system-ui` unsafe on macOS;
   requires `Intl.Segmenter` + Canvas 2D; rich-inline is inline-only — block
   flow stays ours.
