# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-06 — home-slice

**Question:** Where does agent execution authority live: the execution values,
the `ExecutionLedger` port and Drizzle adapter, `GovernedTierGate`,
`GovernedEgress` and `@beep/epistemic-config`?

**Answer:** A new dedicated product slice. Its name is decided in round 2.

**Rationale:** `10-cross-slice-coordination.md` §5 resolution 3 gives a
cross-cut its own slice, and the 2026-10-21 decision promised "their own home".
Coupling to epistemic runs one way (RESEARCH §1), so a clean cut is possible.
A separate slice keeps "authorize what an agent's tools do" apart from
`packages/agents`, which runs the model. That slice has no MCP, grant or config
code today (RESEARCH §4a). Rejected: `packages/agents`, which would make one
slice both run the model and judge its tools. Also rejected: values to
`shared/domain` with adapters in a slice, because shared needs at least 2
consumers and admits no adapters, and foundation cannot import the shared
`Principal` (RESEARCH §4c). Recommendation given: new slice. Accepted.

## 2026-11-06 — egress-scope

**Question:** Does `GovernedEgress` (network publish sink) move with
`GovernedTierGate` (MCP tool sink)?

**Answer:** Yes. Both sinks, the shared ledger and the shared config move
together.

**Rationale:** Both are decided under one frozen grant set, recorded in one
hash-chained decision ledger and configured by one config. Splitting egress off
would leave two owners for one chain. Recommendation given: move together.
Accepted.

## 2026-11-06 — hash-domain-labels

**Question:** What happens to the hash domain-separation strings
`epistemic-execution-decision/v1`, `epistemic-execution-outcome/v1` and
`epistemic-grant-set/v1`?

**Answer:** Freeze them byte-identical as historical labels, with a comment at
each definition saying why they keep the epistemic name.

**Rationale:** They are hash inputs, so changing them changes the bytes of every
new row (RESEARCH §3; `11-evolution-and-deprecation.md` rule 5). Freezing them
keeps existing chains valid with no dual-prefix verifier. Rejected: minting
`<home>-*/v2` plus a permanent dual-prefix verifier, whose only gain is the
name. Recommendation given: freeze. Accepted.

## 2026-11-06 — canonical-json

**Question:** Ledger hashing reuses `canonicalDetectionJson` from
`@beep/epistemics`. What does the new home do?

**Answer:** Keep importing it from `@beep/epistemics`.

**Rationale:** A slice may import a foundation package, and reusing the same
function keeps the bytes identical by construction. Rejected: promoting a
neutral canonical-JSON primitive to `foundation/primitive` (a refactor of
epistemics in the middle of the move; it can be a separate cleanup), and a
local copy with a golden test (duplication the fallow gate would flag).
Recommendation given: keep importing. Accepted.

## 2026-11-07 — ledger-shape

**Question:** Do agent decisions live only on the governed result (attached
provenance, with denials in telemetry), or also in a stream of their own?

**Answer:** The middle path. A session-keyed, append-only decision stream,
written before the effect runs, keeps every decision, denials included. Each
ontology Session change-journal entry also gets an `authorizedBy` IRI that
names the decision that allowed it. The field sits next to the existing
`OntologyChangeActor` (`packages/ontology/domain/src/aggregates/Session/Session.model.ts:60`).
Because the link is an IRI string, ontology imports nothing from the new slice.
Telemetry gets a copy of denials for dashboards and is never their record.

**Rationale:** The research report (`research/provenance-placement-ddd.md`)
supports the operator's position that provenance is attached to what it
describes, but only for provenance of a result. Decisions fail its four tests:

- *existence*: a denial has no result to attach to, and "no record, no action"
  writes the decision before the effect exists;
- *cardinality*: read and publish dispatches leave no Session change;
- *lifecycle*: an audit row in the effect's transaction rolls back with it;
- *trust*: the record must not share a write path with the agent it holds
  accountable.

Every system surveyed that records denials keeps them apart from the governed
object (CloudTrail `errorCode`, the GCP Policy Denied log, PCI DSS 10.2.1.4).

Rejected:

- collapsing into Session provenance plus telemetry, which makes denials lossy
  and loses the "decided, outcome unknown" state;
- keeping a durable table of denials only, with no chain.

Recommendation given: the middle path. Accepted. This supersedes the
2026-11-06 chat proposal to move the vocabulary to `foundation/modeling` and
bind the gate in the desktop app.

## 2026-11-07 — slice-name

**Question:** What is the dedicated slice called?

**Answer:** `execution-authority`, with packages
`@beep/execution-authority-{domain,use-cases,server,tables,config}`.

**Rationale:** It matches the goal that built the code
(`agent-execution-authority`) and the ExecutionGrant/Verdict/Record vocabulary,
and it collides with nothing in the glossary. Bare `authority` collides with
Identity Authority and Source authority. Rejected: `governed-execution`, and
`governance`, which would invite unrelated policy code and already names
policy-pack data in the glossary. Recommendation given and accepted.

## 2026-11-07 — table-names

**Question:** What happens to `epistemic_execution_decision` and
`epistemic_execution_outcome` and their constraints, triggers and guard
function?

**Answer:** A forward drizzle migration renames the tables, constraints,
triggers and function to the `execution_authority_` prefix. A tested
down-migration is the safety net, as the autonomy charter requires, and the
name-pinned migration tests are updated.

**Rationale:** Installed desktops keep their PGlite data, so the rename has to
be a forward migration. Hash inputs contain no table names (RESEARCH §3), so no
stored bytes change. The prefix then names the owning slice. Rejected: keeping
the old names as a legacy exception (permanently misleading), and
re-baselining, which assumes the zero-user state of 2026-08-13 without checking
it. Recommendation given and accepted.

## 2026-11-07 — env-keys

**Question:** Do `EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST` and
`EPISTEMIC_POLICY_REVISION` move to the new slice's namespace?

**Answer:** Yes. Rename them to the `EXECUTION_AUTHORITY_*` namespace with no
fallback, update `.env.example` and `turbo.json`, and note the rename in the PR.

**Rationale:** A config package owns its key namespace
(`06-configuration-boundaries.md`). A missing allowlist defaults to `[]`, which
unregisters the publish tool, so a stale operator env fails closed and never
widens access. Rejected: keeping `EPISTEMIC_*` (the namespace would no longer
match its owner), and reading both keys during a deprecation window (an alias,
which the same-PR rule discourages for unreleased code). Recommendation given
and accepted.

## 2026-11-07 — tip-anchoring

**Question:** Is the chain tip anchored outside the store as part of this move?

**Answer:** No. Anchoring follows as its own goal (the existing
`agent-execution-record-anchoring` candidate), sequenced directly after the
move.

**Rationale:** The move stays a relocation that preserves behavior, so each PR
has one job. The report treats the missing anchor as the reason to add one,
not as a reason to drop the stream. Rejected: anchoring inside the move (it
mixes a new security feature into a relocation), and not planning it at all.
Recommendation given and accepted.

## 2026-11-07 — settled-by-doctrine

**Question:** Where does the config go, how is `EpistemicServerDrizzleLive`
split, and how many PRs does the move take?

**Answer:**

- Config follows its domain: `@beep/execution-authority-config`. Retire
  `@beep/epistemic-config` and record it in `changesets.retired-packages.json`.
- `EpistemicServerDrizzleLive` drops `ExecutionLedger`. The desktop's app-local
  runtime Layer composes the new slice's ledger layer.
- The move lands in one atomic PR with no re-export shims. It updates the
  FrozenGrantSet law's defining-module path and the mcp-kit and api-transport
  README port-inversion records.

**Rationale:** Each point is fixed by doctrine, not by preference:

- config depends inward on its own slice's domain
  (`06-configuration-boundaries.md:107-113`);
- one slice may not compose another slice's adapter
  (`01-hexagonal-vertical-slices.md:71-74`);
- the "same PR, no alias" rule applies to private, unreleased packages with an
  enumerable consumer list (`11-evolution-and-deprecation.md:100-107`);
- the port-inversion records live in package READMEs (DECISIONS 2026-07-25).

## 2026-11-07 — brief-split (shape)

**Question:** Does BRIEF.md's split into three pieces match the operator's
picture? The pieces are the move (one atomic PR), the `authorizedBy` link (a
separate small PR) and tip anchoring (its own goal later).

**Answer:** Yes, three pieces.

**Rationale:** The move stays a relocation that preserves behavior. The link is
new ontology behavior, so it gets its own reviewable PR. Anchoring is a
security feature with its own design space. Rejected: folding the link into the
move (ontology changes inside a 4.6k-line relocation diff), and anchoring
inside the move. Recommendation given and accepted.

## 2026-11-07 — optional-defect-helper (shape)

**Question:** How is `OptionalDefect` handled? Both epistemic use-cases and the
ledger share it, so moving it would make one slice import another.

**Answer:** The goal's first step searches live source and package barrels for
an existing helper that covers the need. If none exists, the small helper is
copied into the new slice's use-cases with a note. The goal records the
outcome as a decision.

**Rationale:** The repo's rule is reuse before recreate. Rejected: copying it
without searching first (the fallow duplication gate may flag it, and an
existing helper may already cover it), and promoting it to foundation (needs
the two-consumer proof and widens the move). Recommendation given and accepted.
