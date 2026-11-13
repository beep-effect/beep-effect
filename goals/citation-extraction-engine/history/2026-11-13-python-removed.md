# Python removed from this packet (2026-11-13)

The `python-free-repo` goal bans tracked Python
([SPEC](../../../goals/python-free-repo/SPEC.md)). Nothing in a workflow, hook,
package script, skill, systemd unit or `opsScripts` entry still runs the
179 file(s) below, so they were deleted rather than ported. Their outputs and
the conclusions drawn from them stay in this packet, in the files listed under
"Recorded in".

Recover any script with
`git show 05ed8bc6b6cc50f2a284ed02caaab16f216bb9c3:<path>`. A resumed packet that needs to run one again
ports it to TypeScript first; tracked Python is no longer admitted.

| Deleted file | Recorded in (non-Python files that name it) |
| --- | --- |
| `ops/audit-oracle.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-source-baselines.md`, `goals/citation-extraction-engine/ops/check-discovery.ts`, `packages/tooling/tool/cli/test/coverage-scope-goal-readers.test.ts` |
| `ops/build-annotation-xml.py` | `goals/citation-extraction-engine/history/evidence/2026-11-06-annotation-xml-kernel.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/server/assets/citation-xml/README.md` (+1 more) |
| `ops/build-diff-kernel.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/server/assets/citation-diff/README.md`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/build-html-kernel.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/export-assertions.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-assertion-corpus.md`, `goals/citation-extraction-engine/ops/check-assertions.ts`, `goals/citation-extraction-engine/ops/divergence-plan.json` (+1 more) |
| `ops/export-divergences.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-divergence-ledger.md`, `goals/citation-extraction-engine/ops/check-divergences.ts` |
| `ops/export-helper-configurations.py` | `goals/citation-extraction-engine/history/evidence/2026-11-06-production-helpers.md` |
| `ops/export-ledgers.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-source-case-ledgers.md`, `goals/citation-extraction-engine/ops/check-ledgers.ts` |
| `ops/export-operations.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-assertion-corpus.md`, `goals/citation-extraction-engine/history/evidence/2026-10-28-operation-corpus.md`, `goals/citation-extraction-engine/ops/check-assertions.ts` (+3 more) |
| `ops/export-parser-catalog.py` | `goals/citation-extraction-engine/history/evidence/2026-11-06-parser-catalog.md` |
| `ops/export-regex-contract.py` | `goals/citation-extraction-engine/ops/check-regex-benchmarks.ts` |
| `ops/export-semantic-editions.py` | `goals/citation-extraction-engine/history/evidence/2026-11-06-semantic-projection.md` |
| `ops/export-supplemental.py` | `goals/citation-extraction-engine/ops/check-supplemental.ts` |
| `ops/export-typescript-donors.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-typescript-donor-accounting.md`, `goals/citation-extraction-engine/ops/check-typescript-donors.ts` |
| `ops/export-vocabulary-mapping.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-vocabulary-version-mapping.md`, `goals/citation-extraction-engine/ops/check-vocabulary-mapping.ts` |
| `ops/observe-supplemental-text.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-supplemental-text.md`, `goals/citation-extraction-engine/ops/check-supplemental.ts` |
| `ops/probe-annotation-assembly.py` | `goals/citation-extraction-engine/history/evidence/2026-11-06-annotation-assembly.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-annotation-callback.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-annotation-mapping.py` | `goals/citation-extraction-engine/history/evidence/2026-11-06-annotation-preparation.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-annotation-skip.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-annotation-style.py` | `goals/citation-extraction-engine/history/evidence/2026-11-06-annotation-style.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-annotation-wrap-composition.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-annotation-wrap.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-annotation-xml.py` | `goals/citation-extraction-engine/history/evidence/2026-11-06-annotation-xml-kernel.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-authority-identity.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-authority-identity.md` |
| `ops/probe-builtin-diff.py` | none |
| `ops/probe-callback-mutations.py` | none |
| `ops/probe-canonical-models.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-canonical-models.md` |
| `ops/probe-canonical-tokenizer.py` | none |
| `ops/probe-case-metadata.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-case-name-predicates.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/server/src/internal/Citation/PythonCharacterData.ts`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-case-name-process-patterns.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-case-name-process.py` | none |
| `ops/probe-case-name-scan.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-case-name-selection.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-case-resource-hash.py` | none |
| `ops/probe-citation-rendering.py` | `goals/citation-extraction-engine/history/evidence/2026-11-05-built-in-rendering.md`, `THIRD_PARTY_NOTICES.md` |
| `ops/probe-cleaner-identities.py` | `goals/citation-extraction-engine/history/evidence/2026-10-31-cleaner-value-ownership.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-cleaner-pipeline.py` | `goals/citation-extraction-engine/ops/check-cleaner-pipeline.ts`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-cleaner-unicode.py` | `goals/citation-extraction-engine/ops/check-cleaner-unicode.ts`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-context-matches.py` | `goals/citation-extraction-engine/history/evidence/2026-11-03-context-matching.md` |
| `ops/probe-court-lookup.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-custom-resolution.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-custom-resolution-contract.md` |
| `ops/probe-default-observations.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-default-resolution.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-default-resolution.md` |
| `ops/probe-dictionary-reentrancy.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-diff-kernel.py` | `goals/citation-extraction-engine/history/evidence/2026-11-05-diff-kernel.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-dispatch-decisions.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-document-input-modes.py` | none |
| `ops/probe-dump.py` | `goals/citation-extraction-engine/ops/ledger-proof-plan.json`, `packages/law-practice/server/test/CitationDump.test.ts`, `packages/law-practice/server/test/CitationNativeRendering.fixtures.ts` (+2 more) |
| `ops/probe-edition-inference.py` | `goals/citation-extraction-engine/history/evidence/2026-11-03-edition-inference.md` |
| `ops/probe-extraction-loop.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-extraction-selection.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-extraction-shortcut.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-extractor-recipes.py` | none |
| `ops/probe-extractor-selection.py` | none |
| `ops/probe-factory-edition-lookup.py` | `goals/citation-extraction-engine/ops/ledger-proof-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/canonical-cases.json` |
| `ops/probe-frozen-editions.py` | none |
| `ops/probe-full-citation.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-full-law-metadata.py` | `goals/citation-extraction-engine/history/evidence/2026-11-03-full-law-metadata.md` |
| `ops/probe-generated-references.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-host-resources.py` | `goals/citation-extraction-engine/history/evidence/2026-10-29-host-resource-protocol.md` |
| `ops/probe-html-bytes.py` | `explorations/ten-minute-certainty/research/phase2/merged/routing.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/server/test/CitationHtmlBytes.test.ts` (+3 more) |
| `ops/probe-html-case-name-pattern.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-html-case-names.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-html-cleaner-audit.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-html-discovery-patterns.py` | `goals/citation-extraction-engine/history/evidence/2026-11-05-html-discovery-worker.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-html-discovery.py` | `goals/citation-extraction-engine/history/evidence/2026-11-05-html-discovery.md` |
| `ops/probe-html-input.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-html-kernel.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-identity-merger.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-vocabulary-version-mapping.md` |
| `ops/probe-journal-metadata.py` | `goals/citation-extraction-engine/history/evidence/2026-11-03-journal-metadata.md` |
| `ops/probe-law-metadata.py` | `goals/citation-extraction-engine/history/evidence/2026-11-03-law-metadata.md` |
| `ops/probe-law-schema.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-law-schema.md` |
| `ops/probe-literal-cleaners.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-live-case-resources.py` | none |
| `ops/probe-live-resources.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-metadata-strings.py` | `goals/citation-extraction-engine/history/evidence/2026-11-03-metadata-strings.md` |
| `ops/probe-metadata-year.py` | `goals/citation-extraction-engine/history/evidence/2026-11-03-metadata-year.md` |
| `ops/probe-model-mutations.py` | none |
| `ops/probe-native-slices.py` | none |
| `ops/probe-pin-extraction.py` | `goals/citation-extraction-engine/history/evidence/2026-11-05-pin-extraction.md` |
| `ops/probe-plain-case-name.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-post-case-metadata.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-pre-case-metadata.py` | `goals/citation-extraction-engine/history/evidence/2026-11-05-pre-case-metadata.md` |
| `ops/probe-prior-fulls.py` | none |
| `ops/probe-publication-resource-hashes.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-python-hashes.py` | `goals/citation-extraction-engine/history/evidence/2026-10-31-python-hashes.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-python-lower.py` | `packages/law-practice/server/src/internal/Citation/PythonCaseData.ts` |
| `ops/probe-python-repr.py` | `packages/law-practice/server/test/CitationNativeRendering.fixtures.ts`, `packages/law-practice/server/test/CitationPythonRepr.test.ts`, `THIRD_PARTY_NOTICES.md` |
| `ops/probe-reference-template.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-reference-token.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-regex-benchmark.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-regex-benchmark-contract.md`, `goals/citation-extraction-engine/ops/check-regex-benchmarks.ts` |
| `ops/probe-regex-boundaries.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-regex-capture-reuse.py` | `goals/citation-extraction-engine/history/evidence/2026-11-05-logical-capture-reuse.md` |
| `ops/probe-regex-case-flags.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-regex-characters.py` | `explorations/ten-minute-certainty/research/phase2/merged/routing.md`, `goals/citation-extraction-engine/history/evidence/2026-11-02-regex-translator.md`, `goals/route-soundness-repair/research/SOURCES.md` (+2 more) |
| `ops/probe-regex-compatibility.py` | `goals/citation-extraction-engine/history/evidence/2026-11-02-regex-admission-compile-survey.md`, `goals/citation-extraction-engine/ops/qualify-regex-translator.child.mjs`, `packages/law-practice/server/test/CitationRegexCharacters.test.ts` |
| `ops/probe-regex-engine-characters.py` | `packages/law-practice/server/src/internal/Citation/RegexV0Data.ts` |
| `ops/probe-regex-input.py` | `goals/citation-extraction-engine/history/evidence/2026-11-02-regex-input-preparation.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-regex-lookahead.py` | `goals/citation-extraction-engine/history/evidence/2026-11-03-positive-lookahead.md` |
| `ops/probe-regex-match-witnesses.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `goals/citation-extraction-engine/ops/qualify-regex-translator.child.mjs`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-regex-modes.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-regex-nullable.py` | none |
| `ops/probe-regex-program.py` | `goals/citation-extraction-engine/history/evidence/2026-11-02-regex-alphabet.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/server/test/CitationRegexCharacters.test.ts` (+1 more) |
| `ops/probe-regex-verbose.py` | `goals/citation-extraction-engine/history/evidence/2026-11-06-generated-reference-source.md` |
| `ops/probe-resolver-text.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-resolver-text.md`, `packages/law-practice/server/src/internal/Citation/PythonTextData.ts` |
| `ops/probe-resource-citation-correction.py` | `goals/citation-extraction-engine/history/evidence/2026-11-05-resource-citation-correction.md` |
| `ops/probe-resource-correction.py` | none |
| `ops/probe-runtime-dictionary.py` | none |
| `ops/probe-runtime-set-copy.py` | none |
| `ops/probe-runtime-set.py` | none |
| `ops/probe-short-missing-page.py` | none |
| `ops/probe-span-offsets.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-stop-word-patterns.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/probe-token-assembly.py` | none |
| `ops/probe-token-context.py` | none |
| `ops/probe-token-dispatch.py` | `goals/citation-extraction-engine/history/evidence/2026-11-03-token-extraction-dispatch.md` |
| `ops/probe-token-editions.py` | none |
| `ops/probe-token-equality.py` | `packages/law-practice/server/test/CitationTokenEquality.fixtures.ts`, `THIRD_PARTY_NOTICES.md` |
| `ops/probe-token-objects.py` | none |
| `ops/probe-token-text.py` | none |
| `ops/probe-tokenizer-composition.py` | none |
| `ops/probe-unicode-dictionary.py` | `goals/citation-extraction-engine/history/evidence/2026-10-31-unicode-dictionary.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/test_regex_compatibility.py` | `goals/citation-extraction-engine/history/evidence/2026-11-02-regex-admission-compile-survey.md` |
| `ops/verify-assertion-controls.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-assertion-corpus.md` |
| `ops/verify-bluebook-layout.py` | none |
| `ops/verify-builtin-diff.py` | `biome.jsonc`, `goals/citation-extraction-engine/ops/check-parity.ts` |
| `ops/verify-callback-mutation-controls.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-callback-mutation-shapes.md` |
| `ops/verify-case-metadata.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-case-name-process.py` | none |
| `ops/verify-case-name-selection.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-case-resource-hash-controls.py` | none |
| `ops/verify-cleaner-identities.py` | `biome.jsonc`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-cleaner-pipeline-controls.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-cleaner-unicode.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-consumer-scan.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-identity-foundations.md` |
| `ops/verify-custom-resolution-controls.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-custom-resolution-contract.md` |
| `ops/verify-default-observation-controls.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-dictionary-reentrancy.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-diff-kernel.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/server/assets/citation-diff/README.md`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-dispatch-decision-controls.py` | none |
| `ops/verify-divergence-controls.py` | none |
| `ops/verify-donor-controls.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-typescript-donor-accounting.md` |
| `ops/verify-evidence-presence.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-evidence-presence-audit.md` |
| `ops/verify-extraction-loop.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-extraction-selection.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-extraction-shortcut.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-frozen-edition-controls.py` | none |
| `ops/verify-full-citation.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-generated-references.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-host-resource-controls.py` | none |
| `ops/verify-html-bytes.py` | `biome.jsonc`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-html-case-names.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-html-cleaner-audit-controls.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-html-input-controls.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-html-kernel-controls.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-html-safety-exception.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-ledger-controls.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-source-case-ledgers.md` |
| `ops/verify-literal-cleaner-controls.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-live-case-resource-controls.py` | none |
| `ops/verify-live-resource-controls.py` | none |
| `ops/verify-model-mutation-controls.py` | none |
| `ops/verify-operation-controls.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-operation-corpus.md` |
| `ops/verify-parity-controls.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-portable-parity-command.md`, `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-plain-case-name.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-prior-full-controls.py` | `goals/citation-extraction-engine/history/evidence/2026-10-29-retained-prior-fulls.md` |
| `ops/verify-publication-resource-hash-controls.py` | none |
| `ops/verify-python-hashes.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-reference-template.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-reference-token.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-regex-benchmark-controls.py` | none |
| `ops/verify-runtime-dictionary-controls.py` | none |
| `ops/verify-runtime-set-controls.py` | none |
| `ops/verify-safety-controls.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-limits-isolation-contract.md` |
| `ops/verify-semantic-editions.py` | `goals/citation-extraction-engine/history/evidence/2026-11-06-semantic-projection.md` |
| `ops/verify-supplemental-controls.py` | none |
| `ops/verify-unicode-dictionary.py` | `goals/citation-extraction-engine/ops/divergence-plan.json`, `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` |
| `ops/verify-vocabulary-controls.py` | `goals/citation-extraction-engine/history/evidence/2026-10-28-vocabulary-version-mapping.md` |
