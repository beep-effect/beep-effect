# FreshBooks Driver Spec

## Objective

Ship `@beep/freshbooks`, a schema-first Effect driver for the FreshBooks API
on the `@beep/hubspot` pattern: an auth-code token helper whose single-use
refresh-token rotation runs through a single refresh owner with atomic
persistence, read verbs for clients, invoices, and payments, and invoice-PDF
retrieval — gated on a first-phase endpoint-validation spike against the
existing dev app that also records the live request limits and webhook
retry/disable schedule.

## Non-Goals

- No webhooks in this goal (retry/verification semantics are unverified —
  they enter a later goal with real evidence from the P0 spike).
- No billing-platform change and no LEDES/UTBMS scope (exploration no-go:
  FreshBooks bills, Box signs and delivers).
- No invoice **delivery** into Box — that composition belongs to the gated
  `practice-sign-invoice-flow` candidate in the exploration MAP; this goal
  only proves and ships the retrieval verb (or records the fallback).
- No write verbs (invoice creation, client mutation) — read + retrieval
  surface only.
- No production app registration until graduation of the delivery flow; the
  existing all-scopes dev app stays dev-only, and the production app is
  registered least-privilege when the consuming flow lands.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development).
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- A NET-NEW driver package beside the other drivers — scaffolded via
  `bun run beep create-package` (never `mkdir`).

## Constraints

- **Pattern fidelity**: follow `@beep/hubspot` — `FetchHttpClient`, Schema
  decode at the boundary, `LiteralKit` error domains, `S.Redacted` config.
  Design order: schema → `Context.Service` contract → implementation.
- **Token rotation is a serialization problem** (r7 §F9): FreshBooks refresh
  tokens are single-use. One dedicated refresh owner behind a lock performs
  every refresh and atomically persists the rotated token before releasing;
  two concurrent refreshers presenting the same token strand one of them.
  The helper must make concurrent-refresh misuse unrepresentable, not
  merely documented.
- **OAuth mechanics** (CAPTURE addenda): redirect URI is exact-match HTTPS;
  localhost redirect is acceptable for the dev app; the application
  settings URL is cosmetic. Credentials resolve from the recorded 1Password
  references — `op://` refs stay references in every config, fixture, and
  doc; raw values never appear anywhere.
- **Namespace discipline**: FreshBooks `account_id` and `business_id` are
  distinct namespaces — model both explicitly in schemas; never treat one
  as the other.
- **P0 gate**: the invoice-PDF endpoint is UNVERIFIED (r7 §D). The spike
  validates it against the dev app before the retrieval verb is designed;
  if unsupported, the recorded outcome is the operator-export fallback and
  the verb is dropped from this goal's surface without shame. Live request
  limits and the webhook retry/disable schedule are recorded in the same
  spike for the later webhook goal.
- Fixtures carry no real client, invoice, or payment data and no tokens;
  live smoke is credential-gated and read-only.

## Decision Log

Binding decisions live in the source exploration —
[`explorations/practice-office-provisioning/DECISIONS.md`](../../explorations/practice-office-provisioning/DECISIONS.md):
signatures and billing, FreshBooks driver goal. This spec binds to them
without restating.

## Acceptance Criteria

- [ ] P0 spike report in `history/`: invoice-PDF endpoint verdict, live
      request-limit numbers, webhook retry/disable schedule.
- [ ] The package exists via `create-package`, exposes the token helper and
      clients/invoices/payments read verbs with schema-decoded boundaries
      and `LiteralKit` errors, and its rotation serialization is proven by
      a concurrent-refresh test.
- [ ] Invoice-PDF retrieval is fixture-proven — or the fallback verdict is
      recorded and the verb is explicitly absent.
- [ ] `bun run beep quality package-verify` passes for the new package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/freshbooks-driver/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/freshbooks-driver/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/freshbooks-driver` | Passes |
| Spike evidence | P0 report in `history/` | Recorded |
| Package handoff | `bun run beep quality package-verify` on the new package | Passes |

## Stop Conditions

- The dev app cannot complete the auth-code flow after reasonable
  investigation (report with the exact OAuth error).
- Required source files are missing or materially contradictory.
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
