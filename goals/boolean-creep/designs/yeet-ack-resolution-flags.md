# Instance

- id: `yeet-ack-resolution-flags`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/InboxPorcelain.ts:84`
- symbol: `YeetAckResolutionFlags`
- members: `environmentOnly`, `waive`, `wontfix`
- evidence: E2 at `InboxPorcelain.ts:252-328` — exactly one of five closing
  moves is required; the three boolean-selected moves carry distinct required
  payloads and cannot coexist with each other or the fix/thread moves.

# Current shape

The raw interface flattens five exclusive resolutions plus their payloads into
strings and three booleans. The boolean triple alone has four reachable coarse
states: none selected or exactly one of environment-only, waive, and wontfix.

# Cardinality gap

The triple represents eight combinations and permits four coarse states;
payload presence creates further illegal combinations already rejected by
reason and attribution guards.

# Target schema

Reuse the existing `YeetAckResolution` tagged union as the only application
model. Keep a private raw CLI-boundary shape only as required by Effect CLI;
validate reason, waiver attribution/expiry, and exact-one candidates there,
then pass `YeetAckResolution` to the ack application. Do not create another
resolution union or preserve `YeetAckResolutionFlags` as an exported/runtime
domain.

# Migration inventory

- `InboxPorcelain.ts:84-101` — confine raw fields to the CLI adapter; delete the
  named application-carried flags interface if no boundary type annotation
  needs it.
- `InboxPorcelain.ts:220-328` — retain typed validation and exact messages but
  construct/return the existing tagged cases immediately.
- `InboxPorcelain.ts:532-564` and command handler — accept one resolution
  union plus independent ack id rather than the entire raw flags bag.
- Migrate test fixtures and package test barrels; remove zero-consumer exports.

# Guard-deletion accounting

Delete application reads of `environmentOnly`, `waive`, `wontfix`, empty
fix/thread strings, and payload coherence after parsing. Boundary
candidate-count, reason, attribution, and expiry checks remain required
compatibility validation.

# Encoded-side impact

none (internal CLI adapter). Inbox ledger resolution encodings and all CLI
spellings/messages remain unchanged.

# Test impact

Retain every exact-one, reason, attribution, expiry, fix SHA, thread URL,
environment-only, wontfix, and waiver case; assert the application seam
receives a tagged union. Run Yeet focused suites and full repo-CLI package
verification.

# Risk and sequencing

Land in Tier 1E. Do not weaken acknowledgement policy or treat the boundary
validation booleans as an honest application state.
