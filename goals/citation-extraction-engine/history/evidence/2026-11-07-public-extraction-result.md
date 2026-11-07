# Server extraction result and shared evidence ownership

The server use-case API now owns CitationEngineSourceEvidence and
CitationExtractionDiagnostics. Canonical source derivation and verified
extraction consume the same source-evidence schema; the former private
CitationCanonicalSourceResult export is removed without a compatibility alias.
Occurrence projection derives its diagnostic row schemas from the shared
contract rather than maintaining parallel definitions. These exports remain
absent from the root and client/public surfaces.

CitationEngineExtractionResult preserves the genuine selected source lineage,
original input identities, every returned semantic citation, resolved document,
explicit unverified outcomes and separate operation report. Its schema checks
source/engine identity coherence and exact report/result counts. This is a
server result containing an issued source capability, not a client wire model.
Private parser graphs and out-of-band restoration bindings remain available in
the connected internal result; this change does not claim their public export.

The connected single/pair source-document operation now produces that public
result as output. Its report uses complete enclosing extraction/resolution work
duration and final parent text reservation. The existing extraction report
producer is shared through an Effect dual helper; extraction-only and connected
operations do not maintain duplicate counter calculations. Semantic results
and unverified diagnostics survive the original shortcut without asserted
anchors or fabricated tokenizer execution counts.

## Verification

Four use-case contract tests pass in 15.01 seconds. They cover server-only
exports, refusal of structural source look-alikes as verified evidence, closed
unbound warning reasons, unverified component data and existing source/mode
contracts. The canonical source test and three connected tests pass in a
43.71-second server replay. After adding result identity/count invariants, the
three connected tests pass again in 33.92 seconds.

Actual Bun and Node executions validate the public result, exact semantic and
document preservation, selected/companion input lineage, measured work and
reservation counts. A deliberately inconsistent citation count is refused by
the result schema. The shortcut retains every unverified semantic value and
round-trips its diagnostics through the canonical JSON codec, while reporting
that tokenization did not execute. Existing restoration and independent native
exit assertions continue to pass. No generic worker or ownership machinery is
added.

Both package lint/type checks, server declaration build and blocking laws pass.
Scoped Fallow passes with zero introduced findings and nine inherited clone
groups. Existing baselines, limits and source expectations are unchanged. The
initial combined cross-package test invocation was rejected by differing Vitest
worker-group settings; the package suites were run separately. An initial
report helper lacked an explicit pipeable overload; adding its actual dual
signature satisfies the repository law without suppressions.

```sh
bun run beep quality package-verify @beep/law-practice-use-cases --quick
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/use-cases
bun run beep lint laws --package packages/law-practice/server
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationSourceDocument.test.ts \
  test/CitationCanonicalSource.test.ts
cd ../use-cases
bunx --bun vitest run test/CitationEngineInput.test.ts
```

The complete four-operation CitationEngine service/Layer, remaining public raw
request/result composition, general host/model protocols, builtin difflib,
lawful transforms, whole-engine safety/scaling, deployment evidence and
exhaustive source/donor reconciliation remain required. All eleven laws, four
fidelity questions and fifteen unfinished proof rows remain open without waiver.
Hosted exact-head qualification remains separate from local component proof.
