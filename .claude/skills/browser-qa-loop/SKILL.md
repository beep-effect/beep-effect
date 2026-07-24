---
name: browser-qa-loop
description: >
  Run the browser QA loop against a UI change: a playwright capture harness
  drives real-input scenarios and screenshots into .beep/qa/round-N/, a
  codex vision task judges the images into an inventory, Fable fixes the
  findings, and the loop repeats until zero required findings. Use for any
  milestone that changes pointer gestures, layout, or user-facing UI —
  jsdom green is not click-works green.
version: 0.1.0
status: active
---

# Browser QA Loop

The loop that closed dock-substrate-landing (6 rounds, 4 P0s + 8 P1s that
suites and hosted checks missed) and ontology-workbench-migration M4. Run it
before declaring any gesture-bearing UI milestone done.

## Why it exists

- jsdom stubs `setPointerCapture`: native pointer capture swallows button
  clicks invisibly to unit tests (shipped twice in one package before this
  loop existed).
- Vision judging on screenshots catches what assertions cannot express:
  contrast, crowding, clipped content, confusing affordances, ugly defaults.
- Programmatic assertions catch what vision cannot: key hygiene, node
  identity (keep-alive), console invariants, group topology.

## The loop

1. **Capture** — copy `resources/qa-capture-template.mjs` beside your app as
   `.beep/qa-capture.mjs` (gitignored) and adapt the scenario list. Each
   scenario records `{ name, screenshots[], assertions[], consoleErrors[],
   notes[] }` into `.beep/qa/round-N/manifest.json`; screenshots land beside
   it. Drive REAL input (playwright `mouse.down/move/up`, `keyboard.press`)
   — never synthetic DOM events. Run against the dev server
   (`PORT=<p> bunx vite ...`; portless names collide across worktrees, so
   pin an explicit port per lane). Exit line: `CAPTURE-GREEN` or
   `CAPTURE-FAILURES: n`. Fix capture failures before judging — they are
   real bugs or harness bugs, and both block.
2. **Judge** — launch codex (`gpt-5.6-sol`, effort **high**) with the
   vision-judge prompt (see below). It views every screenshot and writes
   `.beep/qa/round-N/inventory.md`: per finding an ID (`RN-NN`), severity
   (P0 blocker / P1 should-fix / P2 polish), screenshot evidence, and a
   concrete fix; final line `REQUIRED FINDINGS: <P0+P1 count>`.
3. **Fix** — Fable fixes P0+P1 (P2 at discretion), with unit/interaction
   tests where the bug class is testable. Adapter/pointer fixes must respect
   the `pressStartsOnButton` guard pattern.
4. **Repeat** — bump `QA_ROUND`, rerun capture + judge against the fixed
   build. Exit when a round reports `REQUIRED FINDINGS: 0` AND capture is
   green.
5. **Record** — the final round's inventory + manifest are the packet's QA
   evidence; reference them from the milestone PR body.

## Vision-judge prompt shape

Point codex at the round directory; require it to view every screenshot;
enumerate the lenses (visual hierarchy, dark-mode contrast, tab strip
legibility, drop-preview clarity, menu affordances, empty/clipped/overflow
content, floating chrome, layout proportions); findings only, no praise
padding; fixed inventory format with the `REQUIRED FINDINGS:` verdict line;
forbid writing anything but the inventory.

## Scenario checklist (adapt per surface)

Boot/default layout + persistence-key hygiene; every launcher entry
(focus-or-open); closed-by-default panels; tab overflow at narrow width;
every drop quadrant + one completed split; Escape-cancels-drag; float →
move → dock-back (watch console for StrictMode/useDisposable invariants);
keep-alive node identity across re-layout; theme toggle both ways; sash
resize against minima; reload restores.

## Environment notes

- codex sandbox cannot open listeners (vitest browser mode, dev servers) —
  captures run on the operator side; codex only judges files.
- Hands-on codex Chrome control (extension bridge) is the deeper follow-up
  when available — see the `codex-browser-automation` memory for the repair
  and routing recipe; playwright capture is the always-available fallback.
- Long publishes/proofs during the loop: nohup-detached + Monitor, never a
  harness background task (10-minute cap kills them).
