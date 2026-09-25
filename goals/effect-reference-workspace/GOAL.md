# GOAL: consolidate Effect reference clones into a graft workspace

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `~/YeeBois/references/effect/` holds `effect` and `effect-tsgo`,
indexed by graft in workspace mode with a nightly `claude-opus-5` deep refresh,
and every beep checkout (clones and worktrees) reaches it through
`.repos/effect`, `.repos/effect-tsgo`, and `.repos/effect-workspace`, provisioned
from a checked-in `scripts/references.json`.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/effect-reference-workspace/README.md`
- `goals/effect-reference-workspace/SPEC.md`
- `goals/effect-reference-workspace/PLAN.md`
- `goals/effect-reference-workspace/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, the `graft` skill, and
`goals/effect-reference-workspace/research/2026-09-25-00-aligned-design.md`
(rulings R1-R14; cite them as `(Rn)`). Repo standards outrank packet prose.

Scope:

- In: `scripts/references.json`, `scripts/setup-effect-ref.sh`,
  `packages/tooling/tool/cli/src/commands/Refs/**`, the `linkReferences` step in
  `commands/Worktree/Worktree.command.ts`, their tests, `.claude/settings.json`
  permissions, the R13 docs sweep, and this packet. The operator move (PLAN S4)
  runs only with the operator present.
- Out: `--follow-nested-repos`, `graft init`, MCP; effect-smol, t3code,
  opencode; `$HOME` files beyond timer units, status file, `.repos/*` links;
  `explorations/**` and `goals/**` prose; the nix-bun/DuckDB clash (prepend the
  mise bun instead).

Workflow:

1. Inspect the referenced files and repo state.
2. Design order: schema -> `Context.Service` -> implementation.
   `LiteralKit` for tiers and outcomes; `HashMap`/`HashSet` only; `Effect.fn`;
   `home` is a parameter, never `os.homedir()` at a call site.
3. Implement PLAN S1, S2, S3 as Codex `gpt-6-astra` medium lanes; Fable
   orchestrates (R11).
4. Reference clones are pull-only: `--ff-only` on `main`, skip and report
   dirty or off-branch members, exclude `graft/` via `.git/info/exclude` (R3).
5. Never run `graft build --deep`, `beep refs refresh`, or a fresh
   `install-timer` from an agent session; S4 step 7 is the one sanctioned
   `systemctl --user start` (R10).
6. Preserve unrelated user/worktree changes; cite rulings as `(Rn)`.
7. Update packet evidence/status if readiness changes.
8. At P4 Close, write the closeout reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `scripts/references.json` decodes; provisioner is idempotent and creates
      the three links; `beep worktree new` creates them too.
- [ ] `beep refs plan` is read-only; `install-timer` renders 03:30 units with
      `--refresh` and `--uninstall`.
- [ ] After S4: `graft/workspace.json` lists both members, `graft check`
      passes, `graft ask` via `.repos/effect-workspace` returns `[effect/]`
      hits, fleet census shows zero missing links, no member `.gitignore`
      changed.
- [ ] R13 sweep done; no live file names `YeeBois/dev/effect`.
- [ ] `SPEC.md` acceptance criteria are satisfied; no unrelated refactors or
      formatting churn.

Verification:

```sh
bun run beep quality package-verify @beep/repo-cli --quick
bun run --cwd packages/tooling/tool/cli test -- test/setup-effect-ref.test.ts test/worktree-fleet.test.ts test/refs-*.test.ts
test "$(wc -m < goals/effect-reference-workspace/GOAL.md)" -le 4000
git diff --check -- goals/effect-reference-workspace
```

Stop and report before moving clones with uncommitted work, when
`git worktree repair` fails, when the proxy lacks `claude-opus-5`, or before
changing public API, dependencies, or destructive state unless `SPEC.md`
requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
