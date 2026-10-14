# P1 FP-eyeball verdicts — recorded 2026-08-06

Benjamin's reviewer verdicts on the three Phase-0 evidence reports, recorded per
execution decision E4 ("the reviewer's verdict is recorded before any dependent
mutation PR starts") and E5 (per-workstream unlock). All three reports were read
after their PRs merged (#555/#561/#563); verdicts were collected in-session.

## Workstream D — `p1-report-manifest-capabilities.md`

**Verdict: approved.** Zero rejections and zero capability-data drops across the
112-manifest live census match expectation; defaulted empty `provides`/`requires`
arrays appearing in normalized encoded output are acceptable as ratified in the
design's decided contract. **Unlocked:** the Workstream D projection slice (P4
chain — bun:sqlite projection, `next`/`explain`, Mermaid INDEX block) may be
designed and built.

## Workstream B — `p1-report-skills-provenance.md`

**Verdict: approved.** The `exact`/`high` shadcn verdict stands, including the
stale-drift reconciliation (the P0 audit's drift claim was disproven by
independent byte-comparison — true negative). Fixture-only coverage of the
drift/patch path is accepted as pilot evidence; no second live probe required.
**Unlocked:** Workstream B mutation work (lock materialization, patch series,
materialize/check, clearing house, hunk ledger — P4; Renovate wiring — P5).

## Workstream C — `p1-report-semantic-delta.md`

**Verdict: approved, with the report's three recommended defaults ratified:**

1. The scanner stays strict; speculative trees go in fences per the ratified
   Stage-1 decoy rule. No speculative-path marker is introduced.
2. `...`-tail command spans are addressed by a documentation fix, not a
   normalizer exception. The v1 normalizer stands.
3. Exploration `RESEARCH.md`/`CAPTURE.md` files remain live corpus.

**Unlocked:** P3 gate wiring — `knowledge:semantic-delta` into
`rootRepoLintPolicySteps` (after `lint:roadmap-refs`, before `goals:doctor`),
introduced-only blocking semantics.

## Workstream A — `p1-report-refs-tree.md` (recorded 2026-08-08)

**Verdict: approved on all four asks; the A rewrite pass (P3) is unlocked.**

1. `broken-target` disposition: the ratified fence-decoy rule remains the only
   speculative-path mechanism. The two known lexical FP shapes (MCP method names
   like `tools/call`, and upstream repo paths spelled as bare `tools/…` /
   `scripts/…`) are accepted as documented false positives to burn down during
   P3 with data in hand; no extension requirement is introduced.
2. `audit-pattern-literal`: the v1 lexical signal set is accepted as-is,
   including its known coarseness on archival research tables (harmless — the
   archival surface never gates). Revisit only if a gate starts consuming the
   class.
3. Convention sets: `~/.openclaw` is admitted to `portable-home-convention` as
   the one deliberate CLI-PR widening (same product-config class as `~/.claude`
   and `~/.codex`); this PR carries that widening. The
   `documented-temp-convention` set stays exactly `/tmp/portless`.
4. `external-mirror-reference` remediation ("replace with canonical GitHub
   URL") stands for mirror-shaped rows; provenance-shaped rows (`~/Downloads/…`)
   ride along until P3 rewrites live surfaces. The 122-row live
   `actionable-host-path` set is confirmed as the P3 mechanical-rewrite
   worklist.

## Probe execution policy (binding, from the #563 review security finding)

**Decision: same-repo only.** The hosted semantic-delta gate lane runs command
probes only on same-repo branches; fork pull requests skip the probe step and
their findings degrade gracefully to non-probe classes. This closes the
fork-PR arbitrary-code-execution vector recorded in the evidence report's
"Review-surfaced constraint" section without adding an OS-sandbox dependency
to CI. Rejected: probes-everywhere-with-bubblewrap (adds the same sandbox
dependency class that broke the openclaw reviewer), and deferring the decision
to a later grill (the constraint is load-bearing for P3 wiring, which is now
unlocked).

## Workstream E — `p1-report-bootstrap-adopt-plan.md` (recorded 2026-10-13)

**Verdict: approved; the Workstream E materializer slice (P4) is unlocked.** Agent-decided
under the 2026-10-06 autonomy charter by an independent reviewer session (the report was
authored by another session); the operator reviews asynchronously. Reverse by recording a
rejection here before any E writer merges.

Re-verified live on 2026-10-13 by re-running
`bun run beep goals adopt knowledge-surface-automation --plan --json` on the current tree:

- **Ownership table: confirmed.** 31 authored files retained (29 at report time; the
  difference is research added since), 2 generated markers retained, 1 preserve, 1
  report, 1 generated create. Authored-file creations remain zero.
- **Preservation set: confirmed complete.** The unmodeled keys are exactly
  `agentLaunchers`, `currentSourceOfTruth`, `researchReports`, `stopConditions`, and
  `verificationCommands`. These are the manifest's top-level keys that `GoalManifest`
  does not model.

Rulings on the two annotated judgement calls:

1. **`research/.gitkeep` beside real files stays `create/generated`.** It is a byte-exact
   copy of the template marker, idempotent, and harmless. Downgrading it to `report`
   would add a classifier special case with no protective value.
2. **`history/reflections/_TEMPLATE.md` is optional.** The template lives in
   `goals/_template`. Conforming packets need not carry a copy, and `beep lint
   reflection-artifacts` validates real reflections, not the template. The adoption
   classifier gets a documented-convention exclusion for it in E's first mutation PR, and
   the adoption plan's `report` row disappears.

## Workstream D projection — `p4-report-goals-projection.md` (recorded 2026-10-14)

**Verdict: approved with corrections.** Independent reviewer: a native Claude subagent
run by the orchestrator session. The full review is kept outside the repo in the
orchestrator's gate records. The corrections are applied to the report in the same PR
as this record.

1. **Fog rows: accepted as true positives (undeclared `provides`).** Two provider
   corrections are applied. Row 2: `practice-kg-mcp` is `completed-retained`, not
   active. Row 3: the provider is `practice-docket-intake` (the category verbs landed in
   #1456), not an M365 driver packet. With all three providers completed,
   `practice-mail-tagging` turns ready once the manifest-only `provides` PR lands; that
   PR must state the expected frontier (44). The `practice/` vs `law-practice/`
   namespace settlement is **NEEDS-EVIDENCE** (the drift is wider than two namespaces)
   and is deferred to its own ruled decision.
2. **Zero engine false positives: accepted.** The census table is corrected to 211
   packets, 51 active, and 7 blocked (`goals/_template` had been counted). **Unlocked:**
   design PR 3 (doctor findings for duplicate declarations, stranded capabilities, and
   reference-provides) and the manifest-only `provides` PR. PR 2 (Mermaid) already
   merged as #1625.
3. **`SqlClient` engine deviation: accepted.** Hosted Node coverage ran
   `goals-graph.test.ts` green on the merged head.

## Workstream B lock plan — `p4-report-skills-lock-plan.md` (recorded 2026-10-14)

**Verdict: ask 1 rejected; asks 2–3 ruled.** Independent reviewer: a native Claude
subagent, with the orchestrator ruling on ask 2.

1. **Drift classification as the B-3 input: REJECTED.** Three of the five files the
   report listed as differing are byte-equal to older upstream path revisions that the
   floating updater pulled on 2026-09-22:
   - portless `SKILL.md`: `vercel-labs/portless@c7f38a6f33`;
   - shadcn `SKILL.md`: `shadcn-ui/ui@6cd3f4c65c` (the seed's own `observedPathRevision`);
   - teach `SKILL.md`: `mattpocock/skills@321658273c`.

   Only oracle's two files (`SKILL.md`, `agents/openai.yaml`) are genuinely local. #1633
   already stops the plan from asserting "local" (`differs-from-upstream-head`).
   **Required before B-3:** classify against the upstream path history and pin each
   skill at the newest revision that makes its tree pristine. The real patch series is
   then oracle's two files. The plan must also record the revision it classified
   against, and include that revision in its digest.
2. **turborepo fork: ruled, keep upstream.** The local fork was overwritten by
   `49b70014b1` (#661, 2026-08-11) and later reduced by `f590617f15` (#1330). It is not
   restored wholesale. The repo-specific rules are salvaged as a targeted follow-up, and
   the old files stay recoverable from git history. The report's "26 installed files"
   claim is superseded by this record.
3. **adhd: queued.** The report alone cannot settle it (NEEDS-EVIDENCE), but the
   reviewer verified the installed file matches `UditAkhourii/adhd@55ed38514c` (a single
   MIT file). Its resolution seed is a bounded follow-up task (about one hour).

## Workstream C knowledge doctor — `p4-report-knowledge-doctor.md` (recorded 2026-10-14)

**Verdict: ask 1 accepted; ask 2 ruled (no `planned` class); ask 3 partial.**
Independent reviewer: an Opus 5.5 subagent run by the orchestrator session, read-only on
`main`. The orchestrator session ruled on ask 2. The full review is kept outside the repo
in the orchestrator's gate records. The fixes land in C Stage-2 PR 2.

1. **Assertion inside inline code: ACCEPTED as a true FP class.** The live corpus had four
   markers, all syntax documentation (one blocking `failed-assertion` in this packet's
   `SPEC.md`, three advisory) and no real assertion. Both readers ran the same unanchored
   pattern over raw prose, so the Stage-1 extractor (refs and semantic delta) is fixed in
   the same PR. A marker now asserts only when it is a whole HTML-comment line outside
   fences: quoted in an inline code span, written mid-line, or behind a quote or list
   prefix, it asserts nothing. This is stricter than the grammar's "an HTML comment
   outside fences"; the reason and reversal are design decision K13.
2. **Planned commands: RULED, no `planned` span class.** The premise failed: 10 of the 16
   spans name commands that existed and were removed (`laws dual-arity` 5, `reuse
   clones` 2, `quality repo-exports-catalog` 2, `graphiti proxy` 1). They are rot and
   belong to the baseline burn-down with candidates 6–7. The 6 `ai-sync` spans (deferred
   V2 plans) and line 45 of `goals/lane-bootstrap/SPEC.md` (`worktree add`, the one genuinely
   planned command) are re-spelled as prose `beep <cmd>`, the #1154 Stage-1 spelling,
   which is not a command span. The packet `SPEC.md` authoring note now records that
   spelling. Reversal: a K-decision adding a `planned` class; nothing depends on its
   absence, so reversing costs one doc change.
3. **Candidates 3–7: PARTIAL.**
   - 3 (`…` tails, 3 spans): accepted; rewritten to `<command>`.
   - 4 (`worktree add`): rejected. It is not a typo for `worktree new`; it is the command
     `goals/lane-bootstrap` exists to build (see ask 2).
   - 5 (13 unknown options): split. Accepted 8: `yeet publish --start-pr-early` (7,
     removed by push-first #1427; the flag is dropped from the spans) and
     `qa extract --round` (1, in the live browser-qa-loop skill; now `--session` with the
     round directory). Rejected 5: every `yeet repair --pr` span is the arrow-chain
     pipeline `repair → verify → publish --pr → monitor`, and `--pr` belongs to
     `publish`. That is a fifth FP class (arrow-chain notation). The shared command-span
     eligibility now treats a whitespace-delimited `→` like a shell operator (`->` was
     already excluded through `>`), so neither stage reads such a chain as one command,
     while an arrow inside a single argument (a quoted description) does not disqualify
     the invocation.
   - 6 (530 broken paths) and 7 (unclassified spans): accepted as the baseline and K9
     classification burn-down; not rewritten here.

Reviewer riders carried forward: the `verified` span class counts spans the evaluators
checked, failing ones included (rename or document it before the report becomes a gate
input), and whether `goals/*/ops/reports/` is archival must be decided before PR 4 seals
a baseline.

## Workstream C knowledge doctor PR 2b — domain evaluators (recorded 2026-10-14)

**Verdict: asks 4 and 6 accepted, ask 5 answered with doc rewrites, ask 7 rejected; risk 1
ruled.** Reviews candidates 8–14 of the PR 2b section of `p4-report-knowledge-doctor.md`.
That section lands with #1690; this record precedes it on `main`. Independent reviewer: an
Opus 5.5 reviewer run by the orchestrator session (fp-review-E), read-only on the #1690
head. The orchestrator session ruled on risk 1. The full review is kept outside the repo in
the orchestrator's gate records. The live `unknown-beep-symbol` counts matched the report
exactly (241 package, 81 subpath, 6 export findings across 136 documents and 100 causes).

1. **Ask 4, candidate 8 (proposed package names): ACCEPTED, premise corrected; no
   `planned` class.** About 141 of the ~190 findings name packages that existed and were
   deleted (the CourtListener, DOL and Federal Register drivers removed in #680, the
   protobuf driver removed in #690, the canvas family, repo-codegraph, docgen and others).
   They are rot, not plans. 49 never existed, and only 5 of those sit in active packets.
   Proposed names are written as prose without a code span (the `SPEC.md` authoring note
   now records the spelling). The rot is retargeted or sealed into the PR 4 baseline; it is
   not rewritten here. The HEAD check on `explorations/` stays: those documents make
   current-state claims, and the rot shows the check catching real decay.
2. **Ask 5, candidates 9 and 12: doc rewrite for both; both reader changes REJECTED.** A
   family read (a directory under `packages/` resolves as a package) would hide real
   staleness, because some family names were once packages, and some names are both a
   package and a family. An "extension tail means a package-relative path" read has two
   roots (package root and `src/`), misreads role files and member prose, and would still
   leave 2 true positives. Applied here:
   - candidate 9 (42 spans): family names written as packages become the real package
     (`@beep/epistemic-domain`, `@beep/law-practice-domain`, `@beep/law-practice-tables`,
     the law-practice use-cases and server packages) where one is meant, or the family
     directory (`packages/epistemic/`, `packages/law-practice/`, `packages/agents/`)
     where the family is meant. Most are in `explorations/_gold-intake/GOLD_SYNTHESIS.md`.
     One negation ("there is no @beep/agents package") takes the prose spelling.
   - candidate 12 (7 spans): file-shaped specifiers become repo-relative paths, for
     example `packages/foundation/modeling/rdf/src/Vocab/Prov.ts`, so the paths evaluator
     checks each against a real tree entry. The 2 true positives (the untracked
     schema Int.ts and CommonTextSchemas.ts sources cited in
     `goals/standards-remediation/ops/reports/`) are untouched baseline material. The
     remaining 2 of the 11 belong to ask 7: the role-file subpath is a prohibition and the
     `Table.make` subpath is historical narration.
3. **Ask 6, candidates 10 and 14: 14 ACCEPTED; 10 PARTIAL.** All 14 skill findings match
   the report (6 floating sources, 6 missing licenses, 2 lock-coverage drifts: `closeout`
   and `orchestrate` are installed but unlocked). B-3b's v2 migration plus a lock refresh
   fixes them. Of the 13 standards package findings, 9 are illustrative examples in the
   onboarding, testing and cross-slice chapters. The other 4 in
   `standards/memory-architecture/` are not illustrative: two name the deleted
   repo-codegraph package and two a proposed memory package that never existed. They are
   respelled as prose ("the since-retired @beep/repo-codegraph package", "a proposed
   @beep/memory package"), not deleted, because they record decisions about removed or
   unbuilt things. Rider: the illustrative chapters also carry illustrative broken paths
   among the 530; a fix for them must write the slice placeholder paths as prose, or the
   chapter stays red.
4. **Ask 7, candidates 11 and 13: both archival rules REJECTED.** The report's split was
   wrong: 22 of the 27 standards symbol findings are prohibitions ("retired, do not
   import", "not compatibility surfaces"): 9 in `standards/ARCHITECTURE.md`, 5 in
   `standards/architecture/07-non-slice-families.md`, 1 in
   `standards/architecture/GLOSSARY.md`, 7 in `standards/architecture/DECISIONS.md`. A doc
   "fix" that deleted them would strip binding guidance. The true positives are the other
   5, rewritten here: `09-errors-across-boundaries.md` (the Opaque wrappers were retired in
   #1347 while the chapter still said they "retire with" it), the `Defect` wrapper twice
   and the `EntitySchema` subpath (retired in #720) in the architecture `DECISIONS.md`, and
   the historical `Table.make` subpath there. A filename rule for `DECISIONS.md` would cover
   93 tracked files, silence 34 path findings in exploration decision logs, take them out
   of Stage 1, and still miss `04-decision-log.md`. Making `ops/handoffs/` archival would
   silence live runbooks of active packets (`openclaw-workstation-agent`,
   `ci-fleet-endgame`); dated handoffs are already archival under each packet's history/handoffs directory.
   Candidate 13 is fixed instead: `goals/ai-metrics-stack/ops/handoffs/HANDOFF_P7E_CLOSEOUT.md`
   now reads "lifecycle was `active`", which the packet-status claim grammar stops at.

**Orchestrator ruling on risk 1 (prohibition and "retired" references).** Same shape as the
C-report ask 2 ruling: no new span class and no reader rule. A prohibition or retirement
note that names a surface which no longer exists is written in prose without a code span,
recorded in the same `SPEC.md` authoring note as `beep <cmd>` and the proposed-package
spelling. Either path keeps the guidance text. This PR applies the prose spelling to the 22
prohibitions, removing only the code spans so each still reads as a prohibition. The bulk
fallback, if a later prohibition cannot be respelled safely, is a named baseline group in
PR 4 (reason: prohibition-of-retired-surface), not an edit made under time pressure.

**Follow-ups for PR 3 and PR 4 (risks 2–5):**

- Risk 2: the counterfactual harness proves only the resolve side. Add failure-path
  fixtures for the export search that stops silently at 256 files and then reports "does
  not export", and for a package-level `export * from "@beep/…"` that is never followed.
  Today's 6 export failures are all real, but that is luck, not coverage.
- Risk 3: the K9 unclassified worklist grew 56% (19,370 to about 30,200). The report's
  "mostly turbo task ids" is wrong: about 38% of symbol spans carry `#`, and most of those
  sit in one packet. Report unclassified counts per evaluator and per file, and plan
  per-file historical markers as the bulk tool.
- Risk 4: "verified = checked, not passed" is half done. The schema doc now says "always
  checked", but the report's verified count still includes about 883 failing spans and
  does not say so.
- Risk 5: `packet-status` checks only 3 lifecycle claims across the corpus, and the narrow
  claim grammar's recall is unmeasured. The paths evaluator also reads branch names as
  paths (a "branch `goals/…`" span in an active runbook); that FP class needs its own fix,
  which an `ops/handoffs/` archival rule would only have hidden.
