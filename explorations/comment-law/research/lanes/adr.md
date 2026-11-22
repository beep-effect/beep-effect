# Where a comment's decision goes

Lane `adr`. Read at `a1b08269809`. Paths are repo-relative. `repo-cli/` abbreviates `packages/tooling/tool/cli/src/commands/`.
"Measured" means run in this lane. "Provisional" means it uses the census shards that had landed. The refutation pass recomputed every provisional figure from 16,646 of 31,672 comments (prose, non-exported JSDoc and licenses); shards are contiguous by path, not random, and later packages are still missing. The last section lists what that pass changed. "Unverified" is marked where it applies.

## Recommendation

1. Home: one file per decision in the owning package, `<package>/decisions/<YYYY-MM-DD>-<slug>.md`. Reuse the goal-decision parser; add `governs` and `enforcedBy`.
2. Few of them. A decision record must pass an admission test. Hazards (code H) never become ADRs; they go to a name, type, test or assertion.
3. Enforce first, document second. A decision whose undoing turns a check red with a self-explanatory title needs no ADR; that check is its record. What remains (no enforcer, or one that does not give the reason) is the ADR set, and its retrieval is: a diff-time command in the Yeet cheap gates that prints the decisions governing changed declarations, and a tool hook that reads file paths out of `Bash` commands as well as `Read`, `Edit` and `Write`. A hook on `Read` alone would miss most reads (measured below).
   `enforcedBy` may name a test only after the stated reversal has been made in a scratch copy and that test went red.
4. Re-verify before moving. Of the eight comments converted below, one states something the code does not do and one sits on the wrong function. Copying text would have moved both errors into a document that looks authoritative.
5. Issues: one per root-cause family, opened only for hacks that cannot be fixed in the same wave, under an explicit operator authorization recorded as a decision file.

## What exists

| Mechanism | What it gives | Why it is not the home as it stands |
| --- | --- | --- |
| `standards/architecture/DECISIONS.md` (3,281 lines) | Doctrine log | `.claude/skills/grill-with-docs/ADR-FORMAT.md` limits it to decisions that "amend, supersede, retire, or clarify architecture-wide doctrine" and lists "one package's implementation detail" as a poor fit. |
| `ADR-FORMAT.md` rule for packages | "Package-local decisions belong in the affected package README or agent guidance." | This is the binding rule today. It names two single files, so it must change. The companion skill is stricter than the format file: `.claude/skills/grill-with-docs/SKILL.md:135` says "Do not create generic context files or ADR directories for this repo", with no `docs/` qualifier, and `:133` routes package-local policy to README or agent guidance. Three statements need amending, not one. |
| Goal decisions: `goals/<slug>/decisions/*.md` (1,390 files, 15,407 lines, 11.1 lines each, 116 packets) | Schema, filename grammar, excess-key rejection, projection: `repo-cli/Goals/Decisions.schemas.ts:87-140,231-248`; parse at `repo-cli/Goals/Decisions.projection.ts:123-200` | Leaves this tree. Archiving keeps only `ops/manifest.json`, `README.md`, `history/reflections/**`, `research/OPPORTUNITIES.md` (`repo-cli/Goals/Archive.schemas.ts:188`). Of 186 archived packets, 0 still have `decisions/` (measured). The text survives in the `beep-effect-goals-archive` repository that each tombstone README links, so it is retrievable by a human, but no check or agent in this checkout reads it. |
| Package tables: `packages/drivers/duckdb/AGENTS.md:25` (71 rows) and `packages/drivers/acp/README.md:229` | Id, decision, reason, reversal; source comments cite ids, e.g. `packages/drivers/duckdb/src/internal/transaction.ts:19` "(D59)" | Best local precedent for content. DuckDB's table is 32 KB of a 39.6 KB file that `CLAUDE.md` symlinks to, so it loads for any work in the package. New rows land on one tail, the conflict pattern `AGENTS.md:173-176` bans for goals. |
| Knowledge doctor | Proves path, command, `@beep/*` symbol and export claims, with witnesses, leases, baseline and base/head delta (`repo-cli/Knowledge/KnowledgeDoctor.service.ts:956-962`) | Scans ten roots and none is `packages` or `apps` (`repo-cli/Knowledge/Knowledge.refs.ts:1249-1260`). Markdown under a package gets no path, command or symbol check. It is not wholly unchecked: `lint:typos` runs repo-wide and markdown-fences compiles TypeScript fences in package READMEs and guidance files (`repo-cli/Laws/MarkdownFences.ts:167-180`). |
| Schema catalog: `standards/schema-catalog/@beep/*.generated.jsonc` (about 11,700 rows of file, symbol, kind, owner) | A generated symbol index | Schemas only. Most decisions below govern functions and module-private constants. |
| `beep docs find` | Lookup over hard-coded policy sections (`repo-cli/Docs/Docs.command.ts`) | No path lookup. |
| `$I.annote` | Schema metadata | See option C. |
| `beep history notes`, `docs/history/README.md` | Commit-message overlay in `refs/notes/history` | See option D. |
| Palantiri parcels | Account, host, GitHub and lane state for a session (`packages/tooling/library/palantiri/src/`) | Operational state, not code knowledge. Do not extend it. |
| Repo-exports catalog | Nothing | Retired in `8852619f046`. Residue: `infra/package.json:38` still defines a `repo-exports:shard` script calling `quality repo-exports-catalog`, with no implementing string in `packages/tooling`; `biome.jsonc:66` and `turbo.json:6424-6425` still exclude its files. Stale in its own right; a small fix outside this packet. |
| `packages/**/KNOWLEDGE.md` (30 files, 26,644 lines) | Upstream bundles | Headed "verbatim" (`packages/foundation/modeling/glob/KNOWLEDGE.md:1`). Not ours to append to. |

### Failure already in the tree

Comments cite decisions by bare id; some ids no longer resolve and others are ambiguous.

- `packages/law-practice/server/src/MailTagging/MailTagging.matters.ts:224`: `// D-11: a matter is a tag target only with a client number and a verified family.` Its packet, `goals/practice-mail-tagging`, was archived on 2026-11-08; neither `D-11` nor `D-12` appears there any more. Three live documents define a different D-11: `explorations/doc-hub-spokes/DECISIONS.md:118` (.docx intake), `goals/m365-agent-outbox/SPEC.md:375` (delete_draft) and `goals/repo-cli-gh-git-consolidation/SPEC.md:81` (W2b, the one `repo-cli/Yeet/internal/GitErrorAdapter.ts:70` means, by packet name). A bare id is ambiguous even when some packet resolves it.
- About 420 non-export comments in enforced zones match `D<n>`/`D-<n>` and about 580 match that or a `goals/<slug>` path (two independent regexes gave 416/590 and 419/576; upper bounds).
- `repo-cli/Ci/LaneTimings.ts:2002` cites `goals/ci-lane-economics/decisions/2026-11-13-shards-overflow-....md`. It resolves now. Archive rewrites inline code spans only in `.md`/`.mdx` (`repo-cli/Goals/Archive.service.ts:88-90`), and this is a bare path in a TypeScript comment, so I expect it to dangle after archive (read from code, not run).

So goal packets cannot be the home for a decision that governs code, and ids need a resolver.

## Options

**A. `<package>/decisions/*.md`, one file each. Recommended.** Moves with the package, no shared tail, parser exists, and `AGENTS.md` authors already know the shape. Not published: `packages/drivers/duckdb/package.json` `files` lists only `src` and `dist`. Cost: a scanner-scope change and an anchor check. Turbo: `build`, `check` and `test` take `$TURBO_DEFAULT$` minus `README.md` and `CHANGELOG.md` (`turbo.json:5716-5720,5781-5784,5812-5816`), so a decision edit rehashes the package, exactly as editing a comment does today. Adding `!decisions/**` would improve on today but moves cache baselines; leave it out of the first slice.

**B. `DECISIONS.md` per package.** One file to open; same tail-conflict and growth as the DuckDB table. Reject for new decisions. Keep the two existing tables until each is converted on its own merits; they are not comments.

**C. Schema annotations or a typed registry in code.** Reject. It moves prose from a comment into a string literal, so the ban is passed and no line is saved, and annotations ship at runtime. It reaches schemas, not functions, layers or SQL. One legitimate use: wire-field text that a model or client reads. `DocketIntake.agents.ts:179-205` already does this with `annotateKey({ description })`. That is documentation of the contract, not a decision.

**D. Git notes.** Reject. Notes attach to commits, not symbols; `docs/history/README.md` says github.com does not show them, a workflow force-pushes the ref, and clones need `beep history notes sync`.

**E. Commit trailers.** Reject as home. PRs are squashed; finding a decision means blame, and a move or reformat hides it; a trailer cannot be superseded.

**F. Central `standards/decisions/<owner>/`.** Runner-up. The doctor already scans `standards` and package hashes stay still. It separates the record from the code, and deleting or moving a package leaves it behind.

Boundary between homes: repo-wide doctrine goes to `standards/architecture/DECISIONS.md`; how a goal was run goes to `goals/<slug>/decisions/`; why this code is this way goes to the package. A goal decision that governs code is restated in the package before the packet is archived, and archive should refuse while TypeScript still cites the packet's decisions.

## Admission test

All three, else no ADR:

1. A named rejected alternative that a competent agent would choose again.
2. Undoing the decision stays green, or turns a check red without telling the reader why. (So a decision with a good enforcer is out by definition. An earlier draft also listed the enforcer as the first retrieval route for ADRs; the two cannot both hold.)
3. It governs more than one statement, or crosses a security, legal, protocol, data or package boundary.

Otherwise use the first rung that works:

| Rung | Use when |
| --- | --- |
| Name | The comment gives a unit, role or sense: `retryDelayMillis`, `taggableKeys`. |
| Type or schema | The comment states an allowed set, absence, ordering or identity: `LiteralKit` in place of `-1/0/1`, `Option` in place of a sentinel, a class in place of an anonymous struct, `never` in the error channel. |
| Assertion or check | The comment states an invariant of a value: `S.makeFilter` with a message. |
| Test title | The comment states behaviour: the sentence becomes the title. |
| Exported JSDoc `**Gotchas**` | The caller, not the maintainer, needs it. Subject to the rule another lane settles for exported JSDoc. |
| ADR | None of the above carries the why. |

Provisional: of 6,699 H rows the classifier says test for 2,374, name for 622, type for 342, assert for 208 and "keep" for 3,153 (47%). Hazards are 40% of non-export comments. At 10.6 lines per ADR, making all of them ADRs would add about 135,000 lines. The ladder is what makes the programme pay, not the ADR directory.

## File schema

Extends `GoalDecisionFrontmatter`; same filename grammar, same `onExcessProperty: "error"`, same `reversal`.

```ts
// design sketch, not compiled
class CodeDecisionFrontmatter extends S.Opaque<CodeDecisionFrontmatter, { readonly brand: unique symbol }>()(
  S.Struct({
    title: SingleLine,
    date: GoalDecisionDate,
    reversal: SingleLine,
    governs: S.NonEmptyArray(CodeAnchor),
    enforcedBy: S.Array(EnforcerAnchor),
    supersedes: S.optionalKey(GoalDecisionFileName),
    pullRequest: S.optionalKey(S.Int.check(S.isGreaterThan(0))),
  })
) {}
```

- `CodeAnchor` is `<package-relative path>#<declaration>`. The declaration is any named `const`, function, class, interface or type in the file, exported or not. No line numbers. No body hashes: they would red on every refactor.
- `EnforcerAnchor` is `<test path>#<describe or test title>`, or `lint:<rule>`, and is written only after the reversal was shown to turn it red. An empty array is legal and is reported as a count, because it marks a decision protected by prose alone.
- The slug is the id. No `D<n>`.
- Body: at most 12 lines. The decision, the reason, `Rejected:` for the alternative, `Accepted limit:` if any. No code fences, so nothing needs compiling.
- Superseding deletes the old file in the same PR; git keeps it. That makes "which one is live" a directory listing.
- `CodeDecision` is a sibling of `GoalDecision`; move `SingleLine`, the date and filename schemas and the frontmatter reader to one shared module rather than copying them.

`ADR-FORMAT.md` amendment (and matching edits at `SKILL.md:133,135`): "Package-local decisions that pass the admission test are one file each under `<package>/decisions/`; ownership and usage notes stay in the package README or agent guidance."

## Checks

- `beep decisions check`: frontmatter decodes; every anchor resolves; no live comment cites a `D<n>` that has no file. Anchor resolution uses the TypeScript AST already available through `ts-morph` (`repo-cli/Knowledge/Knowledge.refs.ts:31` imports `ts` from it). A regex is not enough: `KnowledgeDoctor.domain.ts:497-498` matches only lines starting with `export`, and five of the six declarations anchored below are module-private.
- Add it as a sixth `KnowledgeEvaluator` (form `decision-anchor`), so witnesses, baseline and delta come for free, and extend `isKnowledgeScopedPath` to `packages/**/decisions/*.md` and `apps/**/decisions/*.md` only. Do not add `packages` to `KNOWLEDGE_SCANNER_SCOPE`: that would pull in 655 tracked Markdown files, the verbatim bundles included.
- The check proves that an anchor exists. It cannot prove the text is true. `enforcedBy` is the only field that speaks to truth, and a resolving title is not evidence: two of the five titles below resolve and do not detect the stated reversal.

Prototype (measured, `proto/adr/resolve.ts`): five decision files, AST resolution of every `governs` and `enforcedBy`, 90 to 120 ms. Its `enforcedBy` check accepts any string literal in the test file, so it must be narrowed to call titles before use. It caught a real mistake of mine: I wrote `Freshbooks.service.ts#fetchJson` from memory and the function is `authorizedGet`. A path lookup with `rg -l -F '<path>#'` over 1,000 decision files took 7 ms.

## Retrieval

The question is how an agent editing X learns the decision after the comment is gone.

| Route | Reach | Limits |
| --- | --- | --- |
| Enforcer fails, its title states the rule | Every harness, every human, CI | Only for decisions with an enforcer, which the admission test mostly excludes from ADRs. Mutation-tested: of the five worked ADRs, two enforcers catch the stated reversal (1, 2), one does by reading (4), one does not (3), one does not by reading (5). |
| `beep decisions for <path>...` and `--diff` in Yeet cheap gates: prints title and file for each changed declaration that is governed | Every lane that publishes through Yeet | After the edit, before the push. Report only. Blocking on "a governed symbol changed" trains people to touch the file. |
| `PostToolUse` on `Read`, `Bash`, `Edit`, `Write` (Claude), paths parsed from the command: inject titles and file names through `additionalContext`, once per session per file | Claude Code | `Read` alone fails: in 443 local transcripts of this repo from the last three days, sessions opened `.ts` files with `Read` 861 times and with `cat`/`sed -n`/`head`/`awk` through Bash 7,334 times; 212 of 315 sessions that read TypeScript never used `Read`. Bash matching is heuristic (globs, `rg` hits and `xargs` are missed). The injection channel is the one `.claude/hooks/law-pulse.sh` documents and `yeet-inbox.sh` uses at PreToolUse. Read-matched injection itself was not run here. |
| Same script from `.codex/hooks.json` on `apply_patch` | Codex | Codex reads through shell, so a path is available only by parsing the command. The existing matcher is `Edit\|Write\|apply_patch` (`.codex/hooks.json:63`). |
| Cursor `preToolUse`/`postToolUse` | Cursor | Hooks exist (`.cursor/hooks.json`); context injection unverified. Grok runs the project `.claude/settings.json` hooks (and `.cursor/hooks.json` in matcher form) after folder trust and delivers `hookSpecificOutput.additionalContext` (`~/.grok/docs/user-guide/10-hooks.md:72-73,349`; the documented behaviour was not run here). Junie: no hook file found; it relies on rows 1 and 2. |
| `AGENTS.md` Touch table row: "A file under a package with `decisions/`: run `bun run beep decisions for <path>`" | Every harness that loads `AGENTS.md` | Depends on the agent obeying. One row, about 120 bytes. |
| Generated index block in each package `AGENTS.md` | Agents loading nested guidance | Reject at first: it is always-loaded weight (`Context Economy`), and rebuilds the DuckDB problem. |
| SessionStart dump | All | Reject: no path is known at session start. |
| One-line pointer `// decision: <slug>` in code | Everything, including GitHub review | The only route that survives every tool. It is also a comment, one line per governed symbol. Not in the first slice; adopt only if the pilot shows undone decisions. |

Hook cost: a new script under `.claude/` is allowed (`repo-cli/Laws/TrackedShellAllowlist.model.ts` lists `.claude/`, `.codex/`, `.cursor/`). It must be `rg` and `jq`, never the CLI, to stay inside a 2 s timeout. It should no-op for a package without `decisions/`.

Pilot gate before the repo-wide wave: take ten converted decisions, hand fresh sessions (Claude, Codex, Cursor) a task that tempts each reversal, and count reversals with the comment, with ADR and no hook, and with ADR and hook. If ADR plus hook is worse than the comment, adopt the pointer line.

## Worked conversion

Source text is in the census file under the given ids. Full converted files are in `proto/adr/packages/**/decisions/`.

### 1. Git option-like arguments (ids 12115, 12164)

From `packages/drivers/git/src/Git.ts:167-184` (18 lines) and `:1149-1154` (6 lines).

```md
---
title: "Option-like git arguments are refused before spawn, and sensitive ones are redacted"
date: 2026-11-21
governs: ["src/Git.ts#rejectOptionLikeRefs"]
enforcedBy: ["test/Git.test.ts#option-injection guard"]
reversal: "Delete rejectOptionLikeRefs and its call sites; git then reads a leading-dash ref or config value as a flag."
---

A caller-supplied ref, range, config key, config file or config value that starts with `-` fails with `GitCommandError` kind `refused` before any spawn.
A value in the sensitive position is reported as `<redacted>` in that error too.

Rejected: a bare `--` separator. It switches `checkout` into pathspec mode, and `git config` has no documented `--`.
Accepted limit: a legitimate config value beginning with `-` cannot be written through `configSet`.
```

24 lines become 13. Mutation: disabling the guard turns 34 of 257 tests red with titles that state the rule, and un-redacting a config value turns two red. Only the rejected `--` alternative is left for an ADR to carry. Found on the way: the 18-line block is detached. A second JSDoc block follows at line 185 and the next declaration is `withDefined`, not `rejectOptionLikeRefs`. An anchor check finds this class; a comment cannot.

### 2. FreshBooks token exchange (11962, 11963)

`packages/drivers/freshbooks/src/Freshbooks.token.ts:356-358` and the five-line block above `store.write`. Title: "A sent refresh-token exchange runs to persistence, and a lost write means re-authorize". Governs `src/Freshbooks.token.ts#makeFreshbooksAuth` (`rotate` is a local inside it). Enforced by `test/Freshbooks.token.test.ts#persists a consumed refresh token before honoring caller cancellation` (line 142). 8 lines become 10. Mutation: dropping `Effect.uninterruptible` turns that test red; dropping the `token refresh` rewrap of a failed write leaves all six token tests green. So the first half needs no ADR (the title states the rule) and the second half has no enforcer.

### 3. FreshBooks driver never retries (11948)

`packages/drivers/freshbooks/src/Freshbooks.service.ts:219-222`. The comment ends "so the caller can observe and schedule the retry with the server-provided delay". The code passes `resource`, `status` and `url` to `FreshbooksError` (line 224), and the only `Retry-After` match in the package source is this comment. The caller cannot see the delay. The decision (no retry in the driver) is real; that clause is stale and the missing header is a defect to fix. The ADR keeps the decision only. The draft named `test/Freshbooks.service.test.ts#maps non-success responses to typed driver errors with resource context` as enforcer; that is wrong. With a three-times retry on 429 added to `authorizedGet`, all six tests pass (the same file goes red when the status check is removed, so the mutation was exercised). `enforcedBy` must be empty or a request-count test added. 4 lines become 9, plus a fix.

### 4. Docket reviewer reads blind (47330, 47332)

`packages/law-practice/server/src/DocketIntake/DocketIntake.agents.ts:176-178` and `:315-316`. Two comments 140 lines apart state one rule. Governs `#SecretaryWire` and `#entryBlock`. Enforced by `test/DocketIntake.agents.test.ts#sends source documents to the secretary as PDF file parts and withholds the paralegal's dates` (line 452). Body: the reviewer reports readings and the pipeline computes dates; showing one reader's dates to the other removes the independent check. 5 lines become 12. By reading, the test rejects a computed field and the fixture's stated due date, but the fixture leaves mail date and response period empty, so leaking those would stay green. The title states the rule, so rule 2 does not admit this ADR.

### 5. Raw DDL for the disposable bundle (47763)

`packages/law-practice/server/src/PracticeKg.projections.ts:235-242`. Governs `#createKgTables`. Enforced by `test/PracticeKg.projections.test.ts#keeps the hand-written bundle DDL equal to the Drizzle read-model declarations`. That test holds the two in step but says nothing about why raw DDL, so an agent could move to drizzle-kit and stay green: rule 2 admits it. By the same argument the test is not an enforcer of this decision (it compares column names), so `enforcedBy` overstates it. The comment itself says "invariant by test, not comment". 8 lines become 9.

### Marked D by the classifier, not ADRs

- 11652, `packages/drivers/exiftool/src/Exiftool.service.ts:394-397`: `Effect.orDie` and the layer's error type already state it. Delete; if wanted, name the effect `stageConfigOrDie`.
- 12393, `packages/drivers/git/src/GitCommand.ts:1014-1017`: `test/GitNotes.test.ts:252` asserts the argv and the exact stream. Make the title "replaceNotes writes a parentless commit, so equal input gives an equal id".
- 47413, `packages/law-practice/server/src/DocketIntake/DocketIntake.store.ts:58-61`: replace the anonymous struct with a `LockHolder` class whose `bootId` and `startTime` carry descriptions, and test that a reused pid with another boot id is a leftover.
- 47571, `MailTagging.matters.ts:224`: `taggableKeys` and the filter say it, and the id is dead. Delete.

## Cost

Measured on the five: 49 comment lines removed, 53 Markdown lines added, net +4. TypeScript loses 49. Eight comments became five files. Only one of the five bodies carries the `Rejected:` line the file rule requires. Applied strictly, rule 2 admits ADRs 3 and 5, arguably 1 and half of 2, and not 4: two to four of twelve examined comments, not eight.

Provisional projection (16,646 of 31,672 non-export comments): 707 decision records, 4.2% (0.4% to 9.7% by shard), 8.0 lines each. Over 31,672 that is about 1,350 comments and 10,800 lines. At 1.6 comments and 10.6 lines per file, moving all of them gives about 840 files and 8,900 lines, so the repo is about 1,900 lines smaller rather than flat. One-line decisions (20 of 707) always lose.

How many survive admission is not known. The worked set gives 8 of 12 as drafted and 2 to 4 of 12 under a strict rule 2; twelve hand-picked comments support neither as a rate. The range is therefore about 140 to 560 files and 1,500 to 5,900 Markdown lines, 3% to 11% of the 53,249-line prose-only shed. Size the goal only after a random sample of about 100 D rows goes through the test.

ADRs are not the line-count lever. The case for moving decisions is checkable anchors and enforcers. Report TypeScript lines and repository lines separately; otherwise the shed number is overstated by the Markdown added.

Exported and member JSDoc: three of 15 doc shards (1,441 rows) have 86 D (6.0%) and 239 H. If that rate held over 47,800 blocks it would be about 2,850 more decisions. It should not enter this plan until the JSDoc lane rules, since exported JSDoc has its own law (`.patterns/jsdoc-documentation.md`) and gate.

## Issues for excuses

The conflict. `AGENTS.md:190-198`:

> Fix findings where they are found (operator 2026-10-24): every actionable review finding, any severity and any round, and every defect observed while working is fixed in the current PR before it merges; a defect outside the PR's files gets a small PR opened the same hour. Never file a "tracked follow-up" issue to defer fixable work. File an issue only for work blocked on the operator, on elapsed time or on money, or for a deferral the operator explicitly authorized (such as an S11 merge over reds with one batch fix PR).

The operator's request (`explorations/comment-law/CAPTURE.md`): "Excuse: delete the comment and file an issue to fix the hacky implementation".

These are reconcilable: the request is a deferral the operator explicitly authorized. It should be written down with an end, because the law's point stands. Deleting the excuse and leaving the hack makes the hack harder to find. Proposed rule for the goal:

- Fix in the same PR when the fix stays inside the files that wave already edits. No issue.
- Otherwise open the issue, then delete the comment in a PR that links it. Never the other order.
- The goal does not close while one of its issues is open, or the operator rules on the remainder. Open issues today: 0 (measured with `gh issue list`), so the backlog is fully attributable.
- Record it as `goals/<slug>/decisions/<date>-excuse-issues-authorized.md`.

Granularity: per root-cause family.

- The string "shared driver boundary idiom; no in-family home; future foundation capability candidate." appears 11 times in 8 files, usually above a Fallow suppression with an owner and an exit (`packages/drivers/exiftool/src/Exiftool.errors.ts:17-18`). `PositiveMilliseconds` is declared in three driver model files (obs, exiftool, ffmpeg) and nowhere in `packages/foundation`. Per comment that is 11 issues for one extraction.
- `TODO(effect-native-migration): model schema` appears six times (three in source, three in tests).
- `-1/0/1` sentinels excused by allocation appear three times in the claim domain (ids 46301, 46419, 46933).
- 104 X rows in 16,646 (0.62%) projects to about 200 excuses. The first 15 fell into 8 families; a read of the first 98 notes shows most are one-site fixes (hand-rolled copy of an export, sentinel, cast), so the family ratio is not established and the fix-in-wave rule, not the family rule, will decide the issue count. A family is one fix, not one topic: two hacks are in one family when the same change removes both.

Excuses inside directives (`fallow-ignore-next-line ... -- ... no foundation capability owns it yet`) are the same family and need to be counted, or the census misses the larger half. Directives are 975 and outside the comment ban.

Template (`.github/ISSUE_TEMPLATE/config.yml` disables blank issues and there is no form, so agents open through the API or a form is added):

```md
Title: comment-law: <hack> across <n> sites, replace with <owner/helper>
Labels: comment-law, excuse

Hack: <one sentence: what the code does that it should not>
Excuse removed: "<verbatim, 25 words at most>"
Why it is an excuse: <the better implementation and where it lives, path#symbol>
Sites:
- [ ] path#symbol (comment id)
Harm if it spreads: <wrong result, duplicated invariant, weakened type, swallowed error>
Done when: <test, lint or type that fails on the old shape>; suppression count for this family is 0
Not fixed in the deleting PR because: <reason>
Wave: <PR that deleted the comments>
Family key: <kebab-case, unique; search before opening>
```

Paths are repo-relative and quotes stay short: the repo is public.

## Risks

- Text that was false in a comment becomes false with authority. Mitigation: conversion requires opening the source; `enforcedBy` is named or explicitly empty.
- Retrieval for Junie rests on enforcers and the Yeet report; for Grok on a trusted folder. Bash-command parsing is heuristic everywhere. The pilot measures it.
- A named enforcer that does not enforce is worse than none: it stops the next reader looking. Two of five worked examples had one.
- Anchors to nested locals resolve only to the enclosing declaration (`makeFreshbooksAuth`, not `rotate`). Coarse but stable.
- Renames red the check. That is intended; the fix is one line in the same PR.
- Several hundred small files is a new surface. If the sample admits more than about a third of D comments, tighten the test before scaling.

## Refutation pass

Read at `a1b08269809`. Mutations ran in a scratch overlay (`proto/adr-refute/`, since removed) with test imports pointed at the copied source; baselines were green and a control mutation went red. No lane file was changed.

| Claim | Result | Evidence |
| --- | --- | --- |
| Home is `<package>/decisions/`, one file each | Confirmed as feasible, not refuted | No file uses the path outside `goals/`; the parser and filename grammar exist (`Decisions.schemas.ts:87-140`, `Decisions.projection.ts:123-200`). Option F remains the cheaper runner-up (no doctor-scope or Turbo effect). |
| One-sentence amendment to `ADR-FORMAT.md` | Refuted | `grill-with-docs/SKILL.md:135` bans "ADR directories for this repo" without the `docs/` qualifier; `:133` routes package policy to README. Three edits. |
| Enforcer is the first retrieval route | Refuted as a design | Admission rule 2 excludes any decision whose enforcer explains itself, so it cannot be the main route for what is admitted. Body rewritten. |
| All five worked ADRs have an existing test named as enforcer | Corrected | Title resolution is not enforcement. Mutations: 1 red (34 tests), 2 red for cancellation and green for the persist rewrap, 3 green under a 429 retry. By reading: 4 partly, 5 no. |
| Read-time hook | Refuted as specified | 861 `Read` against 7,334 Bash reads of TypeScript; 212 of 315 sessions used no `Read` (heuristic count over three days of local transcripts, `proto/adr-refute/reads.py`). The hook must parse Bash. |
| Grok has no hook route | Refuted | Grok reads project `.claude/settings.json` hooks after folder trust (`~/.grok/docs/user-guide/10-hooks.md:72-73`). Delivery not run. |
| Goal decisions are not durable | Corrected | Keep list, 186 packets and 0 survivors confirmed; content remains in the external archive repository. |
| 1,390 files, 11.1 lines, 116 packets | Confirmed | 15,407 lines. |
| `MailTagging.matters.ts:224` D-11 dangles; three live D-11s | Confirmed | Opened all four; packet tombstone dated 2026-11-08. `MailTagging.mailbox.ts:61` cites the dead D-12 too. |
| Up to 416 comments cite `D<n>` | Confirmed within noise | 419 by my regex. |
| Archive leaves the `LaneTimings.ts:2002` path dangling | Confirmed by reading | `Archive.service.ts:351-354` scans code spans in Markdown only. Not run. |
| Doctor scans ten roots, none is `packages` or `apps` | Confirmed | `Knowledge.refs.ts:1249-1260`. "No rot check at all" corrected: typos and fence checks exist. |
| Repo-exports residue | Confirmed | `infra/package.json:38`, `biome.jsonc:66`, `turbo.json:6424-6425`; no implementing string in `packages/tooling`. |
| FreshBooks comment claims a delay the caller never gets | Confirmed | Only `Retry-After` match in the package is the comment; the error carries `resource`, `status`, `url`. |
| Git JSDoc detached before `withDefined` | Confirmed | `Git.ts:167-187`. |
| Five of six anchors are module-private; doctor regex needs `export` | Confirmed | Only `makeFreshbooksAuth` is exported; `KnowledgeDoctor.domain.ts:497-498`. |
| Four of twelve D rows are not ADRs | Corrected upward | Under rule 2 as written, 8 to 10 of twelve are not. |
| 5.5% D, 1,750 comments, 700 files, 14% give-back | Corrected | 4.2%, 1,350 comments, 140 to 560 files, 3% to 11%. The survival rate is unknown. |
| H is 48%; 160,000 lines | Corrected | 40%; 135,000. The conclusion (no H as ADR) stands. |
| H "keep" 403 of 860 | Confirmed as a ratio | 3,153 of 6,699, 47%, or about 6,000 comments with no better home named. This is the larger open problem and the lint lane owns it. |
| 290 excuses, 150 families | Corrected | About 200; family ratio unproven. |
| Eleven copies of the idiom string in eight files; three `PositiveMilliseconds` | Confirmed | `git grep`; none in `packages/foundation`. |
| TODO appears four times | Corrected | Six. |
| `KNOWLEDGE.md` 29 files | Corrected | 30, same 26,644 lines. |
| Prototype 94 to 120 ms, 7 ms lookup | Confirmed | 90 to 98 ms over three runs; lookup at or below 10 ms. Enforcer check accepts any string literal. |
| `AGENTS.md:190-198` allows an operator-authorized deferral | Confirmed | Quoted text matches. `CAPTURE.md` already holds the request verbatim, so the decision file can be written without a further ruling; the closeout condition is the new term. |
| Zero open issues | Confirmed | `gh issue list` returned no rows, exit 0. |

Verdict: the home and the small-set principle survive. The retrieval order, the enforcer evidence, the Read hook and the volume estimate do not, and are replaced above.
