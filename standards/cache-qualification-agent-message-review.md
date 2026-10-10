# Agent messaging dependency and policy-input baseline review

2026-10-09. Review by GPT-6.1-Sol, medium, in the owning agent messaging lane.

The cheap-gates cache audit reported twelve blocking computation configuration
changes and one source review for `turbo.json`. A complete executable projection
comparison finds nineteen changed nodes across exactly three review subjects:
`//`, `@beep/ai-provider-cli`, and `@beep/repo-cli`. Both baseline and census contain
2,087 executable computations, with no added or removed computation.

Eighteen nodes change only their resolved dependency lists. The provider wrapper
now declares `@beep/acp`, which its native session implementation imports. The
operational CLI now declares `@beep/ai-provider-cli` and `@beep/mcp-kit`, which its
managed runtime and MCP composition import. These additions preserve dependency
ordering through audit/build/check/coverage/test and transit-based computations.
The exact affected nodes are:

- `@beep/ai-provider-cli#audit`
- `@beep/ai-provider-cli#build`
- `@beep/ai-provider-cli#check`
- `@beep/ai-provider-cli#coverage`
- `@beep/ai-provider-cli#lint:deprecated-apis`
- `@beep/ai-provider-cli#package-test-typecheck`
- `@beep/ai-provider-cli#test`
- `@beep/ai-provider-cli#test:integration`
- `@beep/ai-provider-cli#test:property`
- `@beep/repo-cli#audit`
- `@beep/repo-cli#build`
- `@beep/repo-cli#check`
- `@beep/repo-cli#coverage`
- `@beep/repo-cli#doctest`
- `@beep/repo-cli#lint:deprecated-apis`
- `@beep/repo-cli#package-test-typecheck`
- `@beep/repo-cli#test`
- `@beep/repo-cli#test:property`

The remaining node is `//#lint:policy-fingerprint`. Its six new inputs cover the
manifests and source trees of ACP, the provider wrapper and MCP kit, now imported
by the CLI's policy computation. No previous input is removed:

- `packages/drivers/acp/package.json`
- `packages/drivers/acp/src/**`
- `packages/drivers/ai-provider-cli/package.json`
- `packages/drivers/ai-provider-cli/src/**`
- `packages/foundation/capability/mcp-kit/package.json`
- `packages/foundation/capability/mcp-kit/src/**`

Only `turbo.json` changes among the recorded Turbo source digests. Global
configuration, executable command text/digests, cache flags, outputs, environment
keys, passthrough environment, persistence, interaction and output-log settings
remain unchanged. No runtime or remote-cache qualification is granted.

The request explicitly names only the three subjects above, retains the existing
profile, epoch and all four qualification-scope computations, and uses the exact
previous baseline digest as a compare-and-swap fence. All other subject reviews
must be carried unchanged; no subject is dropped. The qualification ledger is
retained byte-for-byte. Its pre-refresh SHA-256 is `13067bf343f413b4cc99b4cefca3ce7d094a1f09247a54ffc20114e766d4d2bb`.
The reviewed prior baseline SHA-256 is `d0455efc163b0a77faeadbfd61607d685e3c8ffbe86093be1858ef28d0439d07`.

Reversal: revert this request/review and generated baseline together with the
owned dependency and Turbo input additions. Re-run `beep cache audit` against the
resulting graph. Never restore an old baseline while retaining the new graph to
hide drift, and never change the qualification ledger or widen reuse to resolve
this configuration review.

## Main integration and archival evidence preservation

The 2026-10-09 integration of main's release-policy change performed a structural
three-way baseline comparison. Main changes zero computation projections, global
configuration or source digests relative to the merge base; it moves four review
references to retained evidence for `@beep/occt`, `@beep/pdf-tools`,
`@beep/repo-cli` and `@beep/technical-drawing`. The agent messaging lane changes
exactly the nineteen computations and three subjects reviewed above. The sole
conflict is the `@beep/repo-cli` review record, which both lanes legitimately
superseded for different reasons.

Main's archived evidence is retained at
`goals/repository-simplification-confidence/history/receipts/d-cache-review-evidence.md`
with SHA-256 `9b642414a6d87a7ed68955eed76fb5c9468dfe344cffe17e95167931723e510a`.
That review only relocates prior design-figure evidence and grants no qualification.
The structural resolution carries all four main records before the canonical
writer re-records only the three agent messaging subjects. This current review
therefore retains the archived `@beep/repo-cli` provenance while reviewing the
later agent messaging dependency projection. The other three archived records
remain byte-equivalent JSON values after the writer.

The integration request's compare-and-swap digest names the structurally merged
pre-writer baseline, rather than either parent baseline. The original prior
baseline digest above remains historical evidence for the first refresh. Cache
profile, epoch, qualification scope and ledger are unchanged. Reversal removes
only the agent messaging graph additions and corresponding reviews; retain main's
archival references and run the canonical audit against the reversed graph.
