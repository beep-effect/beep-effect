# P4 goals-projection decisions — ratified 2026-10-09

Outcome record for the five open questions at the end of
`research/p4-goals-projection-design.md`. Under the 2026-10-06 operator autonomy
charter (`AGENTS.md` § Autonomy: only money escalates), the implementing agent made
these calls; each records its reason and how to reverse it. The operator reviews them
asynchronously. Nothing here reopens D1–D10, the four normalized row families, or the
six sealed differential fixtures. These outcomes land as their own docs-only PR before
the implementation PR, per the packet's grill-separation rule.

## G1. `beep goals catalog` stays its own subcommand

The catalog answers a different question (who declares what) than `next` (what can be
worked now), and the design's contract 3 gives each question one versioned report
schema. Folding it into `goals next --catalog` would make a flag change the output
schema. Three read-only subcommands: `next`, `explain <slug>`, `catalog`.

Reverse: alias `catalog` under `next --catalog` and deprecate the subcommand; the
report schema is unchanged either way.

## G2. `goal-frontier/v1` keeps top-level `cycles`

A cycle is the one blocker that no amount of frontier work clears, so the worklist
should surface it where an agent reads the worklist. It costs one sorted array that is
empty in the healthy case. `explain` still returns the SCC that contains its target.

Reverse: drop the field in `goal-frontier/v2`; consumers read cycles from `explain`.

## G3. Shortest-unlock is unbounded; the walk is a closure with minimum depth

No depth cap. The walk terminates by construction: the SQL recursion is a `UNION`
over a finite `(slug, depth)` set, bounded by the packet count, and the TypeScript
reference uses a visited set. The live census is about 110 packets, so the walk is
small.

The design's per-capability "shortest chain" sketch is replaced by one
better-defined rule, which both engines implement and the differential pins:

- A **candidate provider** of a capability is a packet that provides it with status
  `active` or `paused`. A `completed-retained` provider would already make the
  capability available. Superseded and reference providers never satisfy readiness
  (D8), so they are never routed through.
- `unlockPath(target)` is every packet reachable from the target through
  "unavailable requirement → candidate provider" edges, each kept at its minimum
  depth (depth 1 = a direct provider of one of the target's unavailable
  requirements), ordered by `(depth, slug)`, target excluded.

A chain-only walk would hide the other AND requirements of an intermediate packet
(a provider that is itself blocked on two capabilities). The closure lists every
packet on any blocking route, shallowest first. It is still not a global minimum
unlock set (Steiner-style minimization stays out of v1). OR alternatives all
appear, each annotated with its status and `executionCapable` (D7).

Reverse: add a `--depth <n>` cap or a chain-only mode as a new fixture plus a
`goal-explain/v2` field. The closure stays the reference semantics.

## G4. Mermaid block collapses completed topological layers into relics from the first render

SPEC permits relic collapse, and the live census is already mostly
`completed-retained`. Rendering every terminal packet expanded would bloat the
tracked `goals/INDEX.md` before anyone sees a benefit. Completed layers collapse into
relic nodes unless a blocker explanation needs them. This binds PR 2 (the Mermaid
slice), not the commands PR.

Reverse: one renderer flag in the `goals index` writer; the projection is unchanged.

## G5. `goals explain` takes a packet slug only in v1

The positional decodes through `GoalSlug`. Capability questions ("who provides
`knowledge/doctor`, who waits on it") are already answered by `goals catalog`. A
`cap:` prefix would add a second positional grammar and a second report shape before
there is demand for it.

Reverse: accept `cap:<namespace>/<name>` and return a `capability-explain/v1`
report; additive, no existing schema changes.

## G6. Fog means "no buildable provider", not "no provider rows"

Recorded because the design's two documents differ: the sketch's
`GoalRequirementRow.fog` says "no provider rows at all", while D8 says "an ability
nobody buildable provides renders as honest `fog:<capability>`". D8 is ratified
doctrine, so it wins. A required capability is fog when no provider has status
`active`, `paused`, or `completed-retained`. The catalog keeps the narrower
signals separate: `orphan` (consumers but zero provider rows) and `stranded`
(provider rows, all superseded).

Reverse: none needed unless D8 is reopened, which this packet forbids.
