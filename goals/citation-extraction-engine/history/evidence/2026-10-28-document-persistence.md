# Whole-document persistence and source restoration

Date: 2026-10-28. Local P1 checkpoint; full parity remains unfinished.

## Runtime integration

The private server `Document.ts` projector validates a runtime document and
copies all structural receipt data and trusted edition descriptors through one
schema JSON snapshot before the first digest. It captures the genuine primary
anchor capabilities separately, recomputes every cm1 ID and checks every
resolved full citation's ca1 key. This includes non-representative full members;
checking only each authority representative would allow inconsistent grouping.
The projected receipt retains document-owned edges and no runtime capabilities.

Restoration snapshots the entire request, compares the trusted expected engine
artifact, verifies the canonical raw source once and reuses its genuine
`VerifiedSourceText` capability for all mention/component/footnote anchors.
The extracted private mention helper checks the receipt's source identity and
engine, restores fresh anchor capabilities, and recomputes its occurrence ID.
The original single-mention restoration uses the same helper after its existing
source verification. Its round-trip, mutation and privacy tests remain active.

After all mentions are restored, document restoration verifies every resolved
full authority key and checks graph coherence before returning the runtime
document. Empty documents still verify their canonical source. Stale mention
or authority tokens fail even when a caller has rewritten all graph references
consistently. Changes to raw quote/text or source/engine identity also fail.

`CitationAuthorityEdition` is one private schema reused by the existing
identity input and the new document adapter. A lookup snapshot cannot contain
duplicate edition references. Descriptor spelling remains trusted adapter data:
these helpers check reference coherence but do not authenticate an installed
artifact. The live Layer must establish the artifact and expected identities.
The document/mention failures stay private and sanitized; the final public
engine boundary still needs its closed error mapping.

## Trust and scope

The checks prove source evidence, digest coherence and relationship structure.
They do not authenticate legal classification, non-key metadata, short-form
resolution correctness or an installed engine. A forged semantic assertion
with correspondingly recomputed keys is still an assertion, not parser proof.
The current adapter verifies default semantic resource keys. Canonical custom
resolver/resource-identity callbacks still need explicit ports and key policy
before production exposure; this checkpoint does not implement or reject them.
No Python, donor, filesystem or configuration access enters the helper code.

Only the published source UTF-16 hard ceiling is enforced on restoration here.
Effective operation budgets, complete message/collection limits, deadlines,
queue admission and interruption remain live-engine work. Sharing a source
capability avoids repeated document hashing; it is not complete safety proof.
The internal helpers retain Crypto as an explicit dependency; the final live
Layer must capture it so public service methods have R = never.

## Focused verification

Nine document tests cover complete JSON receipt round-trip and fresh proofs;
source hashing once across multiple mentions and attached component/footnote
evidence; caller mutation during both projection and restoration; coherent
stale-ID rewrites; incorrect non-representative full membership; raw quote,
text and engine drift; missing/duplicate descriptors; a genuine capability for
a different source identity; empty documents and the UTF-16 ceiling.

For the three-mention fixture, restoration makes exactly six digest calls:
one source digest, three occurrence IDs and two resolved full authority keys.
The component and footnote anchors add no source digest. The fixture is
composition/identity evidence, not extraction or canonical resolver proof.

The full server package gate passes (audit 33.2 seconds, docgen 11.5 seconds),
including build/type checks, tests, lint and documentation. Existing mention
and authority suites pass with the shared-source helper and edition schema.
The nine new document tests pass. The ten-component evidence audit and goals
index/doctor also pass, with target parity still pending. New-note/README
Markdown checks pass. Logs use `document-runtime-` in the cache.

Reproduce with:

```sh
bun run beep quality package-verify @beep/law-practice-server
bun run --cwd packages/law-practice/use-cases citation:parity-check --audit
```

No accounting, donor, divergence or safety row is promoted. Full resolver,
Bluebook transforms, parallel/string/history behavior, bounded engine runtime
and complete target comparison remain open. The one-PR lifecycle is unchanged.
