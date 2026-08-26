# GOAL: LeJeune Knowledge Desk Lab

Repo root: the current working directory. All paths are repo-relative.

Outcome: build the disposable "LeJeune Knowledge Desk" lab and run the fixed 30-minute story:
fragmented RFQ → reviewed quote with exact spans → cited clarification RFI → reviewed
time-bound veteran correction that changes the rerun → approval-gated supplier PO draft and
non-executing receipt.

Read these as the contract:

- `goals/lejeune-knowledge-desk-lab/{README,SPEC,PLAN}.md`
- `goals/lejeune-knowledge-desk-lab/ops/manifest.json`
- `goals/lejeune-knowledge-desk-lab/research/SOURCES.md`
- `goals/lejeune-demo-corpus-and-ontology/{SPEC,PLAN}.md`
- `explorations/lejeune-bolt-agentic-demo/{BRIEF,MAP,DECISIONS}.md`

Then read `AGENTS.md`, `CLAUDE.md`, the lab-app doctrine, and the
schema-first-development, effect-first-development, browser-qa-loop, and yeet skills.

Scope:

- In: one proposed `lejeune-bolt-workbench` lab (under `apps/labs/`), one-screen demo UI,
  lab-local review records, bundle integration, `/health`, service packaging, Tailscale Serve,
  MagicDNS HTTPS, fixed-output fallback, tests, and recorded rehearsal evidence.
- Out: public access, M365 or PST ingest, supplier integrations or portal automation, quote
  send, PO submission, general ontology or memory platform, Tauri/Semantica work, and reusable
  shared exports.

Execution:

1. P0 uses `bun run beep create-package` exactly once and lands the beep-branded screen
   scaffold on day 1. Never use `mkdir` to create the lab.
2. P1 makes every beat clickable on stub data by the end of day 2. Timebox
   `@beep/cosmos` browser proof to half a day; fall permanently to table plus source if it
   misses, with no static-image substitute.
3. P2 swaps in the bundle on days 3-4: exact spans and missing facts, cited rule RFI,
   timestamped `SYNTHETIC` offers, reviewed quote, veteran claim with validity and
   supersession, changed rerun, and internal approve/edit/reject records.
4. P3 packages one web artifact and one Effect API process, proves `/health`, tailnet-only
   MagicDNS HTTPS, offline replay, and the full recorded day-5 rehearsal through
   `bun run beep qa`; then drive the PR to merge-ready through `/yeet`.
5. P4 records evidence and `/reflect`, then flips state only when the completion gate is met.

Non-negotiable:

- Approve/edit/reject creates internal records only. Quote send and PO submission are
  structurally impossible; the receipt says no external action occurred.
- No public endpoint, raw corpus payload, real correspondence, scraped third-party content,
  uncited current commercial claim, or engineer-of-record implication.
- Every extraction, rule, offer, correction, and draft exposes source, review state,
  uncertainty, and stop point.
- The fixed story runs offline. The lab and mutable corpus delete or receive explicit promotion
  on 2026-09-30.

Acceptance: every `SPEC.md` criterion and manifest verification command passes with no unrelated
churn. Stop on an external-write path, public exposure, missing bundle capability, authorization
change, fallback failure, or scope beyond the fixed five-day story.
