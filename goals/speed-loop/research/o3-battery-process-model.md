# Opportunities 3 + 8: battery process model and `yeet ship` porcelain

Date: 2026-08-04  
Scope: read-only source research plus the explicitly permitted startup timing
probes. No build, install, network, or quality lane was run.

## Executive recommendation

1. **Ship the porcelain first, as a stacked follow-up to the locked
   `PublishScope` fix.** `beep yeet ship` should be a state resolver over the
   existing publish/proof/push/PR primitives, not another flag matrix. It is a
   medium change with high operator value and a clean state-machine test
   surface.
2. **Ship the single-process battery separately.** Preserve every current
   process boundary for actual tools, but replace recursive repo-CLI launches
   with serializable, typed in-process action ids. The current feature-branch
   pre-push path evaluates the repo CLI **41 times total** (the collector plus
   40 recursive evaluations), before counting the user's initial `yeet`
   process. The measured full-CLI evaluation floor is about **1.95 s**, making
   this about **78 s of aggregate avoidable evaluation**. Because the 20 lint
   subcommands run with concurrency three and some startup is hidden under long
   external work, budget **30–50 s wall-clock saving** per full pre-push, not
   the full 78 s.

Keep the PRs separate. The porcelain changes Git/publish decisions; the
single-process runner changes failure, output, environment, and lifecycle
semantics. Combining them would make a regression hard to attribute.

---

## A. Battery single-process runner

### A1. Measured startup floor

The root script `beep` executes `packages/tooling/tool/cli/src/bin.ts`
(`package.json:369`). Except for the special clean `lint --fix` fast path,
`bin.ts` dynamically imports the full CLI (`packages/tooling/tool/cli/src/bin.ts:17-47`).
`--help` bypasses the quality and CI fast paths and reaches the full root command
tree (`packages/tooling/tool/cli/src/bin-main.ts:24-31`,
`packages/tooling/tool/cli/src/bin-main.ts:96-99`,
`packages/tooling/tool/cli/src/bin-main.ts:229-235`), so it is a suitable
full-module-evaluation probe.

Serial samples, measured with `/usr/bin/time -f '%e'` and stdout discarded:

| Probe | sample 1 | sample 2 | sample 3 | mean |
|---|---:|---:|---:|---:|
| `bun run beep --help` | 1.98 s | 1.93 s | 1.95 s | **1.953 s** |
| `bun -e 'void 0'` | 0.00 s | 0.00 s | 0.00 s | **<0.01 s** at timer resolution |

Interpretation: nearly all of the observed floor is repo-CLI/module/layer/command
tree work, not Bun process startup. This deliberately does not claim every
fast-path invocation costs exactly 1.95 s; root `check`/`lint`/`test` use a
narrower quality fast path (`packages/tooling/tool/cli/src/bin-main.ts:190-202`).
The requested help probe nevertheless gives the right order of magnitude for
the many `laws`, `lint`, `goals`, `quality`, and `fallow` invocations that load
the full command surface.

### A2. Full pre-push spawn count

The Yeet full proof is one `bun run beep quality github-checks pre-push`
`RepoPlanStep` (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:353-357`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:170-195`). The
collector runs its top-level lanes serially (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:897-925`).

On a feature branch, `runPrePushChecks` composes:

- 7 repo-quality lanes (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:207-234`)
- 2 Fallow lanes (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:343-354`)
- 7 repo-sanity lanes (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:252-288`)
- 1 dynamic changeset-status lane (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:530-558`)
- 4 external pre-push wrappers (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:306-319`)

That is **21 top-level lanes**. The exact repo-CLI evaluation count is higher:

| Source | recursive CLI evaluations | derivation |
|---|---:|---|
| root `build` | 1 | root quality CLI; Turbo is its leaf (`package.json:371`) |
| root `check` | 3 | root quality CLI + `quality test-tsgo` + `quality tsgo-smoke` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1259-1269`) |
| `quality knip` | 1 | `repoCliLane` |
| `ci lane jsdoc-ratchet` | 1 | `repoCliLane` |
| root `lint` | **21** | root quality CLI + 20 repo-CLI policy steps; the policy has 25 steps total, five of which are `bunx` tools (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1292-1320`) |
| root `docgen:local` | 1 | root script calls `bun run beep docgen local` (`package.json:386-389`) |
| root `test` | 1 | root quality CLI; Turbo is its leaf |
| 2 Fallow lanes | 2 | two `repoCliLane` wrappers |
| 7 repo-sanity lanes | 5 | changeset-graph, tsconfig-sync, boundaries config, version-sync, bun-audit; syncpack and sherif are direct `bunx` |
| changeset status | 0 | direct Changesets script |
| secrets/security/SAST/Nix | 4 | four `repoCliLane` wrappers |
| **recursive total** | **40** | excludes the already-running collector |

Therefore:

- `quality github-checks pre-push` process: 1 CLI evaluation
- recursive lane/wrapper processes: 40 CLI evaluations
- **full pre-push collector total: 41 CLI evaluations**
- invoking it through `bun run beep yeet verify`: **42**, counting the user's
  initial Yeet CLI process

The count is about CLI module evaluations, not every OS process. Turbo, Git,
Docker, Bun tools, Nix, `gh`, and the individual compiler/test processes add
many more child processes but are not removable by in-process repo dispatch.

At 1.953 s per full evaluation, 40 removable recursive evaluations imply a
78.1 s aggregate ceiling. Lint's policy group uses concurrency three
(`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:102-111`,
`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1404-1414`), so its 20
nested evaluations contribute roughly seven startup waves rather than 20
serial waves. Other top-level lanes are serial. Allowing for narrower fast
paths and overlap with slow tools yields the recommended **30–50 s expected
wall saving**. Instrument the before/after result rather than treating that
estimate as an acceptance number.

### A3. What can dispatch in-process

There are three useful categories; calling every wrapper “pure” would hide the
remaining process cost.

#### 1. Repo-native handlers: direct Effect/function call, no second CLI

These are the highest-confidence first slice:

- the seven law checks: effect-imports, terse-effect, effect-fn,
  frozen-grant-set, native-runtime, dual-arity, allowlist
- identity-registry, package-test-imports, package-test-typecheck,
  reflection-artifacts, roadmap-refs, schema-first
- goals doctor and goals index check
- JSDoc module-tag and JSDoc-ratchet orchestration
- changeset-graph, tsconfig-sync, Fallow boundaries-config, version-sync

The important property is that their use-case Effects already live under the
same command modules imported by the root tree; the root command registers
all these families (`packages/tooling/tool/cli/src/commands/Root.ts:51-81`).
Dispatch should call those use-case functions, not recursively run the Effect
CLI parser.

#### 2. Repo-CLI orchestrators: dispatch in-process, retain external leaves

These still save one CLI evaluation but must continue spawning their real tool:

- root build/check/lint/test -> Turbo/compiler/test processes
- knip -> Knip
- deprecated-apis/circular -> their analysis tools
- docgen local/check -> Turbo/docgen workers
- Fallow audit/dead-code -> Fallow binary
- bun-audit -> `bun audit`
- secrets -> Git + gitleaks
- security and SAST -> Docker
- Nix -> Nix
- tsgo tests/smoke/rules -> compiler processes

The security leaves are explicit today: gitleaks
(`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:790-815`),
Docker OSV (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:817-832`),
Docker Semgrep (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:902-934`),
and two Nix commands (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:937-960`).

#### 3. True external plan steps: keep as subprocesses

Keep direct process execution for Turbo, `bunx` tools (syncpack, sherif,
ESLint, cspell, markdownlint, typos, oxlint, Knip), Docker, gitleaks, Nix, Git,
`gh`, Changesets, Bun audit, compilers, and test runners. `GithubChecks.ts`
already distinguishes `bunRunLane`, `bunxLane`, and `repoCliLane`
(`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:22-93`);
that is the natural conversion seam.

### A4. Proposed process model

Do **not** put an `Effect` or callback into a schema model. Both
`QualityTaskStep` and `RepoPlanStep` are serializable subprocess descriptions
today (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:188-225`,
`packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:273-316`).
A function field would destroy plan JSON, equality, artifacts, and replay.

Use a schema-first tagged target instead:

```text
StepTarget (discriminator: kind)
├─ external { command, args }
└─ repo-cli { action, args }

RepoCliAction = LiteralKit([...stable action ids...])
```

`repo-cli` retains rendered `commandText` (for example
`bun run beep laws dual-arity --check`) for logs and issue routing, while a
registry maps the stable action id to a typed use-case Effect. Prefer
`LiteralKit(...).mapMembers(...).toTaggedUnion("kind")` and its derived matcher;
do not add an optional callback or boolean `inProcess` bag.

Execution flow:

1. `GithubChecks` and `rootRepoLintPolicySteps` construct `repo-cli` targets
   instead of `bun run beep ...` targets.
2. The step executor matches `external` vs `repo-cli`.
3. `external` uses the current child-process path unchanged.
4. `repo-cli` resolves the action id, runs the Effect under a scoped per-action
   service layer, and adapts success/failure into the existing
   `{ exitCode, output, truncated }` result contract.
5. The Yeet full-proof `RepoPlanStep` becomes a `repo-cli` target for
   `quality.github-checks`; its nested Quality plan then uses the same target
   model. This leaves one process for the entire repo orchestration while
   retaining subprocesses for real tools.

The current executor always calls `runCaptured` and turns nonzero exit into a
result (`packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts:23-42`,
`packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts:141-163`).
The in-process adapter must preserve that contract byte-for-byte at the
boundary.

### A5. What breaks, and the required guardrails

| Concern | Current subprocess guarantee | In-process requirement |
|---|---|---|
| Environment | each child extends the parent with step-local overrides (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:651-666`) | never mutate `process.env`; provide a per-action `ConfigProvider`/environment service. Keep a command external until it stops reading ambient env directly. |
| cwd | each step has an independent cwd | first PR supports only `cwd === repoRoot`; do not `process.chdir()` around concurrent actions. Root quality use cases currently derive from `process.cwd()` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1357-1364`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1672-1685`), so add an explicit repo-root parameter/context before widening scope. |
| Exit contract | a nonzero code is data; spawn failure is typed | map expected command errors to their declared exit code, defects to exit 1 plus rendered cause, and never call a CLI reporting wrapper that invokes process exit. |
| Output | subprocess stdout/stderr can be inherited, teed, merged, bounded, and persisted | add a scoped output sink/Console layer that tees and bounds action output. Preserve the 512 KiB/bounded result and raw-output artifact behavior rather than relying on global stdout interception. |
| Concurrency | process globals and module state are isolated | run repo-native actions sequentially in the first PR, or prove their layers are local/fresh before restoring lint concurrency. External leaves retain current concurrency. |
| Resource lifetime | OS process exit finalizes everything | `Effect.scoped` per action; use `Layer.fresh` for services with mutable caches. Sharing a read-only TS project may be a later measured optimization, not part of the first conversion. |
| Plan/replay | command + argv are JSON data | stable action ids remain schema data; the registry is runtime-only and exhaustive. Unknown ids fail before execution. |
| Issue routing | command text is parsed by existing failure classifiers | render the historical command text from the action schema even though no child process executes it. |

### A6. Size and staged implementation

Recommended first implementation: **medium-large, 600–900 changed LOC, 8–12
files, 4–7 engineering days** including focused tests.

- 120–180 LOC: `StepTarget`/`RepoCliAction` schemas and constructors
- 150–250 LOC: exhaustive dispatcher and typed error/exit adapter
- 100–180 LOC: scoped output capture/tee adapter
- 80–140 LOC: migrate GithubChecks + lint policy plans
- 200–300 LOC: plan, output, error, cwd/env, and parity tests

Avoid converting every command in the first PR. Convert the 20 lint repo-CLI
substeps plus the pre-push wrappers, leave unknown/unsafe actions external, and
assert that both forms render identical historical command lines. Acceptance:

- identical lane order, labels, exit status, failure summary, and issue routing
- identical external leaf argv/env/cwd
- plan JSON remains decodable
- no `process.chdir()` or `process.env` mutation
- measured warm pre-push reduction, with `RepoStepRunResult` timing rather than
  only an end-to-end anecdote

### A7. PR placement

Make this a **dedicated performance PR after the RepoRun timing-instrumentation
PR**, because the proposed acceptance gate needs per-step elapsed time and the
current `RepoStepRunResult` has no timing fields (`packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:341-366`).
Suggested ownership: `packages/tooling/tool/cli/src/internal/{process,repo-run}`
plus `commands/Quality`. Do not put it in the `PublishScope`/ship PR.

---

## B. `beep yeet ship` porcelain

### B1. Problem statement

The 2026-08-04 closeout records four publish attempts and the precise contract
contradiction: publish created a local commit, proof failed, its remediation
said “amend or reset,” and the retry then failed because publish still required
staged paths (`goals/quality-speedup/history/reflections/2026-08-04-claude.md:7-15`,
`goals/quality-speedup/history/reflections/2026-08-04-claude.md:45-53`,
`goals/quality-speedup/history/reflections/2026-08-04-claude.md:64-66`).

The current surface asks the operator to select among `--staged-only`,
`--amend`, `--no-edit`, `--reuse-verified`, and `--push-only`
(`packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:76-104`,
`packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:199-213`). The
compatibility rules are correct individually but form a matrix: `--no-edit`
requires amend; push-only requires reuse and rejects amend/no-edit/fast/message;
staged-only rejects push-only/reuse/amend
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts:187-219`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts:229-241`).

`ship` should choose the mode from facts. Legacy flags remain for expert/recovery
use, but the normal operator no longer supplies them.

### B2. Minimal command contract

```text
bun run beep yeet ship [--message "type(scope): summary"]
                       [--allow-stale-base]
                       [--plan] [--json]
```

Defaults:

- create/reuse a ready PR
- monitor hosted checks
- perform read-only closeout when hosted checks are green
- never auto-stage an entirely unstaged/untracked worktree
- infer staged-only parking when there is reviewed staged intent plus residue
- never amend or force-push an already-pushed commit
- never reuse proof unless exact current-state proof is fresh

`--message` is required only when the chosen plan creates a commit. A clean,
existing local commit must not require a dummy message. This sits on top of the
locked `PublishScope` fix that permits an existing unpushed commit.

### B3. Observed state

Collect one schema-decoded snapshot before choosing actions:

- worktree: staged, unstaged, untracked, and partially-staged paths
- local/remote relation: no upstream, equal, ahead, behind, diverged
- current HEAD SHA and remote branch SHA
- proof: fresh, missing, or stale with reasons
- PR: absent or present, including `headRefOid`, state/draft status, and check
  summary
- base freshness/overlap

Existing status already collects staged/unstaged/untracked counts
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:276-290`) and
optional PR/check state (`packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:394-471`),
but it does not know upstream ahead/behind, PR head SHA, or exact proof
freshness. Exact proof currently compares branch, base, head, commit SHA, diff
fingerprint, and full tier (`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:705-735`).
Extract that comparison into a non-failing `assessReusableProof` and let the
existing assertion call it.

### B4. State-machine table

Rows are ordered; the first match wins.

| # | Worktree | local vs remote | proof | PR | decision/action chain |
|---:|---|---|---|---|---|
| 1 | any | behind or diverged | any | any | **block**: fetch/rebase or reconcile explicitly. No automatic rebase, reset, amend, or force-push. |
| 2 | staged + partially-staged same path | any | any | any | **block** with the existing split-file remediation; ship cannot infer reviewed hunks. |
| 3 | no staged paths, but unstaged/untracked paths exist | any | any | any | **block**: ask the operator to stage reviewed intent. Do not turn `ship` into `git add -A`. |
| 4 | staged, optionally with residue outside intent | no upstream/equal/ahead | irrelevant | absent/present | validate message -> infer staged-only if residue -> commit -> full proof -> clean-HEAD preflight -> push -> ensure PR -> monitor -> closeout read. |
| 5 | clean | ahead (existing unpushed commit) | fresh | absent/present | clean-HEAD preflight -> push -> ensure/reuse PR -> monitor -> closeout. This is the inferred replacement for `--push-only --reuse-verified`. |
| 6 | clean | ahead (existing unpushed commit) | missing/stale | absent/present | full proof of existing HEAD -> write proof -> preflight -> push -> ensure/reuse PR -> monitor -> closeout. **No amend and no staged intent required.** |
| 7 | clean | equal | fresh | absent | ensure PR -> monitor -> closeout. The commit is already pushed and proven. |
| 8 | clean | equal | missing/stale | absent | full proof of HEAD -> ensure PR -> monitor -> closeout. No redundant push. |
| 9 | clean | equal | any | present, PR head differs from local HEAD | **block** unless the branch relation explains an ordinary ahead push handled by rows 5–6; never monitor stale-head checks as current proof. |
| 10 | clean | equal | any | present, checks failing | report failing checks and stop with targeted repair commands; a blind monitor cannot repair them. |
| 11 | clean | equal | any | present, checks pending | monitor -> closeout when green. |
| 12 | clean | equal | any | present, checks green | read-only closeout; if closeout is green, report merge-ready. |

“Committed?” is represented by staged/dirty state plus the upstream relation,
not by a vague boolean. “Pushed?” is `equal` vs `ahead`; `behind` and `diverged`
are blockers. PR checks must be tied to `headRefOid`, not merely “a PR exists.”

The existing publish pipeline already has the safe sequencing to reuse:
base-freshness first, reviewed intent before commit, proof, proof-state write,
post-proof worktree validation, clean-HEAD preflight, then push
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:313-343`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:395-419`).
`ship` changes selection, not these safety invariants.

### B5. Schema-first plan

Use schemas as the source of truth and keep observations separate from
decisions:

```text
YeetShipSnapshot (S.Class)
├─ worktree: YeetShipWorktree (paths, not only counts)
├─ branchRelation: BranchRelation
│  └─ LiteralKit(no-upstream, equal, ahead, behind, diverged)
├─ proof: ShipProofState (tagged by state)
│  ├─ fresh { verifiedAt, commitSha }
│  ├─ missing {}
│  └─ stale { reasons }
└─ pullRequest: ShipPullRequestState (tagged by state)
   ├─ absent {}
   └─ present { number, url, headRefOid, checks, ... }

YeetShipDecision (tagged by decision)
├─ blocked { reason, remediation, paths }
├─ execute { actions }
└─ complete { summary, prUrl }

YeetShipAction (tagged by action)
├─ commit-reviewed { message, stagedOnly }
├─ verify-head {}
├─ head-install-preflight {}
├─ push-head {}
├─ ensure-pr {}
├─ monitor-checks {}
└─ closeout-read {}
```

Build reusable literal domains with `LiteralKit`, members with `S.Class`, and
finalize finite variants with `S.toTaggedUnion("state" | "decision" | "action")`.
Use the schema-derived matcher for the resolver. Do not model the action chain
as one class with optional message/PR/proof fields, and do not duplicate guards
beside the schema.

`resolveYeetShip(snapshot, input)` should be pure and exhaustively tested. The
effectful collector gathers Git/GitHub/proof facts; the executor interprets the
resolved action list by calling existing Yeet primitives in the same process.
The command's `--plan --json` prints the decoded snapshot and selected action
chain before mutation.

### B6. Failure and idempotency semantics

- Re-run after commit + failed proof: snapshot becomes clean + ahead + stale;
  row 6 re-proves the existing commit. This directly eliminates the 2026-08-04
  reset/amend trap.
- Re-run after green proof + failed push: clean + ahead + fresh; row 5 performs
  only preflight/push/PR/monitor.
- Re-run after successful push + failed PR creation: clean + equal + fresh +
  no PR; row 7 creates/reuses the PR without re-pushing.
- Re-run after PR creation: rows 10–12 inspect exact-head hosted state and do
  not create duplicate PRs.
- Proof that changed files remains invalid; existing post-proof worktree
  validation stays mandatory.
- A pushed review commit is never amended. New staged review fixes become a new
  commit through row 4.

### B7. Size

Recommended implementation: **medium, 650–1,000 changed LOC, 7–10 files, 4–6
engineering days**, assuming the locked existing-unpushed-commit fix is already
landed.

- 180–260 LOC: snapshot/action/decision schemas and annotations
- 100–160 LOC: Git upstream/remote relation + proof assessment collectors
- 100–180 LOC: pure state resolver
- 100–160 LOC: ship executor reusing publish/PR/monitor/closeout primitives
- 250–350 LOC: table tests, temp-Git integration tests, plan JSON and rerun tests

Do not implement `ship` by internally invoking `runYeet` multiple times with
synthesized legacy flags. That would repeat hydration/guards/artifacts and
recreate the process/contract problem at a higher level. Resolve once and call
shared phase functions.

### B8. PR placement

Land in a **dedicated stacked PR immediately after the locked `PublishScope`
existing-unpushed-commit fix**:

1. PR 1: narrow contract fix + regression for “commit exists, not pushed,
   publish may continue.”
2. PR 2: `yeet ship` schemas, resolver, command, and state-machine tests.
3. PR 3: single-process battery, after RepoRun timing fields land.

This placement lets the contract repair merge quickly, makes the porcelain's
dependency explicit, and keeps process-execution risk out of Git publication
logic.

## Final prioritization

| Opportunity | value | risk | size | recommended order |
|---|---|---|---|---:|
| `yeet ship` porcelain | removes recurrent operator mistakes and makes retries idempotent | medium; Git-state decisions are safety-sensitive but table-testable | 650–1,000 LOC | 1 |
| single-process battery | removes ~40 recursive CLI loads; expected 30–50 s wall per full pre-push | medium-high; cwd/env/output/exit contracts | 600–900 LOC | 2, after timing instrumentation |

The minimal durable architecture is one state resolver for shipping and one
typed action dispatcher for repo-native quality work. No daemon, worker pool,
or generic embedded CLI framework is justified.
