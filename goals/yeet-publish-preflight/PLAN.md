# PLAN — Yeet Publish Preflight

Sequenced execution for `SPEC.md`. One writer at a time; Fable reviews
between phases.

## P0 — Probe

- Read `internal/Guards.ts`, `internal/Handler.ts`, `internal/PullRequest.ts`,
  and the publish plan-step declarations; map where
  `publish:02-pr-create`, the pre-push proof lanes, and the monitor phase
  are wired.
- Run the `--start-pr-early` probe matrix from `SPEC.md` (plan mode first:
  `bun run beep yeet publish --start-pr-early --monitor --message "t: t"
  --plan --json` on a scratch branch; real runs only where safe).
- Record observed behavior in `research/SOURCES.md` (file:line +
  command output excerpts). Decide fix shape per SPEC's required end state.

## P1 — Implement

- Preflight step (SPEC Fix 1): plan step + handler wiring + verify full
  tier + failure-packet hint.
- Circular-gate fix (SPEC Fix 2): guard-time validation + hint, matching
  the P0 evidence.
- Unit tests in `packages/tooling/tool/cli/test/yeet.test.ts` (existing
  idioms; cover: preflight step present in publish and verify plans,
  preflight failure surfaces the hint, guard rejects
  `--start-pr-early --monitor` without `--pr` on a PR-less branch, guard
  passes with `--pr`).
- Skill doc + changeset.

## P2 — Verify

- `npx vitest run` scoped to the CLI package's yeet tests.
- Live negative probe: scratch branch, intentionally desynced committed
  `bun.lock` (e.g. commit a lockfile edit that frozen-install rejects) →
  publish fails in the preflight step with the hint, before any push;
  restore → publish plan proceeds past the step.
- `bun run beep yeet verify --plan --json` shows the preflight step in the
  full tier.

## P3 — Yeet: PR to mergeable

- Stage scoped paths; `bun run beep yeet publish --pr --message
  "feat(repo-cli): frozen-lockfile clean-HEAD publish preflight"`.
- Monitor hosted checks; closeout gates (greptile 5/5, 0 unresolved
  threads); merge on user's call.

## P4 — Close

- `/reflect yeet-publish-preflight` (reflectionRequired: true);
  `bun run beep lint reflection-artifacts` green.
- Manifest → completed-retained; `bun run beep goals index --write`.

## P3 Closeout Checklist

- [ ] Reflection written and lint-green.
- [ ] Manifest statuses flipped with evidence lines in README.
- [ ] goals/INDEX.md regenerated.

## Execution evidence (2026-07-14)

- P0 complete: the exact plan probes both stopped at the sandboxed
  `origin/main` refresh (exit 255). With `--base HEAD`, both plans exited 0;
  only the explicit-`--pr` form inserted `publish:02-pr-create` before proof
  and monitor. Full observations and pre-change file:line evidence are in
  `research/SOURCES.md`.
- P1 complete: added `publish:00-head-install-preflight` to verify full and all
  publish push paths, guaranteed worktree removal/prune, standard failure
  packets and repair hint, per-lane `durationMs`, the static add-`--pr` guard,
  unit coverage, skill documentation, and a patch changeset.
- P2 complete locally: CLI Yeet Vitest suite passes (1 file, 77 tests), CLI
  tsgo passes, the exact missing-`--pr` plan probe fails at guard time, and a
  local-base full-tier plan contains the preflight. The exact default-base plan
  remains blocked before rendering because this sandbox cannot update Git refs.
- Operator pending: the SPEC's live negative probe using a scratch branch with
  an intentionally desynced committed lockfile is intentionally deferred per
  the implementation-lane instruction. The unit negative probe covers failure
  hinting and cleanup without any push or GitHub write.
