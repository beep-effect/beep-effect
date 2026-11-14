# Python triage (308 files, base 05ed8bc6b6cc)

Consumer search: `rg -l --hidden --fixed-strings <basename>` over the tree, excluding `.git`,
`.repos`, `node_modules`, `*.py` and `*.jsonl`. A consumer is a workflow, hook,
package script, skill, systemd unit, repo-cli source file or `opsScripts` entry. Mentions in
reports and research notes count as recorded evidence, not consumers.

| File | Disposition | Consumer / evidence |
| --- | --- | --- |
| .claude/skills/auth-environments/scripts/auth_env.py | ported (skills lane PR) | skill SKILL.md |
| .claude/skills/auth-environments/scripts/test_auth_env.py | ported (skills lane PR) | skill SKILL.md |
| .claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py | ported (skills lane PR) | skill SKILL.md; `test/ontology-validator-cli-boundary.test.ts` |
| .claude/skills/plasma-sensitive-entry/scripts/install.py | ported (skills lane PR) | skill SKILL.md / references/integration.md |
| .claude/skills/plasma-sensitive-entry/scripts/prompt.py | ported (skills lane PR) | skill SKILL.md / references/integration.md |
| .claude/skills/plasma-sensitive-entry/scripts/ssh-askpass.py | ported (skills lane PR) | skill SKILL.md / references/integration.md |
| .claude/skills/plasma-sensitive-entry/scripts/test_prompt.py | ported (skills lane PR) | skill SKILL.md / references/integration.md |
| .claude/skills/update-harnesses/scripts/test_update_harnesses.py | ported (skills lane PR) | skill SKILL.md |
| .claude/skills/update-harnesses/scripts/update_harnesses.py | ported (skills lane PR) | skill SKILL.md |
| apps/labs/ciops/scripts/check-emission-cq.py | ported → `apps/labs/ciops/test/emission-cq.test.ts` | explorations MAP.md, s7 contract |
| apps/labs/ciops/scripts/check-lane-plan-cq.py | ported → `apps/labs/ciops/test/lane-plan-cq.test.ts` | explorations run4 brief |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/adapter-config.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 28 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/adapter-journal-run3.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 192 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/adapter-journal-run4.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 179 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/adapter-journal.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 29 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/adapter-typescript.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 738 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/chain_digest.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 10 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/po_from_evidence.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 4 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/adapters/runtime_po_capture.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/etl_fleet_corpus.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 24 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/etl_run3_checkout_identity.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 13 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/etl_run3_fleet_corpus.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 19 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/etl_run3b_fleet_corpus.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 22 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/etl_run4_fleet_corpus.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 7 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/etl_run4_proof_ledger.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 9 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/po_transcriber_run2.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/po_transcriber_run3.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 6 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/po_transcriber_run4.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 4 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/test_run2_repair.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/test_run3_generators.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 10 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/test_run3b_generator.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 10 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/test_run4_fleet_generator.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/test_run4_proof_ledger.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 33 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s5/scripts/apply_s5_dispositions.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 9 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s5/scripts/build_dispositions.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s5/scripts/build_ledger_docket.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s5/scripts/join_s4b.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 4 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s5/scripts/merge_taxonomy.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s6/scripts/_common.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` |
| explorations/beep-ci-operational-ontology/ontology/extraction/s6/scripts/apply_s6_dispositions.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 12 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s6/scripts/build_abox.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s6/scripts/build_predicates.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 7 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s6/scripts/etl_census.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 4 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s6/scripts/etl_policy.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s6/scripts/etl_snapshot.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 6 file(s)) |
| explorations/beep-ci-operational-ontology/ontology/extraction/s6/scripts/run_shacl.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 7 file(s)) |
| explorations/beep-ci-operational-ontology/research/scripts/kpi_baseline_probe.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 11 file(s)) |
| explorations/beep-ci-operational-ontology/research/scripts/merge_s4_lanes.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 4 file(s)) |
| explorations/beep-ci-operational-ontology/research/scripts/redact_journal_snapshot.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 10 file(s)) |
| explorations/beep-ci-operational-ontology/research/scripts/regen_cq_artifacts.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 35 file(s)) |
| explorations/beep-ci-operational-ontology/research/scripts/run_cq_suite.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 30 file(s)) |
| explorations/beep-ci-operational-ontology/research/scripts/validate_packet.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 54 file(s)) |
| explorations/beep-ci-operational-ontology/research/scripts/verify_run3_citations.py | deleted | none; output retained at `explorations/beep-ci-operational-ontology/history/2026-11-13-python-removed.md` (cited by 7 file(s)) |
| goals/alchemy-vault-sync-slice/research/06-pr3a-scoped-lints.py | deleted | none; output retained at `goals/alchemy-vault-sync-slice/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/alchemy-vault-sync-slice/research/pr3c-scoped-lints.py | deleted | none; output retained at `goals/alchemy-vault-sync-slice/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/boolean-creep/ops/test_sweep_scratch.py | deleted | none; output retained at `goals/boolean-creep/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/audit-oracle.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/build-annotation-xml.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 4 file(s)) |
| goals/citation-extraction-engine/ops/build-diff-kernel.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/build-html-kernel.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/export-assertions.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 4 file(s)) |
| goals/citation-extraction-engine/ops/export-divergences.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/export-helper-configurations.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/export-ledgers.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/export-operations.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 6 file(s)) |
| goals/citation-extraction-engine/ops/export-parser-catalog.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/export-regex-contract.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/export-semantic-editions.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/export-supplemental.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/export-typescript-donors.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/export-vocabulary-mapping.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/observe-supplemental-text.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-annotation-assembly.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-annotation-callback.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-annotation-mapping.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-annotation-skip.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-annotation-style.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-annotation-wrap-composition.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-annotation-wrap.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-annotation-xml.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-authority-identity.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-builtin-diff.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-callback-mutations.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-canonical-models.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-canonical-tokenizer.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-case-metadata.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-case-name-predicates.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-case-name-process-patterns.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-case-name-process.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-case-name-scan.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-case-name-selection.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-case-resource-hash.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-citation-rendering.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-cleaner-identities.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-cleaner-pipeline.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-cleaner-unicode.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-context-matches.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-court-lookup.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-custom-resolution.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-default-observations.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-default-resolution.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-dictionary-reentrancy.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-diff-kernel.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-dispatch-decisions.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-document-input-modes.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-dump.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 5 file(s)) |
| goals/citation-extraction-engine/ops/probe-edition-inference.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-extraction-loop.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-extraction-selection.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-extraction-shortcut.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-extractor-recipes.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-extractor-selection.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-factory-edition-lookup.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-frozen-editions.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-full-citation.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-full-law-metadata.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-generated-references.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-host-resources.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-html-bytes.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 6 file(s)) |
| goals/citation-extraction-engine/ops/probe-html-case-name-pattern.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-html-case-names.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-html-cleaner-audit.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-html-discovery-patterns.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-html-discovery.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-html-input.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-html-kernel.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-identity-merger.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-journal-metadata.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-law-metadata.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-law-schema.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-literal-cleaners.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-live-case-resources.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-live-resources.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-metadata-strings.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-metadata-year.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-model-mutations.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-native-slices.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-pin-extraction.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-plain-case-name.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-post-case-metadata.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-pre-case-metadata.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-prior-fulls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-publication-resource-hashes.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-python-hashes.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-python-lower.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-python-repr.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-reference-template.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-reference-token.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-benchmark.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-boundaries.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-capture-reuse.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-case-flags.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-characters.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 5 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-compatibility.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-engine-characters.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-input.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-lookahead.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-match-witnesses.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-modes.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-nullable.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-regex-program.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 4 file(s)) |
| goals/citation-extraction-engine/ops/probe-regex-verbose.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-resolver-text.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-resource-citation-correction.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-resource-correction.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-runtime-dictionary.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-runtime-set-copy.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-runtime-set.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-short-missing-page.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-span-offsets.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-stop-word-patterns.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-token-assembly.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-token-context.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-token-dispatch.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/probe-token-editions.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-token-equality.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/probe-token-objects.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-token-text.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-tokenizer-composition.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/probe-unicode-dictionary.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/test_regex_compatibility.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-assertion-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-bluebook-layout.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-builtin-diff.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-callback-mutation-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-case-metadata.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-case-name-process.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-case-name-selection.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-case-resource-hash-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-cleaner-identities.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/verify-cleaner-pipeline-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-cleaner-unicode.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-consumer-scan.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-custom-resolution-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-default-observation-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-dictionary-reentrancy.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-diff-kernel.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/verify-dispatch-decision-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-divergence-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-donor-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-evidence-presence.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-extraction-loop.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-extraction-selection.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-extraction-shortcut.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-frozen-edition-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-full-citation.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-generated-references.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-host-resource-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-html-bytes.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/verify-html-case-names.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-html-cleaner-audit-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-html-input-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-html-kernel-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-html-safety-exception.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-ledger-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-literal-cleaner-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-live-case-resource-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-live-resource-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-model-mutation-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-operation-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-parity-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/citation-extraction-engine/ops/verify-plain-case-name.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-prior-full-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-publication-resource-hash-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-python-hashes.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-reference-template.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-reference-token.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-regex-benchmark-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-runtime-dictionary-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-runtime-set-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-safety-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-semantic-editions.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/citation-extraction-engine/ops/verify-supplemental-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` |
| goals/citation-extraction-engine/ops/verify-unicode-dictionary.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/citation-extraction-engine/ops/verify-vocabulary-controls.py | deleted | none; output retained at `goals/citation-extraction-engine/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/claim-check-performance/research/census-components.py | deleted | none; output retained at `goals/claim-check-performance/history/2026-11-13-python-removed.md` |
| goals/claim-check-performance/research/diagnose-structures.py | deleted | none; output retained at `goals/claim-check-performance/history/2026-11-13-python-removed.md` (cited by 19 file(s)) |
| goals/claim-check-performance/research/evaluate-gates.py | deleted | none; output retained at `goals/claim-check-performance/history/2026-11-13-python-removed.md` (cited by 31 file(s)) |
| goals/claim-check-performance/research/freeze-runtime-closure.py | deleted | none; output retained at `goals/claim-check-performance/history/2026-11-13-python-removed.md` (cited by 22 file(s)) |
| goals/claim-check-performance/research/test_census_components.py | deleted | none; output retained at `goals/claim-check-performance/history/2026-11-13-python-removed.md` |
| goals/claim-check-performance/research/test_evaluation_coverage.py | deleted | none; output retained at `goals/claim-check-performance/history/2026-11-13-python-removed.md` (cited by 21 file(s)) |
| goals/claim-check-performance/research/test_preservation.py | deleted | none; output retained at `goals/claim-check-performance/history/2026-11-13-python-removed.md` (cited by 21 file(s)) |
| goals/claim-check-performance/research/test_usefulness.py | deleted | none; output retained at `goals/claim-check-performance/history/2026-11-13-python-removed.md` |
| goals/claim-check-performance/research/usefulness.py | deleted | none; output retained at `goals/claim-check-performance/history/2026-11-13-python-removed.md` (cited by 27 file(s)) |
| goals/claim-check-performance/research/verify-preservation.py | deleted | none; output retained at `goals/claim-check-performance/history/2026-11-13-python-removed.md` (cited by 26 file(s)) |
| goals/cloud-agent-readiness/ops/cli-proxy-startup-check.py | ported → `ops/cli-proxy-startup-check.ts` | systemd drop-in `ops/cli-proxy-startup.conf` |
| goals/cloud-agent-readiness/ops/mcp-readonly-probe.py | deleted | none; output retained at `goals/cloud-agent-readiness/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/cloud-agent-readiness/ops/ssh-touch-reuse-check.py | ported → `ops/ssh-touch-reuse-check.ts` | `ops/ssh-touch-reuse.md` |
| goals/compute-profile-gate-routing/assets/render-ci-docs-only-routing.py | ported → `assets/render-ci-docs-only-routing.ts` | `docs/reports/ci-docs-only-acceptance-2026-11-09.md` |
| goals/repository-simplification-residue/ops/2026-10-23-telemetry-namespace-cutover.py | deleted | none; output retained at `goals/repository-simplification-residue/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/repository-simplification-residue/ops/probe-agent-projection.py | deleted | none; output retained at `goals/repository-simplification-residue/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/repository-simplification-residue/ops/probe-nested-doctrine.py | deleted | none; output retained at `goals/repository-simplification-residue/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/time-to-certainty/research/scripts/economics.py | deleted | none; output retained at `goals/time-to-certainty/history/2026-11-13-python-removed.md` (cited by 24 file(s)) |
| goals/time-to-certainty/research/scripts/test_economics.py | deleted | none; output retained at `goals/time-to-certainty/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics.py | ported → `beep cache producer-diagnose` (#3296); file deleted in the final PR | `.github/workflows/heavy.yml` (consumed @main) |
| goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics.test.py | ported → `beep cache producer-diagnose` (#3296); file deleted in the final PR | `.github/workflows/heavy.yml` (consumed @main) |
| goals/turborepo-cache-trust-observability/research/saved-trial-storage-grants.py | deleted | none; output retained at `goals/turborepo-cache-trust-observability/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/turborepo-quality-cache-adoption/research/actual-ignored-input-control.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 5 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-base-ref-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 6 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-boundaries-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 5 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-cargo-applicability.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-cargo-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-filter-composition-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 9 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-future-flag-availability.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 44 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-global-configuration-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 5 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-input-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 5 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-log-cache-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 8 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-log-presentation-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 8 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-observability-default-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 6 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-permission-flag-availability.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 10 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-permission-mode-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 10 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-prune-global-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 7 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-selection-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 17 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-setup-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 5 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-signature-key-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 9 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-source-family-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/turborepo-quality-cache-adoption/research/native-worktree-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 5 file(s)) |
| goals/turborepo-quality-cache-adoption/research/refresh-current-population.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 3 file(s)) |
| goals/turborepo-quality-cache-adoption/research/signature-key-source-binding-controls.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/turborepo-quality-cache-adoption/research/test_cargo_review_integrity.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/turborepo-quality-cache-adoption/research/test_selection_invoke_compatibility.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/turborepo-quality-cache-adoption/research/watch-source-review.py | deleted | none; output retained at `goals/turborepo-quality-cache-adoption/history/2026-11-13-python-removed.md` (cited by 1 file(s)) |
| goals/turborepo-task-qualification/research/refresh-adoption-handoff.py | deleted | none; output retained at `goals/turborepo-task-qualification/history/2026-11-13-python-removed.md` (cited by 2 file(s)) |
| goals/turborepo-task-qualification/research/refresh-command-boundaries.py | deleted | none; output retained at `goals/turborepo-task-qualification/history/2026-11-13-python-removed.md` (cited by 6 file(s)) |
| goals/turborepo-task-qualification/research/refresh-command-groups.py | deleted | none; output retained at `goals/turborepo-task-qualification/history/2026-11-13-python-removed.md` (cited by 22 file(s)) |
| goals/turborepo-task-qualification/research/refresh-compiler-configs.py | deleted | none; output retained at `goals/turborepo-task-qualification/history/2026-11-13-python-removed.md` (cited by 4 file(s)) |
| goals/turborepo-task-qualification/research/refresh-nested-commands.py | deleted | none; output retained at `goals/turborepo-task-qualification/history/2026-11-13-python-removed.md` (cited by 8 file(s)) |
| goals/turborepo-task-qualification/research/refresh-workflow-boundaries.py | deleted | none; output retained at `goals/turborepo-task-qualification/history/2026-11-13-python-removed.md` (cited by 8 file(s)) |
| infra/r2-cache/fleet.py | ported → `beep cache r2 fleet` | `infra/r2-cache/workstation.sh`, README |
| infra/r2-cache/policy-lab.py | deleted | README operator step only; results in `infra/r2-cache/research/` |
| infra/r2-cache/policy_runtime.py | ported → `Cache.adapter.host.ts` (in-process) | `Cache.adapter.ts` |
| infra/r2-cache/probe.py | ported → `beep cache r2 probe` | `.github/workflows/cache-warm.yml` |
| infra/r2-cache/trial-grants.py | deleted | README operator step only; results in `infra/r2-cache/research/` |
| packages/foundation/modeling/markdown/scripts/extract-gfm-corpora.py | ported → `scripts/extract-gfm-corpora.ts` | `data/conformance/gfm/VENDORED.md` |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/__init__.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/__main__.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/backends/__init__.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/backends/adaface_kprpe.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/backends/base.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/backends/buffalo_l.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/model_store.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/pipeline.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/quality.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/scoring.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/beep_photo_face/worker.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/tests/test_adaface_backend.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
| packages/tooling/tool/cli/python/photo-face/tests/test_worker.py | ported (photo-face lane PR) | `beep files match-person` worker (`MatchPerson.worker-service.ts`) |
