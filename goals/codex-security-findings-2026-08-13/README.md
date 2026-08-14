# Codex Security Findings (2026-08-13)

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Capture, validate, remediate, and close every open Codex Cloud security finding
for `kriegcloud/beep-effect` in the 15-finding batch captured on 2026-08-13.
Ship the fixes through Yeet-driven PRs, close the exact captured findings, and
leave no packet-applicable finding open.

## Launch

```text
/goal follow the instructions in goals/codex-security-findings-2026-08-13/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`ops/triage.json`](./ops/triage.json)
6. [`findings/INDEX.md`](./findings/INDEX.md)
7. [`research/QUALITY_REVIEW.md`](./research/QUALITY_REVIEW.md)

## Current Phase

<!-- codex-findings-refresh:start -->
Refresh reconciliation complete: all 15 records are validated and lane-assigned;
the original 13 records retain their prior triage and proof.
<!-- codex-findings-refresh:end -->

`P4 remediate` / `P5 repo-proof` / `P6 publish` - all 15 findings are validated
and partitioned. PRs #681 (`CSF-002`), #685 (`CSF-007`), and #688 (`CSF-010`)
are merged. CSF-009 and CSF-014 passed full Yeet verify 21/21 on their exact
current bases and are pushed as open, unmerged PRs #697 and #696 under hosted
monitoring; hosted green is not yet claimed. CSF-012, CSF-013, and CSF-015 have
prepared fixes but are not merged. CSF-011 was already fixed on current HEAD. The prior
13-finding quality ledger contains 42 repaired reviewer and gate items; focused
proof for the two refreshed findings is recorded in their CSF records.
CSF-001, CSF-003, CSF-004, CSF-005, CSF-006, and CSF-008 remain confirmed and
held on runner admission/workload-identity architecture and external GitHub
organization runner-group/AWS deployment proof.

The CI-fleet P2/P3 implementation landed through #666, #673, and #674, but the
six runner-admission findings still lack publishable external organization and
deployment evidence. CSF-009 and CSF-014 are open and unmerged under hosted
monitoring. CSF-012, CSF-013, and CSF-015 remain prepared but unmerged. The
CSF-013 branch has current main merged and focused 7/7 proof; full Yeet is
running. It remains source/mock proof only, and this packet does not claim a
Pulumi deployment.

## Findings at a glance

6 High, 5 Medium, 1 Low, 3 Informational findings: 14 `remediate` and 1
`already-fixed`. Three remediation findings are merged, two are open and
unmerged under hosted monitoring, three more have prepared unmerged fixes, and
six are architecture/deployment-blocked.
Accepted risk is unavailable.

## Local proof status

The final main refresh used `origin/main` `642331b86c` and produced merge HEAD
`8337a21710`; `bun install` completed. From that refreshed tree,
`bun run beep coverage -- --write-baseline --concurrency=1` exited 0 after
Turbo 230/230 in 22m54.534s and wrote schema v2 with 127 packages.

`bun run audit:github quality` exited 0 with all 15 lanes passing: the nine
preflight lanes (`changeset`, `graph`, `tsconfig`, `fallow`, `versions`,
`syncpack`, `sherif`, `bun-audit`, and `knip`) plus `build`, `lint`, `check`,
`test`, `jsdoc-ratchet`, and `docgen`. Test proof passed unit Turbo 133/133,
integration 139/139, and serial integration 13/13. The JSDoc ratchet reported
`tracked=20`, `increased=0`, and `zero-legacy findings=0`; full docgen covered
133 packages. A remote Turbo authentication warning was nonfatal and did not
change the successful audit verdict.

On the pre-review candidate, `bun run beep yeet repair` was green: exit 0,
verdict outcome `success`, and all
9 repair lanes passed (5 prepare lanes plus build, check, lint, and test). Full
docgen passed 129/129 tasks. Affected test proof reported 90 files and 1,488
repo-cli tests, plus 11 ai-sync, 88 infra, and 45 repo-configs tests. Prepare
repaired formatting in one file. Exact-candidate proof is refreshed after each
quality-review repair round and is not inferred from this earlier run. The
latest Franklin coverage lane and post-merge baseline regeneration are also
green. The earlier Yeet result remains historical evidence rather than a
substitute for the current aggregate audit.

`bun run beep yeet verify` previously fetched `origin/main` and stopped in
preflight after 13 of 15 lanes passed. The introduced Fallow duplication was
repaired by sharing coverage-baseline read/decode error mappers; the focused
Fallow audit now reports zero findings. The local quality-review-fix loop may
stage the reviewed changeset and create local baseline/fix commits. Full Yeet
verify remains deferred pending main reconciliation and is not claimed.

The parsed changeset contains patch entries for `@beep/ai-sync` and
`@beep/infra`. `@beep/repo-cli` is intentionally omitted because it is ignored
by the repository Changesets configuration.

The CSF-014 and CSF-015 branches each carry a narrow no-release changeset.
CSF-014 passed full Yeet verify 21/21, was pushed, and is open as unmerged PR
#696 under hosted monitoring. CSF-015 focused proof is green, while its
experiment-wide lint command remains inherited red in unrelated files.

## Notes

- Raw report bodies remain untracked under `raw/`; tracked files are sanitized.
- Do not use Codex's Create PR or patch-apply controls.
- PRs #681, #685, and #688 are merged. CSF-009 PR #697 and CSF-014 PR #696 are
  open, unmerged, and under hosted monitoring. CSF-012, CSF-013, and CSF-015
  remain prepared but unmerged; the six runner findings remain held.
- Browser closure is post-merge and must match the captured Codex ID allowlist.
