# GOAL: ship beep goals doctor, index, and set-status

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `goals/` lifecycle is machine-truthful — a canonical `GoalManifest`
v2 schema with a 5-state status domain, all manifests migrated, a generated
`goals/INDEX.md` with drift check, and a `beep goals doctor` that diffs
manifest claims against git evidence — all blocking inside `yeet verify`.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/goals-doctor/README.md`
- `goals/goals-doctor/SPEC.md` (locked decisions D1-D7)
- `goals/goals-doctor/PLAN.md` (phases P0-P5, each with an oracle)
- `goals/goals-doctor/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and standards named by
`SPEC.md`. Repo standards outrank packet prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Goals/` (new command group);
  `commands/Lint/ReflectionArtifact.ts` (canonical completed set);
  `commands/Quality/Tasks.ts` (yeet verify wiring); `goals/*/ops/manifest.json`
  + packet README `Lifecycle:` lines (mechanical migration only);
  `goals/INDEX.md`; `goals/README.md` snapshot + Lifecycle sections (D8);
  `goals/goals-doctor.baseline.jsonc`; `goals/_template`.
- Out: `goals/_archive/` moves; cron/scheduled automation
  (portfolio-heartbeat follow-up); explorations tooling beyond an advisory
  check; packet triage beyond mechanical migration; new workspace packages.

Postconditions (all must hold):

- Every `goals/*/ops/manifest.json` decodes as `GoalManifest`; status is one
  of `active | paused | completed-retained | superseded | reference`.
- `bun run beep goals index --check` and `bun run beep goals doctor` exit 0
  and run inside `yeet verify`.
- `beep goals set-status <slug> <status>` atomically updates manifest +
  README status line + INDEX.
- A synthetic drift fixture proves doctor exits 1 on new findings.

Forbidden actions:

- Do not delete or rewrite packet evidence prose during migration.
- Do not close, park, or triage other packets beyond what `--migrate`
  mechanically requires; park unmappable manifests with a recorded question.
- Do not add network calls, new workspace packages, or hand-edits to
  generated `INDEX.md`.

Workflow:

1. Execute `PLAN.md` phases in order (P0→P5); smallest change per phase.
2. Paste each phase oracle's actual output into `history/` at phase close.
3. Preserve unrelated user/worktree changes.
4. Land through `bun run beep yeet` (repair → verify → publish → monitor).
5. At P5 Close, write the reflection (frontmatter gotchas: quote the date,
   block scalars for long text) and close the packet with the new
   `beep goals set-status` command itself.

Verification:

```sh
test "$(wc -m < goals/goals-doctor/GOAL.md)" -le 4000
jq . goals/goals-doctor/ops/manifest.json
bun run beep goals doctor
bun run beep goals index --check
bun run beep lint reflection-artifacts
```

Stop and report before changing public API, dependencies, lockfiles, security
behavior, or destructive state unless `SPEC.md` explicitly requires it.

Done only when the postconditions hold with green verification, or a blocker
is reported with file/command evidence.
