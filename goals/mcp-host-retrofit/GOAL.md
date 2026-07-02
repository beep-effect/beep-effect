# GOAL: Retrofit nlp-mcp and m365-mcp onto @beep/mcp-kit hygiene helpers

Repo root: `.` (repo-relative paths throughout this packet).

Outcome: `packages/drivers/nlp-mcp` and `packages/drivers/m365-mcp` both adopt
`@beep/mcp-kit`'s sanitized-span wrapper and four-hint annotation helper
(tier-gate wrapper only if a genuine write/gateable tool is found), and
`@beep/mcp-kit`'s README consumer list names both as real importers.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/mcp-host-retrofit/README.md`
- `goals/mcp-host-retrofit/SPEC.md`
- `goals/mcp-host-retrofit/PLAN.md`
- `goals/mcp-host-retrofit/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md` (`standards/architecture/{02,03,07,09,12}`, especially
`12-observability.md` §3). Also read `goals/mcp-kit/SPEC.md` (the kit
contract this retrofit consumes) and the sibling `goals/uspto-mcp/SPEC.md`
(jointly discharges the kit's ≥2-consumer gate). Higher-priority repo
standards outrank packet prose when they conflict.

Scope:

- In: `packages/drivers/nlp-mcp`, `packages/drivers/m365-mcp`,
  `packages/foundation/capability/mcp-kit/README.md` (consumer table only).
- Out: `mcp-write-wall` (deferred follow-on — do not build a real write-wall
  proof here). No `@beep/mcp-kit` source changes beyond what real consumption
  needs. No `packages/drivers/uspto-mcp` changes. No tool-behavior changes
  beyond span/annotation hygiene.

Key design facts (verified 2026-07-01 for the kit; re-verify at P0):

- `Toolkit.ts:263-265` annotates every tool span with raw `parameters` before
  decode — live `12-observability.md` §3 violation for `nlp-mcp`'s raw-`text`
  tools (`goals/mcp-kit/history/2026-07-01-p0-verification.md` claim (c)).
- `StreamingToolkit` (`packages/drivers/nlp-mcp/src/StreamingTools.ts`) has
  zero four-hint annotations; `m365-mcp/src/M365Tools.ts` annotates all four
  via inline `.annotate(...)` chains (e.g. `M365Tools.ts:100-103`) — the
  asymmetry `ToolAnnotations` fixes.
- Both hosts are largely read/local-compute today — expect the tier-gate
  deliverable to resolve to "not applicable, recorded" unless P0 finds a
  genuine write/gateable tool; do not invent one.

Workflow:

1. Inspect referenced files and current repo state, including
   `goals/mcp-kit`'s shipped package to confirm its exported
   `SanitizedSpan`/`ToolAnnotations`/`TierGate` surface.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (span proof tests for both
      hosts, hint parity, kit README consumer update, unchanged test
      behavior).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/mcp-host-retrofit/GOAL.md)" -le 4000
jq . goals/mcp-host-retrofit/ops/manifest.json
git diff --check -- goals/mcp-host-retrofit
bun run beep yeet verify
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Stop if
`@beep/mcp-kit`'s shipped surface has drifted from the deliverable contracts
this retrofit depends on — do not patch the kit from inside this goal.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
