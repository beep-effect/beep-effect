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
