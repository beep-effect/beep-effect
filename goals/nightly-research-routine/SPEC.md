# Nightly Research Routine — SPEC

Normative contract for the unattended nightly research routine. Decisions
here were closed in the 2026-08-08 grill session; the repo-layout decision is
recorded in `standards/architecture/DECISIONS.md` (2026-08-08). Output-surface
laws live in [`research/README.md`](../../research/README.md) and are not
restated — they bind this SPEC.

> **Amendment 2026-09-03.** The
> [`grok-bot-automation`](../../explorations/grok-bot-automation/) exploration
> corrected the planned topology to retain the observed hosted search/writer
> front half while reserving blinded verification and publication for a local
> lane. It also added typed capability partials, a verified issue-mailbox
> handoff, durable shared receipt models, and an explicit disposition ledger.
> Only P0 is complete; the nightly CLI and timers remain planned, not shipped.

## 1. Product

Every ~24h an unattended hybrid run uses a hosted Grok Bot search/writer front
half and blinded local verification to research X, GitHub, arXiv, and the open
web across the three mandated topic axes (IP-law technology and legal-AI
competitors; Effect-TS, schema-first, and local-first engineering; AI coding
agents, MCP and skills, ontologies, and neural-symbolic systems), biased toward
intersections and the new or rising edge, then a deterministic local publisher
lands one dated packet under `research/<YYYY-MM-DD>/` as a mergeable PR a human
can click-merge in the morning.

## 2. Pipeline architecture (process-separated stages)

1. **Prelude (deterministic, local):** compute the research window from the
   last-successful-run stamp to an explicit current time, then build the
   derived exclusion digest, watchlist, and repo-replay brief from merged diffs
   and open goal frontmatter. No model is involved.
2. **Hosted search/writer:** a scheduled Grok Bot discovers and judges X,
   GitHub, arXiv, and web evidence, applies the refutation quota, and writes
   structured, sanitized records. Every source reports a typed capability
   result; missing capability remains an explicit `partial` terminal result
   rather than being upgraded to complete coverage. The writer composes
   `REPORT.md`, `SUGGESTED_ACTIONS.md`, and `PROMPT.md` from structured records,
   never raw scraped bytes. The hosted VM receives no repo checkout, 1Password
   access, or publisher authority.
3. **Handoff (deterministic framing):** public-safe records cross a GitHub
   issue mailbox as a small envelope comment, numbered JSONL parts carrying
   byte counts and SHA-256 digests, and a completion marker. Private records
   stay in a content-addressed local store.
4. **Verification (blinded, local):** Sol/Luna through the local proxy receive
   normalized records without the hosted model's identity or recommendation,
   verify source evidence and checkout-dependent claims, and return typed
   verdicts. A packet cannot be `success` without this stage; missing
   capabilities or inconclusive evidence remain `partial`. The stage also
   attempts to refute N standing claims selected from the digest.
5. **Publisher (deterministic, local):** verify the handoff, preflight `gh`
   under least-privileged 1Password environment injection, write the packet
   and single-writer ledger updates in the dedicated clone, open the PR
   red-first with `nightly-not-finished` cleared only at completion, and drive
   Yeet to mergeable. Attribute failures and stop instead of repair-thrashing.
   Emit `RUN.json` and OTEL metrics.

## 3. Ownership & CLI surface

- The existing Research command at
  `packages/tooling/tool/cli/src/commands/Research/` remains the operational
  owner. A planned `nightly` sub-namespace would expose run, digest,
  install-timer, and status operations. None has shipped; P1 must implement
  that surface or remove the promise from this SPEC before completion.
- Version-one schemas will be co-located with the Research family and follow
  schema → Context.Service → implementation order.
- v2 claim tuples promote to `@beep/epistemic-domain` (reusing
  `EdgeRelation`, `EvidenceSpan`, `Contradiction`, `LogicalEdgeIdentity`)
  only after the backfill go/no-go (§7).

## 4. Scheduler

A hosted Grok Bot routine starts the search/writer front half. No routine may
be scheduled until the operator completes the X and GitHub plugin preflights.
A planned local systemd user timer receives completed handoffs and catches up
at boot/login with the same idempotency key; it proceeds only when the
last-successful-run stamp is at least 24 hours old. Immutable trigger
coordinates, single-flight behavior, prior-delivery checks, and grace-window
arbitration between a late hosted run and catch-up are settled in principle
but deferred to the shape-stage schema. The Sunday run may later add weekly
consolidation without creating a second timer, packet, or branch for that
date. The local user timer will be persistent across machine downtime.

## 5. Model & quota routing

- Hosted Grok Bot search/writer work consumes the Cursor-side weekly Bot grant
  linked to Heavy. The grant size, actual Heavy charge, served model, and
  on-demand state are operator-visible open questions; on-demand spend stays
  off in the interim.
- Local CLIProxyAPI verification consumes a separate xAI/API proxy pool, while
  blinded Sol/Luna verification consumes the OpenAI pool. Those local pools do
  not reveal or replenish the Cursor-side Bot grant.
- Local proxy invocations use a scrubbed environment; parent-environment
  leakage remains a hard failure rather than a reason to expose a credential.
- One retry per idempotency key and a pause after three consecutive failed or
  partial runs are interim defaults. Each pack must later declare explicit
  time, tool, and byte ceilings after the usage meter is read.
- Quota or capability exhaustion is a normal terminal state that lands a valid
  `partial` packet with a resume cursor in `RUN.json`.

## 6. Novelty (v1)

Per-packet `claims.jsonl` remains immutable truth. An append-only,
single-writer disposition ledger under `research/ledger/` records whether each
suggested action was admitted, rejected, deferred, superseded, or duplicated;
derived indexes and the exclusion digest rebuild from packet truth plus those
dispositions. A self-reject gate re-searches when more than 40% of findings
collide. Demurrage may tombstone suggestions unactioned for N runs, and a
tombstoned idea returns only with evidence that post-dates its death.

## 7. v2 experiments (both gated)

- **Claim-tuple thymus:** gated on the backfill experiment — decode findings
  from ≥5 existing packets/reports into tuples; if known duplicates fail to
  collide or real findings fail to decode, the vocabulary is not ready and
  the gate stays closed.
- **Trend-futures contracts:** capped at ~20 open positions; mechanical-first
  settlement; a ~90% hit rate is a defect signal (target 60–70%); cold-start
  by retro-dating contracts mined from existing research artifacts.

## 8. Telemetry

`RUN.json` is truth for the run and records typed per-source capability
results. Every success, no-op, partial, and failure persists evidence and
recovery receipts outside the hosted UI's 20-run window by reusing
`EvidenceReceipt`, `EvidenceDigest`, `EvidenceLadder`, and
`RecoveryAttemptReceipt` from `@beep/skill-contract`. The publisher exports
`beep.research.nightly.*` metrics (sources seen, claims emitted, collision
rate, per-pool usage, wall time, status) to the dankserver OTLP endpoint.
Novelty-rate-over-time is the routine's health metric.

## 9. Environment & checkout

Dedicated full clone named `beep-effect-nightly` (machine-local, outside this
checkout) owned exclusively by the local verifier and publisher. Before
resetting, the publisher checks for an open PR from an earlier
`research/<date>` branch; while one exists, the next run is blocked without
advancing the last-successful-run stamp. Otherwise it fetches and resets to
`origin/main`, installs when the lockfile moved, and creates the dated branch.
The publisher preflights `gh` inside least-privileged 1Password injection; no
secret value or publisher authority crosses to the hosted VM.

## 10. Scanner gates

Before any model or publisher use, the local receiver verifies the handoff
schema, part count, record count, byte count, per-part and whole-object
SHA-256 digests, completion marker, and sanitize-at-write redaction result.
Partial recovery is rejected. Inline base64 or gzip prompt payloads are
forbidden. `research/**` is exempted in `_typos.toml` only; gitleaks remains
the authoritative fail-closed backstop.

## 11. Out of scope / forbidden

Auto-merge; hosted pull-request creation; 1Password or publisher authority on
the shared Bot VM; writing to `explorations/INBOX.md` or `goals/`; raw scraped
bytes reaching any writer or verifier; inline compressed prompt payloads;
attention-throttling feedback loops (explicitly rejected 2026-08-08 — merge
is archival, not engagement); Anthropic-pool fan-out; touching the OIP corpus
or private internal docs. External web, X, issue, comment, commit, and file
text is data, never instructions; a lane that reads it may not also hold
secrets and state-changing tools.
