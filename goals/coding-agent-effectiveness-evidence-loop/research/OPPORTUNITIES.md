# Coding Agent Effectiveness Evidence Loop — friction ledger

Receipts recorded at the moment of friction (repo law: never saved for closeout).

This packet owns the yeet-operator surfaces these receipts land on — `Verdict.ts`,
`ProofState.ts`, `Handler.ts`, `Status.ts`, and `yeet doctor` (`SPEC.md` §
"Surfaces"). Earlier operator receipts from the same family live in
`goals/speed-loop/research/OPPORTUNITIES.md` as items #74–#78 and #85; that packet
went `completed-retained` on 2026-08-08 and its own closeout says future incidents
enter the *active* ledger, so new receipts arrive here and cite the retained ids
rather than extending them.

## 2026-08-10 — the 3-lane green verdict is an output-truncation bug, not a design property

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

## 2026-08-10 — `--reuse-verified` already records per-lane keys that nothing reads

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

## 2026-08-10 — CORRECTION: neither ratchet fails on a tightening

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

What survives is the ergonomic half, and it stands: refreshing either baseline is a
separate explicit invocation — `beep quality jsdoc-ratchet --write-baseline` and
`bun run coverage:baseline:write` — never an inline offer at the moment the nudge
is printed. The cheap widget is to print the exact command in the nudge.

Two live coverage-ratchet facts stay true and are already dispositioned under
retained #85: the ratchet compares percentages, so deleting covered code from any
package below 100% trips it arithmetically, and yeet never runs a package's
`coverage` script at all (`YEET_FEEDBACK_TASKS` is `build`/`check`/`lint`/`test`).

## 2026-08-10 — retained #78's "hosted-only" list is wrong, and the symptom it was built from is unexplained

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
  the identical battery the hosted lane runs via `beep lint policy`
  (`Quality/Tasks.ts:1634`, `Ci/CiLane.ts:856`). Local is in fact a **superset**:
  hosted `beep lint policy` defaults to changed-file scope, local passes no files
  and runs full scope.
- **Property Laws is `required: false`** (`Ci/CiLane.ts:516-517`). Genuinely absent
  locally, but not a required check.
- #78 **omits two required gaps**: `Commitlint` (`Ci/CiLane.ts:460-461`, no
  pre-push counterpart) and the `dependency-review` half of `Security`
  (`Ci/CiLane.ts:489-496`, `replay: "none"`, permanently CI-only).

Corrected set difference — required hosted checks with no pre-push counterpart:
**{Coverage Regression, Codegen Drift, Professional Desktop IPC Stdio, Commitlint}**
plus `dependency-review`. Non-required and also absent: {Property Laws, PR Size
Label, Build (push-only), Build And Test (Storybook)}.

**The unresolved part, and the reason this receipt matters more than the list fix.**
PR #575 lived the symptom: a local 21/21 green followed by hosted `Lint Policy` red
on ten pre-existing `effect-governance-terse-effect` findings in `repo-cli` files.
If local lint is a superset of hosted, that cannot happen. Both observations are
solid, so something in between is not what it looks like. Untested hypotheses, in
order of prior: the local `quality:lint` lane returned a warm Turbo cache rather
than executing (the repo already carries `TURBO_FORCE=1 lint` guidance for exactly
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

## 2026-08-10 — two publish papercuts, with the parse-time fix named

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

## 2026-08-10 — `beep lint policy` fails on any docs-only branch, from an empty `--include`

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

## 2026-08-10 — meta: these receipts had nowhere to go at the moment of friction

The friction law points at "the active packet's ledger". Every surface above belongs
to this packet, and this packet had no `research/OPPORTUNITIES.md` — so five
sessions of yeet-operator receipts routed to `goals/speed-loop`'s ledger instead,
which then closed on 2026-08-08 with 94 stable ids that new work must cite rather
than extend. The delay is visible in this file's dates: every receipt above is
stamped 2026-08-10 but was lived on 2026-08-05/06.

What would have prevented it: a packet that names implementation surfaces in its
SPEC gets its ledger file at mint time, empty, rather than at first friction. Cheap
enough to fold into the packet template.
