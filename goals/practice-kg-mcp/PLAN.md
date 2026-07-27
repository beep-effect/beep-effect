# Practice KG MCP Plan

## Status

Status: `active` (P0 packet + spike is this PR; each subsequent phase ships as
its own mergeable PR via the yeet completion gate)

Phase content is normatively bounded by `SPEC.md` decisions D-1–D-8.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Packet + spike | in-progress | This packet + ROADMAP amendment + R1 packaging spike (bun-windows-x64 compile embedding PGlite + DuckDB) + same-day quick win (uspto-mcp into Tom's config via remote hands, no PR needed). | Packet + INDEX + ROADMAP merged; spike verdict recorded under `history/` with go/no-go on single-binary vs bun.exe-plus-folder; Tom has live USPTO lookups. |
| P1 KG build lane | pending | `beep corpus graph` extending the Corpus command family: deterministic spine (clients → docket families → applications → documents) from catalog/organize/enrich outputs + email edges from PST message JSONL → schema-first PGlite node/edge tables + DuckDB FTS index. `@beep/identity` IRIs as node ids. | AC-1 determinism + reconciliation proof in tests; graph bundle builds from the real corpus on the workstation. |
| P2 MCP host package | pending | New read-only host package cloned from the uspto-mcp 5-file shape; ~9 tools per SPEC; mcp-kit FieldTier budgets, readOnly annotations, sanitized spans; placement ruled by architecture-guardian at scaffold. | Full `bun run beep lint policy` green pre-CI; server answers all tools against a real bundle; E2E in Claude Desktop on the workstation. |
| P3 OA candidate claims | pending | OfficeActionReview loop with a real LanguageModel layer over `staging/oppold-demo-inputs` (workstation batch); candidates + evidence + Activity provenance persisted into the bundle PGlite; labeling envelope on `kg_candidate_claims`. | AC-3 holds for every shipped claim; batch run documented under `history/`. |
| P4 Distribution | pending | .mcpb bundle (binary entry, `user_config` directory prompt for the data-bundle path); install/refresh runbook doubling as machine-readable install manifest; egress check; gitleaks clean. Fallback per D-8 if spike verdict demands. | AC-5; .mcpb installs cleanly on a Windows test target; runbook is one page. |
| P5 Handoff + close | pending | 5-question acceptance gauntlet vs grep baseline; install on Tom's machine; capture his real questions as backlog; opportunistic: collect his native prosecution task set (unblocks `law-time-capture-spine` P0). Closeout reflection. | AC-4 + AC-6; reflection lands; statuses flipped in the same PR as final work. |

## Dependencies (referenced, not duplicated)

| Packet | Relationship |
| --- | --- |
| `oppold-corpus-pipeline` / `oppold-corpus-refresh` | Completed corpus substrate (catalog/organize/enrich outputs) this packet projects from. Base run only; refresh extraction deferral stands. |
| `mcp-kit` / `mcp-host-retrofit` / `uspto-mcp` | Completed MCP substrate; uspto-mcp is the host template and ships alongside as the live-USPTO config entry. |
| `epistemic-bitemporal-edge-core` / `epistemic-claim-lifecycle-gate` | Completed authority substrate the candidate claims persist through. |
| `langextract-capability` + law-practice OA spike/rung packets | Completed span-grounded extraction precedent P3 generalizes. |
| `legal-document-intake` | Umbrella program; P4-proper (librarian/critic/ClaimGate) resumes after this packet's handoff, with Tom's captured questions as requirements. |
| `agent-execution-authority` | In flight; D-4 read-only posture keeps this packet outside its blast radius. |
| `explorations/stack-installer` | Parked; Phase-2 starter-stack packet revives it (D-7). |

## Execution notes

- Each phase PR includes agent-run E2E evidence for its real user flow (lesson
  inherited from intake P1: green unit tests shipped a broken drop path).
- The OA batch (P3) runs on the workstation only; Tom's machine never runs
  extraction and never needs API keys for practice-kg-mcp.
- Preserve unrelated worktree changes; keep SPEC normative — decision changes
  get dated superseding entries in the D-table.
- Corpus paths in commands/tests refer to the out-of-repo corpus home; in-repo
  tests use synthetic fixtures only.

## P5 Closeout checklist

1. `/reflect` → `history/reflections/<YYYY-MM-DD>-<agent>.md`
   (`ReflectionFrontmatter`-valid); `bun run beep lint reflection-artifacts`.
2. README status + latest evidence; `ops/manifest.json` phases +
   `initiative.status`; regenerate `goals/INDEX.md`.
3. Same-PR packet-state flip with the final work per repo law.

## Verification commands

```sh
test "$(wc -m < goals/practice-kg-mcp/GOAL.md)" -le 4000
jq . goals/practice-kg-mcp/ops/manifest.json
rg -n "practice-kg-mcp|GOAL.md|agentLaunchers|packetAnchorDocument" goals/practice-kg-mcp
git diff --check -- goals/practice-kg-mcp
```
