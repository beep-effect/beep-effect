# PLAN — Boolean-Creep Eradication

Mutable execution plan. Contract: [`SPEC.md`](./SPEC.md); binding decisions:
[`DECISIONS.md`](./DECISIONS.md).

## Phases

| Phase | Name | Status | Exit |
| --- | --- | --- | --- |
| P0 | Bootstrap packet | complete | Packet on disk; inventory seeded (10 confirmed + 4 disqualified) and schema-valid; decisions seeded. |
| P1 | Original inventory sweep (grok lanes) | complete | Original corpus swept until dry; lane outputs merged; 100% of qualified evidence verified. |
| G1 | GATE 1 — inventory ratification | **passed 2026-08-17** | Benjamin ratified all 46; no strikes, Tier 2 included. |
| P2 | Design (codex Sol medium) | complete | 46 per-instance documents plus one shared CLI-family design. |
| P2R | Moving-main inventory and design refresh | **in progress** | Current corpus is dry for two consecutive rounds; every qualified record has verified evidence and a corrected design. |
| P3 | Independent design review | pending | Replacement exact-source receipt covers 100% of qualified ids with zero findings. |
| G2 | GATE 2 — delegated transition | pending | P2R and P3 evidence satisfy Benjamin's 2026-09-03 bounded mandate. |
| P4 | Apply + land (codex, yeet) | pending | Tiered PRs mergeable; inventory statuses advanced to `applied`. |
| P5 | Exact-main dryness and close | pending | Two dry rounds, reflection, and `completed-retained` closeout are merged to `main`. |

## Current lane

The 2026-09-03 ratification audit revoked the old zero-findings claim. All 46
original opportunities still existed and none had been implemented, but three
were wrongly classified as internal and several designs had incomplete reader,
compatibility, or sequencing inventories. The historical baseline is now 40
Tier 1 and 6 Tier 2 records before new admissions.

P2R rebuilt the canonical inventory against live `origin/main`. The first round
ran unseeded so historical D1/D2 records could not hide current cases; residue
rounds then probed sibling state, class latches, derived booleans, return
structs, and split aggregate state. The current result is **764 records: 105
qualified and 659 disqualified** (D1 533 / D2 126), with **94 Tier 1 and 11
Tier 2**. Round 22 at `c78ee7471a35825e7757f49138d17189298491f9`
added no canonical qualification. After `origin/main` advanced, round 23 at
`53193e5a5e7ea29036368085635aef680c614d27` admitted
`r3-tooling-docgen-local-full-reason-input-kind`, resetting the dry counter;
its foundation and drivers/architecture lanes then exited nonzero after output
budget exhaustion, so the round is not completion evidence. The branch is now
at exact `42eecabbe1bc767161ee21c742c0f2c6d94a4e14`, with zero dry rounds
credited at that SHA. The failed broad source families have been split into
smaller non-overlapping replacement lanes with the same corpus coverage.

P3 independently reviews every qualified record's evidence and design. GATE 2
passes under Benjamin's delegated authority only when the replacement
exact-source review receipt reports zero findings. No source implementation is
authorized before the packet-only PR is merged and verified on `main`.

Landing is serial: Tier 1A backend/driver state, Tier 1B DMS connection, Tier
1C foundation UI/capability, Tier 1D application/ontology UI, Tier 1E repo CLI,
then eleven Tier 2 singleton PRs (tool-name report, NLP, SHACL, ontology
inference, Vault, runners, two ordered Effect Imports summary migrations, Yeet
sweep plan, Yeet status, Yeet verdict). Re-resolve and
merge `origin/main` forward before every review and publication operation;
never rebase or merge a PR as the agent.

The current 94-record Tier 1 landing map is:

- **1A — backend and driver state (13):**
  `scan-state-json-lexer-flags`, `duckdb-transaction-began-closed`,
  `drivers-stream-state`, `drivers-migration-journal-shape-row`,
  `pretext-detect-engine-family`, `phoenix-prompt-read-exists`,
  `venice-sse-done-payload`, `xai-sse-done-payload`,
  `xai-websocket-message-binary`, `cosmos-backend-selection-webgl2`,
  `r2-domains-anthropic-turn-holding-after-failure`,
  `r3-arch-ecosystem-internal-pg-timestamp-timezone`, and
  `r3-drivers-arch-folder-resolution-blocked-provider`.
- **1B — DMS connection probe (1):** `dms-mirror-probe-connected`.
- **1C — foundation, shared-domain, UI, and capability state (13):**
  `color-support-level-flags`, `dock-tab-drag-phase`,
  `foundation-ui-system-menus-open`,
  `r3-foundation-mention-plugin-lookup-phase`,
  `link-preview-fetch-machine`,
  `foundation-ui-system-speech-input-connection`,
  `tour-state-open-payload`, `langextract-minimal-fold-segment-kind`,
  `html-select-child-grammar`, `html-dl-child-grammar`,
  `r2-foundation-unique-match-search`, and
  `r2-foundation-graph-validation-result`, and
  `organization-tenant-placement-bits`.
- **1D — application runtime and ontology UI state (17):**
  `r2-apps-contact-form-submit-phase`, `desktop-panel-menu-item-state`,
  `r2-apps-sidebar-thread-list-phase`, `thread-transcript-load-state`,
  `thread-load-state-props`, `intake-vault-status`,
  `r2-apps-vault-sync-command-busy`, `ontology-inspector-form-state`,
  `document-toolbar-busy-disabled`, `r3-apps-pglite-data-dir-probe`,
  `r3-apps-sidecar-devtools-gates`,
  `ontology-infer-session-recompute-latches`,
  `r2-apps-dock-panel-open-active`, `document-violation-flags`,
  `r2-domains-ontology-graph-worker-requeue-latches`,
  `r3-apps-desktop-shell-rpc-access`, and
  `r3-domains-reasoner-module-affected-flags`.
- **1E — internal tooling domains (50):** `package-verify-step-outcome`,
  `create-package-template-type-flags`,
  `create-package-template-app-kind-flags`, `runners-bake-cli-mode`,
  `docgen-local-json-requires-plan`, `tsconfig-sync-mode-flags`,
  `r2-tooling-bin-main-fast-paths`, `r3-tooling-terse-effect-file-flags`,
  `codex-findings-ingest-modes`, `docgen-quality-scope-flags`,
  `goals-portfolio-index-mode`, `generated-file-drift-mode-flags`,
  `fallow-boundaries-mode`, `sync-data-to-ts-run-mode`, `skills-run-mode`,
  `corpus-legacy-word-terminal`, `goals-repair-fork-mode`,
  `goals-migrate-conventions-mode`, `goals-set-status-input`,
  `docgen-runpod-template-search-mode`, `yeet-ack-resolution-flags`,
  `codex-findings-ingest-force-refresh`,
  `codex-findings-ingest-command-force-refresh`, `explore-atlas-mode`,
  `codegen-kit-cli-mode`, `worktree-removal-mode`,
  `r3-tooling-docker-tag-kind-flags`,
  `r3-tooling-ecosystem-polarity-specifier-call`,
  `r2-tooling-packet-transition-stream-trace`,
  `r3-tooling-registration-deletion-note-phase`,
  `r3-tooling-create-caption-overwrite-phase`,
  `r2-tooling-law-scan-strict-failure`,
  `r2-tooling-no-native-runtime-strict-failure`,
  `terse-effect-rules-strict-failure`,
  `laws-effect-imports-command-options`,
  `laws-effect-import-rules-options`, `effect-import-source-transform-phase`,
  `r2-tooling-tmpfs-reap-classified-reaped`, `flake-quarantine-step-kind`,
  `r3-tooling-architecture-export-subpath-kind`,
  `r3-tooling-codegen-source-test-filename`,
  `r3-tooling-coverage-scope-input-kind`,
  `r3-tooling-docgen-quality-companion-kinds`,
  `r3-tooling-envconfig-turbo-spawn-kind`,
  `r3-tooling-inline-schema-compile-arg-kind`,
  `r3-tooling-manual-runtime-receiver-kind`,
  `r3-tooling-quality-repo-wide-step-gates`,
  `r3-tooling-quality-root-audit-head-kind`,
  `r3-tooling-schema-first-tagged-error-factory-kind`, and
  `r3-tooling-docgen-local-full-reason-input-kind`.

The eleven Tier 2 records are singleton PRs in this order:
`tool-name-collision-row-truncated-digest`, `nlp-mcp-file-info-exists`,
`shacl-validation-result-flags`, `ontology-inference-recompute-cause`,
`vault-sync-status-connected`,
`runners-bake-freshness`, `effect-import-rules-summary-operation`,
`effect-import-rules-strict-failure`,
`r2-tooling-sweep-plan-operator-handoff`,
`yeet-status-remote-check-phase`, and `yeet-merge-ready-verdict`. A later newly
admitted Tier 2 record would also receive a singleton PR.

## Recorded browser-QA matrix

Successful portless record -> extract -> judge evidence with
`requiredCount: 0` is required for each affected gesture surface:

- Tier 1C: dock dragging; editor menus and mention typeahead; speech
  connection; link preview; tour start/step/back/close.
- Tier 1D: contact submission; desktop menu, sidebar, and thread-load flows;
  Vault controls; ontology inspector and document-toolbar actions.

Unit/component tests remain mandatory. Store the resulting QA artifact paths
and verdicts in each implementation PR's evidence rather than claiming a
package-level UI check covers an unrecorded gesture.

Historical P1 evidence follows.

P1 sweep rounds executed (2026-08-17):

- **Round 1** — 13 area-scoped grok lanes: 15 confirmed, 189 disqualified.
- **Round 2** — 5 residue-hunt lanes (useState/class-field/piped-boolean
  angles): 5 confirmed, 31 disqualified.
- **Round 3** — 5 lanes (let-latches, AsyncResult projections, tuples):
  9 confirmed, 18 disqualified.
- **Round 4** — single broad convergence lane: 0 confirmed, 2 disqualified.
- **Round 5** — exhaustive mechanical-residual triage (every remaining corpus
  file with a same-scope boolean cluster): 4 confirmed + orchestrator closed
  the exclusive-CLI-mode-flag family by exhaustive grep (3 more confirmed).
- **Round 6** — broad falsification pass, fresh angles: 0 confirmed,
  1 disqualified.
- **Round 7** — second consecutive dryness confirmation: 0 confirmed,
  0 disqualified ("DRY: nothing new"). Rounds 6+7 are the two consecutive
  empty rounds; P1 is dry.

Final inventory: **294 records — 46 qualified, 248 disqualified**
(D1 207 / D2 41). GATE 1 passed on 2026-08-17; all 46 qualified records are
currently `reviewed` while GATE 2 awaits ratification.

Every confirmed entry was evidence-verified by the orchestrator (100%, not
the 20% minimum). The exclusive-CLI-mode-flag family's collapse
infrastructure already exists at
`packages/tooling/tool/cli/src/internal/cli/RunMode.ts` — designs should
reuse it.

## Sweep lane map (round 1)

| Lane | Areas | ~files |
| --- | --- | --- |
| tooling-tool | packages/tooling/tool | 447 |
| foundation-modeling | packages/foundation/modeling | 377 |
| law-practice | packages/law-practice | 304 |
| drivers | packages/drivers | 288 |
| foundation-ui-system | packages/foundation/ui-system | 196 |
| foundation-cap-prim | packages/foundation/capability + primitive | 189 |
| epistemic | packages/epistemic | 152 |
| shared-documents | packages/shared + packages/documents | 212 |
| tooling-rest | packages/tooling/library + policy-pack + test-kit | 155 |
| workspace-agents | packages/workspace + packages/agents | 144 |
| arch-eco-internal | packages/architecture-lab + ecosystem + _internal | 114 |
| ontology-mcp | packages/ontology + apps/practice-kg-mcp + apps/architecture-lab-proof | 78 |
| apps | apps/professional-desktop + apps/oip-web | 91 |

## Verification lane

```sh
bun goals/boolean-creep/ops/validate-inventory.ts
bun goals/boolean-creep/ops/validate-designs.ts
jq . goals/boolean-creep/ops/manifest.json
test "$(wc -m < goals/boolean-creep/GOAL.md)" -le 4000
```

## Blockers

No user design decision is open. Fresh Grok lanes currently fail with HTTP 402
`Grok Build usage balance exhausted`, so P2R cannot obtain two exact-main dry
rounds or begin the independent P3 review until provider balance is restored.
P4 remains evidence-gated on the refreshed packet, replacement zero-finding
review, and merged packet-only ratification PR.
