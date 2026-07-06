# Audit: Nested Instruction Files (2026-07-05)

Read-only agent audit (workflow `wf_5e468257-0f6`). Scope: every non-root
CLAUDE.md/AGENTS.md. **130 entries = 77 regular files + 53 symlinks
(CLAUDE.md → AGENTS.md); 115,463 B ≈ 28.9k tokens.** Baseline's "14 files /
142KB" undercounted the file population (it measured a different subset);
this is the authoritative census.

## Verdict rollup

**keep 9 · shrink 21 · merge-into-skill 1 · delete 46** — estimated
recoverable context ≈ 45–50 KB (~12k tokens), before template fixes.

### Keep (9) — the target shape

| Path | Why |
| --- | --- |
| `packages/shared/AGENTS.md` (78 ln) | Highest-value nested guide: shared-kernel doctrine, promotion bar, hard boundary rules; links standards instead of duplicating. |
| `packages/foundation/AGENTS.md` (26 ln) | Family-boundary doctrine (package kinds, manifest honesty). **No CLAUDE.md symlink → Claude never auto-loads it.** |
| `packages/foundation/capability/mcp-kit/AGENTS.md` (41 ln) | TierGate security-boundary semantics (tools/list vs tools/call, fail-closed) — exactly what an agent must not guess. Trim template tail only. |
| `packages/agents/client/AGENTS.md` (9 ln) | Exemplar delta-only note (Chat.atoms ↔ ChatRpcs wiring). |
| `packages/_internal/db-admin/AGENTS.md` (6 ln) | Exemplar: prod apps must not depend on it. |
| `packages/drivers/ffmpeg/AGENTS.md` (13 ln) | Exemplar: ChildProcess scoping laws. **Missing CLAUDE.md symlink.** |
| `packages/foundation/modeling/provenance/AGENTS.md` (10 ln) | Exemplar: product-agnostic provenance rules. |
| `packages/foundation/modeling/rdf/AGENTS.md` (10 ln) | Exemplar: one-way semantic-web re-export rule. |
| `packages/tooling/policy-pack/lint-rules/CLAUDE.md` (35 ln) | Real GritQL-rule workflow. **CLAUDE-only — Codex never sees it; rename to AGENTS.md + symlink.** |

### Shrink (21) — keep the named delta, drop template boilerplate

apps/oip-web (keep content/review-gate surface + goals pointer + tool-managed
`<!-- BEGIN:nextjs-agent-rules -->` block — external tooling owns that block);
agents/server (keep **scanChunk byte-stability law** — property-test-proven);
shared/domain (keep Add-Here/Keep-Out + purity laws; cut 13-row file map to
barrel level); shared/tables; drivers/acp, drizzle (keep EntityTable
projection), postgres (**fix stale pglite paragraph**), pglite (keep tag-shim
explanation), firecrawl (keep cost-gating + watcher-cleanup laws), openai-compat
(move 25-line recipe to docgen @example), nlp-mcp (keep toolkit-composition
ownership), m365-mcp (keep read-only + redaction laws), uspto-mcp, venice-ai,
wink (keep AiToolError/span laws), xai (fix vacuous purpose), runpod (keep
no-infra-policy boundary); epistemic/tables, workspace/tables (keep proof
lineage); foundation/modeling/html, pandoc-ast; tooling/library/ai-sync (keep
evidence-discipline laws + generate/drift commands).

### Merge-into-skill (1)

`explorations/AGENTS.md` → fold state machine + hard rules into the /explore
skill; keep a 5-line pointer. **Fix retired-catalog reference** (mandates
`standards/repo-exports.catalog.md`, which root AGENTS.md explicitly retires —
direct root contradiction).

### Delete (46)

36 pure/vacuous CreatePackage scaffolds (zero non-derivable content, stale
placeholder surface maps): apps/architecture-lab-proof; packages/architecture-lab/{client,config,domain,server,tables,ui,use-cases};
drivers/{ai-provider-cli,box,courtlistener,discord,dol,ecfr,federal-register,govinfo,hubspot,libpff,m365,onepassword-cli,phoenix,sanity,tika,uspto};
foundation/capability/{api-transport,chalk,file-processing};
foundation/modeling/{lexical,md,ontology}; foundation/ui-system/{editor,form};
tooling/policy-pack/repo-configs; tooling/test-kit/test-utils;
workspace/{server,use-cases} (**both have CONFIRMED WRONG descriptions** —
claim "Architecture-lab WorkItem" but host the Thread aggregate).
Plus 8 byte-identical CLAUDE.md copies → replace with symlinks
(firecrawl, epistemic/tables, chalk, repo-configs, test-utils,
workspace/server, workspace/use-cases, **postgres — already drifted from its
twin, proving copies rot**), 1 `@AGENTS.md` import shim (shared/CLAUDE.md),
1 vacuous pair counted above.

## Load-bearing observations

1. **Template root cause**: ~56 files are instances of
   `packages/tooling/tool/cli/src/commands/CreatePackage/templates/AGENTS.md.hbs`
   (+ app variant). Every instance duplicates two root rules verbatim +
   checklist noise. **Deleting instances without fixing the .hbs templates
   regrows the duplication on every `beep architecture add` / create-package.**
2. **Symlinks are already the convention** (53 of them) — single-sourcing per
   directory is settled practice; the copies/shims are the drift.
3. 38/67 unique AGENTS.md carry the stale-by-construction `entry module |
   VERSION` surface-map row (confirmed false for @beep/box). Unmaintained
   inventory tables are worse than nothing.
4. Symlink gaps hide good content from Claude (foundation, ffmpeg,
   agents/client, agents/server, db-admin lack CLAUDE.md); lint-rules is the
   reverse (Codex-blind).
5. postgres ↔ pglite guides contradict each other about @beep/pglite's
   existence; pglite src is live, postgres guide is the stale one.
6. Tables-role laws are triplicated (shared/epistemic/workspace tables) with
   the domain name swapped — single-source once (root law or tables-role note).
7. Verified-good: standards/ARCHITECTURE.md, 02-shared-kernel.md,
   goals/oip-web-launch, /explore skill, `bun run beep docs laws`,
   config-sync, turbo task names — boilerplate commands are redundant, not stale.
