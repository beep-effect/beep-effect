# GOAL: Ship @beep/mcp-kit (MCP auth-gating + progressive-disclosure kit)

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `packages/foundation/capability/mcp-kit` exists, builds green through
repo gates, and exports the seven kit deliverables named in `SPEC.md`, each
proven by fixture/proof tests.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/mcp-kit/README.md`
- `goals/mcp-kit/SPEC.md`
- `goals/mcp-kit/PLAN.md`
- `goals/mcp-kit/ops/manifest.json`
- `goals/mcp-kit/research/SOURCES.md` (license discipline is load-bearing)

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md` (`standards/architecture/{02,03,07,09,12}`). Higher-priority repo
standards outrank packet prose when they conflict.

Scope:

- In: new package `packages/foundation/capability/mcp-kit` (+ minimal root
  workspace/tsconfig/turbo wiring for a new package).
- Out: no other package changes. No USPTO host (goal `uspto-mcp`), no
  nlp-mcp/m365-mcp retrofits (goal `mcp-host-retrofit`), no gov-legal drivers,
  no third-party MCP runtime, no persistence schema changes, no MCP
  `2025-11-25` reliance.

Key design facts (verified 2026-07-01; re-verify at P0 — `effect/unstable/ai`
is beta, pin `effect@4.0.0-beta.92`, MCP protocol `2025-06-18`):

- `McpServer` ships `failureMode:"return"` typed failures as
  `CallToolResult({isError:false})` (`McpServer.ts:717-728`) — the
  `api_key_required` envelope rides that channel, JSON mirrored into
  `content[].text`.
- `McpSchema.EnabledWhen` filters `tools/list` only; `tools/call` dispatches
  without re-checking (`McpServer.ts:255-262` vs `:1450`) — the kit's dispatch
  wrapper is the real security boundary (fail-closed, refusal-as-value,
  `ClaimGate`-shaped: `ClaimGate.ports.ts:42-47`).
- Upstream `Toolkit.ts:263-265` annotates spans with raw `parameters` — the
  sanitized-span wrapper must suppress this, with a proof test.
- Optional-secret gating idiom: `Config.redacted(env).pipe(Config.option)`
  (`Uspto.service.ts:398`). Gate enum `none|soft|hard`; hard vanishes at
  composition, none/soft degrade at call time. Fold layers via
  `layers.reduce(Layer.merge, Layer.empty)` — `Layer.orElse` does not exist
  in v4.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (six fixture/proof tests +
      curated barrel + README consumer plan).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/mcp-kit/GOAL.md)" -le 4000
jq . goals/mcp-kit/ops/manifest.json
git diff --check -- goals/mcp-kit
bun run beep yeet verify
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Stop if the
verified `effect/unstable/ai` internals above have drifted in a way that
invalidates a resolved decision.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
