---
"@beep/epistemic-domain": minor
---

Add execution-authority grant and record schemas to the epistemic domain, plus
the `frozen-grant-set` repo law that seals their construction.

New value concepts in `@beep/epistemic-domain`:

- `ExecutionGrant` — one unit of pre-authorized authority (principal, purpose,
  resource, operation, sink, budget, policy revision, expiry). Sinks are modeled
  as `(class, audience, destination)` so an outbound HTTP POST and an MCP
  workspace write are the same schema differing only in class, and policy keys
  on audience rather than transport.
- `ExecutionVerdict` — a bounded nine-member `DenialReason` domain split into
  evaluator-reachable and boundary-only subsets, a total constant guidance
  lookup, and the allowed/denied verdict union in the repo's refusal-as-value
  gate shape. Denial reasons are recorded and logged but never returned to a
  caller, so they cannot be used as an oracle to enumerate the grant set.
- `GrantSet` — a `Draft`/`Frozen` tagged union where widening after the freeze
  is unrepresentable rather than merely checked, sealed by a digest over the
  canonical encoding of `(grants, policyRevision, frozenAt)`, plus the pure
  evaluator. The evaluator re-verifies the seal before answering anything else
  and narrows cumulatively, so all axes must be satisfied by one grant.
- `ExecutionRecord` — write-ahead decision records hash-chained per run and
  outcome records bound to their decision by hash. Every field is a digest, a
  bounded literal, a branded version, a sequence number, or a timestamp; raw
  destinations and operation names enter only as digests.

The repo CLI (not released) gains the `laws frozen-grant-set` check, wired into
the repo lint-policy lane, which fails when a `FrozenGrantSet` is constructed
anywhere but its defining module — including via import alias, variable alias,
destructured or extracted `make`, and `new`.

Chain verification is internal-consistency only: it proves the records present
are mutually consistent, not that none were removed. Anchoring a tail hash
outside attacker-writable storage is deliberately out of scope here.
