# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-08-23 — center of gravity

**Question:** Where is this packet's center of gravity — the internal
collapse (one substrate for beep's five journal/register/fold/digest
instances), the protocol-as-value kit, or the Mepuka collaboration shape?

**Answer:** Kit thesis, collapse first. The protocol-as-value kit is the
destination (the verified-novel differentiator); wave 1 is the internal
collapse — one canonical-bytes + digest + journal/register/fold substrate in
`foundation/modeling`, proven by migrating live in-repo customers (the
wave-1 appetite entry below fixes the bar at two proof migrations; the
other three migrate cleanup-on-touch).
Wave 2 builds the protocol kit (global type as digest-named value, per-agent
projections, conformance folds) on that substrate, with fleet messaging, the
MCP servers, and the agents slice as consumers.

**Rationale:** The kit needs the substrate anyway; the collapse has five
day-one consumers (trivially passes doctrine's ≥2-named-consumers foundation
gate) and de-risks with real migrations; the two seams research surfaced
(canonical-JSON ×3 owners, identity's zero digest wiring) are collapse work
by definition. Rejected: protocol-kit-direct (its consumers are thin today —
fleet messaging unbuilt — and it would build on unconsolidated bytes);
collapse-only (forfeits the differentiator and the Mepuka convergence
momentum); business-shape-as-packet (explorations crystallize buildable
scope; the venture shape is not unilaterally decidable here — it feeds
appetite, not scope).

## 2026-08-23 — foldlab relationship

**Question:** What is this work's relationship to Mepuka's foldlab — build in
beep-effect, contribute upstream, or start a joint new thing?

**Answer:** Build Effect-native in beep-effect; converse upstream. Adopt
foldlab's vocabulary (journal/register/fold/refusal, heads, fences, R0–R5
ladder) as the shared language, cite it (Apache-2.0, port-with-attribution),
feed insights to Mepuka through the thread and the pending call. The
joint-venture question stays live at the business level and is decided
together on the call, not in this packet.

**Rationale:** The five migration customers, `Sha256Hex`, the `$I` fibration,
and the reserved `drivers/workflow` landing zone all live in beep; building
here keeps the packet decidable without an external party. Rejected:
contribute-upstream (foldlab is 11 days old, single-author, NATS/Go/Lean-
spined; beep's customers cannot migrate onto it and the exploration would
block on another person's roadmap); joint-new-thing-now (premature before the
call — no agreed scope, governance, or stack; would park the packet on an
external dependency).

## 2026-08-23 — naming discipline (two regimes)

**Question:** Do digest names hash raw canonical bytes (foldlab-style) or a
normal form (Dhall-style)?

**Answer:** Two regimes by artifact class, both in a self-describing
versioned digest format. Facts (journal events, evidence) hash their
canonical bytes verbatim — evidence is never normalized. Meanings (protocol
values, schemas, global types) hash the canonical encoding of their normal
form — refactors preserve the name, and digest equality = meaning equality
via fold uniqueness. Digest strings carry algorithm + encoding version
(CID-lite) so hash/encoding migration never breaks stored names.

**Rationale:** Normalizing evidence is a bug (the journal witnesses exact
bytes); byte-hashing meanings mints spurious protocol versions on formatting
churn. Research anchors: Dhall's semantic integrity checks, Unison's
normalized-AST hashing, CID format governance, and the five bare-sha256
instances in-repo with no migration story. Rejected: raw-bytes-everywhere,
normal-form-everywhere (each correct for exactly one class).

## 2026-08-23 — canonical-JSON ownership

**Question:** Who owns canonical-JSON encoding after the collapse (3+
independent encoders exist today)?

**Answer:** A new canonical-encoding module in `@beep/schema`
(foundation/modeling; `Sha256Hex` already lives there): schema-first, encodes
wire-form values with recursively sorted keys and a versioned encoding tag,
behavior matching the epistemic encoder. Existing encoders (epistemic
CanonicalJson, PacketCore PacketDigest, OpenclawRender, Yeet fingerprints)
migrate cleanup-on-touch.

**Rationale:** Epistemic's own header ("a second private copy could drift and
silently split the digests") is the argument for promotion now that 3+ copies
exist. Five named consumers satisfy doctrine's ≥2 gate on day one. Rejected:
lifting epistemic's encoder as-is (package-private contract, epistemic-
specific versioning baked in); leaving the three in place (forfeits the
one-canonical-byte-form premise — the collapse stops being a collapse).

## 2026-08-23 — identity seam

**Question:** Does the digest↔identity binding live inside `@beep/identity`
or in the substrate layer?

**Answer:** Substrate binds; `$I` stays static. `@beep/identity` keeps its
authored, literal-typed, grep-harvestable discipline — no runtime-computed
channels. The protocol kit's value schema carries both names — authored `$I`
path (human/repo channel) and digest (trustless channel) — bound in one
schema-validated record in the substrate layer.

**Rationale:** A content digest at an authoring site would break the
interpolation ban's point (static extraction without executing code), and a
digest channel inside identity couples wave 1 to the blocked
identity-iri-fibered design space. Rejected: digest-channel-in-identity
(dilutes the static discipline); digests-only (severs the human/repo naming
channel; nothing dereferences without a lookup service).

## 2026-08-23 — identity-iri-fibered contract

**Question:** Depend on, co-design with, or decouple from
`goals/identity-iri-fibered` (active, blocked)?

**Answer:** Decouple; adopt-if-lands. Wave 1 needs nothing from the Fibered
kit. Wave 2 reuses the proven fibration pattern directly
(`JSDocTagDefinition.make`: base + section + display map) without blocking on
the kit goal. If the kit lands first, wave 2 adopts it. Cross-link both
manifests either way.

**Rationale:** The kit goal is blocked on unrelated semantic-web cleanups
with no ETA. Rejected: hard dependency (chains the packet to that timeline);
co-design-now (identity-as-iri's re-entry rule reserves reopening for a fired
MAP gate, not a sibling's convenience — and it's scope creep).

## 2026-08-23 — wave-1 appetite

**Question:** Appetite for wave 1 (the collapse substrate)?

**Answer:** One focused arc: the substrate (canonical-encoding module +
versioned digest format + journal/register/fold kit schemas in
`@beep/schema`) plus exactly two proof migrations — Goals PacketCore (richest
instance: chain, CAS, fork repair) and epistemic ExecutionRecord (seal
byte-parity). The other three customers migrate cleanup-on-touch afterward.

**Rationale:** A substrate nobody migrated onto is a design document; two
migrations from different families (tooling + slice) prove the contract
without a five-front refactor. Rejected: substrate-only (contract unproven at
its riskiest shapes); all-five (overcommitted packet).

## 2026-08-23 — wave-2 gating

**Question:** How does wave 2 (the protocol kit) enter the map?

**Answer:** Gated candidate in MAP.md, not promised-now. Gate: wave-1
substrate merged AND a concrete first consumer exists (fleet messaging rung
activates, a real multi-agent surface lands, or the Mepuka call produces
joint scope). Per the ratified graduation contract, gated candidates don't
hold the packet open; a fired gate reopens it at decompose.

**Rationale:** Wave 2's consumers are thin today; its design sharpens after
the call and after the substrate survives two migrations. Rejected:
promised-now (graduates a goal with no live consumer); separate-exploration
(severs thesis from substrate, duplicates provenance).

## 2026-11-05 — definition identity and consumer qualification amendment

**Question:** What guarantees do digest equality and replay establish, and
what must a first consumer demonstrate before the global protocol kit starts?

**Answer (operator-authorized amendment):** Adopt the revised BRIEF contracts.
The meaning-digest name remains, but v1 establishes normalized-definition
identity under a versioned normalizer and the hash assumptions. Interpretation
also depends on pinned operations, imports, policy, evidence, and context.
Fold uniqueness does not equate different algebras or environments. This
supersedes the August naming decision's unqualified refactor-stability and
"digest equality = meaning equality" wording; the original entry is retained
as history. Definition pinning detects definition changes, not implementation
behavior. Novelty remains a dated search result, not proof of absence.

Wave 2 still requires merged Wave 1 work and a concrete consumer, now with
owned scope and a runnable qualification case explaining why role projection
adds value beyond a request/observation journal. A request consumer binds
answers to their relevant basis, answerer policy, and occurrence. Content
equality alone grants neither cross-run reuse nor authority. The BRIEF's
qualification table specifies replay, invalidation, duplicate/conflict, and
late-answer cases. This refines the August Wave 2 gate; no gate has fired.

**Rationale:** Stable definition bytes can refer to changed semantics, and a
stable document location can acquire a different question. Explicit bases and
occurrences prevent stale approval reuse. A consumer needing only a journal
does not justify global role projections.

**Scope:** Wave 1 still has exactly two proof migrations, with legacy bytes,
filenames, chains, and seals preserved. No additional runtime, resolver, or
request schema is added. The oracle lab can exercise a bounded fixture without
depending on Wave 1. The document-hub inversion is unchanged. This adoption
updates planning contracts only; it does not approve the full shape, advance
the lifecycle, or report implementation or consumer qualification.

**Rejected:** Treating all behavior-preserving refactors as digest-preserving;
reusing approvals by model path or content hash alone; activating role
projection because a request/replay example exists.

**Reversal:** Amend these contracts through a later dated decision, retain
historical receipts, and withdraw any claim whose qualifying evidence no
longer applies. Any replacement digest guarantee must match its implementation.

## 2026-11-10 — shape narrowed to the canonical digest owner

**Question:** Shape review of the amended BRIEF: does Wave 1 graduate as
drafted (encoder module, two digest regimes, journal/register/fold kit, two
proof migrations)?

**Answer (operator-approved 2026-11-10):** No. One goal graduates,
`canonical-digest-owner`, and it covers the canonical byte form and the
digest grammar only. The rest moves to gated candidates in `MAP.md`. The
review checked the packet against the tree; evidence is in
[`RESEARCH.md`](./RESEARCH.md) (2026-11-10) and
[`research/encoder-differential-2026-11-10.md`](./research/encoder-differential-2026-11-10.md).

1. **Byte form and owner.** The canonical byte form is RFC 8785. Its owner is
   `@beep/jsonc`'s `JsoncFingerprint`, which already ships in
   foundation/modeling. This supersedes the 2026-08-23 canonical-JSON
   ownership entry (a new module in `@beep/schema` matching the epistemic
   encoder). `@beep/jsonc` depends on `@beep/schema`, so an encoder in
   `@beep/schema` would be a cycle or one more copy.
2. **Refusal policy.** Values outside plain JSON are refused with a typed
   error. One named pre-pass is allowed: dropping object members whose value
   is `undefined`, because every legacy encoder and `JSON.stringify` already
   agree that such a member is absent. Nothing else is coerced.
3. **Digest grammar.** A self-describing digest is `sha256:` followed by 64
   lowercase hex digits, the grammar `ContentDigest` and `SourceTextDigest`
   already use. `@beep/schema` owns it beside `Sha256Hex`, and domain digests
   brand over it. The encoding version is not part of the digest string; the
   schema that names a preimage contract carries it. Stored bare-hex
   identifiers stay valid and are never rewritten. This supersedes "CID-lite,
   grammar decided in the goal".
4. **Definition digest.** The meaning-digest regime leaves Wave 1 and is
   renamed definition digest, which is what the 2026-11-05 amendment says it
   guarantees. Both proof migrations were fact digests, so it had no Wave 1
   consumer. It is gated on the first consumer that hashes a definition, and
   its preimage is `effect/SchemaRepresentation` JSON or a plain-data
   protocol value, never a schema AST, which holds closures.
5. **Chain kit.** The journal/register/fold kit leaves Wave 1. Two of the
   five instances are parent-linked chains, and the PacketCore chain in this
   tree is four streams of one event each. It is gated on a third
   parent-linked journal, and its design must first say what
   `effect/eventlog` does and does not cover.
6. **Protocol kit.** Still gated as amended on 2026-11-05, with three
   changes. Fleet messaging is no longer a candidate consumer, since the
   repository ships no mailbox or relay of its own (`AGENTS.md`, Autonomy).
   `goals/identity-iri-fibered` completed and `Fibered` ships in
   `@beep/identity`, so the kit adopts it, as the 2026-08-23 entry said it
   would. The pull-request lifecycle (lane owner, orchestrator, reviewer,
   merge gate) is recorded as a candidate qualification case; nobody has
   tested the fit.
7. **Request contracts.** The BRIEF's consumer evaluation and request
   section is removed. `goals/oracle-loop-poc/QUESTION-BINDING.md` already
   carries those cases (Q3 to Q15) and is their owner.

**Rationale:** The BRIEF's problem statement called the encoders
incompatible. A differential run over 20,000 plain-JSON values found the
epistemics, PacketCore and semantica encoders and `JsoncFingerprint`
byte-identical. They differ only on values that are not JSON, which the
hand-rolled three coerce silently and `JsoncFingerprint` refuses. The defect
is several copies and silent coercion, and both have a small fix. Meanwhile
the packet sat at shape for 79 days holding the canonical seam: two sibling
packets recorded that they would not wait for it, a third reserved the seam
against it, and PartyKey v1 added one more hand-rolled encoder on 2026-11-02.

**Rejected:** Graduating Wave 1 as drafted (a normalizer with no consumer and
a kit abstracted from two instances). Parking the packet (the encoder and
grammar work is ready and has waiting consumers). Putting the encoding
version inside the digest string (two digests of the same bytes would compare
unequal for a reason the hash does not see).

**DEFERRED:** Whether the Mepuka call produced joint scope. It stays a
protocol-kit trigger and blocks nothing here.

**Reversal:** Reopen this packet at decompose with a dated entry. The goal's
migrations are import swaps proven byte-identical by fixture, so reverting
them restores the old encoders without touching a stored digest.
