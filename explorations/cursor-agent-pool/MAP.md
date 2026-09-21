# Map — Cursor Agent Pool

Decomposition of `BRIEF.md` into goal packets. Capability check: every component cites an existing
repo brick or is marked NET-NEW.

## Candidate goal packets

### Goal A — `agent-pool-doctrine` (promised now)

**Mission.** Make the pool order binding and make the Cursor lane a first-class, measurable volume pool.

**Deliverables.**
1. `AGENTS.md` "Token-heavy Codex work" → "Volume pools" section: the three-step order, floors, seat
   map, hold behaviour, and the corpus rule. Brick: existing section (2026-09-09 operator instruction).
2. `docs/runbooks/agent-pools.md`: Codex meter probe, Cursor lane recipe v2, seat map with prices,
   failure signatures, transcript verification (`"command":` extraction), hook GAPs, sandbox network
   notes. Brick: `docs/runbooks/` layout; tsgo-045 `ops/prompts/50-cursor-lane.md` (retire its
   duplicate by citing the runbook).
3. `.cursor/hooks.json` + `.cursor/hooks/hook-pulse.sh` (adapter over the shared body),
   `.cursor/hooks/law-pulse.sh` (afterFileEdit), yeet-inbox `preToolUse` deny. Bricks:
   `.claude/hooks/hook-pulse.sh`, `.codex/hooks/*`, `.claude/hooks/yeet-inbox.sh`; smoke proof in
   `explorations/cursor-agent-pool/ops/hooks-smoke/`.
4. `HookPulseAgentKind` += `"cursor-cli"` and the conformance test. Brick:
   `packages/tooling/library/ai-metrics/src/hook-pulse.ts`, `test/hook-pulse-writer.test.ts`.
5. `.cursor/cli.json` with `permissions.deny: ["Shell(git)", "Shell(sudo)", "Shell(pkexec)"]`. NET-NEW
   file, documented schema.
6. `.cursor/agents/*.md` only where a model pin pays (read-only explorers on `composer-2.5`). Brick:
   `.claude/agents/*.md`.
7. Admission proof: one real shard of Goal A itself written by a `composer-2.5` lane (D15), with the
   pulse rows visible in the agent-evidence ledger and a review pass on `claude-opus-5-thinking-high`.

**Dependencies.** None. **Owner surfaces.** `AGENTS.md`, `docs/runbooks/`, `.cursor/`,
`@beep/repo-ai-metrics`.

### Goal B — `agent-pool-picker` (queued behind A)

**Mission.** `beep agent-pool pick [--tier ...]` prints the launch command the doctrine implies.

**Deliverables.** Schema-first: `PoolSnapshot` (codex primary/secondary windows, ordinaryUsageAllowed,
cursor status = fail-open|dry-for-session), `Tier`, `Seat` (LiteralKit ids + bucket), `LaneCommand`;
a `CodexMeter` service over `codex app-server` stdio JSON-RPC; the picker command; a dry-marker file
(`$XDG_STATE_HOME/beep/agent-pools/cursor-dry-<day>`) written by the wrapper when a lane exits with the
limit signature. Bricks: `packages/tooling/tool/cli/src/commands/*` command layout,
`packages/tooling/library/ai-metrics` evidence root convention, `LiteralKit` from `@beep/schema`.
NET-NEW: the meter service and the picker. Proxy-account meters join only if CLIProxyAPI's management
API exposes quota (NOT FOUND today).

**Dependencies.** Goal A (seat map and floors are its input). **Gate.** Opens when Goal A's PR merges.

## Sequencing

1. Goal A PR 1: doctrine + runbook + `.cursor/cli.json` + hooks adapter + schema literal + test
   (one PR; the runbook and AGENTS.md text is the shard dogfooded on Composer, the schema literal and
   test are Fable-written or reviewed on Opus 5). Rationale: the binding rule must land before any
   automation, and the hooks gate (D9) must be green before Cursor takes other packets' shards.
2. Goal A PR 2 (optional, same packet): retire tsgo-045's duplicate recipe by citation; model-pinned
   `.cursor/agents` files once a lane shows a pin paying.
3. Goal B after A merges.

## First vertical slice

`docs/runbooks/agent-pools.md` + `.cursor/cli.json` + `.cursor/hooks.json` with the pulse adapter,
written by a `composer-2.5` lane in this worktree, verified by: transcript shows zero `git` commands,
`git status` shows only the intended files, and pulse rows for the lane appear in the evidence ledger
with `agentKind: cursor-cli` (schema literal added first so the rows decode).

## Inherited risks

- Cursor CLI hang class (`-p` never exits) — mitigated by host `timeout` and the result-line check.
- Silent denials when `--force` is missing — recipe pins it; deny list carries the hard rules.
- Cursor Models spill zeroing Other Models — human floor check until an official meter exists.
- Fast-variant default — every id in the runbook is the non-fast id.
- CLAUDE.md→AGENTS.md symlink may double-inject instructions in Cursor — observe in the first lane;
  if visible, add a Cursor-only note, not a second rules file.
