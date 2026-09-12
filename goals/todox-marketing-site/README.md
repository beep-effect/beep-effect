# Todox Marketing Site

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Build the Terminal of Record marketing homepage for Todox in `apps/todox`:
one responsive public page that replays the deterministic synthetic
client-index-to-meeting-preparation session under claim-gated copy, with the
visual world documented through Impeccable and a private-walkthrough email
CTA.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/todox-marketing-site/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger
   (inherited from the exploration).
6. Binding design inputs in the source exploration:
   [`SHAPE-BRIEF`](../../explorations/todox-wealth-management-site/research/SHAPE-BRIEF.md),
   [`PUBLIC-COPY`](../../explorations/todox-wealth-management-site/research/PUBLIC-COPY.md),
   [`DEMO-SCRIPT`](../../explorations/todox-wealth-management-site/research/DEMO-SCRIPT.md),
   [`ASSET-PLAN`](../../explorations/todox-wealth-management-site/research/ASSET-PLAN.md).

## Current Phase

P2 complete on the redesign (2026-09-11, evening): Benjamin rejected the
Terminal of Record build and pinned a standard product site in his own palette
(Evergreen Ledger) with the Notion positioning. Rebuilt the same evening:
finish reviewer disposition `ship`, QA round 11 `requiredCount: 0` and round 15
capture green on the final code, app audit and package-verify green,
`apps/todox/DESIGN.md` rewritten from the built world. P3 (yeet publish → PR)
waits for Benjamin's explicit go; nothing is committed or pushed.

## Latest Evidence

See the evidence log in [`PLAN.md`](./PLAN.md). Typeface receipts:
[`history/fonts-and-licenses.md`](./history/fonts-and-licenses.md). QA harness:
[`history/qa/qa-capture.mjs`](./history/qa/qa-capture.mjs) (rounds live under
the gitignored `.beep/qa/`). Decompose-stage review artifact:
<https://claude.ai/code/artifact/8c7c7e46-5ff9-4e17-9396-e1399c0228b9>.

## Notes

- Graduated 2026-08-27 from
  [`explorations/todox-wealth-management-site`](../../explorations/todox-wealth-management-site/README.md);
  decisions and rejected alternates live in that packet.
- **Publication is deferred:** no yeet publish or PR until Benjamin
  explicitly green-lights it (2026-08-27, repo contention). Local work
  through P2 may proceed.
- The CTA ships against the `[walkthrough-email]` placeholder until Benjamin
  supplies the address (exception ledger in `SPEC.md`).
- Copy is claim-gated: wording changes re-run the PUBLIC-COPY reconciliation
  against the exploration's `CLAIMS.jsonl`.
