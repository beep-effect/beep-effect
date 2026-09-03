# Grok Bot automation recommendations for beep-effect

Date: 2026-09-03

This is a portfolio recommendation, not a product catalog. The repo already has a strong deterministic control plane. Grok Bot earns a place only where unattended timing, external discovery, or semantic judgment adds something that `beep`, Yeet, and GitHub Actions do not.
The default posture throughout is report-first, bounded, idempotent, and human-admitted.

## A. What Grok Bot actually is, in one screen

- **Product and host.** Grok Bot is a Cursor product presented through xAI branding.
  Each Cursor user gets one US-hosted, non-root Firecracker microVM; all of that user's Bots share its browser sessions, credentials, terminal, and durable `/workspace`. Isolation is per user, not per Bot. The product remained an early beta on 2026-09-03. (g1-grok-bot-facts.md § Q1. What Grok Bot is; g1-grok-bot-facts.md § Q3. Runtime and tools)
- **What Heavy buys.** An individual SuperGrok Heavy subscription must be permanently linked to the Cursor account.
  It grants "highest linked usage" to the Cursor-side Bot meter, with a weekly reset; on-demand spend can continue after the included pool if enabled. No official page publishes the numeric weekly quota, token pool, hours, or a separate Bot spend cap. (g1-grok-bot-facts.md § SuperGrok Heavy inclusion, bot counts, usage)
- **Eligibility sources conflict.** The older xAI get-started page omits SuperGrok and Cursor Pro.
  Trust the newer August 26 announcement and Cursor plan matrix unless the logged-in link flow disproves them. (g1-grok-bot-facts.md § SuperGrok Heavy inclusion, bot counts, usage)
- **Meter ambiguity.** The lanes infer one Cursor-side Bot bucket sized by the better linked grant when Cursor and SuperGrok benefits overlap.
  That conclusion is **medium confidence** because Cursor's plans page and the Bot FAQ describe the relationship differently. (g1-grok-bot-facts.md § SuperGrok Heavy inclusion, bot counts, usage)
- **Price ambiguity.** Official HTML listed SuperGrok at $30/month and Plus at $100/month but did not publish Heavy's price.
  The often-repeated $300/month number is **low-confidence, third-party information** and should not enter a budget model until Benjamin reads his logged-in billing page. (g1-grok-bot-facts.md § SuperGrok Heavy inclusion, bot counts, usage)
- **Triggers.** A Bot routine can run on a UI/NL schedule with a confirmed timezone, on supported Cursor integration events such as Slack messages or GitHub notifications, by manual/Test run, or through Bot-to-Bot/group work.
  Generic webhooks, X mentions/DMs/replies, incoming email, cron syntax, minimum interval, maximum duration, and concurrency limits are not documented as Bot routine triggers. (g1-grok-bot-facts.md § Q2. Triggers and scheduling)
- **Schedule quality.** Staff-confirmed beta reports found scheduled starts delayed 10–37 minutes and some successful runs that posted no chat message.
  This is **medium-confidence observed behavior**, not a published service-level guarantee or catch-up contract. (g1-grok-bot-facts.md § Observed schedule semantics)
- **Core tools.** The hosted computer has a browser, filesystem, and terminal.
  Marketplace Plugins are remote MCP integrations; OAuth tokens remain on Cursor's connector backend. The Bot can also delegate to Cursor Cloud Agents when that capability is enabled. (g1-grok-bot-facts.md § Hosted sandbox; g1-grok-bot-facts.md § MCP: remote-only from the Bot's point of view)
- **Approvals are not containment.** Auto Review independently evaluates shell, plugin, computer-use,
  routine, and Cloud Agent actions; Require Approval rules beat allow rules. It does not review
  every side effect, and xAI says the controls reduce rather than eliminate prompt-injection risk.
  (g1-grok-bot-facts.md § Approvals / Auto Review)
- **Toolchain caveat.** `git`, `bun`, Node, and tests may work in the VM, but the published image, CPU/RAM, and installed versions are unspecified.
  Manually installed packages are not durable. Treat hosted repo execution as **medium-confidence and replaceable**, not canonical local proof. (g1-grok-bot-facts.md § Shell / git / bun / tests)
- **Local access is a different feature.** Grok Bot Desktop can ask to execute on the local computer.
  That is not the Grok CLI WebSocket relay, and there is no documented way for a hosted Bot to attach to `grok agent headless --grok-ws-url` as its runtime. (g1-grok-bot-facts.md § Q6. Hosted bot vs local machine)
- **What it cannot be.** There is no on-prem/BYO-image Bot, no customer-hosted VM, no model picker, and no guaranteed fixed model vendor set.
  Cursor chooses the serving model; usage analytics show what actually ran. (g1-grok-bot-facts.md § Hosted sandbox; g1-grok-bot-facts.md § How bots are created and configured)
- **Published limits.** One account may have 50 Bots and group chats combined.
  Each Bot may have 50 routines; each routine retains only its 20 latest run records. Teach-a-task recordings last at most 10 minutes, group chats contain 2–6 Bots, and each Bot screen runs one computer-use task at a time. (g1-grok-bot-facts.md § Hard published limits)
- **X truth.** The Bot's X marketplace plugin and August 29 connector use X's hosted MCP/API path, not xAI Responses API `x_search`.
  The plugin claims read/search/trends/bookmarks, but not posting or DMs, and forum evidence says it lacks recent-search mapping. The recorded `client-not-enrolled` error means the X app authenticated but is not enrolled for the endpoint; X says to put the app in a Project, Pay-per-use, and Production. (g1-grok-bot-facts.md § Q4. X search from a bot and from the API)
- **X uncertainty.** Paid Bot users receive some introductory X API credits, but the amount and whether they cover `search_posts_all` are unpublished.
  Full-archive auth behavior is **medium-confidence**. The first-party connector may or may not avoid Benjamin's existing app enrollment failure. (g1-grok-bot-facts.md § Grok Bot "X connector" announced 2026-08-29; g1-grok-bot-facts.md § Open unknowns)
- **GitHub truth.** The GitHub plugin is a Cursor-hosted remote MCP using OAuth.
  GitHub notification events are a separate connection. A Bot may also use `git`/`gh` in its VM or delegate to a Cursor Cloud Agent through the Cursor GitHub App. `needsAuth` means plugin OAuth did not complete; no Bot document describes a PAT field. (g1-grok-bot-facts.md § Q5. GitHub integration)
- **GitHub limits.** "Deliver as PR" is not a first-class Bot output. PRs require the plugin, VM tools, or a Cloud Agent. The observed `PAYLOAD_B64` gzip EOF is consistent with transport truncation, but no published Bot or Cloud Agent handoff-size limit confirms the cause. (g1-grok-bot-facts.md § What is not documented; g1-grok-bot-facts.md § Recommended land-in-repo patterns)
- **Configuration location.** Profiles, routines, skills, plugins, and approval rules live in Cursor's account/UI; durable files may live in `/workspace`. There is no public Bot-as-code API, YAML format, or automatic `AGENTS.md`/GitHub loader. (g1-grok-bot-facts.md § How bots are created and configured; g1-grok-bot-facts.md § Where configuration lives)
- **Can config live in-repo?** Yes only as beep-effect's desired-state convention: a committed `manifest.json` and `BOT.md`, plus a short hosted loader pasted by a human and receipts proving the commit and digests read. This is C2's design proposal, **not an existing Grok Bot capability**. (codex-c2-botpack-design.md § A3. The hosted loader contract)

## B. Verdict on the three seed ideas

### Documentation enhancement: go, in one-package batches

The queue is real: 58 packages need JSDoc remediation, with 347 open modules, 99 open exports,
4 missing export examples, 12 undescribed `@see` links, and 427 multiple-description-paragraph findings. Five real workspaces lack a README, and 14 READMEs are older than 90 days despite later package changes. The current ratchet has zero growth, so the opportunity is inherited quality, not another regression detector. (codex-c1-automation-audit.md § B1. Documentation enhancement bot)

The Bot should select one package or concept, then a local proxy lane should draft against live barrels, tests, and call sites. Existing `jsdoc-inventory`, `jsdoc-ratchet`, docgen/doctest, `package-verify`, and Yeet remain the gates. It must not regenerate the inventory, add a second coverage bot, or spray generic prose. Mintlify's useful pattern is build/CLI before a PR and `automerge: false`; CodeRabbit's false positives and Crossplane disabling docstring generation show why coverage-style doc bots are the wrong shape. (g3-prior-art.md § C1.1 Mintlify Agent + Automations; g3-prior-art.md § C1.2 CodeRabbit)

### Documentation and knowledge staleness: go, as a hybrid detector/judge

The repo counts 29,335 references, including 2,446 broken targets that are currently non-live or otherwise non-gated, plus 491 unchanged semantic findings and zero introduced findings. Age and broken syntax alone are not bugs. The Bot's job is to identify the owner and consumer, prove a live contradiction, and assign `repair`, `exception`, `owner-needed`, `park`, or `no-action`. (codex-c1-automation-audit.md § B2. Knowledge and documentation staleness bot)

GitHub Actions and existing `knowledge refs`, `semantic-delta`, roadmap refs, goal doctor, and exploration checks should produce the bounded candidate bundle; hosted Grok may judge external or semantic drift; a local lane confirms hard cases. Deterministic symbol checks found outdated references in more than 25% of 1,000 popular projects, while CASCADE reported only after a two-sided execution gate and saw 10 of 13 new findings fixed. That is the precision bar. (g3-prior-art.md § C2.1 Tan, Wagner, Treude; g3-prior-art.md § C2.4 CASCADE)

### "Beep style & law enhancer": reshape into law non-vacuity and exception review

Drop the generic style rewriter. Four strict Effect scanners and package test imports are clean; there is one terse-Effect candidate. The useful backlog is different: 221 tooling-schema-first findings, 92 reviewed schema exceptions, 2 unused law allowlist rows, 66 test-typecheck blindspots,
385 Fallow health findings, and a possible 87-carrier scope gap. These are not one safe rewrite queue. (codex-c1-automation-audit.md § B3. Beep style & law enhancer)

The reshaped bot maps each written law to its scanner, glob, CI/Yeet invocation, tests, and exceptions. It reports vacuous checks, scope holes, contradictory laws, or stale rationales. A local disposable lane proves one controlled violation before any narrow PR. Existing laws, Biome, Greptile, schema inventory, Fallow, Knip, and Yeet remain authoritative. G3 found that one verifier contradicted its own diff in about 31% of 71,677 PRs and measured precision 0.23; other teams disabled noisy reviewers. Repeated valid nits should graduate to an AST/Biome/Vale rule, not another permanent LLM comment stream. (g3-prior-art.md § C3.1 CodeRabbit; g3-prior-art.md § C3.6 Practitioner noise reports)

## C. Ranked portfolio of automations

### Ranking method and overrides

C1's score is the base: `3×value + 2×frequency + 2×evidence + 2×grok_fit − risk`, with each factor scored 1–5. The order below preserves C1's first eight. It then lifts the existing QA auditor and coverage planner into the final two places. The C1 review-thread assistant is removed because Yeet already owns exact-head closure; the docgen fixer is folded into documentation; the dependency digest is folded into the Effect watch. This favors independent outcomes over duplicate controllers. (codex-c1-automation-audit.md § C. Broader candidate catalog; codex-c2-botpack-design.md § C4. Recommendation per candidate bot)

Every v1 pack shares this default kill envelope: one retry for an idempotency key; no delivery when an open issue/PR already owns the key; pause after 3 consecutive failed or partial runs; stop on any declared time/tool/byte budget; emit a receipt on success, no-op, partial, or failure. The numeric per-run budgets must be set only after Benjamin reads the unpublished Heavy meter. (codex-c2-grill-agenda.md § 9. What trigger, dedupe, and backpressure semantics are mandatory?; codex-c2-grill-agenda.md § 10. What budget exhaustion and repeated failure do?)

### 1. Knowledge and staleness disposition, C1 score 43

Purpose: turn inherited allowed knowledge debt into a small set of proven live contradictions, instead of treating all 2,446 broken targets as bugs. Trigger twice weekly and on merges that touch an ownership surface. Runtime: Actions census → hosted semantic judge → local confirmation. Inputs wrap `beep knowledge refs --check`, `knowledge semantic-delta`, `lint roadmap-refs`, `goals doctor`, `explore --check`, git history, public barrels, and command help. Output is one deduped report/issue; only a human-admitted local lane may publish a narrow Yeet PR, never merge. The binding AGENTS.md laws are PR-only main, no hand-edited projections, no automatic research admission, no `docs/_internal`, and immediate sanitized friction receipts. Evidence must name the owner, consumer, authoritative source, code/doc commits, before/after classification, and checks. Kill on stale/missing authority, an existing delivery, budget, or 3 bad runs. Consume the 491 unchanged semantic findings and 14 stale-and-changed READMEs first. Strongest prior art: CASCADE's two-sided gate and 10/13 fixed findings. (codex-c1-candidates.jsonl § rank 1; g3-prior-art.md § C2.4 CASCADE)

### 2. One-package documentation enhancement, C1 score 41

Purpose: improve one user-facing concept at a time with a public-surface example that compiles. Trigger weekly or when public exports change without narrative docs. Runtime: hosted selector, then local Sol/proxy author and verifier. Inputs wrap the JSDoc inventory and ratchet, `docgen:local`/doctest, public barrels, tests, call sites, and `quality package-verify`. Output is a report first, then at most one draft PR through Yeet after admission; never merge. AGENTS.md binds the JSDoc format, live-source reuse search, package test aliases, generated-file discipline, and package verification. Evidence includes selected rows, supporting behavior, compiled example, ratchet delta, package proof, and exact-head Yeet receipt. Kill on an internal import, invented behavior, failed docgen, duplicate package PR, budget, or 3 bad runs. Start with the 4 missing examples and 12 undescribed `@see` links, then one of 58 packages. Strongest prior art: Mintlify's CLI-gated, non-automerge docs PR. (codex-c1-candidates.jsonl § rank 2; g3-prior-art.md § C1.1 Mintlify Agent + Automations)

### 3. Research suggested-action reconciliation, C1 score 41

Purpose: answer what happened to each immutable nightly suggestion without treating a suggestion as admission. Trigger after each packet and weekly. Runtime: deterministic ledger projection plus hosted semantic matching; no repo-writing model is required. Inputs are `RUN.json`, `SUGGESTED_ACTIONS.md`, `research/ledger/WATCHLIST.md`, later commits, captures, goals, and explorations. Output is one single-writer disposition report/ledger and an optional deduped issue; never mutate a merged packet or auto-open a goal. AGENTS.md's research immutability, human admission, generated projection, and friction-receipt laws bind it. Evidence pairs every source suggestion with a commit/capture/watchlist row or explicit no-match result. Kill on ambiguous identity, missing immutable source, duplicate key, budget, or 3 bad runs. Consume the 101 undispositioned actions across 5 partial packets and 23 watchlist rows. Strongest prior art: daily_arxiv_digest's durable IDs, raw scores, and skip-already-generated dates. (codex-c1-candidates.jsonl
§ rank 3; g3-prior-art.md § C9.4 yang3kc/daily_arxiv_digest)

### 4. Law non-vacuity and exception review, C1 score 40

Purpose: prove that a written law has a live scanner, correct scope, CI invocation, tests, and a defensible exception set. Trigger weekly and when AGENTS.md, patterns, scanners, allowlists, or baseline policy change. Runtime: hosted read-only comparison plus local disposable mutation probe; source edits use schema-first/effect-first specialist lanes. Inputs wrap `beep laws`, relevant `beep lint` checks, scanner source/tests, schema inventory, Fallow, Knip, and Yeet. Output is a law-health report and at most one admitted draft PR; never weaken a gate or merge. AGENTS.md binds schema-first design, live Effect reference use, reuse discovery, package verification, and PR-only publication. Evidence includes a law-to-scanner matrix, one controlled failing mutation, FP sample, counts, tests, and package proof. Kill if the probe cannot falsify the scanner, a law owner already has a PR, budget expires, or 3 runs fail. Begin with 2 unused allowlist entries and the possible
87-carrier scope gap, not the 221-row mass rename. Strongest prior art: CodeRabbit's NL-to-ast-grep graduation path, tempered by measured reviewer noise. (codex-c1-candidates.jsonl § rank 4; g3-prior-art.md § C3.1 CodeRabbit; g3-prior-art.md § C3.6 Practitioner noise reports)

### 5. Goals and explorations portfolio doctor, C1 score 39

Purpose: turn age and zero-phase signals into evidence-backed `advance`, `park`, `close`, `split`, or `no-action` proposals. Trigger weekly and before roadmap planning. Runtime: GitHub Actions for the manifest census; invoke hosted judgment only for ambiguous candidates. Inputs wrap `goals doctor`, goal/exploration manifests, INDEX/ATLAS, ROADMAP, PLAN/README, and git history. Output is one rolling report/issue; lifecycle edits occur only after Benjamin accepts a disposition. AGENTS.md binds human packet admission, same-PR lifecycle/reflection closeout, and no hand-edited projections. Evidence includes last substantive commit, phase completion, successor/overlap search, and clean doctor/Atlas checks. Kill on age-only reasoning, existing owner action, duplicate key, budget, or
3 bad runs. Start with 14 active goals that are both older than 28 days and have zero completed phases, then the one active exploration with an empty frontier. Strongest prior art: GitHub's label-gated triage with rationale/confidence rather than automatic closure. (codex-c1-candidates.jsonl
§ rank 5; g3-prior-art.md § C6.5 GitHub native AI triage)

### 6. Effect v4 upstream impact watch, C1 score 38

Purpose: detect a real upstream Effect change, map it to live beep-effect usages, and report impact without trusting beta SemVer or model memory. Trigger on verified releases/reference advances, with a daily no-op poll. Runtime: hosted GitHub/web discovery → local `.repos/effect` and repo verification; Actions may seed release events. Inputs are upstream commits/migrations, the Effect catalog/lockfile, live `packages/**/src` and barrel searches, current laws, and relevant checks. Output is a deduped report/issue in v1; a migration PR is a later human-admitted local Yeet run. AGENTS.md binds verification against `.repos/effect`, schema/effect-first routing, source reuse, package proof, scheduler backpressure, and never merge. Evidence names upstream old/new symbols, exact commits, live usage counts, affected packages, gates, and pack digests. Kill on an unpublished version, absent local confirmation, duplicate upstream digest, budget, or 3 bad runs. First consume the current rc.112-versus-reference/watchlist delta. Strongest prior art: Google's symbol-seeded, sharded, build/test/AST-checked migrations. (codex-c1-candidates.jsonl § rank 6; g3-prior-art.md § C5.4 Google internal LLM migrations)

### 7. CI flake, hang, and lane-economics triage, C1 score 38

Purpose: classify bounded failed-run evidence before anyone reruns or edits code. Trigger on a failed/timed-out Actions run plus a weekly p95 digest. Runtime: Actions capture and classify; hosted Grok clusters; an active local Yeet lane handles an admitted fix. Inputs are run/attempt IDs, step timings, bounded redacted logs, known fingerprints, and the watchdog/economics packets. Output is a failure-capsule enrichment, issue, or one narrow instrumentation PR; never an unlimited rerun loop. AGENTS.md binds failure attribution, no blind reruns, scheduler-holder backpressure, secret-safe logs, Yeet authority, and no merge. Evidence includes exact step, matching cluster, introduced/inherited/unrelated/environment attribution, and authorized rerun outcome. Kill on unbounded or secret-bearing logs, no stable run ID, duplicate failure key, budget, or 3 failures. Consume the paused watchdog's known hang class and remaining economics phase first. Strongest prior art: mature flake detectors require about 10 comparable runs, while Sweep shows CI-log repair is necessary but insufficient. (codex-c1-candidates.jsonl § rank 7; g3-prior-art.md § C4.3 Flaky-test detection; g3-prior-art.md § C6.2 Sweep)

### 8. Package test-typecheck blindspot burn-down, C1 score 36

Purpose: remove inherited test compiler blindspots in monotonic, low-coupling batches. Trigger weekly only while the baseline is non-empty. Runtime: local/GitHub Actions for selection and proof; hosted judgment only to classify fixture exceptions and batch risk. Inputs wrap `lint package-test-typecheck`, the baseline, workspace tsconfig references, and package test trees. Output is one small draft PR or an evidence-backed exception report. AGENTS.md binds `@beep/*` test imports, no blind baseline growth, package verification, and PR-only Yeet publication. Evidence includes rows removed, tsconfig diff, targeted test typecheck, package proof, and zero introduced findings. Kill on a graph-wide compiler blast, duplicate package PR, irreducible fixture without rationale, budget, or 3 bad runs. Consume 65 missing test tsconfigs before the 1 unwired case, grouped by low dependency coupling. Strongest prior art: Google's small migration shards, build/test loop, and ban on extra edits. (codex-c1-candidates.jsonl § rank 8; g3-prior-art.md § C5.4 Google internal LLM migrations)

### 9. Recorded QA evidence auditor and scenario proposer, C1 score 34

Purpose: challenge whether existing motion/gesture evidence covers the claimed behavior, then propose the next bounded adversarial scenario. Trigger after each `beep qa` extraction/judge pack and weekly for scenario refresh. Runtime: hosted visual judgment over sanitized artifacts; local QA tooling captures and validates; any fix stays in the browser-qa-loop. Inputs wrap `beep qa` artifacts, inventory schema, motion evidence, and the two QA goal contexts. Output is a judge report or scenario list, not invented screenshots; a repair PR requires recorded before/after evidence. AGENTS.md binds portless dev servers, recorded browser QA for gesture UI, schema-validated inventory, package/app proof, and no merge. Kill on missing artifact IDs, unverifiable visual claims, duplicate scenario key, budget, or 3 bad runs. Consume gaps in the existing professional-desktop bot rather than creating a second QA controller. Strongest prior art: Benny's two-reproduction and before/after evidence gate, reinforced by xAI's official staging-only repro use case. (codex-c1-candidates.jsonl
§ rank 10; g3-prior-art.md § C6.3 pstack Benny; g2-use-cases-and-practices.md § Q1a)

### 10. Coverage and test-gap prioritization, C1 score 32

Purpose: choose missing behavior worth testing, not lines worth gaming. Trigger after a coverage baseline refresh or package change. Runtime: Actions/local coverage and mutation facts → local Sol planner/author after admission; hosted Grok is optional for prioritization. Inputs are coverage follow-ups, package source/tests, schemas, boundaries, and `quality package-verify`. Output is a ranked plan first and then one bounded test-only draft PR. AGENTS.md binds schema-first generators, `@beep/*` test imports, package verification, no full graph during selection, and PR-only main. Evidence requires a red-before behavior or non-equivalent mutant, real assertion, 5 clean runs, coverage or mutant-kill delta, and package proof. Kill vacuous assertions, comment-only mutants, flakes, duplicate target PRs, budget, or 3 bad runs. Begin with the 30 packages below a minimum, using the 40 recorded follow-ups and 21,498 uncovered lines as selectors only. Strongest prior art: Meta TestGen-LLM kept tests only after build, 5-run reliability, and coverage increase; ACH uses mutant-kill evidence. (codex-c1-candidates.jsonl § rank 13; g3-prior-art.md § C7.1 Meta TestGen-LLM; g3-prior-art.md § C7.2 Meta ACH)

### Later

- **Docgen example fixer:** run only on a non-empty doctest delta; it is an implementation mode of item 2, not a separate routine. Current queue: 4 missing examples and 1 import finding. (codex-c1-candidates.jsonl § rank 11)
- **Effect-aware dependency digest:** fold Effect changes into item 6. Add other dependencies only after live-usage grounding proves a generic digest is read. (codex-c1-candidates.jsonl § rank 12)
- **Fallow health selector:** 385 findings across 157 files justify a bounded pilot, but refactor choice needs modularization/reuse analysis and local proof. (codex-c1-candidates.jsonl § rank 14)
- **Codex security packet triage:** high value after a human exports the signed-in CSV; canonical `beep codex findings ingest` must build the packet before model triage. (codex-c1-candidates.jsonl
  § rank 15)
- **Skill A/B evaluator and reflection miner:** wait for the blinded harness. Never let one reflection rewrite always-loaded instructions. (codex-c1-candidates.jsonl § ranks 16 and 22)
- **Schema-exception revalidation:** monthly manual batches only; all 92 rows are reviewed exceptions and current inventory drift is zero. (codex-c1-candidates.jsonl § rank 17)
- **Friction-ledger rollup:** useful after a deterministic collector normalizes packet-local ledgers; it cannot replace recording friction when it occurs. (codex-c1-candidates.jsonl § rank 18)
- **Issue reproduce-and-fix:** retain as a later, local, triage-gated extension of the QA bot. It needs two reproductions, existing-owner checks, and draft-only output. (g3-prior-art.md § C6.3)

### Rejected with reason

- **Full PR babysitter/autopilot:** reject as a new bot. Yeet already owns exact-head checks, review threads, replies, known-flake policy, and merge-ready truth; a second controller creates split brain. (codex-c1-candidates.jsonl § rank 23)
- **Generic style reviewer or second JSDoc coverage bot:** reject. Existing Greptile/laws own the surface, public evidence shows mute-inducing noise, and the repo already has a JSDoc ratchet. (g3-prior-art.md § C1.2 CodeRabbit; g3-prior-art.md § C3.6 Practitioner noise reports)
- **Standing deprecation or dead-code sweep:** reject until a deterministic delta is non-zero. Deprecated API, Fallow dead-code, and Knip counts are currently zero. (codex-c1-candidates.jsonl
  § ranks 21 and 24)
- **Memory-file consolidation repo bot:** reject. Memory is agent-owned file state; no shared memory service exists, and edits need explicit owner authorization. (codex-c1-candidates.jsonl
  § rank 25)
- **"Six hours, build whatever" overnight bot:** reject for v1. It consumes quota without a falsifiable outcome and recreates the hung-job/duplicate-PR failure class. (g2-use-cases-and-practices.md
  § Idea shortlist for Benjamin, item 14; g3-prior-art.md § C6.4 Devin)
- **X posting/DM bot:** reject. Grok Bot documents X read/search capabilities, not posting or DMs. (g1-grok-bot-facts.md § Grok Bot "X connector" announced 2026-08-29)

## D. First bot, and the sequence

Agree with C2: build `effect-v4-upstream-watch` first even though it ranks sixth by C1's backlog-weighted score. Deployment order answers "what cheaply proves the convention?", while the portfolio rank answers "where is the largest recurring value?" Upstream watch has bounded official inputs, can no-op, and starts report-only. It exercises the hosted schedule, exact pack/digests, hashed handoff, local `.repos/effect` verification, dedupe, fallback arbitration, and receipts without a write credential. (codex-c2-botpack-design.md § C5. First bot and staged rollout)

1. **Effect v4 upstream watch.** Proves one pack, one report, two fixtures, one idempotency key
   across hosted/local lanes, and rejection of truncated or capability-incomplete handoffs.
2. **Research-action reconciliation.** Proves the convention can consume immutable repo truth,
   maintain durable dispositions, and stay silent on duplicates without any external search.
3. **Knowledge/staleness disposition.** Proves semantic precision over a large inherited backlog,
   including `no-action`, without turning age or broken archival references into churn.
4. **One-package documentation enhancement.** Proves earned write authority: human admission,
   local authoring, executable docs, package verification, Yeet publication, and no merge.

Only after those four should law mutation probes, CI event handling, or issue reproduction enter production. Each adds a wider permission or harder evidence class. (codex-c2-botpack-design.md § C4. Recommendation per candidate bot; codex-c2-botpack-design.md § C5. First bot)

## E. Nightly research routine

Amend the existing SPEC. Do not rebuild the productive hosted front half, and do not keep claiming the unimplemented local topology. Five partial hosted runs produced 106 claims and 101 suggested actions, but the live CLI has no `beep research nightly` command and PLAN has only P0 complete. The honest target is hosted search/writer plus a structured hybrid verifier/publisher. (codex-c1-automation-audit.md § D. Nightly research routine)

| Recorded friction | Concrete repair | Grill dependency |
| --- | --- | --- |
| X `client-not-enrolled` | In `console.x.com`, verify Project + Pay-per-use + Production and distinguish the August 29 connector from plugin 49086599. Until it passes, record X as a typed partial and optionally route a bounded record set to local/proxy `x_search`; never claim complete X coverage. | GRILL Q7–Q8 |
| No Sol/Luna verify seat | Send only structured candidate claims to a blinded local `claudeg`/`claudex` verifier. Preserve `partial` when that stage is unavailable. | GRILL Q5 and Q7 |
| GitHub MCP `needsAuth` | Make hosted GitHub write optional. A dedicated local publisher preflights `gh` under least-privileged 1Password injection, writes only allowlisted packet files, and runs Yeet. | GRILL Q3, Q6, and Q8 |
| Publisher payload truncation | Replace prompt-embedded gzip/base64 with an envelope plus bounded, independently hashed JSON/JSONL parts, count/size/digest checks, and a completion marker. Reject partial recovery. | GRILL Q6 |
| Silent or late hosted run | Always emit a chat and durable receipt, allow 40 minutes of schedule jitter, and arbitrate morning local catch-up with the same idempotency key. | GRILL Q9–Q10 |
| 101 actions lack disposition | Add an append-only/single-writer disposition ledger outside immutable packets. Human admission remains the only path into goals or exploration intake. | GRILL Q7 |

The SPEC amendment should replace its local-only search/writer claim with the observed hosted topology, retain blinded verification as a required later stage, define source capabilities as independent, and choose either to implement `beep research nightly` or remove the promised CLI. (codex-c1-summary.md § Research routine; codex-c2-botpack-design.md § C3. Hybrid handoff that fixes the nightly routine)

## F. beep-mode relation

Bot automation is a sibling exploration and later goal, not beep-mode P4. It is bound by the beep-mode decisions **vendor shape** (Benny itself stayed out), **model-role routing surface** (roles are deployment choices), **agents** (do not pretend hosted roles exist), **autonomy contract** (gate design, never merge), **stickiness outside Cursor** (do not enlarge the global prompt), **eval before promotion**, and **graduation shape** (P1–P3 are already closed). The sibling may reuse Benny's evidence rules without reversing the decision to drop its Cursor automation files. (explorations/beep-mode/DECISIONS.md § 2026-08-29 — vendor shape; § model-role routing surface;
§ agents; § autonomy contract; § stickiness outside Cursor; § eval before promotion; § graduation shape; codex-c2-botpack-design.md § B3. beep-mode decisions bot packs must respect)

## G. Open unknowns Benjamin must check himself

1. **Weekly Heavy allowance and spill state.** Open Grok Bot **Settings → Usage and billing** and
   `https://cursor.com/dashboard/usage`. Record pool size/unit, used, remaining, reset timestamp,
   per-Bot visibility, and whether on-demand is enabled. (g1-grok-bot-facts.md § Open unknowns)
2. **Actual Heavy charge.** Open logged-in `https://grok.com/supergrok` or Grok **Settings →
   Billing**. Record monthly/annual price, renewal date, and whether the current charge is annual.
   (g1-grok-bot-facts.md § Open unknowns)
3. **X connector identity.** In Grok Bot **Settings → Plugins**, inspect the installed X entry and
   plugin 49086599. Record which account/app it uses, exact tool names, whether `search_posts_all`
   works, and whether any recent-search tool exists. (g1-grok-bot-facts.md § Open unknowns)
4. **X enrollment and introductory credits.** In `https://console.x.com`, open the app's Project,
   Products/Environment, and Billing/Credits pages. Record Project membership, Pay-per-use,
   Production, remaining intro credits, and the debit from one controlled search.
   (g1-grok-bot-facts.md § Open unknowns)
5. **GitHub Bot tool surface.** In Grok Bot **Settings → Plugins → GitHub**, complete OAuth once,
   then record the exposed tools and confirm read-only repo/code search, Actions `get_job_logs`,
   issue/comment, and `create_pull_request` separately. (g1-grok-bot-facts.md § Open unknowns)
6. **Routine scheduler semantics.** In a test routine's editor/history, record minimum interval,
   timezone, next run, maximum duration if shown, concurrent-run behavior, missed-run/catch-up
   behavior, and whether an explicit no-op receipt appears. (g1-grok-bot-facts.md § Open unknowns)
7. **Hosted VM prerequisites.** Open the Agent Computer terminal and record `git`, `bun`, `node`,
   and `gh` presence/versions plus available durable disk. Do not treat this as authority to make
   hosted execution canonical. (g1-grok-bot-facts.md § Open unknowns)
8. **Cloud Agent availability and payload ceiling.** In Cursor's Bot/admin settings and Cloud
   Agent run logs, record whether Bot-spawn is enabled, which GitHub App/repositories it can use,
   its initial spend-limit control, and the largest documented/tested file or prompt handoff.
   (g1-grok-bot-facts.md § Open unknowns)
9. **Actual serving model.** After one controlled routine, inspect Cursor usage analytics and
   record the served model and Bot charge. This can reveal actual routing but does not create a
   guaranteed model pin. (g1-grok-bot-facts.md § Model selection; § Open unknowns)

## H. Risks and anti-patterns

1. **A Bot proposes; a human admits.** Reports, one deduped issue, or a local Yeet draft PR are
   allowed. Merge, deploy, delete, spend, permissions, external messages, and packet admission are
   not. Map this to AGENTS.md's PR-only main, Yeet closeout, and research human-admission laws.
   (g3-prior-art.md § Cross-cutting lessons 1)
2. **Put deterministic gates on both sides of judgment.** Census/scanner before the model; the
   same scanner, compile, tests, or package verify after a patch. Existing ratchets own pass/fail.
   (g3-prior-art.md § Cross-cutting lessons 2 and 10)
3. **Require two-sided evidence before saying code, docs, or a user report is wrong.** Use
   CASCADE's test/reference pair or Benny's two reproductions and before/after proof. The current
   gap is a shared bot evidence schema. (g3-prior-art.md § Cross-cutting lessons 3 and 4)
4. **Derive a stable idempotency key before any write.** Search open issues, PRs, commits, and
   prior receipts; follow the same worker instead of spawning another. Map this to Yeet's exact-head
   fence; add a bot-pack no-open-delivery gate. (g2-use-cases-and-practices.md § Duplicate PR
   floods / competing changes)
5. **Narrow triggers and cap runs.** No "every notification" listeners or 5-minute P0 loops. One
   retry/key, 3 bad runs then pause, explicit time/tool/byte ceilings, and on-demand off until the
   meter is known. The gap is a numeric budget read from the UI. (g2-use-cases-and-practices.md §
   Runaway-cost controls; § Cost blowups)
6. **Never combine all three sides of the Rule of Two.** A routine reading untrusted web/X/issues
   must not also hold secrets and state-changing tools. Require Approval wins; external text is
   data, not instructions. The gap is a bot-pack threat model and safe-output decoder.
   (g2-use-cases-and-practices.md § Bots acting on injected instructions)
7. **Bot names are not security boundaries.** All Bots share one VM. Keep local publisher and
   1Password authority off it; use provider OAuth and human takeover, never pasted credentials.
   Map this to AGENTS.md's 1Password rules and secret-reference-only local execution.
   (g2-use-cases-and-practices.md § Secret handling)
8. **A green or silent run is not proof.** Always persist source links, action log, pack/runtime
   digests, gates, result, and next human action; retain outside the 20-run UI window. The gap is
   the proposed `BotEvidenceContract` and durable receipt store. (g2-use-cases-and-practices.md §
   Silent stops / false-green; codex-c2-botpack-design.md § A9. Validation, provenance, and receipts)
9. **Promote repeated valid nits into structure.** After repeated evidence, add a laws/Biome/
   ast-grep/Vale rule and stop paying an LLM to repeat it. Map this to existing ratchets and the
   AGENTS.md reuse/law mechanisms. (g3-prior-art.md § Cross-cutting lesson 5)
10. **Default instruction and packet maintenance to no-op.** Wrong skills are worse than missing ones. Require
    with/without and trigger A/B evidence, surgical diffs, human review, and no large deletion.
    Never rewrite merged packets or reconstruct friction after the fact. Map this to beep-mode's
    eval-before-promotion decision, agent-effectiveness tooling, and AGENTS.md's immutable-packet
    and immediate-friction laws. (g3-prior-art.md § Cross-cutting lessons 6 and 7;
    codex-c1-candidates.jsonl § ranks 3 and 18)
