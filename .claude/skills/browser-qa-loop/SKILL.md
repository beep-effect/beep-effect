---
name: browser-qa-loop
description: >
  Run the browser QA loop against a UI change: a playwright capture harness
  drives real-input scenarios while `bun run beep qa record` captures video and
  a witness event log, `beep qa extract` pulls per-gesture frame strips, GIFs,
  and contact sheets, a codex vision task judges the evidence into a
  schema-validated inventory, Fable fixes the findings, and the loop repeats
  until zero required findings. Use for any milestone that changes pointer
  gestures, layout, animation, or user-facing UI — jsdom green is not
  click-works green, and a post-gesture screenshot is not a mid-gesture proof.
version: 0.3.0
status: active
---

# Browser QA Loop

The loop that closed dock-substrate-landing (6 rounds, 4 P0s + 8 P1s that
suites and hosted checks missed) and ontology-workbench-migration M4. Run it
before declaring any gesture-bearing UI milestone done.

History — 0.2.0: recording-based evidence (video + witness events + extraction),
structured `qa-inventory/v1` judgment, Lane B real-Chrome recipe, portless
guidance corrected. 0.3.0: Lane B deprecated (human-gated portal, silent
black captures); Lane C (Xvfb + XTEST) named as its replacement. 0.1.0:
screenshots-only loop.

## Why it exists

- jsdom stubs `setPointerCapture`: native pointer capture swallows button
  clicks invisibly to unit tests (shipped twice in one package before this
  loop existed).
- **Post-hoc screenshots cannot see mid-gesture failures.** The dock-react
  pointer fixes (selection smear across panels during a sash drag, a
  `pointercancel` orphaning resize state) are only visible *during* the drag —
  frame strips extracted from a recording are the only artifact class that can
  prove or falsify them.
- Vision judging catches what assertions cannot express: contrast, crowding,
  clipped content, confusing affordances, hover states that never apply,
  transitions that jump instead of ease.
- Programmatic assertions catch what vision cannot: key hygiene, node
  identity (keep-alive), console invariants, group topology, selection state.

## The loop

1. **Capture** — copy `resources/qa-capture-template.mjs` beside your app as
   `.beep/qa-capture.mjs` (gitignored) and adapt the scenario list. Run it
   through the recorder:
   `bun run beep qa record --lane playwright --app <app> --round N`
   — this starts the event collector, injects the witness (event log + fake
   cursor + sync beacon), records video via playwright `recordVideo`, and runs
   your harness. Scenarios still write `{ name, screenshots[], assertions[],
   consoleErrors[], notes[] }` into `.beep/qa/round-N/manifest.json`. Drive
   REAL input (`mouse.down/move/up`, `keyboard.press`) — never synthetic DOM
   events — and drive gestures SLOWLY (≥ 20 steps, ≥ 1.5 s) so extraction has
   frame density. Exit line: `CAPTURE-GREEN` or `CAPTURE-FAILURES: n`. Fix
   capture failures before judging.
2. **Extract** — `bun run beep qa extract --round N` correlates the witness
   clock to video time (sync beacon / OBS anchor), then writes per-gesture
   evidence into the round dir: `frames/` strips, `clips/` GIFs+snippets,
   `sheets/` contact sheets, each stamped with `XMP-beepQA` provenance.
   Check `report.md` for clock-sync confidence and budget warnings.
3. **Judge** — `bun run beep qa judge-pack --round N` builds `judge/`
   (timeline, file manifest with byte sizes, rendered prompt from
   `resources/judge-prompt.md`). Launch the vision judge:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task --model gpt-daybreak-blue-latest --effort high --prompt-file <round>/judge/prompt.md > <round>/judge/stdout.txt`
   (read-only sandbox — no `--write`). Then
   `bun run beep qa judge-ingest --round N --from <round>/judge/stdout.txt`
   decodes the JSON verdict, cross-checks every evidence path and event ref,
   and writes `inventory.json` + renders `inventory.md`. The exit gate is
   `inventory.json`'s `requiredCount`, not a grepped line.
4. **Fix** — Fable fixes P0+P1 (P2 at discretion), with unit/interaction tests
   where the bug class is testable. Adapter/pointer fixes must respect the
   `pressStartsOnButton` guard pattern.
5. **Repeat / Record** — bump the round, rerun capture → extract → judge.
   Exit when a round reports `requiredCount: 0` AND capture is green. The
   final round's `inventory.json` + `session.json` are the packet's QA
   evidence; reference them from the milestone PR body. GIFs may be embedded
   in PR bodies for humans.

## Evidence policy

- **The judge never ingests GIFs or video** — animated media is unreliable for
  vision models. Frame strips and contact sheets are the judge's motion
  evidence; `judge/timeline.md` gives it the ground-truth event timing to
  correlate against. GIFs exist for humans and PR bodies.
- Byte budget: judge payload ≤ 8 MB total, ≤ 400 KB per file; sheets/strips
  are JPEG q80 max-width 1600; ≤ 12 frames per gesture by default. Over
  budget, `judge-pack` drops assertion-green static screenshots first, then
  thins strips — every drop is recorded in `judge/manifest.json` so the judge
  knows what it did not see.

## Structured inventory contract

`qa-inventory/v1` schemas live in
`packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts`. The judge
emits ONE fenced JSON block; `judge-ingest` is the only writer of
`inventory.json`/`inventory.md`; `beep qa judge-lint --round N` re-validates
any round (use it in campaign exit checks). The prompt's lens list is bound to
the `QaLens` schema; run `bun run beep lint judge-rubric` after changing it.
Findings carry evidence refs
(artifact path + event sequence refs + frame ranges) and a `resolvedInRound`
field maintained across rounds.

## Lane B: real-Chrome OBS round — DEPRECATED 2026-08-01

**Do not start new rounds on this lane.** The PipeWire portal requires human
consent by design, so an OBS round can never run unattended, and a capture
whose restore token has gone stale records an entirely black video that every
downstream step accepts (deleting the `beep-qa` scene does NOT delete the
input, so `CreateInput` never re-runs and no picker appears — remove the INPUT
to force a fresh pick). Both failure modes are recorded as SYS-01/SYS-02 in
`goals/recorded-qa-acceptance/ledgers/findings.md`.

**Replacement: Lane C (Xvfb + XTEST), not yet productionized.** `Xvfb` +
headed Chrome (`--ozone-platform=x11`) + `xdotool` XTEST input + `ffmpeg
x11grab` + CDP for assertions. XTEST enters through the X server's input
pipeline, so Chrome cannot distinguish it from hardware — it anchors real
native text selections, which CDP provably cannot — and it needs no human and
no portal. Until the lane ships as `--lane x11`, treat native-input classes as
UNPROVEN rather than reaching for OBS: see the campaign packet's lane-decision
row for the evidence and the follow-up.

The OBS recipe below is retained only for an existing session that already has
a working scene:

1. Start the app via its portless script (e.g. `bun run --cwd apps/storybook storybook`).
2. `bun run beep qa record --lane obs --app <app> --round N` (`--url
   <absolute-url>` is the alternative; the target also supplies the
   collector's allowed origin) — provisions the `beep-qa`
   OBS scene (one-time PipeWire portal window pick; the restore token
   persists) and starts recording.
3. Launch codex against real Chrome with the routing wording from the
   `codex-browser-automation` memory verbatim: "use the chrome:control-chrome
   skill and the Chrome extension backend; do not use
   browser:control-in-app-browser and do not select iab."
4. Inject the witness with one JS call in the tab:
   `document.head.appendChild(Object.assign(document.createElement("script"), { src: "http://127.0.0.1:43117/witness.js?session=<id>&cursor=0" }))`
   Drive each checklist gesture; drop `bun run beep qa mark "<scenario>"`
   between gestures.
5. `bun run beep qa stop` → extract → judge exactly as Lane A.

## Dev servers

Canonical URLs are `http://<app>.beep.localhost:1355` via the portless-wrapped
scripts — never raw ports. Portless names are machine-global and a duplicate
registration **fails loudly** (no silent collision), so for a concurrent
worktree lane run a lane-suffixed name:
`portless storybook-<lane>.beep sh -c 'storybook dev -p "$PORT"'` →
`http://storybook-<lane>.beep.localhost:1355`. Never `--force` over another
lane's route. `PORTLESS=0` is diagnostic-only.

## Scenario checklist (adapt per surface)

Boot/default layout + persistence-key hygiene; every launcher entry
(focus-or-open); closed-by-default panels; tab overflow at narrow width;
every drop quadrant + one completed split; Escape-cancels-drag; float →
move → dock-back (watch console for StrictMode/useDisposable invariants);
keep-alive node identity across re-layout; theme toggle both ways; sash
resize against minima; reload restores. Gesture coverage (recorded): slow
sash drag across panel text; tab drag between groups; floating pane move +
grip resize; drop-quadrant hover previews; Escape AND `pointercancel`
injection mid-drag; hover states on tabs/menus; theme-toggle transition
correlated against recorded `transitionstart`/`transitionend` events.

## Environment notes

- codex sandbox cannot open listeners (vitest browser mode, dev servers) —
  captures run on the operator side; codex only judges files.
- Lane B depends on the codex extension-host bridge being healthy — see the
  `codex-browser-automation` memory for the repair and routing recipe.
  Lane A (`beep qa record --lane playwright`) is the always-available
  fallback.
- Session mechanics, lane choice, OBS provisioning, and collector/witness
  troubleshooting live in the `qa-session-ops` skill; evidence-reading
  mechanics in `motion-evidence-review`.
- Long publishes/proofs during the loop: nohup-detached + Monitor, never a
  harness background task (10-minute cap kills them).
