# Computable Workspace Geometry — pretext × dock kernel × blocks

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Text measurement was the last thing on the web that forced the DOM to be a
layout *oracle* instead of a *projection target*. Cheng Lou's
[pretext](https://github.com/chenglou/pretext) deletes that fact — text layout
becomes pure arithmetic over cached widths. Composed with the dock kernel
(space = pure function of schema) and blocks (content = schema), the entire
workspace render becomes computable headlessly: every panel box, block height,
and line break from data. Agents gain *sight*.

## Next Open Question

None. The 2026-08-13 ownership confirmation resolved the thread-renderer gate,
and [`goals/thread-virtualization`](../../goals/thread-virtualization/README.md)
now owns that work. Kernel residue is retained in
[`goals/dock-substrate-landing/README.md`](../../goals/dock-substrate-landing/README.md#residuals-from-scratchpad-what-is-left-v2)
after the original scratchpad route was retired.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump: the story, both scratch rambles, the dragon demo.
3. [`RESEARCH.md`](./RESEARCH.md) - pretext technical map, the isomorphism, the cost audit.

## Trail

- 2026-08-13: operator confirmed editor-stack ownership clear for the thread
  renderer (distinct from the 2026-07-14 desktop-shell release); graduated
  [`goals/thread-virtualization`](../../goals/thread-virtualization/README.md)
  and closed the exploration. The 2026-07-14 kernel-residue route named
  `scratchpad/dockview/WHAT-IS-LEFT.md`; after its 2026-07-16 retirement, the
  current copy lives in `goals/dock-substrate-landing/README.md` Residuals.

- 2026-07-17 — First step-4 surface migration closed: `goals/ontology-workbench-migration` (dock capabilities M1, zero-behavior workbench split M2, nine-panel shell M3, four-round QA loop M4) merged via PRs #429/#433/#434 + the closeout PR. The browser QA loop graduated into `.claude/skills/browser-qa-loop`. Exploration remains active for thread-virtualization (Goal 2, gated).

- 2026-07-17: dock-substrate-landing packet CLOSED (completed-retained). All
  four milestones merged (#416, #421, #426 + closeout); the desktop shell is
  a dock workspace with persistent layout, QA'd to zero required findings
  over six browser rounds. The exploration stays active for Goal 3
  (graph-3d) and future geometry threads.

- 2026-07-17: M3 shell landing — `apps/professional-desktop` now boots into a
  dock workspace: four keep-alive surface panels, localStorage snapshot
  persistence with boot restore and poisoned-key fallback, hash routing
  retired. The rendered shell is computable geometry end-to-end; interactive
  gesture QA moves to M4's browser rounds.

- 2026-07-16: M2 graduation — `@beep/dock-react` landed, the demo was
  rewired to package imports, and scratchpad `dockview` + `dockview-react`
  were retired (residuals moved to the packet README).
- 2026-07-14 (latest: DOCK GRADUATION OPENED, gate released): grill locked
  the landing arc — `@beep/dock` + `@beep/dock-react` under
  `packages/foundation/ui-system/` (purity boundary = package boundary), a
  ratified narrow ui-system→drivers DECISION for the pretext minima edge,
  and a four-coarse-panel dock shell replacing the professional-desktop
  hash switcher. beep-effect6 write-gate on the app RELEASED (owner
  confirmation; lane rotated off). Packet:
  [`goals/dock-substrate-landing/`](../../goals/dock-substrate-landing/README.md)
  (M1 kernel → M2 adapter + scratchpad retirement → M3 shell → M4 QA+close).
  Kernel-work-stays-scratchpad precedent ends here by design: graduation is
  the moment the packet system takes over.
- 2026-07-14: sibling review kept the packet active at `graduate`; reduced the
  resume surface to the thread-virtualization ownership/handoff gate and routed
  Q2 plus dock-kernel residue to their existing owners.
- 2026-07-14 (latest: bubble shrinkwrap LANDED — third consumer, surface
  grew): PR #399 merged (squash `00be3efd41`). `@beep/pretext` root gained
  the shrinkwrap primitives as pure word-granularity mirrors of upstream's
  line APIs: `LineRange`/`lineRanges` (one greedy fold, `lineCount`-identical
  break semantics, half-open word indices) and `LineStats`/`lineStats`
  (derived; field names mirror upstream). Proofs pin `lineStats.lineCount ==
  lineCount` and `maxLineWidth == naturalWidth` at unbounded width, plus
  exact fixture arithmetic (driver 23+1). `scratchpad/bubbles` proves the
  consumer: schema-first `ChatMessage`/`BubbleConstraints` → pure
  `bubbleBox` (width = min(maxWidth, maxLineWidth)+2·padding, height =
  lines×lineHeight; unmeasured → None), 5 bun tests. Greptile's one nit was
  real (undeclared `@beep/pretext` workspace dep) and taught the lesson:
  a scratchpad dep addition must resync tsconfig references AND fallow
  boundaries or repo-sanity fails. The demo harness gained `/bubbles.html`
  rendering `bubbleBox` live — the border is the math, the text just fits.
  Codex (gpt-5.6-sol medium) wrote the driver+proof lane in an isolated
  worktree; Fable reviewed, fixed the nit, and wrote the demo page.
- 2026-07-14 (demo harness + clamp proven in a live browser): the
  deferred smoke target landed as `scratchpad/dockview-demo` — a vite page
  (port 5199, no install: workspace symlinks resolve `@beep/*` to source)
  hosting the dock adapter with a seeded workspace (nested splits, floating
  pane, custom + text renderers) and `options.titleMinima` on live
  `PretextCaptureLive` (16px Arial, `TabChrome` 48/8). Headless-Chromium
  proof: at an 860px window the long-title group renders ~446px — its
  measured no-truncation floor, not its 30% ratio share (~250px); identical
  width at 1400px confirms the floor, not coincidence. Interactive
  drag-the-sash GIF still pending a connected Chrome extension session
  (non-gating). Arc kickoff decisions recorded: four sequential lanes —
  harness → bubble shrinkwrap → `goals/yeet-publish-preflight` →
  security-findings closeout + semantic-foundation M1.
- 2026-07-14 (later: minima wiring LANDED): the pinned design executed the
  same day on `feat/dock-minima-wiring` — codex (gpt-5.6-sol, medium) wrote
  both lanes under Fable review. Kernel: `poc/Minima.ts` (`TabChrome`,
  `titleWords`, pure `titleMinima` sum-of-tabs fold over the full forest,
  `makeTitleMinimaAtom` capture seam degrading to empty minima on
  waiting/failure) + 8 bun tests including end-to-end geometry clamps.
  Adapter: `options.titleMinima` on DockviewReact (default
  `PretextCaptureLive`, fixture layer injectable) feeding
  `makeDockGeometryAtoms.minimaAtom`; +3 jsdom tests (feasible clamp ≥
  measured requirement, no-config parity, capture-failure honesty). Suites:
  kernel 82/82, adapter 20/20, tsgo+biome clean. Also repaired en route: the
  effect 4.0.0-beta.97 catalog bump (#393) broke `S.Class` make() on plain
  tagged POJOs — five anchored-box construction sites migrated to variant
  `.make()` instances (was 6 kernel + 6 adapter test failures on main).
  Live-Chrome smoke deferred: no dev page hosts the adapter yet (candidate
  follow-up: tiny demo harness). Merged as PR #396 (squash `dc95033709`,
  2026-07-14).
- 2026-07-14 (goal #1 CLOSED, next slice gated): PR #391 **merged**
  (squash `1c0977ccad`); `goals/pretext-driver` flipped to
  completed-retained with closeout reflection
  (`history/reflections/2026-07-14-claude.md`, lint gate
  `blocking_findings=0`) and goals INDEX regenerated. Grill session closed
  the next-slice decisions: **dock-adapter title-minima wiring** is next
  (first real `@beep/pretext` consumer; exploration-tracked, NO goal
  packet, per kernel-work precedent), proof bar = fixture tests gate +
  live Chrome smoke as bonus; thread-virtualization stays gated —
  beep-effect6 lane re-confirmed still active on the editor surfaces.
  Design pinned: kernel-side `poc/Minima.ts` (pure `titleMinima` fold,
  sum-of-tabs floor + `TabChrome` allowances; `makeTitleMinimaAtom`
  effectful seam over `PretextCapture`) feeding the adapter's existing
  `makeDockGeometryAtoms.minimaAtom` input; adapter gets an optional
  `titleMinima` prop with `PretextCaptureLive` default and fixture layer
  injection for jsdom tests.
- 2026-07-13 (goal #1 executed): **`@beep/pretext` LANDED** at
  `packages/drivers/pretext` under `/goal` — catalog dep `@chenglou/pretext`
  0.0.8, `$PretextId` composer, root pure surface (FontMetricsSnapshotV1 +
  5-field EngineProfile synced to upstream 0.0.8, codecs with typed
  `PretextSnapshotCodecError`, pure greedy `naturalWidth`/`lineCount`/
  `textHeight`), `PretextCapture` service contract + Chrome/150 fixture
  test layer at root, `/browser` live capture (typed
  measurement-unavailable/system-ui rejection; engine-profile UA fences
  mirrored because upstream's exports map hides `getEngineProfile`).
  Proofs: 14 vitest + 1 skipped (live capture needs canvas), docgen 27
  examples green, and `full-circle-driver.test.ts` reproduces the
  full-circle theorem against the shipped surface (17/17 scratchpad).
  Scratchpad proof marked SUPERSEDED with pointer. Q2 v1 contract is now
  shipped matter; v2 residue unchanged.
- 2026-07-13 (kickoff, fresh account): align ran via /grill-with-docs — Q1
  RATIFIED (consume/wrap as driver `@beep/pretext`, root=pure /browser=
  capture per driver entrypoint law) plus kickoff shape, publish sequencing,
  and consumer sequencing recorded in DECISIONS.md. Arc published as PR #391
  (manual push + `gh pr create` + `yeet monitor`; yeet `--start-pr-early`
  has a circular `--monitor` requires-PR validation — reported). BRIEF.md +
  MAP.md written; **goal #1 graduated → `goals/pretext-driver/`** (manifest
  v2, SPEC, GOAL launcher, sources); goals INDEX regenerated. Stage →
  graduate. Next: driver implementation under /goal; goal-2 coordination
  gate stands.
- 2026-07-12 (burn to 100%): reactive minima atom landed
  (`makeDockGeometryAtoms.minimaAtom`, record-valued to dodge Atom.make
  function ambiguity) and the FIRST FEED CONSUMER landed —
  `poc/Recency.ts` (`touchedGroups` / `makeMruGroupsAtom`): most-recent-
  first group recency derived purely from Success+Changed feed entries,
  retiring half the MRU divergence. Kernel 75/75, formatted, annotations
  synced. Kernel residue now: max constraints, LayoutPriority,
  snap-to-collapse; feed residue: announcer/autosave/undo.
- 2026-07-12 (overtime): per-group minimums landed in the kernel —
  `GroupMinimumLookup` + `requiredExtent` (sum along axis + gap, max across
  axes; kernel 72/72, adapter 17/17) — and the **full-circle proof** landed:
  `scratchpad/computable-layout/full-circle.test.ts` imports the real kernel
  and proves metrics → naturalWidth → minimum lookup → `project()` →
  guaranteed one-line render, with the starvation counter-case. §5 of the
  substrate doc synced ("unwritten pure math" → partially written). Also
  fixed pre-existing `describe.concurrent` race in adapter Floating suite.
- 2026-07-12 (finale): TWO promotions from proof to matter. (1) The dock
  kernel itself gained `GeometryOptions.minGroupExtent` — per-split-local
  minimum-extent clamp in the pure geometry projection (feasible → both
  sides guaranteed; infeasible → proportional; default 0 behavior-identical;
  kernel 69/69, tsgo+biome clean) — first WHAT-IS-LEFT constraint item
  partially retired by exploration math. (2) Q2 v1 landed:
  `FontMetricsV1.schema.ts` versioned envelope + `EngineProfile`
  (computable-layout 13/13). Next session: ratify Q1 seam, then per-group
  minimum maps in geometry (feeding naturalWidth-style metrics), then v2
  contract residue.

- 2026-07-12 (later, same session — the genesis context's last 7%): first
  proof LANDED at [`scratchpad/computable-layout`](../../scratchpad/computable-layout/README.md) —
  live-Chrome oracle fixture (canvas widths + DOM wrap counts), 20-line pure
  greedy breaker, 8/8 under `bun test`: arithmetic reproduces the browser's
  own line counts at all three widths, AND the metrics cache round-trips
  through a first-draft effect `FontMetricsSnapshot` codec
  ([`FontMetrics.schema.ts`](../../scratchpad/computable-layout/FontMetrics.schema.ts)) —
  "shippable sight" is now typed matter, not prose. `DECISIONS.md` pre-seeded:
  Q1 seam recommendation written (consume/wrap; corpus-is-the-asset
  rationale; revisit triggers), Q3 partially closed by the proof.
  ATLAS.md entry added. Q3 residue: next consumer (virtualization vs
  shrinkwrap vs dock constraints).

- 2026-07-12: packet opened directly at research (capture + research landed
  same session). Firsthand reads: pretext README/thoughts/RESEARCH/AGENTS/
  measurement.ts; Explore-agent full technical map; dragon-reflow demo
  screenshotted live. Synthesis + divergence-cost audit written to
  RESEARCH.md; `docs/product/workspace-substrate.md` gained §4 "agents that
  can see" subsection and reframed §5 costs language the same day.
  ATLAS.md not yet updated (token budget); add the map line next session.
