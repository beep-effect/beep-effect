# Admitted resolver with captured policy and artifact

The default registered resolver now has an admitted operation constructor for
final engine composition. It captures the normalized policy snapshot,
implementation artifact, shared operation admission, resolver services and
Clock at installation. Request policy/artifact properties and later Context
replacements cannot change that authority. The original private resolver
remains available to the already admitted extraction parent; that parent does
not acquire a second permit through this standalone operation.

Each resolve creates a fresh Scope inside the shared admission boundary.
Captured resolve timing surrounds admission, so waiting consumes the same
resolve deadline. Admission retains its total and queue deadlines, cleanup and
cancellation. Typed admission refusal becomes a fresh resolve input error;
existing resolver failures retain their closed public translation. The emitted
method has R=never and only CitationEngineFailure. This reuses Effect Scope,
timing, Schema, the existing admission service and registered resolver; no new
pool, counter or lifecycle implementation is introduced.

The private request accepts a genuine verified-source capability, decoded
mentions and edition operands. It validates their Type schema, then delegates
ownership snapshots, source/mention authentication and dispatch to the original
resolver. Raw-source public request composition and complete engine service
exports remain separate unfinished work. This component does not establish
bounded initial schema allocation or complete host-protocol compatibility.

## Verification

Four focused tests pass in 2.97 seconds. Controls cover captured policy mutation,
ignored request limits/artifact, later admission/operation replacement, actual
iteration exhaustion despite a larger request policy, empty-input recovery,
queue-inclusive resolve deadline, cancellation, capacity release and subsequent
successful resolution. Complete document receipts and resource bindings remain
identical across valid invocations. Compile-time assignment and declaration
emission prove the closed error union and no caller requirements.

The initial implementation used the wire codec for already decoded mentions;
focused tests exposed the refusal and it was corrected to S.toType. No upstream
expectation or limit was weakened. Twenty-seven separate default callback,
direct resolver and admission tests pass in 4.32 seconds, retaining the existing
76 default contexts. Package lint/types, declaration build and blocking laws
pass. Scoped Fallow passes with zero introduced findings and nine inherited
duplication groups under unchanged baselines and thresholds.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationResolverBoundary.test.ts
bunx --bun vitest run test/CitationDefaultCallbacks.test.ts \
  test/CitationResolve.test.ts test/CitationAdmission.test.ts
```

Public raw requests, CitationEngine service/Layer, complete reports, general
host/model protocols, builtin difflib, lawful transforms, whole-engine
safety/scaling, deployment proof and exhaustive source/donor reconciliation
remain required. All eleven representation laws, four fidelity questions and
fifteen unfinished proof rows remain open without semantic waiver. Hosted proof
of the published head remains separate from these local component observations.
