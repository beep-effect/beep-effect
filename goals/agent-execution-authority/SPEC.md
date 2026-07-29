# Agent Execution Authority Spec

## Objective

A default-deny authority boundary over the MCP agent surface of the
professional-desktop sidecar, with a hash-chained, append-only record of every
decision and outcome.

Observable end state: an MCP agent operates under a grant set frozen on its first
governed dispatch and reused for the rest of the session. Every tool dispatch is
decided before it runs and the decision is durably recorded **before** the effect
executes — no record, no action. An outbound publish to a destination outside the
session's grants is refused, and the refusal reaches the agent as a typed value,
not an exception. Reading the two ledger tables afterwards reconstructs exactly
what was decided, in what order, with a hash chain that fails verification at the
index of any **altered** row.

*(Corrected at closeout: the freeze point is the first governed dispatch, not
session open — read-only and idle time do not consume the grant TTL. And the
chain detects alteration, not truncation: a resealed tail or a deleted suffix
still verifies intact, because nothing anchors the tip. Tip anchoring is the
`agent-execution-record-anchoring` candidate, a stated non-goal below. Outcome
rows bind to their decisions individually and are not part of the decision
chain.)*

Deliberately **not** a sandbox in the host-isolation sense. This packet buys the
policy plane and its records. A green acceptance suite here must never be
described as "the sandbox exists."

Source exploration: [`explorations/agent-execution-sandbox`](../../explorations/agent-execution-sandbox/README.md)
— see its [`BRIEF.md`](../../explorations/agent-execution-sandbox/BRIEF.md) and
[`MAP.md`](../../explorations/agent-execution-sandbox/MAP.md).

## Non-Goals

Seeded from the brief's No-Gos. Each is out of scope for this packet, not out of
scope forever.

- **Host isolation of any kind.** No bubblewrap, Seatbelt, seccomp, Landlock,
  microVM, or resource ceilings (CPU/memory/process/fs). A compromised handler
  can reach around every seam here via `node:fs` or `node:child_process`. This
  is the `agent-execution-host-isolation` candidate.
- **The chat/Anthropic egress path** — the app's single largest outbound sink.
  Deferred to `agent-execution-chat-egress` because its principal is still the
  `SYSTEM_PRINCIPAL` fixture (`ChatOrchestrator.ts:210`). Governing a sink whose
  subject is a fixture would record authority decisions about nobody.
- **Credential custody.** Brokered through the
  `ingestion-security-secret-governance` vault candidates; this packet never
  holds secrets.
- **Certification / attestation.** The corpus supplies no validated thresholds.
- **Payload storage of any kind.** Not "we won't" — the record schema must make
  it impossible, proven by a test.
- **Budget *enforcement*.** Carry and record the field; deny on nothing. Live
  token/cost accounting is a constant fixture today
  (`ChatOrchestrator.ts:225-250,373`), so a spend ceiling would be theatre.
- **Revocation infrastructure.** Policy revision is pinned as config and
  recorded; no revision store, no cache invalidation.
- **Cryptographic delegation.** The actor chain is recorded as data. No
  Biscuit/UCAN/token exchange until a real cross-process hop exists.
- **Checkpoint anchoring.** A data structure with no chosen verifier is not a
  guarantee. This is the `agent-execution-record-anchoring` candidate.
- **Child-run attenuation.** No producer and no consumer in this slice.
- **Per-value taint propagation.** The only thing that catches composition
  precisely, and the requirement with no portable prior art.

### Uncovered egress paths, named rather than chased

These remain ungoverned after this packet ships. They are a stated artifact so
the boundary's edges are known, not discovered:

1. The chat/Anthropic path (see above).
2. SDK-wrapping drivers (box, firecrawl, phoenix) that never touch `HttpClient`.
3. Raw `window.fetch` in `link-preview.tsx`.
4. The renderer process generally.
5. `nlp-mcp`'s URL-loading stream tools (`stream_load_text`,
   `stream_load_jsonl`) — a real agent-reachable fetch, but in a
   `drivers`-rooted process that may not import slices.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards — `standards/ARCHITECTURE.md` and
   `standards/architecture/{01,02,03,05,06,08,09,10}-*.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

| Surface | Change |
| --- | --- |
| `packages/epistemic/domain` | Grant, sink, audience, `DenialReason`, decision/outcome record schemas |
| `packages/epistemic/config` | **New package.** Destination allowlist, audience map, pinned policy revision |
| `packages/epistemic/tables` | Two insert-only ledger tables |
| `packages/epistemic/use-cases` | Ledger port, beside `ClaimGate.ports.ts` |
| `packages/epistemic/server` | `GovernedTierGateLive`, Drizzle ledger adapter, run store |
| `packages/foundation/capability/mcp-kit` | `recordOutcome` on `TierGateShape`; README consumer record |
| `packages/foundation/capability/api-transport` | `EgressDenied` marker; README consumer record |
| `packages/ontology/use-cases`, `packages/ontology/server` | `ontology_publish_provenance` tool + handler |
| `apps/professional-desktop/server` | Composition-root wiring; entrypoint config cleanup |
| `apps/professional-desktop/test/integration` | Acceptance test |
| `standards/architecture/DECISIONS.md`, `10-cross-slice-coordination.md` | Foundation-mediated port inversion |

## Constraints

Seeded from the brief's Rabbit Holes plus the 2026-07-25 doctrine findings.

### Architecture

- **`foundation/*` may not depend on product slices or the shared kernel**
  (`ARCHITECTURE.md:640-641`). The grant type never enters `mcp-kit`. The
  evaluator is a slice-side *implementation* of an existing foundation port.
- **`epistemic/domain` may import only `foundation/primitive` and
  `foundation/modeling`** (`ARCHITECTURE.md:621-624`) — never `capability`. This
  is why `DenialReason` cannot be carried by a marker living in `api-transport`.
- **Slice-to-slice imports are forbidden.** `ontology/server` must never import
  epistemic, and vice versa. Binding happens at the app entrypoint.
- **Live Layer composition belongs in `server` or an app entrypoint**, not in
  `use-cases` (`05-layer-composition.md`). The app entrypoint receives a
  ready-made layer from `epistemic/server`; it does not assemble the evaluator.
- **A slice's tests must not compose ≥2 slice `Layer.ts` values**
  (`08-testing.md:302,308`). The acceptance test is therefore an app test.

### Correctness

- **"No grant set in scope" is the common case**, not an edge. Model three named
  outcomes — `governed-allowed`, `governed-denied`, `ungoverned-infrastructure` —
  where the infrastructure set is a **closed** literal domain whose exact
  membership a test asserts. It is **empty** in this slice. An empty closed
  domain denies a future contributor the fail-open branch; a missing one invites
  it.
- **Telemetry recursion is eliminated by scope, not mitigated.**
  `ObservabilityLive` is provided inside `RuntimeLive`
  (`apps/professional-desktop/src/runtime/Layer.ts:263`), not at `Main`, so the
  OTLP exporter never runs in the governed branch's context. Do not build a
  guard for a recursion that cannot occur here — but re-check this the moment
  the chat-egress packet widens the scope.
- **`DenialReason` is a bounded literal domain, never free text.** Free text is a
  payload-smuggling channel into a no-payload ledger. The same applies to any
  `guidance` string: a constant per reason from a total lookup, never
  interpolated with request data. Contrast
  `TierGateAuditRecord.reason: S.NonEmptyString` (`TierGate.ts:115`), which is
  fine for its `UsageRecord.metadata` sink but must not reach the ledger.
- **Never infer a denial from the caller's error.** The policy function writes
  its own typed refusal to the ledger. A transport failure and a policy denial
  are indistinguishable downstream *by design* (decision 13).
- **Grants derive only from session-static inputs** — config, policy revision,
  caller identity. Never from tool output. This is what makes the freeze sound.
- **Ledger writes are on the critical path.** Fail-closed write-ahead puts a
  database round trip in front of governed actions. Bound the cost in the
  acceptance test so the first latency complaint is not misattributed.

### Persistence

- **Two append-only tables, never one row updated in place.** A row updated in
  place could not carry a blanket UPDATE guard, and the mutable part would be
  exactly what an attacker wants to change. "Decided, outcome unknown" must be a
  *derived* state (a decision with no matching outcome via `LEFT JOIN`) with **no
  storable representation**. State honestly that it signals *either* a crash *or*
  an outcome-write failure — an outcome write cannot fail the dispatch, since the
  effect has already run.
- **Scope the derived-unknown predicate to allowed decisions.** A refused
  dispatch legitimately has no outcome row, because `dispatchWithTierGate` never
  runs `onApproved` on the refused branch. An unscoped `LEFT JOIN` would report
  every ordinary denial as "outcome unknown" and destroy the property above. The
  predicate is `verdict = 'allowed' AND outcome IS NULL`.
- **Non-`BaseEntity` rows.** `BaseEntity.Class` bakes in `rowVersion` /
  `updatedAt` / `updatedByPrincipal`, i.e. mutability. Precedent for a raw
  `pgTable` exists at
  `packages/architecture-lab/tables/src/aggregates/WorkItem/WorkItem.table.ts`.
- **`EntitySchema.persist` has no CHECK/EXCLUDE/partial-index vocabulary**, so
  immutability guards mean hand-authored SQL with knowingly-lossy ORM metadata —
  the ceiling the bitemporal P0 hit. Inherit its precedent, including the
  Exception Ledger row below.
- **Migration registration is four places**, not three — see `PLAN.md`.
- **Tamper-evident, not tamper-proof.** PGlite connects as table owner and an
  owner can `DROP TRIGGER`; `REVOKE` is provably a no-op for the same reason. The
  chain verifier is the primary proof; the triggers are defense in depth.
- **A hash proves correspondence and ordering only** — never that an action was
  authorized, truthful, or complete. State this wherever the ledger is
  documented. The record's entire value is that nobody over-reads it.

### Honest framing

- **The `audience` axis is half-degenerate in v1.** All three ontology mutation
  tools write under `ONTOLOGY_WORKSPACE_ROOT` on the same machine, reachable only
  via loopback behind an origin allowlist and a per-launch bearer token. Decision
  2's Supabase rationale turned on *audience visibility*, which this sink lacks.
  Model `audience` as `local-workspace` | `external-network` and say plainly that
  one value is degenerate — do not claim the axis is validated.
- **The fixture demonstrates destination-scoped authority plus resolver-owned
  audience classification**, with the freeze guaranteeing the allowed-destination
  set predates the content that tries to change it. "The freeze stopped it" alone
  overclaims.

## Decision Log

Full rationale, rejected options, and consequences live in
[`explorations/agent-execution-sandbox/DECISIONS.md`](../../explorations/agent-execution-sandbox/DECISIONS.md).
Back-links, not copies.

| # | Decision |
| --- | --- |
| 1 | First fixture is privileged read + outbound sink |
| 2 | Absorbs `mcp-write-wall`; an MCP write is a governed sink classified by audience |
| 3 | Grants are `effect/Schema` values held only by the boundary; no bearer credential |
| 4 | v1 ledger is the tamper-evident class only; no payloads |
| 5 | This packet owns policy decision + execution records; brokers credentials; host isolation is a later tier |
| 6 | Grant schema in `epistemic/domain`; enforcement at the app composition root |
| 7 | The evaluator implements `mcp-kit`'s existing `TierGate` port from `epistemic/server` |
| 8 | `recordOutcome` joins `TierGateShape` so the outcome is written in the same call frame |
| 9 | Slice 1 governs the MCP branch only |
| 10 | A run is an MCP session, keyed by the transport's session id (see note) |
| 11 | Policy config lives in a new `epistemic/config` |
| 12 | `ontology_publish_provenance` ships as a real tool, default-off |
| 13 | A denial reaches the agent reason-free |
| 14 | Foundation-mediated port inversion is recorded as doctrine |

**Decision 7 supersedes decision 6's consequence (a).** Because `ontology/server`
keeps its existing `gatedMutation` mapping (`OntologyToolHandlers.ts:86-95`), the
refusal stays *inside* the tool's declared `failure` union — it is not produced
at the transport boundary as decision 6 predicted.

**Decision 10's key was corrected in PR 5.** The decision named `clientId`, but
`RpcServer`'s HTTP protocol mints that per request, so it identifies one
protocol exchange rather than one session; keying a run on it opens a new run
per dispatch. The run keys on the transport's session identifier — the
`mcp-session-id` header, surfaced as `McpCallerIdentity.sessionId` — falling
back to `clientId` on transports that issue none (stdio), where the connection
is the session. The decision's substance is unchanged: a run is an MCP session.

## Acceptance Criteria

Every box below is discharged. `README.md` carries the criterion-to-proof map
naming the specific test behind each one; the three marked *(PR 7)* are the ones
the acceptance suite added.

- [x] An MCP tool dispatch is refused when the session's frozen grant set does
      not authorize it, and the refusal is a typed value the agent receives.
- [x] An outbound POST to a destination outside the grant set is refused with the
      stub fetch counter at **0** — not merely "the effect failed."
- [x] An allowed dispatch produces exactly two ledger rows: a decision written
      before the effect runs, and an outcome written after it settles.
- [x] A denied dispatch produces exactly one row — the decision. There is no
      execution to report, and `dispatchWithTierGate` never runs `onApproved` on
      the refused branch, so no outcome row is written or expected.
- [x] The derived "decided, outcome unknown" query is scoped to **allowed**
      decisions; a test asserts an ordinary denial is not reported as unknown.
- [x] The chain verifier fails at the tampered index after a raw-SQL mutation of
      any ledger row.
- [x] A canary planted in the outbound **request body** appears nowhere in the
      serialized ledger rows, and the exact physical column set of both ledger
      tables is pinned from `information_schema.columns`. *(PR 7 — see the
      narrowing note below)*
- [x] A descriptor-walk test fails on any `jsonb`/`blob` column, or any `text`
      column whose field schema is outside the allowlist.
- [x] The `ungoverned-infrastructure` literal domain's membership is asserted to
      be exactly empty.
- [x] On one MCP session, a poisoned read followed by an outbound publish to the
      injected destination is denied. *(PR 7)*
- [x] `ontology_publish_provenance` is not registered when the destination
      allowlist is empty.
- [x] `bun run beep yeet verify` is green.
- [x] No unrelated refactors or formatting churn.

**Two criteria were narrowed against the original wording rather than being
claimed in full. Both narrowings are deliberate and are what the tests actually
establish.**

*The canary criterion originally said "every request body and response."* The
suite proves absence for the outbound **publish body** only. The workspace
contents and the stub response body are each proven to reach the boundary — every
canary carries its own positive control — but production never carries either into
the ledger's write path, so asserting their absence from ledger rows would pass
for a reason unrelated to the guarantee. Claiming them would be theatre.

The suite adds a **physical schema tripwire**: a literal comparison against
`information_schema.columns` pinning the exact column name and type set of both
tables. It exists because a nullable `payload TEXT` column added to the migration
would otherwise serialize as `payload: null` through `SELECT *`, contain no
canary, and pass — and the descriptor test in `epistemic/tables` would not catch
it either, because it inspects the Drizzle projection rather than the database.

**Call it a drift tripwire, not proof of payload incapacity.** Every digest,
run-key, and revision field is unconstrained `TEXT` at the database boundary, so
a raw writer or a converter regression could place payload into an *existing*
column without changing `information_schema` at all, and the canary search would
only catch the exact unencoded token. The typed writer is what keeps that from
happening today; the database does not forbid it. Closing that gap means CHECK
constraints or typmods on every text field — exact SHA-256 form, bounded
semantic-version syntax, bounded literals — plus negative raw-insert tests. That
is real work with a new migration and its four-place registration, and it is
recorded as a follow-up rather than smuggled into the packet's close.

*The cost criterion is per-path, not a single number.* A **tier-only** allowed
dispatch moves the ledger by exactly 2 rows: one write-ahead decision, one
settlement outcome. An allowed **publish** moves it by 4, because governed egress
writes and settles its own decision — 2 decisions plus 2 outcomes. Both are asserted as
before/after deltas around the dispatch, never as absolute totals, so an
in-process retry cannot make them lie, and never in wall time, so they cannot
decay into a CI timing flake. The measured PGlite write-ahead cost was 1.873 ms on
the sampled run; that number is recorded, not asserted.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Full repo proof | `bun run beep yeet verify` | Passes |
| Acceptance suite | `apps/professional-desktop/test/integration/execution-authority.pglite.test.ts` | Passes, `{ concurrent: false }` |
| Migration codegen drift | `bun run --cwd apps/professional-desktop codegen:check` | Passes |
| Packet launcher size | `test "$(wc -m < goals/agent-execution-authority/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/agent-execution-authority/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/agent-execution-authority` | Passes |
| Reflection artifacts | `bun run beep lint reflection-artifacts` | Passes at P4 |

Never verify with bare `vitest` — the four-place migration registration is only
checked by the full lane.

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.
- ~~**The policy `Fetch` override does not reach handlers dispatched through the
  running MCP server.**~~ **Discharged 2026-07-27** by measurement through the
  real `sanitizedToolkit` + `McpServer.layerHttp` stack, with a control proving
  the harness could detect the un-overridden case. Evidence and the corrected
  mechanism:
  [`history/pr6-fetch-reach-spike.md`](./history/pr6-fetch-reach-spike.md). The
  override reaches handlers in every placement tested; the surviving hazard is
  the reverse of the one anticipated — a `Fetch` provided *per request* takes
  precedence over the composition-root one, so nothing in a transport that
  mounts governed tools may provide that reference per request.
- **PR 6 adds an agent-controllable outbound POST of workspace content** to a
  product holding privileged material. Re-read that scope deliberately before
  landing it; do not inherit it as settled.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Hand-authored SQL owns the ledger's immutability constraints | `epistemic_execution_decision` and `epistemic_execution_outcome` migrations | `packages/epistemic/tables` | `EntitySchema.persist` has no CHECK/EXCLUDE/partial-index vocabulary and no trigger vocabulary, so append-only guards cannot be expressed through the ORM. Drizzle metadata is knowingly lossy for these constraints. Same ceiling and same precedent as the bitemporal P0 spike. | `EntitySchema.persist` gains constraint descriptors covering triggers and table-level CHECKs, at which point the guards move into the schema and the raw SQL is deleted. |
