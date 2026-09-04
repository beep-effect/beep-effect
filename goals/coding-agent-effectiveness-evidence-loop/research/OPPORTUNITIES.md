# Coding Agent Effectiveness Evidence Loop — friction ledger

Receipts recorded at the moment the friction happened, per the repo law in
`AGENTS.md` (§Docs & Knowledge). Newest first.

## 2026-08-10 — checked-in agent permissions blocked routine GitHub closeout

- **Doing:** updating PR #638, resolving its GraphQL review threads, and cleaning
  merged local/remote PR branches.
- **Evidence:** `.claude/settings.json` denied every mutating `gh api` spelling,
  all `gh api graphql` calls, `git branch -d/-D`, and
  `git push origin --delete`; the Yeet skill consequently documented remote
  cleanup as an operator-only handoff. The repo-local Codex config carried no
  approval/sandbox override, so trusted clones could also inherit a mode that
  blocks network or `.git` writes.
- **Prevented by:** allow the `gh` CLI in Claude while retaining the force-push,
  admin-merge, and repository-deletion denies; let authorized local/remote
  branch deletion run after exact-target checks; set trusted Codex checkouts to
  no-prompt/full-access mode and document capability separately from
  authorization.

## 2026-08-10 — parked branches pay a 197-hunk tax for comment-only campaigns

- **Doing:** merging latest `main` into the parked `feat/evidence-loop-p0-and-fixes`
  branch to reopen it as the wrap-up PR.
- **Evidence:** 11 files conflicted with 197 hunks, all from PR #608's repo-wide
  JSDoc carrier retirement rewording comments in files this branch had rewritten
  (`packages/tooling/library/ai-metrics/src/*`, the AIMetrics/AgentEffectiveness
  commands, `Flags.ts`). Every hunk of main's side proved comment-only — the
  per-file non-comment diff-line count was 0 — and pre-cutover besides (it still
  exported `DEFAULT_AI_METRICS_DATA_ROOT`, which the P0 cutover deletes).
  Resolution: all 11 as `--ours` (merge commit `25e9fffeb0`), then a full green
  `yeet verify` as the safety net.
- **Prevented by:** merging `main` into parked branches promptly after any
  repo-wide mechanical campaign lands, or running the campaign's codemod on the
  parked branch instead of hand-adjudicating hunks. A `git merge` driver or
  helper that auto-resolves hunks whose incoming side is provably comment-only
  would erase this entire class.

## 2026-08-10 — lock-moving merges leave tsgo incremental state poisoned

- **Doing:** first `yeet verify` after merging a `main` that bumped the effect
  subtree (`bun.lock` moved).
- **Evidence:** `@beep/xai`, `@beep/ui`, `@beep/box` failed check/build with
  TS2589 plus *located* `unknown`-cascade TS2345s in files the branch never
  touched — deterministically reproducible under `turbo --force`, which busts
  the turbo cache but not tsgo's `.tsbuildinfo` incremental state.
  `find <pkg> -name '*.tsbuildinfo' -delete` then rerun → 22/22 green.
  Distinguish from the no-location TS2589 load flake by reproducibility.
- **Prevented by:** a repair step (or `yeet repair` heuristic) that invalidates
  tsgo incremental state whenever `bun.lock` changed since the last verify.
  Until then: `bun install` **and** tsbuildinfo deletion after every
  lock-moving merge.

## 2026-08-10 — the committed 16 MB JSDoc inventory is dead weight

- **Doing:** answering "do we still need `standards/jsdoc-documentation.inventory.jsonc`?"
- **Evidence:** the `quality:jsdoc-ratchet` CI lane regenerates a fresh
  inventory to `.beep/ci/jsdoc-documentation.inventory.jsonc` and ratchets that
  against the 34-line `standards/jsdoc-totals.regression-baseline.jsonc`
  (`CiLane.ts:835-853`). Nothing reads the committed 16 MB snapshot; it inflates
  every clone and poisons diffs whenever regenerated.
- **Opportunity:** a separate chore PR from clean `main` (per
  `standards/generated-artifacts.policy.md`): drop the committed inventory, point
  `defaultJSDocInventoryPath` at the `.beep/ci` output, update the policy table.
  Keep the generator, the baseline, and the ratchet — the ratchet still guards
  live debt (63 packages needing remediation, 548 multi-paragraph descriptions).

The seven closeout-era sections through the meta receipt below were reconstructed
as a batch on 2026-08-10 after the friction occurred on 2026-08-05/06. They
preserve evidence but do **not** satisfy the contemporaneous-receipt rule in
`AGENTS.md`. The later Turbo/TypeScript receipt was recorded during the publish
investigation that produced it.

This packet owns the yeet-operator surfaces these receipts land on — `Verdict.ts`,
`ProofState.ts`, `Handler.ts`, `Status.ts`, and `yeet doctor` (`SPEC.md` §
"Surfaces"). Earlier operator receipts from the same family live in
`goals/speed-loop/research/OPPORTUNITIES.md` as items #74–#78 and #85; that packet
went `completed-retained` on 2026-08-08 and its own closeout says future incidents
enter the *active* ledger, so new receipts arrive here and cite the retained ids
rather than extending them.

## Retrospective closeout friction receipts (reconstructed 2026-08-10)

### The 3-lane green verdict is an output-truncation bug, not a design property

Retained ledger #76 records the symptom correctly — `verdict.json` carries 3 lanes
on a green `yeet verify` and ~24 on an early-stop failure — and attributes it to
the composite lane being "one lane when green". Tracing the writer refutes that
mechanism, and the true one is cheaper to fix than the widget #76 proposes.

`buildYeetVerdict` already flattens the composite's sub-lanes: it parses the
`[beep-github-check-run]` payload out of the pre-push step's captured stdout and
appends one `YeetVerdictLane` per sub-lane, so 24 = 3 top-level + 21 pre-push
sub-lanes. Nothing structurally hides them. What hides them is the capture bound.

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:526` —
  `A.findLast(Str.startsWith(GITHUB_CHECK_RUN_REPORT_PREFIX))`; the sub-lanes come
  from the last check-run line in the captured output.
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1085` — the payload is
  logged *after every wave has run*, i.e. it is the last thing the step prints.
- `packages/tooling/tool/cli/src/internal/process/StepExec.ts:280` — every step's
  capture is bounded at `maxChars: 512 * 1024`.
- `packages/tooling/tool/cli/src/internal/process/StepExec.ts:328` —
  `if (state.truncated) { return state; }`: the reducer is **head-retaining**, so
  chunks after the cap — including the final report line — are discarded.
- `packages/tooling/tool/cli/src/internal/process/StepExec.ts:473` — teeing happens
  before bounding, which is why the operator sees the payload on the live terminal
  while the artifact does not have it.

A full green pre-push emits more than 524288 characters; a failing run early-stops
before it does. That is the whole bimodality. Consequences worth naming: the raw
`.beep/yeet/logs/full_01-pre-push.log` is *also* missing the payload on green runs,
so the documented "grep the stdout instead" workaround only works against a live
terminal, not against a saved log — and some failures long enough to blow the bound
will record 3 lanes too, which is the dangerous direction.

Fixes, in ascending cost: tail-retention (or head+tail) in the bounded reducer; a
larger bound for the proof step specifically; or have `quality github-checks` write
the report to a file and have the verdict writer read that instead of scraping
stdout. The third makes the payload independent of any capture policy and is the
one worth doing.

### `--reuse-verified` already records per-lane keys that nothing reads

Retained ledger #21/#25's amendment promoted tree/input-keyed proof reuse from a
research question to a build item on the evidence that `--reuse-verified` fired
zero times across eight re-proofs. The implementation lead was not recorded: the
per-lane half already exists and is inert.

`assertReusableVerifiedState` accepts a saved proof only when branch, base, head,
the HEAD commit SHA, a `full` tier, **and** one whole-worktree SHA-256 fingerprint
over `git status --short` + `git diff --binary HEAD` + `git diff --binary --cached`
all match. Any tracked-file change, staged or unstaged, and any commit rewrite
fails it repo-wide with "diff fingerprint changed".

- `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:234-235` —
  the fingerprint inputs.
- The state file *does* persist per-lane entries carrying a `commandHash`, but they
  are written and never read; reuse is all-or-nothing.

The pattern to copy is already in the repo and already trusted: `beep docgen check
--reuse-proof-manifest` keys per-package on input/output file digests plus tool
version (`ProofManifest.ts:385-400`). Note the two flags are unrelated despite the
similar names — `--reuse-verified` is yeet's, `--reuse-proof-manifest` is docgen's.

### CORRECTION: neither ratchet fails on a tightening

Recorded because the wrong version of this reached the operator in a feedback round
and could have become a build item. The claim was that the JSDoc and coverage
ratchets both fail when totals *improve*, forcing a separate baseline write. The
first half is false for both.

- `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts:365` —
  the only totals-based failure branch is `comparison.increased`. Decreases route
  to an advisory `[jsdoc-ratchet] tighten-baseline:` stdout nudge emitted *after*
  the ok line (`internal/ratchet/RatchetLifecycle.ts:88`).
- The coverage ratchet passes `tighten: O.none()` and its `metricRegressed`
  predicate is a strict below-baseline comparison, so a rise is structurally
  unreachable as a failure.

The JSDoc ergonomic half is already implemented: its tightening nudge prints both
`bun run beep quality jsdoc-inventory` and
`bun run beep quality jsdoc-ratchet --write-baseline`. Coverage has no equivalent
because it passes `tighten: O.none()`. The surviving widget is coverage-specific:
detect a safe tightening and print `bun run coverage:baseline:write` there.

One live coverage-ratchet fact stays true and is already dispositioned under
retained #85: yeet never runs a package's `coverage` script at all
(`YEET_FEEDBACK_TASKS` is `build`/`check`/`lint`/`test`). The deletion claim does
not survive current source: when both snapshots carry uncovered counts, a failure
requires both a percentage drop and an uncovered-count increase. Deleting covered
units alone therefore passes for baselines such as `@beep/openai-compat` that carry
those counts.

### Retained #78's "hosted-only" list is wrong, and the symptom it was built from is unexplained

This is the most load-bearing correction here, because #78 is a build item and its
premise is the list.

#78 names Coverage Regression, **Lint Policy**, **Property Laws**, Codegen Drift,
and Professional Desktop IPC Stdio as running hosted-only, against "21 local lanes
vs 26 hosted required checks". Counted from source:

- Local `full:01-pre-push` runs exactly **21** sub-lanes on a feature branch (20 on
  `main`, where the branch-gated `quality:changeset-status` lane drops).
- Hosted defines **21** distinct check names in `.github/workflows/check.yml` plus
  Storybook's `Build And Test` = **22** on a PR. `CI_LANE_DESCRIPTORS` has 22
  entries / 21 distinct context names / **17** distinct `required: true`. There is
  no 26.
- **Lint Policy is not a gap.** Local `quality:lint` runs unscoped `bun run lint`,
  which invokes the turbo `lint` task *plus* `rootRepoLintPolicySteps(repoRoot)` —
  the identical full-scope battery the hosted lane runs via `beep lint policy`
  (`Quality/Tasks.ts:1634`, `Ci/CiLane.ts:856`). `runRootLintPolicyTaskInternal`
  forces full scope under CI, so neither side's scope explains PR #575.
- **Property Laws is `required: false`** (`Ci/CiLane.ts:516-517`). Genuinely absent
  locally, but not a required check.
- #78 **omits two required gaps**: `Commitlint` (`Ci/CiLane.ts:460-461`, no
  pre-push counterpart) and the `dependency-review` half of `Security`
  (`Ci/CiLane.ts:489-496`, `replay: "none"`, permanently CI-only).

Corrected set difference — required hosted checks with no pre-push counterpart:
**{Coverage Regression, Codegen Drift, Professional Desktop IPC Stdio, Commitlint}**
plus `dependency-review`. Non-required and also absent: {Property Laws, PR Size
Label, Build And Test (Storybook)}. Hosted `Build` is push-only, but local pre-push
does have its `quality:build` counterpart.

**The unresolved part, and the reason this receipt matters more than the list fix.**
PR #575 lived the symptom: a local 21/21 green followed by hosted `Lint Policy` red
on ten pre-existing `effect-governance-terse-effect` findings in `repo-cli` files.
If both sides run the same full policy battery, that cannot happen. Both
observations are solid, so something in between is not what it looks like.
Untested hypotheses, in order of prior: the local `quality:lint` lane returned a
warm Turbo cache rather than executing (the repo already carries
`TURBO_FORCE=1 lint` guidance for exactly
this shape); or the policy steps ran but the composite's pass/fail aggregation lost
their result. Resolving this is a prerequisite for #78 — a parity footer generated
from a wrong list is worse than no footer, and if the real mechanism is cache
staleness then the footer is the wrong widget entirely.

Caveats for whoever builds it: `quality:docgen` is bounded locally vs full-repo
hosted; `pre-push:secrets` and `pre-push:security` are `replay: "approximate"`;
`Codegen Drift`'s desktop-migration-bundle step *is* reachable locally through
`bun run check`, so only the ecfr generate/drift pair is truly uncovered. And the
repo has no branch-protection config file — `required: true` in
`CI_LANE_DESCRIPTORS` is the repo's own model of the server-side ruleset, not the
ruleset itself. Confirming the two against each other is its own small task.

**Resolution (2026-08-13, terminal).** Current source separates three modes that
the incident report had conflated: local `beep lint policy` is deliberately
changed-scope, hosted `beep lint policy` is deliberately full-scope because
`CI=true`, and root `bun run lint` constructs the full policy battery. Commit
`642331b86c` (PR #678) made the changed-scope contract explicit at plan
construction: a scoped step is omitted when its relevant file set is empty,
while `files === undefined` still emits the full step. Its focused plan tests
cover source-file forwarding, docs-only omission, absence of empty include
values, and full-scope step inventory. The old PR #575 observation has no
retained execution trace capable of distinguishing a warm Turbo replay from an
obsolete pre-fix planner, so assigning a deeper root cause now would be
speculation. The current regression boundary is executable and the historical
ambiguity is closed as non-reproducible, not carried as another build item.

### Two publish papercuts, with the parse-time fix named

Both are refinements of retained #8's ship-porcelain item, recorded because each has
a one-line fix that is smaller than the item it sits under.

- `--start-pr-early` requires **`--monitor` and `--pr`**, and neither appears in the
  flag's help text. Both are enforced by runtime guards after argument parsing and
  repo-context hydration (`Yeet/internal/Guards.ts:54-64` and `:183-187`,
  dispatched from `Handler.ts:1204`), so the operator pays a startup before being
  told. The sibling `--fast` flag already states its `--monitor` requirement in its
  own help string — this is a parity gap, not a missing capability.
- `changeset-status` reports "no changesets were found" when one exists but is
  untracked. Mechanism: the lane runs `changeset status --since=origin/main`, and
  `--since` filters changesets through `git diff --name-only --diff-filter=d`, which
  never lists untracked files. **Staging is sufficient** — `git add` fixes it, a
  commit is not required. The message should say "found but untracked — `git add`
  it".

### `beep lint policy` fails on any docs-only branch, from an empty `--include`

Lived while running the cheap-lane preflight for this very PR: `bun run beep lint
policy` exited 1 with five failed steps — `lint:effect-imports`,
`lint:terse-effect`, `lint:effect-fn`, `lint:frozen-grant-set`,
`lint:native-runtime` — each having printed the CLI's help text rather than any
finding.

Root cause is one line:

```ts
// packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1467
...(files === undefined ? A.empty<string>() : ["--include", A.join(A.filter(files, isLawSourcePath), ",")]),
```

When `files` is defined but filters to **empty** — which is exactly a docs-only
change set — this emits `["--include", ""]`. The laws commands reject the empty
flag value, print usage, and exit 1. Reproduced standalone:
`bun run beep laws effect-imports --check --include ""` → help text, exit 1.

Attribution: **inherited**, and not a finding about the branch that hit it. This
branch changes zero `.ts` files, and all five laws pass at full scope
(`bun run beep laws <rule> --check` with no `--include`, five for five).

Hosted is unaffected — docs-only PRs #629 and #631 both show `Lint Policy` green —
so hosted `beep lint policy` must be taking the `files === undefined` full-scope
path where the local invocation derives `scope=changed`. **That divergence is
itself unexplained and is worth confirming**, because it is the same class of
local/hosted mismatch as the `Lint Policy` question in the receipt above, pointing
the opposite way. Two receipts now turn on how the policy lane picks its scope; one
trace of that resolution would close both.

Two candidate fixes, and the choice is a real decision rather than a typo repair:
**skip the law step entirely** when the filtered list is empty (fast, and correct
in the sense that there is nothing in scope to check), or **fall back to full
scope** (slower, and it would surface inherited findings on a branch that touched
no source — the failure mode PR #575 spent a day on). Skipping is almost certainly
right; `lint:package-test-imports` two lines below has the same shape and the same
question.

Cost paid: the preflight-tier advice this packet's family already ships — run
`goals doctor`, `lint policy`, `lint schema-first` standalone before a heavy
verify — is currently unusable for docs-only branches, which is the branch shape
most likely to want a cheap preflight.

**Resolution (2026-08-13, fixed).** PR #678 implemented the skip-empty choice in
`scopedRepoCliStep`/`scopedLawStep`. The focused docs-only test proves that all
seven naturally scoped steps are absent and no empty argument is constructed;
the full-scope inventory test proves hosted/full execution still emits them.
The apparent local/hosted divergence is therefore explained by the intended
mode selection above, and the actual empty-`--include` defect no longer exists.

### Meta: these receipts had nowhere to go at the moment of friction

The friction law points at "the active packet's ledger". Every surface above belongs
to this packet, and this packet had no `research/OPPORTUNITIES.md` — so five
sessions of yeet-operator receipts routed to `goals/speed-loop`'s ledger instead,
which then closed on 2026-08-08 with 94 stable ids that new work must cite rather
than extend. The delay is visible in this file's dates: every receipt above is
stamped 2026-08-10 but was lived on 2026-08-05/06.

What would have prevented it: a packet that names implementation surfaces in its
SPEC gets its ledger file at mint time, empty, rather than at first friction. Cheap
enough to fold into the packet template.

## 2026-08-10 — Turbo force does not invalidate TypeScript's stale build graph

Lived while trying to publish the docs-only candor-gate session closeout branch.
`bun run beep yeet verify` failed `quality:build` and `quality:check` on seven
TypeScript errors in `packages/drivers/xai/src/XAi.service.ts`, which this branch
does not touch. A detached probe of `origin/main` at `10902ab196` reproduced the
same seven errors, while hosted run `31369531689` reports `Check`, `Build`, and
`Test Unit` green on that exact SHA. This is inherited, but inheritance alone does
not explain why the authoritative local gate and hosted gate disagree.

The cheap stale-state explanations did not survive:

- `bun install` completed under Bun `1.3.14`, re-linked the workspaces, patched and
  verified the Effect language-service binary, left the tracked tree unchanged,
  and the package-local XAI check still produced all seven errors.
- `TURBO_FORCE=1 bun run build --filter=@beep/xai...` bypassed Turbo's task cache;
  eight dependency builds passed and `@beep/xai` failed on the same seven errors.
  The underlying package command remained `tsc -b tsconfig.json` without
  TypeScript's own `--force`, so this did not prove that the compiler's incremental
  graph had been rebuilt.
- `bun run beep ci lane check` locally invoked the hosted-shaped
  `bun run check -- --concurrency=1`; `@beep/xai` was a cache miss and failed on
  the same seven errors. The independent tsgo test and smoke steps passed, and the
  composite correctly returned exit 2.

The hosted Check lane was not cache-masked: it reported remote caching disabled,
`@beep/xai#check` as `cache bypass, force executing` with Turbo hash
`f28e6025ed84a7bb`, and passed. But Actions had first run `git clean -ffdx` and a
frozen install. A disposable detached worktree at the same `10902ab196` SHA also
passed XAI after a clean frozen install, using the same Bun version, tsgo version,
and patched compiler SHA-256 as the failing checkout.

That isolated the difference to checkout-local derived state. Running
`bunx tsgo -b packages/drivers/xai/tsconfig.json --force` in the failing checkout
regenerated TypeScript's incremental graph; the ordinary package check then passed
without any source, lockfile, dependency, or compiler-binary change. Root cause:
stale TypeScript build info survived both `bun install` and the Turbo-level forced
build. What would have prevented the dead end: when the Effect tsgo patch or its
dependent type graph changes, invalidate the workspace `node_modules/.tmp/*.tsbuildinfo`
state or expose a supported root command that performs an actual `tsgo -b --force`.
The operator guidance must distinguish Turbo cache invalidation from TypeScript
incremental-state invalidation; they are independent layers.

## 2026-09-03 — the documented scheduler status route moved under `quality`

Lived while resuming P1 and checking whether a baseline analysis could run
without competing with admitted work. `bun run beep scheduler status --json`
failed because the current CLI has no `scheduler` subcommand and rejects the
flag. A read-only `systemctl --user list-units 'agent-run-*.scope'
--state=running` probe still showed several live admitted scopes, so the
backpressure was real even though the documented inspection route had drifted.
The current repo-owned replacement was later found at
`bun run beep quality scheduler status --json`; its structured result confirmed
the same active leases and queued publish tickets without relying on systemd as
the source of truth.

What would have prevented it: update `AGENTS.md` and packet handoffs in the same
change that moves the command, and include the current fully qualified route in
the scheduler's CLI error or root help. Until then, goal executors can mistake a
renamed command for an empty queue and either compete with live work or idle
unnecessarily.

## 2026-09-03 — architecture touch route cannot audit an added role file

Lived while adding schema-owned P1 role files. The required touch route
`bun run beep architecture` only rendered command help. The apparent validation
subcommand `bun run beep architecture check` then failed with `Missing required
flag: --file`; its contract validates an already-rendered architecture operation
plan and does not accept an existing package or newly added role path. The
available `architecture plan` flags describe a new slice/concept/domain-kind
archetype, not an observability helper within an existing tooling package, so
manufacturing a plan would misclassify this change.

What would have prevented it: provide a read-only `architecture audit <path>`
route for manually added roles, or narrow the touch guidance to the operations
the plan factory can actually express and name the supported fallback for
existing-package helper modules.

## 2026-09-03 — Yeet JSON plans silently truncate at 16 KiB

Lived while inspecting the canonical P1 closeout plan without starting its
heavy feedback wave. `bun run beep yeet repair --plan --json | jq ...` failed
with `Unfinished string at EOF at line 1, column 16384`. Two bounded follow-up
probes confirmed that the command emitted exactly 16,384 bytes, stopped in the
middle of a JSON string, and still exited zero. The human-readable `--plan`
form completed and showed that repair expands into repo docgen plus broad
build/lint/check feedback, so it remained intentionally unstarted while the
machine-wide scheduler had live holders and queued tickets.

What would have prevented it: structured plan output must either stream the
complete JSON document or fail nonzero with explicit truncation metadata. A
size-capped JSON prefix with exit zero is not a machine-readable plan and can
make automation act on an incomplete affected-package universe.

## 2026-09-03 — fast monitored publish still entered the full-proof queue

Lived while opening the P1 pull request early under an explicit operator
instruction to bypass scheduler admission and substitute package-filtered local
checks. The human-readable plan for
`bun run beep yeet publish --fast --monitor --pr` contained preflight, push, PR,
and monitor steps only, but execution queued `full-proof(3)` at position 6 before
the push step. The run was interrupted cleanly before admission, no lease was
created for this checkout, and the documented manual non-force push plus PR
creation fallback was used instead.

What would have prevented it: make publish execution consume the same resolved
step graph rendered by `--plan`, or reject a contradictory flag combination
before enqueueing. A fast plan that omits local proof must never silently admit
full proof at execution time, because callers cannot safely reason about queue
occupancy or whether an early PR will actually be opened.

## 2026-09-03 — local `gh` usage errors open the remote-probe cooldown

Lived while fetching paginated PR review threads after the shared `gh` circuit
had recovered. The installed CLI rejected the local combination of `--slurp`
and `--jq` before making an API request, but the wrapper classified that exit 1
like a remote probe failure and opened the machine-wide 15-minute cooldown.
The corrected query could not run without either waiting or using the
operator-only reset path, so review work continued from the already-fetched
summary while the circuit remained authoritative.

What would have prevented it: distinguish validated local invocation failures
from commands that actually reached the guarded service, or provide a dry-run
argument-validation step before the breaker owns the command. A local syntax
mistake should remain observable, but it should not suppress unrelated agents'
GitHub reads for a full remote-failure cooldown.

## 2026-09-03 — changeset status ignores an uncommitted changeset

Lived while repairing the exact-head Repo Sanity failure for a missing
`@beep/repo-ai-metrics` changeset. After adding the changeset locally,
`bun run beep quality changeset-status --since origin/main` still reported the
package as missing because the check only inspected `origin/main...HEAD`; the
new untracked changeset was outside that committed range. This made a correct
dirty-worktree repair indistinguishable from no repair until after a commit.

What would have prevented it: include tracked and untracked working-tree
changesets when `HEAD` names the local checkout, or state that the command is a
committed-range-only check and provide a dirty-aware local mode. The PR lane can
remain commit-only while the edit loop gives authors evidence before committing.

## 2026-09-03 — branch-local coverage missed merge-candidate drift

Lived while repairing the P1 PR after a package-filtered coverage run reported
the committed 77.98% branch floor exactly, but GitHub's synthetic merge against
newer `main` reported 77.89%. The newer base had refactored two covered branches
out of `agent-effectiveness.ts`; once that exact base commit was merged locally,
`bun run coverage -- --filter=@beep/repo-ai-metrics --summarize` reproduced the
hosted 370/475 result. One focused normalization law restored 371/475 without
lowering the baseline.

What would have prevented it: make early-PR local proof refresh and test the
current pull-request merge candidate, or at minimum report when its base SHA is
newer than the locally tested `origin/main`. Exact branch-head proof and exact
merge-candidate proof are different evidence when the base moves.

## 2026-09-03 — fleet JSON output truncates before it can be decoded

Lived while taking the required post-merge adoption census. The read-only
`bun run beep worktree fleet --json` scan reported 22 clones and 103 total
checkouts, but piping its output to `jq` failed with
`Unfinished string at EOF at line 1, column 131072`. The command had cut the
single JSON line in the middle of a string while still exiting zero. The
rollout therefore used the scan's top-level coverage counters plus a separate
bounded direct-clone inventory instead of treating the truncated payload as a
complete fleet document.

What would have prevented it: emit complete JSON independently of terminal
render limits, add a compact projection that omits large per-checkout path
arrays, or fail nonzero with explicit truncation metadata. A successful
`--json` command must never hand automation an undecodable prefix.

## 2026-09-03 — local proof stalled without liveness under I/O pressure

Lived while repairing the exact-head JSDoc Ratchet failure in `@beep/md`.
`bun run docgen:local -- --package @beep/md` produced a valid scoped plan, then
remained silent for more than three minutes with only the repo CLI process
alive and no compiler or Turbo child. It was interrupted cleanly so the edit
loop could continue through explicit package-filtered checks and the exact
JSDoc Ratchet lane. Subsequent package-filtered lint and build processes, and
the pre-commit Biome check over the single touched source file, likewise made
no terminal progress while the host reported more than 190 processes in
uninterruptible I/O wait. The completed package verifier, type check, unit
tests, and parallel integration tests were retained as local evidence; the
stalled processes were stopped before publishing to exact-head CI. After the
host restarted, the same dependency-aware docgen run completed 26 packages in
1 minute 28 seconds and the package-filtered lint, check, test, and build lanes
returned normally, attributing the earlier wait to host health rather than the
repository change.

What would have prevented it: emit phase-level liveness while orchestration is
waiting, including the awaited resource or operation, and apply a bounded
timeout that fails with diagnostic context. A scoped documentation command
that has finished planning, or a hook checking one named file, should not be
indistinguishable from a dead wait when its host is unhealthy.

## 2026-09-03 — service-account archive drill cannot attribute plaintext-hash drift

Lived while exercising the newly available service-account lane for one
bounded AI-metrics pass. The agent shim and both current secret references
resolved successfully, and the archive drill decrypted the selected object,
but the content-free integrity gate stopped on `AI metrics archive decrypt
drill failed plaintext hash verification.` No secret value or decrypted
content was printed, the pass was not retried, and its temporary reference
file was removed. This separates a healthy credential lane from an unresolved
archive-integrity failure, but the current error does not identify whether the
stored hash, archive lineage, or hashing implementation drifted.
One local control using the already installed mode-0600 AI-metrics environment
failed at the same plaintext-hash gate, so the failure is not attributable to
the new service-account route or the supplied references.

What would have prevented it: make the drill emit a content-free diagnostic
record containing the archive object's schema/algorithm version, writer
revision, stored-hash version, and computed-hash version, with distinct typed
outcomes for authentication, authenticated decryption, and plaintext-hash
comparison. A credential-backed integrity proof should make the failing edge
attributable without requiring a second secret-resolving run.

## 2026-09-03 — package coverage consumes a stale ignored goals index

Lived while reproducing PR coverage with
`bun run coverage -- --filter=@beep/repo-cli --summarize` after merging current
`main`. The 12-minute package run failed one otherwise unrelated goals test
because the ignored local `goals/INDEX.md` still described 172 packets while
the merged manifests generated 175. Regenerating the projection with
`bun run beep goals index --write` made the exact 24-test file pass. The
coverage ratchet never ran, so the failure provided no evidence about the
reported coverage regression.

What would have prevented it: have the package coverage preflight regenerate
ignored derived inputs whose manifests changed, or make the test construct its
expected local projection inside its isolated fixture. A package-filtered
coverage run should not spend its full suite budget before discovering that an
untracked workspace cache predates the tested commit.

## 2026-09-03 — full-run coverage floors exceeded package-lane observations

Lived while repairing PR #992 after both the hosted affected lane and two clean
`bun run coverage -- --filter=@beep/repo-cli` runs agreed that
`Quality.command.ts` and `QualityScheduler.ts` were below floors written by the
preceding repo-wide baseline refresh. The source delta in `Quality.command.ts`
belonged to merged PR #989, while `QualityScheduler.ts` had not changed since
PR #964. The gate's scoped writer merged the reproducible package-lane results
without lowering any other package. That documented repair still failed on the
hosted PR: when `TURBO_SCM_BASE` is present, the comparison reloads every
surviving file floor from the base ref, so a same-PR baseline adjustment is
ignored for the files it is meant to repair. The only immediately admissible
repair was adding tests until the isolated lane exceeded the inherited floors.

What would have prevented it: require each package row in a repo-wide baseline
refresh to be measured with the same isolated package command used by affected
CI, or attach a provenance field that names the measurement scope. A floor
observed only through incidental cross-package execution is not reproducible in
the lane that enforces it. The remediation should also distinguish a base-pinned
PR lane from a baseline-authoring lane instead of recommending an adjustment
that the current PR comparison cannot consume.

## 2026-09-03 — test-utils coverage depended on a local Docker daemon

Lived while closing PR #992 after the hosted coverage lane measured
`SqlTest.ts` at 53.76% lines and 34.1% functions against 66.3% and 46.51%
floors. The package had no source diff, and an ordinary filtered local run
reproduced the floors exactly. Repeating the package under the hosted Node 24
environment with Docker forced unavailable reproduced the regression: five
coverage-mode SQLite cases were intentionally skipped, the external database
was unconfigured, and seven container/external cases skipped. The committed
floor therefore depended on successful workstation Testcontainers execution.
A deterministic transport double plus a Docker-free in-process hook test
restored every floor with the daemon unavailable; the baseline was not lowered.

What would have prevented it: require baseline writers to run with optional
database and container transports explicitly disabled, or record those
capabilities in the baseline provenance and reject non-portable raises. A
package coverage floor must be attainable in the hosted lane without inheriting
the baseline author's local infrastructure.

## 2026-09-03 — publish rejected committed work beside an unrelated draft

Lived while publishing the verified PR #992 repair. The branch was three
commits ahead of its remote, every intended change was committed, and the only
working-tree entry was the packet's preserved untracked P2 draft. `bun run beep
yeet publish` stopped before push with `yeet publish requires reviewed staged
changes or a clean local commit ahead of the publish remote/base.` Its verdict
confirmed the exact ahead commit and a fresh, overlap-free base but classified
the unrelated untracked file as making the committed publish path unclean. A
direct non-force push was required to preserve the draft without staging,
moving, deleting, or locally ignoring it.

What would have prevented it: define committed publish cleanliness over the
tracked index and committed range, while separately reporting untracked paths
that do not overlap the published diff. An unrelated future-phase draft should
not force operators to perturb the worktree or bypass the canonical publisher.

## 2026-09-03 — package verification ran the expensive audit before cheap lint

Lived while resolving PR #992's only merge conflict and running
`bun run beep quality package-verify @beep/repo-cli`. The verifier completed
3,093 TypeScript tests, 53 Python tests, dependency builds, and docgen in more
than six minutes before failing on one Biome-organize-imports finding in the
conflict-resolved test file. The safe import sort took one formatter pass, and
the documented quick follow-up then proved lint and type-check in 15 seconds;
none of the expensive audit results had failed.

What would have prevented it: make package verification run its deterministic
cheap lint and type-check preflight before dependency builds, full test suites,
Python environments, or docgen. A merge-conflict import-order defect should be
reported in seconds, before the verifier spends the package's longest proof
budget.

## 2026-09-03 — the repo-wide test type-check bypassed an over-capacity scheduler

Lived while running PR #992's collected cheap gates before publish. The
scheduler reported four tokens of current capacity and eight tokens already
held by two admitted proofs, but `bun run beep quality test-tsgo` bypassed
admission and started another repo-wide compiler sweep. After nine quiet
minutes it failed in an unrelated package with the Go runtime invariant
`fatal error: bad sweepgen in refill`, not a TypeScript diagnostic. The other
13 collected gates passed, and the changed packages' focused type-checks had
already passed.

What would have prevented it: admit the repo-wide test type-check through the
machine scheduler, or cap its Go/compiler parallelism from the same live memory
envelope. A nominally cheap gate should not compound an over-capacity host and
turn a deterministic source check into a runtime crash.

## 2026-09-03 — registry availability made a clean audit fail twice

Lived while publishing PR #992. The local pre-push audit and the hosted Repo
Sanity job each waited about five minutes before the npm advisory bulk endpoint
returned HTTP 503. Neither failure reported a vulnerability, and an exact local
retry completed with no vulnerabilities across 2,332 packages. The transient
transport failure therefore consumed both the local proof and an exact-head
required check without producing dependency evidence.

What would have prevented it: classify advisory-service transport failures
separately from discovered vulnerabilities and apply a bounded backoff inside
the audit lane. A dependency gate should distinguish an unavailable registry
from an unsafe dependency graph.

## 2026-09-03 — fixed scheduler sleep failed only under hosted load

Lived while closing PR #992 after the complete local `@beep/repo-cli` test run
passed 3,093 tests. The hosted package run later failed the scheduler assertion
`expected 0 to be greater than 0`: a test slept for 100 milliseconds and then
assumed an asynchronous ticket rewrite had completed. Under hosted load the
rewrite had not happened yet, even though the production path remained live.
The test now polls the observable ticket condition with the existing bounded
Effect schedule instead of treating elapsed wall time as completion evidence.

What would have prevented it: use condition-based, bounded synchronization for
every filesystem or fiber handoff test. Fixed sleeps should pace retries, not
serve as proof that another Effect has reached a particular state.

## 2026-09-03 — provenance stamping requested an unsupported PR field

Lived while publishing PR #992 through Yeet. The push succeeded, but the
provenance footer step was skipped after `gh pr view` rejected `lastEditedAt`
as an unknown JSON field. The PR remained usable, but the canonical publisher
could not perform its own footer projection on the installed GitHub CLI.

What would have prevented it: constrain the query to fields supported by the
minimum declared GitHub CLI version, or feature-detect optional fields before
requesting them. Provenance stamping should degrade on missing metadata, not on
an invalid all-or-nothing query.

## 2026-09-03 — full lint policy exceeded one ESLint shard's heap

Lived while proving PR #992's inherited terse-Effect repair with the exact
hosted `ci lane lint-policy` command. Twenty-five policy steps passed, including
the complete terse scan, before the `packages/tooling` deprecated-API ESLint
shard reached Node's roughly 8 GiB heap ceiling and stopped with `JavaScript
heap out of memory`. No lint diagnostic preceded the crash. Another checkout
held a five-token merged-preview lease, but this lint lane was not admitted
through the scheduler and launched its own four-way shard fan-out. Retrying the
wrapper with a larger heap still left its ESLint child at the 8 GiB ceiling;
running that exact failed shard directly with a confirmed 16 GiB heap passed
without a diagnostic.

What would have prevented it: admit the full lint lane through the shared
resource envelope and size both shard concurrency and per-process heap from
that lease. A repository policy scan should report a source finding or a typed
resource-exhaustion result, not conflate a V8 heap crash with failed lint.
