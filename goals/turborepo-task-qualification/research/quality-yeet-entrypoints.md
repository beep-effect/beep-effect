# Quality and Yeet execution boundaries

Observed 2026-09-09. This review describes existing planners and interpreters.
It does not change their proof authority or execute a planned command.

## Reproducible plans

The [recipe](./refresh-yeet-plans.ts) uses the current identity manifest and
existing `BuildYeetRunPlanTestOptions`, `RepoRunPlan` and Quality profile models.
It retains full options, steps, environments, waves and verification labels.
Two illustrative Git contexts cover `main` and a feature branch. Each has
15 mode/option scenarios. The four supplied identity tasks are real manifest
scripts, but this example is not the complete runtime-selected task population.

```sh
env -i PATH="$PATH" HOME=/nonexistent \
  bun --no-env-file goals/turborepo-task-qualification/research/refresh-yeet-plans.ts
env -i PATH="$PATH" HOME=/nonexistent CI=true GITHUB_ACTIONS=true \
  bun --no-env-file goals/turborepo-task-qualification/research/refresh-yeet-plans.ts
```

The [local](./yeet-plans.json) and [hosted-context](./yeet-plans-hosted.json)
snapshots each contain 30 plans and three explicit hardware examples. Both
were generated locally with dotenv loading disabled. Paths and branch names
are illustrative; no proof store, secret, remote API or live hardware probe is
read by the recipe. Its calls encode plans; they do not run their Git, install,
quality, publication or hosted-check steps.

## Planner and interpreter distinctions

| Boundary | Existing behavior | Census implication |
| --- | --- | --- |
| Repair | Plans Effect-law/config writes, cheap gates, lint fixes, documentation generation and filtered build/check/lint/test feedback. Test feedback adds `--unit`. | Writes and downstream commands belong in the computation record. The feedback planner selects task names and packages from the supplied Turbo graph; it does not prove that each graph node has an executable script. |
| Full, cheap and review-fix verification | Full includes cheap gates and pre-push waves; cheap has only its smaller gate set. Review-fix defers affected selection to the interpreter. Feature-branch full proof includes changeset status, while `main` omits it. | Tier, branch, base/head and dynamic selection affect scope. An empty static review-fix wave list means unresolved runtime planning, not proof of no work. |
| CI parity and forced Turbo | CI parity selects affected local CI with explicit `CI`, `GITHUB_ACTIONS`, local cache and log-order environment. Forced Turbo adds `TURBO_FORCE=true` to relevant feedback/full Bun steps. | Preserve explicit environment and verification posture. These options are not equivalent to the default full plan. |
| Full-proof and head-install interpreter | Verification runs its proof phase and records verified state only after success. Head-install preflight runs in a detached clean checkout. Merged verification uses an isolated committed merge preview. | Working tree, committed HEAD and installed merge preview are distinct inputs. A source plan alone proves none of these executions or their success. |
| Publication variants | Standard publication sequences commit, local proof, CI parity, head-install preflight and push/optional PR work. Early publication moves push/PR work before proof. Push-only omits the new commit/proof steps. Fast publication with monitoring omits local full proof and CI parity from this plan. | Preserve mode, flags and step ordering. These are descriptions of existing modes, not authorization to publish or permission to replace required hosted proof. |
| Pre-push hook | The pure run plan has no steps. Its handler separately validates the pushed SHA against current HEAD and dispatches full proof. | An empty generic plan is not an empty executable entrypoint. The handler must remain in the census. |
| Status, monitor and closeout | Read Git/PR state, watch checks and query review gates through existing GitHub routes. | Live network state is an input. A cached task result cannot establish the current remote head, required checks or review state. |

Source review covers the existing `Yeet/internal/Planner.ts` and `Handler.ts`.
The runtime handler can choose verified-state reuse, merged verification or a
mode-specific path not represented by one illustrative pure plan. Remaining
handler dependencies and actual runtime reads still need census integration.

## Lane-proof reuse is a separate layer

`Quality/internal/LaneProofReuse.ts` implements `off`, `shadow` and `active`
lane-proof modes. The key includes the lane ID, command/arguments/explicit step
environment and local-env-file choice, the input identity, virtual tree,
HEAD/base and a runtime environment profile. That profile includes platform,
architecture, Bun/Node version values and selected CI, Turbo, Docgen, property
test and Node-options variables. This layer does not itself bind executable
SHA-256 pins required by the task qualification contract.

The virtual tree is computed with a temporary `GIT_INDEX_FILE`, using
`read-tree HEAD`, `add -A` and `write-tree`, then cleaning the temporary index.
The reviewed implementation does not intentionally stage the ordinary index.
Command labels marked read-only can still create proof/report artifacts, so
the census must describe actual writes rather than copy the mutability label.

The source excludes `pre-push:security` and `repo-sanity:bun-audit` from lane
reuse because their external vulnerability verdict must be fresh. Other
successful lanes can produce records in `.beep/yeet/lane-proofs.json`. Before
persisting a successful execution, identities are refreshed and must still
match; the store is written atomically. This describes existing local reuse,
not a qualification of its inputs, epoch or producer.

`Quality/Tasks.ts` interprets waves and proof decisions. Active hits produce a
`reused` record without execution; shadow hits still execute. A red lane can
stop later scheduling when the applicable decision is `stop-after-red`;
collect-all and the other continuation cases remain distinct. Skipped later
lanes receive `not-run-early-stop` records. They are not passed executions.
The interpreter persists lane and aggregate reports, including failure/skipped
counts and controlled parent/artifact references. Timing is observed output,
not semantic equality proof.

## Hardware profiles and admission

The three explicit profile examples select `ci`, `current` and `workstation`.
The current policy uses conservative Turbo/Docgen concurrency of three for CI
and the smaller local profile. The workstation example selects eight Turbo
workers, six Docgen workers, one full-proof slot and three review-fix slots.
These planner defaults are distinct from live shared admission capacity and
must not be presented as measured capacity or guaranteed execution parallelism.

## Evidence limits and remaining work

The [checkpoint](./quality-yeet-checkpoint.json) binds reviewed source and the
two generated snapshots. Four clean-context CI/Quality/Yeet snapshots regenerate
byte-identically. Quality snapshots retain all 78 dependency lists per context;
the source supplies no ordering estimates for those examples.

Integrate nested interpreter branches, proof-store selection and artifact writes
into the operational census; finish remaining workflow/action boundaries and
candidate runtime observations. Required hosted proof keeps its existing
owner. No lane proof, Yeet full proof or hosted result has been imported into
the task-qualification ledger by this review.
