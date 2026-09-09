# Instance

- id: `r26-cli-commands-l-q-osv-ignore-expiry`
- source: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus: `origin/main@52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/Quality.osv-ignore.ts:20`
- symbol: `OsvIgnoreEntry`
- members: `expiryMalformed`, `ignoreUntil`
- evidence: E3/E4 at `Quality.osv-ignore.ts:50-64` — the parser derives both
  members from one optional raw value. A present parseable value produces a
  DateTime payload with malformed false; an absent value produces no payload
  with malformed false; a present unparseable value produces no payload with
  malformed true. Payload-present plus malformed is impossible.

# Current shape

The private `OsvIgnoreEntry` type carries an advisory ID, an optional parsed
DateTime, and a boolean saying a raw expiry existed but failed to parse. The
block parser reads the one `ignoreUntil` token, parses it, and separately
reconstructs malformed presence (`Quality.osv-ignore.ts:13-69`). The active
predicate first rejects the malformed bit, then matches the optional payload:
no expiry stays active; a valid future/current expiry stays active; a valid
past expiry is dropped (`Quality.osv-ignore.ts:71-84`). Selection partitions
IDs into active and dropped arrays, and `runBunAudit` logs dropped IDs before
constructing `bun audit --ignore` arguments (`Quality.osv-ignore.ts:105-124`;
`Quality.command.ts:757-783`).

The repository config contains valid expiry payloads at
`osv-scanner.toml:21-28`. Public helpers accept raw TOML text and return only
ID arrays; `OsvIgnoreEntry` itself is not exported or encoded.

# Cardinality gap

The boolean plus Option presence represents four combinations. Three expiry
roles are legal:

| Expiry role | `expiryMalformed` | `ignoreUntil` |
| --- | --- | --- |
| absent | false | None |
| valid | false | Some(DateTime) |
| malformed | true | None |

Malformed with a DateTime payload cannot result from the single raw field.
Expired versus active is a time-relative decision over the valid payload, not
another stored variant.

# Target schema

Define a private annotated `OsvIgnoreExpiry` tagged union from LiteralKit with
`absent {}`, `valid { ignoreUntil: DateTime }`, and `malformed {}` cases, using
the existing Effect DateTime value type/schema convention. Make
`OsvIgnoreEntry` a schema-first private model containing `id` and one
`expiry`. Parse the raw token directly into exactly one case and match that
case when deciding activity.

The malformed case does not invent a raw-string payload because current code
discards it and exposes only the ID as dropped. The valid case owns the parsed
DateTime. Do not retain `expiryMalformed`, an optional `ignoreUntil` sibling,
or boolean getters.

# Migration inventory

- `packages/tooling/tool/cli/src/commands/Quality/Quality.osv-ignore.ts:8-12`
  — add the narrow schema/LiteralKit imports and reuse the package identity
  composer convention for the private models.
- `Quality.osv-ignore.ts:13-28` — replace the type literal's boolean/Option
  pair with the annotated expiry union and schema-first entry model. Keep the
  regex and ID field unchanged.
- `Quality.osv-ignore.ts:50-66` — classify raw expiry absence, successful
  `DateTime.make`, or parse failure once. Preserve accepted quoted/bare token
  syntax and omission behavior.
- `Quality.osv-ignore.ts:68-84` — match `expiry`: absent is active, malformed
  is inactive, and valid uses the same inclusive `ignoreUntil >= now`
  comparison.
- `Quality.osv-ignore.ts:105-124,154-160` — preserve stable input order,
  duplicate-ID behavior, active/dropped projection, dual call forms, and
  exported helper signatures.
- `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:757-783`
  — no decoded migration. Preserve file-read failure behavior, dropped-ID log
  ordering/text, and exact Bun arguments.
- Add focused tests through `@beep/repo-cli/test/Quality`; no internal entry
  model needs to become public solely for testing.

# Guard-deletion accounting

Delete `ignoreUntil: Option<DateTime>`, `expiryMalformed`, the
`isSome(rawIgnoreUntil) && isNone(ignoreUntil)` reconstruction, the
`!entry.expiryMalformed` filter, and the nested Option match over
`entry.ignoreUntil`. One expiry-union match owns malformed rejection, absent
acceptance, and valid-date comparison.

# Encoded-side impact

None. `OsvIgnoreEntry` is private derived parser state. Preserve raw
`osv-scanner.toml` syntax, regex acceptance, exact ID selection and ordering,
the inclusive time boundary, dropped-ID console text, and `bun audit` command
arguments. The tagged representation is never persisted or serialized, and
the exported raw-text helper inputs and ID-array outputs remain unchanged.

# Test impact

Add synthetic TOML cases for absent expiry, valid future, exact-now, valid
past, malformed bare and quoted values, omitted IDs, multiple blocks, and
stable active/dropped order. Assert malformed and expired IDs are logged and
excluded from `--ignore`, while absent and nonexpired IDs retain their current
arguments. Use only synthetic advisory IDs and times; do not invoke OSV or Bun
audit over the network. Run focused Quality parser/command tests and full
`@beep/repo-cli` package verification during implementation.

# Risk and sequencing

Land in the Tier 1 tooling batch. The fail-closed security behavior is the
principal risk: malformed and expired entries must never suppress an advisory,
while an omitted expiry remains active and equality remains active. Preserve
the parser's accepted text forms, time comparison direction, selection order,
logging, and command failure precedence.
