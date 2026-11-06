# Authenticated source through verified extraction

The private verified-extraction composition starts from a genuine prerequisite
VerifiedSourceText capability. It invokes the actual primitive request using
that capability's immutable text as either plain or markup input. It then runs
original cleaning/tokenization/construction, semantic projection, canonical
source derivation and primary/full-span/warning adaptation under one captured
operation permit, deadline, Scope and cumulative text authority. Returned
extract requires no caller services. Existing Effect stage/Context owners are
reused; no queue, worker protocol or evidence capability is reimplemented.

The test resolver still uses the public verifier to provide authenticated
input. It no longer manufactures output proofs for this path: output evidence
is issued by the production composition. Source identity/mention semantics and
all prior raw model comparisons remain distinct from final public service
acceptance.

## Source manifestation protocol

When tokenizer text equals the authenticated input text, the original immutable
proof and source identity are retained. A new extractor identity is unnecessary
for the identical manifestation. The original plain eyecite shortcut preserves
this proof, leaves ignored mode getters unread and returns unverified semantic
data rather than a fabricated occurrence; it starts no native child.

Changed text retains its parent's scopeRef, sourceRef, locator and
sourceDigest. The locator-only normalizationVersion is preserved; text
extraction does not silently redefine that normalization protocol. The new
textDigest is SHA-256 of the exact output text, and the public verifier
independently checks it before issuing a capability. The extractor is
citation-document-text with version `csd1:<sha256>`, with the derivation digest
after the colon. That digest commits the ordered tuple:

1. citation-source-derivation/v1;
2. the complete parent SourceTextIdentity;
3. the trusted server-supplied engine artifact;
4. source role, clean-step sequence/None and named container mode;
5. the new text digest.

The mode tuple is snapshotted through its schema codec. Ambiguity filtering
does not change text production and is excluded from the source derivation key.
Parent identity is retained explicitly in the result. The existing cm1 producer
uses the resulting canonical manifestation identity without a token-protocol
change. An HTML-derived anchor refers to that extracted text, never to raw HTML
coordinates under the old identity. Artifact-byte authorization remains the
upstream resolver's responsibility; this composition retains its supplied link.

The derivation helper alone does not certify that arbitrary supplied output was
computed from its parent. The composition establishes that relation by invoking
the actual entry from the authenticated input. Engine artifact authentication
and complete production asset loading remain live Layer duties.

## Source, identity and ownership evidence

Both Bun and Node replay three original documents: ordinary plain text, a
non-BMP case name and actual raw HTML. Complete original raw models, metadata,
editions, spans, filtering, warnings and returned-entry identity compare.
Output proofs are genuine; all primary/full spans verify against the produced
canonical text. Plain/Unicode inputs preserve their original capability.
Changed HTML produces a different text/extractor identity while preserving
artifact lineage. Final reservation totals equal the occurrence stage's
enclosing total and exceed the preceding semantic-stage total. Existing
one-permit and acknowledged native retirement checks pass without outstanding
capacity. Full 36-document replays are registered for hosted integration and
remain pending.

Focused derivation controls prove deterministic replay, retained parent fields,
changed extractor versions for changed engine/container mode with the same
output text digest, exact Unicode output and refusal of a lone-surrogate
manifestation. The source verifier never issues malformed text evidence. A
structural forged input proof refuses before work, and poisoned shortcut mode
getters stay unread. The pure derivation controls start no native child.

The first integrated Bun/Node replay passes two tests in 25.30 seconds. Source
and prior semantic/occurrence regression passes five tests across three files
in 55.22 seconds. After final assertion-helper organization and schema
annotations, the three verified-extraction/derivation tests pass again in 25.08
seconds. Package lint/type/test checks, declaration emission, blocking laws and
codec lint pass. Scoped checks show no new cognitive excess or clone group for
the new modules/tests; hosted proof remains authoritative.

A declaration check exposed TS4094 when inferred exported functions retained
the prerequisite's anonymous private capability class. Explicit public
proof-result contracts and the standard Effect dual overload preserve the
opaque public alias without a cast, structural replacement or suppression. The
test assertion helper uses the existing Effect generator form so its exported
contract remains typed.

Hosted Fallow passes on preceding head
fd23d670cc71778a54562d729e5523d2315e24c8, Check run 42255380840, job
128021247794. Hosted confirmation of this wave remains pending.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationVerifiedExtraction.test.ts \
  test/CitationCanonicalSource.test.ts test/CitationSemanticExtraction.test.ts
```

This remains a private builtin primitive profile. Public request/error/service/
Layer publication, authenticated runtime assets and engine artifact production,
final detached/document integration, remaining components/footnotes,
transforms, broad host/subclass/equality/mutation/alias behavior, exhaustive
accounting and whole-engine safety/scaling remain open. In particular, this
focused evidence does not close metadata serialization/allocation ownership for
the whole engine. All eleven representation laws, four fidelity questions and
fifteen unfinished proof rows remain open without a semantic waiver or
goal-completion claim.
