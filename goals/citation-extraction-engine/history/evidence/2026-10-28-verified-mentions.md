# Verified mentions and persisted receipts

Date: 2026-10-28. Local P1 checkpoint; P0/P1 and the goal remain open.

## Composition and trust

`CitationMention` composes the existing canonical semantic union with a cm1
occurrence ID, engine artifact digest, primary verified raw UTF-16 anchor,
named component anchors, optional footnote zone, optional signal, typed
warnings and optional unit-interval evidence confidence. The raw matched
text is the primary anchor quote, with no separately mutable text field.
Canonical cleaned token text may differ and still needs processing evidence.

Components may repeat names and extend beyond the primary token, as canonical
full/pin-cite spans can. Every attached anchor must share the primary source.
An optional footnote zone must contain the primary anchor. Zone metadata is a
producer assertion, not an implemented footnote detector or adopted extension.
The overlap warning names the preceding mention ID; its emission, privacy and
normalization proof remain open. It follows the canonical overlap branch that
retains both citations, without claiming that branch is implemented.

The runtime schema requires the prerequisite's genuine verified-anchor
capability. Its separate versioned `CitationMentionReceipt` is structural
persisted data using the same semantic citation codec. A receipt is not proof
and cannot be decoded as a runtime verified mention. Persist through the
explicit receipt projector, not a generic JSON round-trip of capabilities.

Private server helpers create, project and restore mentions. They snapshot
caller-owned semantic and receipt data before asynchronous digest work. The
projector recomputes cm1 before persistence. Restoration compares the expected
engine artifact, verifies the canonical raw source once for all anchors of
that mention, re-verifies each anchor and recomputes cm1. It rejects source,
quote, normalization, engine and ID drift without retaining sensitive causes.
The private helper error is not part of the future closed public error union.

The cm1 digest binds source identity, engine artifact, primary anchor and
semantic discriminant. It does not authenticate semantic metadata, prove an
engine installation, or certify a classification. Expected source and engine
identity must come from the trusted caller. The source UTF-16 hard ceiling is
enforced on restore; complete operation budgets, deadlines and isolation are
still obligations of the future live engine Layer.

## Verification

Thirteen focused tests include a 25-run schema-generated Unicode-prefix
property using astral characters, combining characters, CRLF and whitespace.
They exercise receipt round-trips, fresh runtime proofs, genuine-capability
checks, same-source and zone constraints, stale identities/artifacts,
caller mutation during hashing, sanitized failures, source hashing once per
mention, and rejection above the one-million UTF-16 source ceiling before
hashing. Fixtures are composition evidence, not extraction parity evidence.

Domain package audit/docgen passed in 10.7/9.8 seconds; server package
checks passed in 51.9/11.1 seconds. Package verification includes builds,
type checks, tests, lint and documentation. The downstream use-case package
also passes its package gate. The ten-component audit, goals index, goals
doctor and new-note/README Markdown checks pass. Reproduce with:

```sh
bun run beep quality package-verify @beep/law-practice-domain
bun run beep quality package-verify @beep/law-practice-server
bun run beep quality package-verify @beep/law-practice-use-cases
bun run --cwd packages/law-practice/use-cases citation:parity-check --audit
```

The ten-component accounting audit remains separate from target parity. No
canonical, donor, divergence or safety proof row is promoted by this work.
Document relationships, authority-key production, lawful Bluebook transforms,
the bounded parser and full corpus comparison remain unfinished.
