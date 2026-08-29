---
"@beep/epistemic-server": patch
"@beep/ontology-server": patch
"@beep/ontology-use-cases": patch
"@beep/mcp-kit": patch
---

feat(epistemic): governed egress boundary and allowlist-gated provenance publication

`GovernedEgressLive` installs a `FetchHttpClient.Fetch` that authorizes outbound
requests against `EpistemicConfig.destinationAllowlist`, appends a write-ahead
decision row to the execution ledger before the request is issued, and rejects a
denied destination with the reason-free `EgressDenied`. Destination matching
canonicalizes through `URL` and requires a `/` boundary, so a lookalike host
cannot borrow an allowlist entry's prefix.

`ontology_publish_provenance` ships with that control: registered only when the
allowlist is non-empty, taking `HttpClient.HttpClient` as a layer requirement so
the governed `Fetch` applies to it, and returning a refusal byte-identical to a
tier-gate refusal so a destination denial cannot be told apart from an operation
denial.

Also corrects a `SanitizedSpan.ts` comment: `Effect.provideContext` merges
rather than replaces the fiber context. The code it justified was already
correct; the explanation was not.
