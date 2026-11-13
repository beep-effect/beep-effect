# Canonical Digest Owner

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

RFC 8785 is the one canonical byte form, `@beep/jsonc` owns it, digests
share one `sha256:` grammar, and the hand-rolled encoders are replaced with
proof that no stored digest changes.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/canonical-digest-owner/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

Slices A (census and proof), B (owner surface) and C (swaps) are done; slice
D (guard) is next. The work is four slices, A to D, listed in
[`PLAN.md`](./PLAN.md).

## Latest Evidence

Slice C review round 1, 2026-11-13: the digest helpers and schema checks
that already had a `SchemaError` channel now report the owner's refusal there
instead of throwing, through a `Result` twin beside each swapped export. A
tampered event with an unpaired surrogate reads as a chain issue again, and
no lab schema check can throw on one. The exports still throw; `PLAN.md`,
"Slice C evidence", lists what is typed and what still throws.

Slice C, 2026-11-13: the epistemics, PacketCore, semantica and `@beep/md`
frontmatter encoders are now `JsoncFingerprint`, one commit each; only
PacketCore passes `omitUndefinedMembers`. Every stored packet event, golden
execution seal and the W1 corpus hash still recompute. Values outside plain
JSON, an unpaired surrogate above all, are now the owner's typed refusal; the
call sites where free text can reach one are listed in `PLAN.md`, "Slice C
evidence". PartyKey v1 keeps its bytes and gains a parity proof, and the two
`sha256:` regular expressions in `@beep/repo-cli` are now
`Sha256PrefixedDigest`.

Slice B, 2026-11-12: `@beep/schema` exports `Sha256PrefixedDigest`, the one
`sha256:` grammar, and `ContentDigest` and `SourceTextDigest` are defined from
it with their encoded strings unchanged. `JsoncFingerprint` takes
`JsoncCanonicalizeOptions`, whose `omitUndefinedMembers` leaves out an object
member read as `undefined` and nothing else; a refusal table in the package's
tests fixes what the owner answers for every other value outside plain JSON.

Slice A, 2026-11-12: the census
([`research/encoder-census.md`](./research/encoder-census.md)) classes 157
rows and finds four replace-class encoders and no legacy row. Tracked tests
hold those encoders byte-equal to `JsoncFingerprint` on generated plain JSON,
and all 76 stored packet event digests and the four golden execution seals
recompute through it ([`research/slice-a-evidence.md`](./research/slice-a-evidence.md)).
The evidence the goal started from is the encoder differential,
[`explorations/protocol-as-value/research/encoder-differential-2026-11-10.md`](../../explorations/protocol-as-value/research/encoder-differential-2026-11-10.md).

## Notes

- Graduated 2026-11-10 from `explorations/protocol-as-value`. Its `MAP.md`
  calls the slices P0 to P3.
- The exploration's larger ideas (definition digest, chain kit, protocol
  kit) are gated there. A fired gate reopens the exploration; it does not
  widen this goal.
- Sibling work that was told not to mint a competing encoder can point here:
  `goals/oracle-loop-poc/QUESTION-BINDING.md`,
  `explorations/typed-agent-skill-contracts`,
  `explorations/remote-skill-activation-conformance`.
