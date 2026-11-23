# Mention ids move to cm2 (2026-11-22)

The text-knowledge-stack-rebuild goal (P2, L1 text) derives every citation
mention id from the `OccurrenceId` of its verified anchor
([design](../../text-knowledge-stack-rebuild/research/2026-11-20-p2-design.md),
section 5). This packet's evidence predates that change. Its `cm1:` values are
still correct for the code they were captured from and are not edited.

## What changed

- `CitationMentionId` is `cm2:` plus 64 hex: the content hash of
  `citation-mention/v2` over the engine artifact, the semantic kind and the
  anchor's `OccurrenceId`, without its `sha256:` prefix. The `cm1` encoder is
  kept, pinned and unused by any minting path, in
  `packages/law-practice/server/src/internal/Citation/MentionIdentityV1.ts`.
- The case-occurrence authority key embeds a mention id, so its tag is now
  `citation-authority/v2`. The case, law, journal and external-resource keys
  keep `citation-authority/v1` and their ids; `ca1:`, `cl1:`, `cg1:` and `cd1:`
  prefixes are unchanged.
- Receipts are `citation-document-receipt/v4` and
  `citation-mention-receipt/v2`. A stored v3 or v1 receipt converts on read
  through `internal/Citation/ReceiptRead.ts`, which recomputes each stored `cm1`
  and refuses a mismatch; it never writes the old versions.
- `packages/law-practice/use-cases/test/fixtures/eyecite/authority-identity-cases.json`
  is regenerated in place as `citation-authority-identity-cases/v2`: the 13
  `mentionId` inputs carry `cm2:` over the same synthetic hex, and the two
  missing-page `expectedId` values are recomputed. The oracle equality matrix
  and the other 11 ids are as captured.

## Reading the old evidence

- `cm1:` values in `evidence/` were minted by the v1 protocol over the same
  source fields, range, quote, engine artifact and semantic kind. The pinned
  encoder reproduces them; `CitationMentionIdentity.test.ts` checks one beside
  its `cm2` id.
- A `ca1:` value of a missing-page case in `evidence/` is a v1 case-occurrence
  key. Every other `ca1:` value is still current.
- The decisions are in the rebuild packet:
  `decisions/2026-11-22-p2-citation-mention-v2-identifiers.md`,
  `-p2-receipt-read-transform.md` and
  `-p2-authority-identity-cases-regenerated.md`.
