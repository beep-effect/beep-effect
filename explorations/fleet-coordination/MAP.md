# Map

<!--
Stage 4. Names the goal packets, their sequencing edges, the first vertical
slice, and the capability check. Written 2026-08-05 after the operator approved
BRIEF.md. Every capability claim below was verified against main at 680a862a8e,
not carried over from the research.
-->

## Candidate goal packets

### 1. `fleet-mirror` — the only packet this exploration produces

**Mission.** Derive a read-only view of every checkout sharing this origin, and
deliver it ambiently so an agent learns about duplicate work and moved base state
before it pays for them — without any agent posting anything.

Everything else in `DECISIONS.md` is either out of scope by ruling (claim
registry, enforcement, cross-machine) or owned elsewhere (below).

## Not our packets — sequencing edges outward

| Work | Owner | Edge |
|---|---|---|
| Repo-wide regeneration rule (#60) | speed-loop ledger | D1 requires it be repo-wide policy, not a `WaveManifest` carve-out. Independent of the mirror; neither blocks the other. |
| `AgentBrief` + reserved `fleet` block (#52) | speed-loop **PR-I** | **Hard blocker for rung 2 only.** |
| `OwnershipClaim` (#49) | speed-loop **PR-I** | Wrap, never rebuild (decision 37). Rung 2. |
| `beep agent report list` (#45) | speed-loop **PR-I** | Optional enrichment — a live agent's own account of `filesTouched`. Rung 2. |
| Pre-push wiring (PR-G), Q7 guard, #551 regression | speed-loop | Handed off in `research/HANDOFF-2-pre-push-and-guard.md`; dispositioned as A6–A10. |

## Capability check

Verified against `main` at `680a862a8e` by source search, not assumed.

| Component | Status |
|---|---|
| `beep worktree doctor` | **Exists** — `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts`, per-worktree diagnostic row schema (`:216`, `:251`), read-only report schema (`:256`, `:281`), report builder (`:586`). Widen its enumeration from one clone to all checkouts sharing the origin URL. |
| `git merge-tree --write-tree --name-only` | **Exists** — plumbing, measured ~50–65 ms. Requires the target *object*, not just its SHA. |
| `/proc/<pid>/cwd` scan | **Exists** — 6.8 ms in Bun. Not universally readable; unreadable ⇒ `unknown`. |
| `AgentBrief` / `AgentBrief.fleet` | ⚠ **Not on main.** Zero source references at `680a862a8e`. Ships in PR-I. |
| `OwnershipClaim` | ⚠ **Not on main.** Zero source references. Ships in PR-I. |
| `beep agent report list` | ⚠ **Not on main.** Not registered as a command. Ships in PR-I. |
| `FleetCheckout` schema row | **Net-new.** One schema in the Worktree command's existing schema family. |
| `beep worktree fleet` subcommand | **Net-new.** One subcommand, or a flag on `doctor` — see the open decomposition choice below. |
| Scanner object database | **Net-new.** A cache dir holding one fetched target per epoch, so `merge-tree` has an object to work against. |

Net-new surface for the whole packet: **one widened enumeration, one schema row,
one subcommand, one cache directory.** Nothing else.

## The decomposition finding — two rungs, and only one is blocked

`BRIEF.md` sets the appetite as "starting when PR-I merges," on the grounds that
`AgentBrief.fleet` is the delivery vehicle. The capability check above refines
that: **the delivery half is blocked; the derivation half is not.**

**Rung 1 — derivation, unblocked today.** The scan, the three signals, the
liveness classifier, the scanner ODB, and a human-invokable read-only command.
This composes only `worktree doctor`, `merge-tree`, and `/proc` — all present on
main. It needs nothing from PR-I, because a human running a command is a delivery
vector that already exists.

**Rung 2 — ambient delivery, gated on PR-I.** Emitting the derived snapshot into
`AgentBrief.fleet`, plus the D4 receipt posture and the epoch-gated re-pulse.
This is where the mirror stops being a tool you run and starts being a thing that
reaches you.

Splitting this way also retires the packet's real risk earlier: the uncertain
part was always whether the signals are *correct and quiet enough*, and rung 1
answers that against the live fleet without waiting on another session's PR.

⚠ **This refines the approved BRIEF's sequencing and needs an operator ruling
before graduation.** The BRIEF is not wrong — rung 2 genuinely cannot start
before PR-I — but "the packet starts when PR-I merges" is stronger than the
evidence requires.

## First vertical slice

Rung 1, ending at a test rather than a feature:

1. `FleetCheckout` schema — one row per checkout: path, branch, head SHA, dirty
   count (`status --porcelain -uall`), liveness ∈ `live | dormant | unknown`,
   and the fields the D4/D5 amendments require to be measured-or-`unknown`.
2. A `Context.Service` that derives the snapshot: enumerate checkouts sharing the
   origin URL, classify liveness, fetch the epoch target into the scanner ODB,
   run `merge-tree` per live checkout, and compute policy-path movement against a
   **measured** surface.
3. `beep worktree fleet` renders it read-only.
4. **The proof:** a failing-then-green test reconstructing the #551 shape — main
   moves onto a measured policy path while a checkout holds an in-flight branch
   that never touched the changed file. Signal 3 must fire; signals 1 and 2 must
   stay silent, because there is no textual conflict. A mirror that cannot
   distinguish those is not carrying Mode B.

Design order is schema → `Context.Service` contract → implementation, per
standing law.

## Open decomposition choices

Neither blocks graduation; both are goal-packet design latitude.

- **`beep worktree fleet` vs a flag on `beep worktree doctor`.** `SYNTHESIS.md`
  says a subcommand; `RESEARCH.md`'s capability inventory says widen `doctor`.
  Recommendation: **a sibling subcommand.** `doctor` answers "is *this* checkout
  healthy," the mirror answers "what is the *fleet* doing" — different question,
  different output shape, and `doctor`'s row schema stays single-clone.
- **Where the scanner ODB lives.** A gitignored cache dir is the obvious answer;
  the alternative is `objects/info/alternates` against a sibling clone, which is
  faster but couples the scanner to another checkout's object store.
