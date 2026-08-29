# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `agent-execution-authority` | Default-deny authority boundary over the MCP agent surface, with a hash-chained append-only record of every decision and outcome. | none — this is the first bet | `@beep/mcp-kit` (`TierGate`, `dispatchWithTierGate`, `sanitizedToolkit`, `CurrentMcpCaller`), `@beep/api-transport`, `@beep/epistemic-domain`, `@beep/epistemic-tables`, `@beep/epistemic-use-cases` (`ClaimGate` port shape), `@beep/postgres` + `PgliteDrizzleLive`, `@beep/schema` (`LiteralKit`, `EntitySchema`), `effect/unstable/http` `FetchHttpClient.Fetch` |
| `agent-execution-chat-egress` | Extend the boundary to the chat/Anthropic path: a run opened per turn, frozen above the timeline read, governing the app's largest outbound sink. | `agent-execution-authority`; a real request principal | `ChatOrchestrator.streamAndPersist`, `AnthropicLive`, `BlockRepair` retry tail, run/grant vocabulary from the first packet |
| `agent-execution-host-isolation` | The later tier this packet always owned: an OS-level boundary (bwrap/Seatbelt/microVM) plus resource ceilings, so a compromised handler cannot reach around the policy plane via `node:fs`. | `agent-execution-authority` | NET-NEW — no OS isolation primitive exists repo-wide (`RESEARCH.md` §6) |
| `agent-execution-record-anchoring` | Checkpoint digests anchored into a second trust domain, giving the ledger an external verifier. | `agent-execution-authority`; a chosen anchoring target | NET-NEW — anchoring target is registered research debt (`research/10-research-critique.md`) |

## Sequencing

`agent-execution-authority` is the first and only bet worth making now.
Everything else is gated on something it produces or on a question it cannot
answer yet.

- **Chat egress** is deferred on a *fact*, not a preference: the chat path's
  principal is still `SYSTEM_PRINCIPAL` (`ChatOrchestrator.ts:210`, commented
  "the not-yet-wired request principal"). Governing a sink whose subject is a
  fixture would record authority decisions about nobody. It becomes a natural
  second slice the moment the request principal lands.
- **Host isolation** is deferred because the grant plane and the host boundary
  are independently useful and the isolation tier is an order of magnitude
  larger. It stays inside this packet's lineage rather than becoming a sibling,
  because the unanimous prior-art finding (`RESEARCH.md` §1) is that grants in
  the Effect layer cannot self-enforce — splitting policy from enforcement
  across owners is how a "sandbox" ships with no boundary and nobody
  accountable.
- **Record anchoring** is deferred because a data structure with no chosen
  verifier is not a guarantee. It needs the evidentiary-recognition research
  debt closed first (witness cosigning vs an RFC 3161 / eIDAS authority).

## First Vertical Slice

**When it lands:** an MCP agent connected to the desktop sidecar operates under
a grant set frozen at the start of its session. Every tool dispatch is decided
before it runs and the decision is durably recorded before the effect executes —
no record, no action. An outbound publish to a destination outside the session's
grants is refused, and the refusal is a typed value the agent receives, not an
exception. Reading the two ledger tables afterwards reconstructs exactly what
was decided, in what order, with a hash chain that fails verification if any row
is altered.

**Composition root:** `apps/professional-desktop/server/OntologyMcpTransport.ts`
— the governed gate, the policy `fetch`, the epistemic config, the database, and
the toolkits all assemble in one place.

**Verified by** `apps/professional-desktop/test/integration/execution-authority.pglite.test.ts`
under real in-process PGlite and the real MCP HTTP transport: default-deny and
allow for both sink classes, exactly 6 ledger rows across 4 dispatches — 4
decisions plus 2 outcomes, since a refusal has no execution to report and
`dispatchWithTierGate` never runs the wrapped effect on that branch. The count is
load-bearing in both directions: 4 decisions proves write-ahead rows exist for
the *denied* cases, and 2 outcomes proves denials are not fabricating them. Then
raw-SQL tampering failing verification at the tampered index, a canary string
absent from the serialized row set, and — the claim that earns the packet — a
poisoned read followed by a denied egress on the same session.

**Anti-vacuity guards** are part of the deliverable, not the test's polish: the
stub fetch counter must be 0 on denial rather than merely "the effect failed";
the infrastructure-exemption set's membership is asserted to be exactly empty;
and the stub fetch handler reads the ledger and asserts its own decision row is
already present, which is the only ordering assertion that cannot be faked by
writing both rows at the end.

## Open Risks Inherited From The Brief

- **Per-value taint propagation** is the only thing that catches composition
  precisely and has no portable prior art; the session freeze buys a structural
  property instead, and the spec must not claim more than that.
- **A hash proves correspondence and ordering only** — never that an action was
  authorized, truthful, or complete. The record's entire value is that nobody
  over-reads it.
- **Tamper-evident, not tamper-proof**: PGlite connects as table owner, and an
  owner can `DROP TRIGGER`. The chain verifier is the primary proof; the
  triggers are defense in depth.
- **`EntitySchema.persist` cannot express CHECK/EXCLUDE/partial indexes**, so
  immutability guards mean hand-authored SQL with knowingly-lossy ORM metadata —
  inherit the bitemporal P0 precedent including an Exception Ledger row.
- **Ledger on the critical path**: fail-closed write-ahead puts a database round
  trip in front of governed actions and makes the ledger a hard dependency.
  Bound the cost in the acceptance test so the first latency complaint is not
  misattributed.
- **"No grant set in scope" is the common case**, not an edge. Three named
  outcomes with a *closed* exemption domain, never a predicate, or default-deny
  becomes whichever branch a future contributor lands in.
- **The `audience` axis is half-degenerate in v1** — every governed MCP write is
  a local-workspace file, so `external-network` is the only value the fixture
  genuinely exercises. Say so rather than claiming the axis is validated.
- **Shipping `ontology_publish_provenance` adds an exfiltration primitive** to
  justify its own control. Default-off registration gated on a non-empty
  allowlist is what makes it defensible; the scope deserves a deliberate re-read
  before it lands.
