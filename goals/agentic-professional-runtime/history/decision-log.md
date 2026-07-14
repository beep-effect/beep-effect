# Decision Log

## 2026-05-01 - P2 Runtime Data Loop Proof

### P2 Decisions

- Define the next proof around the runtime data loop, not another broad product
  vision pass.
- Use incoming email as the first inciting artifact.
- Use a paired scenario:
  - Law: provisional patent intake with a public-demo deadline.
  - Wealth: cash-planning request with a payment deadline.
- End the proof with candidate claims, candidate tasks, a client-facing draft,
  an approval gate, and an SDK context packet.
- Keep fixtures in the initiative packet before promoting them into package
  tests.
- Use normalized email metadata plus a markdown body instead of raw `.eml`.
- Use stable span IDs instead of whole-artifact evidence or byte offsets.
- Use readable stable fixture IDs instead of UUID-like IDs.
- Seed minimal vertical records instead of inferring all identity from email.
- Treat shared `Project` and `Task` as the primary work containers.
- Keep vertical overlays minimal:
  - Law links to `Matter` and `PatentAsset`.
  - Wealth links to `Household`, `Client`, and `Account`.
- Produce one client-facing draft email per scenario.
- Use a deterministic fixture agent rather than a real LLM call.
- Keep topology role-level in P2; defer exact package/file scaffolding to P3.
- Capture this decision set in the initiative packet.
- Use current repo truth for this pass instead of refreshing Notion pages.

### P2 Rationale

Incoming email is the smallest realistic professional-services wedge that
forces ingestion, workspace history, evidence spans, candidate claims, tasks,
drafts, approval, and SDK context without depending on every future connector.

The paired scenarios are intentionally similar enough to stress the shared
kernel and different enough to keep law and wealth language in their vertical
slices.

### P2 Follow-Up

P3 should turn this proof into package-level implementation choices and decide
which fixtures move into package tests.

## 2026-05-01 - P3 Slice Implementation Proof

### P3 Decisions

- Implement the first proof as real package topology, not an internal-only
  scratchpad.
- Create domain packages for all six owner slices.
- Keep Law and Wealth context-only in P3.
- Put SDK-facing context packet and candidate output-set contracts in
  `@beep/agents-use-cases/public`.
- Publish the deterministic fixture runner only from
  `@beep/agents-use-cases/test`.
- Compose the paired Law and Wealth fixtures in the agents use-cases package
  test boundary.
- Keep persistence, tables, real connectors, real LLMs, and review UI deferred.

### P3 Rationale

The package proof should pressure-test the architecture with real import
boundaries while keeping the runtime loop small enough to verify deterministically.

### P3 Follow-Up

P4 should design native first-run onboarding. The next runtime implementation
step should add persistence only after the package contracts remain stable.
