# /delete-comment skill

Lane `skill`. Repo facts read at `a1b08269809` in `<lane>`; paths are repo-relative and `cli/` abbreviates `packages/tooling/tool/cli/src/commands/`. "Measured" means run in this lane. `P` abbreviates `<scratchpad>/proto/skill`.

## Recommendation

Ship the skill in the same PR as a planned `comments` command family, after the operator rules on H and N. The skill supplies judgment; the command supplies census, protection, apply and proof. A skill that asks an agent to delete comments by hand cannot be rerun or trusted. The draft drives ten verbs (doctor, census, shard, import, sample, families, issues, verify, apply, prove), of which the prototype implements four: census, verify, apply and prove.

Run one bounded batch per PR, not one package per PR: 219 packages hold candidates, with a median of 24 candidates each, 74 packages at ten or fewer, and `packages/tooling/tool/cli` alone at 9,740 of 31,596. `AGENTS.md:210-211` caps a goal at three open PRs. Keep the ledger per package; group small packages and split the CLI by command directory.

The prototype proof is not a program-equivalence proof yet. Four holes must be closed first (see "Refutation pass"): JSX text whitespace, files it does not read, a decision gate that accepts any existing path, and ids that move.

The draft needs the edits listed in the refutation pass. Files:

- `P/delete-comment/SKILL.md` (236 lines; the advisory limit is 500)
- `P/delete-comment/references/rubric.md`
- `P/delete-comment/references/worked-examples.md`
- `P/engine/comment-law.ts`, a 135-line Bun prototype used to test the procedure. It is not repo-grade: no schemas, native Map, node fs. The goal rebuilds it in Effect and shares the scanner, grammar and fingerprint with the lint and ratchet lanes.

The skill's `comments` verbs do not exist yet. Step 8 uses the ratchet lane's `laws comments --check`, which also does not exist yet. That is the main ordering constraint. (Planned commands are written here without the live prefix, because the knowledge gate probes inline `bun run beep` spans in tracked Markdown and this file is meant for the packet.)

## The operator's four categories leave nearly three quarters of the prose unnamed

Provisional, recomputed in the refutation pass: 48 of 62 `full-*` census shards, 24,749 comment groups and 74,186 lines (prose, non-exported JSDoc, license; about 31,700 groups and 87,300 candidate lines in all). Codes are as written by the classifiers, not adjudicated, and shards run in path order, not at random. The shares moved by up to four points between 35 and 48 shards, so do not quote them as final.

| Code | Groups | Share | Lines | Line share | Operator category |
| --- | --- | --- | --- | --- | --- |
| H hazard | 10,184 | 41.1% | 29,939 | 40.4% | none |
| N narration | 6,779 | 27.4% | 15,849 | 21.4% | none |
| T tautology | 4,891 | 19.8% | 13,844 | 18.7% | Tautology |
| D decision | 1,122 | 4.5% | 8,868 | 12.0% | Decision record |
| G grouping | 1,055 | 4.3% | 1,683 | 2.3% | none |
| S stale | 336 | 1.4% | 2,225 | 3.0% | Stale |
| L license | 221 | 0.9% | 1,285 | 1.7% | none |
| X excuse | 161 | 0.7% | 493 | 0.7% | Excuse |

T, S, X and D are 26.3% of groups. With G they are 30.6% of groups and 36.5% of lines (27,113). D's 8,868 lines are partly moved, not shed: the ones that pass the ADR lane's admission test come back as decision files. Without D the figure is 18,245 lines, 24.6%. Extrapolated naively to 87,300 lines that is about 21,500 to 31,900 lines. So the 53,249-line "prose only" figure is not what this skill sheds under the recommended policy, and the three-driver run (33 of 89 groups, 57 lines) is above the corpus rate.

How the draft handles codes the operator did not name:

- G: delete with T.
- L: never delete.
- H: retain under the ratchet. Each row records where the information should go: `name`, `type`, `test`, `assert` or `keep`. The comment is deleted later, in the PR that puts the information there. Those absorption PRs change code, so they need tests and cannot use the equivalence proof. Not mapped to D: roughly 13,000 hazards as ADRs would bury the decisions. 4,841 of the 10,184 H rows (48%) name `keep`, so absorption has no target for about half of them.
- N: the same. Not mapped to T: the rubric defines N as information the code does not carry, so deletion is a loss.

Consequence for the ratchet. The ratchet lane's lock check clears a scope only at zero banned comments. With H and N retained, few scopes clear until absorption runs. The operator must choose: (a) pending scopes with no end date, (b) fold N into T, (c) exempt H `keep` in a fixed form the scanner parses. The skill works with any of them; only its action table changes.

## Frontmatter and install facts

- The check decodes strictly; unknown keys fail. Allowed keys are the Agent Skills fields (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) plus Claude Code's: `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell` (`packages/tooling/library/ai-sync/src/schemas.ts:457-479`). `metadata` values are strings (`:276`); description is at most 1,024 characters (`:186-188`).
- `name` must equal the directory name (`cli/Skills/internal/SkillFrontmatterCheck.ts:37`). The 500-line limit is an advisory (`cli/Skills/SkillFrontmatter.schemas.ts:34`); `yeet` is at 534 (measured: `beep skills update --check --offline` prints `current` plus that advisory).
- The draft's frontmatter decodes under the repo's strict decoder; its description is 619 characters. Moving `status` to the top level fails (both measured, `P/engine/fm.ts`).
- Installing: write `.claude/skills/delete-comment/`, run `bun run beep skills update`, commit the skill, one `skills-lock.json` row and one `[[skills.config]]` row in `.codex/config.toml`. The write form also refetches the floating `adhd` upstream over the network (`cli/Skills/Skills.command.ts:326,1190-1218`; `--offline` is refused outside `--check`), so it can bring an unrelated `adhd` change into the diff. An installed skill the lock does not name plans as `local` (`cli/Skills/Skills.service.ts:1578-1579`); missing Codex rows are added by `renderCodexConfigWithSkills` (`cli/Skills/Skills.command.ts:845`).
- The memory note that every skill edit changes a tree hash is out of date. Repo-authored skills other than `adhd` are not hashed since 2026-11-13 (`goals/ci-lane-economics/decisions/2026-11-13-local-skills-are-not-hashed-in-skills-lock-json.md`). Later edits need no lock refresh. Repo Sanity runs the offline check on skill paths (`.../2026-11-13-repo-sanity-owns-the-skills-lock-check.md`).
- `.claude` is a knowledge-scanner root (`cli/Knowledge/Knowledge.refs.ts:1249`), but the draft carries no unknown-command finding. The gate reads inline spans only, and a span with `<` is not a command span (`cli/Knowledge/Knowledge.refs.ts:1632-1635`). Run through `knowledgeInlineSpans` and `isKnowledgeCommandSpan`, the draft and its references yield only the two existing lint commands. The reason not to land the skill before the command is that it would drive commands that do not exist, not a red gate.

Comparable skills. `crispen` is the shape to copy: short body, hard exclusions, depth in one reference. `codex-findings` is the discipline to copy: the CLI writes the packet, refresh fails closed, identities are sticky (`.claude/skills/codex-findings/SKILL.md`, "Invariants worth knowing"). `jsdoc-annotation-specialist` owns public JSDoc, so this skill refuses it.

Conflict: `crispen` tells agents to add comments. `.claude/skills/crispen/SKILL.md:78-82` mandates a `// crispen:` marker and 48 exist in the enforced zones (measured). Change that text in the PR that turns the ratchet on.

## Harness discovery

| Harness | How it finds the skill | Evidence |
| --- | --- | --- |
| Claude Code | `.claude/skills/<name>` | native |
| Codex 0.171.0 | `.agents/skills`, a tracked symlink to `../.claude/skills`, plus `.codex/config.toml` | mode 120000 in `git ls-files -s .agents/skills`; `.codex/config.toml:3-6` |
| Grok 1.0.93 | lists project skills from `.agents/skills`, `userInvocable: true` with no extra key | measured: `grok inspect --json` in the lane gives `.agents/skills/crispen/SKILL.md` |
| Junie 26.11.2 | `.agents/skills`; `.junie/skills` holds three legacy links | memory note for 4100.5; not re-verified |
| Cursor 2026.11.22 | `.agents/skills` or `.claude/skills` | memory note for 2026.11.13; not re-verified |

No `.grok/skills` symlink and no `user-invocable: true` are needed. The memory note that Grok reads only `.grok/skills` (1.0.88) is outdated. 13 of 41 project skills show `disabled` in Grok (the ontology set, `portless`, `shadcn`, `sparql-expert`, `turborepo`, `atom-reactivity-specialist`), cause not traced; check `grok inspect` once after install.

`disable-model-invocation` is not set because, as I understand it, it would stop Claude subagents and workflow children from loading the skill (unverified). The description excludes pull-request review comments, the likeliest mis-trigger here.

## The deterministic ledger, tested

Identity. `cid` is a hash of path, comment kind, normalized text, the next 60 non-whitespace code characters with comments blanked, and an ordinal. Blanking comments lets a row's id survive deletion of its neighbours, with one exception: when two rows share text and anchor, deleting the earlier one gives the later one the earlier id, and the re-census then hands it the deleted row's verdict (reproduced). 78 rows in the measured set carry such an ordinal, 21 of them unprotected; the proof fails on them (P3). Refuse the plan when a deletion leaves an ordinal sibling behind, or tie-break on the preceding code. The ratchet lane's fingerprint deliberately carries no path, so moves are free; the two ids serve different jobs, but the goal should derive both from one function.

Measured on `packages/{drivers,foundation,law-practice,tooling}`, `apps` and `infra`: 75,679 groups, 75,679 unique cids, 8.7 s.

Full loop on copies of three packages, with the session's verdicts and placeholder ADR and issue references:

| Package | Groups | Deleted | Lines | Unprotected survivors that kept their verdict on re-census | Proof |
| --- | --- | --- | --- | --- | --- |
| freshbooks | 84 | 14 | 26 | 10 of 10 | OK |
| ffmpeg | 170 | 8 | 12 | 35 of 35 | OK |
| exiftool | 89 | 11 | 19 | 11 of 11 | OK |

Before the ADR and family fields were filled in, `verify` refused all three (4, 4 and 8 refusals): the write-before-delete gate working. Three of those refusals were empty object literals, a rule I then narrowed to blocks and class bodies.

The proof reads only non-generated TS and JS. A changed `README.md`, `package.json` or `*.gen.ts` passes (reproduced), so the real command must compare the whole git diff. Negative tests, all caught on rerun: a changed token (P1, P2, P3), deleted `fallow-ignore-next-line` lines (P3), a blank line pushed between a directive and its target (P4). A trap file with a triple-slash reference, semgrep markers, a two-line biome reason, an empty catch and JSX comments behaved as intended; the empty catch was refused. The doc-reattach refusal works for adjacent blocks and misses a case: with a `//` line between two JSDoc blocks, deleting the lower one attaches the upper one and passes (both run in the refutation pass; no live instance in the measured set).

After `biome format` with the repo's `trailingCommas: es5` the proof still passes; only the three `vitest.config.ts` files reformatted, to `test: {}`. With biome's default trailing commas it fails on most files, so always prove against the repo config. Biome `check --write` was not run.

## Why AST equality is necessary and not enough

The proof has five parts: same file set; same comment-blanked token text; same AST; surviving comments equal to the plan, each at the same code offset; each directive at the same line distance from its target. The last two, and the protection list, exist because of these, all found in the tree:

1. Twelve `/// <reference ...>` lines. The session census classes them `prose` (its regex does not allow the third slash), so the "prose only" simulation deletes them. AST equality passes; types can break. `apps/oip-web/src/app/sw.ts:2`, `packages/drivers/cosmos/src/Cosmos.renderer.ts:7`.
2. Sixteen `// ruleid:` / `// ok:` lines (15 groups), for example `.semgrep/first-party.ts:20`, read by `semgrep --test`; also classed `prose`.
3. Generated-region markers, for example `packages/foundation/modeling/identity/src/packages.ts:289`, matched by text in `cli/CreatePackage/internal/LabIdentitySegment.ts:52-100`.
4. Directive reasons that continue on a second line. Deleting the tail truncates the reason. About 20 prose groups (21 by my count) sit directly under a directive-classed group (an upper bound, because of item 5).
5. The same regex is loose the other way: Between 24 and 28 directive-classed groups, depending on the grammar, do not match an exact directive grammar; most are prose starting with words such as "Semgrep", "Region", "Istanbul's" or "Effect-Based", and four are real `gitleaks` lines. Use an exact grammar.
6. 2,615 member or census-local JSDoc blocks hold a `ts` fence (2,039 member, 44,718 lines; 576 local, 9,970 lines). Most of the 576 are not non-exported at all: in the six measured roots 406 fenced blocks sit on a declaration that is exported later by a specifier list, and 3 unfenced ones do too (`packages/drivers/git/src/internal/classification.ts:56`, exported at `:391`). The engine's `jsdoc-public` test looks only for an `export` at the declaration and must resolve export lists; the ratchet lane found the same thing (405 declarations). The doctest scan reads JSDoc, so the draft protects any fenced comment. Which of these doctest actually runs was not traced. This cuts into the +35,770 and +57,405 line increments.
7. 79 non-exported JSDoc blocks in `*.stories.*`; stories set `tags: ["autodocs"]` (`packages/drivers/graph-3d/stories/graph3d.stories.tsx:110`). Storybook uses the block above `meta`; that is general Storybook behaviour, not tested here. Protected.
8. Vendored skills under `.claude/skills` are in the census's `tooling-root` zone and are hash-pinned upstream. The simulation touched `.claude/skills/shadcn/scripts/showcase-coverage.mjs`. Exclude every vendored lock entry.
9. 10 blocks, 137 object literals and one array hold only a comment (measured). An emptied block is refused. An emptied object or array literal is allowed.
10. 138 JSDoc pairs on adjacent lines (115 public, 21 local, 2 member). Where no code sits between, deleting the lower block attaches the upper one.

11. JSX text. `foo {/* c */}<b>bar</b>` becomes `foo<b>bar</b>`: the engine eats the space before the container, P1 drops all whitespace and P2 trims JSX text, so the proof passes on a changed render (reproduced). One unprotected JSX comment shares a line with other code in the measured set and it is harmless (`packages/foundation/ui-system/ui/src/components/sidebar.tsx:807`). Fix the span and compare JSX text under JSX whitespace rules.

Effects the proof does not see:

- Generated text comes back. 142 vitest configs carry `// Package-specific overrides`, written by `cli/CreatePackage/templates/vitest.config.ts.hbs:8`, `cli/Architecture/internal/ModelFirstContext.ts:421` and `cli/Architecture/internal/PackageShell.ts:293`.
- Line numbers move. About 26,500 Markdown/goal/standards lines cite a `.ts:<line>` location (regex count; how much is retained history was not measured). `standards/schema-first.inventory.jsonc` (106 rows) and `standards/effect-vitest.inventory.jsonc` (659) store lines. Schema-first keeps reasons across a shift (`cli/Lint/internal/SchemaFirstScan.ts:489-508`). Effect-vitest keeps a reason only when the match is unambiguous (`cli/Lint/internal/EffectVitestScan.ts:395-430`), so the skill says to read that diff.
- Not checked: whether biome's import organizer reorders across a removed comment, and whether fallow's clone spans change. Both go in a separate fallout commit.

## Excuses and issues

X is rare (0.7% provisional) but clustered. exiftool's five clone excuses share one sentence and sit on `fallow-ignore-next-line` directives that already name an owner and an exit. `PositiveMilliseconds` is declared in three drivers (`packages/drivers/exiftool/src/Exiftool.models.ts:35`, `packages/drivers/ffmpeg/src/FFmpeg.models.ts:95`, `packages/drivers/obs/src/Obs.models.ts:31`). One family is one fix, keyed by the thing to export, not by the wording. The same sentence appears 11 times in eight files across six drivers (drizzle, exiftool, hubspot, obs, phoenix, sanity). No `PositiveMilliseconds` exists in `packages/foundation`, so under the rubric's own tie-break ("is the better implementation available here, now? No means H") these are H, while the worked example calls them X. Settle that before classifying; X should mean "fixable here now", including by creating the export.

`AGENTS.md:190-198` says to fix findings and never file a follow-up issue to defer fixable work, except a deferral the operator explicitly authorized. The operator's capture asks for issues; record that as a packet decision with limits. The draft's order: reuse an existing record, fix small ones in a PR, otherwise one issue per family with a machine-readable family id, and show the operator the list above 10 new issues in a run.

The stale check pays too. `packages/drivers/git/src/Git.ts:636-638` says no ref is involved in the working-tree diffs. `workingDiffOptions` now passes a caller-supplied `head` (`:669`, used at `:687` and `:700`), and the arm the comment calls unreachable reports `UnknownRefError` with `ref: "working tree"` (`:441-446`, `:657`). The arm is reachable: `sharedFailureRow` runs before the `generic` row (`packages/drivers/git/src/internal/classification.ts:205-208`, `classify`), and `git diff --name-only -z <missing ref> -- src` prints `bad revision`, one of its patterns (git run; the driver was not). An S row that exposes a defect gets the fix, not only the deletion.

## Decision home

The skill names `<package>/decisions/<date>-<topic>.md`, the ADR lane's recommendation, and `standards/architecture/DECISIONS.md` for doctrine. `.claude/skills/grill-with-docs/ADR-FORMAT.md` today sends package decisions to the README or agent guidance, and `.claude/skills/grill-with-docs/SKILL.md:133,135` says the same and bans ADR directories, so three statements change. The draft also disagrees with the ADR lane: it refuses every D without a decision file, while that lane's admission test rejects a decision whose enforcer explains itself and most sampled D rows. The D gate must accept a named enforcer or a move to H, and must decode the file it names; today `adr: "."` passes `verify` (reproduced).

## Landing order

1. Operator rulings (below) in the packet's `DECISIONS.md`.
2. Scanner, grammar and growth check (lint and ratchet lanes), then the `comments` verbs with tests from the trap file.
3. Skill, lock row, Codex row, one `AGENTS.md` Touch row (`Deleting or classifying source comments | delete-comment skill`), `crispen` text change. Same PR as the verbs or directly after.
4. Generator templates.
5. Pilot on `@beep/freshbooks` (24 candidates), then bounded batches, at most three open PRs. 109 enforced candidates sit outside every workspace package (root scripts, `.semgrep`, skills) and need a non-package scope; the draft's argument has none.

Resuming on another workstation needs the surviving verdicts. The draft commits them as `cid code home` lines under `goals/comment-law/ledger/` while the goal is open, not under `standards/`, in line with the ratchet lane's "no inventory of comments". At 69% of 31,700 (H, N, L) that is about 22,000 lines, 25 to 30 bytes each plus the home word, roughly 700 KB, split per package.

## Lane incident

While writing this report, a shell quoting error made zsh run part of the Markdown's backticked text as commands. What executed: lookups of unknown command names, one attempt at the planned `comments` command (failed, unknown subcommand), and `agent`, which resolves to the Cursor CLI. It ran without a prompt and without a terminal until I stopped the task. It stopped before reaching any `skills update` text. Checked afterwards: no Cursor process remains, the lane checkout shows only `explorations/comment-law/` untracked, and only Cursor's `statsig-cache.json` changed under `~/.cursor`. Files changed in the main checkout in the same window are build and census outputs no command of mine writes.

## Refutation pass

2026-11-21, second reviewer, same checkout. Every cited line reopened; prototypes rerun from a copy in `proto/skill-refute/`. The body above is corrected; the draft under `P` was not edited.

| Claim | Result | Evidence |
| --- | --- | --- |
| Code shares (H 38.4, N 26.2, T 23.9, D 4.4, G 4.0, S 1.4, L 1.1, X 0.6) | corrected | 48 shards now: H 41.1, N 27.4, T 19.8, D 4.5, G 4.3, S 1.4, L 0.9, X 0.7. Still path-ordered and unadjudicated |
| Four categories about 30%, about 34% with G | corrected | 26.3% and 30.6% of groups; 36.5% of lines, 24.6% without D |
| 33 of 89, 57 lines, proof OK on three drivers | confirmed | rerun: 14/26, 8/12, 11/19, all OK. Survivor counts not rerun |
| "Equivalence proof" | refuted as stated | JSX space loss passes; README, `package.json` and `*.gen.ts` edits pass |
| Three tampering tests caught | confirmed | P1-P3, P3, P4 reproduced |
| 75,679 groups, 75,679 cids, 8.7 s | confirmed | 9.9 s here |
| Deleting neighbours does not change an id | refuted in one case | identical text and anchor: the survivor took the deleted row's cid and verdict T. 78 ordinal rows, 21 unprotected |
| 117 texts repeat within a file | not reproduced | 132 prose or census-local texts repeat; 78 rows need the ordinal. Replaced |
| Doc-reattach refusal | corrected | works when adjacent, misses an interleaved `//` line |
| Adjacent-comment grouping | new | deleting a block comment between two `//` lines merges them and fails P3; a false failure under hard stop 1 |
| Multi-line tool pragmas | new | a block `@jsxImportSource` or `@vitest-environment` is not matched as a directive (the first is deletable). No live instance found |
| 12 triple-slash, 16 semgrep lines as prose; generated markers | confirmed | 12 groups, 15 groups, 4 marker groups |
| 28 loose directives | corrected | 24 with the engine's grammar in enforced zones |
| 2,615 fenced (2,039 + 576), 79 story blocks | confirmed | 406 of the local ones are exported by specifier |
| 10 blocks, 137 objects, 1 array | confirmed | parser count over enforced files with candidates |
| 142 vitest configs, three generator sources | confirmed | `git grep`, all three lines opened |
| crispen mandates markers, 48 in enforced zones | confirmed | `.claude/skills/crispen/SKILL.md:78-82`; local skill, so editable |
| Skills not hashed; lock and Codex row | confirmed with exception | `adhd` keeps its hash and is refetched by the write form |
| Frontmatter passes, top-level `status` fails | confirmed | `fm.ts` rerun on both files |
| Grok 1.0.93 lists `.agents/skills`, user-invocable | confirmed for discovery | `grok inspect --json`: crispen, yeet, unslop; 13 others disabled. Slash invocation not run |
| Junie, Cursor discovery; `disable-model-invocation` | not checked | as labelled |
| Git.ts comment hides a defect | confirmed | reachable through the shared failure row; see body |
| Landing the skill first reds the knowledge doctor | refuted | zero unknown command spans in the draft. This report had inline planned-command spans and would itself have been the finding; reworded |
| AGENTS.md:190-198 needs authorization | confirmed | an operator-authorized deferral is allowed; `CAPTURE.md` holds the request |
| 26,339 citing lines; 106 and 659 inventory lines | confirmed within noise | 26,550 with `.ts:`, 27,374 with `.tsx` |
| One package per PR | refuted | 219 packages, median 24 candidates, 74 at ten or fewer, CLI 9,740; three-open-PR cap |
| Five verbs | corrected | draft uses ten, prototype has four |
| Rubric consistent with examples | refuted | PositiveMilliseconds family is H by the tie-break and X in the example |
| D and X gates | refuted as gates | `existsSync` accepts any path (`.` passed); `issue` is any non-empty string |

Edits the draft still needs: batch scope and a non-package scope; a D outcome for "enforced, no file" and for "fails admission, becomes H"; decoded D and X references; the X tie-break; a rule for true-but-misplaced comments (the rubric says S, delete, "move nothing", which discards true information); `home` required for N as well as H, or dropped from N; and H or N codes on protected rows should not be reported as deletion codes (`refusals` flags every code except L).

Verdict: the shape survives (thin skill, engine-owned deletion, decisions and families first, H and N retained until ruled). The one-package-per-PR unit, the "equivalence" wording, the 34% figure and the knowledge-doctor reason do not.
