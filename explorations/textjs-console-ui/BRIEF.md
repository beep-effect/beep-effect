# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

The operator runs a dozen agent sessions at once. On 2026-11-10 the session
ledger held 12 live rows for this repository; the SessionStart hook prints
them as a wall of text into every new session, and the only way to look again
is to rerun `bun run beep session open`. Nothing stays on screen, nothing
sorts blocked lanes to the top, and nothing can be navigated.

Every operator surface in the repo is line-oriented CLI output
([`RESEARCH.md`](./RESEARCH.md), "In-Repo Capability Inventory"). A web
dashboard would fix that, at the cost of the repo's most expensive
verification loop: a recorded browser session and a vision judge per change.

Text.js suggests a third option. A cell-grid UI serializes to a few hundred
characters of text, so an agent can build it and check it with frame
assertions at unit-test cost. The open question is whether the operator would
use such a surface. That is cheap to find out and cannot be answered on
paper.

## Appetite

One working day of agent time to build, then one working day of operator use
as the keep test. Circuit breaker: if two hours in there is no frame drawn
from real ledger data, stop and write down why.

The bound shapes the solution: one panel, read-only, one data source that
already has machine output, no new exports, a lab app that one command
deletes.

## Solution Sketch

A lab app, `apps/labs/lane-cockpit`, that draws the live lanes board
full-screen in a terminal.

```text
 beep session open --json        every N seconds, from an Effect fiber
          │
          ▼
   Schema decode  ──▶  lanes state  ──▶  <LanesBoard lanes filter selected>
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         ▼                                           ▼
            renderToTerminal (Ghostty pane)             testing.render (fixtures)
            the operator watches this                   frame assertions, no browser
```

The board, at fat-marker fidelity:

```text
╭ Lanes  12 live · 2 blocked · oldest 2d ─────────────────────────────────────╮
│ ! eloquent-moore-73e9aa   blocked  —      8h   stood down by orchestrator   │
│ ! beep-effect11           blocked  —      1d   reboot: successor runs /op…  │
│ > yeet-async-merge        open     —      12m  finish slice A package proof │
│   residue-closeout        open     #3073  16m  ready; monitor holds window  │
│   github-budget-ledger    open     #3068  30m  final-check running          │
│   …                                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ yeet-async-merge · feat/yeet-async-merge · codex                            │
│ next: Finish slice A package proof, publish async merge PR through Yeet…    │
│ checkout: ~/YeeBois/projects/beep-effect-worktrees/yeet-async-merge         │
╰ ↑↓ move · / filter · enter expand · y copy path · p copy PR · q quit ───────╯
```

Elements:

- **Ordering.** Blocked first, then by age of the last note. Age is always
  shown; a stale row is never hidden or dimmed into looking current.
- **Detail pane.** The selected lane's full `next`, `summary`, branch,
  harness and checkout path.
- **Keys.** Move, filter by text, expand, copy path, copy PR link, quit.
  Nothing writes.
- **Boundary.** The component takes decoded rows as props. Polling,
  subprocess and decoding live outside it in Effect, so the tests feed
  fixtures and never wait on a timer.
- **Proof.** Frame tests cover ordering, selection, filter, the empty ledger
  and a ledger with corrupt rows.

The keep test is the operator's: the pane stays open for a working day and
gets used before `beep session open` does.

## Rabbit Holes

- **Session services are not public.** `SessionLedger` is exported only
  through the `@beep/repo-cli/test/Session` test-kit. Patched: read
  `bun run beep session open --json` and decode it; no export changes
  ([`DECISIONS.md`](./DECISIONS.md), "data seam").
- **Test runner.** Labs obey the code law, which means `@effect/vitest`.
  Text.js documents Vitest support, but only `bun test` was run here. First
  hour of the spike: prove `render` under the repo's Vitest. Inherited risk if
  it fails: the circuit breaker fires.
- **`lint:shadcn`.** The strict Tailwind `className` lint could read Text.js
  cell utilities (`flex-col p-1 border`) as Tailwind. Patched: style with
  typed props, not `className`.
- **Atoms on a foreign reconciler.** `@effect/atom-react` on `@textjs/react`
  is untested. Patched: the board is props-in; plain React state at the edge
  is acceptable for a spike. One hour at most on atoms.
- **Real timers.** Text.js has no fake clock. Patched by the boundary above:
  no timers inside the component.
- **Upstream churn.** Six minors in five days. Patched: exact pin
  `@textjs/react@1.6.1`, no upgrade during the spike.
- **Stale ledger rows.** Some live rows are two days old. Patched: show age.
  Cleaning the ledger is not this work.

## No-Gos

- No writes: no messaging a session, no ledger notes, no lane retirement.
- No `@textjs/app`: no App Router, no `text run`, no `text mcp`.
- No agent frame reading. Agents keep `session open --json`.
- No DevTools-console target and no embed.
- No reuse of, or change to, `@beep/ui`.
- No new `@beep/repo-cli` command or export.
- No second panel: reds, merge gate and fleet headroom wait for the keep test.
- No promotion out of `apps/labs/` inside this spike.
