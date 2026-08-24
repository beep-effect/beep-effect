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
code, which is the level error (topology stuffed into the vertices) this
exploration's research named and confirmed is unoccupied territory: no prior
system composes a digest-named global protocol type + per-agent projections +
journal-audited conformance (RESEARCH.md, four failed refutation attempts).

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
   - **meaning digest** — sha-256 of the canonical encoding of a normal form
     (schemas, protocol values; refactor-stable, "same digest ⇒ same
     meaning" via fold uniqueness).
3. **Journal / register / fold kit schemas** — the one mechanism, typed:
   chained journal (entries digest-named, parent-linked), fenced register
   (CAS decisions; losing a race is a schema-tagged refusal value), fold
   contracts (algebra in, catamorphism out; monotone reads flagged as
   coordination-free per CALM).
4. **Two proof migrations**:
   - **Goals PacketCore** — the richest instance (chain + CAS + fork repair)
     re-hosted on the kit, with golden-replay byte-parity fixtures (its own
     R4 discipline) proving digests and folds unchanged;
   - **epistemic ExecutionRecord** — seals computed through the shared
     encoder, byte-identical seal proof.

**Wave 2 — the protocol kit** (GATED: substrate merged AND a concrete first
consumer — fleet messaging activates, a real multi-agent surface lands, or
the Mepuka call produces joint scope):

- **ProtocolValue** — a global type as a schema value: roles, channels,
  ordered interactions; named both ways (authored `$I` path + meaning
  digest) in one schema-validated binding record (identity stays static;
  the substrate binds).
- **project(protocol, role) → local type** — per-agent view derived from the
  one value, fibration-pattern per `JSDocTagDefinition.make` (base + section
  + display map); conservative decidable fragment only (fixed census,
  delegation-free — the implementable MPST fragment).
- **Conformance fold** — each agent's journal folded against its projection;
  refusals as values; evidence portable because verification is
  recomputation.
- Consumers in order of concreteness: fleet messaging, MCP tool surfaces
  (digest-pinned tool definitions kill the rug-pull class), agents slice.

## Rabbit holes (bounded)

- **Normal-form definition**: v1 normal form = schema-AST canonicalization
  only (ordering + alpha); no semantic equivalences beyond that. Do not
  chase αβ-normalization generality.
- **Compatibility checking**: async session subtyping is undecidable —
  offer digest equality plus explicitly conservative checks; never promise
  "v2 safely refines v1" in general.
- **Migration byte-parity**: PacketCore digests live in file names; the
  migration preserves digests exactly or goes through the existing
  upcaster + golden-replay machinery — no silent re-digesting.
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
