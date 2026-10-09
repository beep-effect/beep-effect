# Stage 5 acceptance evidence — partial A and V contributions

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
## V canon evidence

This records V's local evidence only. It does not close the program or qualify
publication, hosted readiness, other lanes, or the repaired non-CLI preview.
The orchestrator owns the aggregate acceptance record.

### V package gates

| Lane | Package | Qualified source / artifact | Full package result | Evidence |
| --- | --- | --- | --- | --- |
| V | `@beep/repo-cli` | `4be0599a181c86fdf282da880dacf49bb20fb1bf` | PASS 781.746 s (audit 750.5 s, docgen 29.6 s) | `rsc-v-local-proof-results.json`, V handoff |
| V, prepared R105 patch | `@beep/rdf` | Original patch `b0f087e9b4addbd08cebc4c8cb4750e879a6367d8f344c6a55b278f5f77a4a92` | PASS 12.064 s | Prepared-patch evidence only; repair preview needs its own proof |
| V, prepared R105 patch | `@beep/pacer` | Same original patch | PASS 10.024 s | Prepared-patch evidence only; no second PR exists |

### V scope

V changes 78 files relative to merged main, including this partial receipt.
Only repo-cli package source/tests are edited; RDF/Pacer are preserved patches,
not package edits in the integration branch. The D13 roughly 150-file cap and
CLI-only first PR boundary remain intact. Thirty-five reviewed files match
terminal-zero source `a0b0df4147`. Main's changeset-remedy assertion and V's
new canonical plan property have separate terminal-zero Run 4 review. The
earlier 757.718-second package result belongs only to the table's recorded
`5a79cbc49a` source, including incoming Accounts code. The new full package
collector at `4be0599a18` completed with all nine source/parity stages green.
The later main merge `7ef36e8020` imports only seven exploration documents;
all package/root gate inputs and 37 source digests remain unchanged. No source worktree or branch was retired.

Final inventory: 1,853 / 716 open / 1,137 exceptions. Historical IDs remain
immutable; the dated linkage record describes re-anchors and candidate churn.
PR #1575 is published and ready; direct capped publication passed cheap gates
and frozen-install preflight. The private repo-cli release note was archived
after D policy landed. Knowledge refs passes with zero live gated observations
after the main SPEC wording repair. Hosted readiness, R105 follow-up, R102 remediation and completed-retained
gates remain open. The integration local package proof is complete.
