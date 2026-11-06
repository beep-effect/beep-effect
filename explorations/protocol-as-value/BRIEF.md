# Brief — Protocol as Value

<!--
Stage 3. Shape Up pitch at fat-marker fidelity: concrete enough to decompose,
rough enough to leave design latitude. Drafted 2026-08-23 from CAPTURE +
RESEARCH + DECISIONS; exit only on Benjamin's confirmation.
-->

## Problem

beep-effect built the journal/register/fold/digest stack **five times
independently** — epistemic ExecutionRecord (hash-chained seals), the
GovernedTierGate (fenced write-ahead decisions), Goals PacketCore
(content-addressed CAS event chains with fork repair), the candor gate
(recomputed-only verdicts), and Yeet (fingerprint-bound proofs + inbox/ack) —
each with local vocabulary, local bugs, and **three-plus incompatible
canonical-JSON encoders**, all naming things with bare sha-256 hex and no
hash-migration story. The premise every instance depends on ("one canonical
byte form") is violated by their coexistence.

One level up, the repo's multi-agent surfaces — four MCP servers, the agents
slice, the reserved fleet-messaging rung — have per-message schemas but **no
global type above them**: the topology of who-talks-to-whom is implicit in
code. The August research did not identify a matching composition of a
digest-named global protocol type, per-agent projections, and journal-audited
conformance in the sources examined. That is a dated research result, not
proof of absence or a prerequisite for the engineering value of the kit.

## Appetite

**One focused arc** (wave 1): the substrate plus exactly two proof
migrations. Not a five-front refactor; the remaining three customers migrate
cleanup-on-touch after the contract is proven. Wave 2 (the protocol kit) is
explicitly **gated**, not part of this appetite.

## Solution sketch (fat marker)

**Wave 1 — the collapse substrate**, in `@beep/schema`
(foundation/modeling; `Sha256Hex` already lives there; five named consumers
satisfy the ≥2 gate):

1. **Canonical encoding module** — schema-first: encodes wire-form values,
   recursively sorted keys, versioned encoding tag; behavior matching the
   epistemic encoder (the battle-tested contract, re-authored publicly).
2. **Versioned digest values** — self-describing digest strings carrying
   algorithm + encoding version (CID-lite; exact grammar decided in the
   goal). Two branded regimes as distinct types:
   - **fact digest** — sha-256 of canonical bytes verbatim (journal events,
     evidence; never normalized);
   - **meaning digest** — retains the artifact-class name, but v1 guarantees
     normalized-definition identity: sha-256 of the canonical encoding of a
     definition under an explicit normalizer version. Only transformations
     covered by the admitted ordering and alpha-renaming laws preserve this
     identity; arbitrary behavior-preserving refactors are not promised to.
     Under the hash's collision-resistance assumption, digest equality is
     treated as identity of the normalized representation. Equivalent
     interpretation additionally requires the same interpretation contract
     and relevant semantic dependencies. Fold uniqueness alone does not
     establish equivalence across algebras, implementations, or environments.
     Fact digests bind exact canonical wire values without meaning
     normalization. Original source bytes needed as evidence are retained
     and separately identified; canonical encoding does not preserve arbitrary
     source formatting.
3. **Journal / register / fold kit schemas** — the one mechanism, typed:
   chained journal (entries digest-named, parent-linked), fenced register
   (CAS decisions; losing a race is a schema-tagged refusal value), fold
   contracts (algebra in, catamorphism out; monotone reads flagged as
   coordination-free per CALM).
4. **Two proof migrations**:
   - **Goals PacketCore** — the richest instance (chain + CAS + fork repair)
     re-hosted on the kit, with golden-replay byte-parity fixtures (its own
     R4 discipline) proving digests and folds unchanged. The kit therefore
     admits an explicit **legacy digest representation**: existing bare-hex
     ids and `<seq>-<type>-<digest>.json` filenames stay valid as-is — the
     versioned self-describing format applies to newly minted digests only,
     never to rewriting stored filenames or parent chains (the event
     upcaster cannot repair digest renames);
   - **epistemic ExecutionRecord** — seals computed through the shared
     encoder, byte-identical seal proof.

Wave 1 verification retains golden migration fixtures and legacy identifiers.
Versioned vectors identify the encoder and normalizer versions. Positive
fixtures cover admitted normalization laws; negative fixtures distinguish
changed interaction order, literal values, and externally meaningful names.
A changed normalizer cannot silently reuse the old version tag. These refine
the existing encoding proof, not the two-migration appetite.

**Wave 2 — the protocol kit** (GATED: substrate merged AND a concrete first
consumer with owned scope and a runnable qualification case):

The consumer identifies its roles and interactions, the problem role
projection solves beyond a request/observation journal, the admission
restrictions that keep the fragment inspectable, and its conformance evidence.
A consumer needing only exact requests, observations, and replay can use the
substrate without activating the global kit. An interaction tree is not
assumed to be a global protocol or to supply correct per-role projections.
A candidate example does not itself establish joint scope or fire the gate.

- **ProtocolValue** — a global type as a schema value: roles, channels,
  ordered interactions; named both ways (authored `$I` path + meaning
  digest) in one schema-validated binding record (identity stays static;
  the substrate binds).
- **project(protocol, role) → local type** — per-agent view derived from the
  one value, fibration-pattern per `JSDocTagDefinition.make` (base + section
  + display map); conservative decidable fragment only (fixed census,
  delegation-free — the implementable MPST fragment).
- **Conformance fold** — each agent's journal folded against its projection;
  refusals as values. Recomputation proves internal consistency; per
  `verifyExecutionDecisionChain`'s own contract, evidence that crosses a
  trust boundary additionally needs an externally anchored tail hash +
  expected length (anchoring stays a separate candidate, not smuggled into
  this kit).
- Candidate consumers: fleet messaging, MCP tool surfaces, agents slice.
  This ordering remains provisional until a candidate meets the entry gate.
  Digest-pinned tool definitions detect changes to the pinned definition when
  checked before use. Implementation binding or attestation is separate;
  definition identity alone does not prove behavior, authorization, or safety.

### Consumer evaluation and request contracts

Consumers distinguish authored identity, definition identity, and evaluation
basis. The basis identifies the interpretation contract, pinned imports or
operations, input/evidence revisions, policy revision, and explicit context
such as scenario or effective time. A version label suffices only where its
immutability is enforced; otherwise bind a stronger immutable artifact
identity or report the unresolved dependency.

Declare the dependency boundary and demonstrate invalidation when a relevant
dependency changes. Hidden mutable lookups cannot support reproducible-result
claims. This does not require a universal dependency graph or full
bitemporality in the kit. Replay reproduces the admitted record under its
declared interpretation. A counterfactual under a new policy is a separately
identified evaluation; it does not rewrite historical approvals. In particular,
unchanged definition bytes with a changed operation or policy must not reuse
an old result as if its basis were unchanged.

A request/observation consumer binds the question and response schema,
relevant source/evidence revisions, interpretation and policy versions,
authorized answerer requirements, and request occurrence. Immutable references
may carry these dependencies. Content identity and occurrence identity are
separate: identical content does not authorize reuse of a one-time approval
or suppress a repeated side effect. Cross-run reuse needs an explicit policy.
Replay reconstructs state from admitted observations without calling providers
or repeating external actions.

An answer under another request or a superseded relevant basis cannot
discharge the current obligation; the old observation remains in history.
A late valid answer can resolve an open occurrence under its transition rules.
Duplicate and conflicting answers follow an explicit deterministic policy.
Journaling an unauthorized answer does not grant it authority.

| Consumer qualification case | Required result |
| --- | --- |
| Same pinned definition, basis, and admitted journal | Same state and reason references; no provider call during replay |
| Same document path, changed quantity or evidence | Old answer cannot resolve the new request |
| Irrelevant source edit | Conservative invalidation allowed; reuse requires a tested narrower dependency boundary |
| Answer under another request | Never consumed for this request |
| Answer under a different policy revision | Cannot resolve the new obligation without explicit re-admission |
| Late valid answer | Pending occurrence resolves without losing earlier evidence |
| Duplicate observation or conflicting answer | No accidental duplicate transition; explicit conflict policy |
| Same content, new approval occurrence | Fresh approval unless explicit reuse policy permits otherwise |
| New policy over historical observations | Separate evaluation; original decision remains recoverable |

These qualification cases belong to later consumers. They add no request
schema, workflow engine, or third migration to Wave 1. The oracle POC may
test them locally without depending on the substrate's completion; it must
not create another production canonical-encoding owner.

## Rabbit holes (bounded)

- **Normal-form definition**: v1 is schema-AST ordering and alpha-renaming
  only. Name the unordered collections and renameable binders. Do not reorder
  ordered interactions, evidence sequences, or externally meaningful names.
  Retain distinctions where preservation of interpretation is unjustified.
  Do not chase αβ-normalization generality.
- **Compatibility checking**: async session subtyping is undecidable —
  offer digest equality plus explicitly conservative checks; never promise
  "v2 safely refines v1" in general.
- **Migration byte-parity**: PacketCore digests live in file names and
  parent chains; the migration preserves them byte-identically via the
  legacy digest representation, proven by golden-replay fixtures — no
  re-digesting, no filename rewrites (the event upcaster cannot repair
  digest renames).
- **Digest format**: minimal versioned prefix, not full CID/multiformats.
- **Poly async semantics**: cite the math, do not formalize it; engineering
  first.

## No-gos

- No digest channel inside `@beep/identity`; the interpolation-ban/static
  discipline is untouched (DECISIONS 2026-08-23).
- No dependency on `goals/identity-iri-fibered` (adopt-if-lands).
- No new transport or agent-protocol runtime — this is a typing/verification
  layer positioned over MCP+A2A, never a rival.
- No consensus/blockchain machinery; the register stays CAS/fence-based.
- No vendored foldlab code; Effect-native build, shared vocabulary,
  attribution where ideas are ported (Apache-2.0).
- Wave 2 is not promised-now; it enters MAP.md gated.
- No expansion of `doc-hub-spokes-inversion`, persisted Doc JSON, or hub safety
  rules. Request identity and business evaluation remain outside the Doc model.
