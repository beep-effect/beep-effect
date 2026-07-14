# One-Round Loop — Normative Specification

Successor packet to `goals/repo-crispening-orchestration`, born from its
closeout reflection (`goals/repo-crispening-orchestration/history/
reflections/2026-07-07-claude.md`). This document is the source of
truth; `GOAL.md` is the compact launcher; grilled rulings live in
`research/decisions-locked.md` (D1–D7, R1–R4 — locked).

## Portfolio disposition (2026-07-14)

P0 and P1 are the retained shipped outcome. P2, P3, and the property-lane
required-check flip are recorded `wont_fix` until median PR CI round-trips
exceed one. `history/p4-closeout.md` points the shipped Verification Matrix
claims to evidence. The original Definition of Done below remains the
historical contract and is not rewritten to claim deferred work shipped.

## Mission

Remove every structural cause of multi-round CI churn observed during
the crispening effort, so that a future crispening-scale packet ships
each PR in at most one CI round. Two properties define success:

1. **Fidelity** — a single local command (`bun run beep ci local`)
   renders the same verdict CI will render for every locally-runnable
   lane, because CI and local runs execute the same lane definitions
   (D2: the CLI owns the lanes, in three classes — cli-runnable,
   workflow-gated, ci-native). The CI-only residue (dependency-review
   and the ci-native lanes) is explicitly enumerated by
   `beep ci lane --list`, never silently omitted.
2. **Pre-merge law depth** — schema round-trip laws run deep enough on
   the PR that introduces a bug to catch it there (D3), instead of
   detonating as seed flakes on unrelated later PRs.

## Tiers (D1)

**Core (required for the Definition of Done):**

| # | Item | Ruling |
|---|------|--------|
| C1 | CI-lane inversion: `beep ci lane <id>` + `beep ci local`; check.yml thinned to wrappers per the three-class lane taxonomy | D2, D9 |
| C2 | Property-law lane: env-max numRuns helper + codemod sweep (incl. it.prop sites); PR-affected (400 runs) + nightly full (1000+); ratchets to required at P4 | D3, R2 |
| C3 | Coverage baseline v2: raw covered/total counts, denominator-delta failure output, auto-add missing packages | R1 |
| C4 | beep CLI cwd-independence: chdir(findRepoRoot()) at startup + invocation-cwd escape hatch + bin shim | D7 |
| C5 | `beep quality regen-generated` + documented merge-conflict recipe for generated standards files | R3 |
| C6 | `SchemaUtils.withNormalizedCheck(normalizer, options)` + migration of the hand-rolled fixed-point checks (venice-ai, phoenix, m365; uspto optional as a tightening) | R4 |

**Stretch (D6 — each may close won't-fix with a ledgered rationale in
`ops/progress.json`):**

| # | Item |
|---|------|
| S1 | Fallow envelope findings carry file/line/symbol inline |
| S2 | yeet publish committed-branch mode (skip staged gate, keep PR/monitor gates) |
| S3 | Worktree agent-lane adoption: measure/tune `beep worktree new`, document as the canonical parallel-lane path |
| S4 | CI cancel-rerun + required-check quarantine convention (first classify benign cancel-in-progress supersessions vs infra cancellations) |

## Definition of Done (D4)

1. Every core item's mechanism verification (per the Verification
   Matrix) passes.
2. **Self-dogfood (D4, D8)**: every packet PR — including P0's own —
   passed `bun run beep ci local` (built from that PR's branch) before
   push; `--fast --affected` suffices only for docs-only /
   packet-file-only PRs. A packet PR that needed more than one CI round
   is a FAILED dogfood proof: it requires a root-cause note in
   `history/` AND a demonstrated fix — the exposed failure class must
   be shown caught locally (a fixture, or the next PR's pre-push run)
   before the packet may close. Notes alone do not satisfy this clause.
   The P4 closeout tabulates CI rounds per packet PR.
3. The property-law PR lane's required-check flip has happened (D3):
   context name frozen at introduction, added to ruleset 10240248 via
   the documented admin step after a stable green history across the
   packet's own PRs.
4. Stretch items are each either shipped with their verification or
   closed won't-fix with a recorded rationale.
5. A closeout `/reflect` exists and `bun run beep lint
   reflection-artifacts` passes (`reflectionRequired: true`).

## Non-Goals (fences — violating any is a review-blocking defect)

1. **No semantic weakening of CI.** The inversion reproduces today's
   lane commands and verdicts exactly; it never removes, relaxes, or
   reorders what merges require. ADDING gates (the property lane) is
   permitted — only weakening is fenced. Parity is proven via the D9
   shadow-workflow method, not asserted.
2. **Required-check context names are frozen** by ruleset 10240248 (17
   contexts). Any rename ships the `gh api` ruleset update in the same
   change, or does not rename. Ruleset ADDITIONS (the property lane's
   P4 flip) are explicit admin steps recorded in packet history —
   ruleset state is not declarative in-repo.
3. **numRuns floors never go down.** The codemod treats every existing
   inline value as a floor; the helper only raises via env.
4. **No product/driver code changes** except the named
   `withNormalizedCheck` migrations (venice-ai, phoenix, m365 — and
   uspto only as an explicitly-noted behavior tightening), which must
   be wire-preserving (§5.3-style parity: encoded output byte-identical
   before/after). TSConfigJsonKey is out of scope (not a fixed-point
   check).
5. **No CI vendor / runner migration.** Blacksmith runners, existing
   actions, and the cache posture (CSF-001) stay.
6. **No new lint cards** beyond what the packet's own items require;
   this packet does not extend the schema-first rule set.
7. **No repo-wide reformat churn**; diffs stay scoped to the item being
   shipped.
8. **dependency-review stays CI-only** (requires the GitHub dependency
   graph API); `beep ci local` documents it as unreplayable rather than
   simulating it.

### Behavior parity, defined

Where this SPEC says "wire-preserving" or "parity-proved" for schema
migrations, it means the predecessor packet's §5.3 contract
(`goals/repo-crispening-orchestration/SPEC.md`): encoded/wire output
byte-identical before vs after, plus at least one schema-derived
arbitrary round-trip law covering the touched codec.

## Verification Matrix

| Claim | Command / evidence | Required result |
| --- | --- | --- |
| Lane fidelity (D9) | Shadow workflow_dispatch run dispatching every cli-runnable/workflow-gated lane via `beep ci lane` on the SAME head SHA as an unmodified check.yml run; run IDs recorded | Same lane set, same commands (CLI-echoed), same verdicts on that SHA |
| Local verdict parity | A fixture TABLE committed in the packet (columns: lane id, injected failure, expected local verdict, expected CI verdict) exercised on a deliberately broken branch — one row per cli-runnable lane, no lane skipped | `beep ci local` verdict matches CI verdict for every row; table + run evidence recorded in packet history |
| Lane inventory single-sourced | `bun run beep ci lane --list` (machine-readable; no "equivalent" accepted) | Enumerates every check.yml lane with its class (cli-runnable / workflow-gated / ci-native); check.yml contains no raw cli-runnable lane commands |
| Property lane catches | A seeded non-round-tripping schema fixture | PR-affected property lane FAILS on it; removing the seed passes |
| numRuns floors | Codemod golden-diff test + `rg 'numRuns:|it\.prop|test\.prop'` sweep | Every migrated site's effective runs ≥ its previous inline value; it.prop/test.prop sites migrated or explicitly ledgered |
| Nightly sweep | Workflow with `schedule` + `workflow_dispatch` and `issues: write` permission; verified via a manual dispatch (no waiting for cron) | All property suites at ≥1000 runs; failure opens/updates the single tracking issue (stable title key, label `property-laws-nightly`) |
| Property lane required flip (D3) | `gh api` read of ruleset 10240248 at P4 | The property lane context is a required check; the addition step is recorded in packet history |
| Coverage denominators | Deliberate branch-count drop fixture | Failure output includes covered/total counts and the denominator delta, not only percentages |
| Baseline auto-add | Run `coverage:baseline:write` with @beep/pacer present | pacer entry appears; missing-package warning class is empty |
| cwd-independence | `cd packages/tooling/tool/cli && bun run beep <several commands>` (via shim) | Same behavior as repo-root invocation; Worktree/Research keep invocation-cwd semantics |
| Regen command | Conflict simulation on a generated standards file | `beep quality regen-generated` restores a clean, current file set; recipe documented |
| Fixed-point combinator | dtslint + an arbitrary round-trip law over a normalizing codec using it | Law passes at high numRuns; venice-ai/phoenix/m365 call sites byte-identical on the wire; uspto (if migrated) documents the added guard |
| Dogfood ledger | P4 closeout table | CI rounds per packet PR; every >1-round PR shows BOTH a root-cause note and evidence the exposed class is now caught locally (DoD.2) |
| Packet hygiene | `test "$(wc -m < goals/one-round-loop/GOAL.md)" -le 4000`; `jq . goals/one-round-loop/ops/manifest.json`; `git diff --check -- goals/one-round-loop` | All pass |
| Full quality proof | `bun run beep yeet verify` | Green at every phase gate |

## Stop Conditions

Stop and surface to the user instead of proceeding when:

- Lane parity cannot be proven (any lane whose CI behavior demonstrably
  differs from its CLI definition after inversion).
- A required-check context would have to change name without ruleset
  access.
- The property-lane sweep surfaces a pre-existing non-round-tripping
  schema whose fix would change wire shape (that is product work, not
  this packet — file it, seed-exclude it explicitly with a ledger note,
  and continue).
- Any fence above would be violated to make progress.

## Evidence base

- `research/decisions-locked.md` — grilled rulings D1–D7, R1–R4.
- `research/research-facts.md` — distilled Explore briefs (CI lane
  inventory + verify delta; numRuns/coverage internals; CLI surfaces).
- `goals/repo-crispening-orchestration/history/reflections/2026-07-07-claude.md`
  — the originating reflection with the measured churn account.
