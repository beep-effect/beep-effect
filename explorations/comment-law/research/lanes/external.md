# External landscape: comments in agent-maintained code

Lane: external. Read date: 2026-11-21. Reading level is stated per source:
**[full]** = I downloaded the paper and read the cited sections; **[abstract]** = abstract or landing page only;
**[secondary]** = number taken from another paper that cites it; **[page]** = web page, doc or source file I read.
"Inference" marks my own reasoning. Repo paths are relative to the lane checkout at a1b08269809.

## 1. Verdict

1. **Delete stale and wrong comments: strongly supported.** Wrong text hurts more than missing text in Macke and Pan, but the size falls with model strength: about -24% for direct inference, -15% with chain of thought, -3 to -12% for reasoning models (CodeCrash). Sabetto is a counter-case: 20% wrong comments scored the same as no comments.
2. **Delete tautologies: supported on cost, neutral on correctness.** The token figures come from whole-repo stripping elsewhere. Here free prose is 3.8% of source bytes, exported JSDoc 18.4% (measured, refutation pass), so a prose-only v1 cannot save more than about 4% of read tokens.
3. **Excuse to issue: supported, with a caveat.** Debt filed as issues is repaid far faster, but 46% of the issue cohort was raised in code review on an uncommitted patch, so the speed is not evidence that filing an issue for an old hack gets it fixed.
4. **Decision record to ADR: half supported.** Moving the record is fine. Leaving nothing at the edit site is not: agents rarely open ADRs, and ADRs go stale too. Keep a one-line checked pointer.
5. **Ban everything, JSDoc included (-786,580 lines): contradicted.** Correct "how" and "property" comments help repair, and example code is the part of API documentation that helps models most with uncommon libraries.
6. **The lint cannot be a Biome GritQL rule.** It has to be an oxlint JS plugin or a custom scanner (tested, section 6). The plugin alone does not ratchet; see section 7.
7. **A count ratchet has two holes** (tested, section 7): swapping one comment for another passes, and renaming a file reds it.

No study I found tests the operator's exact programme (bulk classification and deletion, then a ban, in a repo maintained by agents). Everything below is adjacent evidence.

## 2. Comments and language models

| Source | Design | Result | Bearing |
| --- | --- | --- | --- |
| Macke & Doyle, NAACL Findings 2024, https://arxiv.org/abs/2404.03114 [full] | GPT-3.5/4 write unit tests for HumanEval variants | Comments taken from other functions: 22.1% / 68.1% success, worse than every other variant at alpha 0.05. Base file vs no comments: no significant difference in errors and failures. Commented code did give significantly higher line coverage for both models. Partial docstrings (10, 25 or 50% of lines kept) gave GPT-4 significantly MORE errors than full ones, by a small margin; the authors decline a conclusion | Wrong hurts, absent is neutral, correct helps a little |
| Sabetto et al., 2025, https://arxiv.org/abs/2506.11007 [full] | 4 LLMs, quiz on ONE assembler module, 3 runs | No comments 84%; with comments 96% (basic) / 90% (advanced). 20% wrong comments: three of four models scored identically to the no-comment variant. All comments wrong: 73% to 61% against ACCURATE comments, 10 questions; wrong-versus-none was not compared there | Contradicts "absent is neutral" for obscure code; a few stale comments are tolerated |
| CodeCrash, NeurIPS 2025, https://arxiv.org/abs/2504.14119 [full, main sections] | 17 models, 1,279 questions, injected misleading comments (MCC) and prints (MPS) | Relative drop, direct inference without reasoning: MCC 24.3%, MPS 23.8%, PSC-ALL 24.6% (17 models). With chain of thought MCC is 14.9% (Table 2). Reasoning models under MCC: -2.7 to -12.4% (Table 4). Telling the model to ignore comments barely helps. Reasoning models hold up but spend 2 to 3 times the reasoning tokens under a plausible wrong hint | Strong for stale deletion. **Warning:** an agent pipeline told to delete misleading comments first did WORSE under MCC (Table 9: GPT-4o only, direct inference, LCB, 45.7 to 41.1), because it treated the comments as authoritative and changed the logic |
| Vitale et al., ICPC 2026, https://arxiv.org/abs/2601.23059 [full] | Fine-tuned CodeT5+ and DeepSeek-Coder, method-level bug fixing, GPT-3.5 comments written from the FIXED version | Inference-time only: exact match 3.26 to 3.73% and 5.57 to 7.90%. Comments in train and test: 2.78 to 9.80% (OR 6.86), 5.09 to 12.77% (OR 9.76). Without "how" comments still +91% (CodeT5+, fine-tuned on commented data). Inference-only OR is 1.44 and 3.42; the 6.86 and 9.76 need fine-tuning on comments, which no hosted agent here has. Comments written from the BUGGY code: same or slightly worse. "How" matters most; "what" least for CodeT5+ | Contradicts a blanket ban. The design leaks intent from the fix, so the effect is an upper bound (inference) |
| Pan et al., Sept 2026, https://arxiv.org/abs/2609.09242 [full, intro and design] | Comment prefill from a stronger model, LiveCodeBench | Correct content +17.2% pass@1; same form but wrong solution: no gain; unrelated problem -20.8%; random text -17.9%. Natural comment volume and WHY/WHAT intent do not predict pass@1 | What counts is correctness of content, not whether the comment says why |
| Imani et al., Dec 2025, https://arxiv.org/abs/2512.16790 [abstract and tables skimmed] | Activate or suppress the internal "comment" concept | Performance moves -90% to +67%, depending on model and task | No universal sign |
| Eicher & Irgolic, NeurIPS 2026 FAST workshop, https://neurips.cc/virtual/2026/176319 [abstract; PDF not retrievable] | Comment ablation and adversarial comments on SWE-bench Verified | Removing comments helps one of two models and harms the other (no figures in the abstract). Evolved adversarial comments cut completion by up to about 28%; trajectories that try to remove the directive resolve at about half the rate. In 52 agent-written vs 45 human repos, deletions and renames are about 2% of vocabulary turnover vs about 21% | Closest to agent practice. Agents do not clean up after themselves, so control at authoring time pays. Deleting directives mid-task is costly, so run deletion as its own task |
| Hrubec & Cito, 2026, https://arxiv.org/abs/2606.01326 [full, tables] | SWE-bench Verified, 100-instance ablation, GPT-4.1 | Baseline 46% at 87,325 input tokens. Remove comments: 45% at 77,849 (-10.9%). Remove docstrings: 43% at 68,202 (-21.9%). Full minification: -42% tokens, -12 points (n about 500, GPT-5-mini) | Inline deletion is nearly free. Docstring deletion saves twice as much and loses 3 of 100, which I read as within noise (inference; no test reported) |
| SonarSource, 2026, https://arxiv.org/abs/2605.20049 [full, section on comments] | 660 Claude Code trials, 6 minimal-pair repos, 33 tasks | These are contrasts between a CLEANER and a MESSIER variant, not with and without comments. Cleaner code: no change in pass rate, 7 to 8% fewer tokens, 34% fewer file revisitations. Section 4.5 equalised comments between variants (removed redundant ones on the heavier side, which was the CLEANER side by about 8,000 lines, restored missing docstrings, stripped markers). The cleaner-minus-messier token gap then moved from +1.2% to -18.0% (-13.0% size-adjusted) and from +1.3% to -8.5%; pairs with only markers stripped barely moved. | The authors conclude comments and markers "are not what drives" the contrast. It is NOT a measurement that stripping comments saves 13 to 18% of tokens; at most the shift is consistent with a saving (inference). n=5 normalised against n=10, manual edits, high variance. They also note a one-line "keep in sync with X" comment can redirect which files an agent touches (argued, not measured) |
| Simoes & Venson, SBES 2025, https://arxiv.org/abs/2507.05289 [full, results skimmed] | 9 LLMs rate readability of Java classes | Comment removal lowered scores for only 20.83% of subjects; renaming identifiers was the dramatic intervention | Names carry more than comments |
| Arman & Molybog, Sept 2026, https://arxiv.org/abs/2609.31587 [full, section 7] | Compact docs for agents, 10+ repos | Source withheld: docs lift test-pass from 0.08 to 0.71. Source present: 33/58 issue only, 30 retrieved context, 29 docs (p=0.22, 0.25). Longer docs did worse (9/15, 8/15, 4/15) | Prose next to code the agent can already read does not help |
| Chen et al., 2025, https://arxiv.org/abs/2503.15231 [abstract and intro] | RAG over docs of 4 less-common Python libraries, 1,017 APIs | RAG +83% to +220% (average per library, top-5 retrieval; +42% for Pandas, a well-known one); **example code contributes most, not descriptions or parameter lists** | Contradicts deleting `**Example**` sections. The gain is for code outside training data. The docs were retrieved into the prompt with no source; Arman & Molybog find the gain disappears when source is present, and this repo is public |
| Kang et al., https://arxiv.org/abs/2406.14836 [abstract] | LLM-generated comments | Best model: about a fifth of comments contain demonstrably wrong statements; consistency detectors had no significant relation to accuracy | Agent-written comments start out wrong, they do not only go stale. Do not trust an LLM judge alone to call a comment "true" |
| Two-turn revert probe, https://dev.to/newellpaul/comments-considered-harmful-3oc2 [page; blog, 2 fixtures, 10 runs, leading prompt by its own account] | Turn 1 leaves a stale comment, turn 2 "fix inconsistencies" | Code reverted to match the stale comment: 80 to 100% in all 5 large-model cells with data (the sixth, Opus on isAdmin, refused). The author calls the setup rigged: turn 1 forbids touching the comment | Anecdotal, but the same failure mode CodeCrash found |

Humans, for contrast: Nielebock et al., EMSE 2018, 277 participants, mostly professionals: no significant effect of comment type on correctness; documentation comments took significantly longer; participants rated comments above their measured value
(https://neverworkintheory.org/2021/09/06/commenting-source-code.html [page], preprint https://jacobkrueger.github.io/assets/papers/Nielebock2019Comments.pdf [abstract]). Small tasks only.

## 3. Staleness

- Wen et al., ICPC 2019 [full, via https://web.archive.org/web/2020id_/http://www.inf.usi.ch/lanza/Downloads/Wen2019a.pdf]: 1.3 billion AST changes, 1,500 Java systems. Only 13 to 20% of code changes trigger a comment change. The authors say explicitly that the other 80% is not all inconsistency. Renames, literals, method calls, lambdas and iteration changes are the least likely to trigger an update. 500 commits labelled: 362 comment-related; developers sometimes resolved a stale rationale comment by deleting it.
- Fluri et al. [secondary, in Wen]: 23%, 52%, 43% of comment changes were caused by code changes; 97% of those happened in the same revision. If a comment is not fixed with the code, it mostly is not fixed.
- Ratol & Robillard, ASE 2017, https://www.cs.mcgill.ca/~martin/papers/ase2017.pdf [full, results]: more than half of identifiers in the data set had fragile comments after a rename. Fraco: 100% precision in 5 of 6 systems, recall above 90%, on lexical in-comment references. That is FIELDS only (Table V). Methods are above 95% except one system; local-variable precision is equivocal. Fraco is given the old name at rename time; it does not sweep for already stale text. Against general inconsistency Radmanesh Table 3 gives Fraco precision 90.2%, recall 22.0%. **So lexical checks find a precise but small part of "stale"**; ReCite is the closer match for a sweep.
- ReCite, ASE 2026, https://arxiv.org/abs/2608.03734 [abstract and intro]: 869 stale function references in Linux v6.18-rc1; 89% of 200 repairs useful, 42.5% directly applicable; 50 of 75 patches accepted. Resolves symbols first, traces git history second, asks the LLM last. This is the right shape for a stale detector.
- Just-in-time detection: Panthaplackel et al., https://arxiv.org/abs/2010.01625; CodeT5+ with structured diffs, https://arxiv.org/abs/2512.19883 [abstract; it reports CARL-CCI at 90.89% F1 on JITDATA]. These need the diff that broke the comment; a whole-repo sweep is the harder "post hoc" task, so do not carry 90% across.
- Bugs: Radmanesh et al., 2024, https://arxiv.org/abs/2409.10781 [full, results]: inconsistent changes 1.52 times (odds ratio) as associated with bug-introducing commits within 7 days, 1.14 within 14 days. Per-repo ratios in the weekly table run 0.72 to 2.68. Association only, GPT-3.5 labels, preprint.
- Hata et al., ICSE 2019, https://arxiv.org/abs/1901.07440 [abstract and RQ6]: 9.6M links in comments, about 9 to 10% dead, rarely updated. An ADR or issue pointer left in code will rot unless a check resolves it.

## 4. Self-admitted technical debt (the "excuse" class)

- Prevalence: 2.4 to 31% of files; only 26.3 to 63.5% removed (Potdar & Shihab 2014) [secondary, in https://arxiv.org/abs/2205.13872 and https://arxiv.org/abs/2101.03730].
- Removal: Maldonado et al. 2017 found 74.4% removed on average [secondary, 2101.03730]; median survival about 18 to 173 days [search-result abstract, not read in the original]. 54.4% self-removed [secondary, 2101.03730 and 2007.01568]. Zampetti et al. 2018, https://aserebre.win.tue.nl/MSR2018-Fiorella.pdf [full]: 20 to 50% of removals are accidental, the whole class or method went away; only 8% are acknowledged in a commit message; in 2 to 17% the comment went and the method did not change.
- **Issues vs comments**: Li, Soliman & Avgeriou 2020, https://arxiv.org/abs/2007.01568 [full, discussion]: debt in issues repaid in a median 2.0 days vs 159.0 for comments (Hadoop) and 0.9 vs 18.2 (Camel); they recommend issues for "TD that needs to be resolved immediately", not for all debt. Of the 152 items 70 (46.1%; Hadoop 56.4%) were found in code review on a patch, before commit (Table VI); 67% of repaid items closed in under 100 hours. That is review feedback, not backlog. Contradicting detail in the same paper: eventual repayment is 71.7% (issues) vs 76.7% (comments), and creators repay fewer of their own (44.0% vs 54.4%). Different cohorts, 152 items, two projects.
- Xavier et al. 2020, https://arxiv.org/abs/2003.09418 [abstract]: only 29% of 286 issue-based debt items could be traced to a comment, so the two populations are mostly disjoint; debt issues take longer to close than ordinary issues.
- Agent era: Mujahid & Imran 2026, https://arxiv.org/abs/2601.07786 [abstract]: 81 of 6,540 LLM-referencing comments admit debt, mostly postponed tests, incomplete adaptation, limited understanding. Liu et al. 2026, https://arxiv.org/abs/2603.28592 [results skimmed]: 22.7% of 464,900 tracked AI-introduced issues still present at HEAD.
- Mining lesson: keyword matching finds TODO/FIXME; most excuses carry no keyword (inference, and consistent with the issue/comment disjointness). Classify by content.

**Tension with repo law.** `AGENTS.md:190-198` (Autonomy; the ban is at 193) says findings are fixed where found and issues are filed only for work blocked on the operator, time or money. The same rule allows "a deferral the operator explicitly authorized", so the operator's own instruction, recorded as a decision file, is enough. The default stays fix first.

## 5. Decision records

- Nygard 2011, https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions [page]: one to two pages, immutable, superseded not erased, and only "architecturally significant" decisions. Implementation-level why ("this loop is sequential because the API rate-limits") is below that bar.
- Adoption: Buchgeher et al. 2023 [abstract via https://research.jku.at/en/publications/using-architecture-decision-records-in-open-source-projects-an-ms/]: about half of repos with ADRs hold only one to five.
- Agents rarely open them: https://arxiv.org/abs/2608.20195 [full, tables]: of 3,033 documentation events in 557 sessions, architecture/ADR is 120 (4.0%), agent instructions and working notes 60.5%, API reference 1.3%. That study cannot see docstrings or inline comments, so it says nothing against them.
- Agents overfit to them: O'Reilly Radar, https://www.oreilly.com/radar/coding-agents-love-decision-records/ [page]: an obsolete accepted ADR made an agent preserve and then wrap a dead abstraction. Advice: accepted = binding, proposed = context, superseded = history; stop and discuss on conflict. Stale risk moves from comment to ADR; it does not vanish.
- Checking compliance with LLMs: https://arxiv.org/html/2602.07609v1 [page]: 109 repos, 980 ADRs; accuracy 0.83 to 0.91 on 305 validated decisions; weak on deployment, intent and implicit decisions.
- Where rationale lives: https://arxiv.org/abs/2604.10345 [full, table and text]: rationale in 96.8% of commit messages, 85.7% of PRs, 75.0% of issues, 37.5% of method Javadocs, **4.4% of inline comments** (63 Java commits). The unit is the bundle of inline comments in the code a commit modified, and the question is whether it explains THAT change (3 of 68 bundles); the 63 commits come from a corpus curated for what/why messages. It does not measure how many comments hold decisions. The repo census, partial at 21,732 non-export comments, gives D 4.4%, H 41.4%. Much of it may already exist in git history.
- Lower-ceremony alternatives: Lore git trailers (`Constraint:`, `Rejected:`, `Directive:`), https://arxiv.org/abs/2603.15566 [full; proposal, no evaluation]. Squash merging would fold trailers into one message (inference).
- Embedded and linked forms: e-adr, https://github.com/adr/e-adr [page]: `@MADR(...)` in code or `@ADR(1)` linking to `docs/adr/`. The **linked** form is the model to copy: id in code, text elsewhere, resolvable.
- Executable ADRs: Archgate, https://cdn.jsdelivr.net/npm/archgate@0.48.1/README.md [page]: each ADR has a companion `.rules.ts` and `archgate check` fails CI. A decision that becomes a lint rule, schema or test needs no comment.
- Found no tool that checks an ADR id cited in source exists and is not superseded (search only, unverified negative).

**Repo facts that shape this.** `.claude/skills/grill-with-docs/ADR-FORMAT.md:3-8` forbids a generic ADR directory under `docs/` and already names the destination for package-local decisions: the package README or agent guidance; `standards/architecture/DECISIONS.md` is 3,281 lines with 90 dated sections; goal decisions are one file each (1,390 tracked paths match `goals/*/decisions/*`). The destination exists but is a single file per package; the `adr` lane proposes one file per decision in the package.

## 6. Lint prior art

| Tool | What it does | Licence | Use |
| --- | --- | --- | --- |
| ESLint `no-warning-comments`, `no-inline-comments` | TODO/FIXME/XXX terms; comments on a code line | MIT | Too narrow |
| unicorn `expiring-todo-comments` | `[2026-12-31]`, `[pkg@>1]`, `[engine:node@>=8]`; `allowWarningComments: false` bans unconditioned TODOs; `catalog:` versions unsupported | MIT | Idea: an expiry condition the gate can evaluate |
| `eslint-plugin-no-comments` (1.2.1), `eslint-plugin-ban-comments` (1.0.3) | Ban all comments with an allow list for directives; ban-comments has a fixer | MIT, MIT | Port the allow-list idea; tiny code. Note the auto-fixer is what to avoid |
| `eslint-plugin-eslint-comments` (eslint-community) | Governs directives, e.g. requires a description | MIT | Directives need a written reason, which is itself a comment: exempt it |
| SonarJS S125 (commented-out code) | Parses comment text as code | Sonar Source-Available License: **do not port**, reimplement from the idea | Cheapest high-precision class |
| comment-checker, https://github.com/code-yeongyu/go-claude-code-comment-checker | PostToolUse hook, tree-sitter, allows directives, shebangs and BDD markers, exits 2 | MIT | Prior art for enforcement at write time. Its README claims JSDoc/docstrings are also noise |
| Biome | No ban-all rule in the part of the rule list I read (first 100K characters) | Apache-2.0 (GitHub API) | See test |
| Public "minimal comments" rules | GitLab Orbit MR 75 references a `/remove-llm-comments` skill, https://gitlab.com/gitlab-org/orbit/knowledge-graph/-/merge_requests/75 [page; text not visible] | n/a | Precedent, guideline not gate |
| Practitioner report | https://dev.to/juliantellez/the-comments-are-not-for-you-1jp [page]: 2,635 comment lines in 19,998 Go lines; 21 "used to" history notes; keeps non-obvious constraints, moves history to commits | n/a | "Who is this for?" test, "used to" heuristic |

Local test (prototype under `scratchpad/proto/external/lint/`, Biome 2.5.6, oxlint 1.94.0 from the lane's `node_modules`):

- **Biome GritQL:** `comment()` fails to compile. A regex over a matched node sees comments INSIDE its body but not the JSDoc or line comment before it (a positive control on code text passed). Nothing can report a comment's own span. This agrees with https://github.com/biomejs/biome/issues/10474 (closed, moved to discussion 10479).
- **oxlint JS plugin:** `sourceCode.getAllComments()` returned every comment including JSX, trailing, shebang, `c8 ignore`, `@ts-expect-error` and triple-slash, and did not confuse comment-like strings, templates or regexes. JS plugins are documented as alpha (https://oxc.rs/docs/guide/usage/linter/js-plugins).
- The repo already does this: `packages/tooling/policy-pack/lint-rules/src/rules/tsdoc-syntax.ts:82` and `docs.ts:275,355` call `getAllComments()`. No new engine is needed. This departs from the "syntactic guards = GritQL" preference, for a tested reason.

## 7. Ratchet prior art

- Betterer (MIT), https://phenomnomnominal.github.io/betterer/docs/results-file/ [page]: per-issue entries with file and issue hashes, so a swap is caught; the docs admit the hashes "change quite often" and ship a merge command. Conflict-prone with many parallel lanes.
- ESLint bulk suppressions (MIT), https://eslint.org/docs/latest/use/suppressions and `lib/services/suppressions-service.js` [page, source]: count per file per rule; fails on growth and on unpruned improvement.
- oxlint 1.94.0 accepts `--suppress-all` and writes `oxlint-suppressions.json`, though `--help` does not list it. Tested with the JS rule above: +1 comment fails; -1 fails until `--prune-suppressions`; **replacing a comment with a different one passes**; **renaming a file reports its whole backlog as new**.
- TikTok and Rush also ship bulk suppression for ESLint (search results only, unverified).

Inference for this repo: with 9,851 files a per-file count file is a permanent merge-conflict surface and a swap loophole. A rule on added LINES does not avoid the move problem: a re-indent, an extracted function, or a rename below git's similarity threshold shows old comments as added. The `ratchet` lane measured the alternatives: a path-free multiset of comment fingerprints over merge-base..tree passes rename and move and fails a swap, and stores no baseline; a tree-only lock on scopes not listed as pending catches violations merged under S11. Use that. Do not commit hashes.

## 8. What supports and what contradicts the plan

| Plan step | Supports | Contradicts or limits |
| --- | --- | --- |
| Delete stale | Macke, CodeCrash (smaller for reasoning models), Sabetto (all wrong: -12 points), Pan (-20.8%), Radmanesh OR 1.52 | Few wrong comments may be harmless (Sabetto 20%); agents asked to remove misleading comments broke logic (CodeCrash) |
| Delete tautology | Hrubec (-10.9% tokens, -1 point), SonarSource (weak: see the corrected row), Arman null, Simoes 20.83% | Macke: coverage higher with comments; Sabetto +6 to +12 points on obscure assembler |
| Excuse to issue | Li 2.0 vs 159 days; Zampetti 20 to 50% accidental | Equal final repayment; Xavier: debt issues linger; a filed issue is invisible at the edit site; AGENTS.md no-follow-up law |
| Decision to ADR | Argus 4.4% inline; Nygard | ADR 4.0% of agent doc events; ADR overfit and rot; Nygard scope; SonarSource "keep in sync" pointers help; Vitale "why/property" still +91% |
| Ban with ratchet | 2% vs 21% deletion turnover: agents never clean up; instruction-only rules leak | Eicher: removal harmed one of two models; no public large-repo precedent found |
| Drop JSDoc | Hrubec docstrings -21.9% tokens; API reference 1.3% of agent doc events | Hrubec -3 points; Chen: examples are the most useful part; compiled examples cannot go stale silently; `.patterns/jsdoc-documentation.md:15-20` currently mandates them |

## 9. Recommendations for the packet

1. Scope v1 to free prose (24,690 groups, -53,249 lines) and treat non-exported and member JSDoc as a second decision. Leave exported JSDoc law alone in v1; if it is trimmed later, cut lead/category/since text before compiled Examples.
2. Add a fifth class, **constraint**: a fact about the outside world that code, types and tests cannot express (upstream bug, protocol quirk, ordering rule, security invariant). Give it exactly one syntactic form, for example `// @why <id>`, where the id must resolve to a live record. The allow-list stays machine-checkable. **Corrected:** do not require a record per constraint. Hazard/rationale is 41.4% of the 21,732 comments classified so far, so one record each would add text rather than remove it (`adr` lane: about 160,000 lines for hazards). Encode as name, type, test or assertion first; a pointer is for decisions (about 4%); what cannot be encoded needs an explicit residual form or the operator's ruling that it goes.
3. Before deleting a decision or constraint, try to encode it: type, schema, test name, lint rule. Record only what is left.
4. `/delete-comment` safety: the diff must be AST-identical with comments stripped (cheap, necessary, NOT sufficient: eight comments with tool effects pass it, and deleting a JSX comment fails it; see refutation pass), plus an unchanged multiset of directives and semantic tags; comment-only commits; never the same session as a behaviour change; check the claim against the code before labelling it stale; a stale comment that contradicts code is a possible bug, so report it, because the comment may be the correct half.
5. Two-judge classification with a labelled gold sample. Kang and the JIT literature show single-model truth judgements are unreliable; report kappa and per-class precision. Deletion needs high precision, not recall.
6. Find stale references mechanically first (unresolved identifiers, dead paths, closed issue numbers, dead links), following Fraco and ReCite.
7. Measure locally: a paired agent run on one package (comments stripped vs not), same tasks, tokens and pass rate, at least 10 trials per cell. Published effects on pass rate are inside noise at n=5 to 10, so promise neither. Headline: lines and stale claims removed. Report tokens as measured (ceiling about 3.8% of bytes for prose) and correctness as a stated non-inferiority margin; 10 trials per cell cannot show "no regression" by itself.

## 10. Not verified

- Potdar & Shihab and Maldonado originals were not read (paywalled or unreachable); figures are secondary.
- The Eicher & Irgolic PDF was not retrievable; the two models and ablation sizes are unknown.
- Current Claude Code or Codex system-prompt wording on comments: only third-party descriptions surfaced, not used.
- Biome rule list was read only to its first 100K characters.
- No measurement of comment density in agent-written vs human code was found.

## 11. Licences of portable items

MIT: ESLint, unicorn, eslint-plugin-no-comments, eslint-plugin-ban-comments, eslint-plugin-eslint-comments, betterer, oxc, comment-checker, todo-to-issue-action. Apache-2.0: Biome (per GitHub API), log4brains, archgate. EPL-2.0: e-adr. MIT OR CC0-1.0: MADR templates. GPL-3.0-or-later: adr-tools (do not copy code). Source-available: SonarJS (do not copy). Licences read from the GitHub API, the LICENSE file (MADR, adr-tools, SonarJS) or the npm registry (ban-comments).

## Refutation pass

2026-11-21, independent reader. Re-read the downloaded texts in `proto/external/dl/`, re-opened the repo lines, reran the prototypes in `proto/external-refute/`. Body statements above are already corrected. A git-based prototype of the added-lines rule was denied by the permission system and not retried; the move/rename statement rests on the `ratchet` lane's measured table and on reading its `cases.ts`.

| Claim | Result | Evidence |
| --- | --- | --- |
| Macke 22.1% / 68.1%, worst variant, base vs comments not significant | confirmed, incomplete | `macke.raw:256-278`. Omitted: GPT-4 made significantly more errors with 10/25/50% of docstring lines kept (`:279-291`), authors inconclusive. Relevant to line-trimming a comment instead of deleting it whole |
| CodeCrash "about -24% from misleading comments" | corrected | Direct inference only. CoT 14.9% (Table 2), reasoning models 2.7 to 12.4% (Table 4). The repo's agents are reasoning models |
| CodeCrash refactoring pipeline degraded | confirmed, narrow | Table 9: GPT-4o, direct inference, 45.7 to 41.1 |
| Sabetto 73 to 61, negligible at 20% | corrected | Baseline is accurate comments, not none. 20% wrong equals no comments for three of four models, so "in every study" was false |
| Hrubec -10.9% / 46 to 45, -21.9% / 46 to 43 | confirmed | `minify.txt` Table 4; GPT-4.1 repair prompt on Python, not an interactive agent |
| SonarSource: "stripping redundant comments moved one pair from +1.2% to -18.0%" as token support | **refuted as used** | `cleanliness.txt:505-580`. The figures are cleaner-vs-messier gaps before and after equalising comments; authors: comments and markers "are not what drives" the contrast. Pass rate unchanged is about cleanliness, not comments |
| Vitale up to 3x, OR 6.86 / 9.76, +91% | corrected | Needs fine-tuning on commented code; inference-only OR 1.44 / 3.42. +91% is CodeT5+ only |
| Chen 83 to 220%, examples contribute most | confirmed, transfer weak | Table in `apidoc.raw`; no source in prompt. Does not show examples help when the agent can open source; Arman & Molybog null in that case |
| Li 2.0 vs 159.0 days, 0.9 vs 18.2 | confirmed figures, **inference refuted** | Table VI: 46.1% found in review on a patch (Hadoop 56.4%). Medians are over repaid items. Recommendation limited to debt needing immediate resolution |
| Wen 13 to 20% | confirmed | `wen.raw:855-900` |
| Fraco 100% precision in 5 of 6 | corrected | Fields only; needs the renamed identifier as input; recall 22.0% on general inconsistency (Radmanesh Table 3) |
| Argus 4.4% inline, "so the class is small" | figure confirmed, inference refuted | 3 of 68 per-commit comment bundles. The conclusion (small) is supported by the repo census instead: D 949 of 21,732 = 4.4% (43 `full-*` shards, running) |
| Agents open ADRs 4.0% | confirmed | `agentdocs.raw`; counts events, not conditioned on an ADR existing; runtime-loaded context invisible |
| Kang one fifth | confirmed | `kang.raw` abstract; GPT-era generated Java comments. It tests consistency detectors, not two-judge panels; "two judges" is a design choice, not a finding |
| Eicher & Irgolic | confirmed from abstract | neurips.cc page; one model helped, one hurt; 2% vs 21%; about 28% |
| Blog revert probe | corrected | 5 of 5 large-model cells with data, not 5 of 6; author says rigged |
| GitLab, MADR, e-adr, SonarJS, betterer, oxc, unicorn, comment-checker licences | confirmed (GitLab not re-read) | GitHub API, LICENSE files, npm |
| Biome GritQL cannot report a comment | confirmed, evidence repaired | `c4`-`c7.grit` prove nothing: their positive control (`c4`) does not match either. The arrow-body pattern (`p.grit` form) is valid: code and inner comment match, leading JSDoc does not. Extra: `file($name, $body)` plus a regex matches all but the file's first comment, with the span of the whole body, so no usable location |
| oxlint `getAllComments()` sees all, no false hits | confirmed | rerun, 10 of 10 comments, 0 false hits; alpha API, already in two rules |
| `tsdoc-syntax.ts:82`, `docs.ts:275,355` | confirmed | grep |
| oxlint `--suppress-all` exists, +1 and -1 fail, swap passes, rename reds | confirmed | rerun, all four. The `lint` lane's "oxlint 1.94.0 has no bulk-suppression file" is therefore wrong |
| Recommendation: changed lines plus clean list avoids both holes | refuted | Moves and re-indents are added lines. `ratchet` lane's path-free fingerprint delta plus lock is the working form of the same idea |
| Recommendation: `@why <id>` resolving to a record for every constraint | refuted at scale | H is 9,002 of 21,732 (41.4%) so far, projecting to about 13,100 of 31,672 |
| Recommendation: AST-identical check is decisive | refuted | `ast.mjs` with oxc-parser: identical after removing `@ts-expect-error`, `@__PURE__`, `@internal`, `@deprecated`, `@vitest-environment`, triple-slash, `biome-ignore`, and the comment in an empty `catch`. A JSX comment removal and `return /*newline*/ 1` differ. In this repo: 34 files use `@vitest-environment`, 93 lines `@__PURE__`, 629 package src files `@internal`, and `tsconfig.base.json:40` says `stripInternal` is turned on when publishing |
| Recommendation: token savings as headline for a prose-first v1 | refuted | Bytes in comment-bearing src/test/tooling-root files: 101.4M; prose 3.77%, non-exported JSDoc 1.43%, member JSDoc 2.05%, exported JSDoc 18.44%. -53,249 of 2.887M lines is 1.8%. Less again if H comments stay |
| Recommendation: at least 10 trials per cell shows no regression | weakened | SonarSource ran 10 per cell and still reports high variance; needs a pre-stated margin, many tasks and per-task pairing |
| "AGENTS.md:193 conflicts with filing issues" | corrected | Same rule exempts operator-authorized deferrals |
| "No destination for implementation-level decisions" | refuted | `ADR-FORMAT.md:6-8` names package README or agent guidance |
| DECISIONS.md 3,281 lines, 90 dated; 1,390 goal decision paths; jsdoc law `:15-20` | confirmed | counted and read |
| Free prose first, exported JSDoc untouched | survives | With one addition: an unbanned JSDoc form is the escape route, so new non-exported JSDoc must be banned in the same rule |

Census share of the operator's four classes so far (T 19.9, X 0.6, S 1.4, D 4.4) is about 26%. H, N and G hold 73%. The fifth-class question is therefore the main question, not an edge case.
