# Research

Dated 2026-11-21, read at `a1b08269809` (origin/main). Lane reports with citations are in
[`research/lanes/`](./research/lanes/); this file is the synthesis. The full per-comment ledger
(33,113 rows), census scripts and prototypes are outside the repo at
`~/.local/state/beep/comment-law/2026-11-21/`, because they go stale on every merge.

## Census

Counted with the oxc parser, so strings, templates and regexes are never mistaken for comments.

| Zone (TS/JS) | Files | Code lines | Comment-only lines |
| --- | ---: | ---: | ---: |
| `src` | 5,714 | 952,030 | 745,083 |
| `test` | 4,117 | 981,945 | 37,549 |
| repo-root tooling | 20 | 15,536 | 460 |
| generated, fixtures, vendor (exempt) | 138 | 140,439 | 45,355 |
| scratchpad, packets (exempt) | 1,119 | 238,911 | 142,327 |

Enforced zones hold 2,886,677 lines, 783,092 of them comment-only (27.1%). They split as:

| Kind | Groups | Lines | Status today |
| --- | ---: | ---: | --- |
| Exported-symbol and module JSDoc | 42,134 | ~637K | required by law 15; eight independent consumers |
| Member JSDoc | 5,668 | 57K | partly required (public class methods in tooling src) |
| Non-exported JSDoc | 6,906 counted; about 5,600 truly local | 35.5K counted; about 19.6K truly local | required by nothing once misclassified exports are removed |
| Free prose | 24,690 | 51.8K | required by nothing |
| Directives and pragmas | 975 | 633 | machine-read, exempt |
| Licence headers | 76 | 1,026 | attribution, exempt |

Within exported JSDoc, 294K lines are Examples, 130K leads, 78K `@since`, 71K Details, 35K `@category`;
2,784 blocks are executed doctests.

Non-TS code (shell, CSS, YAML, TOML, JSONC, Grit, SQL, Nix) holds roughly 6K comment lines by a
line-prefix count. It was counted, not classified.

## Classification

Every free-prose comment, non-exported JSDoc block and licence header in enforced zones was read and
coded by an agent: 31,672 comments in 62 shards, all passing a completeness checker. Exported and member
JSDoc was sampled (1,441 blocks, stratified by package), and scratchpad prose sampled (350).
The rubric is [`research/rubric.md`](./research/rubric.md).

| Code | Operator's category | Comments | Share | Lines |
| --- | --- | ---: | ---: | ---: |
| T | Tautology | 5,689 | 18.0% | 15,121 |
| S | Stale | 383 | 1.2% | 2,639 |
| X | Excuse | 186 | 0.6% | 550 |
| D | Decision Record | 1,449 | 4.6% | 10,504 |
| H | not named: local hazard or rationale | 13,438 | 42.4% | 36,624 |
| N | not named: narration of non-obvious what | 9,139 | 28.9% | 19,748 |
| G | not named: dividers, group labels | 1,166 | 3.7% | 1,851 |
| L | not named: licence, attribution | 222 | 0.7% | 1,288 |

**The four categories cover 24% of these comments.** 71% are H or N. For H rows the classifier named a better
home as test title 5,007, name 1,177, type 586, assertion 428, and no better home ("keep") 6,240.

Exported JSDoc sample (1,046): T 60.0%, N 16.8%, H 14.6%, D 7.1%, S 1.0%. The dominant pattern is a lead that repeats
the `$I.annote*` description on the next line.

### How far the labels hold

| Check | Result |
| --- | --- |
| Blind relabel, 600 random comments | agreement 76% over 8 codes (kappa 0.65); 90% on delete versus keep (kappa 0.66) |
| T, 250 sampled | 81.6% safe to delete; 10.8% hold a tag some tool reads; 6.0% lose information; 1.6% unsure |
| T against the blind pass | the second reader called 46 of 102 N, so a T deletion needs two votes |
| S, 120 sampled | 106 hold (88%), 9 refuted, **3 where the comment is right and the code is wrong**, 2 unsure. Many need one clause edited |
| X, all 186 opened in source | 105 confirmed, 37 not a hack or external, 42 unsure, 2 already fixed |
| X misses, 250 of 1,152 excuse-worded H/N/D rows | 14 more; about 69 in the pool, concentrated in `KEEP (D-nn)` notes above raw git and gh spawns |
| D, 160 sampled for ADR admission | 18 admit; 92 already stated by a test or type; 38 already recorded; 11 demote; 1 wrong. **About 115 distinct ADRs (75 to 180), not 1,449** |

Some ENFORCED verdicts would flip under mutation: the ADR lane found 2 of 5 named enforcers do not go red on
the reversal, and 1 of 8 decisions converted by hand states behaviour the code does not have.

### Defects the pass uncovered

Deleting the comment would have buried these. Detail is in the ledger, not here.

- Two drifted copies of a host guard that a comment calls duplicated "by design" (verified by reading).
- The YAML formatter drops an escaped comment, reproduced in `packages/foundation/modeling/yaml`; its comment says there is no carrier, and there is one.
- `Git.ts` calls an error arm unreachable that a caller-supplied ref can reach.
- Stale ratchet floors: the manual-runtime budget allows about 529 new violations, and three coverage floors sit far below measured coverage.
- Wrong entity spans in the wink backend for repeated mentions; dead nav anchors in oip-web; one node-sync test resolves a directory that does not exist.

### Excuse families

Cluster before filing: same-package copy kept in step by a comment (19), cross-package copy of an importable
owner (about 22), "no helper exists" where one does (about 23), failure swallowed or presented as acceptable (11), cast or dead code with
a false reason (14), stale ratchet floors (5), ad hoc `process.cwd` switching (5), numeric sentinels (3), schema bypassed (2),
application-allocated row ids (1). Driver-boundary clones (16) are an extraction, not an import.

## Exported JSDoc, the assumption under test

In a stratified sample of 1,046 exported blocks, with Examples and bookkeeping tags removed, the remaining prose was
tautological in **628 (60%)**: a lead that repeats the `$I.annote*` description on the next line, "Runtime type for X" and
companion-namespace boilerplate on type-level exports, and barrel one-liners. In 395 member blocks: 50%.
Extrapolated, about 25,000 of 42,134 exported blocks carry prose that says nothing the code does not. The Examples are
another matter: they compile, 2,784 run as tests, and external evidence ranks examples as the most useful part of API
documentation for models.

By bytes, exported JSDoc is 18.4% of comment-bearing enforced source; free prose is 3.8%, non-exported JSDoc 1.4%,
member JSDoc 2.1%.

## Lines shed

Measured by stripping a copy, reformatting with Biome, and re-parsing. 8,102 of 8,104 files keep an identical AST; the
other two lost a shebang, which is exempt by rule.

| Scenario, enforced zones | Lines | Share of 2,886,677 |
| --- | ---: | ---: |
| The operator's four actions at measured precision (T, S, X deleted, D replaced by about 115 ADRs) | about **-24,000** | 0.8% |
| All free prose | **-53,249** | 1.8% |
| Plus non-exported JSDoc | **about -72,000** (census said -89,019; 1,083 blocks were exports through `export { x }` or module headers) | 2.5% |
| Plus member JSDoc | **-146,424** | 5.1% |
| Everything except directives and licences, exported JSDoc included | **-786,580** | 27.2% |

The gap between the rows is the programme's real question: 81% of the total sits in exported JSDoc, which the repo requires.
AST identity is not program proof by itself. It misses tests that read source text, JSX text whitespace and line-keyed
inventories.

Inflow: 13 days of main added 5,013 prose comments and removed 435. Any deletion lands after the growth check, or it loses.

## In-Repo Capability Inventory

| Need | Brick | State |
| --- | --- | --- |
| Read comments in a lint rule | `packages/tooling/policy-pack/lint-rules/src/rules/tsdoc-syntax.ts`, `docs.ts` (`getAllComments`) | extend: oxlint JS plugin. Biome GritQL was tried and cannot match comments |
| Ratchet lifecycle | `packages/tooling/tool/cli/src/internal/ratchet/` | reuse `enforceRatchet`; `diffMembership` needs a multiset sibling |
| Base-relative check | fallow and knowledge semantic-delta lanes (`--base`, `BEEP_PROOF_BASE`) | reuse |
| Decision file grammar and parser | `packages/tooling/tool/cli/src/commands/Goals/Decisions.schemas.ts` | extend to package decisions |
| Decision anchor checks | knowledge doctor evaluators | extend (scans no package paths today) |
| Skill machinery | `.claude/skills`, `beep skills`, `skills-lock.json` | reuse; draft in [`research/drafts/delete-comment/`](./research/drafts/delete-comment/SKILL.md) |
| Comment scanner, grammar, classifier, strip with AST proof | prototypes outside the repo | NET-NEW |
| ADR home for package decisions | NOT FOUND | NET-NEW; `.claude/skills/grill-with-docs/ADR-FORMAT.md` and its `SKILL.md` forbid one today |
| Growth check for comments | NOT FOUND | NET-NEW |

## External Landscape

From [`research/lanes/external.md`](./research/lanes/external.md), every source with its reading level there.

- Wrong comments hurt models more than missing ones in every study that tested both. Stale deletion is the best-supported step.
- Tautology deletion saves tokens (about 11% on one SWE-bench ablation, 13% to 18% on one minimal-pair repo) with no measurable change in pass rate.
- A blanket ban is contradicted: correct "how" and property comments help repair, a one-line "keep in sync with X" pointer redirects agents, and compiled examples are the most useful part of API docs.
- Agents open ADRs in about 4% of documentation events, and an accepted ADR that goes stale is followed too literally. A decision moved out needs a way back to the edit site.
- Nobody published a test of this exact programme.

## Constraints Discovered

1. Exported JSDoc cannot be deleted under current law: docs oxlint, JSDoc ratchet (required context), docgen, doctest, fallow visibility tags and package-script generation all read it.
2. `@internal`, `@public` and `@expected-unused` inside JSDoc are live suppressions. Deleting them adds 130 fallow findings.
3. Exempt grammar must be exact tokens, not prefix words. The census regex called 13 triple-slash references and 16 semgrep markers prose, and 25 sentences directives.
4. Banning prose without banning non-exported JSDoc makes `/** */` the free escape.
5. S31: no growing inventory. A central per-file baseline collides in 84% of commit pairs; the recommended ratchet stores no comment inventory.
6. `GITHUB_BASE_REF`-relative checks are laundered by S11 merges, so a tree-only lock on clean packages is needed beside the delta check.
7. An oxlint file-level disable silences the rule; the scanner has to reject directives that name it or disable everything.
8. `AGENTS.md` bans tracked follow-up issues. The operator's request to file an issue per excuse is an authorised deferral only if recorded as a decision.
9. Law 15, `AGENTS.md`, `.patterns/jsdoc-documentation.md`, two skills and 57 templates all tell agents to write comments. A ban without changing them is fought by every lane.
10. 266 of the last 292 TS commits on main (91%) add a prose comment. The check needs an advisory window, and the AGENTS line lands the same day.
