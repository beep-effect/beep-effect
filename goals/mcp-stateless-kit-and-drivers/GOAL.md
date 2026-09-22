# GOAL: rebase mcp-kit on MCP 2026-07-28 and cut the stdio hosts over

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `@beep/mcp-kit` runs on the installed rc.117 adapter with a 2026
client subpath and a conformance port; m365, uspto, gov-legal and practice-kg
serve `[McpProtocol.v2026_07_28]` only and pass conformance through that
client; nlp-mcp flips too, or its hold is recorded with the vendor capture.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/mcp-stateless-kit-and-drivers/README.md`
- `goals/mcp-stateless-kit-and-drivers/SPEC.md`
- `goals/mcp-stateless-kit-and-drivers/PLAN.md`
- `goals/mcp-stateless-kit-and-drivers/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and
`explorations/effect-mcp-2026-07-28/{BRIEF,MAP,DECISIONS}.md`. Higher-priority repo
standards outrank packet prose when they conflict. Validate every Effect API
against `node_modules/effect/dist/unstable/ai/**` or `.repos/effect`, never
from priors.

Scope:

- In: `packages/foundation/capability/mcp-kit` (src, test, README),
  `packages/drivers/{m365,uspto,gov-legal,nlp}-mcp`, `packages/law-practice/server`,
  `apps/practice-kg-mcp`, `.mcp.json`, this packet.
- Out: the ontology sidecar, `GovernedTierGate`, `OntologyMcpServerConfig`
  (sibling goal); mixed protocol lists; a new package; identity fields, bearers
  or run keys in kit schemas; external agent clients other than the nlp-mcp
  capture; Effect upstream fixes (optional G8 lane, non-blocking).

Workflow:

1. PR 1 (after `bash scripts/setup-effect-ref.sh`): rebase `sanitizedToolkit`
   on rc.117 `registerToolkit`; dual-read `McpServerClient` /
   `McpRequestContext` (keep the 2025 session-id read; Goal B deletes it);
   dispatch-anchor `Context.Reference`; named error translator; protocol-list
   helper; `@beep/mcp-kit/client` (`client.ts` + `./client` export, Node
   stdio entry, `_meta` keys); conformance port; README. Hosts untouched.
2. PR 2: m365 then uspto to 2026-only with `instructions`, prompt titles,
   JSDoc, conformance. PR 3: gov-legal, practice-kg (+ `.mcpb` smoke).
3. PR 4: capture the first stdio message of Claude Code (and Codex if cheap)
   against a 2026-only nlp-mcp build into `history/`; flip nlp-mcp if a daily
   CLI sends `server/discover` first, else record the hold in the SPEC
   exception ledger and `MAP.md` re-entry gate.
4. Cite decisions as `(D-name)`; preserve unrelated worktree changes.
5. Run `bun run beep quality package-verify <package>` for every touched
   package before handing back.
6. At P4 Close, write the closeout reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
bun run beep quality package-verify @beep/mcp-kit
for p in m365-mcp uspto-mcp gov-legal-mcp law-practice-server practice-kg-mcp; do bun run beep quality package-verify @beep/$p; done
rg -n 'v2025_06_18' packages/drivers/m365-mcp packages/drivers/uspto-mcp packages/drivers/gov-legal-mcp packages/law-practice/server apps/practice-kg-mcp
test "$(wc -m < goals/mcp-stateless-kit-and-drivers/GOAL.md)" -le 4000
jq . goals/mcp-stateless-kit-and-drivers/ops/manifest.json
git diff --check -- goals/mcp-stateless-kit-and-drivers
```

Stop and report before changing public API beyond the named kit surface,
dependencies, lockfiles, generated files, or destructive state unless
`SPEC.md` explicitly requires it. Never add `v2025_06_18` back to a flipped host.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
