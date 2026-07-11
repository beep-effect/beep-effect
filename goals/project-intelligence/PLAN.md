# Project Intelligence Plan

## Status

Status: `pending` (next action: launch P0)

## PR lifecycle

Every delivery phase (P0–P3) ships as its own PR driven to mergeable via
`bun run beep yeet` — Yeet is a per-phase transition gate, not a phase. P4 is
a program-level audit of all phase PRs; P5 is the separately gated closeout
PR. `main` is PR-only, so all work happens on feature branches.

Two rules apply to every phase transition:

- **Two-pass transition (all phases).** Include the phase's status flip
  (manifest `phases[Pn].status`, this plan's row AND its top-level Status
  line, README Current Phase/Latest Evidence, plus the regenerated
  `goals/INDEX.md` from `bun run beep goals index --write`) as staged
  changes in the phase's own PR. Pass 1: run the Phase-Exit Audit excluding the flip and
  hosted-check conditions. Pass 2: after yeet publishes and hosted checks
  are green, re-run the audit against the full exit oracle. On failure,
  restore each surface to its exact pre-transition value in a follow-up
  commit before doing anything else — lifecycle fields
  (`initiative.status`, `lifecycle`, README lifecycle) go back to `active`;
  phase-status fields (`phases[Pn].status`, this plan's row) go back to
  their prior `pending`/`in-progress` value; prose surfaces (top-level
  Status, Current Phase, Latest Evidence) go back to their exact pre-flip
  text; and `goals/INDEX.md` is regenerated (`bun run beep goals index
  --write`) against the restored manifest so the index gate passes in the
  rollback commit too.
- **Mergeable includes merged.** Wherever an exit oracle says a PR must be
  mergeable, `MERGED` also satisfies it — merged phase PRs remain valid
  evidence forever.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Close gates G1–G7 with evidence: recon, product definition, architecture proposal, technology ADR, prototype disposition, threat model. | Seven `research/` artifacts committed and registered in the manifest, plus one `history/` phase evidence note; G1–G6 `accepted`, G7 `accepted`/`deferred-nonblocking`; freshness check recorded; sanitization (mechanical + manual review) clean; P0 PR mergeable via yeet. |
| P1 Proof spec | pending | Write the deterministic first-proof specification. | `research/proof-spec.md` complete per SPEC P1 acceptance (invocation contract, determinism scenario matrix, grounded brief schema, adversarial fixtures); P1 PR mergeable via yeet. |
| P2 Implement | pending | Implement the first vertical proof and minimum durable architecture it requires. | The named proof command runs end to end from a clean checkout against fixtures (transcript recorded); sample daily brief generated; SPEC constraints honored; P2 PR mergeable via yeet. |
| P3 Verify | pending | Prove the determinism scenario matrix, adversarial outcomes, provenance, rebuildability; run repo quality lanes. | Proof green, AND either `bun run beep yeet verify` (full tier) passes, OR every failure is reproduced against the `origin/main` base, classified inherited/unrelated in `history/P3-evidence.md`, and no lane covering this packet's affected scope fails. Failures in this phase's own scope always block. P3 PR mergeable via yeet. |
| P4 Program audit | pending | Audit all phase PRs against GitHub reality, including stacking order. | `history/` audit note lists every P0–P3 PR URL with base/head + dependency order; predecessors merged in sequence or the stacked chain rebased/retargeted and revalidated in landing order; each PR MERGED or currently MERGEABLE with checks green; packet statuses agree with GitHub; audit PR mergeable via yeet. |
| P5 Close | pending | Closeout PR: status flip, reflection, roadmap, next-proof recommendation. | Closeout checklist below complete, in its stated order. |

## P0 Checklist

**P0 preflight (corpus access).** Before touching any local material, obtain
from the operator a session-only, read-only allowlist of corpus locations
(research collections, cloned-repository sets) plus a sampling scope. The
allowlist itself is never committed; `recon-report.md` records only
sanitized logical source categories and sampling evidence. Inspecting
anything outside the allowlist is a stop condition (SPEC).

Repo-side reconnaissance is substantially pre-seeded — start from
[`research/recon-findings.md`](./research/recon-findings.md). Run its
**freshness re-check commands** (recorded there) against the current tree and
record the result in `recon-report.md`; do not resurvey from scratch unless
the freshness check shows material drift.

Artifacts (items 1–7 under `research/`, item 8 under `history/`; all
sanitization-clean per SPEC D2):

1. `recon-report.md` — freshness-check result + corpus reconnaissance:
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
4. `architecture-proposal.md` — the owning artifact for gates G1
   (concept-ownership matrix + adapter matrix), G4 (source identity,
   retention/tombstone/purge/rebuild semantics), G5 (fixture ownership and
   catalog shape, per testing doctrine), G6 (watchlist entry), and G7
   (vault/MCP projection candidates); authority vs projection map;
   scheduled-execution placement; canonical SDK surface.
5. `technology-adr.md` — gate G2 (Cognee / Zep-Graphiti / TrustGraph / mem0 /
   repo-native baseline / discovered alternative) with options, evidence,
   tradeoffs, recommendation, confidence, reversibility, change conditions.
6. `prototype-disposition.md` — gate G3: exhaustive per-mechanism disposition
   matrix for the `beep research` prototype, keyed by the nine executable
   CLI tokens (`capture`, `cognify`, `daily`, `digest`, `history-sift`,
   `install-timers`, `notion-pull`, `repo-card`, `status`) plus every
   reusable internal mechanism including the systemd user-timer
   installation: promote / reuse / retire / defer (per D8), with evidence
   and replacement ownership; `defer` rows must satisfy the SPEC G3 defer
   rules.
7. `threat-model.md` — gate D7 baseline: cite
   `explorations/ingestion-security-secret-governance`, scope to the first
   proof's attack surface. Fixture-driven does NOT mean risk-free: captured
   source text still reaches a committed public Markdown brief, so enumerate
   content-boundary risks (prompt injection, secret-shaped tokens, dangerous
   URLs/HTML, control characters, oversized inputs, malformed encodings,
   attribution gaps) and their required redact/quarantine/render-safe
   outcomes. Reference the accepted G5 decision (owned by
   `architecture-proposal.md`) only for adversarial-fixture placement.
8. Phase evidence note under `history/` — includes the recorded manual
   sanitization review (SPEC D2 semantic layer).

Gate bookkeeping: every gate resolution is a dated D8+ entry appended to the
SPEC decision table, citing its research artifact. Gate states are binding
(SPEC): G1–G6 must be `accepted` before P1; a `blocked` gate keeps P0 open or
pauses the packet with an explicit resume condition.

## P1 Checklist

- `research/proof-spec.md` per SPEC P1 acceptance. Non-negotiable contents:
  the exact proof invocation contract (command, arguments, inputs/config,
  outputs, exit codes); expected authoritative records with stable IDs,
  counts, hashes, canonical ordering; the grounded brief projection schema
  (every assertion/recommendation references claim/evidence IDs and visible
  lifecycle state; candidate material labeled); the determinism scenario
  matrix (cold run, same-store rerun, clean-store rebuild, modified input,
  source removal, partial failure — fixed clock); the adversarial fixture
  list with expected outcomes; explicitly deferred capabilities.
- Fixture ownership per G5: executable fixtures live in the owning package's
  `/test` surface; packet copies are generated evidence only.
- Cross-slice test placement (doctrine: slice-isolation guarantee in
  `standards/architecture/08-testing.md`): `proof-spec.md` must state that
  consuming-slice tests stub the epistemic boundary; any real multi-slice
  composition proof lives at an app/integration boundary with app-owned
  wiring and package-local fixtures.

## P2–P3 Notes

- Only the first vertical proof and the minimum durable architecture it
  requires. New packages route through `bun run beep architecture` (Generated
  Default); no shared-kernel promotion without a promotion record. Direct
  slice-to-slice imports are forbidden at the domain tier; composing the
  epistemic mechanism at the use-cases/server tier is allowed only through
  the bounded exception recorded in the SPEC Exception Ledger (2026-06-18
  decision).
- Failure semantics are partitioned (SPEC): driver-neutral typed failure and
  cancellation contracts are in scope and fixture-tested; live-transport
  policy (rate limits, pagination, retry timing against live APIs) is
  deliberately out of scope — do not overbuild it.
- P2 must execute the named proof command from a clean checkout and record
  the transcript; evidence artifacts (sample daily brief, proof run output)
  land under `history/`.

## Phase-Exit Audit

Manual checklist, run before marking any phase complete. `bun run beep
goals doctor` and `bun run beep goals index --check` (shipped 2026-07-11,
PR #373) mechanize the manifest/index portion — run both, and regenerate
the index (`bun run beep goals index --write`) in the same PR as any status
change; the remaining items stay manual:

1. Required artifacts for the phase exist at their named paths.
2. `README.md` (status, Current Phase, Latest Evidence), this plan's phase
   table AND top-level Status line, and `ops/manifest.json` phase statuses
   agree with each other and with GitHub PR state.
3. Every gate the phase claims to close has a dated D8+ entry in SPEC citing
   evidence.
4. Newly created `research/` artifacts are registered in
   `researchReports[]` (and `currentSourceOfTruth[]` when normative) in the
   same PR. `history/` evidence notes are never registered there — check
   instead that they exist at their deterministic paths and are linked from
   README "Latest Evidence".
5. The manifest `exit` oracle string for the phase is literally satisfied.
   Exception — pass 1 of ANY phase evaluates the oracle EXCLUDING that
   phase's own status flip and hosted-PR conditions (those are validated by
   pass 2 after publication); P5's pass 1 additionally excludes the
   reflection lint.
6. Sanitization: mechanical command zero-hits + manual review recorded.

Phase evidence conventions (deterministic paths the audit checks): every
phase Pn writes `history/Pn-evidence.md` (P0–P5), and each MUST contain a
"Manual sanitization review" section (SPEC D2 semantic layer). Additional
named artifacts: `history/P2-proof-transcript.md` +
`history/P2-sample-brief.md`; `history/P4-pr-audit.md`;
`research/roadmap.md` (P5 roadmap + next-proof recommendation; registered
in `researchReports[]`). Policy: `researchReports[]` indexes `research/`
artifacts ONLY; `history/` evidence notes are never added to it — they use
these deterministic names and are linked from README "Latest Evidence".

## P5 Closeout Checklist

Order matters: all closeout content lands BEFORE the status flip, and the
flip happens immediately before the lint + final publication (the reflection
lint only inspects packets whose status is a completed token). The goal is
achieved only when the status-bearing closeout PR is mergeable.

1. Write a closeout reflection via the `/reflect` skill (or copy
   `goals/_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo
   **tooling**, the **implementation**, and the **goal/prompt**; capture
   TODOs worth codifying. Its YAML frontmatter must validate against
   `ReflectionFrontmatter`.
2. Record the staged capability roadmap in `research/roadmap.md` (SPEC P5
   acceptance) and the recommended next vertical proof, with per-stage
   prerequisites, risks, proof criteria, and exclusions; write
   `history/P5-evidence.md`.
3. Run the Phase-Exit Audit (pre-status pass): every item must hold except
   the status flip, reflection lint, and hosted-PR conditions themselves.
4. STAGE (do not commit) the atomic status set: `ops/manifest.json`
   `initiative.status` + `lifecycle` to the final status
   (`completed-retained` expected) + `phases[P5].status: "complete"`; this
   plan's top-level Status line AND its P5 row; README (Status, Current
   Phase, Latest Evidence); AND the regenerated `goals/INDEX.md`
   (`bun run beep goals index --write`) so the index gate passes against
   the flipped manifest. Yeet creates the commit — do not pre-commit.
5. Run `bun run beep lint reflection-artifacts` against the working tree —
   it must pass with the completed status in place. If it fails, fix the
   reflection or unstage the status set; never publish a completed status
   with a failing lint.
6. Publish the staged closeout exactly via
   `bun run beep yeet publish --staged-only --pr --monitor --message "docs(goals): close project-intelligence"`
   (drop `--pr` if the closeout PR already exists). Staging (step 4) is a
   PRE-publication condition only — publication consumes the staged index.
   Then run the final audit against the full P5 exit oracle, whose
   publication conditions are: the yeet-created closeout commit atomically
   contains the entire status set (no earlier commit contained any of it),
   and the closeout PR reaches MERGED, or currently MERGEABLE with required
   checks green. On any post-publication failure, restore each surface to
   its exact pre-transition value per the PR-lifecycle rollback rule
   (lifecycle fields → `active`; `phases[P5].status` and this plan's P5 row
   → their prior value; prose surfaces → pre-flip text; `goals/INDEX.md`
   regenerated against the restored manifest).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes
  (gate resolutions append to the decision table; they do not rewrite locked
  constraints).
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/project-intelligence/GOAL.md)" -le 4000
jq . goals/project-intelligence/ops/manifest.json
rg -n "project-intelligence|GOAL.md|agentLaunchers|packetAnchorDocument" goals/project-intelligence
git diff HEAD --check -- goals/project-intelligence
bun run beep lint reflection-artifacts
sh -c 'rg -n "/ho[m]e/|/Us[e]rs/|C:.[U]sers|~/[A-Za-z]|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}" goals/project-intelligence; test "$?" -eq 1'
```

The final command is the D2 mechanical sanitization check as a tri-state
wrapper: it exits 0 only when `rg` finds nothing (rg exit 1), and fails on
both hits (rg exit 0) and scanner errors (rg exit 2).

Ordering matters: run this battery AFTER staging every phase change
(`git add`, including new research/history files — `git diff HEAD --check`
sees untracked files only once staged) and BEFORE publishing; after yeet
commits, the diff-based checks trivially pass and prove nothing.
