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
