# GOAL: land slice 1 of the model routing sync

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a `Models` command group in `@beep/repo-cli` whose schemas decode the
live upstream model catalog, `$HOME/.codex/models_cache.json`, and
`cursor-agent models`, and whose `check` run prints routing drift for every
declared target. Read-only: slice 1 has no write path at all (R12).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/model-routing-sync/README.md`
- `goals/model-routing-sync/SPEC.md`
- `goals/model-routing-sync/PLAN.md`
- `goals/model-routing-sync/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and
`goals/model-routing-sync/research/2026-09-22-00-aligned-design.md` (rulings
R1-R12; cite them as `(Rn)`). Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Models/**`, its registration in
  the CLI root, tests for it, and this packet. A `model-ids` lane under
  `commands/Lint/` is a later slice.
- Out: any `--write` path (slice 2); other products' configs
  (`$HOME/.config/semantica/runtime.env`, `$HOME/.config/muse/settings.json`,
  `$HOME/.claude-mem/settings.json`) which are opt-in later; agent memory
  files; gold fixtures and `packages/**/test/**` parsing fixtures; packet
  prose rewrites.

Workflow:

1. Inspect the referenced files and the current repo state.
2. Design order is schema -> `Context.Service` contract -> implementation.
   `LiteralKit` for roles, surfaces, providers, and effort levels;
   `HashMap`/`HashSet` only; never a plain `Set`/`Map`.
3. `home` is a parameter, never `os.homedir()` at a call site.
4. Make the smallest change that satisfies `SPEC.md`; cite rulings as `(Rn)`.
5. Preserve unrelated user/worktree changes.
6. Prose naming the not-yet-registered command uses the bare `beep models
   check` form until it exists.
7. Update packet evidence/status if readiness changes.
8. At P4 Close, write the closeout reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] The schemas decode the live upstream `models.json`, the Codex cache, and
      `cursor-agent models` output without loss.
- [ ] `check` prints drift for every declared target, including the seven known
      live conflicts in `SPEC.md`, and exits non-zero on drift.
- [ ] No write path exists; the command cannot mutate any file.
- [ ] `SPEC.md` slice-1 acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
bun run beep quality package-verify @beep/repo-cli --quick
jq . goals/model-routing-sync/ops/manifest.json
git diff --check -- goals/model-routing-sync
test "$(wc -m < goals/model-routing-sync/GOAL.md)" -le 4000
```

Stop and report before changing public API, dependencies, lockfiles, generated
files, or destructive state unless `SPEC.md` explicitly requires it. Never
write to a file under `$HOME` in this slice.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
