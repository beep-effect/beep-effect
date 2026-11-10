# Brief — Protocol as Value

<!--
Stage 3. Shape Up pitch at fat-marker fidelity: concrete enough to decompose,
rough enough to leave design latitude. Drafted 2026-08-23, amended
2026-11-05, narrowed and operator-approved 2026-11-10 (DECISIONS). The
earlier text is in git history.
-->

## Problem

The repository computes content digests in many places and has no single
owner for the bytes they hash.

- **Several copies of one encoder.** The epistemics encoder, PacketCore's
  `canonicalJsonText` and the semantica lab encoder are separate
  implementations. A differential run over 20,000 plain-JSON values found
  them byte-identical with each other and with RFC 8785
  ([record](./research/encoder-differential-2026-11-10.md)). Nothing keeps
  them that way: the execution-authority copy's header warns that "a second private
  copy could drift and silently split the digests".
- **Silent coercion.** Given a value that is not JSON, the hand-rolled
  encoders turn `NaN` into `null` and a `Date` into `{}`. Two different
  values can therefore share a seal.
- **An owner nobody uses.** `@beep/jsonc` has shipped `JsoncFingerprint`, an
  RFC 8785 emitter with typed refusals, since 2026-10-21. It has one
  consumer.
- **A digest grammar written twice.** `sha256:` plus hex is defined as
  `ContentDigest` and again as `SourceTextDigest`, while most digests are
  bare `Sha256Hex` with no room for a second algorithm.
- **A reserved seam.** This packet has held "canonical encoding" since
  August. Sibling packets wrote around it, and a new hand-rolled encoder
  landed in the meantime.

One level up, the repository's multi-agent surfaces have per-message schemas
and no global type above them. That observation started this packet and is
still true. It is not this brief's appetite; see the gated candidates.

## Appetite

**One small goal**, `canonical-digest-owner`: name the byte form, make one
package own it, give digests one self-describing grammar, and move the
existing encoders onto the owner with proof that no digest changes. About
four pull requests. No new runtime, no kit, no normalizer.

## Solution sketch (fat marker)

1. **Name the byte form.** Canonical bytes are RFC 8785 output. The owner is
   `JsoncFingerprint` in `@beep/jsonc`. Callers hand it wire-form values
   (already schema-encoded).
2. **Refuse instead of coerce.** A value outside plain JSON is a typed
   failure. One named pre-pass drops object members whose value is
   `undefined`, which every existing encoder already treats as absent.
3. **One digest grammar.** `@beep/schema` owns the `sha256:` plus hex form
   beside `Sha256Hex`. `ContentDigest`, `SourceTextDigest` and new digest
   brands derive from it. Stored bare-hex identifiers, file names and parent
   chains are never rewritten.
4. **Census, then swap.** Find every sorted-key encoder and digest preimage.
   Classify each as RFC 8785 on its domain, separately pinned (PartyKey v1),
   or a renderer (indented output for committed files). Replace the first
   class with the owner. Record the other two with the reason they stay.
5. **Prove nothing moved.** A property test holds each replaced encoder
   byte-equal to the owner on plain JSON before it is deleted. A replay over
   stored PacketCore events and execution-record fixtures shows every stored
   digest recomputes. Any stored digest that depended on a coerced value is
   found here, before the swap, and keeps a named legacy path.
6. **Close the door.** A syntactic guard rejects a new sorted-key encoder
   outside the owner.

## Gated candidates (not this appetite)

Each stays in [`MAP.md`](./MAP.md) with its trigger. A fired trigger reopens
this packet at decompose.

- **Definition digest.** The digest of a normalized definition under a
  versioned normalizer, with the guarantees limited as the 2026-11-05
  decision states. It waits for the first consumer that hashes a definition.
  Its preimage is `effect/SchemaRepresentation` JSON or a plain-data value.
- **Chain kit.** Shared schemas for a parent-linked journal, a fenced
  register and a verify function. It waits for a third parent-linked journal
  and a written comparison with `effect/eventlog`.
- **Protocol kit.** A global protocol value, per-role projections and a
  conformance fold over journals, gated as the 2026-11-05 decision states: a
  consumer with owned scope and a runnable qualification case showing what
  role projection adds beyond a request and observation journal. It adopts
  `Fibered` from `@beep/identity`. Request and occurrence contracts for such
  a consumer live in `goals/oracle-loop-poc/QUESTION-BINDING.md`.

## Rabbit holes (bounded)

- **Coerced history.** If a stored digest was computed over a coerced value,
  do not re-digest. Keep the old function for that record class under a
  legacy name and say so in the census.
- **Pretty renderers.** `canonicalJsonTextPretty` and the OpenClaw document
  renderer produce indented text for committed files. They are renderers. Do
  not force them onto RFC 8785; do make sure no digest is taken over their
  output where a canonical digest was meant.
- **PartyKey v1.** Its bytes are pinned by the party-slice specification.
  Prove parity with the owner on its domain or record it as separately
  pinned. Do not change `pk:v1` bytes.
- **Grammar sprawl.** One algorithm prefix. No multibase, no multicodec, no
  encoding version inside the digest string.
- **Hashing backends.** Some seals hash synchronously with `@noble/hashes`
  and others through `effect/crypto/Digest`. Unifying the backend is out of
  scope; the goal unifies the bytes that are hashed.

## No-gos

- No new canonical encoder. The work is adoption of the existing one.
- No rewrite of a stored digest, event file name or parent chain.
- No digest channel inside `@beep/identity`; its static, authored discipline
  is untouched (DECISIONS 2026-08-23).
- No journal kit, normalizer, protocol value, transport or agent runtime in
  this goal.
- No vendored foldlab code.
- No change to `doc-hub-spokes-inversion`, persisted Doc JSON or hub safety
  rules.
