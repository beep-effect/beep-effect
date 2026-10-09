# Workstream A acceptance evidence

This is a partial lane receipt, recorded 2026-10-09 after integrating main `36027982f2`, with wave-1 implementation committed locally and later-wave groundwork still outside that commit. It does not claim program completion or hosted acceptance.

## Removals

Wave 1: 40 Knip rows fixed and one Govinfo drift oracle documented at `8f29e3528e`; the final patched Knip 6.40.0 cross-check reports only that oracle. The local Knip implementation, dependency/catalog/patch, config, scripts, Turbo task, baseline and CLI wiring are removed. Earlier owner regenerations pass. Main added repo-cli source/tests while the retirement audit ran; that audit was cancelled as unproven. Integrated-tree owner regeneration and final package/parity/coverage remain required. Resume ruling 4 clears S5 for the generated bin-map ordering hunk. Run 5 merges current main, regenerates the JSDoc inventory, schema catalog and policy fingerprint successfully, and passes the ten non-CLI package gates. The final CLI/parity/coverage sequence is active; no pending result is treated as a pass. Separate GPT-6.1-Sol medium source/scope review returns zero actionable findings, including the corrected gate-order snapshot diagnostic. E owns the workflow job removal; the orchestrator owns the required ruleset context. Neither is claimed removed here. Other retirement waves remain open.

## Retained tools

Pending. `docs/runbooks/retained-repository-tools.md` records purpose, owner, consumers, invocation, checks and reconsideration conditions. Workflow execution evidence remains required.

## Retained patches

Pending. C owns the ONNX test move (R23), H1 owns its exact-version hold, and A owns the five fail-unpatched/pass-patched proofs. Four companion patch records now name the behavior, test requirements, available upstream evidence and exit conditions. The Effect reference at `66257d29224e949f7b300ff33416098519c7e86a` still lacks the filesystem offset and error-location fixes. Focused tests and unpatched/patched outcomes are not yet proved. XState runbook versions, discovery globs and the obsolete alpha.5 patch description are corrected against the root catalog and installed alpha.6 module.

## Harness ledger

Later-wave unstaged groundwork adds `harness-ledger/rows/` to `.rgignore`, `.aiignore` and `.graftignore`, leaving the compact README and supported CLI accessible. No `.gitignore` change is made. The graft meaning-tier ignore prevents row content from entering summaries; its structural graph still indexes paths per that file's contract.

Before-change row hashes:

- `rows/2026-09.jsonl`: `eaf44471696789fbd5417ddaef2c967fc15e5960703d75c9ead744b2ed326bbc`.
- `rows/2026-10.jsonl`: `71a6312c53ca13d3823626df570d1601c79efd395044772844b7d88dd021b95c`.

Verification: the same hashes remain after the ignore edits; `git ls-files harness-ledger/rows` retains both JSONL files and `.gitkeep`; default ripgrep does not enumerate row paths, while explicit `--no-ignore` enumeration does. Neither rows nor their decision chains were changed. Hosted acceptance remains pending.

## Package gates

All eleven transfer packages passed default `beep-heavy bun run beep quality package-verify`: box-provisioning, box, freshbooks, occt, pdf-tools, wink, colors, data, repo-ai-metrics, codegen-kit and repo-cli. Repo AI metrics passed after the introduced import-order repair. Knip retirement changes repo-cli again. Its first default audit exposed five introduced expectations, now repaired with a 182-test focused pass; the later full audit was cancelled after main changed source. No final retirement-head pass is claimed. FreshBooks generated references pass quick lint/check after its prior default pass.

## Scope

All writes are inside the assigned lane. No foreign worktree, clone-local residue, home configuration, hosted ruleset or other lane's owned files were changed. Local residue is deferred until post-merge, with orchestrator routing required for paths outside this lane.
