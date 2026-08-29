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
