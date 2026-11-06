# Verified occurrence identity production

Date: 2026-10-28. Local P1 implementation; P0/P1 and the full goal remain open.

## Implemented behavior

The private server module `internal/Citation/MentionIdentity.ts` now produces
`CitationMentionId` from a genuine public prerequisite `VerifiedTextAnchor`,
a content digest identifying the engine artifact, and a bounded semantic
union discriminant. The producer re-decodes its input to reject structural
anchor look-alikes and persisted receipts. Restoration requires resolving the
canonical raw text and re-verifying the receipt through the prerequisite API.
No source identity, offset converter or proof capability is copied locally.

The cm1 preimage is a schema-encoded compact JSON tuple, in this exact order:

1. Protocol literal `citation-mention/v1`.
2. Engine artifact SHA-256 hexadecimal digest.
3. Semantic citation discriminant.
4. Source scope reference.
5. Source reference.
6. Source locator.
7. Artifact digest with its `sha256:` prefix.
8. Raw-text digest with its `sha256:` prefix.
9. Extractor name.
10. Extractor version.
11. Normalization version.
12. Raw UTF-16 start.
13. Raw UTF-16 end.
14. Exact verified quote.

The tuple fixes field order and boundaries even when fields contain delimiters.
SHA-256 of its UTF-8 bytes becomes the lowercase digest after `cm1:`. Input
snapshots are encoded before the asynchronous hash. Stage names, run IDs,
consumer array positions and grouping are absent. Changing the tuple or its
encoding protocol requires a new token version; cm1 must not be reinterpreted.

`Sha256HexFromBytes` supplies the Effect `Crypto` dependency. The private
function explicitly returns only `CitationMentionId`, its finite typed failure
and `Crypto`. No native runtime hashing or ambient configuration is introduced.
The eventual live Layer must capture Crypto and map the private error into the
closed engine boundary union. Both schema and digest failures discard their
underlying issue/cause so raw source and adapter messages do not escape.

## Evidence and remaining integration

The test source is `server/test/CitationMentionIdentity.test.ts`. It covers:

- a digest independently computed with Python SHA-256 over the frozen tuple;
- property-order independence, identical replay and consumer reordering;
- distinct occurrences of the same quote after an astral Unicode prefix;
- each source identity field, engine artifact and semantic discriminant;
- persisted/decoded/look-alike receipt rejection and successful re-verification;
- malformed input rejection, finite failure reasons and sanitized crypto errors;
- delimiter-bearing identity fields and mutation at the hash boundary.

The fixed vector uses raw text `😀 1 U.S. 1; 1 U.S. 1`, UTF-16 range `[3,11)`,
quote `1 U.S. 1`, and the source/engine inputs written explicitly in the test.
Its expected token is
`cm1:dc70e426b0b9aa61caf21a5e6e0c7274720c7e674ff2b06a8cdfd82ee0346ae9`.

All new production code remains behind the package's `./internal/*: null`
export guard; no barrel, export map or public service changed. Named schema
field descriptors preserve the prerequisite's public opaque type in declaration
output without exposing its private implementation class.

This producer does not establish semantic citation correctness, construct the
engine artifact, define authority keys, remove legacy mixed schemas or finish
any parity row. The integrator must supply the discriminant from the final
semantic union and a reproducible engine artifact covering its code and data.
Authority keys must retain frozen distinctions when current reporter IDs
collapse historical aliases. Those obligations remain open.

## Verification

Run `bun run beep quality package-verify @beep/law-practice-server` from the
feature worktree. The gate builds prerequisite packages before checking the
server, including declaration output, tests, lint and documentation generation.
The successful full package gate took 41.6 seconds for audit and 12.5 seconds
for documentation generation. Its test run includes all six producer tests.
Goals doctor reports no new blocking findings. The focused test command is:

```sh
bun run --cwd packages/law-practice/server test -- test/CitationMentionIdentity.test.ts
```

Supporting cache logs: `mention-id-build.log`, `mention-id-test.log` and
`mention-id-package-verify.log`. Initial declaration failures were repaired by
using the existing named field-descriptor pattern for opaque prerequisite
proofs. No workaround changes or weakens the proof schema.
