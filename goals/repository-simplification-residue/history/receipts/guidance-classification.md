# #1856 guidance currency and artifact classification: wave 1 record

Lane `residue-guidance`, wave 1, branched from `main` at `e3ee18dfd7`. Source evidence: the B-lane handoff
[goals/repository-simplification-confidence/history/handoffs/rsc-b-standards-2026-10-14.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/handoffs/rsc-b-standards-2026-10-14.md)
and its 2026-10-09 sweep
[goals/repository-simplification-confidence/research/sweeps/2026-10-09/B-standards.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/research/sweeps/2026-10-09/B-standards.md).

## Scope

The guidance surface is every Git-visible file in these areas:

| Area | Files |
| --- | --- |
| `standards/**/*.md` | 38 |
| `.patterns/**` | 7 |
| `docs/**` (excluding the private `_internal` and generated `generated` subtrees) | 76 |
| root `AGENTS.md` (the root `CLAUDE.md` is its symlink) | 1 |
| per-package and per-app `AGENTS.md`/`CLAUDE.md` (not under `goals/` or `explorations/`) | 99 |
| `.claude/skills/*/SKILL.md` and `references/**` | 64 |
| other `.claude/skills/**/*.md` support files | 36 |
| `.claude/agents/*.md` | 7 |
| `.codex/**` | 14 |
| Total | 342 |

Goal and exploration packets are out of scope. They are immutable history.

## Gap: the B-lane private inputs were not preserved

The B lane's 44 private guidance previews and its 457-directive inline review
lived in the lane's gitignored `rsc-resume` working directory. They were not preserved
when the lane retired. This wave did not reconstruct them. It classified the
surface from a fresh source scan of `e3ee18dfd7` and re-derived every finding
from current source and the installed Effect declarations.

## Method

The scans below run from the repository root. They read the working tree and
skip the `node_modules`, `.git`, `.repos` and `.beep` directories.

1. **Surface listing.** `rg --files --hidden` filtered to the area rules in the
   scope table.
2. **Effect API scan.** For each Markdown file on the surface:
   - In every `ts`, `tsx`, `typescript`, `js`, `javascript` or `mts` fence, map
     `import * as X from "effect/M"` and `import { a } from "effect/M"` to
     their modules. Add the default aliases `S` = Schema, `O` = Option,
     `A` = Array, `Str` = String and `P` = Predicate, plus every top-level
     `effect/<Module>` name, unless the fence imports that local name from a
     non-Effect module. Check each `Alias.member` against the runtime keys of
     `effect/<Module>` and the `export` declarations in
     `node_modules/effect/dist/<Module>.d.ts`.
   - In inline code spans outside fences, check each `Module.member` or
     `Alias.member` whose module is a top-level Effect module the same way.
   - A reference that resolves in neither place is unresolved.
3. **Pointer scan.** Outside fences, match every token that starts with an
   existing top-level directory name and contains a `/`. Skip placeholders
   (`<`, `>`, `{`, `}`, `*`, `$`, `...`) and strip `:line` suffixes and
   `#anchors`. A token that does not exist relative to the repository root is
   missing.
4. **Repository gates.** `bun run beep knowledge refs --check`,
   `bun run beep knowledge doctor`, `bun run beep laws retired-effect-paths`,
   `bun run lint:effect-imports-markdown` and `bun run beep skills update --check`.
5. **Manual read.** Each file flagged by steps 2 to 4 was read in full. The
   manual read also covered the files the 2026-10-09 B sweep named as copied
   upstream guidance.
6. **Classification.** A file is `stale-api` when it teaches an Effect,
   `@beep/*` API, module path or command that no longer exists. It is
   `stale-pointer` when a link or path no longer resolves. `superseded` marks
   a document replaced by a newer canonical one. `historical` marks an
   immutable record (dated research lanes, the architecture decision record,
   the memory decision log and assessments). Everything else is `current`.
7. **Example compile (partial, not an as-written proof).** The repository has
   no root script that compiles Markdown TypeScript fences;
   `lint:effect-imports-markdown` checks import paths only. A fence-aware diff
   (changed lines inside a `ts`/`typescript`/`tsx` fence of three or more
   backticks) shows this wave edited fence content in 13 files. Another 8
   files it touched contain TypeScript fences that it left unchanged.
   The 13 files are:
   `.claude/skills/crispen/SKILL.md`,
   `.claude/skills/crispen/references/crispening.md`,
   `.claude/skills/effect-first-development/references/observability-runtime.md`,
   `.claude/skills/effect-first-development/references/resilience-recovery.md`,
   `.claude/skills/jsdoc-annotation-specialist/references/annotation-patterns.md`,
   `.claude/skills/jsdoc-annotation-specialist/references/conventions.md`,
   `.patterns/effect-library-development.md`,
   `.patterns/error-handling.md`,
   `.patterns/jsdoc-documentation.md`,
   `.patterns/module-organization.md`,
   `.patterns/testing-patterns.md`,
   `standards/architecture/10-cross-slice-coordination.md`,
   `standards/effect-first-development.md`.
   A scratch project of six files (strict, `exactOptionalPropertyTypes`,
   NodeNext resolution against the workspace `node_modules`) type-checked
   adapted copies of the changed Effect blocks with zero errors. Those copies
   add local declarations for names the fences leave undeclared. So they prove
   that the cited Effect and `@beep/*` APIs exist with the signatures used.
   They do not prove that any fence compiles as written, and some cannot:
   - `.patterns/error-handling.md` uses the undeclared `riskyOperation` and
     `operation`;
   - `.patterns/module-organization.md` imports a relative `./Cause.ts`.

   (`$SharedUseCasesId` in `standards/architecture/10-cross-slice-coordination.md`
   is not a blocker: `@beep/identity` re-exports it from `packages.ts`, and its
   composer has `create`.)

   All 13 files are therefore unproven as written. The wave-3 fence check
   (remaining item 2) owns that proof.

## Classification at `e3ee18dfd7`

| Area | Before | After |
| --- | --- | --- |
| standards | current 24, stale-api 4, stale-pointer 4, historical 4, superseded 2 | current 32, historical 4, superseded 2 |
| patterns | current 1, stale-api 6 | current 7 |
| docs | current 52, stale-pointer 7, historical 17 | current 59, historical 17 |
| root agents | current 1 | current 1 |
| package agents | current 98, stale-api 1 | current 99 |
| skills | current 48, stale-api 10, stale-pointer 6 | current 64 |
| skills support | current 35, stale-pointer 1 | current 36 |
| claude agents | current 7 | current 7 |
| codex | current 14 | current 14 |
| **Total (342)** | **current 280, stale-api 21, stale-pointer 18, historical 21, superseded 2** | **current 319, historical 21, superseded 2** |

| Scan | Before | After |
| --- | --- | --- |
| Effect API references checked / unresolved | 1817 / 93 in 29 files | 1815 / 44 in 17 files |
| Pointer tokens checked / missing | 1169 / 131 | 1116 / 57 |
| `knowledge doctor` introduced | 0 | 0 (working tree; rerun on the commit) |
| `laws retired-effect-paths` findings | 0 | 0 |
| `lint:effect-imports-markdown` touched files | 0 | 0 |
| `skills update --check` | current, with a 599-line advisory on the ontology-foundational-auditor skill | current, no advisory |

The two `superseded` files are
`standards/memory-architecture/06-agent-memory-operations.md` and
`standards/memory-architecture/07-shared-memory-adoption.md`. Both carry a
"SUPERSEDED, do not follow" banner and the memory decision log cites them, so
they stay as bannered history.

## What was fixed

- **Removed Effect APIs, rewritten against the installed declarations:**
  `S.TaggedErrorClass` became `S.TaggedError` with `$I.annoteError`;
  `Effect.catchAll`/`catchSome`/`tapErrorCause`/`orElse`/`fork`/`join` became
  `Effect.catch`/`catchIf`/`tapCause`/`catch`/`forkChild` and `Fiber.join`;
  `Effect.zipRight` became `Effect.andThen`; the removed `Schedule.whileInput`
  composition became `Effect.retry({ schedule, times, while })`;
  `TestClock.advance` became `TestClock.adjust`; `Config.int`/`Config.redacted`
  became `Config.Port`/`Config.Redacted`; `S.toArbitrary` and the `FastCheck`
  re-export became `Arbitrary.schema` from `effect/Arbitrary` with `it.prop`;
  `S.pattern` became `S.check(S.isPattern(...))`; `S.NonEmptyTrimmedString`
  became `S.Trimmed.check(S.isNonEmpty())`; `S.isIncludes` became
  `S.isIncluding`; `S.filterGroup` became `S.makeFilterGroup`;
  `SchemaTransformation.transformOrFail` became `transformEffect`;
  `S.Defect` became `S.Defect()`; `Context.Tag` became `Context.Service`.
- **Corrupted examples:** 43 `.ts` to `.ts-morph` bulk-replace corruptions in
  `.patterns/module-organization.md` (38), `.patterns/effect-library-development.md`
  (4) and `.patterns/error-handling.md` (1) were reverted. The whole-repo
  `biome check . --write` instruction became a changed-files form in
  `.patterns/README.md` and `.patterns/effect-library-development.md`.
  `module-organization.md` now states that its `effect` package paths describe
  the upstream Effect repository layout.
- **Stale pointers:** references to retired packages and files (the iam
  client atoms, the fixture-lab specimen, the old common schema package, the
  scratchpad schema proofs, the web app runtime layer, the old VersionSync
  models file, the dockview scratchpad modules and the illustrative iam,
  billing and notes package names) now point at live code such as
  `packages/agents/client/src/Chat.atoms.ts`, `packages/architecture-lab/`
  and `packages/foundation/ui-system/dock`, or are marked illustrative. Pointers into the deleted
  `trustgraph-port`, `ip-law-knowledge-graph`, `knowledge-workspace` and
  `ontology-modeling-foundation` packets now name the packet and say to recover
  it from git history. The two `agent-memory-infra` research lanes were edited
  only at the pointers `knowledge refs --check` flags.
- **Agent discovery:** `.claude/skills/ontology-foundational-auditor/SKILL.md` was 599 lines.
  Its "Known Limits" and "Anti-Patterns" sections moved verbatim into
  `.claude/skills/ontology-foundational-auditor/references/known-limits.md` and
  `.claude/skills/ontology-foundational-auditor/references/anti-patterns.md`,
  leaving a 499-line `SKILL.md` that links both. `skills-lock.json` was regenerated with
  `bun run beep skills update`.

## Residue dispositions

### Effect API scan: 44 unresolved, none actionable

| Category | Count | Example |
| --- | --- | --- |
| File names read as module members (`Layer.ts`, `Function.ts`, `Version.ts`) | 17 | role-file tables in `standards/ARCHITECTURE.md`, upstream fences in `.patterns/module-organization.md` |
| Repo helper under an Effect alias (`O.getSomesStruct` from `@beep/utils`) | 8 | `standards/effect-first-development.md`; 3 in `standards/architecture/DECISIONS.md` |
| String literals, not calls (`Effect.fn` span names, a quoted runtime error) | 5 | `Effect.fn("Config.loadPort")`, the `Fiber.runLoop` error message |
| Wildcard family mentions (`S.OptionFrom*`) | 4 | `.claude/skills/schema-first-development/SKILL.md` |
| Native JavaScript (`Array.prototype.sort`, `Symbol.for`) | 4 | the "never native sort" laws |
| Intentional removed-API statements | 3 | `S.optionalWith` in the crispen table, `Schema.toArbitrary` in the XState runbook, `Duration.DurationInput` in `DECISIONS.md` |
| Placeholder identifiers (`ModuleName`) | 2 | `.patterns/effect-library-development.md` |
| Historical review log | 1 | `Path.resolve` in `.claude/skills/ontology-foundational-auditor/REVIEW-HISTORY.md` |

The one actionable hit in this class, `S.Layer` in
`standards/architecture/04-rich-domain-model.md`, was rewritten. The
`Int.ts`/`Number.ts` pointers in `local-primitives.md` were replaced with the
existing `Double.ts`, `Float.ts` and `UnitInterval.ts`.

### Pointer scan: 57 missing, none actionable

| Category | Count | Example |
| --- | --- | --- |
| Local-only or generated by design (local Claude settings, IDE project files, the agent worktrees directory, the private and generated docs subtrees, the Graft cache) | 20 | `standards/git-worktrees.md`, `docs/README.md`, `docs/runbooks/graft-local-recovery.md` |
| Relative to a stated base (a packet's research ledger, a skill's `scripts/`, a package's `scripts/`, a link whose target resolves) | 10 | `.claude/skills/explore/SKILL.md`, `packages/drivers/runpod/AGENTS.md` |
| Prose slash compounds, not paths ("docs/tests", "scripts/templates") | 9 | `standards/ARCHITECTURE.md`, `docs/graphs/graph-ai.md` |
| Historical files | 7 | `standards/architecture/DECISIONS.md`, `docs/agent-memory-infra/supermemory-clone.md` |
| Upstream-relative paths (vendored shadcn skill, upstream Effect layout) | 4 | `.claude/skills/shadcn/SKILL.md`, `.patterns/module-organization.md` |
| Brace-expanded lists the scanner cannot expand (all three files exist) | 3 | `docs/product/prose-to-proof.md` |
| MCP method names (the list-tools and call-tool methods) | 3 | `packages/foundation/capability/mcp-kit/AGENTS.md` |
| Scanner truncation at `%` (the patch file exists) | 1 | `docs/runbooks/xstate-effect-statecharts.md` |

## Inline directive census (classify only)

Command: `rg --only-matching -P` over the working tree, skipping
the `node_modules` and `.beep` directories and `*.md` and `*.jsonl` files, for a comment lead
(`//`, `/*`, `{/*`, `#`, `<!--`, `*`) followed by one of the directive forms in
the table. `rg` honors `.gitignore`, so the count covers Git-visible files.

Total: 660.

| Kind | Count | Largest areas |
| --- | --- | --- |
| `fallow-ignore` | 240 | tooling CLI 66, effect-drizzle 11, ui 10, retired:venice-ai 10, labs 9, `vitest.setup.ts` 8 |
| `@effect-diagnostics` | 131 | scratchpad tests 119, `vitest.setup.ts` 6, tooling CLI 3 |
| `@ts-expect-error` | 121 | effect-drizzle 72, scratchpad tests 27, html 5, identity 4 |
| `biome-ignore` | 57 | scratchpad tests 15, scratchpad effected 11, tooling CLI 10, one goal packet 6 |
| `cspell:` | 37 | professional-desktop 6, repo-utils 6, tooling CLI 6 |
| coverage ignore (`istanbul`/`c8`/`v8`) | 32 | html 15, rdf 6, one exploration 5 |
| Python `noqa`/`type: ignore` | 29 | one exploration 18, tooling CLI 11 |
| `oxlint-disable` | 10 | professional-desktop 4, oip-web 4, chalk 2 |
| `@ts-ignore` | 2 | scratchpad 2 |
| `shellcheck disable=` | 1 | `scripts/cloud` 1 |

By root: `packages` 385, `scratchpad` 180, `apps` 43, `explorations` 27,
`vitest.setup.ts` 14, `goals` 6, `infra` 2, `biome.identity.jsonc` 1,
`vitest.shared.ts` 1, `scripts` 1. No `eslint-disable`, `eslint-enable`,
`@ts-nocheck` or `prettier-ignore` directives exist.

## Agent discovery

- `bun run beep skills update --check` reports `current` with no line-count
  advisory.
- All 81 `CLAUDE.md` symlinks resolve.
- 90 path references across 101 `AGENTS.md` files were checked. The two
  misses are in the root `AGENTS.md` and are by design: the private docs
  subtree is never committed, and the research ledger path is relative to the
  active packet.

## Remaining waves

#1856 stays `in-progress`.

1. **Inline directive review (wave 2).** Review the 660 directives
   individually: keep each with an owner and exit reason, or remove it by
   fixing the source. Start with the 240 `fallow-ignore` and the 121
   `@ts-expect-error` (72 in effect-drizzle). Coordinate the suppression-row
   overlap with #1855. No inventory or exception rows (S31).
2. **Markdown example compile gate (wave 3).** The surface has 324 TypeScript
   fences and no repository check that compiles them. Add an owned check, or
   prove each fence, so "tested current examples" holds for the whole surface
   and not only for the blocks this wave changed.
3. **Upstream-copied `.patterns` (wave 3).** `module-organization.md`,
   `effect-library-development.md` and `testing-patterns.md` still describe
   effect-smol library internals. Decide per file whether to keep it as a
   labeled upstream reference or rewrite it for this repo's package layout.

## Reversal

Revert the PR. Every edited file, `skills-lock.json` included, returns to its
`e3ee18dfd7` content, and the two new auditor reference files are removed.
