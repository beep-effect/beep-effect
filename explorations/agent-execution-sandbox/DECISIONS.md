# Decisions

<!--
Stage 2. One dated entry per branch-closing question: Question / Answer /
Rationale, including the options rejected and why. Deferred questions are
logged DEFERRED with a reason, never silently dropped. Keep manifest
`openQuestions` in sync.
-->

## 2026-07-25 — Align decision 1: first action-authorization fixture (master align Q10)

**Question.** Which comes first as the action-authorization proof: privileged
read plus outbound sink, browser-to-terminal execution, citation-derived legal
action, or model-generated code?

**Answer.** Privileged read plus outbound sink.

**Rationale.** Three converging reasons from
[`RESEARCH.md`](./RESEARCH.md) §2/§4/§7:

1. It is the best-attested failure class in the 2025–2026 incident record —
   GitHub MCP (broad token + public PR sink), Supabase MCP (service_role read
   + attacker-visible database write as the sink), EchoLeak (renderer image
   fetch as an implicit sink). Every one composed an individually-permitted
   read with an individually-permitted sink.
2. It is the only seam **no packet in the repo owns**:
   `ingestion-security-secret-governance` owns ingress-side fetch of untrusted
   content; agent-initiated outbound sinks are unclaimed. The other three
   fixtures all overlap existing owners.
3. It is the smallest credible first slice, because both composition points
   already exist: generalize `TierGate`'s dispatch check from a flat
   tool-name allowlist to a named authority grant, and add destination policy
   at `api-transport`'s existing `transformClient` seam.

**Rejected.**

- *Browser-to-terminal execution* — strongest offensive corpus evidence and
  the ACP driver already exposes permission/terminal seams, but it cannot
  prove anything until the host-isolation tier (bubblewrap/Seatbelt +
  cgroups) exists; largest possible first slice.
- *Model-generated code* — richest portable prior art (srt, Codex CLI's
  Apache-2.0 SBPL/bwrap corpus), but the capture's own warning holds:
  starting here narrows "sandbox" to a code runner and misses the cross-tool
  authority composition where the incident evidence says failures actually
  occur.
- *Citation-derived legal action* — most product-specific consequence, but
  the approval vocabulary it depends on exists only in prose
  (`ApprovalDecision` is `LiteralKit(['pending'])` in code) and it entangles
  sandbox mechanics with attorney-authority policy design.

**Consequences to carry.** (a) This fixture proves *policy enforcement*, not a
*host boundary* — host isolation stays an explicit later tier, and the brief
must not let the fixture's success read as a sandbox. (b) The
`mcp-auth-gated-registration` `mcp-write-wall` collision is now live and must
be settled next: an MCP write is one plausible sink shape → resolved in
decision 2.

## 2026-07-25 — Align decision 2: absorb the `mcp-write-wall` candidate

**Question.** How does this packet settle the collision with
[`mcp-auth-gated-registration`](../mcp-auth-gated-registration/README.md),
whose sole remaining candidate is "a named MCP host exposes a genuinely
write-capable operation requiring candidate→approved enforcement and
end-to-end `UsageRecord.metadata` audit"?

**Answer.** Absorb it. The sandbox's sink vocabulary includes MCP writes as
one governed sink class alongside network egress, so satisfying the first
fixture also clears the write-wall trigger; `mcp-auth-gated-registration`
closes as superseded on that candidate rather than shipping it separately.

**Rationale.** The Supabase MCP incident
([`RESEARCH.md`](./RESEARCH.md) §4) is the argument: the exfiltration sink was
not network egress but an ordinary permitted **write** to a lower-trust-visible
resource. Splitting network sinks from write sinks across two packets
re-creates precisely the composition blind spot this packet exists to close —
sinks must be classified by *audience*, not by protocol, and that
classification cannot live in two owners. Absorption also fixes the concrete
defect the write-wall correctly identified: `TierGateAuditRecord` is generated
for every gated call but persisted nowhere
(`packages/ontology/server/src/tools/OntologyToolHandlers.ts:87` discards the
approved-path record), which is the same audit-retention gap the sandbox's
execution ledger must close anyway.

**Rejected.**

- *Keep separate, write-wall ships first* — cleaner packet boundaries and a
  smaller first PR, but it puts the sandbox's first fixture on another
  packet's schedule and the two would still have to agree on the grant and
  audit shapes, i.e. the coupling survives without the benefit.
- *Sandbox picks a non-MCP sink (outbound HTTP only)* — avoids the collision
  entirely, but the fixture would then never exercise the audience-classified
  write sink that the incident evidence names as the dangerous one, proving
  the narrower half.

**Consequences to carry.** (a) The first slice must cover at least two sink
classes — an outbound HTTP destination and an MCP write — so the audience
classification is exercised, not asserted. (b) Audit persistence moves from
"consumer-side, unwired" to in-scope for this packet. (c)
`explorations/mcp-auth-gated-registration` needs a dated Trail note and status
flip once this packet's brief names the absorbing slice.

## 2026-07-25 — Align decision 3: grants are schema-native and in-process; no bearer credential

**Question.** What form does an authority grant take — and therefore, does the
agent ever *hold* a credential, and what does revocation cost?

**Answer.** A grant is an `effect/Schema` value (principal, purpose, resource,
operation, sink, budget, policy revision, expiry) held only by the boundary.
The agent never possesses a credential it could replay, leak, or forward.
Revocation is an immediate consequence of the evaluator reading the current
policy revision. Delegation lineage is recorded as **data** — `AgentPrincipal`
with its required `onBehalfOfUserId`, plus an RFC 8693-style nested actor
chain — not as cryptographic attenuation. Capability tokens (Biscuit/UCAN) are
deferred until a genuine cross-process or cross-trust-domain hop exists.

**Rationale.** Three findings converge
([`RESEARCH.md`](./RESEARCH.md) §3):

1. Revocation is the structural weakness of offline-verifiable tokens — UCAN's
   own sub-spec calls it eventually consistent and "the last line of defense."
   Since this design already requires an online policy check at sink time
   (pinned to a named policy revision, per the Zanzibar new-enemy analysis),
   an offline-verifiable token buys a property we would immediately override.
2. Not issuing a credential removes an entire attack surface rather than
   securing one: there is no token for a prompt-injected agent to exfiltrate,
   replay, or forward — the structural analogue of proxy-side credential
   injection, where the privileged material lives only at the boundary.
3. Fly.io's production report is that community macaroon implementations chose
   untyped opaque caveat blobs and they rebuilt typed caveats from scratch.
   In this repo the typed language already exists (`effect/Schema`,
   `LiteralKit`), and the evaluator becomes the third instance of the blessed
   `ClaimGate` shape — refusal-as-value, error channel never, fail closed.

**Rejected.**

- *Biscuit tokens from day one* — real ocap attenuation and delegation that
  survive process boundaries, but pays a WASM boundary plus a Datalog caveat
  language beside `effect/Schema`, and its revocation is still
  eventually-consistent so the online check stays regardless.
- *Cedar as the policy engine, grants as Cedar entities* — the strongest
  off-the-shelf PDP (default-deny, forbid-wins, Lean-verified, TS via WASM,
  structured decisions), but it introduces a second policy language and the
  purpose/budget/sink dimensions still need hand-encoding as attributes.
  Keep it as the named escalation path if the in-house evaluator's policy
  surface outgrows schema expression, and copy cedar-spec's
  differential-testing assurance pattern regardless.

**Consequences to carry.** (a) Grant validity is evaluated per invocation
against a policy revision, so the revision identifier is load-bearing in both
the grant and the execution record. (b) When a cross-trust-domain hop appears
(MCP forbids token passthrough — every hop needs its own re-audienced
credential), that is a *new* decision, not an extension of this one; the
delegation lineage recorded as data is what makes the later token shape
derivable. (c) The grant schema is a shared-kernel promotion candidate
(`shared-domain`, next to `ClaimLifecycle`) so other verticals can type
against it without importing the sandbox.

## 2026-07-25 — Align decision 4: v1 ledger is the tamper-evident class only

**Question.** Which execution data stays exact and immutable, and what happens
to secret-bearing data — given that the repo has **no** encryption-at-rest,
KMS, retention-clock, or legal-hold infrastructure of any kind
([`RESEARCH.md`](./RESEARCH.md) §6)?

**Answer.** v1 persists exactly one class: hashes, opaque
principal/purpose/grant identifiers, policy revision, and typed outcomes —
append-only, Merkle-chained, with checkpoint digests anchored into a second
trust domain. Secret-bearing payloads are **committed-to, never embedded**.
The crypto-shred payload class (per-matter DEKs, key destruction as erasure,
legal hold freezing destruction) is a later slice, sequenced with the
`ingestion-security-secret-governance` vault candidates.

**Rationale.** Sigstore's own privacy retrospective is the rule taken to its
conclusion: anything placed in an append-only log is effectively unerasable,
and a signer comfortable with disclosure today cannot retract it later. For a
product holding attorney-client material that is disqualifying, so the
cheapest correct answer is to have nothing to erase. This also removes a
greenfield KMS + retention-clock build from the critical path of the first
slice — the research confirmed both are absent repo-wide, so building them
inside this packet would double its scope and couple it to another packet's
schedule. Hash-commitment per field additionally yields Merkle-style selective
disclosure for free, which is what redactable-signature schemes promise but
have not productionized.

**Rejected.**

- *Build both classes in v1* — the complete SOC 2 C1.2 / FRCP 37(e) story, but
  it makes a greenfield KMS and retention service hard dependencies of the
  first slice and entangles this packet with the vault packet before either
  has shipped anything.
- *Extend `UsageRecord` rows now, add tamper-evidence later* — fastest, and it
  would close the TierGate audit-persistence gap immediately, but
  `UsageRecord` rows are mutable `BaseEntity` rows, so v1 would ship an
  "execution record" with no immutability property — abandoning the packet's
  central claim in its first proof.

**Consequences to carry.** (a) Anything the ledger cannot represent as a hash,
an opaque identifier, or a typed outcome is *out of the ledger* — the record
schema must make embedding a payload impossible by construction, not by
convention. (b) Correlation to human-readable material happens through the
existing `Activity`/`Turn` trace and `UsageRecord`, which stay the mutable,
erasable side of the boundary. (c) A hash proves correspondence only — not
truth, authorization, completeness, or retention (capture's axiom, confirmed
by CT/Rekor's own framing); the brief must state this so the ledger is never
read as proof that an action was permitted. (d) Reuse the bitemporal
half-open-interval + supersession-lineage idiom from
`goals/epistemic-bitemporal-edge-core` rather than inventing a second
immutability model — but execution events must not become beliefs merely
because they are immutable. (e) Anchoring target (witness cosigning vs an
RFC 3161 / eIDAS timestamp authority, which courts already accept) stays open
as registered research debt for shape.

## 2026-07-25 — Align decision 5: ownership seams (own two of five)

**Question.** Where do the ownership seams fall among policy decision, host
isolation, credential brokering, execution records, and independent
certification? (Capture's own worry: all five in one "sandbox service" smells
like a future monolith.)

**Answer.** This packet owns **two**: the authority-grant / policy-decision
layer, and the execution-record ledger. **Credential brokering** stays with
the `ingestion-security-secret-governance` vault candidates — the sandbox
brokers *through* it and never takes custody. **Host isolation** is a named
later tier *of this packet*, not a sibling packet. **Certification /
attestation** is deferred entirely.

**Rationale.** The two claimed responsibilities are precisely what the chosen
first fixture proves (decision 1) and precisely what the verified seam map
shows is unclaimed by anyone
([`RESEARCH.md`](./RESEARCH.md) §7): the grant object, revocation, and the
tamper-evident ledger have no owner and no code. Credential custody, by
contrast, already has a ratified ownership model in the sibling packet, and
duplicating it would create the confused-deputy pattern the MCP security
literature names directly. Host isolation stays inside this packet because
the unanimous prior-art finding is that grants in the Effect layer *cannot
self-enforce* — splitting the policy plane from its enforcement boundary
across two owners would let a "sandbox" ship with no boundary and no one
accountable for the gap. Certification is deferred because the corpus
supplies no validated thresholds — importing anyone's percentage or ranking
was ruled out at capture.

**Rejected.**

- *Own all five* — no seam negotiation and the read-plus-sink composition
  genuinely spans all of them, but it is the monolith capture warned about and
  it strips credential custody from a packet that already ratified a model for
  it.
- *Own policy decision only; records to the epistemic packet* — cleanest reuse
  of the bitemporal substrate, but it splits a grant from its own audit record
  across two owners and schedules, and the bitemporal P1 has not landed.

**Consequences to carry.** (a) The `agent-governance-control-plane` seam is
now settled from this side: that packet owns the governance protocol (roles,
gated lifecycles, blockers, exceptions); this packet owns concrete execution
authority and its records. It should get a dated note. (b) Host isolation
being a later tier of this packet means the brief must sequence it explicitly
and must not let the first fixture's success read as "the sandbox exists."
(c) The sandbox consumes, and never re-decides, four upstream verdicts:
`safeForPrompt` (prompt admission), human disposition (approval), model
admission (`model-artifact-admission`), and validator findings — each an
independent input, none of them action authorization.

## 2026-07-25 — Align decision 6: the grant schema lives in the epistemic slice

**Question.** Which package owns the authority-grant schema and its evaluator?

**Answer.** `packages/epistemic/domain` (alongside `ClaimGate`, `UsageRecord`,
and `Activity`), with **all enforcement wired at the app composition root**.
Promotion to `shared/domain` waits for a real second consumer and a real
promotion record.

**Rationale.** Design review found the obvious homes are closed:
`standards/ARCHITECTURE.md:563-615,616-642` forbids `foundation/*` from
depending on the shared kernel or any slice, and a grant embeds `Principal` —
so `foundation/capability` cannot host it, which retires the earlier
"generalize TierGate in place" instinct. Slice-to-slice imports are equally
forbidden, so a grant in `epistemic/domain` is invisible to
`packages/ontology/server`. The resolution is to keep the vocabulary
slice-local and put enforcement where cross-package composition is explicitly
legal — the app entrypoint (`ARCHITECTURE.md:280-283`). This costs nothing at
the acceptance-test boundary: `ontology-mcp-http.test.ts` already decodes
refusals from `call.structuredContent`, and a boundary-produced
`CallToolResult` decodes identically.

**Rejected.** *`shared/domain/src/values/GovernedRun/` now* — matches decision
3(c)'s stated promotion target and reads naturally beside `ClaimLifecycle`, but
it spends shared-kernel budget in the first slice and needs a promotion record
on day one. `ClaimLifecycle`'s own record was written with its second consumer
not yet landed and an adversarial review flagged exactly that; repeating it
knowingly is worse than deferring.

**Consequences to carry.** (a) The MCP refusal is produced at the transport
boundary, not inside the tool's declared `failure` union — note this in the
spec so the shape is not mistaken for a defect. (b) Decision 3(c) is amended:
`shared/domain` is the *eventual* home, not the starting one, and the
promotion trigger is a second slice needing the vocabulary. (c) The evaluator
is still the third instance of the `ClaimGate` shape (refusal-as-value, error
channel `never`), just hosted in the epistemic slice rather than foundation.

## 2026-07-25 — Shape decision 7: the evaluator implements the existing `TierGate` port

**Question.** If the grant schema lives in `epistemic/domain` and
`foundation/*` may not import slices, where does the grant-aware evaluator
actually live — and what does `ontology/server` have to learn?

**Answer.** `epistemic/server` implements `@beep/mcp-kit`'s **existing**
`TierGateShape` and exports a ready-made layer. The app entrypoint swaps one
line at `apps/professional-desktop/server/OntologyMcpTransport.ts:111`.
`ontology/server` keeps `yield* TierGate` and never learns that epistemic
exists. `mcp-kit`'s evaluation contract does not change.

**Rationale.** `packages/foundation/capability/mcp-kit/package.json` declares
`beep.family = "foundation"`, and `standards/ARCHITECTURE.md:640-641` forbids
foundation depending on product slices *or* the shared kernel. So "generalize
`TierGate` in place to accept grants" cannot compile under *either* candidate
grant home — the constraint is not specific to decision 6. But `TierGate` is
already a `Context.Service` over a one-function shape
(`TierGate.ts:263-304`), and the app already supplies its implementation via
`Layer.succeed(TierGate)(TierGate.of(fromApprovedToolsPolicy(...)))`. A
grant-aware evaluator is therefore a *different implementation of an existing
interface*, which is dependency inversion through a foundation-owned port —
the shape the architecture already wants. `ARCHITECTURE.md:623-624` permits a
slice `server` package to import `foundation/capability`, and
`ARCHITECTURE.md:278-281` blesses app-entrypoint composition.

Two properties fall out for free. `dispatchWithTierGate`
(`TierGate.ts:507-517`) calls `gate.evaluate` **before** running the wrapped
effect, which is exactly the write-ahead decision point — no new seam is
needed. And `evaluate`'s error channel is already `never` with refusal as a
value, so "ledger write failed ⇒ refuse" is expressible without touching the
contract.

**Rejected.**

- *Assemble the evaluator inline at the app entrypoint* — legal, but
  `standards/architecture/05-layer-composition.md` steers explicitly away from
  it ("the entrypoint … should not need to know every concept-level repository
  and driver inside the slice"). Policy logic in composition code is how an
  entrypoint becomes a registry.
- *Parameterize `TierGateShape` over an opaque policy type* — keeps foundation
  legal, but it is churn across a package with one consumer and buys nothing
  the service tag does not already provide; the grant still has to be injected
  from outside.

**Consequences to carry.** (a) **This supersedes decision 6's consequence (a).**
Because `ontology/server` keeps its existing `gatedMutation` mapping
(`OntologyToolHandlers.ts:86-95`), the refusal stays *inside* the tool's
declared `failure` union — it is not produced at the transport boundary. The
spec should say so, since decision 6 predicted the opposite. (b) `mcp-kit`
gains no product vocabulary, so its foundation admission stays intact. (c) The
mechanism itself is unnamed in the architecture docs → decision 14.

## 2026-07-25 — Shape decision 8: `recordOutcome` joins the `TierGate` port

**Question.** The decision row writes itself inside `evaluate`, but nothing can
write the **outcome** row for the MCP sink. Where does the second append-only
record come from?

**Answer.** A second, domain-neutral member on `TierGateShape`:
`recordOutcome(audit, settlement)`, called by `dispatchWithTierGate` via
`Effect.onExit` after the wrapped effect settles. `settlement` is a bounded
literal (`completed` / `failed` / `interrupted`), never an `Exit`.
`fromApprovedToolsPolicy` returns `recordOutcome: () => Effect.void`.

**Rationale.** `dispatchWithTierGate` returns `Dispatched({ value, audit })`
and `OntologyToolHandlers.ts:87` maps it straight to `value`; there is no
post-effect hook, and `ontology/server` cannot supply one because reaching
epistemic would be a slice-to-slice import. Putting the hook on the service
places it in the **same call frame** as `evaluate`, so decision→outcome
correlation is direct — no correlation id, no ambient state. Taking a bounded
settlement literal rather than an `Exit` means no payload can reach the ledger
by construction, which is decision 4's no-payload rule enforced at the
foundation boundary rather than trusted downstream.

**Rejected.**

- *A `wrapDispatch` middleware on `sanitizedToolkit`* — covers every tool
  including read-only ones and is a capability `mcp-kit` legitimately owns, but
  it runs *outside* the gate frame, so pairing an outcome to its decision needs
  a correlation id on ambient request context — the exact context
  `SanitizedSpan.ts:226,264` captures at layer-build time and re-provides with
  provided-wins semantics.
- *No MCP outcome rows in v1* — zero foundation change, but "decided, outcome
  unknown" becomes a normal steady state for MCP calls, so a crash is no longer
  distinguishable from ordinary operation and decision 4's derived-state
  argument collapses for half the sinks.

**Consequences to carry.** (a) This is the one change to `mcp-kit`'s contract;
it is additive and carries no product semantics. (b) An outcome-write failure
cannot fail the dispatch (the effect has already run), so it is logged, not
raised — the spec must say that "decided, outcome unknown" therefore signals
*either* a crash or an outcome-write failure, not a crash alone. (c) **A refused
dispatch produces no outcome row.** `dispatchWithTierGate` runs `onApproved`
only on the approved branch, so `Effect.onExit` never fires on a refusal — and
that is correct, since there is no execution to report. The consequence is that
the derived-unknown predicate must be **scoped to allowed decisions**
(`verdict = 'allowed' AND outcome IS NULL`); an unscoped `LEFT JOIN` would
classify every ordinary denial as "outcome unknown" and destroy the property
decision 4 relies on. A denial's decision row is a complete record by
construction, so row counts are **one per denied dispatch and two per allowed
dispatch** — not two uniformly.

## 2026-07-25 — Shape decision 9: slice 1 governs the MCP branch only

**Question.** How much of the app's real outbound traffic does the first slice
govern — specifically, what happens to the Anthropic chat egress?

**Answer.** The MCP branch only. The policy `Fetch` is merged into
`makeOntologyMcpTransportLayer` alongside the governed gate, the ledger, and
`PgliteDrizzleLive`. `apps/professional-desktop/src/runtime/Layer.ts` is not
touched. The chat/Anthropic path is named as **uncovered**, not governed.

**Rationale.** The 2026-07-25 spike proved the `Fetch` override reaches sealed
clients for a *directly provided* effect. It did not prove it through a server
whose handler context is captured at layer build — and both
`SanitizedSpan.ts:226` and the `RuntimeLive`/MCP split mean there are **two**
context-capturing composition roots, not one. "One layer entry" is true only if
slice 1 governs one root. Choosing the MCP root makes the entire slice a single
composition root: one gate, one policy fetch, one config, one DB, one freeze
integration, one PR sequence.

Governing Anthropic instead would require opening a run on the chat path
(freeze at `ChatOrchestrator.streamAndPersist:288`, above the timeline read at
`:317`) — a second run lifecycle against a path whose principal is still the
`SYSTEM_PRINCIPAL` fixture (`ChatOrchestrator.ts:210`, commented "the
not-yet-wired request principal"). That is a second integration bought with the
first slice's budget.

**Rejected.**

- *Process-wide with Anthropic governed* — the largest real coverage, since the
  model call genuinely ships the whole thread to a third party. Deferred, not
  dismissed: it is the natural second slice once the request principal lands.
- *Process-wide with Anthropic classified as infrastructure* — keeps chat
  working at no cost, but names the app's single largest egress path as
  not-governed inside the very artifact claiming a governed boundary. That is a
  worse lie than an honest uncovered list.

**Consequences to carry.** (a) The chat path joins the named-uncovered list in
the spec. (b) The chat-path freeze, budget enforcement
(`maxRetries`/`maxModelCalls` against the `BlockRepair` retry tail), and
child-run attenuation are all downstream of the chat path and leave slice-1
scope with it. (c) **Telemetry recursion is eliminated, not mitigated**:
`ObservabilityLive` is provided inside `RuntimeLive`
(`apps/professional-desktop/src/runtime/Layer.ts:263`), not at `Main`, so the
OTLP exporter never runs in the MCP branch's context. The
`ungoverned-infrastructure` set is empty in slice 1 — keep it as a *closed*
literal domain with a test asserting membership is exactly empty, because an
empty closed domain denies a future contributor the fail-open branch while a
missing one invites it. (d) The anti-vacuity guard changes from "a request
through `AnthropicLive`'s sealed client hits the stub" to "a request issued
from inside a real tool handler hits the policy fetch."

## 2026-07-25 — Shape decision 10: a run is an MCP session, keyed by `clientId`

**Question.** What is a "run" at the MCP sink — what is the grant set frozen
against?

**Answer.** One MCP session. The grant set is frozen once, on the session's
first dispatch, and reused for every subsequent `tools/call` on that session.
The run store is keyed by the `clientId` that arrives per request via
`CurrentMcpCaller`.

**Rationale.** If grants are recomputed per tool call, the freeze is vacuous:
tool 1 reading poisoned content and tool 2 exfiltrating become two unrelated
evaluations with nothing binding them, and increment 6 cannot demonstrate
composition at all. `clientId` is a stable session key — `McpServer.ts:1516-1521`
resolves `clientSessions` by it and `initializedClients` persists across calls
— so a run can legitimately span multiple dispatches.

The keying choice also dissolves a constraint rather than working around it.
Because `clientId` is delivered per request at `SanitizedSpan.ts:255-259`, the
run store can be an ordinary **build-time** service: the map lives in the
captured `services` context and the key arrives with the request. No per-request
context propagation is required, so `SanitizedSpan.ts:226/264`'s context erasure
— previously logged as a blocking constraint — stops being relevant to this
design.

**Rejected.**

- *Run = one `tools/call`* — simplest lifecycle and a trivially correct
  per-call chain, but the grant set would be computed *after* the poisoned
  content returned, making `Draft`/`Frozen` a tagged union with no observable
  consequence.
- *An explicit `ontology_open_run` tool* — self-documenting and easy to test,
  but it adds a protocol concept every agent must know, and an agent that skips
  it either runs ungoverned or is denied fail-closed, which would break the six
  read-only tools shipping today.

**Consequences to carry.** (a) Grants in v1 derive only from session-static
inputs (config, policy revision, caller identity) — never from tool output,
which is what makes the freeze sound. (b) The property the fixture demonstrates
is therefore **destination-scoped authority plus resolver-owned audience
classification**, with the freeze guaranteeing the allowed-destination set
predates the content that tries to change it. Say this precisely in the spec;
"the freeze stopped it" alone overclaims. (c) Run lifetime is bounded by the
client session, so the store needs eviction tied to the client's lifecycle.

## 2026-07-25 — Shape decision 11: policy config lives in a new `epistemic/config`

**Question.** Where do the destination allowlist, audience map, and pinned
policy revision live as typed configuration?

**Answer.** A new `packages/epistemic/config`, in the canonical slice-config
shape (`ServerConfig.ts`, `Layer.ts`, `TestLayer.ts`, with `/server` and
`/test` subpaths). The existing ad-hoc entrypoint config reads are migrated
onto it in the same PR.

**Rationale.** The slice that owns execution authority (decision 6) owns its
policy inputs. `standards/architecture/06-configuration-boundaries.md` sets the
test — create a config package "when the slice has meaningful runtime or
application configuration contracts" — which a destination allowlist, an
audience map, and a pinned policy revision plainly satisfy. The same doc marks
existing env-shaped code as transitional compatibility and requires cleaning
the boundary toward typed contracts **when it is touched**;
`apps/professional-desktop/server/main.ts:53-56` reads
`ONTOLOGY_MCP_MUTATIONS_ENABLED` and the approved-tools list via
`Effect.runSync(Config.boolean(...))` at module top level, and this work touches
exactly that boundary.

**Rejected.**

- *Reuse `packages/ontology/config`* — it already exists and the governed
  surface is the ontology MCP transport, but audience, grant, and policy
  revision are epistemic vocabulary; parking them there means renaming a concept
  in epistemic forces an edit in ontology.
- *App-entrypoint `Config` reads beside the existing ones* — zero new packages
  and consistent with what ships today, but it extends the transitional pattern
  at the precise boundary doctrine says to clean, and puts a security policy's
  source of truth in untyped entrypoint code with no schema and no test layer.

**Consequences to carry.** (a) This knowingly overrides the earlier "no new
package in this slice" scope cut, which predates decision 6 assigning epistemic
ownership. (b) A `TestLayer` for fixture grants is a deliverable, not an
afterthought — the acceptance test needs deterministic grants.

## 2026-07-25 — Shape decision 12: `ontology_publish_provenance` ships default-off

**Question.** What does the governed outbound sink actually dispatch — a real
product tool, or test-only scaffolding?

**Answer.** A real tool, `ontology_publish_provenance`, in
`ontology/use-cases` + `ontology/server`, **registered only when the destination
allowlist is non-empty**. The tool and its control ship in the same PR.

**Rationale.** Under decision 9 the MCP branch is the only governed root, and no
ontology tool performs egress today — `ExportProvenanceTool`
(`OntologyToolkit.ts:777`) writes to a local path, so its sink is a file. With
no agent-reachable outbound tool, the policy `Fetch` would govern nothing that
ships. Making the allowlist the *enablement condition* means no ungoverned
configuration of the tool exists: the tool cannot be registered without an
allowlist, and the allowlist cannot be honored without the policy fetch. The
repo already has this exact pattern — `ontology_propose_change_batch` ships
behind `mutationsEnabled` and is registered only when the flag is on
(`OntologyMcpTransport.ts:117`).

**Named tension.** This adds an agent-controllable outbound POST of workspace
content to a product holding attorney-client material, in order to demonstrate
blocking agent-controlled exfiltration — an exfiltration primitive shipped to
justify its own control. Default-off registration and allowlist-gated
enablement are what make it defensible, not the demonstration value. This PR's
scope deserves a deliberate re-read before it lands rather than being inherited
as settled.

**Rejected.**

- *A test-only egress toolkit* — zero product attack surface, and the boundary
  would still govern any future egress tool by construction. But increment 6's
  claim would be proven only against a tool that does not ship, and production
  egress coverage in slice 1 would be zero.
- *Add a `publishTo` URL to `ontology_export_provenance`* — smallest new
  surface, but it fuses local-write and network-egress semantics into one tool,
  so `audience` stops being legible from tool identity and starts depending on
  which optional parameter the caller passed.

**Consequences to carry.** (a) Never ship the sink before its control — the
tool, the policy fetch, and the allowlist land together. (b) The handler
requires `HttpClient.HttpClient` and must never self-provide it, or the policy
`Fetch` reference will not apply.

## 2026-07-25 — Shape decision 13: a denial reaches the agent reason-free

**Question.** How much does the agent learn about *why* an egress was denied?

**Answer.** Nothing beyond "refused by policy." `EgressDenied` is a reason-free
tagged error in `@beep/api-transport`. The bounded `DenialReason` stays in
`epistemic/domain` and goes only to the ledger and the server log.

**Rationale.** Two independent arguments land on the same answer. Structurally,
`epistemic/domain` may import only `foundation/primitive` and
`foundation/modeling`, never `capability` (`ARCHITECTURE.md:621-624`) — so a
reason carried across the foundation boundary would force `DenialReason` out of
the domain and into foundation, putting policy vocabulary in a
product-neutral family. On security grounds, a differential reason is an oracle:
an agent that learns *why* each destination failed can reconstruct the grant set
by enumeration. Operators lose nothing — the ledger and the server log carry
full detail; only the agent is kept in the dark, which is the right party.

`@beep/api-transport` is the marker's home: an existing `foundation/capability`
package whose charter is already "shared hand-authored HTTP transport
transformer," importable by both slices. This is distinct from the
`transformClient` seam this packet rejected as an enforcement point — the
package is being used as vocabulary, not as the seam.

**Rejected.**

- *Carry the full bounded reason* — best developer experience, but it relocates
  `DenialReason` to `foundation/modeling` and hands an attacker a probe oracle.
- *A coarse public reason distinct from the ledger reason* — usable refusals
  without fine-grained enumeration, but it means two vocabularies with a
  totality test between them, and the public one still leaks policy shape.

**Consequences to carry.** (a) The refusal path is: policy fetch rejects with
`EgressDenied` → `HttpClient` wraps it as `TransportError` carrying that cause →
the ontology handler matches the cause and returns a typed refusal through the
existing `failureMode: "return"` envelope (`OntologyToolkit.ts:652`). (b) The
policy function must write its own typed refusal to the ledger — **never** infer
a denial from the caller's error, since a transport failure and a policy denial
are indistinguishable downstream by design. (c) DX cost is real and accepted:
a developer debugging a blocked publish must read the server log.

## 2026-07-25 — Shape decision 14: record foundation-mediated port inversion as doctrine

**Question.** `ontology/server` consuming a port that `epistemic/server`
implements is legal but unnamed. Does it get written down?

**Answer.** Yes — a dated entry in
`standards/architecture/DECISIONS.md` naming **foundation-mediated port
inversion** as a third legal cross-slice mechanism beside emitted events and the
future `shared/use-cases`, with explicit admission conditions, cross-referenced
from `standards/architecture/10-cross-slice-coordination.md`.

**Rationale.** `10-cross-slice-coordination.md` governs cross-slice *product*
coordination — one slice's process invoking another's language (`:20,83`) — and
names two legal mechanisms. What decision 7 builds is neither: `ontology/server`
calls a foundation port carrying zero epistemic vocabulary, `epistemic/server`
implements it, and the app entrypoint binds them. Neither slice imports or names
the other. It is legal under existing rules (`ARCHITECTURE.md:623-624`,
`:278-281`), but a reviewer applying `10`'s two-mechanism list reasonably reads
it as a slice-boundary breach. The pattern will recur for any slice-owned policy
applied to another slice's surface, and it is expensive to reverse once ports
proliferate — if it were later banned, every such binding would have to be
rewritten as events, which cannot express a synchronous fail-closed gate anyway.

**Rejected.**

- *Package README consumer records only* — durable proof of the specific
  coupling at the surface that owns it, but the general rule stays unwritten and
  the next case re-litigates it. (Do this **as well**, not instead.)
- *No doctrine change* — nothing is technically missing from the docs, but the
  reasoning would live in a goal packet that gets archived, leaving the next
  reviewer to rederive why this is not a breach.

**Consequences to carry.** (a) Admission conditions must be stated as a
conjunction: the port carries no product semantics, lives in `foundation/*`,
both slices import only foundation, binding happens at an app entrypoint, and
neither slice names the other. (b) `mcp-kit` and `api-transport` each also get a
README consumer record naming the producer/consumer pair. (c) This is the only
architecture-wide doctrine change the packet produces; everything else is
slice-local.
