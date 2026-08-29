# GOAL: Unified AI Toolchain retained outcome

Repo: `beep-effect` (`kriegcloud/beep-effect` on GitHub).

Outcome: retain the shipped V1 AI-sync schema truth layer. V2/V3 are recorded
won't-do-until a real agent-config drift incident; this launcher does not
authorize their implementation.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/unified-ai-toolchain/README.md`
- `goals/unified-ai-toolchain/SPEC.md`
- `goals/unified-ai-toolchain/PLAN.md`
- `goals/unified-ai-toolchain/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and governing standards
named by `SPEC.md`. Higher-priority repo standards outrank packet prose.

Scope:

- In: `goals/unified-ai-toolchain`, `packages/tooling/library/ai-sync`,
  `packages/tooling/tool/cli`, root scripts when needed, and the AI-sync
  scheduled workflow under `.github/workflows`.
- Out: V3 native file emission, `.ai-sync/project.jsonc` as a required source,
  additional-agent expansion, secret resolution, plugin installation, runtime
  agent control, and undocumented native-shape invention.

Workflow: preserve the V1 evidence and the known recorded drift for
`claude-code-settings`, `rulesync-config`, and `rulesync-mcp`. Reopen V2 only
after a real incident and an explicit status change.

Acceptance:

- [x] V1 native schemas, source pins, transforms, drift checks, and
      `.codex/config.toml` dogfood remain linked as the retained outcome.
- [x] All ten remaining V2/V3 phases carry the real-incident reopening trigger.
- [x] Known recorded drift remains documented without being resolved or removed.

Verification:

```sh
test "$(wc -m < goals/unified-ai-toolchain/GOAL.md)" -le 4000
jq . goals/unified-ai-toolchain/ops/manifest.json
bun run beep ai-sync audit --json
bun run beep ai-sync check --json
bun run beep ai-sync drift --strict --json
bun run --cwd packages/tooling/library/ai-sync check
bun run --cwd packages/tooling/library/ai-sync test
bun run check
git diff --check -- goals/unified-ai-toolchain packages/tooling/library/ai-sync packages/tooling/tool/cli .github/workflows
```

Stop and report before implementing V3 native file writes, adding new agents,
printing secret-like values, changing architecture doctrine, or routing Auto-PR
through Yeet publish while Yeet remains proof-mode.
