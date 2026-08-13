# Codex Security Findings (2026-08-13) Plan

## Status

Status: `active`. Validation and lane partitioning are complete. Six bounded
remediations are locally complete, one
finding was already fixed, and six CI trust-boundary findings remain blocked on
architecture and external deployment proof.

## Phases

| Phase              | Status      | Goal                                                    | Exit criteria                                                                                                                                                  |
| ------------------ | ----------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 bootstrap       | complete    | Create feature branch and packet scaffold.              | Branch and launcher exist; packet JSON parses.                                                                                                                 |
| P1 capture         | complete    | Capture all live findings via the signed-in CSV export. | 13 IDs reconcile: 6 High, 4 Medium, 1 Low, 2 Informational.                                                                                                    |
| P2 validate        | complete    | Reproduce each report at current HEAD.                  | All 13 items have a strict verdict, disposition, rationale, and owner surface.                                                                                 |
| P3 lane-partition  | complete    | Group shared root causes and disjoint paths.            | Nine lanes record the shared CI roots and disjoint bounded fixes.                                                                                              |
| P4 remediate       | in-progress | Fix all real findings with focused checks.              | Six bounded fixes are locally complete; six CI findings await runner admission/workload-identity architecture and external evidence.                          |
| P5 repo-proof      | in-progress | Run packet validation and Yeet repair/verify.           | All 42 items are fixed/pending commit; refreshed baseline and aggregate proof are green, and two final compatibility reviewers returned zero suggestions.        |
| P6 publish         | in-progress | Publish one intentional PR through Yeet.                | Execute only the ordered CSF-002, CSF-007, CSF-010 publication scope; exact branch head pushed and PR opened.                                                   |
| P7 monitor         | pending     | Close hosted checks and actionable reviews.             | PR green and mergeable.                                                                                                                                        |
| P8 merge-and-close | pending     | Merge and close captured findings.                      | PR merged; all 13 IDs resolved.                                                                                                                                |
| P9 close           | pending     | Record evidence, reflection, and lifecycle.             | Packet set to `completed-retained` in the same closeout PR state.                                                                                              |

## Execution Rules

- Validate before repairing; classify failures as introduced, inherited,
  unrelated, or environment-only.
- Prefer one shared root-cause fix when multiple reports traverse the same code.
- Keep global files and ledgers serialized.
- Use focused tests first, then package checks, then Yeet.
- Never stage ignored raw evidence.
- Publication is executing only in the ordered `CSF-002` then `CSF-007` then
  `CSF-010` sequence; every other finding remains held without new user
  authorization.

## Active Architecture Stop

CSF-001, CSF-003, CSF-004, CSF-005, CSF-006, and CSF-008 are confirmed and
remain dispositioned `remediate`; they are not accepted risk or deferred
closure. Complete repair requires a trust boundary outside pull-request-editable
workflow content and removal of usable cloud identity during runner jobs. Those
P2/P3 have landed, but P4 remains in progress until organization-owned controls
and external GitHub runner-group/AWS deployment proof verify the resulting
boundary.

## P5 Preflight Evidence

- Round 1 reviewed baseline commit
  `f2322856de0d2b51d0e0c73ca1a76671b9a93f3c`. The ten canonical roles,
  adversarial critic, dedupe decisions, 21 accepted findings, and fixer routing
  are recorded in `research/QUALITY_REVIEW.md`.
- The ledger records 42 reviewer and gate items, all fixed with
  `fixedCommit: pending`. Post-merge baseline regeneration and aggregate
  quality proof are green. Two final compatibility reviewers each returned
  literal `0 changes suggested`; the user ended further review rounds and
  directed narrow publication.
- Final refresh: `origin/main` `642331b86c`, merge HEAD `8337a21710`, and
  completed `bun install`.
- `bun run beep coverage -- --write-baseline --concurrency=1` exited 0 after
  Turbo 230/230 in 22m54.534s and wrote schema v2 with 127 packages.
- `bun run audit:github quality` exited 0 with all 15 lanes passing: nine
  preflight lanes (`changeset`, `graph`, `tsconfig`, `fallow`, `versions`,
  `syncpack`, `sherif`, `bun-audit`, and `knip`) plus `build`, `lint`, `check`,
  `test`, `jsdoc-ratchet`, and `docgen`.
- Test proof passed unit Turbo 133/133, integration 139/139, and serial
  integration 13/13. The JSDoc ratchet reported `tracked=20`, `increased=0`,
  and `zero-legacy findings=0`; full docgen covered 133 packages.
- The remote Turbo authentication warning was nonfatal; the aggregate audit
  still exited successfully.

- On the pre-review candidate, `bun run beep yeet repair` exited 0 with verdict
  outcome `success`: all 9
  lanes passed (5 prepare lanes plus build, check, lint, and test). Prepare
  repaired one formatting file.
- Full docgen passed 129/129 tasks. Affected test proof reported 90 files and
  1,488 repo-cli tests, plus 11 ai-sync, 88 infra, and 45 repo-configs tests.
- `bun run beep yeet verify` fetched `origin/main`, then stopped in preflight
  with 13 of 15 lanes passing. This is an attempted partial proof, not a green
  Yeet verification.
- The introduced Fallow duplication was fixed with shared coverage-baseline
  read/decode error mappers. `bun run beep quality fallow audit --check --quiet`
  now reports zero findings.
- `.changeset/codex-security-findings-2026-08-13.md` parses as two patch
  releases: `@beep/ai-sync` and `@beep/infra`; ignored `@beep/repo-cli` is
  intentionally omitted.
- Yeet verify remains deferred pending main reconciliation. The local
  quality-review-fix loop may stage the reviewed changeset and create local
  baseline/fix commits, but it may not push or open a PR.
- Exact-candidate proof is refreshed after each quality-review repair round;
  the earlier Yeet result is not treated as proof for later edits.

## Packet Verification

```sh
test "$(wc -m < goals/codex-security-findings-2026-08-13/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-08-13/ops/manifest.json
jq . goals/codex-security-findings-2026-08-13/ops/triage.json
bun -e 'import { decodeCodexTriageLedger } from "./packages/tooling/tool/cli/src/commands/Codex/Findings.triage.schemas.ts"; import { Effect } from "effect"; const input = await Bun.file("goals/codex-security-findings-2026-08-13/ops/triage.json").json(); await Effect.runPromise(decodeCodexTriageLedger(input))'
test "$(find goals/codex-security-findings-2026-08-13/findings -maxdepth 1 -name 'CSF-*.md' | wc -l | tr -d ' ')" = 13
bun run beep goals index --check
bun run beep goals doctor
bun run beep yeet repair
bun -e 'import parse from "@changesets/parse"; const parsed = parse(await Bun.file(".changeset/codex-security-findings-2026-08-13.md").text()); const actual = parsed.releases.map(({ name, type }) => `${name}:${type}`).sort(); const expected = ["@beep/ai-sync:patch", "@beep/infra:patch"]; if (JSON.stringify(actual) !== JSON.stringify(expected)) process.exit(1)'
bun -e 'import { scanSensitiveText } from "./packages/tooling/tool/cli/src/commands/Codex/Findings.scan.ts"; const root = "goals/codex-security-findings-2026-08-13"; const glob = new Bun.Glob("**/*"); const hits = []; for await (const path of glob.scan({ cwd: root, onlyFiles: true })) { if (path.startsWith("raw/")) continue; hits.push(...scanSensitiveText(path, await Bun.file(`${root}/${path}`).text())); } if (hits.length > 0) process.exit(1)'
git diff --check -- goals/codex-security-findings-2026-08-13 goals/INDEX.md
```
