# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets.
-->

## Problem

An agent action in this repo is authorized by nothing. A tool call reaches the
network, the filesystem, or a workspace file because the code path happened to
run — not because anything decided it was allowed, and not leaving any record
that it happened.

That gap is not theoretical. The 2025–2026 incident record
([`RESEARCH.md`](./RESEARCH.md) §4) is dominated by one shape: an agent composes
an individually-permitted **read** with an individually-permitted **sink** and
exfiltrates. GitHub MCP (broad token + public PR), Supabase (privileged read +
an ordinary permitted database write), EchoLeak (zero-click, the sink was a
renderer image fetch). Every leg passed its own check. Nothing evaluated the
composition, because nothing was responsible for it.

The repo's own position is worse than the general case. Verified by inventory
([`RESEARCH.md`](./RESEARCH.md) §6, §7): there is **no** authority-grant object,
**no** destination-aware egress anywhere, **no** OS isolation primitive of any
kind, **no** tamper-evident record, and **no** encryption/retention/legal-hold
infrastructure. There is one fail-closed gate (`TierGate`) with exactly one
consumer, and it generates an audit record on every gated call that is then
**discarded** on the approved path
(`packages/ontology/server/src/tools/OntologyToolHandlers.ts:~87`). Audit
generation exists; audit retention does not.

Why now: the packet was routed out of the corpus-mining dispatch with the
evidence already assembled, the composition seams are identified and verified,
and — as of the 2026-07-25 spike — **both enforcement mechanisms are proven to
work in this codebase**. The cost of the first slice is known rather than
guessed.

This is a legal-tech product holding attorney-client material. "We cannot say
what the agent was permitted to do, or show what it did" is not a gap we can
carry into a matter.

## Appetite

**One vertical slice, one composition root, eight independently landable PRs.**
The budget is spent on making *one* composition genuinely governed and recorded
— not on breadth. Explicitly, the appetite does **not** stretch to cover every
egress path in the repo; five are known-uncovered and are documented as such
rather than chased (see No-Gos).

The single-root constraint is doing real work. Every context-capturing
composition root needs its own policy wiring, and the app has two
(`RuntimeLive` and the MCP transport). Governing one means one gate, one policy
fetch, one config, one database, one freeze integration. Governing both would
buy the app's largest egress path — the model call — at the price of a second
run lifecycle on a path whose principal is still a fixture. That is the second
slice, and naming it as uncovered is more honest than classifying it as
infrastructure.

The one-slice budget shapes the rest of the design the same way:

- The ledger stores **only** hashes, opaque ids, policy revision, and typed
  outcomes — which conveniently removes any KMS, retention-clock, or
  crypto-shredding dependency from the critical path (all three are absent
  repo-wide, so building them would double the slice).
- Grants are evaluated **in-process** and never issued as a credential, which
  removes token minting, revocation propagation, and key custody.
- Host isolation — the thing most people mean by "sandbox" — is out. The slice
  buys the *policy plane and its records*, and the brief must never let a green
  first test read as "the sandbox exists."

## Solution Sketch

**A default-deny authority boundary: a grant that must exist before an action,
and a chained record proving what was decided.**

Four elements.

**1. The grant, and the audience axis.** A grant is an `effect/Schema` value —
principal, purpose, resource, operation, sink, budget, policy revision, expiry —
held only by the boundary. The agent never possesses a credential it could leak,
replay, or forward, which deletes an attack surface rather than securing one.
A sink is modeled as **(class, audience, destination)** so an outbound HTTP POST
and an MCP write are literally the same schema, differing only in `class`. Policy
keys on **audience**, never on transport, because the Supabase sink was an
ordinary write. Crucially, the destination→audience mapping is done by a
resolver, not by the caller — an agent cannot self-declare a friendly audience.

**2. The evaluator.** The third instance of the repo's blessed gate shape
(`ClaimGate`, then `TierGate`): `evaluate(request) => Effect<Verdict>`, error
channel `never`, refusal is a **value**, fail closed. Crucially it does not need
a new port — it is a different *implementation* of `TierGate`, the foundation
port `ontology/server` already consumes, so the governed slice and the governed
surface never import each other. Denial reasons are a **bounded literal domain,
never free text** — free text is a payload-smuggling channel into a no-payload
ledger — and they are never returned to the agent, only recorded, because a
differential denial reason is an oracle for reconstructing the grant set.

**3. Two governed sinks, one composition root.** Both live in the MCP transport
branch, so the whole boundary is assembled in one place.
- *MCP write*: `TierGate` dispatch. Its `evaluate` already runs **before** the
  wrapped effect, so the write-ahead decision point exists in the code today
  rather than needing a new seam.
- *Outbound HTTP*: a policy `fetch` provided as
  `Layer.succeed(FetchHttpClient.Fetch)(…)`. Proven 2026-07-25 to reach
  **through** drivers that seal their own transport — zero driver changes. It is
  also the only place that sees a destination URL, since the gate is
  deliberately parameter-blind; the two enforcement points are therefore
  complementary rather than redundant.

**4. The ledger, and what it honestly proves.** Two append-only tables —
decisions and outcomes — never updated in place. The decision is written
**before** the effect runs and fails closed: no record, no action. The outcome
is appended after. So "decided, outcome unknown" is a *derived* state (a
decision with no matching outcome) with **no storable representation** — a crash
between the two is visible by construction and unforgeable. Records chain by
hash per run. A hash proves correspondence and ordering only — never that an
action was authorized, truthful, or complete — and the spec must say so, because
the entire value of the record is that nobody over-reads it.

The composition claim is earned by **freezing the grant set before untrusted
content enters context** (Plan-Then-Execute). Expressed as a `Draft`/`Frozen`
type split, so widening after the freeze does not compile — not as a runtime
flag someone must remember to check.

## Rabbit Holes

- **Per-value taint propagation.** Tracking which privileged bytes reached which
  sink is the only thing that catches composition *precisely*, and it is the
  requirement with no portable prior art (Meta's Policy Zones is the industrial
  reference and it is enormous). Patched: the freeze gives a structural
  composition property at a fraction of the cost. Taint is a later tier.
- **The fixture with no host.** No tool in the repo performs outbound egress —
  `ontology_export_provenance` writes to a local path, and the live chat turn
  has exactly one tool (`respond`, forced, handler never runs). So the policy
  fetch would govern nothing that ships. Patched by
  `ontology_publish_provenance`, registered **only** when the destination
  allowlist is non-empty, so no ungoverned configuration of it exists. This
  patch is itself the packet's sharpest tension — it adds an exfiltration
  primitive to a product holding privileged material in order to demonstrate
  blocking exfiltration — and it deserves a deliberate re-read at implementation
  time rather than inheritance as settled.
- **Anchoring with no target.** Checkpoint digests, witness cosigning, RFC 3161
  timestamps: unresolved (registered as research debt in
  [`research/10-research-critique.md`](./research/10-research-critique.md)).
  Patched by cutting anchoring entirely — a data structure with no chosen
  verifier is not a guarantee.
- **The DB cannot express these constraints.** `EntitySchema.persist` has no
  CHECK/EXCLUDE/partial-index vocabulary, so immutability guards mean
  hand-authored SQL with knowingly-lossy ORM metadata — the same ceiling the
  bitemporal P0 hit. Patched by inheriting its precedent, including an Exception
  Ledger row. The migration splitter trap is narrower than feared (proven
  2026-07-25): the rule is "no `;` + newline + boundary keyword inside a
  function body," not "one line."
- **"No grant in scope" is the common case**, not an edge — layer-build HTTP,
  health probes, telemetry, loopback RPC. If this is left implicit, default-deny
  becomes whichever branch a future contributor lands in. Patched: three named
  outcomes (`governed-denied`, `governed-allowed`,
  `ungoverned-infrastructure`) where the infrastructure set is a **closed**
  literal domain whose exact membership a test asserts.
- **Telemetry recursion** — *eliminated by scope, not mitigated.* A ledger write
  emits a span, which exports, which is egress, which would check policy and
  write a ledger row. But `ObservabilityLive` is provided inside `RuntimeLive`,
  not at the process root, so the OTLP exporter never runs in the governed
  branch's context. The infrastructure-exemption set is consequently **empty**
  in slice 1 — kept as a closed literal domain with a test asserting exactly
  that, because an empty closed domain denies a future contributor the fail-open
  branch while a missing one invites it.
- **Ledger on the critical path.** Fail-closed write-ahead puts a database round
  trip in front of governed actions and makes the ledger a hard dependency.
  Bound the cost in the acceptance test so the first latency complaint is not
  misattributed.

## No-Gos

- **Host isolation.** No bubblewrap, Seatbelt, seccomp, Landlock, microVM, or
  resource ceilings (CPU/memory/process/fs). A compromised handler can reach
  around every seam here via `node:fs` or `node:child_process`. This is the
  packet's own later tier, and the first slice's success must not be described
  as a sandbox.
- **Credential custody.** Brokered through the
  `ingestion-security-secret-governance` vault candidates; this packet never
  holds secrets.
- **Certification / attestation.** The corpus supplies no validated thresholds;
  importing anyone's percentage or architecture ranking was ruled out at
  capture.
- **Payload storage of any kind.** Not "we won't" — the record schema must make
  it impossible, proven by a test that walks the persist descriptors and fails
  on any `jsonb`/`blob` or unconstrained `text` column.
- **Budget *enforcement*.** Carry and record the field; deny on nothing. Live
  token/cost accounting is a constant fixture today
  (`ChatOrchestrator.ts:225-250,373`), so a spend ceiling would be theatre.
- **Revocation infrastructure.** The policy revision is pinned as config and
  recorded; no revision store, no cache invalidation. Nothing revokes anything
  yet.
- **Cryptographic delegation.** The actor chain is recorded as data. No
  Biscuit/UCAN/token exchange until a real cross-process hop exists.
- **Uncovered egress paths, named rather than chased**: the **chat/Anthropic
  path** — the app's single largest outbound sink, deferred to the second slice
  with the request principal it needs; SDK-wrapping drivers (box, firecrawl,
  phoenix) that never touch `HttpClient`; raw `window.fetch` in
  `link-preview.tsx`; the renderer process generally; and `nlp-mcp`'s
  URL-loading stream tools, which live in a `drivers`-rooted process that may
  not import slices. These are enumerated in the spec as a tracked list so the
  boundary's edges are a stated artifact, not a discovery.
