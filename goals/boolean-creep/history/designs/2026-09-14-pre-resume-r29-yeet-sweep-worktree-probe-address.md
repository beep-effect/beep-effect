# r29-yeet-sweep-worktree-probe-address

Native P2 proposal on HEAD `1c07c15495aaa42f521b887b01e943e68804606c`,
whose reviewed Sweep source equals immutable main
`3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`. The tracking ref subsequently
advanced separately; that is not an exact-current-main claim. This native P2 design is installed and awaits independent review. Product references below
are relative to `packages/tooling/tool/cli/`.

# Current shape

`SweepGitState`, `src/commands/Yeet/internal/Sweep.ts:177-200`, is an actual
named class and the world/planner seam documented at :119-146. The complete
owner contains seven Booleans, so it passes the initial campaign net. This
independently adjudicated minimal cluster selects the actual fields
`worktreeProbeUnreliable: S.Boolean` (:188) and
`mainWorktreePath: S.NonEmptyString.pipe(S.OptionFromOptionalKey,
SchemaUtils.withNoneDefault)` (:189). It does not invent a predicate over a
required string or a synthetic field.

The live writer at :756-762 uses the same `worktreeList` result to produce the
reliability flag and address. A failed, nonzero or truncated result has no
address. The explicit comment forbids naming a worktree nobody observed. The
exported `refreshNotCompletedHandoff` contract at :1003-1009 repeats this rule:
an unreadable list cannot supply a holding address, so the handoff stays bare.
The direct fixture at `test/yeet-sweep-plan.test.ts:814-821` exercises it.

The supported class input space is wider than the live writer's full occupancy
image. The tests construct `mainCheckedOutElsewhere: true` with no address
(:279/:285) and an unreliable worktree observation while the branch-occupancy
Boolean remains false (:814-821 plus defaults :46-67). Preserve those inputs.
They do not contradict the selected reliability/address contract. Do not
derive or constrain either occupancy Boolean from this new field.

# Cardinality gap

The real Boolean/presence product is four; three combinations have supported
meaning. Payload values are not collapsed to one concrete address.

| Unreliable | Address | Supported meaning and evidence |
| --- | --- | --- |
| false | None | Reliable/unaddressed. Default fixture :46-69; held-main partial fixtures :279/:285. This does not assert that main is free. |
| false | Some(path) | Reliable/addressed. Direct handoff fixtures :773-811 preserve ordinary paths, spaces and embedded quotes. |
| true | None | Unreliable/unaddressed. Writer Sweep.ts:756-762 and direct no-address fixture :814-821. |
| true | Some(path) | Excluded by the same-probe producer contract and the exported handoff's prohibition on naming an unobserved holder. |

Evidence is the exclusive writer plus a real Boolean/optional-payload
implication: an address requires a reliable worktree observation. It is not
the stronger claim that reliable implies addressed, or that absence proves a
free main. Generic `.make` permissiveness and the reader's ability to render
a contradictory address do not establish that contradictory tuple as a
legitimate helper contract. No such supported fixture or alternate path
producer was found. No whole-owner cardinality is asserted.

# Target schema

Replace only these two fields with one required
`mainWorktreeObservation: SweepMainWorktreeObservation`. Own the three
discriminator values with one annotated local
`LiteralKit(["unreliable", "unaddressed", "addressed"])`, named
`SweepMainWorktreeObservationKind`, without `as const` or a parallel literal
union. The canonical tagged model has precisely these cases:

| kind | Case payload |
| --- | --- |
| unreliable | none |
| unaddressed | none |
| addressed | `mainWorktreePath: S.NonEmptyString` |

Use the repository's LiteralKit member construction and
`S.toTaggedUnion("kind")` with schema-derived constructors/guards/match.
Prefer annotated class members when a reusable model is needed; plain struct
members are acceptable only as the concrete internal discriminated-record
composition boundary, with a same-name schema-derived Type alias. Do not add
a broad `S.Unknown`, custom assertion, ad-hoc runtime guard, or codec.

The model is derived from the existing captured observation. Keep the current
probe and lookup order. If `probeUnreliable(worktreeList)` is true, construct
unreliable without trusting parsed partial output. Otherwise match the actual
`worktreeHolding` Option: None becomes unaddressed, Some(path) becomes addressed
with the exact path. Do not add another probe or derive new facts from path
equality, required strings or occupancy Booleans.

The new field is required. The old reliability Boolean was required, while
an omitted old address received None. Migrate those legitimate constructor
calls explicitly to unreliable or unaddressed according to their original
Boolean. Do not default an omitted new required observation silently. Paths
retain the full NonEmptyString domain, including whitespace-only nonempty
strings accepted by the class, embedded quotes and metacharacters. The live
parser's existing trim behavior remains at the observation boundary.

# Migration inventory

- `Sweep.ts:177-200`: replace only reliability/address fields with the new
  derived observation. Keep all other fields, schema defaults and payloads.
  Keep required `branch`, `mainBranch` and `headBranch` NonEmptyString values.
  In particular preserve the independently supported main/branch occupancy
  Booleans, local/remote/main tip Options, PR Options, ancestry Boolean and
  lockfile forecast. The separate accepted status-pair design remains closed;
  coordinate serial shared-class edits without revisiting its 4/3 decision.
- `Sweep.ts:148-171,450-475`: migrate both documented `.make` examples from
  reliable plus omitted path to unaddressed. Retain all example payloads.
- `Sweep.ts:267-278`: replace reliability tests with the schema-derived
  unreliable-case guard. Keep exact blocker descriptions and priority.
  Reliable unaddressed and addressed cases still read the independent
  occupancy Booleans and `headBranch` exactly as today. No occupancy inference
  from address presence is permitted.
- `Sweep.ts:556-588,712-771`: preserve parsing, self-path exclusion, first
  matching branch lookup and capture semantics. Construct the new field once
  from the same worktree probe and existing Option lookup. Keep the two
  occupancy writers at :750-752 exactly conservative, including their
  independent helper-input domain. Keep `probeUnreliable` for all other uses.
- `Sweep.ts:1026-1050`: match the new observation once to create the complete
  handoff. Unreliable and unaddressed produce today's None-path reason and
  bare `bun run beep yeet sweep`; addressed produces today's holder suffix
  and quoted `cd ... && bun run beep yeet sweep --branch ...`. Reuse a shared
  local thunk for identical no-address output only when it shortens the
  actual implementation. Do not rebuild the old Boolean/Option bag or add a
  conversion facade. Preserve both dual call forms, `localMain`/`trackingMain`
  full Options, `optionText` formatting and POSIX shell quoting.
- `Sweep.ts:304-317,319-348,403-410`: ff-main, local deletion and end-state
  retain their precondition arrays and ordering through the migrated main/
  branch helpers. A reliable but held-main/no-path fixture still blocks;
  an unreliable probe still names the unreadable command, not an occupancy
  claim. An in-place main merge still uses the separate clean-worktree check.
- `Sweep.ts:485-505,798-803,1052-1101,1186-1230,1312-1335`: preserve plan
  construction, post-refresh handoff selection and report execution. The
  original captured state remains the common input; do not resample it, move
  lockfile decisions earlier or change step routing.
- `test/yeet-sweep-plan.test.ts:46-75,199-235,509-521,544-556,773-821`: migrate
  base fixtures, failure/truncation assertions and handoff case constructors.
  The base fixture is unaddressed. The override helper's old Partial shape
  must migrate honestly; do not leave an adapter that silently fixes
  contradictory legacy fields. Keep all explicit unrelated overrides.
- `src/test/Yeet.test-kit.ts:66-67` exports sweep codecs and the Sweep module;
  the package's test route at `package.json:65-68` exposes this internal test
  seam while denying internal source imports. Preserve SweepGitState and all
  existing helper signatures atomically. No unused export or legacy alias is
  required solely to keep old fixtures compiling.
- Existing caller routes remain: `Porcelain.ts:92-107,134-150` encodes/renders
  plan/report; `Merge.ts:254-257` consumes the sweep report;
  `MonitorLoop.ts:982-988` invokes sweep after merge. They do not read either
  removed field. Graft plus targeted source/test searches found the direct
  writer/readers above; absence of graph edges alone was not the proof.

# Guard-deletion accounting

Delete the stored Boolean/Option pair and its implicit prohibition on
unreliable/Some(path). The producer's repeated reliability-dependent field
writes become one exhaustive observation construction. The Option test at
the worktree lookup boundary remains necessary for addressed versus
unaddressed; it is not a deleted safety check.

Replace the two reliability branches in mainFreePrecondition and
branchFreePrecondition with schema-derived case selection. Preserve their
observable failed preconditions. Replace the two independent
`O.match(state.mainWorktreePath)` calls at :1033-1047 with one exhaustive
observation match producing a coherent reason/command pair. No compatibility
getter should reconstruct both removed fields.

Retain `probeUnreliable`, worktree occupancy checks, head-branch checks,
deletion/PR/tip guards, `shellQuote`, and post-refresh lockfile checks. They
remain safety or output boundaries and get no deletion credit. This does not
delete the independent status-pair checks on behalf of its separate design.

# Encoded-side impact

No raw SweepGitState encode/decode consumer was found. The exported class is
an internal decoded/test seam, so its known TypeScript callers can migrate
atomically. Do not introduce a legacy class codec or serialize the new tag.

The existing documents remain exact: Sweep.schemas.ts:120 precondition
description/satisfied; :150 plan step fields; :182 plan; :349 report;
:383 SweepPlanJson and :412 SweepReportJson. Keep all legitimate existing
actions, precondition arrays, reason text, operator commands, output statuses
and omission behavior. In particular bare versus addressed handoff output is
observable and cannot be collapsed. Preserve the actual unsupported input
boundary: no new output for unreliable plus invented Some(path) is promised.

# Test impact

Retain all current plan and report tests, including codec round-trip at
yeet-sweep-plan.test.ts:492-506, remote deletion unaffected by worktree probe
failure at :233-235, and the partial occupancy fixtures at :279/:285 and
:814-821. Preserve ordinary addressed paths (:773-783), spaces (:787-794),
embedded quotes (:796-803), and prohibition on a looping in-place command
(:805-812).

Add focused model/observer coverage during implementation for the three
variants: reliable None, reliable Some(exact path), unreliable None. Explicitly
check failed/nonzero/truncated output containing a plausible path never
produces addressed. Confirm unreliable has no address member, without adding
new production exports solely for a test. Compare exact reason and command
for both no-address variants and preserve all blocker descriptions/order.
Retain the unknown-worktree/branch-false helper fixture; it must not become
unrepresentable through an unrelated occupancy tightening.

No package tests ran in this P2 preparation. During implementation run the
focused Sweep suite, required `@beep/repo-cli` package verification, and the
campaign's authorized aggregate checks. Private equation/byte checks are
supporting evidence, not execution of the TypeScript tests or P3 approval.

# Risk

The principal risk is conflating unaddressed with unoccupied, which would
erase supported partial information and alter safety blockers. A second is
retaining a path from truncated output or combining it with a contradictory
unreliable flag, yielding a misleading operator command. The three-case model
preserves the former and prevents the latter without changing other facts.

Keep this separate from the accepted status pair and the unadmitted
ancestry/local-tip finding. Apply admitted Sweep migrations within the ordered
Tier1E subsystem batch using serial shared-file edits. Rebind if HEAD/source
changes. Parent admission and independent review must confirm the minimal
constructor-domain contract before implementation; no full-owner product or
P3 approval is claimed here.
