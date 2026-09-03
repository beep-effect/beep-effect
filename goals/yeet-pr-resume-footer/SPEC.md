# Yeet PR resume footer Spec

## Objective

Every Yeet PR is a durable bookmark to its originating workspace and agent
sessions, with a number-only resume block that leaks nothing local.

The footer answers, at a glance, which beep-effect clone published the PR and
which agent sessions touched it, and gives the operator one paste
(`bun run beep yeet resume <n>`) that reopens the publishing session on the
publishing workstation. Session identifiers, filesystem paths, and harness
resume commands never enter the PR body; a local registry keyed by repository
and PR number resolves them.

## Non-Goals

- Publishing any session, thread, host, bridge, or companion identifier, or
  any hash, prefix, or truncation of one.
- Publishing any filesystem path or path template, including
  `$BEEP_PROJECTS/<clone>` (rejected in the 2026-09-03 grill; see `DECISIONS.md`).
- Publishing Codex session names (`codex resume <name>` resolves them as keys).
- Cross-machine resume. The registry is workstation-local like the transcripts
  it points at; on a machine without state `yeet resume` exits 4 with a
  `claude --from-pr <n>` hint.
- Resuming a desktop session inside the desktop app. Resume spawns the CLI
  harness in a terminal.
- PR 2 surfaces: `yeet link`, verify/repair ledger rows, re-assertion on
  reply/closeout/merge, Codex-lane `--add-dir` recipe, Codex live guard.

## Source Hierarchy

1. The 2026-09-03 grill decisions in `DECISIONS.md`.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`yeet`, `effect-first-development`,
   `schema-first-development`).
3. Governing architecture/package standards (`standards/architecture/06-configuration-boundaries.md`,
   `07-non-slice-families.md`, `standards/git-worktrees.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts` (schemas,
  projection, renderer, detection).
- New `packages/tooling/tool/cli/src/commands/Yeet/internal/{PrSessionRegistry,ProvenanceFooter,Resume,Resume.schemas}.ts`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/{PullRequest,Monitor,Planner}.ts`,
  `Yeet.command.ts`, `internal/cli/Flags.ts`, `turbo.json` passthrough.
- Tests under `packages/tooling/tool/cli/test/` (`yeet-pr-provenance*.test.ts`,
  registry, footer, resume, command wiring).
- `.claude/skills/yeet/SKILL.md`, `.changeset/yeet-pr-resume-footer.md`,
  `goals/codex-security-findings-2026-08-13/findings/CSF-007.md` (follow-up note),
  `goals/speed-loop/research/OPPORTUNITIES.md` (#79 pointer).

## Constraints

- Schema first, then `Context.Service` contract, then implementation. Literal
  domains via `LiteralKit`; generators via `Effect.fn`/`Effect.fnUntraced`;
  `effect/HashMap` and friends only.
- Environment reaches code only through `Config`/`ConfigProvider` (doctrine 06).
- `renderPrProvenance` accepts only `PublicPrProvenance`; `toPublicPrProvenance`
  is the single projection site; the fence renderer is typed on `PrNumber`.
- The PR body is untrusted input: re-assertion renders from registry rows only
  and never ingests footer content; labels decoded from a footer are matched by
  equality against locally enumerated candidates and never concatenated into a
  path or argv.
- Registry writes are append-only JSONL, non-fatal on failure, mirrored to the
  run directory.
- The mtime transcript heuristic (`findRecentClaudeSession`) is removed; with
  no exact id the harness is `unknown`.
- Validate every Effect API against `.repos/effect` before writing.

## Acceptance Criteria

- [ ] A yeet-created PR body carries the v2 footer: workspace, branch, agent
      ledger (harness, entrypoint, model, label, role), the `bun run beep yeet resume <n>`
      fence, and the schemaVersion-2 JSON twin between start/end markers.
- [ ] A Claude session with `CODEX_COMPANION_*` env and no `CODEX_THREAD_ID`
      renders `claude-code`, not `codex`.
- [ ] `bun run beep yeet resume <n>` resolves the registry, refuses to fork a
      live session (prints window name, workspace, pid), and otherwise execs the
      harness in the recorded session home; `--list`, `--print`, `--force` work.
- [ ] `yeet monitor` appends a `monitored` row and re-asserts a missing or
      drifted footer for any PR it monitors.
- [ ] The boundary property test proves the rendered body contains no path,
      env template, `cd`, harness resume command, UUID, or ≥16-hex run, and
      exactly one fence matching `^bun run beep yeet resume [1-9][0-9]*$`.
- [ ] CSF-007 carries a dated follow-up section with the False-positive rebuttal.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Package gate | `bun run beep quality package-verify @beep/repo-cli` | Passes (run with `op` off PATH) |
| Docgen | `bun run docgen:local` | Passes |
| Focused tests | `cd packages/tooling/tool/cli && bunx --bun vitest run test/yeet-pr-provenance*.test.ts test/yeet-pr-session-registry.test.ts test/yeet-resume.test.ts` | Green |
| Live footer | PR body of this packet's own PR | v2 footer present after publish and after monitor |
| Packet launcher size | `test "$(wc -m < goals/yeet-pr-resume-footer/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/yeet-pr-resume-footer/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/yeet-pr-resume-footer` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Codex sandboxed lanes cannot write the XDG registry | `codex exec -s workspace-write` | PR 2 | Sandbox denies `~/.local/state`; append is non-fatal and mirrored to the run dir | PR 2 lane recipe adds `--add-dir <state root>` |
