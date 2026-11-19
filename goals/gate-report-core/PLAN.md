# Gate Report Core Plan

## Status

Status: `in-progress`

## Phases

Design order is the repo law: schema, then the Effect `Context.Service` contract, then
implementation. The first vertical slice is P1 through P3 (decision `first-slice`): the model, the
agent projection, and `test` plus `check` for one package printing the contract end to end.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research and homes | complete | Confirm package names and homes, the Vitest adapter's location, the agent budget and the fixtures. | Decision files record each name and home after an architecture-guardian review, the adapter's home, the `--passWithNoTests` count and exit-code rule, and the fixture list. |
| P1 Schema | complete | Create the model package and define every schema: report, unit, item, closed sets, events, totals, neutral console document, record file. | The package exists through `bun run beep create-package`; schemas round-trip; the widening-table and CTRF/SARIF mapping tests pass; the dispatch table's type is total over shape by outcome. |
| P2 Service contracts | complete | Create the gate-run library and define its `Context.Service` contracts with test layers: recorder, console, audience selection, history slot, type-checker adapter, the adapter event sink. | Contracts compile with schema-typed shapes; test layers exist, including a failing recorder and a failing or slow history layer. |
| P3 Implementation and first slice | complete | Port the pure core into the model, implement the services and both adapters, and wire `test` and `check` for `@beep/glob`. | `AC-L1` to `AC-L10` pass; green `test` for `@beep/glob` prints one line; the TS6305 fixture folds; a cache hit prints the same console. |
| P4 Every package and the queries | complete | Put `test` and `check` on the contract for every package at the package directory and the root, and add the `gate` command family's show-run and show-item queries. | Every remaining acceptance criterion in `SPEC.md` holds; `bun run beep quality package-verify` passes for each new and touched package. |
| P5 Port review | complete | Review each ported module against upstream and repo law, last, as the effected precedent did. | Attribution, style laws and invariants confirmed per module; findings fixed in place. |
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

### P1 model package built, 2026-11-19

The model package exists with 20 modules and 242 tests in 16 files; every source file has full statement, function and line coverage. Laws 1 to 7 and the model half of law 9 pass as tests, with laws 1 to 3 as properties over the report schema's arbitrary. The widening table, the CTRF and SARIF round trip and all twenty cells are tested. The pure core the plan placed in P3 (reducer, classifiers, counts, signature, folding, dispatch) landed with the schemas, because the law tests need it. Left for the adapter slice: the upstream build-report cases about stack frames, missing results and throwing getters, and the stray-output recorder tests.

Lane feat/gate-report-core

Reverse: Remove the gate-report package and its generated registrations.

### P2 service contracts and their implementations built, 2026-11-19

The record library has 24 tests and the gate-run library 48; every new source file has full statement, function and line coverage under Bun and Node. Laws 8 and 10 pass as tests, laws 5 and 6 pass through the history contract's test layers, the terminal projection equals the agent projection with escapes removed as a property, and one console service renders a test-gate and a check-gate fixture. The two-diagnostic fixture and the TS6305 cascade are produced by the real compiler on fixture packages. The existing Yeet parser tests pass unchanged.

Lane feat/gate-report-services

Reverse: Remove the two libraries and restore the diagnostic pattern in the Yeet issue parser.

### P3 and P4 built: test and check print the console contract, 2026-11-19

A green test run of `@beep/glob` prints one line of 47 characters (`test @beep/glob: PASSED, 273/273 passed`, with its duration), against 13,450 at the exploration baseline and 820 after the switch-on goal. A red test with a diff prints 14 lines and 520 characters. A package with unbuilt references prints 5 lines. Root test and root check runs, a miss then a Turbo cache hit, print identical consoles by `cmp`. Doctest and property-sweep runs leave the test record untouched. The adapter has 75 tests under Node and Bun, the record library 29, the gate-run library 50, and every new source file has full statement, function and line coverage.

Lane feat/gate-report-wiring

Reverse: Revert the wiring commits and re-record the package cache baselines.

### P5 port review complete, 2026-11-19

Every ported module was compared with its upstream file by a separate read-only review. Attribution, outcome precedence, footer dominance, failure-signature inputs, top-frame selection, the suite and hook fault rules and stray-output counting match upstream. Four defects and about a dozen notes were found and fixed in the pull requests that own the code: the model and library findings with the libraries, the adapter and CLI findings with the wiring. Service shapes stay interfaces, as elsewhere in the repository.

Lane feat/gate-report-wiring

Reverse: Reopen the port review and list the modules to re-read.

### P5 port review: model and library findings fixed, 2026-11-19

A read-only review compared every ported module with its upstream file. Attribution, outcome precedence, footer dominance, failure-signature inputs and stray-output counting came back clean. Fixed for the model and the libraries: diagnostics with no location are told apart by their message; terminal escape sequences are stripped before the budget is counted; the console is unconditional; the cap line counts only dropped items; a load failure reads the same beside other modules or alone; a failed prune of old root runs no longer reports the record unwritten. Service shapes stay interfaces, as elsewhere in the repo. The adapter findings are fixed on the wiring lane.

Lane feat/gate-report-services

Reverse: Revert the port-review commit on the libraries lane.

<!-- beep:decisions:end -->
