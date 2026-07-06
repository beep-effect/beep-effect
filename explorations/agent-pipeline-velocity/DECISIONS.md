# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-07-05 — pr-topology

**Question:** One mega-PR (as requested) vs stacked PRs, and how much /crispen ultra refactoring rides along?

**Answer:** Single PR; crispen is **constrained** — only refactors that directly unblock an identified optimization land; pure-cleanup findings go to a debt ledger for a later pass.

**Rationale:** Merge-time data shows PR size, not gate count, drives wait (17s for tiny PRs; 19.5h for a +153k-line PR). Full crispen-ultra of 8.3k-LOC Yeet internals would balloon the diff and the conflict window against 6 parallel checkouts. Rejected: full crispen in-PR; 2 stacked PRs (user wants one merge event).

## 2026-07-05 — main-green scope

**Question:** Is getting main green (and protecting it) in scope?

**Answer:** Main green is an **early stage-2 task**; branch protection is **out of scope** this goal.

**Rationale:** Red main poisons every measurement and every branch cut from it (failures are inherited). Protection deferred: while iterating fast solo, gates-before-speed would add friction prematurely. Rejected: green+protect now; out-of-scope entirely.

## 2026-07-05 — review-bot lineup

**Question:** Consolidate the closeout review bots (greptile + coderabbit + chatgpt)?

**Answer:** Keep **greptile** as the only always-on reviewer; drop coderabbit + chatgpt gates. Deep review on-demand (/code-review ultra, codex review). Deactivate the dropped bots **early via Claude-in-Chrome** (user request).

**Rationale:** Three bots ≈ triple thread-resolution churn per PR with heavy overlap; greptile has the scored gate yeet already parses (Closeout.ts). Rejected: keep 2; keep all with looser gates; out of scope.

## 2026-07-05 — goal-ledger topology

**Question:** How does the new packet relate to 5 overlapping goals (agent-effectiveness-phoenix-enrichment, agent-effectiveness-workflow-integration, yeet-operator-clarity, yeet-pr-closeout-loop, repo-quality-throughput)?

**Answer:** **Absorb & supersede**: the new goal absorbs the two pending-planning agent-effectiveness packets and the residual scope of the two active yeet packets (manifests marked superseded-by). repo-quality-throughput stays completed-reference; new pipeline findings numbered **rqt-011+**.

**Rationale:** User's stated pain is goal sprawl + forgotten execution order; one live thread fixes it. Rejected: absorb agent-eff only; coexist/cross-link.

## 2026-07-05 — worktree migration

**Question:** Migrate ../beep-effect2..7 duplicate clones to the sibling-worktree layout standards/git-worktrees.md already prescribes?

**Answer:** **In scope, tooling-assisted**: build `beep worktree new/remove/doctor` (automates the bootstrap checklist), migrate incrementally as branches merge.

**Rationale:** Duplicate clones are documented drift from the repo's own standard; shared object store kills the sync-tax and the same-branch race class. User initially unfamiliar with worktree flows — resolved after a WebStorm-fit + commands walkthrough. Rejected: manual-only migration; out of scope.

## 2026-07-05 — PR turbo cache policy (CSF-001)

**Question:** Relax CSF-001 (remote cache disabled on PR events) so PR CI lanes stop rebuilding cold on 2–4 vCPU runners?

**Answer:** **Read-only remote cache on PRs** (PR jobs read the push-warmed cache, never write); push events stay read-write.

**Rationale:** Preserves the cache-poisoning defense entirely while eliminating the largest PR-lane latency source. Solo repo: all PRs are the user/their agents. Rejected: full read-write (abandons CSF-001); keep disabled.

## 2026-07-05 — time window & labor split

**Question:** Execution window and who does the work?

**Answer:** Time window is not a constraint (goals historically execute in <8h). **Claude leads/designs/verifies/approves; Codex fleet grinds mechanical lanes.**

**Rationale:** Matches the standing delegation strategy; preserves the remaining Claude subscription window for judgment-heavy work.

## 2026-07-05 — Fable-direct on pipeline optimization

**Question:** (User mandate at plan approval) Who performs the Phase-D yeet/quality/CI optimization analysis?

**Answer:** **Fable itself** (main session or `model: fable` workflow agents) — not Codex, not lower tiers. Codex restricted to mechanical execution of Fable-specified changes.

**Rationale:** Opus 4.8 and Codex have already harvested the incremental wins; none produced redesigns with step-change performance. The remaining gains require redesign-level thinking.

## 2026-07-05 — nested-file surgery scale

**Question:** How much of the audited nested instruction-file surgery (keep 9 / shrink 21 / merge 1 / delete 46 + .hbs template fixes + symlink normalization) rides in this goal's single PR?

**Answer:** **Full surgery** — all verdicts executed, both CreatePackage `.hbs` templates fixed, symlinks normalized (8 copies→links, 5 missing links added, lint-rules CLAUDE-only renamed to AGENTS.md+link).

**Rationale:** ~12k tokens of recovered always-loaded/nested context, almost entirely boilerplate deletion (review-trivial); template fix prevents regrowth. Rejected: deletes-only (defers half the value); worst-offenders-only (defers most of it).

## 2026-07-05 — turborepo skill ownership

**Question:** turborepo skill (GitHub-pinned, 951 lines ≈ 7.1k tokens, over-broad trigger): fork/convert-to-local and cut, keep pinned, or drop?

**Answer:** **Convert to repo-local ownership and cut** to ~1.4k tokens (two load-bearing rules + decision-tree pointers into its existing references/ tree); update skills-lock.json sourceType; keep the anti-patterns catalog one hop away in references/.

**Rationale:** ~5.7k tokens saved on most dev sessions; upstream churn is slow and turbo is pinned at 2.10.3 anyway. Rejected: keep-pinned (zero savings), drop entirely (loses curated anti-patterns).

## 2026-07-05 — crispen ↔ schema-first-development overlap

**Question:** Near-identical trigger surfaces double-fire ~4.2k tokens on schema tasks; how to resolve?

**Answer:** (User's framing, adopted.) **Principle vs operator split**: schema-first-development stays the auto-firing principle skill (laws for writing schema code); crispen becomes a thin operator skill (refactoring stance + lite/full/ultra intensity) that REFERENCES schema-first-development as the law source instead of restating laws. crispen's trigger rewritten to refactor-intent only ("crispen", "reduce helpers", "colocate behavior", helper-wall language) — no auto-fire on authoring-intent. Also fix: crispen added to skills-lock.json (unpinned-drift bug).

**Rationale:** crispen = "do refactoring" mode (user invokes `crispen ultra`); schema-first = "write it this way" principles. Reference-not-restate kills content duplication; trigger split kills double-fire; both identities preserved. Rejected: full merge (loses the invokable mode), explicit-`/crispen`-only (over-narrow — refactor-intent phrases should still catch), leave-as-is.

## 2026-07-05 — SkillOpt scope

**Question:** microsoft/SkillOpt (MIT, 2026-07-02): cite-and-align in this goal, bounded pilot now, or ignore?

**Answer:** **Cite-and-align**: restructured skills adopt SkillOpt-compatible shape (single self-contained SKILL.md cores, 300–2,000-token band); SkillOpt recorded as the named optimizer for a successor goal that builds the scored repo-task eval suite atop the Phoenix loop (the absorbed phoenix-enrichment direction). No dependency or training runs in this PR.

**Rationale:** Pilot's true cost is an honest eval set (hours, new dependency) — outside the single-PR appetite. Alignment now is free and avoids a later re-reorganization. Rejected: pilot-now, ignore.

## 2026-07-05 — deep-research reconciliation (final graduation gate)

**Question:** Does the external deep-research sweep confirm or revise any locked decision?

**Answer:** **Confirms all; revises none.** Five refinements adopted into the goal SPEC/PLAN without reopening decisions: (1) C1 instruction single-sourcing emits terse imperative laws ONLY — no repo-overview prose (measured: >20% cost, no gain); (2) C3 skill restructure adopts Anthropic budget rules — references one level deep, TOC in >100-line reference files, executable scripts over prose, short keyword-led descriptions — layered on the SkillOpt 300–2,000-token band; (3) C4 elevated: PreToolUse/Stop hooks re-surfacing critical laws mid-session (within-session decay is the measured dominant failure) alongside the permissions allowlist; (4) optional C6 trial: official typescript-lsp plugin, verdict recorded either way; (5) B2's CSF-001 amendment cites turbo #1188/#6624 as the verified control lineage. headroom verdict: real and worth a measured pilot AFTER this goal (vendor-ceiling numbers, content-type-dependent).

**Rationale:** 11 adversarially-verified findings (3-0 votes; two companion claims refuted in verification and discarded). Evidence quality: 2 academic preprints + live vendor docs + independent corroboration. No finding contradicts a locked decision; all refinements fit within already-approved scope.

## 2026-07-05 — sequencing gate: PR #291

**Question:** (Mid-ceremony user update) A Codex session in ../beep-effect2 is fixing main-green blockers now (PR #291, codex/yeet-verify-repair). Sequence?

**Answer:** PR #291 merges **before** this goal's code-touching phases begin; Phase B3 (main green) shrinks to verify-and-fill-gaps after that merge. Packet ceremony and external research proceed in parallel (no conflict surface).

**Rationale:** Avoids duplicate fixes and merge conflicts with in-flight work.
