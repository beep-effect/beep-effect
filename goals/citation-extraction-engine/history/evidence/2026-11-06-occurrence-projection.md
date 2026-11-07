# Verified primary occurrence adaptation

The private occurrence projector consumes completed raw-to-semantic results and
a genuine public VerifiedSourceText capability. It requires that the verified
text equal the exact tokenizer text. A proof for a different raw artifact or for
pre-cleaning text cannot silently authorize offsets into cleaned text. Production
source identity derivation for cleaning and public service composition remain
required; test identities name their actual tokenizer-text fixture explicitly.

The projector snapshots semantic values and primary positions before asynchronous
identity work. It reuses public convertTextOffsetRange, canonical TextAnchor
verification against the source capability, and the existing cm1 producer. No
new public offset converter, occurrence identity protocol or evidence capability
is introduced. Its returned method captures dependencies and requires no caller
services. Source ceilings, candidate/mention counts, operation deadlines and
source/quote allocation reservations participate. Failures publish no partial
result and retain only closed source-free reasons.

Original singleton shortcut data is retained as explicitly unverified semantic
data. Empty, reversed, negative or out-of-source primary positions cannot issue
a mention. A native source whose JavaScript display text matches the proof but
whose Python point count differs also remains unverified: a literal surrogate
pair must not be silently treated as one native non-BMP point. No native model
is rewritten to make an anchor pass. These private unverified records still need
final detached-document identity adaptation.

## Canonical converter improvement

The existing prerequisite code-point converter previously materialized an array
for the complete source, copied two prefixes and joined both prefixes. The same
public operation now scans numeric code points to the requested endpoint,
retains only numeric coordinates and yields every 4,096 points. UTF-16 mode,
source limits, schema invariants, return/error types and normalization version
remain unchanged. This is an improvement to the canonical owner, not an engine
replacement for that owner.

Forty tests across VerifiedSpanOffsets, VerifiedSpanSpike and VerifiedSpanHistory
pass in 672 ms. New controls compare every range against the former independent
iteration/prefix reference for ASCII, combining, CRLF, non-BMP and isolated
surrogate strings, check a near-ceiling source and out-of-source point, and
confirm interruption during a long conversion. No performance benchmark or
whole-engine scaling proof is inferred from these focused results.

## Connected source and identity evidence

Seven original documents on each of Bun and Node exercise all eight citation
families, a Unicode name and actual HTML. The same source-backed raw model,
semantic field/order and cumulative allocation assertions remain. Primary
anchors compare with independently computed original code-point ranges and
exact source slices. Replaying the same result retains cm1; changing the trusted
engine artifact changes it. Additional controls cover a structural forged source
proof, different verified text, one-mention policy exhaustion, one-unit-short
source/quote allocation, a negative original position and a literal-surrogate
native layout paired with an emoji source proof. Unverified records retain their
semantic citation and original result index. The shortcut never produces a
fabricated occurrence or native process.

The first connected source/mention run plus existing mention regressions passes
15 tests across two files in 59.47 seconds. With the additional negative-position
and allocation controls, the two Bun/Node connected tests pass in 47.12 seconds.
After the final schema annotations/configuration ownership change they pass
again in 49.36 seconds.
The complete 36-document hosted replay uses the same adapter and remains pending.
Package lint/type/test checks, declaration generation, blocking laws and codec
lint pass. Scoped complexity checks stay within the cognitive limit; estimated
coverage in the isolated scan is not authoritative hosted coverage.

Hosted Fallow passes on preceding head
682c94eb115392657c43535821f4707075c26960, Check run 42250980303,
job 128005861735. This confirms the previous test-complexity repair. Hosted
confirmation of the occurrence/converter wave remains pending at publication.

```sh
bun run beep quality package-verify @beep/langextract --quick
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
bun run beep lint laws --package packages/foundation/capability/langextract
cd packages/foundation/capability/langextract
bunx --bun vitest run test/VerifiedSpanOffsets.test.ts \
  test/VerifiedSpanSpike.test.ts test/VerifiedSpanHistory.test.ts
cd ../../../law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationSemanticExtraction.test.ts \
  test/CitationMention.test.ts
```

Full-span/component/footnote detection and overlap-warning adaptation are not
claimed by this primary projector. Canonical production source identity for
cleaned inputs, public errors/service/Layer, detached/document integration,
transforms, broad host/subclass/equality/mutation/alias behavior, exhaustive
accounting and whole-engine safety/scaling remain required. All eleven
representation laws, four fidelity questions and fifteen unfinished proof rows
remain open. No semantic waiver or goal-completion claim is made.
