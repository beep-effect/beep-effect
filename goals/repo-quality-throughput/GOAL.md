# GOAL: Implement End-to-End Green Speedups

Repo: this `beep-effect` checkout.

Outcome: implement every viable repo-quality performance task identified by the
completed throughput research, prove the wins, and publish a mergeable PR.

This is an implementation-only `/goal` launcher. Do not run new research
batches. Treat existing `research/` and `history/` files as evidence.

Read first:

- `goals/repo-quality-throughput/README.md`
- `goals/repo-quality-throughput/SPEC.md`
- `goals/repo-quality-throughput/PLAN.md`
- `goals/repo-quality-throughput/tasks/tasks.jsonc`
- `goals/repo-quality-throughput/research/repo-exports-sharding-design.md`
- `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`
- `standards/architecture/07-non-slice-families.md`
- `standards/architecture/08-testing.md`
- `.patterns/jsdoc-documentation.md`

Active implementation order:

No selected implementation task remains. Continue with final proof, publish,
PR checks, and review closeout.

Completed guardrails and implementation tasks: `rqt-001`, `rqt-002`,
`rqt-003`, `rqt-004`, `rqt-005`, `rqt-006`, `rqt-007`, `rqt-008`, and
`rqt-009`; `rqt-010` carries bounded prototype gate and waiver evidence.
Rejected stale work: `rqt-011` and `rqt-012`.

Rules:

- Implement code/config/workflow changes; do not stop at planning or reports.
- Defer only with concrete blocker evidence, owner, fallback proof, and a
  waiver record in `tasks/tasks.jsonc`.
- Keep repo-owned quality behavior in `@beep/repo-cli`, `@beep/repo-utils`,
  `@beep/repo-codegraph`, Turbo/workflow config, Lefthook, or package
  manifests. Do not add durable root scripts for tooling-owned behavior.
- Preserve authoritative proof, GitHub check names, secrets/SAST/security/Nix
  coverage, and manual quality lanes.
- Yeet fast-plus-monitor stays opt-in and PR-branch-only until its proof gates
  and agent guidance are complete.
- Use bounded resources: focused local checks, one heavy local lane at a time,
  and GitHub Actions for repeated full proof.

Done means:

- At least one major measured bottleneck is structurally improved.
- All viable selected tasks are done or carry blocker-quality waiver records.
- `bun run lint:fix` remains fast.
- Canonical local quality proof passes or has documented unrelated failure
  evidence.
- The branch is committed, pushed, PR checks are monitored, actionable review
  comments are addressed, and the PR is mergeable.

Packet verification:

```sh
test "$(wc -m < goals/repo-quality-throughput/GOAL.md)" -le 4000
jq . goals/repo-quality-throughput/ops/manifest.json
jq . goals/repo-quality-throughput/tasks/tasks.schema.json
git diff --check -- goals/repo-quality-throughput
```
