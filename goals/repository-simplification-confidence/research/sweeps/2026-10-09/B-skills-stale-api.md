# Gap follow-up 6 — agent-loaded skills, agent definitions, and `standards/git-worktrees.md`

## Gap follow-up (2.B (replace stale copied guidance with tested examples or pointers; verify agent discovery; obsolete JSDoc tags, legacy error helpers, whole-repo formatting advice); 7 canonical authorities (applicable Effect/schema skills))

`sweeps/B-skills-stale-api.md` did not exist, so this file is standalone.

### Provenance

- Checkout: lane `rsc-packet`, branch `docs/repository-simplification-confidence-packet`, head `e62411d63f` (= `main`). Date 2026-10-09. Read-only; nothing in the checkout was written.
- Installed Effect: `node_modules/effect/package.json` version `4.0.2`; API truth = `node_modules/effect/dist/<Module>.d.ts`.
- Scope (105 files, 17,379 lines): `.claude/skills/**/*.md` excluding `impeccable/`, `.claude/agents/*.md` (7), `.codex/agents/*.toml` (7), `.grok/skills/**` (1), `standards/git-worktrees.md` (438 lines, read in full).
- Commands: `rg -n -o '(^|[^A-Za-z0-9_.$])(Effect|Layer|Schema|S|Config|Context|Schedule|Stream)\.[A-Za-z_]\w*'` over the file list (506 occurrences, 123 unique names), then per-name `grep -E '^export (declare )?(const|function|class|type|interface|namespace) <n>\b|^export \{…<n>…\}'` against the module `.d.ts`; a second pass over `A/O/P/R/Str/Cause/Match/Redacted/Fiber/Exit/Duration/Data`; `rg -F` for the stale-advice literals; backtick + markdown-link path existence check; `git ls-files`, `jq` on `.claude/settings.json` and `package.json`.

### 1. Effect API names absent from effect 4.0.2

16 of 123 unique names failed the export check. 6 are noise: `Config.ts`, `Effect.ts`, `Layer.ts`, `Schema.ts`, `Fiber.ts` (source-file paths), `Schema.org` (prose), `Effect.run*`/`S.OptionFrom*` (wildcards; `OptionFromNullOr`, `OptionFromOptional` exist). `S.Array` is a false positive (`declare const ArraySchema` + multi-line `export { ArraySchema as Array }` in `Schema.d.ts`). `O.getSomesStruct` is the `@beep/utils` Option helper, which the skill says it is. `Fiber.runLoop` is quoted runtime error text.

These names are really absent:

| Name in guidance | Where (file:line) | Status in 4.0.2 | Replacement |
| --- | --- | --- | --- |
| `S.toArbitrary(schema)` | `.claude/skills/schema-first-development/SKILL.md:120`; `…/schema-first-development/references/repo-laws.md:166`, `:220`; `…/schema-first-development/references/pattern-catalog.md:125`; `.claude/skills/crispen/references/crispening.md:110`, `:173` | not exported from `Schema.d.ts` | `Arbitrary.schema(schema)` from `effect/Arbitrary` (`Arbitrary.d.ts`, `export declare function schema`). Live repo usage: `packages/architecture-lab/config/test/WorkItemConfig.test.ts` (`Arbitrary.schema(WorkItemPublicConfig)`), `packages/workspace/server/test/WorkspaceVaultStore.test.ts` |
| `Config.int("PORT")` | `.claude/skills/effect-first-development/references/resilience-recovery.md:45` (code example) | absent | `Config.Int("PORT")` (`Config.d.ts`, `export declare function Int`); `Config.Port` also exists |
| `Config.redacted(...)` | `…/effect-first-development/references/resilience-recovery.md:46` (code); `.claude/skills/effect-first-development/SKILL.md:75` (law 34 text) | absent | `Config.Redacted(name)` (`Config.d.ts`, `export declare function Redacted`) |
| `Effect.zipRight(...)` | `…/effect-first-development/references/observability-runtime.md:55` (code, inside `Effect.catchCause`) | absent | `Effect.andThen(...)` (`Effect.d.ts`, `export declare const andThen`) |
| `S.pattern(/…/)` | `.claude/skills/jsdoc-annotation-specialist/references/annotation-patterns.md:45` (code) | absent | `S.String.check(S.isPattern(/…/))` (`Schema.d.ts`, `export declare function isPattern`; `check` exported) |
| `S.filterGroup` | `.claude/skills/crispen/SKILL.md:81` (sample comment) | absent | `S.makeFilterGroup` (`Schema.d.ts`, `export declare function makeFilterGroup`) |
| `S.NonEmptyTrimmedString` | `.claude/skills/jsdoc-annotation-specialist/references/conventions.md:73` (the "After" JSDoc example, imports `effect/Schema`) | absent from `effect/Schema` and from `packages/**` | `S.Trimmed.check(S.isNonEmpty())` or `S.NonEmptyString.check(S.isTrimmed())` (all four exported) |
| `S.optionalWith(s, { exact, default })` | `.claude/skills/crispen/references/crispening.md:24` | absent, but named only as "the v4 form of" the v3 API | none needed; keep as a historical pointer or drop the v3 name |

The names the gap item listed are not used in scope as advice: `S.TaggedErrorClass`, `Effect.catchAll`/`catchSome`/`fork`/`join`/`tapErrorCause`, `Context.Tag`: 0 occurrences. One mention is a detection command, not advice: `.claude/skills/effect-first-development/SKILL.md:151` (`rg -n "catchAll\\(|Effect\\.catch\\(" …`). `Effect.catch` exists in 4.0.2 (`catch_ as catch`), so that scan line flags valid v4 code as well. `Cause.squash` and `Cause.pretty` exist.

### 2. Stale-advice literals

| Pattern | Hits | Verdict |
| --- | --- | --- |
| `from "effect"` / `from 'effect'` (root barrel) | 0 | clean |
| `biome check . --write` | 0 | clean |
| `basic-memory`, `codegraph`, `graphiti`, `cognee` | 0 each | clean; no memory-service advice in scope |
| `@example` / `@remarks` | 13 lines / 17 lines | almost all forbid the tags (`.claude/skills/jsdoc-annotation-specialist/SKILL.md:40`, `:61`, `:81`, `:93`; `references/conventions.md:24-26`; `references/agent-lifting-and-greps.md:27-28`, `:49`, `:53-54`; agents `jsdoc-annotation-specialist.md:21` / `.toml:19`, `effect-first-developer.md:46` / `.toml:43`). `references/conventions.md:41-43` is the labelled "Before" sample. **One live contradiction:** `.claude/agents/jsdoc-annotation-specialist.md:29` and its mirror `.codex/agents/jsdoc-annotation-specialist.toml:27` list "`@remarks` for invariants, ordering, idempotency, complexity" as a sanctioned conditional tag. Line 21 of the same file says `@remarks` is forbidden repo-wide |
| `bun run docgen` as an edit-loop step | 1 | `.claude/skills/effect-first-development/SKILL.md:161` (step 26 of the review checklist, after `bun run check` / `lint` / `test` at `:158-160`). Root `docgen` = `bun run beep docgen local --full` (`package.json`), the repo-wide proof that AGENTS.md "Docgen" reserves for final proof. Agents use `docgen:local` correctly (`.claude/agents/*.md`, `.codex/agents/*.toml`, `jsdoc-annotation-specialist/SKILL.md:101`, `yeet/SKILL.md:482-484`) |
| Whole-repo formatting/fix | 1 | `.claude/skills/quality-review-fix-loop/SKILL.md:65` makes `bun run lint:fix` (= `beep-cli lint --fix`, whole repo) the baseline, and `:69` repeats it as the portable fallback. It conflicts with AGENTS.md package-verify/filtered-check guidance |

Related checklist problem: `.claude/skills/effect-first-development/SKILL.md:135-157`. All 22 `rg` scans target `apps packages tooling` (and `infra`), but there is no root `tooling/` directory at head (`ls tooling` fails; tooling lives at `packages/tooling/`), so every scan prints an rg error for that path.

### 3. Backticked and linked repo paths missing at head

188 raw misses. Most are bare filenames that resolve relative to a packet (`DECISIONS.md`, `SPEC.md`, `components.json`, …), runtime artifacts (`.beep/**`), the git-ignored `graft/` and `explorations/ATLAS.md` (`.gitignore:124`, described as git-ignored at `yeet/SKILL.md:448`), or packet-relative `research/SOURCES.md` (`explore/SKILL.md:56`, `:92`, `:114`; `codex-findings/SKILL.md:82`). Excluding those leaves these genuine stale paths:

| Stale path | Where | Current location |
| --- | --- | --- |
| `packages/iam/client/src/core/atoms.ts` | `.claude/skills/atom-reactivity-specialist/SKILL.md:87`; `…/references/service-pattern.md:3` | no `iam` package at head. Atom files live e.g. under `apps/professional-desktop/src/chat/ui/*.atoms.ts` |
| `packages/tooling/tool/cli/src/commands/VersionSync/internal/Models.ts` | `.claude/skills/schema-first-development/references/examples.md:115`, `:166` | `internal/` removed. Schemas are now `packages/tooling/tool/cli/src/commands/VersionSync/VersionSync.schemas.ts` |
| `packages/common/schema/src/` | `.claude/skills/schema-first-development/references/local-primitives.md:88` | `packages/foundation/modeling/schema/src/` |
| `packages/ai/sdk/test/conventions-guard.test.ts` | `.claude/skills/schema-first-development/references/repo-laws.md:238` | absent; no `conventions*guard` file tracked |
| `packages/fixture-lab/specimen` | `.claude/skills/grill-with-docs/SKILL.md:31`, `:102`; `.claude/skills/quality-review-fix-loop/SKILL.md:52` | absent; no `fixture-lab`/`specimen` path tracked |
| `.cursor/mcp.json`, `docs/adr/` | `.claude/skills/shadcn/mcp.md:19`; `.claude/skills/grill-with-docs/ADR-FORMAT.md:4` | intentional (vendor table; "do not create") — not defects |

Stale repo name: `.claude/skills/grill-with-docs/SKILL.md:3` (frontmatter `description`, which agents use for discovery) and `ADR-FORMAT.md:5` say "beep-effect2 architecture work".

Agent discovery: `.agents/skills -> ../.claude/skills` and `.agents/agents -> ../.claude/agents` are tracked symlinks (`git ls-files -s .agents`, mode 120000), matching the `.codex/config.toml:3-5` comment. `.grok/skills/graft/SKILL.md` is a hand copy of `.claude/skills/graft/SKILL.md` that has drifted: it lacks the 26-line "Repo notes (beep-effect)" block (`diff` hunk `150a151,176`, covering `.repos/effect-workspace` routing and refs timer rules).

### 4. `standards/git-worktrees.md` (read in full) vs AGENTS.md

AGENTS.md and the doc agree on the sibling `-worktrees` root (l.12, l.127-131), `yeet sweep --retire` (l.178-199, near-verbatim copy of the AGENTS.md "Post-merge closeout" bullet), and `.claude/worktrees/<name>` lanes being retirement-eligible (l.20-22, l.176-177). Contradictions and stale statements:

1. **Clone layout (l.3-5, l.365-381 "Migration From Duplicate Clones").** The doc says worktrees replace duplicate full clones such as `beep-effect2`/`beep-effect3`, and "Use this sequence instead of creating another `beep-effectN` clone". AGENTS.md assumes several owning clones, each with its own lane root: "sweeps its owning clone", "Run it from the lane, never from the clone", `--lane` from "any sibling lane of the same clone". The workstation has about 25 numbered clones, most with their own `-worktrees` root (`ls ~/YeeBois/projects`), plus `beep worktree fleet` (`packages/tooling/tool/cli/src/commands/Worktree/Fleet.command.ts`) and `goals/fleet-root-registry/`. The framing is obsolete.
2. **Future tense for shipped work (l.404-406).** It says the archive-first `bun run beep worktree remove <name> --archive` "lands in #956 and becomes the sanctioned path once merged", but l.170-173 of the same doc already call it the sanctioned path.
3. **Incomplete command list (l.133-137, l.139-155).** Only `new|remove|doctor` are listed. The CLI also ships `worktree reap [--apply] [--json] [--idle-hours]` and `worktree fleet [--json]` (`Worktree.command.ts`, `worktreeCommand` help text and `Command.withSubcommands`).
4. **False Codex config claim (l.339-342).** The doc says "`.codex/config.toml` uses `approval_policy = "on-request"` and `sandbox_mode = "workspace-write"`". The file sets neither, and `.codex/config.toml:6-7` says approval defaults "are intentionally inherited from the user's ~/.codex/config.toml; this project does not narrow them."
5. **`.beep` handling contradicts itself (l.105-112 vs l.140-145 vs l.386).** l.110 lists `.beep` among local files to restore. `worktree new` does not copy it, and l.386 says `.beep` is "intentionally local to each worktree".
6. **Branch prefix mismatch.** The manual example (l.49) uses `worktree/feature-x`, but tooling defaults to `feat/<name>` (l.140; `Worktree.service.ts` examples use `feat/feature-x`).
7. **Misplaced section (l.157-166 "Admission eviction protocol rollout").** It covers the scheduler protocol, not worktrees, and belongs with the scheduler/admission runbook.
8. **Minor issues.** l.13 and l.78 name a "starter worktree" `playground` that does not exist under `beep-effect3-worktrees`. l.317 refers to `.worktreeinclude`, which is not present (the doc already says it is not part of the default setup). l.389-390 lack a blank line before the `## Shared Multi-Agent Worktrees` heading.

Verified true: the `.claude/settings.json` allow list (`git worktree list/prune`, `gh pr view/checks/list`, `gh run list/view`, `git update-ref refs/archive/`, `bun run beep yeet sweep`, `bun run beep worktree new/doctor/remove`) and deny list (`git worktree remove --force`, `bun run beep worktree remove --force`, `git clean`, `git reset --hard`, `git checkout .`, `git stash clear/drop/pop`) match l.309-314 and l.395-404. `flake.nix`, `.mcp.json`, and the cited reflection `goals/epistemic-bitemporal-edge-core/history/reflections/2026-07-25-claude.md` exist.

### Proposed plan (implementing lane)

1. Replace the 8 absent API uses with the 4.0.2 names in the table: `Arbitrary.schema` ×6, `Config.Int`, `Config.Redacted` ×2, `Effect.andThen`, `S.isPattern` via `.check`, `S.makeFilterGroup`, `S.Trimmed.check(S.isNonEmpty())`. Better still, swap the copied snippets for pointers to a tested in-repo example (for `Arbitrary.schema`: `packages/architecture-lab/config/test/WorkItemConfig.test.ts`).
2. Delete the `@remarks` bullet at `.claude/agents/jsdoc-annotation-specialist.md:29` and `.codex/agents/jsdoc-annotation-specialist.toml:27`, and move "invariants, ordering, idempotency, complexity" to `**Details**`/`**Gotchas**`.
3. In `effect-first-development/SKILL.md:135-161`, change `tooling` to `packages/tooling` (or drop it, since `packages` already covers it), make step 26 `bun run docgen:local`, and make steps 23-25 package-scoped (`bun run beep quality package-verify <@beep/pkg>`). Narrow the scan at `:151` to `catchAll\(` only.
4. In `quality-review-fix-loop/SKILL.md:65-69`, replace the whole-repo `lint:fix` baseline with the Yeet/package-verify path.
5. Repoint or remove the 5 stale package paths, and change "beep-effect2" to "beep-effect" in the `grill-with-docs` description and ADR-FORMAT.
6. Turn `.grok/skills/graft/SKILL.md` into a symlink to `.claude/skills/graft/SKILL.md` (as `.agents/skills` is), or regenerate it.
7. Rewrite `standards/git-worktrees.md` as a short pointer doc: keep the "what a worktree is", restore, and shared-worktree hazard sections, and point retirement at AGENTS.md instead of copying it. Drop the clone-migration framing, the #956 future tense, the false Codex config claim, and the eviction section (move it to the scheduler runbook). Add `reap`/`fleet`, and settle `.beep` and the branch prefix.

### Open questions

- Whether `@beep/utils` really exports `O.getSomesStruct`. Two `packages/**` files reference it, but the export was not traced.
- Whether `packages/fixture-lab/specimen` and `conventions-guard.test.ts` were renamed or deleted. `git log --diff-filter=D` points only to an untitled "saving progress" commit (`8b3e6d9ad2`); the successor was not identified.
- Whether the effect-first scan list at `SKILL.md:135-157` is consumed by any tool (fixture or lint) or is prose only. No consumer search was run.
- The intended canonical clone/fleet doctrine (single clone plus lanes, or N clones each with lanes) lives in `goals/fleet-root-registry/`, which was not read. Item 4.1 follows the live AGENTS.md wording and the observed workstation layout.
