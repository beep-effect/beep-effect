# 2026-07-31 — Recorded full-UI E2E pass (Exception Ledger closure)

The dev-machine E2E acceptance criterion's missing evidence — one recorded
full-UI pass through the entire flow — now exists. Recorded via the
`browser-qa-loop` skill (Lane A playwright, real input, real Anthropic kernel
via `op run`-injected key, fresh PGlite store at `CHAT_DB_PATH`).

## The recorded flow (round 3, CAPTURE-GREEN, 6/6 scenarios)

1. **boot-chat-surface** — app boots into the workbench, chat panel live.
2. **create-thread** — thread created, sidebar row appears.
3. **send-rich-message-streams-blocks** — real message; assistant turn streams
   block-by-block (heading, list, code); finalizes and persists.
4. **cancel-in-flight-leaves-no-partial** — second turn cancelled mid-stream
   via the Stop control; only the `(stopped)` marker persists, no partial model
   content (locked contract).
5. **edit-as-branch-version-selector** — last user turn edited; rewrite streams
   a new branch; the version affordance renders on the branched turn.
6. **reload-history-intact** — full reload; turn counts, branch selection, and
   the version affordance survive; zero decode failures.

Artifacts in `round-3/`: schema-validated `inventory.json`/`inventory.md`
(`qa-inventory/v1`), capture `manifest.json` (all assertions green),
extraction `report.md`, judge `timeline.md`, `session.json`, and the
contact sheet. Full frame strips/clips/video remain in the untracked
`.beep/qa/round-3/` working set.

## Loop finding fixed en route (P1)

Round 2 proved the edit-as-branch flow worked but the version-selector
affordance (`turn-versions`) never rendered: `hasSiblings` was computed from
`activeBranchTurns` (which prunes the superseded sibling first), and a single
edit could never satisfy the shared-parent test anyway. Fixed in this branch
(`Thread.tsx` branch-point detection against the full timeline, active-branch
rendering unchanged) with a pinning render contract test. Round 3 re-recorded
green.

## Vision-judge findings and dispositions (round 3)

- **R3-01 (P1) "Reload resets to the original branch" — REFUTED as stated.**
  The cited frames show the thread scrolled to the top after reload; turn 1 is
  byte-identical in both branches. `activeBranchTurns` is deterministic — the
  highest-index replacement truncates at its parent, so reload restores the
  rewritten branch, and the harness's post-reload turn counts and affordance
  assertions passed. Honest residue, both known v1 scope: no scroll-to-bottom
  on initial load, and the version affordance is a static span (no interactive
  switching — "single-branch degenerate view first" per the packet spec).
- **R3-02 (P1) duplicate Stop controls while streaming — accepted, pre-existing.**
  Both the composer and the streaming turn expose stop simultaneously.
  Follow-up polish item; not introduced by this work.
- **R3-03 (P2) transient blank viewport during reload** and **R3-04 (P2)
  identical "New thread" sidebar names** — accepted, pre-existing polish
  follow-ups (R3-04 narrows to threads that never received a first message;
  title derivation names threads on first send, as the recording shows).
