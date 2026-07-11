# Project Intelligence Plan

## Status

Status: `pending` (next action: launch P0)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Close gates G1–G7 with evidence: recon, product definition, architecture proposal, technology ADR, threat model. | All six P0 artifacts committed under `research/`; every gate closed or stopped-and-documented; manifest `exit` oracle satisfied. |
| P1 Proof spec | pending | Write the deterministic first-proof specification. | `research/proof-spec.md` complete per SPEC acceptance; fixtures and invariants named. |
| P2 Implement | pending | Implement the first vertical proof and minimum durable architecture it requires. | Proof runs end to end from fixtures; sample daily brief generated; SPEC constraints honored. |
| P3 Verify | pending | Prove idempotency, retry, provenance, rebuildability; run repo quality lanes. | Proof and quality green, or blockers reproduced and documented. |
| P4 Yeet | pending | Drive each phase PR to mergeable via `bun run beep yeet`. | Required checks green and MERGEABLE. |
| P5 Close | pending | Reflection, staged roadmap, next-proof recommendation. | Closeout checklist below complete. |

## P0 Checklist

Repo-side reconnaissance is substantially pre-seeded — start from
[`research/recon-findings.md`](./research/recon-findings.md) instead of
re-surveying the repo.

Artifacts (all under `research/`, all sanitization-clean per SPEC D2):

1. `recon-report.md` — extend recon-findings.md with corpus reconnaissance:
   recurring topics, named technologies/projects/vendors/authors, implicit
   research questions, pain points, watchlist seeds, excluded material. The
   operator research corpus and cloned-repository collection are inspected
   locally; only sanitized conclusions (with sampling strategy, confidence,
   exclusions, unresolved questions) are committed.
2. `interest-taxonomy-watchlist.md` — interest taxonomy + the small explicit
   seed watchlist of public GitHub repositories (SPEC swap clause applies).
3. `product-definition.md` — smallest coherent product model for the loop;
   users, jobs, and the questions the system must answer; concept census
   against existing repo language (epistemic, documents, workspace, shared
   kernel) — reuse before invention.
4. `architecture-proposal.md` — gates G1 (ownership), G4 (source identity),
   G5 (fixture catalog), G6 (watchlist entry), G7 (projections); authority vs
   projection map; scheduled-execution placement; canonical SDK surface.
5. `technology-adr.md` — gate G2 (Cognee / Zep-Graphiti / TrustGraph / mem0 /
   repo-native baseline / discovered alternative) with options, evidence,
   tradeoffs, recommendation, confidence, reversibility, change conditions.
6. `threat-model.md` — gate D7 baseline: cite
   `explorations/ingestion-security-secret-governance`, scope to the first
   proof's attack surface (fixture-driven, so minimal live surface; ingested
   text is data-not-instructions; secret detection; license/attribution
   capture; deletion/rebuild provenance).

Decision log: every gate resolution is a dated entry appended to the D-table
in `SPEC.md` (D8+), citing its research artifact.

## P1 Checklist

- `research/proof-spec.md`: scenario; inputs and fixtures; expected
  authoritative records; expected projections; package ownership; failure
  cases; invariants; acceptance tests; explicitly deferred capabilities.
- Fixture catalog decision (G5) applied; fixtures authored or generation
  scripted deterministically.

## P2–P3 Notes

- Only the first vertical proof and the minimum durable architecture it
  requires. New packages route through `bun run beep architecture` (Generated
  Default); no shared-kernel promotion without a promotion record; no direct
  slice-to-slice imports.
- Evidence artifacts (sample daily brief from fixtures, proof run output)
  land under `history/`.

## P5 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Record the staged capability roadmap (SPEC P5 acceptance) and the
   recommended next vertical proof, with per-stage prerequisites, risks,
   proof criteria, and exclusions.
4. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes
  (gate resolutions append to the decision table; they do not rewrite locked
  constraints).
- Keep this plan current; archive old run outputs under `history/`.
- Each phase ships as its own PR (manifest `completionGate`); `main` is
  PR-only, so all work happens on feature branches through
  `bun run beep yeet`.

## Verification Commands

```sh
test "$(wc -m < goals/project-intelligence/GOAL.md)" -le 4000
jq . goals/project-intelligence/ops/manifest.json
rg -n "project-intelligence|GOAL.md|agentLaunchers|packetAnchorDocument" goals/project-intelligence
git diff --check -- goals/project-intelligence
bun run beep lint reflection-artifacts
```
