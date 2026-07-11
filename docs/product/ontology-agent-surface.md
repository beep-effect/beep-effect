# Ontology Agent Surface

> Status: v1 closeout prepared locally; canonical host benchmark, ROBOT, and
> P3 mergeability evidence remain operator gates. Product target:
> `apps/professional-desktop` sidecar `/mcp`.

The ontology agent surface exposes saved Turtle ontologies through a curated
MCP toolkit backed by the real N3, rdfc-1.0, Oxigraph, SHACL, and ontology
use-case layers. V1 is deliberately stateless: every call reopens the saved
file, and no tool can observe or overwrite unsaved workbench state.

## Product Boundary

The surface is for bounded inspection, query, validation, repair, mutation,
and provenance export over server-approved ontology files. It does not add a
session repository, shared undo model, cache, stdio transport, registry fetch,
multi-format import/export, or OWL 2 DL reasoner.

The authenticated streamable-HTTP endpoint is mounted at loopback `/mcp`.
Requests must pass the desktop session bearer-auth boundary and the exact
Origin allowlist before tool dispatch.

## Curated Tool Vocabulary

| Tool | Mode | Capability |
| --- | --- | --- |
| `ontology_open_inspect` | read | Open saved Turtle and return prefixes, quad count, session id, and semantic fingerprint. |
| `ontology_snapshot_describe` | read | Build the full ontology resource, hierarchy, relationship, and metrics snapshot. |
| `ontology_search` | read | Search the snapshot with a server-owned result ceiling. |
| `ontology_sparql_query` | read | Run SELECT or CONSTRUCT through Oxigraph with bounded returned results. |
| `ontology_validate` | read | Validate with real SHACL and return only verified repair proposals. |
| `ontology_capability_metadata` | read | Report the vocabulary, budgets, CAS semantics, stateless mode, and reasoner profile. |
| `ontology_propose_change_batch` | mutation | Apply asserted-graph typed operations under TierGate, actor, budget, and CAS checks. |
| `ontology_repair` | mutation | Apply one current verified repair proposal, save it under CAS, and revalidate. |
| `ontology_export_provenance` | mutation | Write PROV-O and dataset-description sidecars for the current fingerprint. |

The vocabulary is task-oriented rather than a mirror of UI RPC payloads.
`sessionHandle` is reserved in request schemas for a future stateful version;
v1 does not create or resolve one.

## Server-Owned Budgets

| Budget | Ceiling |
| --- | ---: |
| Change operations per batch | 256 |
| SPARQL results | 200 |
| Search results | 100 |
| Validation results | 100 |
| Reasoner change-log drift | 64 operations |

Callers cannot raise these values. SPARQL safeguards inject LIMIT 200 when a
SELECT has no LIMIT and truncate returned results to 200 even when a caller
supplies a larger LIMIT. Search and validation truncate to their independent
ceilings, and a 257-operation mutation or 65-operation reasoner window is
visibly refused.

## CAS And Write Authority

Writes use semantic compare-and-set against an rdfc-1.0 SHA-256 fingerprint.
Prefix ordering, whitespace, and equivalent Turtle serialization do not cause
a conflict; a changed RDF dataset does. A stale request receives both its
expected fingerprint and the current fingerprint with refetch, rebuild, and
retry guidance. It cannot proceed to apply or save.

The professional-desktop sidecar is the sole v1 writer for served files. One
service-owned semaphore closes the open/fingerprint/apply/atomic-save race
inside that process. This is not a cross-process lock: operators must prevent
independent processes from writing the same workspace while `/mcp` serves it.

## Mutation Gate And Actor Attribution

`ONTOLOGY_MCP_MUTATIONS_ENABLED` defaults to `false`. When it is false, the
six read tools remain registered and the three mutation tools are absent from
`tools/list`. Enabling registration is not authorization: every mutation is
still dispatched through TierGate and fails closed without an approved tool
policy.

For `ontology_propose_change_batch` and `ontology_repair`, the authenticated
MCP connection supplies the caller as
`urn:beep:desktop-rpc-session:mcp-client:<client-id>`. The server replaces any
caller-supplied operation actor before applying the batch. Each persisted
change therefore retains that actor, and the immediately written
fingerprint-addressed PROV-O journal emits the matching `prov:Agent` and
`prov:wasAssociatedWith`. These change-producing tools refuse mutation when
authenticated actor identity is unavailable. The client id is connection-local
inside the authenticated desktop session, not a durable user-account identity.

`ontology_export_provenance` is still route-authenticated and TierGate-gated
because it writes sidecars, but it does not derive a new actor. It exports the
current stateless session; a reopen cannot reconstruct earlier in-memory
change history. V1's durable per-change actor evidence is the immediate
fingerprint-addressed journal written by propose/repair, not a reconstructed
history from this standalone export tool.

## Typed Refusal Contract

Tool failures are returned as structured, recoverable MCP results where the
condition is actionable:

- `OntologyCasConflict` — stale semantic fingerprint and retry guidance.
- `OntologyBudgetRefusal` — budget kind, actual value, fixed ceiling, and
  split-or-narrow guidance.
- `OntologyReasonerDriftRefusal` — change window exceeds the fixed drift cap.
- `OntologyNoOpRefusal` — a proposed mutation has no real added or removed
  delta.
- `OntologyActorIdentityRefusal` — propose/repair lacks an authenticated caller.
- `OntologyTierGateRefusal` — TierGate did not approve the mutation.
- `OntologyToolExecutionError` — safe typed mapping for file, Turtle,
  fingerprint, query, validation, partition, or proposal failures.

No blocked action silently returns success. Client-facing failures are
sanitized; full Effect causes stay in server-side diagnostics.

## Reasoner, Repair, And Performance Limits

The advertised `structural-rdfs-owl-rl-subset` covers subclass and subproperty
closure, RDF type propagation, RDFS domain/range propagation, and structural
`owl:disjointWith` violation detection. It does not classify OWL
`equivalentClass` restrictions using `someValuesFrom` or `allValuesFrom`, and
it is not an OWL 2 DL reasoner.

The verified repair registry supports sufficiently detailed `sh:hasValue`,
`sh:minCount`, `sh:datatype`, and `sh:class` violations. A candidate is offered
only when applying its typed operations removes the target violation. The
registry does not infer arbitrary values or inherit a safe posture for
destructive strategies.

Every file-backed read tool performs a fresh file read, Turtle parse, and
rdfc-1.0 fingerprint before its own projection or query work; static
capability metadata does not. There is no application cache. The
canonicalization adapter supplies a 1,000 ms abort signal and a work-factor cap
of 1 for deep blank-node comparison. These are defensive controls, not a
strict one-second canonization deadline or an end-to-end call timeout; the
upstream algorithm observes the signal periodically, and blank-node-free file
read, parse, sorting, projection, and query work can take much longer. The P3
benchmark records cumulative open, snapshot, and SPARQL costs at 1k, 10k, and
100k triples; normal OS page cache and runtime JIT effects are not an ontology
session cache.

The P3 sandbox diagnostic completed all three 100k calls with stable
fingerprints but required roughly 176-241 seconds per call. Until canonical
host numbers say otherwise, 100k should be treated as batch-oriented rather
than an interactive repeated-call target. A requirement for interactive 100k
work must reopen the deferred session/cache ownership decision; it must not add
an undeclared cache behind the stateless v1 contract.

## Evidence

- [`goals/ontology-agent-surface/history/2026-07-11-p1-toolkit.md`](../../goals/ontology-agent-surface/history/2026-07-11-p1-toolkit.md)
  records the schema, CAS, budget, real-delta, and real-engine tool proof.
- [`goals/ontology-agent-surface/history/2026-07-11-p2-transport.md`](../../goals/ontology-agent-surface/history/2026-07-11-p2-transport.md)
  records auth, Origin policy, TierGate, attribution, and HTTP proof.
- [`goals/ontology-agent-surface/history/2026-07-11-p2-live-client.log`](../../goals/ontology-agent-surface/history/2026-07-11-p2-live-client.log)
  records the launched-sidecar client conversation without bearer data.
- [`goals/ontology-agent-surface/history/2026-07-11-p3-harden-close.md`](../../goals/ontology-agent-surface/history/2026-07-11-p3-harden-close.md)
  records benchmarks, the criterion-by-criterion acceptance sweep, local
  gates, and remaining host commands.
