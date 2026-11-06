# Goal packet conflict-free appends Spec

## Objective

Lanes record decisions as their own files; SPEC.md and PLAN.md blocks are generated projections, so sibling PRs never conflict on a shared tail.

## Non-Goals

- Converting the 265 existing packets' hand-written Decision Log tables and
  dated sections into files (forward-only; per-packet conversion is optional).
- Editing `.gitattributes` or `scripts/regenerate-merge-driver.sh`; the
  sibling lane feat/goal-manifest-research-projection owns both.
- Generating any other SPEC.md or PLAN.md section (phase tables, acceptance
  criteria, exception ledgers stay authored).
- A merge driver that can regenerate a marker block inside an authored file.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Goals/Decisions.schemas.ts`,
  `Decisions.service.ts`, `Decisions.projection.ts`, `Decisions.ts`
  (schema, `GoalDecisionLog` contract, pure core, `beep goals decisions`).
- `Doctor.ts` (`GoalPacketReader` decision reads, `decision-file-invalid` and
  `decision-log-drift` blocking findings) and the knowledge doctor's tree reader.
- `Bootstrap.ts` SPEC.md / PLAN.md templates and their golden fixtures;
  `goals/_template/`.
- `AGENTS.md` Autonomy rule, `goals/README.md`, `.claude/skills/explore`.

## Constraints

- Design order schema -> `Context.Service` contract -> implementation; Effect v4
  modules only; `LiteralKit` for the kind domain.
- The rendered block is a pure, deterministic projection of `decisions/*.md`
  (oldest first by date, then file name) and stays readable on GitHub.
- A packet with no `decisions/` directory and no marker block is byte-for-byte
  untouched by every command.
- Rejected decision files never render; the writer refuses and the doctor
  blocks until they decode.

## Acceptance Criteria

- [x] `bun run beep goals decisions add <slug> ...` writes a schema-valid file
  and regenerates the packet's SPEC.md / PLAN.md blocks.
- [x] `bun run beep goals doctor` reports `decision-log-drift` as a new blocking
  finding when a block differs from its files, and `decision-file-invalid` for
  a file outside the grammar; `bun run beep goals decisions write` clears both.
- [x] New packets from `bun run beep goals bootstrap` carry the empty generated
  blocks; existing packets are untouched.
- [x] `goals/README.md` and `AGENTS.md` tell agents to write decision files,
  never SPEC.md tails.
- [ ] Final PR merged by the orchestrator with `merge-ready: yes`.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/goal-packet-conflict-free-appends/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/goal-packet-conflict-free-appends/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/goal-packet-conflict-free-appends` | Passes |
| Projection | `bun run beep goals decisions check` | `invalid=0 drift=0` |
| Doctor | `bun run beep goals doctor` | `blocking_new=0` |
| Unit | `bunx vitest run test/goals-decisions.test.ts` in `packages/tooling/tool/cli` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add goal-packet-conflict-free-appends --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug goal-packet-conflict-free-appends`; add a `kind: decision` file there, never edit this block._

### Forward-only migration: legacy Decision Log bodies stay frozen above the block, 2026-11-05

Existing packets keep their hand-written Decision Log tables and `###` sections exactly as committed. The generated block is appended at the end of the `## Decision log` section the first time a packet gains a decision file (or inserted where a marker pair already exists), so the authored history sits above the marker and only the block is regenerated. A packet with no `decisions/` directory and no marker is not touched at all, which keeps this change out of the 265 existing packets. Converting history into files is optional per packet and never required by the doctor.

Lane `feat/goal-packet-decision-files`

Reverse: Convert a packet by hand: move each legacy entry into a decision file, delete the legacy text, run decisions write. Nothing in the tool depends on the legacy text being present or absent.

### Generated blocks are regenerate-driver candidates; .gitattributes handoff to the manifest-research lane, 2026-11-05

The SPEC.md and PLAN.md blocks are pure projections of `decisions/*.md`, so they qualify for the `regenerate` merge driver (`scripts/regenerate-merge-driver.sh`, `.gitattributes`). This lane does not edit those two files: the sibling lane feat/goal-manifest-research-projection is making `ops/manifest.json` `research[]` a directory projection and owns both edits. Handoff: that lane adds `goals/*/SPEC.md` and `goals/*/PLAN.md` to the allowlist only if the driver learns to regenerate a marker block inside an otherwise authored file; until then the documented repair is to merge main and run `bun run beep goals decisions write --slug <slug>`. The doctor keeps both honest either way.

Lane `feat/goal-packet-decision-files`

Reverse: Leave the two paths out of the regenerate allowlist; merges then conflict inside the block and are resolved by running decisions write after the merge, which is already the documented repair.

### Decisions are lane-owned files, not SPEC.md tail edits, 2026-11-05

On 2026-11-04 three merges on the turborepo-* packets put all eleven sibling PRs (#2683-#2695) into CONFLICTING at once; every conflict was a dated `###` section appended to the tail of `## Decision log` in SPEC.md (and current-preparation notes at the tail of PLAN.md). Two lanes appending to one tail is an unresolvable content conflict, and `.gitattributes` rightly keeps SPEC.md out of `merge=union` because its tables edit and delete rows. Each decision is now its own file, `goals/<slug>/decisions/<YYYY-MM-DD>-<topic>.md`, with schema-validated YAML frontmatter (`GoalDecisionFrontmatter`: title, date, reversal, optional kind/lane/pullRequest). New files never conflict. `bun run beep goals decisions write` renders the directory oldest-first into a marker-delimited block; `bun run beep goals doctor` blocks on `decision-log-drift` and `decision-file-invalid`.

Lane `feat/goal-packet-decision-files`

Reverse: Delete goals/*/decisions/, remove the marker blocks, drop the decision-* doctor kinds from Doctor.ts and restore the Decision Log table in the bootstrap template.

### PLAN.md checkpoints ride the same mechanism as kind: checkpoint, 2026-11-05

The conflicting PLAN.md edits were status notes ("Current checkpoint", "Current diagnostic preparation") appended to the plan tail, the same shape as the SPEC.md decisions. Rather than a second generator, a decision file may carry `kind: checkpoint`; it then renders into the `## Checkpoints` block of PLAN.md instead of SPEC.md. One schema, one renderer, one splicer, two targets. Phase tables and other authored PLAN.md content stay hand-edited.

Lane `feat/goal-packet-decision-files`

Reverse: Drop the checkpoint literal from GoalDecisionKind and the PLAN.md target from GOAL_DECISION_TARGETS; the SPEC.md projection is unaffected.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
