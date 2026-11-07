# Public raw-source resolution and trusted edition ownership

CitationEngineResolutionInput is a server-only raw identity/text and bounded
mention-receipt request. Structural receipts grant no proof. The installed
operation snapshots the complete request before asynchronous source resolution,
then uses canonical source verification and original receipt restoration to
reverify anchors and engine-bound mention IDs. Request policy, implementation
identity and edition spellings are not authority inputs.

Source resolution captures shared admission, Clock, Digest, source resolver,
frozen editions and default registered dispatch. One outer deadline/Scope covers
source work, receipt verification and resolution. Count/size checks precede
structural decoding and repeat on decoded values before snapshotting. This
avoids known oversized inputs reaching the structural copy; it does not prove
all initial schema or snapshot allocation bounded.

The original extraction edition-selection loop now lives in one captured helper
shared by source-document extraction and raw-source resolution. It preserves
first occurrence order and deduplicates selected references through Effect
HashSet. Frozen lookup supplies spelling and family validation; requests cannot
supply replacement vocabulary.

CitationEngineResolutionResult preserves genuine source evidence, the completed
document and a separate captured-policy/work report. Its schema binds source,
engine and operation identities. An internal named result additionally retains
original receipt, resource bindings and selected editions for trusted restoration
adapters. Explicit S.Codec field typing preserves the public provenance
capability without emitting its private implementation member.

Every call owns a fresh cumulative text budget and reports its actual reservation
snapshot; zero reservations do not claim that JSON/schema allocations are free
or whole-engine allocation proof is complete. Ambiguous/unresolved meanings
remain document data. Invocation failures expose only CitationEngineFailure,
with R=never; interruption/defects retain Effect semantics.

## Verification

Seventeen final resolver/extraction/annotation/timing tests pass in 31.32
seconds, including actual Bun/Node execution. A preceding nine-test resolver and
actual Bun/Node source-document replay passes in 24.47 seconds. Four server-only
contract tests pass in 2.60 seconds.

Controls mutate the caller's raw text, receipt ID and receipt array during source
resolution. The operation retains its original snapshot, resolves both mentions
under one authority and restores the document exactly from the returned receipt,
bindings, editions, expected source and captured artifact. Source lookup observes
one active admission. Malformed input refuses before another source call.
A validly shaped but wrong mention ID is rejected during re-verification;
iteration, source-size and mention-count limits retain their exact categories.
Subsequent valid resolution succeeds with admission released. Unknown caller
edition properties remain unread, and request policy/artifact overrides cannot
replace captured authority.

An initial forged-quote fixture was malformed at the schema boundary; the
identity control now substitutes another valid mention ID so it specifically
exercises identity re-verification. Consecutive catches use Effect.catchTags.
Input capture and verification are separate named Effect operations. Fallow's
initial complexity finding is resolved without suppressions or threshold edits.

An additional ownership control reproduced a nested deadline alias: scalar report
limits were copied, but mutating a returned deadline value changed a later
captured-policy report. Report producers now detach policy by the existing
Schema JSON codec before publishing it. Raw resolution, annotation, standalone
extraction and connected extraction share the captured-policy helper rather
than inventing a manual clone. Connected extraction reuses the already detached
inner policy. Mutated report deadlines no longer change subsequent reports,
documents or native output. Scalar-copy behavior was already correct; no scalar
alias defect is claimed. This is focused ownership proof, not completion of the
broader model/callback mutation laws.

Both packages pass lint/types and blocking laws; server declarations emit.
Scoped Fallow passes with zero introduced findings and nine inherited clone
groups. Original source expectations, limits and baselines are unchanged.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep quality package-verify @beep/law-practice-use-cases --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bun run beep lint laws --package packages/law-practice/use-cases
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationResolverBoundary.test.ts \
  test/CitationSourceDocument.test.ts test/CitationSourceAnnotation.test.ts \
  test/CitationSourceAnnotationTiming.test.ts
cd ../use-cases
bunx --bun vitest run test/CitationEngineInput.test.ts
```

## Hosted documentation repair

The preceding published head's JSDoc Ratchet job 128250296967 reported nine
missingExportSince findings plus one leading-blank and one trailing-blank
finding. Public contract comments placed category/since tags on the same line;
the mode type alias also had no lead description. Tags now occupy separate lines
and the alias has a meaningful description. A focused maintainer probe calls the
repository's actual tagsFromComment and documentationShapeViolations helpers
through the test-kit export. All 86 checked export comments in the citation
contract files and server barrel have recognized since tags and no leading or
trailing blank findings. Full hosted inventory/ratchet confirmation remains
pending; no documentation baseline or threshold was regenerated.

Main ce87ff21b2 is integrated at 0ef0edc00a. Local semantic proof above precedes
that tooling-only merge; the next hosted run qualifies the exact published head.

Public cleaner composition and the complete four-operation service/Layer remain
required, along with general host/model protocols, builtin difflib, lawful
transforms, whole-engine safety/scaling, deployment proof and exhaustive
source/donor reconciliation. All eleven laws, four fidelity questions and
fifteen unfinished proof rows remain open without semantic waiver. Hosted
exact-head qualification remains separate from these component observations.
