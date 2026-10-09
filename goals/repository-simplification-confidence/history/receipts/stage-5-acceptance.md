# Workstream A acceptance evidence

This is a partial lane receipt, recorded 2026-10-09 with wave 1 published as draft PR #1584 at `b403cd2b9b` and D/E integration merged locally at `2f4979d2e7`; later-wave groundwork remains outside publication. It does not claim program completion or hosted acceptance.

## Removals

Wave 1: 40 Knip rows fixed and one Govinfo drift oracle documented at `8f29e3528e`; the final patched Knip 6.40.0 cross-check reports only that oracle. The local implementation, dependency/catalog/patch, config, scripts, Turbo task, baseline and CLI wiring are removed. Source-complete draft PR #1584 passes cheap gates and the clean-head install preflight. D #1566 and E #1568 are integrated locally; independent reviews find zero source collisions. E deliberately retains the Knip workflow for the separate S3 window, and the orchestrator owns required-context removal. Post-E owner/package/parity/coverage proof is active; queued or cancelled rows are not passes. Other retirement waves remain open.

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

All eleven touched packages passed full run-5 package verification before E's main merge: box-provisioning, box, freshbooks, occt, pdf-tools, wink, colors, data, repo-ai-metrics, codegen-kit and repo-cli. The refreshed post-D CLI audit passed in 785 seconds with docgen in 28 seconds; test TSGo and full docgen also passed. E changes CLI source, so those CLI/parity passes are now historical. Ten unchanged package gates remain valid. Post-E CLI/package/parity/coverage results remain pending until terminal command output exists.

## Scope

All writes are inside the assigned lane. No foreign worktree, clone-local residue, home configuration, hosted ruleset or other lane's owned files were changed. Local residue is deferred until post-merge, with orchestrator routing required for paths outside this lane.
