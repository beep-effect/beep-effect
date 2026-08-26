# LeJeune Knowledge Desk Lab Plan

## Status

Status: `pending`

Start only on Benjamin's signal. The screen scaffold may begin against stable stubs on day 1;
bundle-backed integration requires `lejeune/demo-corpus-and-ontology`.

## Phases

Phase ids and titles match `ops/manifest.json`.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Lab and screen scaffold | pending | Generate the single lab package and land the one-screen beep-branded shell. | Generator provenance exists; lab law passes; all fixed story regions and states are represented. |
| P1 Complete story on stubs | pending | Make the full 30-minute scenario clickable by end of day 2 and settle the graph fallback. | Every story beat runs on stubs; `@beep/cosmos` passes its half-day browser proof or table plus source is fixed as the lunch path. |
| P2 Bundle integration and review records | pending | Swap in extraction, citations, rules, offers, veteran correction, quote, and non-executing PO data on days 3-4. | Both RFQs and every review path pass; the approved correction changes the rerun; no external-write surface exists. |
| P3 Package, rehearse, and Yeet | pending | Prove offline runtime, `/health`, tailnet delivery, fixed-scenario tests, recorded browser QA, and hosted merge readiness. | Day-5 recording and offline proof pass; required checks and review threads are green; PR reports `merge-ready: yes`. |
| P4 Close | pending | Record evidence and reflection, then flip packet state. | Closeout reflection validates; 2026-09-30 disposition is recorded; packet is `completed-retained`. |

## Five-Day Walking-Skeleton Schedule

The split is ratified in the exploration
[`MAP.md`](../../explorations/lejeune-bolt-agentic-demo/MAP.md#five-day-schedule). The sibling
packet owns data outcomes on days 1-3; this packet owns the screen from day 1.

| Day | This packet owns | Bundle dependency |
| --- | --- | --- |
| 1 | Run the package generator and land the one-screen scaffold with beep branding and all story regions. | Consume stable fixture ids and stub contract from bundle P0. |
| 2 | Run the entire 30-minute story on stubs; spend at most half a day on browser-proven `@beep/cosmos`. | Use fixture-shaped stubs; do not wait for real projections. |
| 3 | Replace RFQ, span, missing-field, cited-rule, and uncertainty stubs with real bundle results. | Require the versioned bundle capability. |
| 4 | Integrate veteran claim review and changed rerun, timestamped offers, quote review, PO draft, and internal receipts. | Use stable queries and recorded replay outputs; add no corpus scope. |
| 5 | Package the web and API processes, prove `/health` and tailnet Serve, record the full rehearsal and offline fallback, and complete governance proof. | Freeze the immutable bundle used by the recording. |

Roughly half a day of day 5 remains reserved for package gates, schema-first and JSDoc
compliance, browser-QA evidence processing, and repository closeout.

## P0 Lab and Screen Scaffold

1. Create the proposed `lejeune-bolt-workbench` lab (under `apps/labs/`) with
   `bun run beep create-package`. Never hand-mint the directory.
2. Add a deletion-dated lab charter and keep all schemas, review records, operations, and UI
   lab-local.
3. Scaffold one screen with regions for RFQ/evidence, cited clarification, offer/quote review,
   veteran correction and rerun diff, and PO review/receipt.
4. Wire stub state for loading, missing fact, source-open, approve, edit, reject, changed rerun,
   fixed-output mode, and non-executing receipt.

## P1 Complete Story on Stubs

1. Drive the exact 30-minute sequence through real pointer and keyboard input on stub data.
2. Ensure every extraction, rule, offer, correction, and draft has a visible source, review
   state, uncertainty, and stop point.
3. Browser-test `@beep/cosmos` for at most half a day. If it misses, remove it from the lunch
   path and finish table plus source. Do not use a static image.
4. Prove approve/edit/reject creates only internal records and no quote-send or PO-submit
   action is addressable.

## P2 Bundle Integration and Review Records

1. Replace RFQ and evidence stubs with both bundle layouts, exact spans, and missing fields.
2. Open the cited specification refusal and generate the advisory RFI without implying
   engineering authority.
3. Integrate timestamped `SYNTHETIC` offers and certificates, the reviewed quote, and companion
   tool or test items.
4. Persist the veteran correction with source, reviewer roles, valid-from date, scope, and
   supersession; rerun the same RFQ and render the exact change.
5. Persist quote, claim, and PO approve/edit/reject records. End on the explicitly
   non-executing receipt.

## P3 Package, Rehearse, and Yeet

1. Package one web artifact and one Effect API process behind portless package scripts.
2. Add `/health` with safe build and bundle metadata only.
3. Prove one Tailscale Serve mapping and MagicDNS HTTPS URL for named tailnet users. Verify
   there is no public endpoint.
4. Disable provider and network access and run the full fixed-output scenario.
5. Record the complete day-5 rehearsal through the `browser-qa-loop` workflow using
   `bun run beep qa` record → extract → judge; fix required findings and repeat to zero.
6. Run repository proof and drive the PR through `/yeet` until `merge-ready: yes`, including
   zero unresolved review threads.

## Closeout Checklist

Before marking the packet closed:

1. Confirm every `SPEC.md` acceptance criterion and the manifest dependency edge.
2. Archive scenario, action-boundary, offline, `/health`, tailnet, and browser-QA evidence under
   `history/`.
3. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` and run the reflection-artifact lint.
4. Confirm the 2026-09-30 delete-or-promote charter is visible and testable.
5. Update `README.md`, this plan, and `ops/manifest.json` in the closeout PR.

## Execution Notes

- Preserve unrelated worktree changes and attribute failures before repairing.
- Design schema → service contract → Layer; use Effect Atom and Reactivity patterns for
  client/server state.
- Keep immutable bundle data separate from mutable internal review records.
- The dependency gates real integration, not the day-1 and day-2 stub scaffold.
- Record any friction immediately in the active packet's opportunities ledger, sanitized for
  this public repository.

## Verification Commands

```sh
test "$(wc -m < goals/lejeune-knowledge-desk-lab/GOAL.md)" -le 4000
jq . goals/lejeune-knowledge-desk-lab/ops/manifest.json
rg -n "lejeune-knowledge-desk-lab|GOAL.md|agentLaunchers|packetAnchorDocument" goals/lejeune-knowledge-desk-lab
git diff --check -- goals/lejeune-knowledge-desk-lab
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep yeet verify
```
