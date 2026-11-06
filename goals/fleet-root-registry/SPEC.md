# Fleet Root Registry Spec

## Objective

Every path-dependent beep CLI surface resolves "where the fleet is" from one
per-repository setting: an ordered list of discovery roots. A new authored
registry, schema-first and file-backed beside the session ledger, authors only
what git cannot derive (seat role, owning seat, drain status, retention
exemption). `beep worktree fleet --join` prints one compact row per checkout
beside its authored facts and `beep worktree fleet describe <checkout>`
expands that row into mirror, registry and latest session-ledger detail. The
mirror's per-root undercount of `beep-effect0-worktrees` (35 directories, 1
attributed at the 2026-10-05 census) is explained or fixed.

Re-grounded 2026-11-06 against live source (`Fleet.service.ts
resolveFleetScope`, Economics `projectsRootOf`/`fleetCandidates`,
`Worktree.service.ts:1540`): the fleet root already exists as a per-call
option, discovery reads exactly one directory level and origin-matches, and
the session ledger already records lane, branch and PR per checkout. The
contract below replaces the 2026-10-05 wording that assumed a single nested
root and a fresh checkout-fact store.

Brief and decisions: [`explorations/agent-fleet-layout/BRIEF.md`](../../explorations/agent-fleet-layout/BRIEF.md), [`explorations/agent-fleet-layout/DECISIONS.md`](../../explorations/agent-fleet-layout/DECISIONS.md) (2026-11-06 amendments included). Depends on: none (first bet in the map).

## Discovery roots

The setting is a per-repository ordered list, never a single path:

| Root | Match rule | Role |
| --- | --- | --- |
| `<projects dir>` (today `~/YeeBois/projects`) | child named `beep-effect*`, origin-matched | legacy clones, `<clone>-worktrees` lanes, `<clone>/.claude/worktrees` lanes |
| `<projects dir>/beep/seats` | every origin-matched child | seats |
| `<projects dir>/beep/lanes` | every origin-matched child | lanes (owning seat is a registry fact) |

Discovery stays one level deep under each root and never recurses or follows
symlinks. With the setting absent the list defaults to today's derived root
(the common dir's grandparent) so `beep worktree fleet --json` is
byte-identical. Source of the setting, in precedence order: `BEEP_FLEET_ROOTS`
(path-list, tests and timer units) then
`~/.local/state/beep/fleet/<repo-key>/roots.json`, where `<repo-key>` is the
session ledger's key (`github.com__beep-effect__beep-effect`), so
`beep-effect-private` gets its own fleet by construction.

## Registry

`~/.local/state/beep/fleet/<repo-key>/registry.json`, decoded through an
`effect/Schema` document. One row per checkout path. Authored fields only:

| Field | Domain (`LiteralKit`) | Writer |
| --- | --- | --- |
| `seatRole` | `main`, `ops`, `review`, `research`, `impl`, `legacy`, `adopted` | operator via `register`; scan for `legacy` and `adopted` |
| `owningSeat` | checkout path of the seat whose `.git` the lane lives in | scan (`git-common-dir`), `register` override |
| `drainStatus` | `active`, `draining`, `retired` | reaper (`legacy-drain`); default `active` |
| `retentionExempt` | boolean | operator |

Lane slug, packet, PR, branch and session state are never authored here; the
joined view reads them from the session ledger's latest row for the checkout.
The scan auto-adopts: every origin-matched clone under the legacy root without
a row gets `legacy`; every lane without a row gets `adopted`. Adoption is
idempotent, never deletes a row, and an explicit `register` wins.

Seat roles are workload-named (operator ruling 2026-11-06): `review`,
`research` and `impl` replace the exploration's `a`, `b`, `c` so `beep session
open` and the orchestrator can route work by seat without a second field.

## Views

- `beep worktree fleet` and `--json`: unchanged (fleet-mirror SPEC, read-only
  and derived).
- `beep worktree fleet --join`: one compact row per checkout, keyed by the
  checkout path, mirror facts beside registry facts plus the ledger's latest
  `state`, `lane`, `pr`.
- `beep worktree fleet describe <checkout>`: the expansion of one row: full
  mirror record, registry row, the last N session-ledger rows. The
  summary/pointer/expand split follows LCM (Ehrlich & Blackman, arXiv
  2605.04050): the compact view is what a session reads; detail is pulled on
  demand, never printed by default.
- `beep worktree fleet register <checkout> --role <seatRole> [--owning-seat
  <path>] [--retention-exempt]`.

## Non-Goals

- Moving, creating or deleting any checkout (`legacy-drain`).
- Creating the real `seats/main` clone or any lane; rewriting `worktree add`'s
  managed root (`lane-bootstrap`, which also edits the AGENTS.md Quality
  Operator worktree bullet).
- Timer re-render (`ops-seat-timers`).
- A bare shared object store.
- A summary DAG over the session ledger (captured in `explorations/INBOX.md`).
- Changing plain `beep worktree fleet` output.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, `decisions/` and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts`
  (`resolveFleetScope`, `discoverClones`, `enumerateFleet`: take the roots list)
- `packages/tooling/tool/cli/src/commands/Worktree/Fleet.command.ts`
  (`--join`, `describe`, `register`)
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts`
  (`projectsRootOf`, `fleetCandidates`: read the roots list)
- `packages/tooling/tool/cli/src/commands/Worktree/internal/ResidueReap.ts`
  discovery roots
- new `packages/tooling/tool/cli/src/commands/Worktree/internal/FleetRoots.*`
  and `FleetRegistry.*` (schema -> `Context.Service` -> store)
- `docs/runbooks/fleet-root-and-registry.md` (new)

## Constraints

- Schema first: roots document, registry document, seat role and drain status
  are `effect/Schema` models with `LiteralKit` domains before any store code.
- `git rev-parse --git-common-dir` consumers (`yeet sweep --retire`, the
  live-checkout fence, Codex `--add-dir`) keep resolving.
- Legacy checkouts stay discoverable until `legacy-drain` ends.
- Mirror undercount: until explained, nothing downstream trusts the mirror's
  per-root grouping for deletion decisions. Leading hypothesis: `cloneStubs`
  attributes lanes only through a clone's successful `git worktree list`; a
  failed listing contributes the clone alone.
- The registry never duplicates a session-ledger field.

## Acceptance Criteria

- [ ] Effect Vitest fixture fleet (temp projects dir with `beep-effectN`
      clones, `<clone>-worktrees` lanes, `.claude/worktrees` lanes, and
      `beep/seats/main` plus `beep/lanes/x`, all origin-matched): with the
      three roots configured, `fleet --json` lists every checkout; with roots
      unset, output is byte-identical to the pre-change build on the fixture
      and on this workstation.
- [ ] `fleet --join` on the fixture prints each checkout's mirror facts beside
      `seatRole`, `owningSeat`, `drainStatus` and the ledger's `lane`, `pr`,
      `state`; legacy clones and unregistered lanes show auto-adopted roles.
- [ ] `fleet describe <checkout>` expands one row; `fleet register` overrides
      an adopted role and survives a rescan.
- [ ] `roots.json` and `registry.json` decode against their schemas;
      `BEEP_FLEET_ROOTS` overrides the file.
- [ ] Economics `--fleet` and residue-reap discovery read the same roots list.
- [ ] The `beep-effect0-worktrees` count matches
      `git -C beep-effect0 worktree list` or the discrepancy has a named cause
      recorded in the reflection.
- [ ] `docs/runbooks/fleet-root-and-registry.md` documents roots, registry,
      adoption and the three views.
- [ ] `bun run beep quality package-verify @beep/repo-cli` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/fleet-root-registry/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/fleet-root-registry/ops/manifest.json` | Passes |
| Byte-identical mirror | `bun run beep worktree fleet --json` before and after, roots unset, diffed | Empty diff |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Whitespace | `git diff --check -- goals/fleet-root-registry` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Decision Log

Seeded from the exploration; entries here cover only decisions taken inside
this goal. Decisions from 2026-11-06 onward are files under `decisions/`
rendered by `beep goals decisions add`.

| Date | Decision | Source |
| --- | --- | --- |
| 2026-10-05 | Scope, non-goals and constraints inherited from the exploration brief, rabbit holes and no-gos. | `explorations/agent-fleet-layout/DECISIONS.md` |
| 2026-10-06 | Use discovery root for the configured projects directory and legacy checkouts for its matching `beep-effect*` child checkout roots; exclude unrelated project directories. Reversal path: revert this doc-only criterion if the fleet registry contract later intentionally admits nonmatching project directories. | Issue #1449 |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug fleet-root-registry`; add a `kind: decision` file there, never edit this block._

### Fleet root is a per-repository ordered list of discovery roots, 2026-11-06

Live code reads one directory level under the fleet root and origin-matches (Fleet.service.ts discoverClones); Economics fleetCandidates prefix-matches beep-effect*. The 2026-10-05 criterion (projects/beep/seats/main discovered with the projects dir as root) was unreachable. The setting becomes an ordered list: <projects> (legacy, prefix-matched), <projects>/beep/seats, <projects>/beep/lanes. Discovery stays one level deep, origin-matched, no recursion, no symlinks. Unset defaults to today's derived root so fleet --json is byte-identical. Rejected: single root with two-level recursion (discovery learns a layout shape and the legacy dir still needs a second rule); single root at seats/ only (desktop-app and Codex lanes invisible until adopted).

Lane `@chore/deps-update-11-6-26 (grill session)`

Reverse: Collapse the list to a single root by keeping only its first entry and re-adding recursion into seats/ and lanes/ in discoverClones.

### Run fleet-root-registry before lane-bootstrap, shrunk to one PR, 2026-11-06

Operator ruling 2026-11-06. fleet-root-registry stays first in the map but its scope shrinks to: per-repository discovery-roots list, thin registry overlay, joined and describe views, undercount explanation. lane-bootstrap starts the moment this merges. Rejected: lane-bootstrap first (it would invent fleet-root and registry stubs this packet then replaces); merging both into one packet (breaks the one-PR appetite and delays drain).

Lane `@chore/deps-update-11-6-26 (grill session)`

Reverse: Swap the order by moving the roots list and registry stubs into lane-bootstrap's SPEC and marking this packet dependent on it.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
