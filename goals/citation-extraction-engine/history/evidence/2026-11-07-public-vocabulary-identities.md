# Public court and reporter identity comparisons

The public CitationEngine extraction corpus now checks case/short-case reporter
ids, publication vocabulary versions and exact known/unmapped court objects.
Expected identities come from the separately sealed vocabulary-mapping fixture,
not the production semantic-editions asset, runtime lookup or target output.
The existing source kind/component/candidate-reference comparisons remain active.
The same assertion also runs in the private semantic extraction replay.

The fixture reader authenticates mapping SHA-256
`b5aca44dc69f05b82c41decf327863a52c151eeb231bdb4df96e5cf7e85351c5`
and decodes the existing CitationOracleVocabularyMapping schema. Its 2,533
edition rows supply exact case reporter ids. Legacy mapped court ids and the
explicit public-only court ids form the independent known-court universe.
Native source court text is compared as a known object with the original
mapping artifact version, an unchanged unmapped value, or null. Null and empty
court labels stay distinct. No current production vocabulary lookup constructs
an expected result.

## Validation and limitations

Seven tests across public engine corpus and semantic projection pass in 67.89
seconds. Both actual Bun and Node engine paths retain the focused seven original
documents and all eight families. All eighty original pre-filter models are
also compared through the private projection. Constructed projection controls
exercise a valid-looking unknown court id, the empty label and null. These are
public-representation controls, not additional oracle extraction observations.
No native child is launched by the projection-only replay.

After separating court expectations from publication comparison, a fresh five
projection tests pass in 1.85 seconds. Package lint/types and blocking laws pass.
Scoped Fallow reports zero introduced findings and nine inherited clone groups;
no suppression, baseline or threshold is changed. The full thirty-six-document
public/private hosted integration replays share the stronger assertion, but
that full result still needs hosted qualification.

This qualifies the represented identities for the recorded original values and
explicit projection controls. It does not complete arbitrary host/model mutation,
full unknown-court extraction, vocabulary-version drift, production identity
allocation, transforms, whole-engine safety/scaling, donor/source dispositions
or lifecycle acceptance. All eleven representation laws, four fidelity questions
and fifteen unfinished proof rows remain open without waiver.

## Hosted repair feedback

Check 42330777628 on published head
50a493cef5c7e48e0ed4797aa8a20116bf6a3458 confirms Labs and Fallow Advisory
Envelopes succeed (jobs 128276597190 and 128276597276). This proves the earlier
archive-consumer repairs on that head. Its Heavy / Test Integration job
128276984819 is still in progress when recorded. These results neither qualify
the new vocabulary-assertion head nor establish complete integration success.

```sh
cd packages/law-practice/server
bunx --bun vitest run test/CitationEngineCorpus.test.ts \
  test/CitationSemanticProjection.test.ts
cd ../../..
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
```

## Main integration

Main commit 121b1a3a23 (PR 2836) independently retains the same executable
archive consumers. The merge adopts its ciops test/fixtures location and
retires this branch's duplicate lab fixture directory. All four data artifacts
are equal after normalizing only that directory path; claim fixtures are
identical, with their original hashes retained in the shared README.
The four-file formatter ownership list and generated identity profile follow
the canonical retained path. After conflict resolution, all 106 lab tests pass
again in 1.57 seconds; KPI and live evidence checks retain their original
metrics and verdicts. No citation source expectation or full-goal duty changes.
