# GOAL: Ship the practice KG to Tom's Claude Desktop as a read-only local MCP server

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Tom's Windows Claude Desktop answers real practice questions (joins,
provenance, side-by-side document pulls) through a local read-only MCP server
over a portable data bundle built deterministically from the Oppold corpus —
verifiably better than grep over his SSD corpus copy.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/practice-kg-mcp/README.md`
- `goals/practice-kg-mcp/SPEC.md` (normative; decisions D-1–D-8)
- `goals/practice-kg-mcp/PLAN.md` (phases P0–P5, one PR each)
- `goals/practice-kg-mcp/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and standards named by
`SPEC.md`. Higher-priority repo standards outrank packet prose when they
conflict.

Scope:

- In: `beep corpus graph` build lane (Corpus command family); schema-first
  spine/edge models; the new read-only MCP host package (~9 tools via
  `@beep/mcp-kit`); OA candidate-claim batch over `staging/oppold-demo-inputs`
  (workstation only); .mcpb packaging + runbook; `docs/ROADMAP.md` amendment.
- Out: write/approval tools; librarian/critic/SHACL loop (intake P4-proper);
  embeddings/fused retrieval; skills curation and firm distribution (Phase-2
  packet); professional-desktop UI; graph DB engines; refresh-batch extraction.

Non-negotiables: read-only labeled tools (D-4); candidate claims carry
resolvable evidence spans + `candidate — unreviewed` label; zero network egress
from the shipped server; corpus/PII never enters the repo; schema-first,
effect-first, typed errors; full `bun run beep lint policy` before a new
package's first CI.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md` for the current phase.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. Each phase PR carries agent-run E2E evidence of its real user flow.
7. At P5 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` AC-1 … AC-6 are satisfied for the phases being closed.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/practice-kg-mcp/GOAL.md)" -le 4000
jq . goals/practice-kg-mcp/ops/manifest.json
git diff --check -- goals/practice-kg-mcp
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
