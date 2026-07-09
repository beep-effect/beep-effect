# GOAL: Ship the legal document intake program, one phase per PR

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path. All paths below are repo-relative.

Outcome: a lawyer using `apps/professional-desktop` onboards a workspace vault,
drops files that are filed against a FOLIO-aligned taxonomy, sees the vault
mirrored one-way to Box, and retrieves documents through a knowledge graph
populated by a librarian → critic → gate loop, opening at exact highlighted
spans in a dock panel.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/legal-document-intake/README.md`
- `goals/legal-document-intake/SPEC.md` (locked decisions D1–D11)
- `goals/legal-document-intake/PLAN.md` (phases P0–P7)
- `goals/legal-document-intake/ops/manifest.json`
- `goals/legal-document-intake/research/exploration-findings.md` (reuse map)

Read those first, then `AGENTS.md` and the standards named by `SPEC.md`. If a
repo-local `CLAUDE.md` exists, read it as an additional source.
Higher-priority repo standards outrank packet prose.

Scope:

- In: the open `PLAN.md` phase only — new `documents` slice, workspace vault,
  desktop intake/onboarding/dockview UI, agents live mode, epistemic critic
  loop, Box sync, local embedding driver, M365 write verbs (per phase).
- Out: bidirectional sync, OCR, multi-device vaults, local LLM inference,
  graph databases, driver-internal work owned by other packets, skills/MCP
  host substrate (consume `mcp-kit` only after it merges).

Workflow:

1. Find the first non-complete phase in `PLAN.md`; work only that phase.
2. Make the smallest change satisfying that phase's exit criteria and
   `SPEC.md` constraints (schema-first, typed errors, event-based cross-slice
   flow, fixture-mode Layers for every LLM behavior).
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update `PLAN.md` phase status and `README.md` evidence when readiness
   changes; ship via `bun run beep yeet` (repair → verify → publish → monitor).
6. At P7 Close, write a reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] The open phase's exit criteria in `PLAN.md` are satisfied.
- [ ] `SPEC.md` constraints hold (no slice-to-slice imports, taxonomy is data,
      atomic FS writes, deterministic tests without live keys).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/legal-document-intake/GOAL.md)" -le 4000
jq . goals/legal-document-intake/ops/manifest.json
git diff --check -- goals/legal-document-intake
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Box/M365 test
tenants must be arranged before P3/P6 execution, not improvised.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
