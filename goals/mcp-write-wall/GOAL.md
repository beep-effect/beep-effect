# GOAL: Wire @beep/mcp-kit's TierGate into nlp-mcp (prove the write wall)

Repo root: `.` (repo-relative paths throughout this packet).

Outcome: `packages/drivers/nlp-mcp`'s `tools/call` dispatch composes
`@beep/mcp-kit`'s `TierGate` wrapper, `NlpToolkit`'s tools carry accurate
annotations (judged for the four stateful ones, mechanical for the rest),
and fixture tests prove an approved and a refused dispatch path — the first
real proof of the tier-gate wall against a write-capable host.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/mcp-write-wall/README.md`
- `goals/mcp-write-wall/SPEC.md`
- `goals/mcp-write-wall/PLAN.md`
- `goals/mcp-write-wall/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and standards named by
`SPEC.md` (`standards/architecture/{02,03,07,09,12}`). Also read
`goals/mcp-kit/SPEC.md` and `goals/mcp-host-retrofit/PLAN.md`'s P0 row
(prior grounding on `NlpToolkit`'s four stateful tools — don't re-derive
it). Repo standards outrank packet prose when they conflict.

Scope:

- In: `nlp-mcp` (`Server.ts` dispatch), `nlp-processing` (tool annotation
  sites only), `mcp-kit` (additive only, if composing `TierGate` needs a
  new export).
- Out: `uspto-mcp`, `m365-mcp`, `NlpToolkit` tool *behavior* changes,
  `UsageRecord.metadata` persistence (log-only this slice — see `SPEC.md`
  Non-Goals/Exception Ledger).

Key design facts (verified 2026-07-02; re-verify at P0):

- `TierGate.ts:301-302` defaults ANY unannotated tool to destructive
  (fail-closed) — annotate `NlpToolkit`'s full surface, not just the four
  stateful tools, or every read tool gets refused once wired.
- Four stateful tools, zero hint annotations today: `CreateCorpus`
  (`Tools/CreateCorpus.ts:75-81`), `LearnCorpus` (`:81-87`), `DeleteCorpus`
  (`:58-64`), `LearnCustomEntities` (`:99-105`). Judge each on real
  semantics, don't blanket-copy.
- Proven dispatch seam: `built.handle(...)` inside
  `registerSanitizedToolkit`'s per-tool loop (`SanitizedSpan.ts:206-223`);
  wrapping only the outer `callTool` call does not work.
- Fixture precedent: `nlp-mcp/test/SanitizedSpan.test.ts` (real
  `NlpToolkit`/`WinkNlpToolkitLive` layers, no toolkit mocking).
- `nlp-mcp` has no `@beep/epistemic-domain`/`-use-cases` dependency today —
  why the audit sink is log-only this slice, not `UsageRecord.metadata`.

Workflow:

1. Inspect referenced files and repo state, including `goals/mcp-kit`'s
   shipped package, to confirm `TierGate`/`SanitizedSpan`/`ToolAnnotations`
   match `SPEC.md`'s deliverables.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Tie decisions to evidence — especially the per-tool destructive/approval
   judgment calls.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` criteria satisfied (full-surface annotations, gate wired at
      the real dispatch seam, approved + refused fixture tests, log-only
      audit records, unchanged existing test behavior).
- [ ] Verification commands pass, or unrelated failures are reproduced and
      recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/mcp-write-wall/GOAL.md)" -le 4000
jq . goals/mcp-write-wall/ops/manifest.json
git diff --check -- goals/mcp-write-wall
bun run beep yeet verify
```

Stop and report before changing public API, schema, migrations, auth,
infra, security, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` requires it. Stop if the kit's shipped surface has
drifted, or a tool's semantics can't be judged confidently — don't guess.

Done only when acceptance passes and verification is complete, or a blocker
is reported with evidence.
