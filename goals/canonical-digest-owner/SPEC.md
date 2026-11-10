# Canonical Digest Owner Spec

## Objective

Give the repository one owner for the bytes its digests hash.

- The canonical byte form is RFC 8785 (JSON Canonicalization Scheme) output.
- `JsoncFingerprint` in `@beep/jsonc` is the only implementation of it.
- A self-describing digest is `sha256:` followed by 64 lowercase hex digits,
  owned by `@beep/schema` beside `Sha256Hex`.
- Every hand-rolled encoder that already emits RFC 8785 on its domain is
  replaced by the owner, with tests showing byte equality and a replay showing
  that every stored digest still recomputes.

Graduated from [`explorations/protocol-as-value`](../../explorations/protocol-as-value/README.md);
the shape is the 2026-11-10 entry in its `DECISIONS.md`, and the evidence it
starts from is
[`research/encoder-differential-2026-11-10.md`](../../explorations/protocol-as-value/research/encoder-differential-2026-11-10.md).

## Non-Goals

- No new canonical encoder. The work is adoption of the existing one.
- No rewrite of a stored digest, event file name, seal or parent chain.
- No journal, register or fold kit; no definition digest or normalizer; no
  protocol value, projection, transport or agent runtime. Those are gated
  candidates in the exploration's `MAP.md`.
- No digest channel inside `@beep/identity`.
- No unification of hashing backends (`@noble/hashes` and
  `effect/crypto/Digest` both stay where they are).
- No change to PartyKey v1 bytes or the `pk:v1:` grammar.
- No change to the indented renderers (`canonicalJsonTextPretty`, the
  OpenClaw document renderer) beyond recording them in the census.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/modeling/jsonc` (the `undefined`-member pre-pass and
  its tests).
- `packages/foundation/modeling/schema` (the prefixed digest grammar beside
  `Sha256Hex`).
- `packages/foundation/modeling/provenance` and
  `packages/foundation/capability/file-processing` (`SourceTextDigest` and
  `ContentDigest` derive from the shared grammar).
- `packages/foundation/modeling/epistemics/src/internal/CanonicalJson.ts`.
- `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketDigest.ts`.
- `apps/labs/semantica/src/corpus/Canonical.ts`.
- `packages/tooling/policy-pack/lint-rules` (one guard rule) and
  `biome.jsonc`.
- Any further encoder the census classifies as RFC 8785 on its domain.
- This packet.

## Constraints

- **Census first.** No encoder is replaced before the census row for it
  exists and the stored-digest replay for its record classes has passed.
- **Three classes.** Each encoder or digest preimage found is classified as
  RFC 8785 on its domain (replace), separately pinned by a specification
  (keep, with the reference), or a renderer (keep, and confirm no canonical
  digest is taken over its output).
- **Refuse, never coerce.** A value outside plain JSON is a typed failure
  from the owner. The one permitted pre-pass drops object members whose
  value is `undefined`. An `undefined` array element, a non-finite number, a
  bigint, a lone surrogate and a non-plain object are refusals.
- **Coerced history keeps its function.** If the replay finds a stored digest
  that depended on a coerced value, that record class keeps the old function
  under a name that says legacy, with a census row explaining why. Nothing
  is re-digested.
- **Exports stay.** `canonicalDetectionJson` and `canonicalJsonText` keep
  their names and signatures; only their bodies change. A replaced encoder
  that could throw before may throw the owner's typed error instead, and the
  change is listed in the pull request.
- **Grammar.** One algorithm prefix. The encoding version is not part of the
  digest string; the schema that names a preimage contract carries it. Bare
  `Sha256Hex` stays valid everywhere it is stored today.
- **Dependency edges.** `@beep/epistemics` and the semantica lab gain a
  dependency on `@beep/jsonc`. Confirm the edge against
  `standards/ARCHITECTURE.md` before the swap; `@beep/schema` must not import
  `@beep/jsonc`, which already depends on it.
- **One encoder per commit** in the swap slice, so a revert is one commit.
- Repository code laws apply (schema-first, Effect helper modules, titled
  JSDoc sections, `bun run beep quality package-verify` per touched package).

## Acceptance Criteria

- [ ] A tracked census lists every sorted-key encoder and digest preimage
      in package and app source with its class and disposition.
- [ ] A property test holds each replaced encoder byte-equal to
      `JsoncFingerprint.canonicalizeResult` on generated plain JSON, and it
      ran green before that encoder's body was replaced.
- [ ] A replay recomputes every stored PacketCore event digest in the tree
      and every execution-record seal fixture through the owner, with zero
      mismatches, or each mismatch has a legacy row in the census.
- [ ] A test fixes the refusal table: each non-JSON input class and the
      typed error the owner returns for it.
- [ ] `@beep/schema` exports the prefixed digest grammar, and
      `ContentDigest` and `SourceTextDigest` are defined from it with their
      encoded forms unchanged.
- [ ] `rg` finds no sorted-key JSON encoder outside `@beep/jsonc` except the
      census rows classed as pinned, renderer or legacy.
- [ ] A lint rule rejects a new one, and it is wired into the single lint
      pass.
- [ ] `explorations/protocol-as-value/MAP.md` still lists the three gated
      candidates; this goal activated none of them.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/canonical-digest-owner/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/canonical-digest-owner/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/canonical-digest-owner` | Passes |
| Touched packages | `bun run beep quality package-verify <package>` for each | Passes |
| Differential property test | the test added in slice A | Passes |
| Stored-digest replay | the replay added in slice A | Zero unexplained mismatches |
| Lint | `bun run lint` | Passes with the new guard active |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add canonical-digest-owner --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug canonical-digest-owner`; add a `kind: decision` file there, never edit this block._

### Appetite: four slices; no kit, normalizer or protocol value, 2026-11-10

Four slices, each its own pull request: census and proof, owner surface, swaps, guard. The journal kit, the definition digest and the protocol kit stay gated in the exploration's MAP.md; a fired gate reopens the exploration. Unifying hashing backends and changing PartyKey v1 bytes are out. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.

Lane docs/protocol-as-value-graduate

Reverse: Reopen explorations/protocol-as-value at decompose when a MAP gate fires; do not widen this goal.

### Canonical bytes are RFC 8785 and @beep/jsonc owns them, 2026-11-10

The canonical byte form is RFC 8785 output and JsoncFingerprint in @beep/jsonc is its only implementation. A new encoder in @beep/schema was rejected: @beep/jsonc already depends on @beep/schema, so that would be a cycle or one more copy. A differential run found the epistemics, PacketCore and semantica encoders byte-identical to it on plain JSON. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.

Lane docs/protocol-as-value-graduate

Reverse: Supersede with a decision naming another owner; the swaps are import changes held byte-equal by test, so reverting them restores the old encoders.

### A stored digest that depended on coercion keeps its old function, 2026-11-10

If the stored-digest replay finds a digest computed over a coerced value, that record class keeps the previous function under a legacy name and gets a census row saying why. No stored digest, event file name, seal or parent chain is rewritten by this goal. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.

Lane docs/protocol-as-value-graduate

Reverse: Re-digest that record class under a migration decision that lands its reversal path first.

### One sha256: digest grammar in @beep/schema; no encoding version in the string, 2026-11-10

A self-describing digest is sha256: plus 64 lowercase hex digits, the form ContentDigest and SourceTextDigest already use. @beep/schema owns it beside Sha256Hex and domain digests brand over it. The encoding version stays out of the string: the schema naming a preimage contract carries it, so two digests of the same bytes never differ for a reason the hash cannot see. Bare Sha256Hex stays valid wherever it is stored. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.

Lane docs/protocol-as-value-graduate

Reverse: Add a second algorithm prefix or a versioned form in a superseding decision; stored values keep decoding because the grammar only widens.

### Refuse values outside plain JSON; drop only undefined members, 2026-11-10

The owner returns a typed failure for a non-finite number, a bigint, a lone surrogate, a non-plain object and an undefined array element. One named pre-pass drops object members whose value is undefined, because every legacy encoder and JSON.stringify already treat such a member as absent. The legacy encoders coerced the rest silently, so two different values could share a digest. Source: the 2026-11-10 entry in the DECISIONS.md of explorations/protocol-as-value.

Lane docs/protocol-as-value-graduate

Reverse: Widen or narrow the pre-pass in a superseding decision and update the refusal-table test with it.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
