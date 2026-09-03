# Prior art: judgment-shaped LLM repo-automation bots

**Audience:** beep-effect (public Effect v4 TypeScript monorepo). Deterministic gates already exist (Biome/ESLint, custom "laws" scanners, JSDoc inventory ratchets, knip/dead-code baselines, coverage ratchets, JSDoc-example docgen, knowledge-refs scanner, goal/exploration packet lint). The gap is **judgment** a reviewer would notice that a lint cannot express.

**Delivery constraint:** bots propose via PRs or reports; `main` is PR-only; humans merge.

**Method:** primary sources preferred (product docs, GitHub repos, engineering blogs, arXiv). Native X search (`x_keyword_search` / `x_semantic_search`) for practitioner noise reports, 2026-09-03. Every claim: dated URL + confidence `[high|medium|low]` + accessed 2026-09-03. Marketing/hype marked as such. Tools not invented. Sponsored/vendor-promo posts excluded.

**Status:** C1–C10, cross-cutting lessons, Sources, and native-X practitioner reports drafted 2026-09-03.

**How to read each example:** what it does → how it decides → how it delivers → evidence of value/noise → cost/limits → transfer to a markdown+TypeScript Effect monorepo.

---

## C1. Documentation enhancement bots

*LLM tools that improve docs/JSDoc/READMEs on a schedule or on PR. How they avoid hallucinated docs; how maintainers rated output.*

Beep-effect already compiles JSDoc examples and ratchets JSDoc inventory. The gap is **judgment**: which README paragraph is now lying, which API needs a worked example, which skill file is teaching a withdrawn pattern. Tools below are the real prior art for that gap.

### C1.1 Mintlify Agent + Automations — scheduled/event docs PRs

**What it does.** Mintlify’s agent researches connected repositories, existing docs, and the web; plans multi-file edits; writes MDX; runs Mintlify CLI checks; and (by default) opens a pull request rather than committing to main. Automations wrap that agent in repo-owned Markdown (or a dashboard) and fire on **cron or a push** to a product repo. Templates in the 2026 product materials cover changelog generation, feature-docs drafts after product merges, style audits, translation drift, and (in changelog notes) broken-link / SEO / API-sync jobs. Mintlify also auto-generates a `skill.md` (agentskills.io shape) plus `llms.txt` so other agents can consume the site; regeneration can lag up to 24 hours and requires a public site unless overridden by a repo `skill.md`. Sources: [Mintlify agent docs](https://www.mintlify.com/docs/agent) [high], accessed 2026-09-03; [Mintlify Automations blog](https://www.mintlify.com/blog/automations) [high], accessed 2026-09-03; [Mintlify skill.md](https://www.mintlify.com/docs/ai/skillmd) [high], accessed 2026-09-03.

**How it decides.** Natural-language automation prompts plus connected extra repos (product vs docs vs design system). Quality is prompt-shaped: examples tell the agent to restrict to user-facing changes, not leak private implementation, and — for judgment-heavy style audits — **describe violations instead of auto-editing**. Validation is **build/CLI**, not factuality: “Runs Mintlify CLI checks to ensure documentation builds correctly.” No citation-to-code requirement, no doctest, no independent hallucination detector in the public docs.

**How it delivers.** Default: PR. Hosted Mintlify deploys can commit to the deployment branch; Slack settings offer “Create a pull request” vs “Push to main”; branch protection can force PRs. Automations examples set `automerge: false`. Matches beep-effect’s PR-only main.

**Evidence of value / noise.** Vendor docs, not independent eval. Automations are labeled **beta**. No published precision/recall, maintainer accept-rate, or “docs were wrong” postmortem. Marketing claim that the agent “follows writing standards” is unquantified [low as evidence of quality].

**Cost / limits.** Agent is **Pro or Enterprise**. Static agent egress is Enterprise. Automations were Enterprise-beta at the blog’s writing, with broader availability “expected later.” No public token/job quotas on the pages fetched.

**Transfer to beep-effect.** Closest commercial analogue to a scheduled Grok bot that drafts docs PRs. Steal: (1) fire on product-repo push *or* cron, never silent-merge; (2) CLI/build gate before PR; (3) split “draft user-facing changelog” from “report style violations without editing”; (4) emit `skill.md`/`llms.txt` from *existing* JSDoc+packet docs rather than a second docs product. Do **not** copy Mintlify’s MDX site unless you want another source of truth — beep-effect already has docgen.

### C1.2 CodeRabbit — docstring generation + path instructions

**What it does.** CodeRabbit reviews PRs and can generate docstrings, scoped by `code_generation.docstrings.path_instructions` in `.coderabbit.yaml`. Separate from review path-instructions (which steer comments on `docs/**.md`, controllers, tests). A pre-merge **docstring coverage** check can fail PRs. Sources: [path instructions](https://docs.coderabbit.ai/configuration/path-instructions) [high], accessed 2026-09-03; [configuration reference](https://docs.coderabbit.ai/reference/configuration) [high], accessed 2026-09-03; [changelog](https://docs.coderabbit.ai/changelog) [medium], accessed 2026-09-03.

**How it decides.** Glob-scoped natural-language instructions on top of the built-in reviewer. CodeRabbit also auto-loads `AGENTS.md`, `CLAUDE.md`, `.cursorrules`. Docs warn: do **not** put guideline filenames under `path_instructions`; keep path instructions targeted after you’ve seen several noisy reviews. Custom checks (Team+) are a stricter sibling: analyze → verify with ast-grep/ripgrep/sandbox (read-only, **cannot run tests**) → Passed/Failed/Inconclusive. Source: [custom checks](https://docs.coderabbit.ai/pr-reviews/custom-checks) [high], accessed 2026-09-03.

**How it delivers.** Inline PR comments, optional docstring patches, pre-merge checks. Not a scheduled gardener; it rides PRs.

**Evidence of value / noise.** Real maintainer pushback exists: [gsd-build/get-shit-done#2932](https://github.com/gsd-build/get-shit-done/issues/2932) documents false positives from the docstring-coverage check on test callback closures; workaround is `reviews.pre_merge_checks.docstrings.mode: off` [high], accessed 2026-09-03. Crossplane’s `.coderabbit.yaml` **disables both** docstring coverage and automatic docstring generation — a signal that generated comments are treated as noise by a serious TS/Go project [medium], accessed 2026-09-03 via [crossplane/.coderabbit.yaml](https://github.com/crossplane/crossplane/blob/main/.coderabbit.yaml).

**Cost / limits.** Custom checks are paid-plan. Docstring generation is easy to turn into a ratchet that fails PRs on stylistic absence rather than semantic absence.

**Transfer.** Beep-effect already has a JSDoc inventory ratchet — **do not add a second coverage-style docstring bot**. Useful pattern: path-scoped NL instructions for *reviewing* docs in PRs (`docs/**`, `**/AGENTS.md`, `**/*.md` in `explorations/`/`goals/`). If a Grok bot generates JSDoc, gate on: (a) symbol still exists, (b) example compiles through existing docgen, (c) humans merge. Encode repeated CodeRabbit-style misses as Biome/laws scanners, not more NL.

### C1.3 Dosu — OSS issue Q&A + “self-documenting PRs” + docs reminders

**What it does.** Indexes code, issues, PRs, discussions; answers questions with citations; reminds maintainers when docs need changes; can draft/update documentation; monitors issues continuously and may resolve/close them. Hosted auto-labeling was withdrawn; OSS `auto-label` now runs in Actions with a chosen model plus a non-LLM companion for size/LGTM/auto-merge. Source: [Dosu OSS](https://dosu.dev/oss) [high], accessed 2026-09-03.

**How it decides.** Project context + rules/guidelines + thread text. Q&A claims citations into indexed code/docs/threads. No public description of a “don’t hallucinate APIs” compiler gate.

**How it delivers.** Comments in GitHub issues/discussions (and Slack/Discord on partner plans). Docs work is “write and update documentation” / reminders — delivery as repo edits is implied but not specified as always-PR on the OSS page.

**Evidence of value / noise.** Vendor metrics on the OSS page: “4,000+ issues resolved by Dosu,” 5,955+ installed repos, 25,000+ users helped, 14+ languages, replies “within minutes” — **marketing, no methodology** [low as independent evidence]. Auto-labeling being pulled from hosted and pushed to customer Actions is a useful negative: classification that looked magical was cheaper as a workflow the maintainer pays for and corrects.

**Cost / limits.** Free tier for public OSS; private/enterprise self-host. Actions minutes + model cost for OSS labeler.

**Transfer.** Stronger as an **issue-facing docs bot** (answer with citations; open a docs-debt issue or draft PR when an answer contradicts README) than as a JSDoc rewriter. Pair with beep-effect’s knowledge-refs scanner so Dosu-style answers cannot invent host paths.

### C1.4 Sweep — issue-triggered coding/docs agent (historical GitHub bot)

**What it does.** Originally a GitHub App: create an issue titled `Sweep: …` and the bot attempted the change and opened a PR. Self-host docs described that flow. By 2026 the public repo README repositions Sweep as a **JetBrains coding assistant**, not a GitHub gardener. Source: [sweepai/sweep](https://github.com/sweepai/sweep) [high], accessed 2026-09-03; historical deploy docs [sweep deployment.mdx](https://github.com/sweepai/sweep/blob/main/docs/pages/deployment.mdx) [medium], accessed 2026-09-03.

**How it decides / hallucination control.** Historical engineering post: generated PRs often had undefined variables and syntax errors; mitigation was **feeding failed GitHub Actions logs back** for repair. Source: [giving-dev-tools.mdx](https://github.com/sweepai/sweep/blob/main/docs/pages/blogs/giving-dev-tools.mdx) (dated 2023-07-26) [high], accessed 2026-09-03. Context-agent issues flagged “failure” when it made no tool calls or missed deps ([issue 3487](https://github.com/sweepai/sweep/issues/3487), 2024-04-08) [medium].

**Evidence.** Direct failure story, not a success metric. Product pivot away from GitHub-issue-to-PR is itself evidence the unattended docs/code bot was not a durable product.

**Transfer.** If a Grok bot writes docs from issues: **must compile/lint and loop on CI logs**; never merge; treat “Sweep:” as a prompt, not an assignment of trust. Prefer draft PRs.

### C1.5 Meta Glean — internal code index that also generates documentation

**What it does.** Meta open-sourced Glean (2024-12-19 engineering blog): code indexing/search at monorepo scale, with **documentation generation** as a listed capability — not a public scheduled docs-PR bot. Source: [Glean open source](https://engineering.fb.com/2024/12/19/developer-tools/glean-open-source-code-indexing/) [high], accessed 2026-09-03.

**Transfer.** Index-then-generate is the honest architecture: beep-effect already has symbol inventories. An LLM should write prose *against* that index, not invent symbols. Glean is infra, not a drop-in Action.

### C1.6 What did *not* show up as a credible “docs agent GitHub Action”

No first-party **Google Docs-bot** write-up analogous to Mintlify Automations. Google’s public 2024–2025 pieces are code-migration / Gemini Code Assist / Jules (agent that can produce diffs and changelogs) rather than a docs-freshness gardener. Jules: [Google Labs Jules](https://blog.google/innovation-and-ai/models-and-research/google-labs/jules/) (2025-05-20) [medium], accessed 2026-09-03 — relevant as a repo-aware agent that emits changelogs, not as a docs-quality eval. Ellipsis advertises GitHub-triggered agents including scheduled workflows ([ellipsis CLI SKILL](https://github.com/ellipsis-dev/cli/blob/main/skills/ellipsis/SKILL.md) [medium]); treat as a platform, not a measured docs bot.

**C1 hallucination-avoidance patterns that actually exist (not slogans):**

1. **Build/CLI gate** (Mintlify CLI; Sweep CI-log loop).
2. **Execute the docs** (beep-effect already compiles JSDoc examples; Doc Detective / CASCADE in C2 go further).
3. **Symbol existence** (Tan et al. in C2; Glean-like indexes).
4. **Human PR**, never silent main (Mintlify default; beep-effect constraint).
5. **Turn off coverage-style docstring ratchets** that fail on closures/tests (Crossplane, gsd-build).

---

## C2. Documentation and knowledge staleness detection

*Drift between code and docs/README/AGENTS.md/CLAUDE.md/skills; freshness checkers; link/anchor rot; last-verified metadata; embedding-diff / symbol-ref / LLM-contradiction / doctest techniques.*

Beep-effect already has a knowledge-refs scanner (host-path debt, semantic drift in markdown). Prior art below is what to add *around* it: executable docs, symbol-reference lints, PR-time auto-sync, and LLM contradiction only as a last layer.

### C2.1 Tan, Wagner, Treude — outdated code-element references (GitHub Action)

**What it does.** Detects documentation that still names code elements after those elements were deleted/renamed. Evaluation: analysis of 1,000 most popular GitHub projects; **>25% had at least one outdated reference**. Ships a configurable GitHub Action that scans docs on PRs. Papers: [arXiv:2212.01479](https://arxiv.org/abs/2212.01479) (2022) [high]; [arXiv:2307.04291](https://arxiv.org/abs/2307.04291) “Wait, wasn’t that code here before?” (submitted 2023-07-10) [high], accessed 2026-09-03.

**How it decides.** Deterministic symbol-reference matching, not embeddings. The 2023 paper is the Action packaging of the 2022 detector.

**How it delivers.** PR-time GitHub Action findings (configurable).

**Evidence.** Prevalence study on 1,000 popular repos is the strongest public number in this category. Abstract of 2307.04291 does not publish an FP rate [medium — method is high, FP unknown].

**Transfer.** Directly portable to JSDoc, README, `AGENTS.md`, `CLAUDE.md`, skills: flag mentions of exported symbols that knip/TS no longer export. This is the “encode LLM lessons in structure” version of docs drift. Should sit *next to* the knowledge-refs scanner, not replace it.

### C2.2 Swimm — code-coupled docs with Auto-sync on every PR

**What it does.** Docs are coupled to snippets, “smart tokens,” and paths. On each PR, Auto-sync classifies docs (vendor language elsewhere: up-to-date / out of sync / outdated) and **auto-updates minor** variable/parameter changes without a human. Developers are alerted only when attention is needed. Sources: [Swimm GitHub App blog](https://swimm.io/blog/keeping-internal-docs-up-to-date-always-with-the-swimm-github-app) [high], accessed 2026-09-03; [native integrations](https://swimm.io/blog/swimm-native-integrations) [medium]; [docs-as-code](https://swimm.io/learn/code-documentation/documentation-as-code-why-you-need-it-and-how-to-get-started) [medium].

**How it decides.** Snippet/token/path comparison against current code — structural, not LLM-judged contradiction.

**How it delivers.** GitHub App PR checks; silent auto-fix for minor token edits; human for the rest.

**Evidence.** Vendor blogs; no independent FP study. The interesting design choice is **auto-fixing the cheap drift** so humans only see semantic drift.

**Cost / limits.** Commercial product aimed at internal engineering docs, not public OSS JSDoc.

**Transfer.** Steal the split: (cheap, deterministic) rename/signature token updates vs (expensive, LLM) “this paragraph’s claim is now false.” Do not auto-merge even token updates on beep-effect main — open a PR. Smart-tokens in markdown that bind to exported Effect APIs would extend the knowledge-refs scanner.

### C2.3 Doc Detective — execute the docs against the product

**What it does.** Open-source (AGPL-3.0) framework: parse test specs and prose, run browser/UI actions, HTTP/link checks, shell, and **code-block execution**, emit JSON PASS/FAIL. README: “doc content testing framework”; tests “run them directly against your product.” Repo reports ~130 stars, 1,564 commits. Source: [doc-detective/doc-detective](https://github.com/doc-detective/doc-detective) [high], accessed 2026-09-03.

**How it decides.** Execution, not similarity. If the documented click/API/code block fails, the doc is stale.

**How it delivers.** JSON for CI; the project itself does not notify. Wire it to reviewdog/Actions.

**Evidence.** Method is the gold standard for “docs that teach a procedure.” Star count is modest; AGPL may be a problem for a public MIT/Apache-style monorepo — treat as architecture, not a dependency, unless license is acceptable.

**Transfer.** Beep-effect already compiles JSDoc examples. Extend that to: CLI walkthroughs in README (`bun run beep …`), skill files that claim a command exists, and packet manifests. A Grok bot should **propose** new Doc Detective (or bun test) cases from suspicious paragraphs, not assert drift from embeddings alone.

### C2.4 CASCADE (2026) — LLM tests from docs, keep only double-checked failures

**What it does.** Turns NL documentation into unit tests *and* generates an implementation from the same docs. Reports an inconsistency only when **(1) existing code fails the doc-derived test and (2) the doc-derived implementation passes that test**. Dataset: 71 mismatched + 814 matching Java pairs; additional Java/C#/Rust repos; **13 previously unknown inconsistencies, 10 subsequently fixed**. Authors: Kiecker, Sparka, Reuter, Ziegler, Grunske. Submitted 2026-04-21. Source: [arXiv:2604.19400](https://arxiv.org/abs/2604.19400) [high], accessed 2026-09-03.

**How it decides.** Two-sided execution gate — the important anti-hallucination trick in this whole file. An LLM test that the golden implementation also fails is a bad test, not a doc bug.

**How it delivers.** Research prototype; findings were reported to maintainers (10/13 fixed), not a GitHub App.

**Evidence.** Small but concrete: 10 merged fixes. Still needs human verification; Java-heavy main benchmark.

**Transfer.** This is the right shape for Effect JSDoc: generate a tiny bun test from the comment; if current code fails it, generate a reference snippet from the comment; only file a “docs lie” PR if the reference would pass. High-value, expensive; run on a schedule over exported APIs, not every PR.

### C2.5 Macke & Doyle 2024 — stale docs poison *downstream agents*

**Finding.** Incorrect documentation **greatly hinders** LLM code understanding; incomplete/missing docs have a smaller effect. [arXiv:2404.03114](https://arxiv.org/abs/2404.03114) (submitted 2024-04-03) [high], accessed 2026-09-03.

**Transfer.** Direct justification for treating `AGENTS.md`/`CLAUDE.md`/skills drift as a **first-class reliability bug**, not editorial nicety. A wrong instruction file is worse than a missing one. Prefer delete-or-date over “maybe still true.”

### C2.6 Vale — deterministic prose lint (not staleness, but the right inner loop)

**What it does.** Go CLI; YAML styles; markup-aware (Markdown/MDX/etc.); `level: error` fails CI; official GitHub Action. Explicitly **not** an LLM and not a writing tutor: it enforces the style you wrote. Sources: [docs.vale.sh](https://docs.vale.sh/) [high]; [vale.sh](https://vale.sh/) [high], accessed 2026-09-03. Mintlify can run Vale as a built-in CI check (vale.sh marketing).

**Transfer.** Encode *repeated* LLM style nits (forbidden phrases, “we start with schema”, Effect v4 API names, “never Set/Map”) as Vale (or existing laws scanners). Keep the LLM for contradictions Vale cannot see.

### C2.7 lychee — link/anchor rot

**What it does.** Rust async link checker for Markdown/HTML/etc.; GitHub Action `lycheeverse/lychee-action`; ~3.9k stars. Deterministic HTTP. Source: [lycheeverse/lychee](https://github.com/lycheeverse/lychee) [high], accessed 2026-09-03. `tcort/markdown-link-check` is the Node analogue; the popular `gaurav-nelson` Action was **deprecated April 2025** — prefer lychee for new CI [medium].

**Transfer.** Scheduled link check over README, docs, skills, packets. Cache + `.lycheeignore` for known flaky URLs. This is not LLM work; a Grok bot should only *summarize* lychee failures into a remediation PR (replace/remove/archive).

### C2.8 Mintlify freshness process (human cadence + agent drafts)

Mintlify’s own course: ship docs in the same PR as product changes; use the agent to draft updates; **quarterly freshness audits**. Source: [learn.mintlify.com keeping-docs-current](https://learn.mintlify.com/courses/structure-docs/keeping-docs-current) [medium], accessed 2026-09-03. `mint validate` / `mint score` are CLI readiness checks [medium].

**Transfer.** “Last verified: YYYY-MM-DD” frontmatter on `AGENTS.md`/skills/packets plus a quarterly Grok job that files issues for files past TTL. Cadence is the product; the LLM is optional.

### C2.9 Techniques that are *not* products yet (research / adjacent)

| Technique | Status | Use on beep-effect? |
|---|---|---|
| Symbol-reference validation | Shipped (Tan et al. Action; API Extractor `.api.md`) | **Yes, first.** |
| Execute-the-docs / doctest | Shipped (Doc Detective; JSDoc docgen; CASCADE) | **Yes, second.** |
| LLM-judged contradiction | Weak as a sole detector; CASCADE’s two-sided test is the serious version | Only behind execution. |
| Embedding diff of README vs code | Not found as a maintained OSS bot with published FP rates | Skip as a gate. |
| Last-verified metadata | Process (Mintlify quarterly), not a tool | Cheap; do it. |

**API Extractor** (Microsoft): committed `etc/<package>.api.md` snapshots of the public TS contract; production builds fail on drift (“You have changed the Public API signature for this project.”). Source: [API report demo](https://api-extractor.com/pages/overview/demo_api_report/) [high], accessed 2026-09-03. This is **API-doc drift**, not prose, and is the right inner loop for Effect public packages before any LLM migration bot (see C5).

---

## C3. Style and convention enforcement beyond lint

*LLM-based rule enforcers using natural-language rules. Precision/FP rates. Encoding repeated LLM findings as deterministic rules.*

Beep-effect already has Biome/ESLint plus custom “laws” scanners. The prior-art question is: **when is an NL rule worth an LLM on every PR, and when should it be compiled to ast-grep/Vale/Biome?** Every serious vendor now tells you to do the second thing.

### C3.1 CodeRabbit — path instructions, custom checks, ast-grep packages

**What it does.** Three layers: (1) glob-scoped **path instructions** that steer the reviewer; (2) **custom checks** — NL acceptance tests that return Passed/Failed/Inconclusive after a read-only tool loop (ast-grep, ripgrep, sandbox inspect; **cannot run tests or mutate**); (3) **ast-grep rule dirs/packages** that fire as structural lints on changed files (<8 MiB). Sources: [path instructions](https://docs.coderabbit.ai/configuration/path-instructions) [high]; [custom checks](https://docs.coderabbit.ai/pr-reviews/custom-checks) [high]; [ast-grep tool](https://docs.coderabbit.ai/tools/ast-grep) [high]; [ast-grep instructions](https://docs.coderabbit.ai/configuration/ast-grep-instructions) [high], accessed 2026-09-03. Essentials package: [coderabbitai/ast-grep-essentials](https://github.com/coderabbitai/ast-grep-essentials) [medium].

**How it decides.** Docs are unusually honest: write checks like acceptance tests (“Fail if…” / “Pass if…”); one concern per check; don’t ask for data the agent cannot see (approvals, test results). Path instructions should be added **after** watching several reviews miss something. Custom checks cannot post inline comments — summary table only.

**Evidence of noise.** Same as C1.2: docstring-coverage FPs; Crossplane disables generation. No published custom-check precision. Vendor implication: vague rules = noise.

**Transfer / “encode lessons in structure”.** The documented graduation path is: NL path-instruction → custom check → **ast-grep YAML** (`id`, `language`, `message`, `severity`) checked into the repo and run even without CodeRabbit. That is the correct beep-effect loop: Grok comments a repeated Effect v3 `Context.Tag` / `HashMap` vs `Map` miss → laws scanner or ast-grep rule → LLM stops saying it.

### C3.2 Greptile — versioned custom standards + strictness knob

**What it does.** Custom rules via dashboard, `.greptile/` (`config.json` + `rules.md` + `files.json`), or `greptile.json`. Rules have `rule`, optional `id`, `scope` globs, `severity`. Repo config wins; `.greptile/` cascades by directory. Source: [custom standards](https://www.greptile.com/docs/code-review/custom-standards) [high], accessed 2026-09-03. `strictness` 1–3 and `commentTypes` filter verbosity ([greptile.json reference](https://www.greptile.com/docs/code-review/greptile-json-reference) [high]).

**How it decides.** Docs: **“Rules must be specific and measurable.”** Ban “write clean code”; prefer “Functions must not exceed 50 lines.” Validate by opening a PR that deliberately violates the rule and checking Memory → Last Applied.

**Evidence of value / noise (vendor A/B, marketing).**
- Jul 2025 benchmark: 82% bug-catch **with default settings, no custom rules; FPs excluded from the score** — so it is not a precision number. [greptile.com/benchmarks](https://www.greptile.com/benchmarks) [low as precision evidence], accessed 2026-09-03.
- v4 (2026-03-05): addressed comments/PR 0.92→1.60 (+74%); author-addressed 30%→43%; “addressed” judged by **LLM-as-judge**. [v4 blog](https://www.greptile.com/blog/greptile-v4) [medium, vendor], accessed 2026-09-03.
- v5 (2026-08-05 changelog): median review 5:04→2:25; author-addressed comments 52%→66%. [changelog](https://www.greptile.com/changelog) [medium, vendor].

**Transfer.** Put NL Effect conventions in `.greptile/rules.md` *or* beep-effect `AGENTS.md`, but **scope to `packages/**/*.ts`**, give IDs, and promote any rule that fires weekly into Biome/laws. Use a strictness/quiet mode; beep-effect already uses Greptile in Yeet closeout — this is the lever, not a new bot.

### C3.3 GitHub Copilot code review — path-scoped `*.instructions.md`

**What it does.** Repo-wide `.github/copilot-instructions.md` plus path-scoped `.github/instructions/**/*.instructions.md` with YAML `applyTo: "src/**/*.ts"`. Copilot code review gained path-scoped files on **2025-09-03**; root `AGENTS.md` support for code review on **2026-06-18**. Sources: [path-scoped changelog](https://github.blog/changelog/2025-09-03-copilot-code-review-path-scoped-custom-instruction-file-support/) [high]; [custom instructions support matrix](https://docs.github.com/en/copilot/reference/custom-instructions-support) [high]; [add repository instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions) [high], accessed 2026-09-03.

**How it decides.** Instructions on the PR’s **head branch** are applied when changed files match `applyTo`. No published FP rate.

**Transfer.** Same file as human reviewers and Copilot coding agent (C6). Keep `applyTo` tight (`packages/beep-*/**/*.ts` vs `docs/**`). Duplicate of CodeRabbit path instructions — pick one NL-review surface to avoid triple-commenting.

### C3.4 Cursor Bugbot — `BUGBOT.md` + optional autofix agent

**What it does.** Reviews PRs on create/update; inline comments; reads existing comments to avoid repeats; rules from root + ancestor `.cursor/BUGBOT.md`; org-wide automations; optional Cursor Cloud Agent autofix on the same or a new branch. Manual trigger: `cursor review` / `bugbot run`. GA **2025-07-24**. Sources: [Bugbot docs](https://prod.cursor.com/docs/bugbot) [high]; [out of beta blog](https://cursor.com/blog/bugbot-out-of-beta) [medium, vendor], accessed 2026-09-03.

**Evidence (vendor, beta).** “Over 1 million PRs,” “over 1.5 million issues,” **>50% of detected bugs fixed before merge**; Rippling “40% of code-review time”; Discord “>50% resolution.” No FP%. Marketing. `dryRun` API exists for analysis without posting — the right way to eval noise.

**Transfer.** `BUGBOT.md` is another instruction file to keep in sync with `AGENTS.md` (C10). Autofix must stay on a branch/PR. Verbose mode (loaded rules, omissions, request ID) is a feature beep-effect bots should copy for auditability.

### C3.5 Danger JS + reviewdog — the deterministic half of “LLM lint”

**Danger JS.** CI runs a `dangerfile.ts`; posts markdown/warn/fail on the PR. Enforces changelog presence, PR size, missing tests, labels. **Not an LLM.** Source: [danger.systems/js](https://danger.systems/js/) [high], accessed 2026-09-03.

**reviewdog.** ~9.6k stars. Ingests any analyzer, filters to the diff, posts GitHub review comments/checks. **Not an LLM.** Source: [reviewdog/reviewdog](https://github.com/reviewdog/reviewdog) [high], accessed 2026-09-03.

**Transfer.** This is how you **graduate** Grok findings: Grok proposes; once a pattern is stable, Danger/reviewdog/ast-grep/Biome owns it. Sourcery (docs.sourcery.ai) is an LLM reviewer with custom rules — same class as CodeRabbit, weaker public eval; skip unless already subscribed.

**Precision rule of thumb from this category (not a meta-analysis):** vendors who publish numbers either (a) **exclude FPs from the headline** (Greptile 82%) or (b) proxy quality as **author-addressed comments** (Greptile v4/v5, Cursor “fixed before merge”). Neither is precision. Operational control is: measurable NL rules, path scope, strictness, and a promotion path into AST lints.

### C3.6 Practitioner noise reports (native X search, 2026-09-03)

Not a survey. These are **non-sponsored** posts returned by native `x_keyword_search` / `x_semantic_search`. Each is n=1 unless noted. Sponsored CodeRabbit posts and competitor attack-ads were discarded.

**Vendor admission that prompting does not fix comment volume.** Daksh Gupta (Greptile CEO), **2024-12-18**: the biggest complaint was “too many comments”; “Tried prompting, few-shotting, even fine-tuning. Nothing worked.” The product move was **semantic clustering** to drop comments similar to ones already posted. Source: [x.com/dakshgup/status/1869355023384691116](https://x.com/dakshgup/status/1869355023384691116) [high as a vendor stating the failure mode; not an independent precision number], accessed 2026-09-03.

**Head-to-head on two real changes (CodeRabbit found nothing valid).** David Vornholt, **2026-08-31**: across two production changes, a custom `review-fix` pass found **15 material issues**; CodeRabbit found **zero valid issues**; its only comment was a **false positive from a global repo pattern**. Source: [x.com/davidvornholt/status/1961814472215810247](https://x.com/davidvornholt/status/1961814472215810247) [medium — n=1, author of the competing workflow], accessed 2026-09-03.

**Teams that turned the bots off.** Sepand D, **2026-08-17**: “tried greptile, graphite through 2025. they were too noisy. i turned them all off.” Source: [x.com/SepandD/status/1957094879734300926](https://x.com/SepandD/status/1957094879734300926) [medium]. Eban Bisong, **2026-06-16**: “Tried CodeRabbit, too noisy.” (Also notes Bugbot at **$1–1.50 per review**.) Source: [x.com/ebanbisong/status/1934664734134051185](https://x.com/ebanbisong/status/1934664734134051185) [medium], accessed 2026-09-03.

**Noise is operationally fatal, not just annoying.** Rohit, **2026-06-26**: “the false positive rate is the whole game with review bots, one noisy week and the team mutes it forever.” Source: [x.com/rohit_jsfreaky/status/1938230823945990415](https://x.com/rohit_jsfreaky/status/1938230823945990415) [medium as an operational claim]. The Deep Flux, **2026-08-13**: “one noisy security PR can mute the entire bot.” Source: [x.com/thedeepflux/status/1955531082487505128](https://x.com/thedeepflux/status/1955531082487505128) [medium], accessed 2026-09-03.

**A second LLM to triage the first LLM’s comments.** Abhishek Ejam, **2026-08-30**: CodeRabbit and Bugbot were “noisy” with “unverified findings”; a `triage-pr-feedback` loop dropped feedback **~50%**. Source: [x.com/abhishekejam/status/1961772181875118506](https://x.com/abhishekejam/status/1961772181875118506) [medium — self-reported, no public eval], accessed 2026-09-03. Transfer: do **not** add a second Grok bot whose job is to silence the first; promote the repeated nits to ast-grep/Biome (C3.1) and raise the first bot’s bar.

**Measured verifier failure (vendor-published, not independent).** Fathom, **2026-08-31**: ran their own verifier over **71,677** AI-agent PRs; **~31%** of verifier claims **contradicted their own diff**; after preregistration, precision **0.23**; they **published the failure and disabled the feature**. Source: [x.com/fathom_lab/status/1962064486111941000](https://x.com/fathom_lab/status/1962064486111941000) [medium — first-party measurement of their own product], accessed 2026-09-03. Transfer: a scheduled Grok “verifier” that does not have to quote the hunk it is judging will invent findings. Two-sided evidence (C2.4 CASCADE) is the bar.

**Transfer from this slice.** Beep-effect already runs Greptile in Yeet. A *second* scheduled Grok style-bot on the same PRs inherits the mute-after-one-noisy-week failure. If it ships at all: path-scope, quiet/strictness, no global-pattern nits, and a kill switch after N unresolved FPs in a rolling week.

---

## C4. Repo gardener bots

*Stale issue/PR triage, label hygiene, flaky-test detection/quarantine, CI failure triage, LLM-summarized dependency digests beyond Renovate.*

### C4.1 `actions/stale` — deterministic inactivity (do not LLM this)

**What it does.** Marks inactive issues/PRs stale (default 60d) then closes (default +7d). Exemptions, dry-run, batching. V11 documented; Probot Stale **archived 2023-05-20** and points here. Sources: [actions/stale](https://github.com/actions/stale) (~1.7k stars) [high]; [probot/stale](https://github.com/probot/stale) [high], accessed 2026-09-03.

**Transfer.** Keep stale/close **rule-based**. An LLM gardener should only *summarize* a stale candidate that looks like a still-valid bug, not auto-close from vibes.

### C4.2 GitHub “Triaging an issue with AI” + Agentic Workflows

**Label-gated issue triage.** Adding `request ai review` runs an Action that comments/labels; maintainers decide. Source: [Triaging an issue with AI](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/triaging-an-issue-with-ai) [high], accessed 2026-09-03.

**Agentic Workflows (public preview).** Markdown+YAML frontmatter compiled to a locked Actions workflow. Can triage/label issues, investigate CI, status reports, docs updates, test-coverage improvements. Agents **read-only by default**; writes via declared “safe outputs” + threat detection. Default **1,000 AIC/run**; consumes Actions minutes + inference. Source: [About GitHub Agentic Workflows](https://docs.github.com/en/copilot/concepts/agents/about-github-agentic-workflows) [high], accessed 2026-09-03.

**Dosu** (C1.3/C6) is the OSS-maintainer version of this: hosted Q&A + (now Actions-based) auto-label; hosted auto-label was withdrawn — classification works better as a workflow the maintainer corrects.

**Transfer.** Label-gated, comment-only first. Safe-outputs + threat detection is the right default for any scheduled Grok bot with write tokens.

### C4.3 Flaky-test detection and quarantine — Trunk, BuildPulse, Datadog

Shared design (all three): a flake is a test that **passes and fails on the same commit / across comparable runs**; **quarantine = still runs, failure does not fail CI**; **disable/skip = does not run** (loses signal). Broken (always-fail) tests are **not** quarantine candidates (Trunk).

| Product | Detection | Auto-quarantine | Delivery | Source |
|---|---|---|---|---|
| **Trunk** | Historical PR/stable/merge-queue runs; “roughly 10+ runs” for reliability | Only tests with Flaky status; Always/Never overrides; audit log, API, webhooks | CLI rewrites job exit if all failures quarantined | [quarantining](https://docs.trunk.io/flaky-tests/quarantining) [high]; [detection](https://docs.trunk.io/flaky-tests/detection) [high] |
| **BuildPulse** | Git-based needs ≥10 results; statistical default 10 results + 30% fail | Threshold auto; critical tests exempt from auto; manual always | Jira/Linear/GitHub issues; resolving issue re-enables; MCP for agent triage | [Test Quarantining](https://docs.buildpulse.io/flaky-tests/guides/Test%20Quarantining) [high]; [MCP](https://platform.buildpulse.io/docs/mcp/) [medium] |
| **Datadog** | Test Optimization / CI Visibility; notify on new flake on default branch | Quarantine vs Disable; Jira/work items | Dashboards + API | [flaky management](https://docs.datadoghq.com/tests/flaky_management/) [high] |

Accessed 2026-09-03.

**Evidence of value.** Industry consensus that flakes burn CI and hide real failures; quarantine-while-running is the mature pattern. Evidence of **noise**: quarantining too early (Trunk’s 10+ runs; BuildPulse 30%) creates a junk drawer. No LLM is required for detection; LLM is optional for **root-cause packets**.

**Transfer.** Beep-effect: record bun/vitest retries; a Grok bot should not quarantine. It should open a **draft quarantine PR or issue** with: flake rate, first/last seen, owning package, and a hypothesized cause. Human merges the quarantine list. Prefer still-running quarantine over skip.

### C4.4 CI failure triage — Copilot “Fix with Copilot” (2026)

**What it does.** On a failed Actions job, Business/Enterprise (later Pro/Pro+/Max) can click **Fix with Copilot**; cloud agent investigates logs, **pushes a fix to the branch**, requests review. Changelog **2026-05-18**, expanded **2026-06-04**. Sources: [one-click fixes](https://github.blog/changelog/2026-05-18-one-click-fixes-for-failing-actions-with-copilot-cloud-agent/) [high]; [Pro expansion](https://github.blog/changelog/2026-06-04-fix-with-copilot-for-failing-actions-now-in-pro-pro-and-max/) [high], accessed 2026-09-03. Cookbook: Copilot CLI + GitHub MCP reads workflow runs/logs ([diagnose CI](https://docs.github.com/en/copilot/tutorials/copilot-cookbook/debug-errors/diagnose-ci-test-failures) [high]).

**Gating.** Org enablement; human review of the pushed fix. This is **more aggressive** than beep-effect’s PR-only-main (it pushes to the existing branch). Safer analogue: open a *new* fixup PR.

**Sweep’s 2023 lesson** (C1.4): feeding CI logs back to the model is necessary; it still produced syntax errors. Treat Copilot-pushed CI fixes as untrusted.

### C4.5 Dependency digests beyond Renovate — the LLM gap is real

**Renovate** already attaches **deterministic** changelogs: `sourceUrl` → GitHub releases / changelog files, filtered to versions in *this* PR. No LLM summarizer in official docs. `isBreaking` can be independent of SemVer bump. Source: [Renovate changelogs](https://docs.renovatebot.com/key-concepts/changelogs/) [high]; [versioning](https://docs.renovatebot.com/modules/versioning/) [high], accessed 2026-09-03.

**Transfer.** Do not replace Renovate. Add a **scheduled Grok job** that, for `effect` / `@effect/*` (and maybe Biome), reads the attached changelog + Effect `MIGRATION.md` and opens a **report PR** (impacted beep-effect symbols, suggested patch, links). Breaking-change *detection* should use API Extractor / ts-semver-checks (C5), not the LLM. The LLM writes the narrative and the first-pass grep of call sites.

---

## C5. Upstream watch bots

*Tracking a fast-moving dependency (here: Effect v4 RCs/betas) and producing API-drift/impact reports or migration PRs.*

Effect’s own repo currently treats v4 as **beta** (`main` = v4; `MIGRATION.md` plus generated `migration/v3-to-v4.md`, `migration/schema.md`, `migration/services.md`). Concrete break: `Context.Tag` / `Effect.Service` → `Context.Service`; no automatic `.Default` layer. Sources: [MIGRATION.md](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md) [high]; [services.md](https://github.com/Effect-TS/effect/blob/main/migration/services.md) [high]; FileSystem.watch options removed in `effect@4.0.0-beta.102` ([issue 6698](https://github.com/Effect-TS/effect/issues/6698)) [high], accessed 2026-09-03. A watch bot that only reads npm “minor” is **wrong**; betas reshuffle APIs.

### C5.1 cargo-semver-checks — the gold-standard *detector* (Rust)

**What it does.** Lints public API vs a baseline (crates.io / git / rustdoc JSON). Named lints map to major/minor; GitHub Action; exit 100 = denied violations. ~1.7k stars. Explicitly **does not** catch every break (type-signature / generic / lifetime gaps; nightly rustdoc JSON unstable). Source: [obi1kenobi/cargo-semver-checks](https://github.com/obi1kenobi/cargo-semver-checks) [high], accessed 2026-09-03. Sibling: [cargo-public-api](https://github.com/cargo-public-api/cargo-public-api) diffs the surface without SemVer policy.

**Transfer.** This is the detector. LLM is the impact narrator. TS analogues below.

### C5.2 go-apidiff — revision-to-revision exported API + semver-type

[joelanford/go-apidiff](https://github.com/joelanford/go-apidiff) [high]: incompatible vs compatible, emits `patch|minor|major`. Same shape: CI gate on the *dependency’s* exported surface if you vendor, or on *your* packages’ surface for downstream.

### C5.3 TypeScript: API Extractor + ts-semver-checks

**API Extractor** (C2.9): committed `.api.md` is a reviewable public-contract diff; production build fails on mismatch. Source: [API report](https://api-extractor.com/pages/overview/demo_api_report/) [high]. Spurious diffs from inferred types are a known pain ([rushstack#1958](https://github.com/microsoft/rushstack/issues/1958) [medium]).

**ts-semver-checks** ([ardenden/ts-semver-checks](https://github.com/ardenden/ts-semver-checks) [medium]) and **semver-checks** ([kyungseopk1m/semver-checks](https://github.com/kyungseopk1m/semver-checks) [medium]) extract TS export surfaces and classify SemVer. Less battle-tested than cargo-semver-checks; treat as candidates, not gospel.

**Transfer for Effect watch.** Two diffs, every Effect beta:
1. **Upstream surface:** generate/compare Effect’s public types (or consume their changelog + `migration/*.md`).
2. **Downstream impact:** grep/typecheck beep-effect against the new Effect, plus API Extractor on *beep-effect* public packages so you don’t break your own users.

LLM writes: “these N call sites use removed `Context.Tag`; here is a draft patch following `migration/services.md`.” Human merges.

### C5.4 Google internal LLM migrations (experience report, 2025)

[arXiv:2501.06972](https://arxiv.org/abs/2501.06972) *How is Google using AI for internal code migrations?* (Nikolov et al., submitted 2025-01-12) [high], accessed 2026-09-03. Full HTML: [arxiv.org/html/2501.06972](https://arxiv.org/html/2501.06972).

**Method (steal this, not the “80% AI-authored” headline):** Kythe/symbol seeds → cluster related files → Gemini edits with task-specific prompts → **build+test** → send failures back to the model → AST-compare to catch extra edits → score candidates → **human review, shard, gradual rollout**. “LLMs alone are insufficient”; LLMs shine at *edit generation* where AST rewrites are expensive; prefer small subtasks over autonomous planning; review capacity was the bottleneck (JUnit3→4: 5,359 files, ~87% of AI code committed unmodified, 3 months). Ads int32→int64: 500M+ LOC, **80% of landed mods fully AI-authored**, ~50% effort reduction — **vendor/org self-report, not a controlled experiment** [medium].

**Transfer.** Effect v4 migration PRs should be **sharded by package**, gated on `bun` typecheck/tests, and forbidden from silent extra refactors (AST/diff allowlist). Google’s 38% generic-suggestion accept rate is a reminder that untargeted bots are noise.

### C5.5 What a “release radar” bot actually is

No credible off-the-shelf “Effect RC radar” product found. Closest assembly:
- **Detect:** npm dist-tag / GitHub releases of `Effect-TS/effect` + cargo-semver-checks-class TS surface diff (C5.1–C5.3).
- **Narrate + patch:** Google-style LLM edit loop (C5.4) opening **draft PRs** or a dated `goals/` packet.
- **Do not:** Dependabot/Renovate alone (they won’t parse `Context.Service` migrations); don’t trust SemVer on `4.0.0-beta.N`.

---

## C6. Issue triage + reproduce-and-fix bots

*Dosu, Sweep, Copilot coding agent, Devin, pstack Benny: gating (reproduce twice, draft PR only), measured outcomes, failure stories.*

Beep-effect’s issue surface is public. A scheduled Grok bot that “fixes bugs” without a reproduce gate will spam draft PRs. The prior art that survives is **gated**: reproduce, evidence, draft-only, human merge.

### C6.1 GitHub Copilot coding / cloud agent — assign an issue, always get a PR

**What it does.** Assign Copilot on an issue (Assignees menu; optional extra instructions, repo, branch, agent, model). Copilot takes the issue title, body, and comments **present at assignment**, works in the cloud, and **always creates a pull request**, then requests review. Prompt-started tasks can stay on a reviewable branch until a PR is requested; repo-seeding creates a **draft** PR. Sources: [Kick off a task](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task) [high]; [Use Copilot agents overview](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/overview) [high], accessed 2026-09-03. Raycast assignment: changelog [2026-02-17](https://github.blog/changelog/2026-02-17-assign-issues-to-copilot-coding-agent-from-raycast/) [high].

**How it decides.** Issue text at assignment time + repo context + the chosen agent/model. **Follow-up comments on the issue are invisible:** “It does not see comments added after assignment.” Put steering on the PR. No public “reproduce twice” gate; the product assumes the issue is already a task.

**How it delivers.** PR (issue assignment) or branch-then-PR (prompt). Review requested. Does not auto-merge in the docs. Contrast C4.4 **Fix with Copilot**, which **pushes onto the existing branch** of a failed Actions run — too aggressive for PR-only `main`.

**Evidence / noise.** Product docs, not an independent accept-rate. Pinna et al. (arXiv:2602.08915, submitted 2026-02-09, revised 2026-05-07) compare Devin / Cursor / Codex / Copilot / Claude Code across 7,156 PRs: **no single agent wins every task type**; documentation PRs 82.1% vs new-feature 66.1%; Cursor 80.4% on *fix* tasks. Source: [arXiv:2602.08915](https://arxiv.org/abs/2602.08915) [medium — academic scrape, not a controlled RCT], accessed 2026-09-03.

**Cost / limits.** Paid Copilot; cloud-agent enablement. Third-party coding agents on paid plans. The ignored-after-assignment comment channel is a design bug for any bot that looks like “assign and walk away.”

**Transfer.** Usable as a **human-triggered** reproduce-and-fix *worker*, not as a cron that assigns every new issue. If a Grok scheduler files work, put the full spec in the issue **before** assignment and require the resulting PR to stay draft until CI is green. Do not use Fix-with-Copilot’s push-to-branch on `main`.

### C6.2 Sweep — historical issue→PR bot; CI-log loop; product left GitHub

Covered as a docs agent in C1.4. The coding-agent lesson is the same and sharper.

**What it did.** GitHub App: issue titled `Sweep: …` → attempted patch → PR. Self-host docs described that flow. **The GitHub App is now deprecated**; README and Marketplace listing say Sweep is a **JetBrains IDE plugin**. Sources: [sweepai/sweep](https://github.com/sweepai/sweep) (~7.7k stars) [high]; [sweep-ai-deprecated](https://github.com/apps/sweep-ai-deprecated) [high], accessed 2026-09-03.

**How it decided / failed.** 2023-07-26 engineering post: generated PRs often had undefined variables and syntax errors. Mitigation: strip timestamps, filter setup noise, pipe remaining Actions logs to GPT-3.5, post extracted errors as a PR comment treated like a user bug. Asking the model to *invent* a fix from the log “often caused incorrect changes,” especially against imperfect linters. Source: [giving-dev-tools.mdx](https://github.com/sweepai/sweep/blob/main/docs/pages/blogs/giving-dev-tools.mdx) (2023-07-26) [high], accessed 2026-09-03.

**Evidence.** Direct failure story + product pivot away from unattended GitHub-issue-to-PR. That pivot is itself evidence the category is hard.

**Transfer.** CI-log repair is **necessary and insufficient**. Keep the loop; add Benny-style evidence (C6.3) and TestGen-style filters (C7.1). Never treat “Sweep:” as an assignment of trust.

### C6.3 pstack Benny — reproduce twice through the real UI, draft PR only, never merge

**What it does.** Optional pstack automation: Slack-thread bug reports → triage → reproduce → bounded draft PR. Agent config: [FOR_AGENTS.md](https://github.com/backnotprop/pstack/blob/main/automations/benny/FOR_AGENTS.md) [high]; skill: [reproduce-and-fix-issues/SKILL.md](https://github.com/cursor/plugins/blob/main/pstack/automations/benny/skills/reproduce-and-fix-issues/SKILL.md) [high]; repo [backnotprop/pstack](https://github.com/backnotprop/pstack) (~188 stars) [high], accessed 2026-09-03.

**How it decides (steal this gate).** Quoted rules:

- “The exact discriminating symptom must appear **twice** through real UI interaction” (reset between attempts).
- Exactly **one** triage reply in the source Slack thread; never a new root message.
- Screenshots / video / read-only state checks; before-and-after proof.
- Verify any existing PR/commit before competing.
- **Draft PR only** after reproduction, root-cause, smoke test, and before/after proof.
- **“Never merge or deploy from this workflow.”**
- Stop when ownership is clear, access is missing, or evidence is inconclusive.

**How it delivers.** One Slack reply + a draft GitHub PR with repro, cause, tests, evidence, blast-radius. Humans merge.

**Evidence.** Published skill/policy, not a measured accept-rate. Value is the **gating**, which exists because ungated fix-bots were noisy. `/reflect` (C10.3) is how they promote a winning recipe into a skill without silent instruction drift.

**Cost / limits.** Needs a real UI (browser/desktop), Slack coordinates, and a human in the merge seat. Not a unit-test-only bot.

**Transfer.** For beep-effect: “twice” maps to **failing bun test or CLI repro twice** (or a Doc Detective walkthrough) before any patch. Draft PR only. One comment on the issue, not a flood. Stop if you cannot repro. This is the default policy for any scheduled Grok “fix” job.

### C6.4 Devin — vendor speed/confidence vs independent slowdown and unmergeable PRs

**What it does.** Cognition’s Devin: Slack/web/IDE agent that plans, edits, runs CI. **Devin 2.1 (2025-05-15)** added green/yellow/red **confidence scores** at session start, after planning, and on code questions. Yellow or red: **wait for user approval**; green continues. Vendor: scores are “highly correlated with success.” Source: [Devin 2025 release notes](https://docs.devin.ai/release-notes/2025) [high as product spec, vendor as quality claim], accessed 2026-09-03.

**Vendor outcomes (marketing).** 2025-02-26 internal eval: ~**7.8 minutes** on junior-dev tasks, ~2× October 2024, “less likely to loop” on CI/lint. Nubank ETL-monolith case study: **8–12×** efficiency and **>20×** cost savings with human approval — **vendor case study, not a controlled experiment** [low as general evidence]. [devin.ai](https://devin.ai/) [low].

**Independent counter-evidence.**

- METR RCT (2025-07-10): 16 experienced OSS developers, 246 real issues, primarily **Cursor Pro + Claude 3.5/3.7 Sonnet**. AI-allowed took **19% longer**; they had forecast a 24% speedup and afterwards still believed they were 20% faster. Source: [METR 2025-07-10](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) [high]; [arXiv:2507.09089](https://arxiv.org/abs/2507.09089) [high]. METR later marked the finding **out of date** after February 2026 follow-up data — still the best public RCT that *experienced maintainers in familiar repos* are a different population than vendor “junior-dev minutes.”
- METR (2025-08-12/13): 15 manually reviewed agent PRs — **“none of them are mergeable as-is.”** Benchmarks overestimate. Source: [METR 2025-08-12](https://metr.org/blog/2025-08-12-research-update-towards-reconciling-slowdown-with-time-horizons/) [high].
- Pinna et al. 2602.08915 (C6.1): no single agent dominates; Devin’s only reported consistent trend was **+0.77% acceptance per week over 32 weeks** [medium].

**Transfer.** Steal **yellow/red pause**, not the 7.8-minute headline. A scheduled Grok bot that auto-opens fix PRs must: (1) attach a confidence tag, (2) hold low-confidence as a report not a PR, (3) assume METR’s “not mergeable as-is.” Humans merge. Vendor “N×” case studies are not a prior-art measurement.

**Scheduled Grok already failed this in the wild.** Kevin Swiber, **2026-08-31**: Cursor Cloud Agent scheduled automation on **grok-4.6** opened **almost two identical PRs**, both **failing CI**. Source: [x.com/kevinswiber/status/1962184092732018863](https://x.com/kevinswiber/status/1962184092732018863) [medium — n=1, but the model+schedule shape matches this assignment], accessed 2026-09-03. Transfer: idempotency key (issue id / failing-check id / content hash) before opening a PR; refuse a second PR if an open one already covers the same target; never open if CI on the candidate branch is red.

### C6.5 GitHub native AI triage + Agentic Workflows — label-gated, read-only default, confidence on writes

**Issue triage (product).** GitHub’s AI issue-intake tool recommends actionable vs needs-more-info, as comments and/or labels. **Default gate:** starts when the `request ai review` label is applied (after choosing analysis labels). Docs: “Review the suggestions … and take appropriate action” — recommendations, not auto-close. Source: [Triaging an issue with AI](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/triaging-an-issue-with-ai) [high], accessed 2026-09-03.

**Agentic Workflows (public preview).** Markdown workflows compiled to a hardened `.lock.yml`, run in Actions. **Repo access read-only by default**; any write (issue, comment, PR) must be a declared **safe-output** that is threat-scanned before apply. Isolated/firewalled runtime; secrets kept outside the agent. Default cap **1,000 AIC/run** (1 AIC ≈ $0.01); `max-ai-credits` can lower/raise. Use cases listed: issue triage, CI investigation, docs updates, reporting. Sources: [About Agentic Workflows](https://docs.github.com/en/copilot/concepts/agents/about-github-agentic-workflows) [high]; changelog [2026-06-11 public preview](https://github.blog/changelog/2026-06-11-github-agentic-workflows-is-now-in-public-preview/) [high]; technical preview [2026-02-13](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/) [high], accessed 2026-09-03.

**Issue automation controls (2026-07-23 public preview).** Every supported action records a **rationale**. **High-confidence** actions can run automatically; **medium/low wait for review**. Can label, type, field-edit, assign (users or agents). Source: [changelog 2026-07-23](https://github.blog/changelog/2026-07-23-agent-automation-controls-in-github-issues-in-public-preview/) [high]; [rationale/confidence/approvals](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/manage-rationale-confidence-approvals) [high].

**Transfer.** Closest hosted shape to a scheduled Grok gardener that beep-effect could *also* run as Markdown+Actions: read-only unless a safe-output is declared; label-gate triage (`request ai review` analogue: only `bug`/`good first issue`/`effect-v4`); attach rationale+confidence; auto-apply only high-confidence *labels*, never closes or merge. Cost-cap per run.

### C6.6 Dosu — Q&A, stale-close, hosted auto-label withdrawn

Issue Q&A / docs reminders: C1.3. Additional triage facts:

**Stale-close (LLM).** Dosu can summarize the thread, classify resolved vs still-open, apply `Stale`, wait a grace period, then close, with daily close limits and excluded labels. Defaults described in the 2026-05-05 blog: **60 days** to stale, **7 more** to close; a non-bot reply removes `Stale`. Source: [An AI stale bot that you can trust](https://dosu.dev/blog/an-ai-stale-bot-that-you-can-trust) (2026-05-05) [high as product, vendor as “trust”], accessed 2026-09-03. Companion OSS: [dosu-ai/better-stale-bot](https://github.com/dosu-ai) [medium].

**Hosted auto-label withdrawn.** Effective **2026-09-01** Dosu removes hosted auto-labeling (plus PR size labels and `LGTM`), pointing at OSS [dosu-ai/auto-label](https://github.com/dosu-ai) running in *your* Actions with a model you choose. Source: Dosu migration notice [app.dosu.dev document](https://app.dosu.dev/9affd04a-e6a9-452c-b927-c639e979994c/documents/9c82afcd-5b61-4bc9-92c2-2778e3035290) [medium — vendor app-doc, not a dated blog], accessed 2026-09-03.

**Transfer.** Do not let an LLM **close** beep-effect issues; `actions/stale` (C4.1) is the deterministic closer if you want one. LLM may *comment* “looks resolved because X landed in PR #N” with links. Classification that looked magical (hosted auto-label) got cheaper as a workflow the maintainer pays for — same lesson as encoding CodeRabbit nits as ast-grep.

---

## C7. Test-gap and coverage-improvement bots

*Meta TestGen-LLM/ACH, Diffblue, Qodo Cover, CASCADE: acceptance criteria that keep them from adding vacuous tests.*

Beep-effect already ratchets coverage. The failure mode of an LLM test bot is **green, assertion-free tests that raise coverage on paper**. Every serious system below throws those away.

### C7.1 Meta TestGen-LLM — build → 5-run reliable → coverage↑, then humans

**What it does.** Improves existing Java unit tests at Meta with an LLM, then **filters**. Paper: Alshahwan et al., *Automated Unit Test Improvement using Large Language Models at Meta*, [arXiv:2402.09171](https://arxiv.org/abs/2402.09171) (2024-02-14) [high], accessed 2026-09-03.

**How it decides (the actual product).** In order:

1. **Build:** “Any code that does not build is immediately discarded.”
2. **Reliable:** “a test that does not pass on every one of **five** executions is deemed flaky” → discarded.
3. **Coverage:** “Any test that does not improve coverage is also discarded.”

Vacuous tests (no assertions, or assertion TODOs) were **not landed**; the paper notes they might still hint humans via an “implicit oracle” (didn’t throw).

**Evidence.** 75% built, 57% passed reliably, 25% increased coverage; **73% of recommendations accepted** into production; improved **11.5% of classes** targeted in test-a-thons. These are industrial self-report numbers with a clear filter stack — stronger than vendor SaaS blogs, still not a public RCT [medium–high].

**How it delivers.** Recommendations during test-a-thons / internal review, not unattended merge.

**Transfer.** Copy the filter stack onto bun: `tsc`/test file must compile → run **5×** → istanbul/v8 coverage must rise **or** (better) a mutant must die (C7.2). Require a real assertion AST (no `expect(true)` / empty `Effect.void`). Do not raise the coverage ratchet with LLM tests that only satisfy the ratchet.

### C7.2 Meta ACH — mutation-guided tests, not line coverage

**What it does.** *Mutation-Guided LLM-based Test Generation at Meta* (Foster et al., [arXiv:2501.12862](https://arxiv.org/abs/2501.12862), 2025-01-22; FSE Companion ’25) [high], accessed 2026-09-03. LLM proposes **issue-specific simulated faults**; another pass writes a test that **fails on the mutant and passes on original**. “ACH generates relatively few, highly specific mutants, by design.”

**Scale.** 10,795 Android Kotlin classes; 31,677 mutant candidates; **9,095** mutants that built and passed; **4,660** judged non-equivalent and targeted; **571** tests generated.

**Equivalent-mutant filter.** LLM detector alone (treating “unsure” as equivalent): **0.79 P / 0.47 R**. After lexical checks + stripping added comments: **0.95 P / 0.96 R**. Many “mutants” were comment-only.

**Caveats (authors).** Industrial Kotlin/Android baseline; Llama 3.1 70B; equivalence is undecidable; ACH protects against **future regressions**, not bugs already in HEAD; human review still required.

**Transfer.** This is the right *judgment* layer on top of beep-effect’s coverage ratchet: ask Grok to propose a fault in an Effect service (`Context.Service` mis-layer, missing defect, dropped interrupt), then a bun test that dies only on that fault. Discard comment-only “mutants.” Keep tests iff they kill a non-equivalent mutant. Coverage↑ is a weak proxy; mutant-kill is the gate.

### C7.3 Qodo Cover (ex-Codium) — desired-coverage CLI, **unmaintained 2025-06-15**

**What it does.** Generative loop: write tests, run, read coverage, add more toward `--desired-coverage` (0–100; examples use 70%). Repo [qodo-ai/qodo-cover](https://github.com/qodo-ai/qodo-cover) ~5.6k stars [high], accessed 2026-09-03.

**Status.** README: “This repository is **no longer maintained**” as of **2025-06-15**. Fork if you want it.

**Transfer.** Do not depend on Qodo Cover. Steal `--desired-coverage` as a *local* stop condition, never as a reason to merge. An unmaintained 5.6k-star coverage bot is a warning about the category’s product-market fit once the easy tests are written.

### C7.4 Diffblue Cover — keep the test only if JaCoCo coverage rises

**What it does.** Commercial (Java) test generator. Default: **retain generated tests only when they increase coverage** of the target class; merge mode also counts existing manual tests; `--new-jacoco-coverage` optimizes against the whole suite’s new JaCoCo data. Source: [Test coverage optimizations](https://cover-docs.diffblue.com/features/cover-cli/writing-tests/test-coverage-optimizations) [high], accessed 2026-09-03.

**Caveat (vendor docs).** Suite-wide optimization **may discard tests that are stronger on mutation or edge cases**. Coverage↑ is necessary, not sufficient — same hole ACH fills.

**Transfer.** Same keep-iff-coverage-increases rule as TestGen-LLM step 3. For Effect, prefer ACH-style mutant-kill as the *second* keep rule so you don’t throw away a good property test that doesn’t move line coverage.

### C7.5 CASCADE as a test-from-docs bot (see C2.4)

CASCADE (arXiv:2604.19400, submitted 2026-04-21) [high] is also a **test generator**: NL docs → unit test + reference impl; report inconsistency only if current code fails the test **and** the doc-derived impl passes. 13 unknown inconsistencies, 10 fixed.

**Transfer.** Run this on exported JSDoc, not as a coverage filler. A “docs lie” packet is a better Grok-bot output than 200 weak tests.

### C7.6 Vacuous-test acceptance criteria (synthesis, not a product)

Land an LLM test iff **all** of:

1. Compiles / typechecks.
2. Passes **5 consecutive** runs (TestGen-LLM flake filter; aligns with C4 quarantine: flakes still run).
3. Contains a real assertion (AST check; reject `expect(true)`, comment-only, TODO asserts).
4. **Either** raises coverage on the targeted symbol **or** kills a non-equivalent mutant (Diffblue ∪ ACH).
5. Opens as a **draft PR**; humans merge; never used to juice the coverage ratchet.

Anything less is how coverage bots rot a suite.

---

## C8. Security/quality findings triage bots

*Consuming scanner output (CodeQL, Semgrep, Copilot Autofix, Greptile threads) and producing prioritized remediation packets; FP dedup.*

Beep-effect already runs Greptile on PRs (Yeet). The gap is **backlog triage**: which CodeQL/Semgrep/Greptile finding is real, which is the same bug twice, which fix is safe. Every serious system **re-runs the original engine** after the LLM patch.

### C8.1 Semgrep Assistant — auto-triage in the app and on the PR (vendor 97%)

**What it does.** GA **2024-03-20**. Combines code understanding with **rule-specific prompts** to judge FP vs TP; for TPs, writes contextual remediation and autofix guidance. Delivered in the Semgrep app **and as PR comments**; early-access priority inbox. Source: [Assistant GA](https://semgrep.dev/blog/2024/assistant-ga-launch/) (2024-03-20) [high as product, vendor as metric], accessed 2026-09-03. Product-update twin: [semgrep-assistant-ga](https://semgrep.dev/products/product-updates/semgrep-assistant-ga/) [high].

**Evidence.** “Humans agree with Assistant’s auto-triage recommendation **97% of the time.**” **No methodology, no independent eval** [low as measurement, high as “this is what the vendor claims”]. Do not treat 97% as a reproducible FP rate.

**How it decides.** Finding + rule + surrounding code. The 2024 GA post does **not** document RAG; do not claim a RAG architecture from marketing slides.

**Transfer.** Shape for a Grok job: consume Semgrep/CodeQL SARIF + Greptile threads, emit a **prioritized packet** (true/false/duplicate, why, suggested patch). Human agrees in the PR. Do not auto-close alerts on a vendor agreement rate.

### C8.2 Semgrep Autofix (public beta 2026-03-16) — AI PRs after deterministic analysis

**What it does.** Pro engine does first-party usage analysis and third-party version-diff; Autofix then opens **AI-assisted PRs** with first-party changes and fix suggestions. Vendor: Assistant’s codebase-aware reachability can **“deprioritize more than 95% of false positives.”** Source: [Autofix public beta](https://semgrep.dev/blog/2026/semgrep-autofix-public-beta/) (2026-03-16) [high as product, **vendor/marketing** as 95%], accessed 2026-09-03.

**Gating.** Deterministic Semgrep analysis *before* the LLM patch (fixability, safer upgrade path, impact). Customer quote is marketing.

**Transfer.** Steal: **engine first, LLM second, PR not main**. Re-run Semgrep on the patch before asking a human. The 95% figure is not a gate you can reproduce; beep-effect should measure *its* FP agree-rate for a month before automating deprioritization.

### C8.3 GitHub Copilot Autofix (classic) — non-deterministic, may invent packages

**What it does.** Suggests fixes for code-scanning alerts on PRs / in the alert UI. GitHub’s own responsible-use doc:

- “Copilot Autofix uses a generative model that is **non-deterministic**.”
- “**may suggest fabricated dependencies**.”
- “You must **always review** suggestions … before accepting them.”
- “Always **verify dependency changes** before merging.”

Source: [Responsible use of security and quality AI features](https://docs.github.com/en/code-security/responsible-use/security-and-quality-ai-features) [high], accessed 2026-09-03. Related: Copilot can propose adding a dependency the original PR did not touch ([triage alerts in PRs](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-code-scanning-alerts/triage-alerts-in-pull-requests) [medium]); slopsquatting risk in [review AI-generated code](https://docs.github.com/en/copilot/tutorials/review-ai-generated-code) [medium].

**Transfer.** Any Grok security-fix PR must run **dependency review + lockfile diff allowlist**. Reject new package names that were not in the alert. This is a hard gate, not a style nit.

### C8.4 Agentic autofix (2026-07-10 public preview) — draft PR after re-running analysis

**What it does.** Assign a code-scanning alert to Copilot: explore files, patch, **rerun the original analysis**, iterate if the alert is still open, then open a **draft PR** with rationale and validation. Editor’s note (2026-07-16): CodeQL **and** third-party scanning alerts. Needs GitHub Code Security / Advanced Security + Copilot cloud agent; admins can disable. Source: [changelog 2026-07-10](https://github.blog/changelog/2026-07-10-agentic-autofix-for-code-scanning-alerts-in-public-preview/) [high]; [resolve alerts](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-code-scanning-alerts/resolve-alerts) [high], accessed 2026-09-03.

**Why this is the right shape.** Draft PR + **re-run the scanner that produced the finding**. Classic Autofix’s “suggestion in the UI” is weaker.

**Transfer.** Grok analogue: for each Semgrep/CodeQL/laws finding, patch on a branch, re-run the *same* scanner, open draft PR only if the alert closes and no new high findings appear. Still human-merge. Still dependency-review (C8.3).

### C8.5 GitHub security campaigns — bulk backlog, Autofix as a worker

**What it does.** GA **2025-04-08**: organize CodeQL alerts into campaigns (up to **1,000** alerts in later docs), notify owners, optional issues, org progress stats. Autofix can attach explanations/fixes; later, alerts can be **assigned to Copilot cloud agent** for PRs, including multiple alerts in one PR (agentic autofix). Sources: [campaigns GA](https://github.blog/changelog/2025-04-08-security-campaigns-are-now-generally-available-to-help-address-security-debt-at-scale/) [high]; [about campaigns](https://docs.github.com/en/code-security/concepts/security-at-scale/about-security-campaigns) [high]; [fix alerts at scale](https://docs.github.com/en/code-security/tutorials/secure-your-organization/best-practice-fix-alerts-at-scale) [high]; assign-to-Copilot [2025-10-28](https://github.blog/changelog/2025-10-28-assign-code-scanning-alerts-to-copilot-for-automated-fixes-in-public-preview/) [high], accessed 2026-09-03. Enterprise Cloud + GitHub Code Security.

**Transfer.** Packet format for beep-effect: a dated `goals/` campaign (N alerts, owner, Autofix-or-Grok worker, draft PRs). Do not dump 1,000 comments on main. Shard like Google migrations (C5.4).

### C8.6 Codex Security — research preview; primary pages 403 here

OpenAI announced **Codex Security** as a research preview (index page `https://openai.com/index/codex-security-now-in-research-preview/` and `https://help.openai.com/en/articles/20001107-codex-security` both **HTTP 403** from this research host, 2026-09-03). Web-search snippets alleged large commit/critical/high counts. **Those metrics are not verified from a primary page in this report and are not used.** Treat Codex Security as: vendor-shaped “scan → sandbox reproduce → patch → human review” (consistent with Autofix/ACH), **unmeasured here**.

**Transfer.** Do not schedule a Grok twin of an unverified vendor security agent. Reuse C8.4’s loop against tools beep-effect already runs (CodeQL/Semgrep/laws/Greptile).

**FP dedup (cross-tool).** No independent public eval of “LLM clusters duplicate findings across Semgrep+CodeQL+Greptile” was found. Practical prior art is: same-rule + same-location collapse (deterministic), then LLM narrative for the rest, then human. Assistant’s 97% and Autofix’s 95% are **not** that eval.

---

## C9. Research/intel digest bots for engineering teams

*arXiv/GitHub/X watchers producing dated packets with claims and suggested actions. Durable value vs noise; novelty gating.*

No independent study shows these digests change engineering outcomes. The **product is the filter**: score threshold, skip-already-seen, selective “would a researcher actually open this,” packet-as-Issue. Without that, a scheduled LLM is an unread mailing list.

### C9.1 AutoLLM/ArxivDigest — largest OSS digest (email, 1–10 scores)

**What it does.** Daily arXiv digest ranked by personal interests + categories. **GPT-3.5-Turbo-16k** scores relevance **1–10**; HTML output; optional SendGrid email. GitHub Actions after fork + secrets. Repo: [AutoLLM/ArxivDigest](https://github.com/AutoLLM/ArxivDigest) (~**464** stars) [high], accessed 2026-09-03. Quote: “This repo aims to provide a better daily digest for newly published arXiv papers.”

**How it decides.** Configured interests → LLM score. **No documented cutoff** — ranking without a threshold still dumps everything.

**How it delivers.** Email/HTML, not a repo packet. Fine for humans, weak for a monorepo that wants `goals/` PRs.

**Evidence.** Popularity (stars) only. No precision study.

**Transfer.** Steal the score; **add a cutoff** (C9.3) and write into GitHub Issues or a `goals/` PR (C9.2), not mail.

### C9.2 matouskozak/arxiv-digest — daily GitHub Issues as the packet

**What it does.** Actions at **07:00 UTC**; `gpt-5-mini` rates 0–10 against keywords; `gpt-5` summarizes; opens GitHub **Issues** (default 10 papers/issue, more issues if needed) with “📚 Read Later” checkboxes. [matouskozak/arxiv-digest](https://github.com/matouskozak/arxiv-digest) (**2** stars) [high], accessed 2026-09-03.

**Why it matters despite 2 stars.** Delivery matches beep-effect: a dated, commentable, closeable packet in the repo, not a chat dump. That is the right object for “Grok researched Effect v4 this morning.”

### C9.3 KernAlan/ai-reader — threshold gating + Telegram, not a firehose

**What it does.** Daily Actions **13:25 UTC**; LLM scores arXiv papers (relevance, importance, **arbitrage**) and trending GitHub repos (relevance, impact); writes HTML under `digests/`; **Telegram only if** paper arbitrage **≥ 9.0** or repo composite **≥ 8.0**. [KernAlan/ai-reader](https://github.com/KernAlan/ai-reader) (**0** stars) [high as mechanism, low as adoption], accessed 2026-09-03.

**Transfer.** The threshold *is* the product. A beep-effect Grok digest that always opens an Issue is noise. Open an Issue/PR only above a calibrated score; otherwise append to a rolling JSON (C9.4) and stay silent.

### C9.4 yang3kc/daily_arxiv_digest — JSON + skip already-generated dates + “be selective”

**What it does.** Fetch feeds, **dedup across feeds**, LLM-score vs topics, write Markdown **and JSON** (raw scores kept so thresholds can move later), cron, **skip dates that already have a digest**, optional force-regen. Agent-mode skill: “selective” — papers a researcher would actually open. [yang3kc/daily_arxiv_digest](https://github.com/yang3kc/daily_arxiv_digest) (~20 stars) [high], accessed 2026-09-03.

**Transfer.** Durable value = **novelty gating** (skip seen arXiv IDs / GitHub release tags / X post IDs) + machine-readable scores + a high bar for paging a human. For beep-effect: watch Effect releases (C5), arXiv Effect/TS papers, and (if native X search is on) practitioner noise about Effect v4 RCs. Packet template: claim, dated URL, confidence, suggested action (ignore / open issue / draft migration PR). Same citation contract as this file.

### C9.5 What did *not* show up

No credible “this weekly LLM digest paid for itself in merged PRs” study. Vendor research newsletters are marketing. X-native practitioner search belongs in the *input* of C9.4, not as a second unfiltered bot. If the digest cannot name a **new** Effect API, CVE, or paper since yesterday, it should no-op.

---

## C10. Agent-memory and skill maintenance bots

*Consolidate agent memory, refresh AGENTS.md/CLAUDE.md/skills from sessions, detect instruction contradictions, A/B evaluate skill edits.*

Wrong instruction files are worse than missing ones (C2.5 Macke & Doyle). A scheduled “improve AGENTS.md” bot without evals will teach withdrawn Effect v3 patterns. Prior art that is real: **progressive disclosure, with/without-skill evals, trigger A/B, surgical diffs, human approval, git commit.**

### C10.1 Anthropic skill-creator — SKILL.md <500 lines, with_skill vs without, trigger A/B

**What it does.** Official skill for creating/evaluating skills. [anthropics/skills …/skill-creator/SKILL.md](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) [high], accessed 2026-09-03. Also mirrored under [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/skill-creator/skills/skill-creator/SKILL.md) [high].

**Rules.** Progressive disclosure: metadata always loaded; SKILL.md body on trigger; scripts/references/assets on demand. **“Keep SKILL.md under 500 lines”**; TOC for references >300 lines.

**Evals.** For each test prompt, spawn **with_skill** and **without_skill** in the same turn (or snapshot the old skill as baseline). Assertions: objectively verifiable, `text` / `passed` / `evidence`; prefer scripts over eyeballing. Aggregate `benchmark.json` / `benchmark.md` (pass rate, tokens, timing).

**Trigger-description A/B.** The YAML `description` is “the primary mechanism for determining whether Claude invokes a skill.” Generate ~**20** queries (8–10 should-trigger, 8–10 near-miss should-not); ~60/40 train/held-out; 3 runs/query; iterate descriptions; pick by **held-out** score. Default trigger threshold in `run_eval.py` is **0.5**.

**Transfer.** Any Grok job that edits `AGENTS.md` / `CLAUDE.md` / `skills/` must ship: (1) a with/without eval on ~20 real beep-effect prompts, (2) a trigger eval so the skill does not fire on every chat, (3) a draft PR, (4) size cap. This is the only published eval harness in the category.

### C10.2 Codex skill-creator + memory consolidation — evidence-based, redact secrets, promote repeats to skills

**Skill-creator.** [Codex sample SKILL.md](https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md) [high], accessed 2026-09-03. Emphasis: “Assume Codex is already capable”; preserve user intent/scope; progressive disclosure; `scripts/quick_validate.py` for frontmatter/names/placeholders; test **observable outcomes**, not wording; isolated workspace.

**Consolidation template.** [consolidation.md](https://github.com/openai/codex/blob/main/codex-rs/memories/write/templates/memories/consolidation.md) [high]: **Evidence-based only**; **Redact secrets**; **No-op** if nothing reusable was learned; **Merge duplicates**; provenance (paths, timestamps); **Create a skill** from repeated reliable procedures (trigger, steps, verification). Memory is historical context — **current AGENTS.md wins** (see also [openai/codex#34668](https://github.com/openai/codex/issues/34668) [medium]).

**Nested AGENTS.md (Codex).** `docs/agents_md.md` in the Codex repo is a **stub** (“see this documentation”) as of this access [low for Codex-specific nested rules]. Do not invent Codex precedence from the stub.

**Transfer.** Scheduled Grok memory bot: read session traces → propose surgical MEMORY.md / skill diffs → **no-op if empty** → never write secrets or 1Password refs as values → promote a recipe to a skill only after it repeated. AGENTS.md remains policy; memory remains preference.

### C10.3 pstack `/reflect` — three reviewers, then wait for approval

**What it does.** After a successful task, `/reflect` sends the transcript to **three parallel reviewers**; a synthesizer buckets **Accepted / Rejected / Backlog**; **waits for approval before modifying any skill**. Source: [09-make-it-yours.md](https://github.com/backnotprop/pstack/blob/main/docs/guide/09-make-it-yours.md) [high], accessed 2026-09-03. Repo README lists `/reflect` as the recipe-to-skill path ([backnotprop/pstack](https://github.com/backnotprop/pstack) [high]).

**Transfer.** Do not let a cron rewrite skills unattended. Reflect → proposal PR → human. Pair with Benny (C6.3): the same system that refuses to merge code also refuses to silently mutate its own instructions.

### C10.4 pi-reflect — surgical file edits, skip ambiguous, reject large deletions, git-commit

**What it does.** [jo-inc/pi-reflect](https://github.com/jo-inc/pi-reflect) (**44** stars) [high], accessed 2026-09-03. Reads recent agent conversations against a target Markdown file (`AGENTS.md`, `MEMORY.md`, `SOUL.md`), proposes focused improvements (durable facts in, stale out, stronger rules). Cron/launchd/noninteractive. Quote: “define the target → reflect reads evidence → edits the file → the agent gets closer.”

**Safety.** Backups; **skip ambiguous matches**; **reject unusually large deletions**; auto-commit when the target is in git.

**Transfer.** This is the right *diff policy* for instruction files: surgical, abort on ambiguity, abort on huge deletions (a hallucinated “rewrite AGENTS.md from scratch” is the failure mode). Still wrap with C10.1 evals and a PR on beep-effect (auto-commit-to-main violates PR-only).

### C10.5 Nested AGENTS.md + path-scoped `*.instructions.md` — and the Copilot split-brain

**Coding agent nested files.** Changelog **2025-08-28**: Copilot coding agent supports nested `AGENTS.md` (“apply to specific parts of your project”). Source: [changelog 2025-08-28](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/) [high]. IDE docs: “the **nearest** `AGENTS.md` file in the directory tree will take precedence.” Path-specific Copilot instructions live in `.github/instructions/*.instructions.md` with `applyTo` globs (comma-separated); they supplement, they are not AGENTS.md. Source: [add repository instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions-in-your-ide/add-repository-instructions-in-your-ide) [high], accessed 2026-09-03. `excludeAgent` frontmatter (e.g. hide from code-review): changelog [2025-11-12](https://github.blog/changelog/2025-11-12-copilot-code-review-and-coding-agent-now-support-agent-specific-instructions/) [high]. Path-scoped review instructions: [2025-09-03](https://github.blog/changelog/2025-09-03-copilot-code-review-path-scoped-custom-instruction-file-support/) [high] (already C3).

**Code review is root-only (2026-06-18).** “Copilot code review now supports **repository-level** `AGENTS.md` files” and reads them **from the repository root**. Nested files are **not** mentioned. Source: [changelog 2026-06-18](https://github.blog/changelog/2026-06-18-copilot-code-review-agents-md-support-and-ui-improvements/) [high].

**Transfer.** Nested AGENTS.md is real for *implementation* agents (deeper wins). **Review** bots may only see root. A Grok gardener that “fixes” a nested `packages/foo/AGENTS.md` can teach the coding agent a rule Greptile/Copilot-review never reads — then Yeet fights itself. Prefer root policy + `applyTo` instruction files for path nits, or accept the split and document it. Mintlify `skill.md` / `llms.txt` (C1.1) is the docs-site analogue: regenerate on a schedule, but a repo `skill.md` should win over a stale hosted copy (Mintlify can lag **24h**).

### C10.6 Macke & Doyle 2024 — incorrect docs/instructions hurt agents more than missing ones

Already C2.5: incorrect documentation degraded LLM code understanding **more than missing documentation**. Source: [arXiv:2404.03114](https://arxiv.org/abs/2404.03114) [high], accessed 2026-09-03.

**Transfer.** Instruction-maintenance bots have a **negative expected value** unless evals (C10.1) show with_skill ≥ without_skill on held-out tasks. Default action is **no-op**, not “rewrite CLAUDE.md.” Delete or quarantine withdrawn Effect v3 recipes (`Context.Tag`, `Effect.Service`) rather than appending a contradictory v4 paragraph.

---

## Cross-cutting lessons

Ten rules that recur. Each is sourced; none is a slogan.

1. **Propose via PR or report. Never merge, never push to `main`.** Benny: “Never merge or deploy from this workflow” (C6.3). Mintlify Automations examples set `automerge: false` (C1.1). Copilot agentic autofix opens **draft** PRs (C8.4). Agentic Workflows: writes only through declared **safe-outputs** (C6.5). Copilot “Fix with Copilot” **pushing to the existing branch** (C4.4) is the anti-pattern for a PR-only repo.

2. **Deterministic gate before and after the LLM.** TestGen-LLM: build → 5-run → coverage↑ (C7.1). Mintlify: CLI build (C1.1). Google migrations: build+test loop + AST-compare extra edits (C5.4). Copilot agentic autofix: **rerun CodeQL** before the draft PR (C8.4). Semgrep Autofix: engine analysis before the AI PR (C8.2). Sweep showed log-feedback is necessary and still produced syntax errors (C6.2).

3. **Two-sided evidence for “X is wrong.”** CASCADE files a docs-lie only if current code fails the doc-test **and** a doc-derived impl passes (C2.4, C7.5). Benny requires the symptom **twice** and a before/after (C6.3). One failing LLM test is a bad test until the other side lands.

4. **Reproduce (or execute) before patching.** Benny: twice through the real UI (C6.3). Doc Detective: run the docs (C2.3). Beep-effect already compiles JSDoc examples — extend that, don’t replace it with embeddings (C2 ranking). Copilot coding agent **ignores issue comments after assignment** (C6.1): put the repro in the issue *before* you assign, then steer on the PR.

5. **Promote repeated LLM nits to scanners.** CodeRabbit path instructions and custom checks graduate to **ast-grep packages** (C3). Vale/lychee/Danger/reviewdog are the deterministic half (C2, C3). Dosu **withdrew hosted auto-label** and pushed it to Actions (C6.6). If Greptile or Grok says the same Effect v4 smell three times, it becomes a laws/Biome/ast-grep rule, not a fourth prompt.

6. **Wrong instructions are worse than missing ones.** Macke & Doyle 2024 (C2.5, C10.6). pi-reflect **rejects large deletions** and **skips ambiguous matches** (C10.4). Codex consolidation: **no-op** if nothing was learned; redact secrets; AGENTS.md beats memory (C10.2). Default for a skill-gardener is silence.

7. **A/B eval instruction and skill edits, then wait for a human.** Anthropic skill-creator: with_skill vs without_skill, ~20 trigger queries, held-out description pick (C10.1). pstack `/reflect`: three reviewers, Accepted/Rejected/Backlog, **approval before any skill write** (C10.3). Nested vs root AGENTS.md do not even reach the same agents (C10.5) — eval the surface you actually use (Greptile + Grok + Copilot review).

8. **Confidence-gate writes; label-gate triage; idempotency-gate PRs.** Devin 2.1: pause on yellow/red (C6.4). GitHub 2026-07-23: high-confidence auto, medium/low wait; every action has a rationale (C6.5). Issue AI triage defaults to the `request ai review` label (C6.5). Digests: **threshold or no-op** (ai-reader ≥9.0/8.0, C9.3); skip already-seen dates/IDs (C9.4). METR: 15 agent PRs **none mergeable as-is**; experienced OSS devs were **19% slower** in the 2025 RCT (later marked out of date, still a warning) (C6.4). Scheduled **grok-4.6** in Cursor already opened **duplicate CI-red PRs** (C6.4, Swiber 2026-08-31). Practitioner reports: **one noisy week mutes the bot forever** (C3.6).

9. **Detect with a surface diff; narrate with an LLM; never trust SemVer on betas.** cargo-semver-checks / go-apidiff / API Extractor / ts-semver-checks (C5). Effect `4.0.0-beta.N` reshuffles APIs (`Context.Service`, FileSystem.watch in beta.102) (C5). Renovate changelogs are deterministic; the LLM writes impact + draft patch (C4.5). Google 2501.06972: shard, repair-loop, **no extra refactors**, human review is the bottleneck (C5.4).

10. **Re-run the original scanner; never juice a ratchet with LLM output.** Security: rerun CodeQL/Semgrep after the patch (C8.4, C8.2); **dependency review** because Autofix may **fabricate packages** (C8.3). Tests: keep iff assertion + 5-run + coverage↑ or mutant-kill (C7.6); ACH’s comment-only mutants (C7.2). Docs: do **not** add a second JSDoc-coverage bot (C1 CodeRabbit/Crossplane). Coverage ratchets and docstring ratchets will accept vacuous LLM work and then lock it in.

**Bonus operational constraints (already true for beep-effect):** quarantine flakes while still running them (C4); `actions/stale` not an LLM closer (C4.1, C6.6); main is PR-only.

---

## Sources

All accessed **2026-09-03**. Marketing/vendor-metric pages are tagged in-line above; they are listed here without being laundered into facts.

### C1 Documentation enhancement

- https://www.mintlify.com/docs/agent
- https://www.mintlify.com/blog/automations
- https://www.mintlify.com/docs/ai/skillmd
- https://docs.coderabbit.ai/changelog
- https://docs.coderabbit.ai/reference/configuration
- https://github.com/crossplane/crossplane/blob/main/.coderabbit.yaml
- https://github.com/gsd-build/get-shit-done/issues/2932
- https://dosu.dev/oss
- https://github.com/sweepai/sweep
- https://github.com/sweepai/sweep/blob/main/docs/pages/deployment.mdx
- https://github.com/sweepai/sweep/blob/main/docs/pages/blogs/giving-dev-tools.mdx
- https://github.com/sweepai/sweep/issues/3487
- https://engineering.fb.com/2024/12/19/developer-tools/glean-open-source-code-indexing/
- https://blog.google/innovation-and-ai/models-and-research/google-labs/jules/
- https://github.com/ellipsis-dev/cli/blob/main/skills/ellipsis/SKILL.md

### C2 Staleness

- https://arxiv.org/abs/2212.01479
- https://arxiv.org/abs/2307.04291
- https://swimm.io/blog/keeping-internal-docs-up-to-date-always-with-the-swimm-github-app
- https://swimm.io/blog/swimm-native-integrations
- https://swimm.io/learn/code-documentation/documentation-as-code-why-you-need-it-and-how-to-get-started
- https://github.com/doc-detective/doc-detective
- https://arxiv.org/abs/2604.19400
- https://arxiv.org/abs/2404.03114
- https://vale.sh/
- https://docs.vale.sh/
- https://github.com/lycheeverse/lychee
- https://learn.mintlify.com/courses/structure-docs/keeping-docs-current
- https://api-extractor.com/pages/overview/demo_api_report/
- https://github.com/microsoft/rushstack/issues/1958

### C3 Style beyond lint

- https://docs.coderabbit.ai/configuration/path-instructions
- https://docs.coderabbit.ai/pr-reviews/custom-checks
- https://docs.coderabbit.ai/configuration/ast-grep-instructions
- https://docs.coderabbit.ai/tools/ast-grep
- https://github.com/coderabbitai/ast-grep-essentials
- https://www.greptile.com/docs/code-review/custom-standards
- https://www.greptile.com/docs/code-review/greptile-json-reference
- https://www.greptile.com/benchmarks
- https://www.greptile.com/blog/greptile-v4
- https://www.greptile.com/changelog
- https://github.blog/changelog/2025-09-03-copilot-code-review-path-scoped-custom-instruction-file-support/
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions
- https://docs.github.com/en/copilot/reference/custom-instructions-support
- https://cursor.com/blog/bugbot-out-of-beta
- https://prod.cursor.com/docs/bugbot
- https://danger.systems/js/
- https://github.com/reviewdog/reviewdog
- https://x.com/dakshgup/status/1869355023384691116 (2024-12-18)
- https://x.com/davidvornholt/status/1961814472215810247 (2026-08-31)
- https://x.com/abhishekejam/status/1961772181875118506 (2026-08-30)
- https://x.com/SepandD/status/1957094879734300926 (2026-08-17)
- https://x.com/ebanbisong/status/1934664734134051185 (2026-06-16)
- https://x.com/thedeepflux/status/1955531082487505128 (2026-08-13)
- https://x.com/rohit_jsfreaky/status/1938230823945990415 (2026-06-26)
- https://x.com/fathom_lab/status/1962064486111941000 (2026-08-31)

### C4 Repo gardeners

- https://github.com/actions/stale
- https://github.com/probot/stale
- https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/triaging-an-issue-with-ai
- https://docs.github.com/en/copilot/concepts/agents/about-github-agentic-workflows
- https://docs.trunk.io/flaky-tests/detection
- https://docs.trunk.io/flaky-tests/quarantining
- https://docs.buildpulse.io/flaky-tests/guides/Test%20Quarantining
- https://platform.buildpulse.io/docs/mcp/
- https://docs.datadoghq.com/tests/flaky_management/
- https://github.blog/changelog/2026-05-18-one-click-fixes-for-failing-actions-with-copilot-cloud-agent/
- https://github.blog/changelog/2026-06-04-fix-with-copilot-for-failing-actions-now-in-pro-pro-and-max/
- https://docs.github.com/en/copilot/tutorials/copilot-cookbook/debug-errors/diagnose-ci-test-failures
- https://docs.renovatebot.com/key-concepts/changelogs/
- https://docs.renovatebot.com/modules/versioning/

### C5 Upstream watch

- https://github.com/Effect-TS/effect/blob/main/MIGRATION.md
- https://github.com/Effect-TS/effect/blob/main/migration/services.md
- https://github.com/Effect-TS/effect/issues/6698
- https://github.com/obi1kenobi/cargo-semver-checks
- https://github.com/cargo-public-api/cargo-public-api
- https://github.com/joelanford/go-apidiff
- https://github.com/ardenden/ts-semver-checks
- https://github.com/kyungseopk1m/semver-checks
- https://arxiv.org/abs/2501.06972
- https://arxiv.org/html/2501.06972

### C6 Issue triage + fix

- https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/overview
- https://github.blog/changelog/2026-02-17-assign-issues-to-copilot-coding-agent-from-raycast/
- https://arxiv.org/abs/2602.08915
- https://github.com/apps/sweep-ai-deprecated
- https://github.com/backnotprop/pstack
- https://github.com/backnotprop/pstack/blob/main/automations/benny/FOR_AGENTS.md
- https://github.com/cursor/plugins/blob/main/pstack/automations/benny/skills/reproduce-and-fix-issues/SKILL.md
- https://docs.devin.ai/release-notes/2025
- https://devin.ai/
- https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- https://arxiv.org/abs/2507.09089
- https://metr.org/blog/2025-08-12-research-update-towards-reconciling-slowdown-with-time-horizons/
- https://github.blog/changelog/2026-06-11-github-agentic-workflows-is-now-in-public-preview/
- https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/
- https://github.blog/changelog/2026-07-23-agent-automation-controls-in-github-issues-in-public-preview/
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/manage-rationale-confidence-approvals
- https://x.com/kevinswiber/status/1962184092732018863 (2026-08-31)
- https://dosu.dev/blog/an-ai-stale-bot-that-you-can-trust
- https://github.com/dosu-ai
- https://app.dosu.dev/9affd04a-e6a9-452c-b927-c639e979994c/documents/9c82afcd-5b61-4bc9-92c2-2778e3035290

### C7 Tests

- https://arxiv.org/abs/2402.09171
- https://arxiv.org/html/2402.09171
- https://arxiv.org/abs/2501.12862
- https://arxiv.org/html/2501.12862
- https://github.com/qodo-ai/qodo-cover
- https://cover-docs.diffblue.com/features/cover-cli/writing-tests/test-coverage-optimizations

### C8 Security/quality triage

- https://semgrep.dev/blog/2024/assistant-ga-launch/
- https://semgrep.dev/products/product-updates/semgrep-assistant-ga/
- https://semgrep.dev/blog/2026/semgrep-autofix-public-beta/
- https://docs.github.com/en/code-security/responsible-use/security-and-quality-ai-features
- https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-code-scanning-alerts/triage-alerts-in-pull-requests
- https://docs.github.com/en/copilot/tutorials/review-ai-generated-code
- https://github.blog/changelog/2026-07-10-agentic-autofix-for-code-scanning-alerts-in-public-preview/
- https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-code-scanning-alerts/resolve-alerts
- https://github.blog/changelog/2025-04-08-security-campaigns-are-now-generally-available-to-help-address-security-debt-at-scale/
- https://docs.github.com/en/code-security/concepts/security-at-scale/about-security-campaigns
- https://docs.github.com/en/code-security/tutorials/secure-your-organization/best-practice-fix-alerts-at-scale
- https://github.blog/changelog/2025-10-28-assign-code-scanning-alerts-to-copilot-for-automated-fixes-in-public-preview/
- https://openai.com/index/codex-security-now-in-research-preview/ (HTTP 403 from this host; not used for metrics)
- https://help.openai.com/en/articles/20001107-codex-security (HTTP 403)

### C9 Digests

- https://github.com/AutoLLM/ArxivDigest
- https://github.com/matouskozak/arxiv-digest
- https://github.com/KernAlan/ai-reader
- https://github.com/yang3kc/daily_arxiv_digest

### C10 Skills / memory / AGENTS.md

- https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md
- https://github.com/anthropics/claude-plugins-official/blob/main/plugins/skill-creator/skills/skill-creator/SKILL.md
- https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/run_eval.py
- https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md
- https://github.com/openai/codex/blob/main/codex-rs/memories/write/templates/memories/consolidation.md
- https://github.com/openai/codex/blob/main/docs/agents_md.md (stub)
- https://github.com/openai/codex/issues/34668
- https://github.com/backnotprop/pstack/blob/main/docs/guide/09-make-it-yours.md
- https://github.com/jo-inc/pi-reflect
- https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/
- https://docs.github.com/en/copilot/how-tos/configure-custom-instructions-in-your-ide/add-repository-instructions-in-your-ide
- https://github.blog/changelog/2025-11-12-copilot-code-review-and-coding-agent-now-support-agent-specific-instructions/
- https://github.blog/changelog/2026-06-18-copilot-code-review-agents-md-support-and-ui-improvements/

### Cross-cutting (already listed above)

METR, CASCADE, TestGen-LLM, Macke & Doyle, Google 2501.06972, Benny, Agentic Workflows, Copilot Autofix responsible-use, cargo-semver-checks, Mintlify Automations, Dosu auto-label withdrawal. Native X practitioner reports listed under C3 and C6.
