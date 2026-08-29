# Practice KG MCP Plan

## Status

Status: `active` (P0 packet + spike is this PR; each subsequent phase ships as
its own mergeable PR via the yeet completion gate)

Phase content is normatively bounded by `SPEC.md` decisions D-1–D-8.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Packet + spike | complete | This packet + ROADMAP amendment + R1 packaging spike (bun-windows-x64 compile embedding PGlite + DuckDB) + same-day quick win (uspto-mcp into Tom's config via remote hands, no PR needed). | Packet + INDEX + ROADMAP merged; spike verdict recorded under `history/` with go/no-go on single-binary vs bun.exe-plus-folder; Tom has live USPTO lookups. |
| P1 KG build lane | complete | Per D-9: kg literal domains in `law-practice/domain`; new `@beep/law-practice-tables` (KgNode/KgEdge read-model tables via `bun run beep architecture`); projection writers in `law-practice/server` (`PracticeKg.projections.ts`) building the deterministic spine from catalog/organize/enrich outputs + email edges from pffexport headers → PGlite node/edge tables + shipped DuckDB (documents/text/emails/FTS); build entrypoint in new `apps/practice-kg-mcp` (`src/build.ts`, contract §5 flags). `@beep/identity` IRIs as node ids. No repo-cli changes. | AC-1 determinism + reconciliation proof in tests; graph bundle builds from the real corpus on the workstation; nothing under `packages/tooling` touched. |
| P2 MCP host wiring | complete | Per D-9: ~9 tool declarations in `law-practice/use-cases`, handlers + `Tools.ts` composer in `law-practice/server`, stdio `bin.ts` + runtime layers in `apps/practice-kg-mcp`; mcp-kit FieldTier budgets, readOnly annotations, sanitized spans. Epistemic-tables import lands here or P3 with Exception Ledger line + README record. | Full `bun run beep lint policy` green pre-CI; server answers all tools against a real bundle; E2E in Claude Desktop on the workstation. |
| P3 OA candidate claims | complete | OfficeActionReview loop with a real LanguageModel layer over `staging/oppold-demo-inputs` (workstation batch); candidates + evidence + Activity provenance persisted into the bundle PGlite; labeling envelope on `kg_candidate_claims`. | AC-3 holds for every shipped claim; batch run documented under `history/`. |
| P4 Distribution | complete | .mcpb bundle (binary entry, `user_config` directory prompt for the data-bundle path); install/refresh runbook doubling as machine-readable install manifest; egress check; gitleaks clean. Fallback per D-8 if spike verdict demands. | Met 2026-07-30: .mcpb installed cleanly on the Windows target after the B-1 `NODE_PATH` fix; AC-5 met as specified on sampled observation (2,326 samples / 85.7 min / 0 rows), network-isolation hard proof queued per D-10; evidence in `history/p5/2026-07-30-ac4-ac5-gauntlet.md`. |
| P5 Acceptance evidence | in-progress | 5-question acceptance gauntlet vs grep baseline (run 2026-07-30: five provisional passes scored under the D-10 revision, carrying G-3's failed required-label item and the G-2/G-4 partial deliverables; **AC-2 unmet** — node provenance absent, blocker B-2). Remaining: Tom's correctness calls on G-1..G-5. | AC-4 axes recorded (`history/p5/`); correctness closed by Tom; defect register filed. |
| P6 Graph-integrity repair | pending | Fix the two blocker mechanisms from the defect register: (1) extract the client dimension and key families on `<client>.<docket>` (A-1/A-2/A-3 — `documents.client` is 81/7,330 and never beside `docket_family`; prefixes verified present in source text); (2) stop deriving family membership from mention-derived `enrichment.docket_families` (`uspto-anchor` fan-out, A-12/A-15 — 75/150 rows multi-family, max 16); plus A-14 application `docketFamily`, A-4 dual-key reconciliation, A-5/A-6 `$R*` quarantine + attribution-source field, A-7 claim→document digests, A-9/A-11 build metadata. Rebuild bundle. | Rebuilt bundle: family 10013 splits by client prefix; family 10073 shows zero phantom patents; application `13/572,982` anchors exactly one family; G-1/G-3 spot re-runs clean (memory cleared per gauntlet protocol). |
| P7 Server hardening | pending | Typed `kg_provenance` errors + node-floor disclosure (B-2/B-3/B-4); `kg_candidate_claims` routing description (B-5); disclosure-budget truncation signaling (B-6); degenerate-join detection (B-7); `corpus_search_text` match offsets (B-8); windows-latest CI packaging smoke running the B-1 cwd-independence regression. | Tool-contract tests green; CI packaging lane exercises `initialize` from a non-extension cwd; AC-2 re-scored against the rebuilt bundle with node rows either resolving or refused through a typed capability boundary; AC-5 re-proved under enforced network isolation (D-10) rather than sampling. |
| P8 Handoff + close | pending | AC-6 runbook-only install on Tom's machine **after P6** (handing over a build with known-wrong family answers burns trust in the layer that works); capture his real questions as backlog; opportunistic: collect his native prosecution task set (unblocks `law-time-capture-spine` P0). Closeout reflection. | AC-6; reflection lands; statuses flipped in the same PR as final work. |

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

## Product scope decisions (Tom, alongside P6)

Deferred questions the gauntlet surfaced that are scope calls, not defects —
carry them into the AC-6 conversation:

- **USPTO prosecution status** (A-13): not in the bundle by construction;
  status questions are natural and currently unanswerable. Options: promote
  `uspto-mcp` from optional companion to default install, or ingest status
  into the bundle build.
- **US file wrappers** (A-8): corpus holds foreign counterpart prosecution
  only for the G-2 patents; decide whether US wrappers enter ingestion scope.
- **Message-level email provenance** (A-10): floor is the PST container
  (disclosed per D-2c); raising it would unlock privilege-log / fee-dispute
  proof of specific messages.

## P8 Closeout checklist

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
