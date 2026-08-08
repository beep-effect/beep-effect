# P1 context-bloat pruning analysis — AGENTS.md, 2026-08-05

Execution record for ratified decision E6 in `p1-execution-decisions.md`: prune the
repo's always-loaded agent-context surface and land it as its own docs-only PR. The
reviewable artifact is the diff to `AGENTS.md`; this file is the justification for
every line of it.

## Scope

The always-loaded repo surfaces are:

- `AGENTS.md` at the repo root. `CLAUDE.md` is a symlink to it, enforced by
  `package.json:428` (`instructions:drift`) and `lefthook.yml:20`. Edit `AGENTS.md`;
  never replace the symlink.
- Skill frontmatter under `.claude/skills/*/SKILL.md` — **out of scope** for this pass,
  but load-bearing as a cross-check: frontmatter descriptions are in the same prompt
  prefix, so anything `AGENTS.md` restates from a description is paid for twice.

`.claude/settings.json` was checked and references no additional always-loaded context
(no `memory` / additional-context keys; it carries permissions, hooks, plugins, and
`autoMemoryDirectory` only). Per-package `AGENTS.md` files exist
(`packages/workspace/tables/AGENTS.md`, `apps/architecture-lab-proof/AGENTS.md`, and
others), but the root file contains no pointer to any of them, so none is always-loaded
and all remain out of scope.

Only content was changed. No lint, gate, or tool reads the *body* of `AGENTS.md` — the
`instructions-drift` hook validates the symlink, nothing else — so the section structure
is for agent navigation, not for a validator.

## Criteria

A line earns its recurring rent only if it changes agent behavior in most sessions.
Applied in this order:

1. **Behavioral contract → keep.** Anything an agent would get wrong by default, or
   that encodes a repo-specific decision with no other in-prompt carrier.
2. **Prior-override → keep, even if documented elsewhere.** Rules that fight a strong
   training-data default (`@example` tags, `as const` on `LiteralKit` arrays, Effect v3
   APIs, relative test imports) are worth their bytes because the failure mode is
   silent and habitual.
3. **Mechanically enforced → prune the prose.** If a gate, CLI validator, or schema
   rejects the wrong behavior, prose restating it buys nothing.
4. **Duplicated in an always-loaded surface → prune.** Restating a skill's own
   frontmatter description pays the same tokens twice in one prefix.
5. **Duplicated in a lazily-loaded file → relocate, keep the trigger.** Keep the law
   and the pointer; drop the recipe, provided the target file provably carries it.
6. **Retired or non-existent surface → delete.** Verified by reading the live tree, not
   by assuming.
7. **Derivable from the code → delete.** Enumerations that drift are worse than absent:
   they are confidently wrong.

Never-remove list held throughout: the `docs/_internal` privacy rule, `main` is PR-only,
both portless rules, and the browser-QA gate.

## Result

| | Bytes | Lines | Tokens (~4 chars/token) |
| --- | --- | --- | --- |
| Before | 6,731 | 135 | ~1,683 |
| After | 5,284 | 111 | ~1,321 |
| **Saved** | **1,447** | **24** | **~362 (21.5%)** |

~362 tokens off the prompt-cache prefix of every agent session in this repo, human and
Codex alike.

Per-section byte counts (before → after): Code Laws 1406→1289, Quality Operator
1152→908, Context Economy 703→609, Tool Routing 658→443, Discovery & Reuse 534→412,
Docs & Knowledge 533→320, Dev Servers 365→348, Codegen 342→158, Agent Memory 429→310,
Browser QA 296→217, Mission 77→0, header 216→254.

## Per-candidate table

Token estimates are from `wc -c` on the exact removed text at 4 chars/token.

| Section | Candidate | Action | ~Tokens | Risk | Where it lives now |
| --- | --- | --- | --- | --- | --- |
| Quality Operator | Fast-plus-monitor + `audit:github` fallback bullet | delete | 61 | med-low | `.claude/skills/yeet/SKILL.md:243-250` — and the CLI itself rejects `--fast` without `--monitor` |
| Discovery & Reuse | Two verbatim ripgrep command lines | relocate | 50 | low | `.claude/skills/repo-symbol-discovery/SKILL.md:23-33` (identical commands) |
| Codegen | `--domain-kind` archetype enumeration | delete | 46 | low | `packages/tooling/tool/cli/src/commands/Architecture/Architecture.schemas.ts:29` (`LiteralKit(["aggregates","entities","values"])`) + `standards/architecture/GLOSSARY.md` |
| Docs & Knowledge | `explorations/` fuzzy-front-end bullet | delete | 45 | low | `.claude/skills/explore/SKILL.md:4-8` frontmatter — already in the same prompt prefix |
| Tool Routing | Three QA skill pointers (`qa-session-ops`, `motion-evidence-review`, `exif-provenance`) | delete | 38 | low | Each skill's own frontmatter description, all always-loaded |
| Agent Memory | `graphiti-memory` retirement parenthetical | delete | 30 | low | `standards/memory-architecture/04-decision-log.md` (2026-07-25); section still points at the directory |
| Tool Routing | MUI / `mui-mcp` routing bullet | delete | 24 | none | Nowhere — server does not exist (see below) |
| Context Economy | "Front-load stable context" bullet | delete | 24 | none | Restates the prompt-cache-prefix bullet directly above it |
| Code Laws | JSDoc bullet: fence detail + skill cross-reference | tighten | 21 | low | `.patterns/jsdoc-documentation.md:19-24,56-57`; prior-override clause kept verbatim |
| Mission | Whole section | delete | 20 | none | Restated by Code Laws bullets 1-2 |
| Browser QA | "GIFs are for humans; the judge reads frame strips" | delete | 20 | low | `.claude/skills/browser-qa-loop/SKILL.md:83-86` |
| Docs & Knowledge | `docs/generated/` gitignored detail | tighten | 13 | none | `docs/README.md:12-13`; also enforced by `.gitignore` |
| Code Laws | Tersest-helper-form bullet wording | tighten | 8 | none | Semantics unchanged, phrasing compressed |
| Dev Servers | Stale app-name enumeration → derivation rule | tighten + fix | 4 | low | Derived from the `portless <name>` argument in each app's dev script |
| header | Symlink-edit guard added | **+10** | — | — | Prevents a class of `instructions:drift` failure that costs far more than 10 tokens |

### Two factual corrections found while pruning

Both were confidently wrong instructions, not merely redundant ones.

**`graph3d-bench` does not exist.** The Dev Servers section listed four canonical
hostnames including `graph3d-bench.beep`. `apps/` contains `architecture-lab-proof`,
`oip-web`, `practice-kg-mcp`, `professional-desktop`, and `storybook` — no
`graph3d-bench`, and `rg -n graph3d` across all app and package manifests returns
nothing. The list also omitted real apps. Replaced with the derivation rule (the
`portless <name>` argument in the app's dev script), which cannot drift. Both portless
laws are preserved verbatim.

**`mui-mcp` is defined nowhere and explicitly disabled here.** The Tool Routing section
told agents to prefer `mui-mcp` with a specific `useMuiDocs`-then-`fetchDocs` call
order. That server is in no `.mcp.json` (this repo's has `chrome-devtools`, `fallow`,
`next-devtools`, `nlp`, `serena`, `shadcn`, `webstorm`), and the only occurrence in
`~/.claude.json` is at
`projects > <HOME>/YeeBois/projects/beep-effect > disabledMcpServers[15]`.
MUI packages are genuinely used (`@mui/material`, `@mui/x-tree-view`), but the routing
instruction was unusable for Claude Code and meaningless for Codex. Deleted. If the
server is ever re-enabled, the guidance belongs in a skill or alongside the `.mcp.json`
entry, not in the always-loaded prefix.

## Considered and rejected as too risky

- **The retired `standards/repo-exports.catalog.*` negative law.** It looks like a
  textbook dead-surface reference, and it is the one I most expected to cut. The
  surface is only half-retired: `infra/package.json:22` still defines a runnable
  `repo-exports:shard` script, `biome.jsonc:45` and `_typos.toml:105-106` still
  reference the catalog files, and
  `packages/tooling/tool/cli/src/commands/Yeet/internal/IssueClassification.ts:126,198`
  still classifies `repo-exports` issue labels. An agent grepping `package.json` for a
  discovery command would find a live script to run. The law stays until those
  references are removed — which is the correct follow-up, after which this bullet
  becomes free to delete.
- **The `effect-v4-imports` routing bullet**, despite duplicating an always-loaded skill
  description. The skill's own description is narrower ("import hygiene", "A/O/P/R/S
  aliases") than the `AGENTS.md` trigger ("v3↔v4 differences"), and writing Effect v3
  from training priors is the highest-frequency default-behavior failure in this repo.
  The right fix is broadening the skill's frontmatter so the pointer can retire; that
  edits skill frontmatter, which is out of scope for this pass.
- **The commitlint 100-character body-wrap rule** under `main` is PR-only. Grep of
  `.claude/skills/yeet/SKILL.md` shows no coverage, and it fires server-side on GitHub
  merge/squash messages where the failure is remote and confusing. Kept verbatim.
- **The verification-failure attribution taxonomy** (introduced / inherited / unrelated
  / environment-only). Zero coverage in `.claude/skills/yeet/SKILL.md` or
  `.claude/skills/quality-review-fix-loop/SKILL.md`. It is the rule that stops blind
  reruns, and it is unique to this file.
- **The `LiteralKit` / `as const` note and the `@beep/*` test-import rule.** Both are
  pure prior-overrides against habitual defaults. Kept.

## Follow-ups this pass surfaced

1. Remove the remaining `repo-exports` references (`infra/package.json:22`,
   `biome.jsonc:45`, `_typos.toml:105-106`,
   `packages/tooling/tool/cli/src/commands/Yeet/internal/IssueClassification.ts`), then
   delete the negative law — worth roughly another 30 tokens of permanent rent.
2. Broaden `.claude/skills/effect-v4-imports/SKILL.md` frontmatter to trigger on v3↔v4
   API differences, then retire the Tool Routing bullet.
3. Audit skill frontmatter as its own pass. It is the other half of the always-loaded
   prefix and was deliberately untouched here.
