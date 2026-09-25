# contained-file-read-outcome

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 4/3. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `ContainedFileRead` at `packages/tooling/tool/cli/src/internal/cli/FsGuards.ts:128`,
with members `exists`, `contents`.
Storage/exposure: stored/internal; target: tagged-union.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/contained-file-read-outcome.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

## Current shape

`readContainedFileStringNoFollow` returns an exported schema class containing
an existence bit and optional text. The pair distinguishes a missing target
from an entry that exists but is not a readable regular text file, but it also
represents the incoherent `exists: false`/`Some(contents)` tuple. A rejected
symlink remains a typed `FsGuardError`, outside the result value.

## Cardinality gap

Four boolean/presence combinations are representable and three outcomes are
legal: `missing`, `exists-not-text`, and `exists-text({ contents })`.

## Target schema

Define a named `ContainedFileReadDisposition` LiteralKit with `missing`,
`exists-not-text`, and `exists-text`. Use its members to build a tagged
`ContainedFileRead` union; only `exists-text` owns `contents: S.String`.
Keep `ContainedFileRead` as the stable exported test-kit schema name and use a
transform at its existing schema boundary so the encoded projection remains
the old legal `{ exists, contents }` object. Decode must reject the incoherent
false/Some tuple. Writers construct one outcome directly; readers match the
tag exhaustively. Do not turn filesystem failures or symlink refusals into
additional success cases.

## Migration inventory

- `FsGuards.ts:104-133` — replace the two-field class with the named literal
  domain, tagged cases, union, and legacy encoded projection; update its JSDoc
  example and preserve the existing identity/description.
- `FsGuards.ts:691-713` — construct `missing` for a rejected/missing prepared
  target or absent entry, `exists-not-text` for a non-file or failed string
  read, and `exists-text` for a successful string read. Preserve no-follow
  inspection and the `FsGuardError` symlink path at lines 706-707.
- `commands/Yeet/internal/Ack.ts:384-402` — match the outer read error/missing
  cases to unacked, decode a receipt only from `exists-text`, and retain
  `exists-not-text` as acked with a null receipt.
- `commands/Yeet/internal/ProofLedger.ts:50-72` — map `missing` to an empty
  ledger, preserve the exact unreadable-file error for `exists-not-text`, and
  parse complete rows only from `exists-text`.
- `commands/Yeet/internal/ProofLedger.ts:74-98` — preserve the same error on
  append, the empty prefix for `missing`, and truncated-line recovery for
  `exists-text`.
- `src/test/Cli.test-kit.ts:11` — no barrel edit is required; its wildcard
  continues exposing `ContainedFileRead` and the reader through
  `@beep/repo-cli/test/Cli`. No package-root export exists.
- `test/yeet-ack.test.ts:150-168` — preserve the existing unreadable receipt
  contract. `test/proof-ledger.test.ts:80-337` covers missing, readable,
  malformed/truncated, and unreadable ledger behavior; add a focused schema
  projection test for all three legal cases and rejection of false/Some.
- Whole-source search found no other writer or reader of `ContainedFileRead` or
  `readContainedFileStringNoFollow`.

## Guard-deletion accounting

Delete all three construction-site `exists` writes, all construction-time `Option`/existence
coordination, Ack's `!exists` branch, ProofLedger's `!read.exists`,
`read.exists && O.isNone(read.contents)`, and subsequent Option extraction.
The outer `Effect.option` in Ack and the no-follow/symlink/error guards remain
because they represent independent filesystem failure behavior. The incoming
write-only hardening at FsGuards.ts409-421 performs chmod(0o600) before writing
the temporary file, then preserves containment recheck and atomic promotion.
It is outside this read carrier; this design receives no deletion credit for
that operation or its typed failure mapping. ProvenanceFooter.ts538-542 now
uses the guarded writer and remains a write-only consumer, not a fourth read
result consumer.

## Encoded-side impact

The decoded model becomes a tagged union, while the existing schema's legal
encoded objects remain byte-for-value compatible: missing encodes as
`{ exists: false, contents: None }`, exists-not-text as
`{ exists: true, contents: None }`, and exists-text as
`{ exists: true, contents: Some(text) }`. Nothing persists this result today,
but retaining the projection avoids silently changing the exported test-kit
codec. Filesystem contents, ack receipts, proof-ledger rows, errors, and paths
are unchanged.

## Test impact

Add schema decode/encode coverage for the three legal projections and the
incoherent fourth projection. Retain Ack's missing, symlink/error, unreadable,
invalid receipt, expired waiver, and readable receipt tests. Retain proof
ledger missing/create, unreadable/non-file error text, malformed complete row,
truncated final row, newline recovery, and append behavior. Run the focused
FsGuards, Ack, and proof-ledger suites plus `@beep/repo-cli` package
verification when implemented. Preserve the new provenance mirror permission
and symlink regression at test/yeet-provenance-footer.test.ts721-751. No tests
ran in this source/design impact audit.

## Risk

Land the schema and all three readers atomically. The main risk is collapsing
`exists-not-text` into `missing`, which would unack an unreadable receipt and
silently replace an unreadable proof ledger. Keep no-follow path validation,
symlink refusal, and read failures exactly where they are.
