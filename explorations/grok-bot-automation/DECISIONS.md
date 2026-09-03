# Decisions

## 2026-09-03 — Vehicle

**Question:** Is bot automation another phase of `beep-mode`, or a separate
piece of work?

**Answer:** Bot automation is this sibling exploration packet and will later
graduate into a goal. It is not a fourth `beep-mode` phase. The binding
`beep-mode` decisions are the vendor shape, model-role routing surface, agents,
the autonomy contract ("gate design, free the rest, never merge"), stickiness
outside Cursor, evaluation before promotion, and graduation shape.

**Rationale:** Benny's Cursor-specific files stay out, while its evidence and
authority rules transfer. A sibling packet preserves those laws without
conflating a hosted product integration with the pstack-port roadmap. See
[`beep-mode/DECISIONS.md`](../beep-mode/DECISIONS.md).

## 2026-09-03 — Pack root

**Question:** Where do authored bot packs, deployment configuration, and
runtime implementation live?

**Answer:** Authored packs live at top-level
`bots/packs/<slug>/{manifest.json,BOT.md}`. Deployment configuration stays
outside a pack under `bots/deployments/` or `$XDG_CONFIG_HOME/beep/bots/`, with
secrets represented only as `op://` references. Runtime schemas, validation,
rendering, dry-run behavior, timers, and receipts live in
`packages/tooling/tool/cli` as a planned `Bots` command group. The first pack
PR creates the root; this exploration PR does not.

**Rationale:** The pack is authored repository truth, deployment is
environment-specific, and automation routes to tooling under
`standards/architecture/07-non-slice-families.md`. The accompanying
architecture decision records the new root before content lands there.

## 2026-09-03 — Version-one write authority

**Question:** What may the first generation of bots write?

**Answer:** Reports, GitHub issues, and handoff artifacts only. Schemas may
later admit pack-specific local Yeet draft-PR authority after several clean,
deduplicated runs. Hosted connectors never open pull requests. Merge is never
delegated.

**Rationale:** Proposal-only operation yields evidence about precision,
duplication, and recovery without giving an unproven hosted lane repository
write authority. Promotion is earned per pack and publication remains local.

## 2026-09-03 — First bot and sequence

**Question:** Which bot proves the contract first, and what follows it?

**Answer:** Start with report-only `effect-v4-upstream-watch`. Promotion
requires no-change and real-change fixtures, identical idempotency keys across
hosted and local runs, rejection of truncated or capability-incomplete
handoffs, explicit capability partials, and zero duplicate deliveries. Follow
with research suggested-action reconciliation, knowledge and staleness
disposition, then one-package documentation enhancement. That last pack is the
first candidate for earned write authority.

**Rationale:** An upstream watch has a bounded subject and externally visible
changes, making it a clean test of hybrid discovery, local verification,
handoff integrity, and deduplication before mutation is considered.

## 2026-09-03 — Runtime rule

**Question:** Which environment owns discovery, sensing, verification, and
publication?

**Answer:** Hosted Grok Bot discovers and judges across web, X, GitHub, and
computer-use. GitHub Actions senses deterministic repo and GitHub state. A
local timer or CLIProxyAPI proxy lane verifies checkout-dependent facts such as
`bun`, the Effect reference checkout, the 1Password shim, and recorded browser
QA. The local lane is the only publisher and uses Yeet. Local timers catch up
at boot with the same idempotency key.

**Rationale:** No single environment has both the hosted discovery surfaces and
the trustworthy local checkout. The split turns broad hosted judgment into a
proposal and reserves evidence-bearing publication for the controlled lane.

## 2026-09-03 — Handoff transport

**Question:** How does hosted output reach the local verifier without silently
truncating or leaking private content?

**Answer:** Public-safe output uses a GitHub-issue mailbox: a small envelope
comment, numbered JSONL parts carrying byte counts and SHA-256 digests, and a
completion marker. The receiver verifies schema, part count, record and byte
counts, digests, completion, and redaction before model or publisher use, and
rejects partial recovery. Private records use a content-addressed local store.
Inline base64 or gzip prompt payloads are forbidden.

**Rationale:** Issue comments are inspectable and available to both sides, but
their transport limits and partial-failure modes require deterministic framing.
Public and private records need separate custody rather than clever prompt
encoding.

## 2026-09-03 — Nightly research routine

**Question:** How should the existing nightly-research goal reflect the
observed hosted topology?

**Answer:** Retain a hosted search and writer front half with typed per-source
capability partials; `partial` remains a valid terminal state. Require blinded
local Sol/Luna verification through the proxy for a `success` packet. Use the
verified handoff envelope, then a deterministic local publisher that preflights
`gh` under least-privileged 1Password injection and runs Yeet. Dispositions for
suggested actions go to an append-only, single-writer ledger outside immutable
packets. The promised nightly CLI is planned, not shipped; a later goal phase
must implement it or remove it from the SPEC. PLAN and README must say only P0
is complete.

**Rationale:** Five partial packets containing 106 claims and 101 suggestions
show the hosted front half is productive, while the audit shows local proof,
publication, and disposition are still missing. Documentation must describe
the observed system and current delivery state.

## 2026-09-03 — Receipts reuse

**Question:** Should bot automation define a new receipt model family?

**Answer:** No. Bot receipts and evidence bind `EvidenceReceipt`,
`EvidenceDigest`, `EvidenceLadderState`, and `RecoveryAttemptReceipt` from
`@beep/skill-contract`. Every run persists a receipt for success, no-op,
partial, and failure outside the Bot UI's 20-run window.

**Rationale:** The existing models already express evidence, ladders, digests,
and recovery. Reusing them keeps bot proof comparable with other agent work and
avoids a parallel evidence vocabulary.

## 2026-09-03 — Security boundary

**Question:** What authority may the shared hosted Bot VM hold?

**Answer:** No 1Password or publisher authority. The VM uses provider OAuth
only, requires approval for state-changing tools, and treats external text as
data rather than instructions. A routine reading untrusted web, X, issue, or
repository content must not also hold secrets and state-changing tools.

**Rationale:** This is existing doctrine, not a new policy choice. Bot roles
share a VM and are not isolation boundaries; applying the Rule of Two prevents
untrusted content, secrets, and external mutation from converging in one lane.

## 2026-09-03 — DEFERRED: numeric budgets and pause thresholds

**Question:** What exact usage, time, tool, byte, retry, and pause limits bind a
pack?

**Answer:** **DEFERRED** until the operator reads Grok Bot Settings → Usage and
billing and `cursor.com/dashboard/usage`. The interim default is one retry per
idempotency key, pause after three consecutive failed or partial runs, explicit
time/tool/byte ceilings per pack, and on-demand spend off.

**Rationale:** The weekly Heavy grant and actual charge are account facts, not
safe values to infer from marketing or the separate xAI API pool.

## 2026-09-03 — DEFERRED: trigger, dedupe, and backpressure schema

**Question:** What are the exact immutable trigger coordinates, single-flight
rule, prior-delivery gate, and grace-window arbitration between a late hosted
run and local catch-up?

**Answer:** **DEFERRED.** The principles are locked, but the schema shape will
be decided during the shape stage.

**Rationale:** Identical idempotency keys, single delivery, and catch-up are
required. Encoding them now would add an ungrilled schema decision to an align
packet.

## 2026-09-03 — DEFERRED: X and GitHub plugin preflights

**Question:** Are the X and GitHub hosted connectors ready for a scheduled
routine?

**Answer:** **DEFERRED** until the operator checks `console.x.com` for Project,
pay-per-use, and Production state and inspects the Grok Bot GitHub plugin OAuth
and tool list. No dependent routine may be scheduled first.

**Rationale:** The evidence contains connector enrollment and capability
failures. Account-scoped console facts cannot be settled from public research.
