# GitHub audit — workstream E

Wave committed locally; publication blocked and hosted/package acceptance remains open. Local edits are not yet final-head proof. Every actionable row stays in scope, including P2/P3.

| Finding | Area | Disposition | Evidence |
| --- | --- | --- | --- |
| E-01 | Main Check concurrency | Orchestrator cancelled 37518935952; successor 37944257965 completed/failure with inherited Lint Policy red. Detector prepared. | Live run read; held-group clean; fixture not executed |
| E-02 | Trusted writer boundary | Workflow lint prepared; repository writer token retained until R41 safety gate. | stage-3 snapshot; no deletion claim |
| E-03 | Nightly/data-sync credentials | Job-level Turbo credentials removed; setup policy caller tuple prepared; C owns event matrix port. | workflow-lint clean; hosted nightly dispatch pending merge |
| E-04 | Required declarations | Descriptors reconciled to live 16 contexts; read-only capture/check implemented. | ci ruleset --capture and --check pass; captured fixture regenerated |
| E-05 | Dependency review | Availability probe removed; dependency review unconditional on PR. | Parsed workflow; hosted Security execution pending PR |
| E-06 | Knip retirement window | Held for S3; ruleset/job/descriptor remain synchronized until stage-2 no-pending gate. | Current live snapshot retains Knip; orchestrator owns removal |
| E-07 | Size labels | CLI diff removes contradictory size labels; same-repo-only job. | Threshold/diff fixtures not executed; hosted label proof pending PR |
| E-08 | Storybook concurrency/artifacts | PR-only cancellation; PR artifact lifetime 7 days, push 30 days; lint fixture prepared. | workflow-lint clean; hosted push pending |
| E-09 | Desktop release | Enabled, dormant live path; environment/reviewer/tag policy created; signing key externally absent. Endpoint and action comment prepared. | stage-3 before-desktop-environment and before-desktop-tag-policy; ci settings --check pass |
| E-10 | Data sync | Hosted workflow disabled; schedule/write grants/default-token fallback removed locally. | stage-3 before-disable-data-sync; disabled_manually readback |
| E-11 | Cache Warm | Inherited cold-fleet docgen native compiler test timeout attributed; shared main repair required. Pins aligned locally. | Run 36867409067 job 110386255398: Test timed out in 15000ms |
| E-12 | Docs-only classification | Schema-derived guard excludes apps/packages/infra Markdown; C consumes shared classifier. | Classification fixtures not executed; C parity pending |
| E-13 | Fork Heavy admission | Distinct second approval label required; forks never docs-only skip; monitor/watch carry fork status. | Fork fixture not executed; hosted fork event pending |
| E-14 | Writer environments | Verify and Heavy matrix environments/token inputs restricted to uses_turbo true. | workflow-lint clean; main-push attachment proof pending merge |
| E-15 | Dead app secrets/Cachix | C owns app-input removal/blank-export parity; absent Cachix writer token path removed. | E/C ordering Decision Log; C package proof pending |
| E-16 | Setup cache-write/Bun cache | Default false; Bun restore/save paths removed locally. Stale cache purge deferred to G recoverable cleanup. | workflow-lint clean; cache-usage before/after pending G |
| E-17 | Ghost repo-law | Disabled hosted registration. | stage-3 before-disable-repo-law; disabled_manually readback |
| E-18 | Impeccable residue | A owns complete removal and consumers; E avoids a partial duplicate removal. | A integration pending |
| E-19 | Actions allowlist | changesets/action removal waits for D publication decision. | Prior allowed-action patterns exported; no write yet |
| E-20 | Runner group | Retain fleet health/red-team probes; narrowing check.yml awaits program-PR reusable-workflow probe. | Prior runner group exported; no narrowing claim |
| E-21 | Permissions | Unused SAST security-events write removed; Security PR write retained for actual dependency review. | Local workflow diff; hosted pending |
| E-22 | Timeouts | Lint/Test Unit aggregators bounded to 5 minutes; desktop-ready to 15. | Parsed workflow |
| E-23 | Checkout credentials | Explicit persist-credentials false in nightly/data-sync/desktop; nightly issues write job-scoped. | Local workflow diff |
| E-24 | Action pins/updater | Established checkout/upload/cache-save pins aligned, Nix v31 tag verified; Dependabot actions entry prepared. | GitHub ref checks; typos pin 1.50.3 coordinated through shared gate |
| E-25 | Push ref trust | C owns environment port main-ref defense; acceptance row recorded. | E/C Decision Log; C matrix pending |
| E-26 | Orphan names/environments | Retained pending recovery source for secret values and Vercel binding ownership proof. | Names-only snapshot; no live-binding evidence, no deletion |
| E-27 | Ruleset hardening | Contexts pinned to Actions 15368; thread resolution required. Admin bypass/zero approvals retained intentionally for single operator. | stage-3 before-ruleset-hardening; 16 pinned contexts readback |
| E-28 | Heavy Admit pending replacement | Admission-label and unrelated-label events separated by concurrency key; distinct fork label supported. | Local workflow diff; concurrency/hosted probe pending |
| E-29 | PR-controlled workflows | Accepted single-operator posture with reconsideration for independent contributors. | SPEC Decision Log and docs/runbooks/ci-hosted-settings.md |
| E-30 | Descriptor producing workflow | workflow field added; YAML job-name parser/inventory fixture prepared. | Inventory fixture not executed; generated declarations shared integration pending |
| E-31 | Post-merge Heavy proof | Mandatory exact-merge-SHA probe documented; PR exercises heavy.yml@main. | docs/runbooks/ci-hosted-settings.md; post-merge seven-lane proof pending |
| E-32 | Caller secret boundary | Trusted caller retains secret expressions; C environment port acceptance explicitly forbids acquiring secrets. | E/C ordering Decision Log |
| E-33 | Heavy Admit comment | Clarified GITHUB_TOKEN labels versus human/agent events. | Local workflow diff |

## Size-label correction

The pure CLI diff retains one threshold label, deletes other `size/*` labels and preserves unrelated labels. The workflow skips forks explicitly. Hosted size-label readback is pending publication.

## Lane-declaration reconciliation

The dated capture is generated by `ci ruleset --capture`, compared with live GitHub through `--check`, and keeps Knip until S3. Coverage Regression and Lint Policy stay advisory; JSDoc Ratchet stays required. The shared gate owns generated declarations.

## Event/credential fixture results

Fixtures cover missing environment, missing caller guard, non-Turbo matrix writers, main-push cancellation, absent artifact retention, cache-write default, old waiting/pending runs, desktop reviewer absence, threshold replacement and fork admission. Heavy fixture commands waited for admission and were stopped before execution at blocked handoff; no passing test count is asserted here. C owns the environment event/token matrix.

## Writer-boundary preservation

No repository writer secret was deleted before the successful-main-writer safety net. Environment attachment and token guards move together. Scheduled/dispatchable nightly uses only the explicit read tuple through setup; current policy may choose local-only. C may extend trusted-main schedule reads, with synthetic proof. Short-lived trusted-push Turbo summary uploads make future remote-hit evidence durable.

## Hosted verification

Read-only `ci settings --check`, `ci ruleset --check` and `ci held-group` passed; the six hosted writes have preceding snapshots and readbacks. A program PR, main writer attachment/cache mode, nightly dispatch, runner-group probe, G remote hits and post-merge Heavy probe remain acceptance requirements.

## Recovery

For rulesets, extract the prior JSON from the immediately preceding snapshot and PUT only writable fields (`name`, `target`, `enforcement`, `conditions`, `bypass_actors`, `rules`) to `repos/beep-effect/beep-effect/rulesets/10240248`. Preserve Knip until its coordinated gate. Restore security state with the prior `security_and_analysis` payload. Re-enable dormant workflows with `gh workflow enable data-sync.yml` or `gh workflow enable 231729043`. Desktop environment did not previously exist: reversal deletes the new tag policy and environment; the workflow remains enabled. Workflow/source rollback is a PR revert. No secret values were exported.

## Oversized remote artifacts (G follow-up)

Trusted writer run [37471280558](https://github.com/beep-effect/beep-effect/actions/runs/37471280558), Heavy / Build job 112295820531, recorded three `413 Request Entity Too Large` responses. Its three misses were `@beep/todox#build` (`4b8649007d714969`), `@beep/oip-web#build` (`1887a16dc1aaef26`) and `@beep/storybook#build` (`0ee8fd91d7c880a0`). Interleaved logs do not prove a response-to-task mapping. These are expected potentially non-cacheable remote artifacts under the documented API Gateway/Lambda payload limits; no output narrowing is justified without per-task size evidence. Local cache remains available. Future trusted-push summary uploads preserve remote-hit evidence; this receipt does not claim those large builds were uploaded successfully.
