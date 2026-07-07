# P0 parity evidence (D9 + Verification Matrix rows 1–3)

Evidence trail for the CI-lane inversion parity proof. Filled as the
P0 PR progresses; the thinning commit (orl-003) may not land before
§1 records matching verdicts.

## 1. Same-SHA shadow comparison (D9 / matrix row 1)

Shadow workflow: `.github/workflows/ci-lane-shadow.yml` (temporary,
workflow_dispatch). Both runs execute against the SAME head SHA on the
P0 PR branch, with check.yml still unmodified.

- Head SHA: `098abe2e4afbc7f43b03fa74a654280cda0a3e3d` (PR
  [#321](https://github.com/beep-effect/beep-effect/pull/321))
- check.yml run (unmodified, pull_request event): run `28904708899`
- ci-lane-shadow run (push event on the same SHA — workflow_dispatch
  cannot target a workflow absent from the default branch, so the
  shadow fires on push to the P0 branch, which is the same head SHA the
  pull_request run executes): run `28904706866`
- Verdicts: **both runs SUCCESS** (attempt 2 re-ran only the two
  infra-cancelled jobs; every lane job green on the same SHA).

| Lane | check.yml verdict | Shadow verdict | CLI-echoed command (shadow log) |
|---|---|---|---|
| Lint | success | success | `bun run lint -- --affected --summarize` ✔ |
| Lint Policy | success | success | `bun run beep lint policy` ✔ |
| Repo Sanity | success | success | `bun run audit:github repo-sanity` + `bun run changeset:status:since-main` ✔ |
| Check | success | success | `bun run check -- --affected --summarize` ✔ |
| Test Unit | success | success | `bun run test -- --unit --types --affected --summarize` ✔ |
| Test Integration | success | success | `bun run test -- --integration --affected --summarize` ✔ |
| Coverage Regression | success | success | `bun run coverage -- --affected --summarize` ✔ |
| Docgen | success | success | `bun run docgen:local -- --base origin/main --head HEAD --parallel=3` ✔ |
| Codegen Drift | success | success | `bun run --cwd packages/drivers/ecfr generate` + `git diff --exit-code -- packages/drivers/ecfr/src/_generated packages/drivers/ecfr/openapi.json` ✔ |
| Professional Desktop IPC Stdio | success (path filter: skip) | success (path filter: skip) | n/a (both skipped for this change set) |
| Fallow Advisory Envelopes | success | success | `bun run beep quality fallow <lane> --check/--advisory --base origin/main --out .beep/fallow/<lane>.json --quiet` ✔ |
| Knip | success (attempt 2 after infra cancel) | success | `bun run beep quality knip` ✔ |
| JSDoc Ratchet | success | success | `bun run beep quality jsdoc-inventory` + `bun run beep quality jsdoc-ratchet` ✔ |
| Commitlint | success | success (attempt 2 after infra cancel) | `bunx commitlint --from <merge-base> --to HEAD --verbose` ✔ |
| Nix Shell | success | success | `nix --option warn-dirty false flake check --all-systems` + `nix --option warn-dirty false develop --command echo Dev shell OK` ✔ |
| SAST | success | success | `bun run beep quality github-checks sast` ✔ |

**Row 1 verdict: PROVEN.** Same lane set, same commands (CLI-echoed in
the shadow logs, matching check.yml's bodies verbatim), same verdicts,
on the same head SHA, before any thinning.

Attempt-1 note (S4 evidence, observed live): both runs completed with
exactly one *infra-cancelled* job each — `Knip` on the check.yml run,
`Shadow: Commitlint` on the shadow run — while every other job
succeeded (~23:07Z window; unrelated jobs, likely a runner incident).
The whole-run conclusion flips to `cancelled` off a single job, which
is precisely the S4 "benign supersession vs infra cancellation"
distinction: these were NOT concurrency supersessions (no newer run on
the ref). Recovery: `gh run rerun <id> --failed` re-ran only the
cancelled jobs on the SAME SHA (attempt 2).

Excluded by class (parity by identity — workflow bodies unchanged):
PR Size Label, Secret Scanning, Security (OSV + dependency-review).
Excluded by event: Build (push-only; body exercised via `beep ci lane
build` in the local battery).

## 2. Local verdict parity fixtures (matrix row 2)

Fixture table: `../research/local-verdict-parity-fixtures.md`.
Fixture branch: `goals/one-round-loop-p0-parity-fixtures` (never merged).

- Draft PR: [#322](https://github.com/beep-effect/beep-effect/pull/322)
  (never merged; branch built via `beep worktree new` — bootstrap incl.
  bun install 7.3s, an S3 data point).

**Round 1** (fixtures commit f12bd3cf96 + bad-message commit
a9a5f2c147): `beep ci local --affected` from the worktree — **15/19
lanes FAIL exactly as seeded** (commitlint, repo-sanity, lint-policy,
lint, check, codegen, knip, secrets, build, test-unit,
test-integration, coverage, desktop-ipc, fallow, nix). Four injections
MISSED their gate (all fixture-design errors, each itself a documented
gate-semantics finding):

1. `jsdoc-ratchet` PASS — adding an *undocumented* export does not
   reduce documented totals; the ratchet guards documented-count
   regression. Amended: strip the JSDoc from an existing documented
   export (`internal/cli/Printer.ts` `printLines`).
2. `sast` PASS — semgrep's eval rule deliberately ignores
   literal-argument `eval("...")`. Amended: dynamic argument
   (`eval(globalThis.process.argv.join(" "))`).
3. `security` PASS — removing one `[[IgnoredVulns]]` block did not
   surface a finding (the ignore appears stale against the current
   lockfile — itself a finding worth an ignore-hygiene sweep). Amended:
   removed ALL ignore blocks.
4. `docgen` PASS — the broken `@example` sat on a non-barrel internal
   module, outside the compiled docs surface. Amended: seeded a broken
   example on a barrel-exported symbol (`Ci.errors.ts`).

**Round 2** (amendments commit 736e054e3f): local battery — 16/19 FAIL
(security ✔ and docgen ✔ amendments now fire; codegen flipped to PASS —
round 1's battery had regenerated the ecfr file in the worktree and the
amendments commit swept the clean copy, silently un-seeding the row).
CI: **INVALID as lane verdicts** — the `"@beep/chalk": "0.0.1"`
repo-sanity injection broke `bun run install` in every job's
setup-monorepo-ci step ("@beep/chalk@0.0.1 failed to resolve"), so all
jobs failed BEFORE their gates. Structural findings:

- An unresolvable manifest injection fails hosted CI at setup while the
  local battery (pre-installed tree, no install step) runs real lane
  semantics — the local battery does not validate installability;
  CI does. (The pre-existing repo-sanity syncpack/sherif gates would
  have caught the desync anyway.)
- Only jobs that skip setup-monorepo-ci gave genuine round-2 CI
  verdicts: Secret Scanning FAIL ✔ (seeded AKIA key), Nix Shell FAIL ✔
  (broken flake), PR Size Label pass (ci-native, expected).

**Round 3** (commit ab19e4979c) — amendments, each verified against its
gate locally BEFORE committing (the one-round discipline applied to the
fixture branch itself):

- repo-sanity: tsconfig reference desync (fires `config-sync:check`;
  resolvable manifest untouched → installs work).
- jsdoc-ratchet: docs stripped from BARREL-EXPORTED symbols
  (`runCiLane`/`runCiLocal`) — verified ratchet exit 1. Gate-semantics
  finding: the ratchet (like docgen) audits the barrel-exported
  surface; stripping internal/non-barrel docs moves nothing.
- codegen: drift marker re-committed (regen-overwrites-marker →
  diff-vs-HEAD fails; proven in round 1).
- sast: NO locally-constructible failing fixture found — literal eval,
  dynamic eval, dynamic execSync, and an embedded RSA PEM all pass the
  unauthenticated semgrep registry subset (125 rules total; p/secrets
  = 41). Filed as a SAST-hardening task. Row parity rests on
  structural identity (the local lane runs the byte-identical CI
  command, per the D9 echo evidence) with expected PASS/PASS.

Round-3 verdict table: _pending (local battery + CI on ab19e4979c)_.

## 3. Lane inventory single-sourcing (matrix row 3)

- `bun run beep ci lane --list` emits all 21 descriptors (19 runnable +
  pr-size + dependency-review) with class/replay/flags — verified by
  `packages/tooling/tool/cli/test/ci-lane.test.ts` (descriptor suite:
  21 entries, unique ids, frozen 17 required-context set).
- check.yml body thinning (orl-003, PR B): every cli-runnable /
  workflow-gated body now dispatches `bun run beep ci lane <id>` (16
  dispatch sites); the remaining case block carries only event-shape
  flags; ci-native jobs (pr-size, secrets, security) untouched; all 20
  context names unchanged (fence 2); the temporary shadow workflow is
  removed with the proof recorded above. Workflow-side environment
  addition: the Nix job now runs setup-monorepo-ci on PR events too
  (the lane dispatch needs bun; the nix commands themselves are
  unchanged).

## 4. Dogfood ledger (D4) — P0 PR

- Packet-authoring PR [#319](https://github.com/beep-effect/beep-effect/pull/319):
  docs-only; pre-P0 (no `beep ci local` yet); typos + packet hygiene
  proof; CI rounds: **1** (all 17 required checks green first round).
- P0 PR: `bun run beep ci local` (full battery) run from this branch
  before push: _pending log reference_.

### Pre-push battery round 1 (2026-07-07, failed → fixed locally)

The first full-battery run against the P0 branch itself caught four
defect classes locally — each would previously have been a CI round:

1. `lint-policy` / schema-first: exported pure-data alias
   `CiLaneRunOptions` → remodeled as an annotated `S.Class`.
2. `lint-policy` / dual-arity: `ciLaneStepsForTesting` (3 positional,
   not dual) and `ciLocalStepsForTesting` (4 positional) → both made
   `dual(3)`; the local-battery shape folded into a `CiLocalStepPlan`
   schema.
3. `lint-policy` / terse-effect: conditional optional-object spread →
   `O.getSomesStruct`.
4. Stale `standards/schema-catalog.generated.jsonc` (new Ci schemas) →
   regenerated via `lint schema-catalog --write`. NOTE: this gate is
   currently reachable only via `beep lint schema-catalog` — no CI lane
   runs it (observed while fixing; out of P0 scope).

Notable: the earlier bounded loop (`github-checks review-fix`, affected
lint) did NOT catch 1–3 — affected-mode lint suppresses repo-wide
policy steps, exactly the Lint-Policy shape delta in the parity table.

Operational lesson re-learned: a foreground `laws terse-effect --check`
probe ran concurrently with the battery's check lane and coincided with
a turbo child-process spawn failure (PlatformError) plus a possibly
spurious `@beep/xai` TS2589 — round 2 runs with zero concurrent
commands to get a clean signal.

### Pre-push battery round 2 (2026-07-07, clean run)

**18/19 lanes green** in ~16.4 min serial wall time (warm turbo caches;
well under the D8 ~40-min budget). Round 1's `check` failure did not
reproduce (contention artifact confirmed). Per-lane: commitlint 1s,
repo-sanity 22s, lint-policy 65s, lint 62s, check 125s, codegen 3s,
knip 12s, jsdoc-ratchet 169s, secrets 4s, sast 7s, security 6s,
build 39s, test-unit 154s, test-integration 71s, docgen 26s,
desktop-ipc 5s, fallow 64s, nix 3s — coverage FAILED (146s).

**Coverage lane finding (pre-existing, not this branch):** full-shape
coverage is red EVERYWHERE right now, with two distinct first-failures:

- Local: `@beep/oip-web` 39/48 tests fail in `beforeEach`
  (`window.localStorage` undefined under the coverage lane's plain-node
  vitest); passes under the bun-runtime test lane. Filed as a spawned
  task (local env wiring, product scope — fence 4 bars fixing it here).
- Hosted CI on main (push runs 28901536716 @ ae39301d8f and
  28883862875 @ 5783560ecd): `@beep/lexical-schema`
  `Lexical.model.test.ts` fails 1/22 — the SAME suite passes locally
  22/22. Nondeterministic on a REQUIRED check: main is known-red. This
  is (a) live motivating evidence for the P1 seed-dependent property
  class and (b) the S4 quarantine scenario occurring in the wild. Filed
  as a spawned task.

**PR-shape verdict (what CI will render for this PR):**
`beep ci lane coverage --affected --base origin/main` → GREEN
(`[coverage-ratchet] ok: compared 1 package(s) with epsilon 0.001`).
Neither oip-web nor lexical-schema is in this PR's affected graph.

Dogfood disposition per SPEC stop-condition handling (file it, ledger
it, continue): the battery FAITHFULLY reproduced the red full-coverage
verdict (that is the fidelity property working — the old pre-push
battery had no coverage lane at all and would have shown green), the
red is demonstrably pre-existing and out of packet scope, and the
PR-shape gate is green. Proceeding to push with this note as the
ledger entry.

## 5. Post-merge findings (PR A → main, 2026-07-07T23:40Z)

PR [#321](https://github.com/beep-effect/beep-effect/pull/321) merged
green in ONE CI round. Main's post-merge PUSH run (on 3709c435f3) then
went red on two jobs — neither a code defect:

1. **Commitlint / squash-subject class (NEW).** The squash-merge
   subject comes from the PR TITLE — validated by NO gate anywhere
   (branch commits pass the commit-msg hook and the PR Commitlint
   check; the title is checked only when it detonates on the main push
   run). PR A's title used sentence-case "P0 CI-lane inversion" →
   `subject-case` violation on main. Remediation adopted immediately:
   conventional-lowercase PR titles (PR C, #324). Candidate durable
   fix for the closeout: title linting in `yeet publish --pr` /
   `ensurePullRequest`.
2. **Lint / third infra cancellation (S4).** exit 130, "operation was
   canceled" mid-lane with no superseding run — same class as the two
   D9 attempt-1 cancels.

## 6. Dogfood ledger (running)

| PR | Content | Local proof | CI rounds |
|---|---|---|---|
| [#319](https://github.com/beep-effect/beep-effect/pull/319) | packet authoring (docs) | pre-P0: hygiene + typos | **1** ✔ |
| [#321](https://github.com/beep-effect/beep-effect/pull/321) (PR A) | lane CLI + shadow | full battery (2 local rounds; round 1 caught 4 classes) | **1** ✔ (plus 2 infra-cancel reruns, not gate rounds) |
| [#323](https://github.com/beep-effect/beep-effect/pull/323) (PR B → P0 branch) | thinning + evidence | `--fast --affected` 16/16 | n/a (merged into P0 branch; no main CI) |
| [#324](https://github.com/beep-effect/beep-effect/pull/324) (PR C) | thinning → main | same content as PR B (16/16) | _pending_ |
