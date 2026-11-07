# Public semantic metadata and publication comparisons

The original extraction-loop observations now qualify the public engine's
represented semantic metadata and ordered candidate/selected edition references,
in addition to citation kinds, token components and verified primary/full spans.
The existing shared assertion is strengthened for both the public Layer replay
and private semantic-stage replay. Original fixtures and production behavior are
unchanged; no target-generated expected metadata is introduced.

## Independent expected values

The comparator reads each original metadata field directly from the frozen
native Unicode observation. It performs only the documented source-to-domain
field naming conversion: pin_cite to pinCite, antecedent_guess to antecedentGuess,
extra to additionalText, and the resolved case name fields. All other names
remain unchanged. Whole metadata-record equality detects missing or extra fields
as well as altered values. Null and empty strings remain distinct. An unexpected
numeric semantic metadata value fails rather than being dropped.

Court metadata is compared as the known court id or preserved unmapped text.
This verifies the original label but does not independently prove known/unmapped
classification or public vocabulary version/reporter identity. Candidate edition
references come from the original token's ordered exact/variation ids through
original corpus bindings. The selected edition is the independently recorded
original editionGuess. Order and duplicate references remain observable.

The two source pin-cite coordinate fields are deliberately outside this semantic
metadata comparison because they are occurrence coordinates, not semantic data.
Primary/full anchors have their existing independent source-span checks. Exact
pin-cite component evidence, source model reconstruction and the representation
laws remain separate open obligations; excluding coordinates here is no waiver.

## Validation and remaining proof

The metadata comparison passes the focused public seven-document replay on both
Bun and Node in 64.50 seconds. All eight canonical families remain covered.
The final replay, including candidate-edition assertions, passes both runtimes
in 59.94 seconds. Package lint/types, blocking laws and the divergence audit
pass. Scoped Fallow passes with zero introduced findings and nine inherited
clone groups; no thresholds or baselines change. Hosted integration
runs the same stronger comparison across all thirty-six original documents;
that full result remains pending until hosted CI reports it.

```sh
cd packages/law-practice/server
bunx --bun vitest run test/CitationEngineCorpus.test.ts
cd ../../..
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
```

This is broader observable output proof, not exhaustive capability completion.
Production identity allocation, retained host/document behavior, lawful
transforms, whole-engine safety/scaling, all source/donor dispositions and
lifecycle acceptance remain required. All eleven representation laws, four
fidelity questions and fifteen unfinished proof rows remain open without waiver.
