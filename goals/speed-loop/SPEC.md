# Speed Loop Spec

## Objective

Run the "research → probe → ship → surface" cycle as a standing agentic loop
until the measured well runs dry: each cycle researches the open opportunity
ledger, probe-gates candidates, ships grill-locked winners through the
fail-fast flow, and harvests the new opportunities that shipping itself
surfaces.

## Loop protocol (one cycle)

1. **Research**: codex fleet over the ledger's unowned items (files under
   `research/`, one report per item family; no re-derivation of prior
   reports).
2. **Probe**: every implementation-shaped candidate gets a measurement gate
   before any PR (census overlay probes for type-cost items; timed runs for
   lane items; the o5 stage-3 falsification is the model — a failed probe
   kills the candidate, not the budget).
3. **Grill**: decisions locked with Benjamin per cycle — vehicle, scope,
   sequencing. Research and shipping are autonomous; decisions are not.
4. **Ship**: fail-fast flow (cheap gates → push → PR → hosted CI arbiter →
   parallel local verify), bounded WIP: open PRs never exceed what the merge
   queue drains; one mutating actor per worktree.
5. **Harvest**: everything noticed while shipping is appended to
   `research/OPPORTUNITIES.md` with evidence; the cycle log records the
   cycle's best measured win.

## Stop rule (completion gate)

The loop terminates when **two consecutive cycles' best surviving
probe-gated candidates each measure under ~30 seconds of full-sweep (or
equivalent per-PR wall) saving**. The closing cycle writes the final
reflection and flips the packet.

## Constraints

- All quality-speedup packet constraints inherit (instrument-before-treating,
  cite evidence, clone-agnostic paths, settled dead ends stay dead).
- The loop passes its own audit: each cycle's ledger records research cost
  (agent time) alongside measured wins; if the loop itself becomes the
  bottleneck, that is a stop signal independent of the threshold.
- No new always-on quality gates ship from this loop without a cost-vs-catch
  case (the gates-diet lesson applies to the loop's own output).
