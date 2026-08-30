# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-08-26 — Amendment J ownership (cross-packet D24)

**Question:** Where does packet-system-redesign Amendment J's next
`@beep/skill-contract` kernel version get shaped?

**Answer:** Reopen this exploration at `decompose`. Keep the completed
`skill-contract-kernel` goal closed and leave the packet-convention migration
independent. This packet decides whether the work becomes a new candidate or an
explicit amendment to one of its later waves.

**Rationale:** This exploration owns the existing kernel vocabulary and its QA
judge consumer. Reusing that authority prevents a second certificate vocabulary
and keeps migration mechanics from defining a cross-cutting evidence contract.
The verdict/reach/envelope/apply-plan constraints are already fixed by
packet-system-redesign D22–D24; only candidate decomposition remains open.

## 2026-08-13 — spine track

**Question:** Which of the five candidate tracks (contract kernel, KG ingestion+eval, fleet
protocol surface, query/browser ops, memory routing) is the packet's spine — the one the first
goal packet(s) build, with the others as later waves consuming it?

**Answer:** All five tracks stay in scope ("everything that you found valuable"), sequenced by
the agent's valuation with **contract kernel + evidence ladder (ports 1–2) as the spine**.
Provisional wave order behind it: KG ingestion+eval (strongest product pull toward the
legal/patent KG work), query/browser ops (most concrete retrofit target in `beep qa`), memory
routing, fleet protocol surface last (fully greenfield, least consumer pull until the kernel
defines the evidence types protocols would carry).

*2026-08-13 addendum (PR #694 review):* at decompose the five tracks mapped onto **six** goal
candidates — the contract-kernel track spawns both the spine goal and a later
`ops-evidence-ladder` retrofit goal (the yeet ladder retrofit plus the deferred
bounded-recovery service). `MAP.md` §Track → candidate mapping is the authoritative wave list;
this ordering statement is unchanged otherwise.

**Rationale:** The operator declined to prune; the answer is a sequencing statement, not a
single-cycle scope — decompose maps all tracks as candidate goal packets, the first slice
builds only the kernel. Kernel-first was the recommendation because every other track depends
on its types, the ACS/in-toto research findings land there, and in-repo consumers already
exist (yeet verdicts, `qa-inventory/v1`, `ClaimGate`). Rejected as spine: KG ingestion+eval
(would hand-roll kernel pieces ad hoc), query/browser ops (narrower payoff), fleet protocol
surface (greenfield without kernel evidence types).

## 2026-08-13 — ACS posture

**Question:** How should the contract kernel position itself against Microsoft's Agent Control
Specification (the closest "gate + evidence receipt" prior art, MIT, 0.3.1-beta draft;
`research/landscape/skill-contract-formats.md` §9)?

**Answer:** Adopt vocabulary now, adapter later (recommendation accepted). Port ACS's
fail-closed decision semantics, intervention-point vocabulary, and audit-record field
discipline into the kernel schemas with attribution; an actual ACS adapter (their governance
verdicts as prerequisite gate evidence) stays a later-wave goal candidate.

**Rationale:** Interop-ready without coupling the spine to a beta external spec. Rejected:
full adapter in the spine (couples the first slice to a spec that can churn; beep has no
ACS-governed runtime today); purely native (reinvents named fail-closed vocabulary, weakens
positioning, forfeits cheap future interop).

## 2026-08-13 — receipt shape

**Question:** Should the kernel's evidence receipts adopt the in-toto attestation shape or a
leaner native one? (`research/landscape/workflow-evidence-frameworks.md` §6)

**Answer:** in-toto-aligned schemas, unsigned first (recommendation accepted).
`EvidenceReceipt`/`FailureReceipt` as Effect Schemas mirroring the Statement split —
digest-bound subject, versioned `predicateType`, typed predicate — plus a SLSA-VSA-shaped gate
summary. DSSE signing/envelopes deferred to a later wave; in-toto export becomes a projection,
not a migration.

**Rationale:** Aligning the shape is nearly free and buys named vocabulary + cheap export;
signing drags key management and signer identity into a first slice where no consumer requires
signatures. Rejected: full in-toto from day one (key discipline too early); lean native shape
(re-derives what in-toto standardized, makes export a migration).

## 2026-08-13 — kernel home (grill-with-docs)

**Question:** Where does the contract kernel live, and does the bounded-recovery service ship
inside it? The brief drafted "a new foundation capability package" — doctrine pushes back.

**Answer:** `packages/foundation/modeling/<name>`, **schemas-only**: SkillContract/Gate/
ladder/receipt schema families plus pure opaque-constructor gate evaluation, sibling to
`@beep/provenance`. The effectful bounded-recovery `Context.Service` is OUT of the spine
package — it lands with its first consumer and may promote to `foundation/capability` only
once the ≥2-importer gate is genuinely met.

**Rationale:** `foundation/capability` carries a hard negative gate (≥2 named consumers
currently importing, per `standards/architecture/07-non-slice-families.md`) that a new package
fails at birth — and both retrofit candidates (qa judge gate, yeet lane) live in the same
importer (`@beep/repo-cli`). `foundation/modeling` is the canonical home for reusable schema
substrate with no consumer gate, and `@beep/provenance` (schemas + opaque verifier consumed by
the epistemic slice) is the exact shape precedent. Rejected: foundation/capability as drafted
(gate violation needing a doctrine waiver); agents slice domain (its `Skill` is a thin
persisted product entity — the kernel is cross-cutting substrate, not one slice's product
language); tooling/library (07 forbids routing reusable runtime substrate through tooling).

## 2026-08-13 — kernel name (grill-with-docs)

**Question:** Package name under `packages/foundation/modeling/`?

**Answer:** `@beep/skill-contract` (the brief's working name, confirmed).

**Rationale:** Precise about what it models; hyphenated modeling/foundation names have
precedent (`api-transport`, `pandoc-ast`, `mcp-kit`). The agents slice's persisted `Skill`
entity is a distinct symbol with distinct meaning — nominal, not real, collision. Rejected:
`@beep/agent-contract` (collides harder with the agents slice name; less precise about the
flagship `SkillContract` aggregate), `@beep/work-contract` (compresses nothing).

## 2026-08-13 — bounded-recovery service dropped from wave 1 (grill-with-docs)

**Question:** Does the bounded-recovery service survive in wave 1 at all, now that it's out of
the kernel package?

**Answer:** Dropped from wave 1 entirely. Its *receipt and budget schemas* (`FailureReceipt`,
budget shapes, attempt receipts) still land in the kernel package, so the service — when a
real consumer arrives in the KG or ops wave — implements against already-locked types.

**Rationale:** The qa judge-gate retrofit has no retry loop; the natural consumers
(uriburner-style KG loops, yeet monitor) are later waves. Building the engine now is a
speculative abstraction with no caller. Rejected: slice/tool-local implementation in wave 1
(keeps the brief's sketch intact but ships an engine nothing needs this cycle).

## 2026-08-13 — first retrofit consumer (grill-with-docs)

**Question:** Which existing workflow is the wave-1 retrofit proving the kernel composes?

**Answer:** The `qa-inventory/v1` judge gate: its findings/evidence-refs/required-count
invariant maps directly onto the Gate + EvidenceReceipt families, and `JudgeCheck`'s
artifact/witness cross-checks become typed gate evidence.

**Rationale:** Smallest already-schema-validated surface with the clearest before/after story.
Rejected: a yeet verdict lane (higher long-term leverage but churn-heavy mid CI-hardening; the
ladder gets validated against yeet in the ops wave); both (retrofit sprawl, violates the
brief's rabbit-hole guard).

## 2026-08-13 — verdicts are values; kernel deps (derived from doctrine, not asked)

`standards/architecture/09-errors-across-boundaries.md` + uniform repo precedent
(`TierGateVerdict`, `ClaimGateResult`, qa judge checks) settle the kernel's failure model:
gate outcomes are **values** — fail-closed is a `Denied` verdict value carrying its audit
record — and `TaggedErrorClass` errors are reserved for real boundary failures (evidence
decode failure, invariant violation). No new error kind crosses any boundary.
Family dependency rules (ARCHITECTURE.md §Family And Kind Dependency Rules): modeling may
depend only on `primitive`+`modeling`, so the kernel's deps (`@beep/schema`, `@beep/identity`,
`@beep/provenance`, `@beep/md`) are legal; tooling may import any foundation kind (qa retrofit
legal); slice `domain` may import modeling (future slice consumers legal). No architecture
DECISIONS.md entry needed — every choice complies with existing doctrine.

## 2026-08-13 — SKILL.md projection in wave 1, via @beep/md (grill-with-docs)

**Question:** Is the SKILL.md render-as-encode projection in wave-1 scope, given the qa
retrofit doesn't consume it?

**Answer:** IN wave 1 (operator overrode the defer recommendation), built on `@beep/md` —
render a SKILL.md projection from a `SkillContract` instance as an `S.encode` of the
`@beep/md` document model, gated by re-extraction equality (decode the rendered artifact back
and prove it matches the contract).

*2026-08-13 addendum (PR #694 review):* `@beep/md`'s `DocumentToMarkdown` is one-way
(`encodeUnsupported` reverse), so "decode the rendered artifact back" is scoped in the goal
SPEC to the available inverses: deterministic re-render byte-equality plus frontmatter-block
schema decode; a Markdown→AST inverse parser is an explicit non-goal.

**Rationale:** It is the packet's authoritative-artifact re-extraction thesis (pattern 3) made
concrete in the spine — the operator values the thesis demonstration over the tightest
appetite. The defer option (no wave-1 caller) was rejected knowingly; the projection's
real consumers (.claude/skills SKILL.md files) arrive in the memory-routing wave, and the
wave-1 proof renders the qa judge-gate contract's own projection.

## 2026-08-13 — graduation shape (grill-with-docs)

**Question:** What graduates into `goals/` in this PR — just the spine goal, or later-wave
goals too?

**Answer:** One spine goal: `goals/skill-contract-kernel/` (kernel package + qa retrofit +
SKILL.md projection), graduated in the same PR as the exploration updates (operator request).
`MAP.md` names the later-wave candidates ungraduated; the exploration keeps `status=active`
as their home per the graduation contract's "keep active if candidates remain".

**Rationale:** Goals should be born ready to work; the four later waves have no briefs yet —
scaffolding them now would create empty shells violating the per-candidate definition-of-
ready. Rejected: graduating all five waves (names the program but ships four unready shells).

## 2026-08-24 — status flip to `graduated` (grill-with-docs)

**Question:** The packet stayed `active` after the spine graduated, citing the graduation
contract's "keep active if candidates remain" — does the contract actually say that?

**Answer:** No — flip to `graduated`. The graduation contract
(`explorations/README.md` §Graduation Contract, ratified 2026-08-13 via PR #693) says the
opposite: once all promised-now goals exist, flip the status; gated candidates remain in
`MAP.md` as re-entry points, and a fired gate reopens the exploration at `decompose`.

**Rationale:** The 2026-08-13 §graduation-shape entry above misquoted the contract in a
same-day race with its ratification. Repo precedent is 44-of-46 graduate-stage packets at
`graduated`. The deliberate hold recorded that day ("another clone is finishing it") expired
when PR #694 merged; no open PR touches the packet. Flipped at operator request, 2026-08-24.
The sole promised-now goal (`goals/skill-contract-kernel`) exists and remains unexecuted —
graduation records shape completion, not implementation.

## 2026-08-24 — kernel-goal drift corrections + receipt digest seam (grill-with-docs)

**Question:** Eleven days after scaffolding, do the kernel goal's premises still hold against
the repo, and how do its receipts sequence against `explorations/protocol-as-value`'s proposed
canonical-encoding/versioned-digest substrate?

**Answer:** Three citation drifts corrected in the goal `SPEC.md`: boundary failures use
`S.TaggedError` (the repo retired its `TaggedErrorClass` helper, commit `ec3bc91e63`); the
SKILL.md projection renders via `@beep/md` `render`/`renderUnsafe` (`DocumentToMarkdown` is
deprecated in their favor; still one-way, so the re-extraction scoping stands);
`ClaimGateResult` lives in `@beep/epistemic-domain` (the use-cases service returns it) — both
verdict precedents are read-only patterns, never dependencies. Acceptance parity now
enumerates the judge invariants (missing-event IDs, canonical-root/path-escape refusal,
file-only evidence refs, declared-round coherence, nonempty evidence per finding, P0/P1
`requiredCount` coherence). Digest seam: receipts bind subjects with today's digest types
plus an explicit migration seam; the kernel must not mint a competing canonical encoding.
P0 gains Effect rc.108→rc.111 `Tool`/`Toolkit` revalidation against `.repos/effect`.

**Rationale:** Keeps the goal born-ready instead of advertising retired APIs to its
implementer. Waiting for protocol-as-value was rejected (it is at `shape` with no MAP — an
unbounded block); leaving the digest question to P1 was rejected (invites exactly the
competing-encoding drift the premise check warned about). Waves 2/3/4/6 coordination with
protocol-as-value is recorded in `MAP.md` §Cross-packet coordination.
