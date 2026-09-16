# B8 implementation brief — heavy-check admission (label gate, docs-only filter)

Orchestrator: Fable. Lanes: Fable subagents (medium reasoning), one per stage, results to
files, no git writes. Stacked on B7 (`ttc/b7-until-ready`, PR #1149); PR A is independent.

## Why (measured 2026-09-16, 04:48–05:20 UTC)

Four open PRs were `BLOCKED` on six queued `Check` runs for the `beep-ec2-heavy` pool, the
oldest waiting 40+ minutes; #1147 (markdown only) enqueued the full seven-lane matrix. The
bound is heavy-runner capacity. `heavy.yml` already skips lane bodies for `goals_only` diffs,
but only at step level: the job still queues on the pool, checks out, and classifies. Relief
needs a job-level decision made before the reusable workflow is called.

## Verified facts (live, 2026-09-16)

- `check.yml`: `pull_request` with default types (opened, synchronize, reopened); concurrency
  `${{ github.workflow }}-${{ github.ref }}` cancels in-progress PR runs; the `heavy` caller has
  no `if:` and no `with:`; `pr-size` adds `size/*` labels through `GITHUB_TOKEN` (events raised
  by that token never trigger a workflow, so a `labeled` trigger cannot loop on it).
- `heavy.yml`: `workflow_call` with no inputs (before PR A); `verify` matrix on `beep-ec2-heavy`;
  the step gate reads `scripts/ci-change-profile.sh` (`goals_only` = only `goals/**` prose:
  `GOAL|PLAN|README|SPEC|DECISIONS.md`, `ops/manifest.json`, `goals/INDEX|README.md`).
- Ruleset `main` (10240248): `strict_required_status_checks_policy: false`; required contexts
  include `Heavy / Lint Policy`, `Heavy / Check`, `Heavy / Test Integration`, `Heavy / Docgen`,
  `Heavy / Doctest`; `Heavy / Coverage Regression` and `Heavy / Build` are optional.
- GitHub docs (re-read 2026-09-16): a job skipped by a conditional "reports Success" and
  satisfies a required check; a workflow that never runs because of `paths`/`branches` filters
  leaves its checks "Pending" and blocks merging ("avoid requiring workflows that can be
  skipped"). `pull_request` default types are `opened`, `synchronize`, `reopened`; `labeled`,
  `unlabeled`, `ready_for_review` are valid types. `merge_group` supports only
  `checks_requested`; required checks must add that trigger or a queued PR never reports.
- Typos and the policy sweep run only in the heavy `Lint Policy` lane (`beep lint policy
  --full`); tier 1 `Lint` shards run the lint lane. The existing `goals_only` precedent already
  skips `Lint Policy` for packet prose, so a docs-only skip is the same policy class.
- B7 settle (`Settle.ts`): the census buckets are `matched`, `unmatched` (tolerated matrix
  parents), `pending`, `missing`; only `pending` holds settle, `skip` outcomes settle; the
  only terminal reason is `settle-timeout`; `waitedMs` is `now - firstObservedMs` per head.

## The hole in the kickoff (D2/D3 as written)

If an unadmitted code PR's matrix were skipped by `if: inputs.admitted`, GitHub would report
every `Heavy / *` context as skipped, the ruleset would be satisfied, and the PR would be
mergeable with no heavy proof. A gate that a missing label satisfies is not a gate. Admission is
therefore three-valued, and the two skip mechanisms are used for different verdicts:

| verdict          | who                             | caller `heavy` job          | `Heavy / *` contexts     | merge     |
| ---------------- | ------------------------------- | --------------------------- | ------------------------ | --------- |
| `run`            | labelled PR, main push, merge group | runs, `admitted: true`  | report real outcomes     | on green  |
| `skip-satisfied` | docs-only PR without the label  | runs, `admitted: false`     | report `skipped`         | satisfied |
| `hold`           | code PR without the label       | skipped by `if:`            | absent ("Expected")      | blocked   |

`hold` is the only state in which the required contexts are absent by design; the B7 settle
rule would call them `missing` and time out. D5 makes that state a named, non-terminal wait.

## Schemas (design order: schema → contract → implementation)

`packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts` (new, imported by both the `ci`
subcommand and `Yeet/internal/Settle.ts`; `Yeet/internal/ProofFact.ts` already imports from
`../Ci`, so the direction has precedent):

```ts
export const HEAVY_ADMISSION_LABEL = "ready-for-heavy"
export const HEAVY_CONTEXT_PREFIX = "Heavy / "

export const HeavyAdmissionSource = LiteralKit(["label", "merge-group", "main-push"])
export const HeavyAdmissionVerdict = LiteralKit(["run", "skip-satisfied", "hold"])

// Typed view of what the decision reads; built from the GitHub event in CI and from
// `gh pr view` + `git diff --name-only <merge-base>...HEAD` in the monitor.
export class HeavyAdmissionEvent extends S.Class<HeavyAdmissionEvent>(...)({
  eventName: HeavyAdmissionEventName,          // LiteralKit(["pull_request", "push", "merge_group"])
  labels: S.Array(S.String),
  draft: S.Boolean,
  changedPaths: S.Array(S.String),             // merge-base diff; empty on push/merge_group
}) {}

export class HeavyAdmission extends S.Class<HeavyAdmission>(...)({
  verdict: HeavyAdmissionVerdict,
  admitted: S.Boolean,                         // verdict === "run"
  sources: S.Array(HeavyAdmissionSource),      // why it ran; empty unless `run`
  docsOnly: S.Boolean,
  changedPathCount: S.Int,
}) {}

export const decideHeavyAdmission = (event: HeavyAdmissionEvent): HeavyAdmission
```

Decision (pure, total): `sources` = `main-push` when `push`; `merge-group` when `merge_group`;
`label` when `pull_request` and `labels` contains the label. `docsOnly` = `pull_request` with a
non-empty `changedPaths` where every path matches `heavyDocsOnlyPattern`. Verdict: `run` when
`sources` is non-empty, else `skip-satisfied` when `docsOnly`, else `hold`. `draft` is carried
for the record and never admits (ruling 51).

`heavyDocsOnlyPattern` (one RegExp, exported, with a `isHeavyDocsOnlyPath` guard): the
`goals_document_pattern` of `scripts/ci-change-profile.sh` verbatim, plus `^docs/`,
`^explorations/`, `^research/`, `^\.changeset/[^/]+\.md$`, and `\.md$` anywhere. Executables,
fixtures, JSON and scripts under `goals/**` stay code-bearing (the existing precedent).

`Yeet/internal/Settle.ts` additions:

```ts
export class YeetGatedContextFamily extends S.Class(...)({
  prefix: S.NonEmptyString,                    // "Heavy / "
  admittedBy: S.NonEmptyString,                // "ready-for-heavy"
  members: S.Array(S.NonEmptyString),          // expected contexts with that prefix, from the ruleset fold
}) {}
// YeetExpectedContextCensus gains `gated: S.Array(S.NonEmptyString)` (default []).
// YeetSettleInput gains `families: S.Array(YeetGatedContextFamily)` (default []) and
//   `admission: HeavyAdmission` as OptionFromOptionalKey (None = B7 behaviour, no gating).
// YeetSettleVerdict gains `admission` (same Option) so the renderer can name the verdict.
// YeetSettleReason (CheckOutcome.ts) gains "heavy-not-admitted".
```

`deriveSettleVerdict` amendment: when `admission` is `Some` with verdict `hold`, every
expected context that belongs to a family is moved out of `missing`/`pending` into
`gated` before the reasons are derived. Reason order: `registration` → `required-pending`
(non-gated open contexts) → `heavy-not-admitted` (only gated contexts open) → settled rules as
B7. While the verdict is `hold`, `settle-timeout` is unreachable (the comparison is skipped,
`waitedMs` is still reported). `run` and `skip-satisfied` change nothing in the rule: a
`skip-satisfied` head settles when the skipped contexts report `skip`; a `run` head behaves as
B7 (absent contexts are `missing` again). `yeetSettleStampFor("heavy-not-admitted")` is `None`.

Gate line (`renderYeetSettleDetail`), hold:
`settle: heavy-not-admitted; gated: Heavy / Lint Policy, Heavy / Check, …; admit: gh pr edit
--add-label ready-for-heavy; waited 3m (not counted toward the 30m settle timeout)`; with
non-gated work still open the line stays `required-pending` and appends `gated: …; admit: …`.
For `skip-satisfied` the settled/pending lines append `heavy: docs-only, lanes report skipped`.

`MonitorLoop.ts`: `MonitorHeadState` gains `changedPaths` (read once per head via the merge-base
diff), `admission` (recomputed each poll from the snapshot's labels: labels are the only input
that changes without a push), and `settleClockMs` (reset when the admission verdict changes, so
time held never counts). `YeetStatusRemote` gains `labels` (`gh pr view --json … labels`).
`--watch` streams `settle-changed` when the reason flips (existing event); `--until-ready` on a
held head prints the hold gate line and keeps polling; adding the label admits within one poll.
Families come from the ruleset fold: one family per distinct gated prefix found among the
expected contexts (today exactly `Heavy / `), with `admittedBy` from `HEAVY_ADMISSION_LABEL`.
Exit-code table unchanged; a held wait is never terminal.

`ci admission` subcommand (`Ci.command.ts`): reads `GITHUB_EVENT_NAME` / `GITHUB_EVENT_PATH`
(overridable by `--event-name`, `--event-path`), decodes the minimal event payload
(`pull_request.draft`, `pull_request.labels[].name`, `pull_request.base.ref`), computes
`changedPaths` with `git diff --name-only origin/<base>...HEAD` (fetching the base ref like
`heavy.yml` does, `--base` overrides), prints the `HeavyAdmission` JSON, and with
`--github-output` appends `verdict=`, `admitted=`, `docs_only=`, `sources=` to `$GITHUB_OUTPUT`.
Exit 0 for every verdict; non-zero only for unreadable inputs.

## Workflow contract (Stage C, PR B; requires PR A on `main`)

```yaml
on:
  pull_request:
    branches: [main]
    # default types; the label is handled by heavy-admit.yml (on: labeled)
jobs:
  admission:
    name: Heavy Admission
    runs-on: ubuntu-24.04
    outputs: { verdict: …, admitted: … }
    steps: checkout (fetch-depth 0, blob:none) → fetch base → setup-monorepo-ci →
           bun run beep ci admission --github-output
  heavy:
    needs: [admission]
    if: ${{ needs.admission.outputs.verdict != 'hold' }}
    uses: beep-effect/beep-effect/.github/workflows/heavy.yml@main
    secrets: inherit
    with:
      admitted: ${{ needs.admission.outputs.verdict == 'run' }}
```

Label path (review round 1, replaces the earlier `labeled` type on `check.yml`):
`heavy-admit.yml` triggers on `pull_request: types: [labeled]` with its own concurrency group
(no cancel-in-progress), runs the same admission job gated on
`github.event.label.name == 'ready-for-heavy'` and the heavy caller, so applying the label
starts only admission + heavy and tier 1 is neither cancelled nor re-run; `check.yml`'s
admission job cancels a superseded head's `Heavy Admit` matrix on the next push. `size/*`
labels do not trigger anything (they come from `GITHUB_TOKEN`). The admission job adds about
one hosted minute before the heavy call.
`unlabeled` is not a trigger: check runs are per commit, so removing the label cannot
un-report an outcome; the operator cancels a heavy run from the Actions UI if needed.

## Stages

- **Stage A** (this worktree, stacked on B7): `HeavyAdmission.ts`, the `ci admission`
  subcommand, `heavy-not-admitted`, the settle amendment, `labels` on the remote status,
  loop wiring, tests. Fixtures: (1) expected contexts include `Heavy / *`, no `Heavy / *`
  reported, admission `hold`, `waitedMs > timeoutMs` → reason `heavy-not-admitted`, not
  settled, not terminal; (2) same census, admission `run` → `missing` and, past the budget,
  `settle-timeout`; (3) admission `skip-satisfied`, `Heavy / *` report `skip` → settled;
  (4) decision table for every (event, label, draft, docsOnly) row; (5) docs-only pattern
  rows including `goals/x/scripts/run.sh` (not docs) and `packages/a/README.md` (docs);
  (6) monitor loop: held head never reaches `settle-timeout`, label lands → `settle-changed`
  → settle → closeout → ready.
- **Stage B** (PR A, done by the orchestrator, branch `ttc/b8-heavy-admitted-input`): the
  `admitted` input and the job-level `if:`; changeset. Proven only after merge (main push).
- **Stage C** (PR B): `check.yml` types, the admission job, the `heavy` wiring; docs (yeet
  skill Settle rule + Merge Loop, AGENTS.md PR closeout, `docs/runbooks/ci-runner-reliability.md`
  capacity note per D7); PLAN rows; changeset. Create the `ready-for-heavy` label at publish.
- **PR C** (after PR B merges): the B9 merge-queue capture in `explorations/` (docs-only by
  construction) doubles as the acceptance probe: heavy lanes report `skipped`, the ruleset is
  satisfied, `--until-ready` exits 0, no heavy run for that head. If the skipped matrix
  legs do not carry the `Heavy / <lane>` names, plan B is a `runs-on` switch in `heavy.yml`
  (`inputs.admitted && 'beep-ec2-heavy' || 'ubuntu-24.04'`) with the step gate honouring
  `!inputs.admitted`, which preserves the names and still spends no heavy runner.

## Verification (the orchestrator runs what sandboxes cannot)

`bun run beep lint circular`, `bun run beep lint schema-first`, `bunx turbo run check
--filter=@beep/repo-cli`, `bun run beep quality test-tsgo`, touched vitest suites on Bun and
Node, scoped lcov (100 on new files), `bun run beep lint effect-vitest --write`, `bun run beep
quality package-verify @beep/repo-cli`, Fallow clean.

## Rejected

- Admitting on `draft == false`: nearly every PR here is non-draft, so it is the status quo.
- A `ready_for_review` one-shot source: it cannot be observed from `gh pr view`, so the
  monitor's view would diverge from CI's; the label is sticky and visible to both.
- Gating the caller `heavy` job for docs-only PRs: no `Heavy / *` check runs, blocked forever.
- Skipping the matrix for held PRs: mergeable without proof (the hole above).
- A global `concurrency` group across PRs: one pending slot, newer cancels older, no FIFO.
- Workflow-level `paths:` filters: never report, block required checks.
- A comment command (`/heavy`): needs a bot and write permissions.
- Auto-labelling from `yeet publish`: reverts to the status quo; the label is a deliberate verb
  the agent applies once tier 1 is green (`--until-ready` prints the command).
