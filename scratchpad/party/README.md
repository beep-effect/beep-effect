# Party scratchpad workflows

The production model lives in `@beep/party-domain`, `@beep/party-use-cases`
and `@beep/party-server`. Scripts remain here; the review page remains a local
scratchpad tool. All three executable scripts use package APIs. The graduated model, adapters,
fixtures and competency tests live in the packages; only the page-boundary tests
remain here. See the [coverage mapping](../../goals/party-slice/history/2026-11-03-competency-migration.md).

## Mail census

```sh
bun scratchpad/party/scripts/mail-census.ts <out.json> <filter-regex|-> <index.jsonl>...
```

Use `-` for no filtering. A supplied regular expression is case-insensitive and
matches the raw JSONL line. Only explicitly supplied input files are read.

Each input row uses the existing mail-index header fields and must also contain
`content: "party-sha256:<child-message-digest>"`. Obtain that value from the
message's provenance inventory. The legacy corpus index does not include it;
the parent archive's `sourceArtifactId` is **not** a valid substitute. The script
does not infer a digest from the path, headers or archive id, and does not enrich
private corpus files itself.

The output contains counts only. `rows` counts all selected nonempty lines,
`decodeFailures` includes malformed rows and rows without content identity, and
`events` counts successfully adapted communication events. Pairing support counts
distinct messages, so repeated extraction does not inflate that evidence count.
Names, addresses and identifier values are not included in the summary.

A run with decode failures still writes its partial count summary. Check
`decodeFailures` before interpreting it as coverage of the supplied input. Use
`--help` for command syntax; invalid regular expressions and file I/O errors fail
the command.

## Review-page compatibility

```sh
bun scratchpad/party/scripts/review-page-demo.ts <out.html>
```

The demo uses only synthetic records and graduated package models. The page
itself is unchanged. `ReviewPageAdapter.ts` converts sealed cases into its
existing flat JSON shape, verifies readable addresses against canonical keys,
and converts numeric times into ISO dates for presentation. Mailbox parties in
new page exports are shared integer ids; legacy string-party exports do not
match the new decision schema.

The page does not collect claim validity or source provenance. Its exported
`PageDecision` must be enriched through `PageDecisionInput` with an explicit
validity interval, extraction activity and evidence anchor before it becomes a
`CollisionDecision`. The adapter does not accept the verdict; `applyReviews`
still validates the current basis, complete partition and cross-case conflicts.
The identity-evidence script uses this adapter for page imports and rendering.

## Identity evidence workflow

```sh
bun scratchpad/party/scripts/identity-evidence.ts <out-dir> <graph-contacts.jsonl> \
  <practice-contacts.jsonl> <practice-links.jsonl> <filter-regex|-> <enriched-mail.jsonl>...
```

The mail inputs have the same explicit `content` requirement as the census.
Practice vocabulary is translated by the law-practice server adapter. National
Graph phone numbers require `--phone-country <ISO-country>`; without it they
remain reported ingestion issues instead of assuming a country.

The workflow writes:

- `identity-evidence.json`: counts only, including decode failures and review status.
- `pairing-claims.jsonl`, `contact-claims.jsonl`, `card-merge-proposals.jsonl`:
  Proposed claims. Matching contact addresses do not accept a person merge.
- `source-assertions.jsonl`: source evidence referenced by output claims.
- `review-cases.jsonl`: current sealed cases with integer mailbox parties.
- `review.html`: local page for unsettled cases.
- `review-claims.jsonl`: accepted claims only from decisions that settle against
  the current evidence and resolution scope.

All outputs except the count summary contain evidence or identifiers. Keep the
output directory outside the repository. A role/shared-address flag in any
contact source suppresses merge proposals for that address.

Place exported decisions in `<out-dir>/review-decisions.jsonl`. Native
`CollisionDecision` records already carry validity and provenance. Page exports
require explicit `--review-valid-from <epoch-millis>` and optionally
`--review-valid-to <epoch-millis>`; omitting the latter selects an open endpoint.
These options are the operator's validity assertion, not an inference from mail
observation dates. The workflow rejects page imports without that context.
Malformed decisions are counted, and stale or conflicting decisions emit no
accepted claims. Empty output JSONL files contain zero records.

The ledger is memory-only. Identical ordered inputs reproduce provisional
integer allocation, but changed inputs can change anchors and invalidate old
case bases. This workflow does not provide durable party storage or import old
string-party decisions as integer identities.

## Local validation

```sh
bunx tsrs -p scratchpad/party/tsconfig.json
bunx vitest run --config scratchpad/party/vitest.config.ts
```

Fixtures and command smoke checks must use synthetic records. Do not copy private
corpus data into this directory or commit generated review outputs.
