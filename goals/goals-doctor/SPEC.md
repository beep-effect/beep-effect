# Goals Doctor & Index Spec

## Objective

Make `goals/` lifecycle machine-truthful. Ship a `beep goals` command group —
`index`, `doctor`, `set-status` — plus a canonical `GoalManifest` schema, so
that packet status is validated, drift between manifests and git reality is
detected mechanically, the portfolio has a generated index, and no status
surface is ever hand-maintained again. Wire the checks into `yeet verify`.

Motivating evidence (audited 2026-07-10/11; see `research/SOURCES.md`; the
figures move with every merge — P0's re-census is the migration's ground
truth): 77 of 82 packet dirs (excluding `_template`) have manifests; **5 have
none**; ~20 distinct status tokens are spread across two competing fields
(`initiative.status` on 77 packets, a bare top-level `status` on 7) plus a
third field (`lifecycle`, on 57) that can disagree with either — e.g.
yeet-pr-closeout-loop is `superseded`/`active` on main today; 7 active
packets violate the mandatory-GOAL.md rule; the reflection gate's 4-token
completed list silently skips effectively-closed packets; `goals/README.md`'s
hand-written snapshot contradicts its own index policy; and the 2026-07-11
housekeeping sweep (PR #365) had to close nine packets whose work had merged
weeks earlier — every one of those findings was mechanically detectable.

## Non-Goals

- Physical archive moves (`goals/_archive/`) — follow-up after doctor is green.
- Scheduled/cron reconciliation automation — follow-up packet
  (`portfolio-heartbeat`); this packet ships the command it will run.
- Explorations tooling beyond an advisory ATLAS-consistency check.
- Living-spec delta merges, WIP caps, claim/lease enforcement (schema carries
  optional fields; nothing enforces them yet).
- Rewriting packet prose, closing or triaging stalled packets beyond what the
  migration mechanically requires.

## Source Hierarchy

1. User objective (this packet; goals-system recommendations, 2026-07-11).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards; `goals/README.md` packet standard.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Goals/` (new command group; schemas
  colocated, following the `Lint/ReflectionArtifact.ts` pattern).
- `packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts`
  (derive its completed-status set from the canonical domain).
- Yeet verify lane wiring (`commands/Quality/Tasks.ts`, alongside
  `lint:reflection-artifacts`).
- `goals/*/ops/manifest.json` + each packet README's `Lifecycle:` status line
  (mechanical migration only), `goals/INDEX.md` (new, generated),
  `goals/README.md` (replace stale snapshot with a pointer; amend the
  Lifecycle vocabulary section per D8),
  `goals/goals-doctor.baseline.jsonc` (inherited-findings baseline).
- `goals/_template/ops/manifest.json` (v2 shape).

## Design Decisions (locked)

- **D1 — Canonical status domain (LiteralKit):**
  `active | paused | completed-retained | superseded | reference`.
  Legacy mapping (applied by `set-status --migrate`, original token preserved
  in `statusNote`): `complete/completed/DONE/v1-closed/phase1-complete/...` →
  `completed-retained`; `pending-implementation/bootstrapped-*/pending` →
  `paused`; `superseded-reference` → `superseded`; bespoke progress strings
  (e.g. `active-p3-ready`, `local-proof-complete`) → nearest state +
  `statusNote`. `removed` (from `goals/README.md`) is an archive *operation*,
  not a status. Full table in `research/status-token-census.md` (P0 output).
- **D2 — One status, one writer:** `initiative.status` is canonical;
  `lifecycle` must equal it (kept during migration for wire-shape compat,
  validated equal by doctor); packets using a bare top-level `status` field
  migrate to `initiative.status`. Phase statuses normalize to
  `pending | in-progress | complete` with the legacy mapping
  `completed/complete/done/DONE → complete`,
  `pending/PENDING/planned/seeded → pending`,
  `in_progress/in-progress/active/selected → in-progress` (12 tokens observed
  in the wild; P0 re-censuses). Derived conditions (stalled, ready) are
  doctor queries, never stored fields.
- **D3 — Manifest schema:** `GoalManifest` as an effect `S.Class` with
  `schemaVersion: "initiative-manifest/v2"`; decoder accepts v1 (doctor emits
  an advisory upgrade finding). v2 adds optional `mission` (one line, feeds
  the index; migration backfills from the README Mission section where
  cleanly extractable, else null), `statusNote`, `blockedBy`, `supersededBy`
  (slug) + `supersededNote`, `claimedBy`/`claimedAt`, `discoveredFrom`. All
  other v1 fields keep their wire shape.
- **D4 — Baseline ratchet, repo-native:** doctor findings check against a
  committed `goals/goals-doctor.baseline.jsonc` (fallow pattern): inherited
  findings are advisory, **new findings block**. The baseline may only shrink.
  **Ordering:** migration (P1) lands first and `--migrate` also rewrites each
  packet README's `Lifecycle:` status line to the canonical token (the same
  two surfaces the per-slug `set-status` writes — this is what "mechanically
  requires" means in Non-Goals); the baseline is captured only afterwards, at
  P3, so migration cannot mint blocking findings against itself.
- **D5 — Doctor findings.** Blocking (beyond baseline): manifest missing or
  invalid against schema; unknown status token; `status` ≠ `lifecycle`;
  README `Status` section disagrees with manifest; `GOAL.md` > 4000 chars;
  all phases terminal but status `active`; reflection frontmatter fails
  `ReflectionFrontmatter` decode in ANY packet (today only completed packets
  are checked — the PR #365 YAML traps hid in that gap). Advisory: active
  packet with no commit touching it in 21 days and no `blockedBy`/`statusNote`;
  active packet missing `GOAL.md`; v1 schemaVersion; completed packet whose
  `completionGate` is unsatisfied and not `grandfathered`; ATLAS/graduation
  back-link inconsistencies.
- **D6 — Index:** `beep goals index --write` generates `goals/INDEX.md` from
  manifests — grouped by canonical status, one line per packet (slug, title,
  phases x/y, updated, one-line mission from the manifest or README), total
  size budgeted ≤ 25k tokens. `--check` fails on drift (codegen-drift
  pattern). `goals/README.md`'s "Current Goals Snapshot" is deleted and
  replaced by a pointer to `INDEX.md`.
- **D7 — Reflection-gate integration:** `ReflectionArtifact.ts` derives its
  completed set from the canonical domain (`completed-retained`) instead of
  the hardcoded 4-token list; `superseded` packets are exempt but get a
  doctor advisory if they carry no `supersededBy`/`supersededNote` (D3).
- **D8 — The governing standard moves with the schema:** `goals/README.md`'s
  Lifecycle section is amended in this packet so the documented vocabulary
  equals D1 exactly — add `superseded`, note that `paused` covers
  authored-but-not-started packets, and demote `removed` to the archive
  operation (with `complete` no longer a valid declaration). Without this the
  doctor would enforce a vocabulary its own governing doc (which outranks
  this SPEC in the Source Hierarchy) rejects.

## Constraints

- Effect-first and schema-first laws apply (`LiteralKit` for domains, typed
  errors, no ad-hoc guards); follow the existing `ReflectionArtifact.ts`
  command idioms.
- Migration edits to `goals/*/ops/manifest.json` must be mechanical, preserve
  key order/shape where possible, and never delete evidence prose.
- `beep goals doctor` and `index --check` must be deterministic and offline
  (git + filesystem only; no network). The completionGate advisory uses git
  heuristics only (merge/squash commits citing the packet slug or a PR
  number recorded in the packet) and stays advisory for exactly that reason.
- Doctor runtime budget: < 10s on this repo (it runs in yeet verify). The
  staleness advisory must use a single-pass `git log --since ... -- goals/`
  walk, not per-packet log calls, and must degrade to skipped-with-note when
  history is shallow (hosted Lint Policy runs on shallow checkouts).
- `set-status` refuses (typed error with remediation) when a README has no
  recognizable `Lifecycle:` status line rather than guessing an edit site.
- `goals/INDEX.md` regeneration is one deterministic command with stable
  ordering; concurrent-PR merge conflicts on it are accepted and resolved by
  rerunning `index --write` (codegen-drift precedent: docgen, laws --check).
- No new workspace packages; everything lands in `@beep/repo-cli`. The
  `beep lint goal-packets` surface is a second registered subcommand under
  the existing Lint group delegating to the Goals runner (the CLI has no
  command-alias mechanism).

## Acceptance Criteria

- [ ] `bun run beep goals set-status --migrate --write` converges: afterwards
      every manifest decodes as `GoalManifest` and doctor reports zero
      unknown-token findings. Legacy tokens preserved in `statusNote`.
- [ ] The 5 manifest-less packets have backfilled v2 manifests (status from
      their README evidence).
- [ ] `bun run beep goals index --write` produces `goals/INDEX.md`;
      `--check` exits 0 on a clean tree and 1 after a scratch manifest edit.
- [ ] `bun run beep goals doctor` (also `beep lint goal-packets`) exits 0
      with the committed baseline; introducing a synthetic new finding (test
      fixture) makes it exit 1.
- [ ] `goals/README.md`'s Lifecycle section matches the D1 vocabulary (D8).
- [ ] `beep goals set-status <slug> <status>` updates manifest + README
      status line + regenerates INDEX in one operation, and refuses unknown
      states/slugs with a typed error.
- [ ] Doctor + index --check run inside `yeet verify` alongside
      `lint:reflection-artifacts`.
- [ ] `ReflectionArtifact.ts` uses the canonical completed set; the PR #365
      YAML-trap class of failure (invalid frontmatter in a not-yet-completed
      packet) now surfaces as a finding.
- [ ] Unit tests cover: status migration mapping, doctor finding detection
      (one fixture per blocking finding), index determinism.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/goals-doctor/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/goals-doctor/ops/manifest.json` | Passes |
| Migration converged | `bun run beep goals doctor` | Exit 0 (baseline-clean) |
| Index drift | `bun run beep goals index --check` | Exit 0 |
| Reflection gate | `bun run beep lint reflection-artifacts` | Exit 0 |
| Repo proof | `bun run beep yeet verify` | All lanes pass |
| Whitespace | `git diff --check -- goals/ packages/` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (e.g. archive moves, cron
  automation, packet triage beyond mechanical migration).
- A legacy manifest cannot be mapped mechanically and needs a human status
  decision — record it, park that packet's migration, continue.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Reflection-gate opt-out (`reflectionRequired: false`) set on 5 pre-reflection-era packets: agent-effectiveness-loop, dedup-clone-engine, jsdoc-worker-eval, nlp-adjunct-port, repo-quality-convergence | `bun run beep lint reflection-artifacts` | goals-doctor migration (2026-07-11) | D7's canonical completed set newly gates packets whose legacy tokens (`phase1-complete`, `DONE`, `p0-p6-...`, `local-proof-complete`, backfill) were closed before the reflection practice existed; the gate now honors an explicit opt-out as a non-blocking advisory while an absent field still gates (strict default preserved, per the `reflectionRequired` contract in `goals/README.md`). | Write closeout reflections for those packets and flip `reflectionRequired` back to `true`. |
