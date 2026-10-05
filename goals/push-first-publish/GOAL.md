# GOAL: Push-First Publish

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `bun run beep yeet publish` gates a push on cheap-gates plus the
head-install preflight only, pushes, opens a draft PR with `ready-for-heavy`,
submits the detached readiness monitor, and exits. Hosted CI and reviewers are
the authoritative proof. Agents never wait on the local admission queue to
publish.

This is a compact `/goal` launcher. Treat the packet files as the contract:

- `goals/push-first-publish/SPEC.md` — decisions D1–D10 (locked), surfaces,
  acceptance, verification.
- `goals/push-first-publish/PLAN.md` — ordered work items P1–P4.
- `goals/push-first-publish/ops/manifest.json`

Read those first, then `AGENTS.md`, the `yeet` skill, and the
schema-first-development and effect-first-development skills.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Yeet/**` (Planner, command,
  schemas, Guards, MonitorPolicy, WatchMode, new `ready` subcommand), its
  tests, `.claude/skills/yeet/SKILL.md`, the `AGENTS.md` Quality Operator
  bullet.
- Out: the admission scheduler, `yeet verify` tiers, hosted workflows, branch
  protection, merge automation.

Workflow:

1. Schemas first: flags `proveFirst`, `noPr` added; `fast`, `startPrEarly`
   removed; `pr` defaults true; monitor terminal `ready-pending-flip`;
   `YeetReadyOptions`.
2. Planner `publishSteps` default: fallow advisory → commit → cheap-gates →
   head-install preflight → push → draft PR + label → detached monitor submit.
   `--prove-first` reproduces the old plan exactly.
3. Guards, draft PR create step, monitor verdict, `yeet ready` (D10 gate).
4. Tests, then `bun run beep quality package-verify @beep/repo-cli`.
5. Doctrine: rewrite the yeet skill sections named in `PLAN.md`; delete "Fast
   Plus Monitor" and "Start PR Early"; amend the `AGENTS.md` bullet.
6. Publish this PR through the new default path from the lane as the live
   proof. Record reviewer behaviour on the draft in
   `research/draft-reviewers.md`.
7. Close: `/reflect`, `bun run beep lint reflection-artifacts`, flip manifest
   in the same PR.

Acceptance:

- [ ] All `SPEC.md` acceptance criteria pass.
- [ ] `--fast` and `--start-pr-early` are unknown flags.
- [ ] No prose states "full proof before publish" as a rule.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/push-first-publish/GOAL.md)" -le 4000
jq . goals/push-first-publish/ops/manifest.json
git diff --check -- goals/push-first-publish
bun run beep quality package-verify @beep/repo-cli
```

Stop and report if draft PRs receive no reviewer or hosted signal, if the
change would touch the scheduler contract, or if the same blocker repeats.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
