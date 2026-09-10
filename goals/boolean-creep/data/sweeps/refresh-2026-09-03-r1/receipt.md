# Current-corpus refresh round 1 receipt

- source SHA: `5b83dfb617efa8950c3e5de18fff16b116f08d38`
- mode: unseeded broad corpus refresh
- raw lane records: 319 (57 qualified, 262 disqualified)
- canonical reconciliation at this source: 338 records (59 qualified,
  279 disqualified)
- result: not dry; 13 qualified file/symbol/member clusters were newly admitted

The 13 original broad lanes covered the ratified `packages/**/src` and
`apps/**/src` corpus and exclusions. Five lanes reached Grok's turn limit only
after writing valid partial reports. Each was resumed with that partial report
as its skip seed:

- `foundation-cap-prim-cont1`: clean exit, 2 additional records
- `epistemic-cont1`: clean exit, 0 additional records
- `tooling-tool-cont1`: clean exit, 13 additional records
- `shared-documents-cont1`: clean exit, 0 additional records
- `tooling-rest-cont1`: clean exit, 4 additional records

Every original and continuation report validates against
`boolean-creep-inventory/v1`. Reconciliation retained stable canonical ids and
treated the following scanner names as aliases rather than duplicate scopes:

- `SupportsColorDecisionInputModel` -> `supports-color-decision-input-flags`
- `ColorHeuristicInputModel` -> `color-heuristic-input-flags`
- `goals index flags` -> `goals-portfolio-index-mode`
- `runCli` -> `codegen-kit-cli-mode`

The broad scanner did not independently rediscover three previously ratified
qualified scopes: `ontology-inspector-form-state`,
`codex-findings-ingest-modes`, and `generated-file-drift-mode-flags`. They were
retained only after direct source revalidation against this SHA; their evidence
was corrected to E4 or E2 rather than using the stale runtime-check-as-E3
interpretation.

The scanner proposed `yeet-monitor-command-route` as qualified using that stale
E3 interpretation. Direct review classified it D1: it is a raw CLI input bag
whose selector deliberately emits an invalid-input route and otherwise applies
precedence, not stored application state.

This round admitted the following 13 Tier 1 records and no Tier 2 record:

- `tour-state-open-payload`
- `xai-websocket-message-binary`
- `corpus-legacy-word-terminal`
- `goals-repair-fork-mode`
- `goals-migrate-conventions-mode`
- `goals-set-status-input`
- `docgen-runpod-template-search-mode`
- `yeet-ack-resolution-flags`
- `codex-findings-ingest-force-refresh`
- `codex-findings-ingest-command-force-refresh`
- `langextract-minimal-fold-segment-kind`
- `explore-atlas-mode`
- `codegen-kit-cli-mode`

`origin/main` advanced after this round completed. This receipt remains the
evidence for the named SHA; the next round uses the merged-forward source and
restarts dryness accounting.
