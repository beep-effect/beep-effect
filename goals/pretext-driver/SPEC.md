# Pretext Driver (@beep/pretext) Spec

## Objective

Wrap `@chenglou/pretext` as the repo driver **`@beep/pretext`**
(`packages/drivers/pretext`) so that text measurement — the last DOM-oracle
dependency in the workspace-as-data stack — becomes a typed, schema-first,
Effect-first capability any package can declare. The purity boundary maps to
driver entrypoint law:

- **Package root (browser-safe, pure):** `FontMetricsSnapshot` v1 contracts
  (versioned envelope + `EngineProfile`), decode/encode, and pure helpers
  over a decoded snapshot (line count, height, natural width). No canvas, no
  DOM.
- **`@beep/pretext/browser` (impure capture):** typed services over pretext's
  `prepare`/`prepareWithSegments`/`layout*`/`measureLineStats` surface,
  engine-profile detection, and snapshot capture (measure → encode). Requires
  `Intl.Segmenter` + Canvas 2D; absence is a typed error, never a crash.
- **Test layers:** fixture-backed metrics (first fixture: the checked-in
  Chrome/150 · Linux · 16px Arial capture) so every consumer tests DOM-free.

Observable end state:

- A consumer package depends on `@beep/pretext` root only and computes
  line counts/heights/natural widths from a decoded snapshot in vitest with
  zero DOM, zero canvas.
- Browser code captures a `FontMetricsSnapshot` through
  `@beep/pretext/browser` and the snapshot round-trips `encode ∘ decode`
  as identity.
- The scratchpad full-circle proof pattern (metrics → `GroupMinimumLookup` →
  dock kernel `project()`) reproduces against the driver's exported surface.
- Technical errors (measurement-unavailable, unsupported-font, decode
  failure) are centralized, typed, and carry no product vocabulary.

## Non-Goals

- Rebuilding, forking, or vendoring pretext internals (the validated
  accuracy corpus is the asset; revisit triggers live in the exploration's
  DECISIONS.md Q1).
- Any product surface: thread renderer, chat, dock-adapter wiring are later
  goals (`explorations/computable-workspace-geometry/MAP.md`).
- Cross-machine determinism claims: snapshots are per-engine values by
  design; API docs must say so.
- A server-side measurement backend (the snapshot value is the server-side
  story; upstream has none and rejected HarfBuzz for fidelity).
- Wrapping `rich-inline` until a consumer demands it; it is inline-only and
  must not grow block-flow ambitions.
- `system-ui` support (upstream macOS canvas/DOM divergence; reject or warn,
  never silently mis-measure).

## Constraints

- `@chenglou/pretext` enters as a **catalog dependency** (repo dependency
  policy); pin per catalog conventions.
- Driver law (`standards/architecture/03-driver-boundaries.md`): dev-safe
  typed services, centralized technical errors, test layers, no product
  vocabulary; root never browser-unsafe-by-accident — enforce with the
  repo's boundary subpath rules.
- Schema-first: contracts promoted from
  `scratchpad/computable-layout/FontMetricsV1.schema.ts` (S.tag(1) envelope,
  `EngineProfile` mirroring upstream quirk fences, S.Finite widths).
- Greedy first-fit semantics only; no justification claims.
- Effect v4 APIs verified against `.repos/effect-v4` before writing
  (memory doctrine: training data is v3).
- Scratchpad proofs are consumed/ported, then the superseded micro-breaker
  retires with a pointer (cleanup-on-touch, not big-bang deletion).

## Source Hierarchy

1. This SPEC and the parent exploration's DECISIONS/BRIEF/MAP.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and the numbered architecture docs
   (03-driver-boundaries, 07-non-slice-families).
4. Upstream pretext docs at https://github.com/PreTeXtBook/pretext (README API glossary,
   PLATFORM_BUGS ledger).

## Acceptance

- `bun run beep architecture`-conformant package shape for
  `packages/drivers/pretext` with root + `/browser` entrypoints.
- Vitest suites: root surface tested DOM-free via fixture layers; browser
  surface tested in the jsdom-with-canvas-stub or browser lane as repo law
  allows; encode∘decode identity; typed-failure paths.
- Full-circle test against the driver surface (may live beside the dock
  kernel scratchpad until @beep/dock graduates).
- Yeet completion gate: PR driven to mergeable.
