# Gate Report Core Plan

## Status

Status: `pending`

## Phases

Design order is the repo law: schema, then the Effect `Context.Service` contract, then
implementation. The first vertical slice is P1 through P3 (decision `first-slice`): the model, the
agent projection, and `test` plus `check` for one package printing the contract end to end.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research and homes | pending | Confirm package names and homes, the Vitest adapter's location, the agent budget and the fixtures. | Decision files record each name and home after an architecture-guardian review, the adapter's home, the `--passWithNoTests` count and exit-code rule, and the fixture list. |
| P1 Schema | pending | Create the model package and define every schema: report, unit, item, closed sets, events, totals, neutral console document, record file. | The package exists through `bun run beep create-package`; schemas round-trip; the widening-table and CTRF/SARIF mapping tests pass; the dispatch table's type is total over shape by outcome. |
| P2 Service contracts | pending | Create the gate-run library and define its `Context.Service` contracts with test layers: recorder, console, audience selection, history slot, type-checker adapter, the adapter event sink. | Contracts compile with schema-typed shapes; test layers exist, including a failing recorder and a failing or slow history layer. |
| P3 Implementation and first slice | pending | Port the pure core into the model, implement the services and both adapters, and wire `test` and `check` for `@beep/glob`. | `AC-L1` to `AC-L10` pass; green `test` for `@beep/glob` prints one line; the TS6305 fixture folds; a cache hit prints the same console. |
| P4 Every package and the queries | pending | Put `test` and `check` on the contract for every package at the package directory and the root, and add the `gate` command family's show-run and show-item queries. | Every remaining acceptance criterion in `SPEC.md` holds; `bun run beep quality package-verify` passes for each new and touched package. |
| P5 Port review | pending | Review each ported module against upstream and repo law, last, as the effected precedent did. | Attribution, style laws and invariants confirmed per module; findings fixed in place. |
| P6 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P7 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Phase Detail

### P0 Research and homes

1. Ask the architecture guardian to review the three homes in `SPEC.md` "Target Surfaces":
   `@beep/gate-report` in `foundation/modeling`, `@beep/repo-gate-run` in `tooling/library`, the
   Vitest adapter in `tooling/test-kit`. Record each confirmed name and home.
2. Decide the adapter's home: a module of `@beep/test-runner` or a sibling test kit. Read
   `packages/tooling/test-kit/test-runner` and `vitest.shared.ts` first.
3. Count packages whose `beep:test` collects nothing under `--passWithNoTests`, and record whether
   the task exit code follows the report's `ERRORED`.
4. Re-read the harness limits in
   `explorations/agent-verification-output/research/external-landscape.md` section 5 and confirm
   the 8,000-character budget, or record a changed number with its reason.
5. List the fixtures, each generated from the repository: a green `@beep/glob` test run, a red test
   run with a diff, a timeout, a load failure, an empty run, a check run with two diagnostics, and
   the TS6305 cascade from a fresh lane.
6. If `goals/agent-output-census` has landed, record the census rows this goal moves.

### P1 Schema

Copy the upstream schemas named in the `SPEC.md` port inventory with their tests, then widen them
along the eleven seams. Clear every diagnostic with the copied tests green, then convert imports
and identities. Model-owned document blocks replace upstream's `@effected/cli-kit` `Doc` use,
because `foundation/modeling` cannot import `@beep/cli-kit`.

### P2 Service contracts

Contracts only, each with a test layer. The history slot is a contract this goal defines and
`goals/gate-run-history` implements: labels and a delta for a report, under a read deadline. The
recorder contract states the record and log paths and the replay rule for a restored record.

### P3 Implementation and first slice

In porting order, per module: the reducer, the shape and outcome classifiers, the honest-count
rules, the failure signature, the cause-folding table (TS6305 first), the dispatch cells and the
pointer table. Then the recorder, the console service (agent and terminal), audience selection,
the type-checker adapter built on the pattern moved out of `IssueParser.ts`, and the Vitest
adapter registered in `vitest.shared.ts`. Then the Turbo outputs and the task-path rendering for
`@beep/glob`. This phase lands as the first slice PR.

### P4 Every package and the queries

Extend the task-path rendering to every package and to root runs, keep the newest 20 root records
per gate, and add the show-run and show-item queries of the planned `gate` command family.

### P5 Port review

One review per ported module against its upstream file, covering attribution, the style
conversions in `SPEC.md` and the invariants read from upstream. Reviews come last, as in
`goals/effected-promotion`.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status gate-report-core completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug gate-report-core` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add gate-report-core --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/gate-report-core/GOAL.md)" -le 4000
jq . goals/gate-report-core/ops/manifest.json
rg -n "gate-report-core|GOAL.md|agentLaunchers|packetAnchorDocument" goals/gate-report-core
git diff --check -- goals/gate-report-core
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug gate-report-core`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
