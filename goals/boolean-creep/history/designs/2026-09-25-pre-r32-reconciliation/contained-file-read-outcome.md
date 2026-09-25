# contained-file-read-outcome

P2 source/design refresh at exact HEAD `f137beedb270a071d4aa2ecc1dd52a9d233044d1`.
Owner: `packages/tooling/tool/cli/src/internal/cli/FsGuards.ts:125-133`.
Status remains `designed`; stored/internal, tagged-union, Tier 1. This is not
independent P3 review, implementation acceptance, or a fresh census round.
Paths below are relative to `packages/tooling/tool/cli/` unless stated otherwise.

## Current shape

`ContainedFileRead` is an exported schema class with `exists: S.Boolean` and
`contents: S.Option(S.String)`. The reader at713-734 returns missing when a
parent or final entry is absent, existing-without-text for a non-file entry or
failed string read, and existing-with-text for a successful read. Empty text is
present text. A symlink or containment/inspection failure remains an
`FsGuardError`; it is outside the success carrier.

The current blast radius exceeds the previous design: Ack, two ProofLedger
reads, ProofJobLauncher record reads and three guard-only reads, and the Yeet
job-logs command all invoke this helper. The test-kit wildcard exposes both
schema and function. No direct serializer of this carrier was discovered;
that does not prove an exported codec has never been supported.

## Cardinality gap

The Boolean times Option-presence projection represents four tuples. Three
are legitimate outcomes:

| exists | contents | outcome |
| --- | --- | --- |
| false | None | missing |
| true | None | exists-not-text |
| true | Some(text), including empty string | exists-text |

False/Some contradicts the result's documented filesystem meaning and has no
producer. Text presence implies existence (E4); existence does not imply text.
The current schema nevertheless accepts all four, as a bounded runtime probe
confirms. The probe also executes missing-parent, missing-entry, directory,
nonempty text, empty text, symlink, and deterministically injected read failure
paths. This is baseline evidence of these paths, not a comprehensive filesystem
or concurrency proof.

## Target schema

Use private `ContainedFileReadDisposition = LiteralKit(["missing",
"exists-not-text", "exists-text"])` and three named schema class cases with
`kind` supplied through `S.tag` from the literal kit. Only `exists-text` carries
`contents: S.String`. Build the private decoded `ContainedFileReadOutcome`
union using the kit's members and `S.toTaggedUnion("kind")`; annotate the union
before `toTaggedUnion` so derived cases/guards/match are retained. Do not add
parallel handwritten literal types or a second optional payload bag. Writers
construct its schema-derived case directly; readers match the union. Constructors
omit a tag supplied by the schema default.

Retain exported `ContainedFileRead` as a compatibility codec from the existing
legal `{ exists, contents }` schema into the decoded union; expose its inferred
same-name Type alias. Use a private legacy boundary schema and `S.decodeTo` with
typed SchemaGetter/SchemaIssue handling, checked against the local Effect
reference at implementation. The old `.make({ exists, contents })` constructor
is replaced atomically in the repo; the public codec name remains. Do not cast
the transformed codec into a tagged union or assume it inherits `.cases`.
Construction and matching use the actual decoded union's helpers.

Decode the three legal old pairs, reject false/Some with a schema issue, and
encode each decoded case back to its corresponding old pair. No read-side
filesystem guard is moved into a codec. Do not create a success case for
symlink refusal or another typed filesystem failure. This retains the existing
encoded contract without inferring permission to remove it from lack of local
encoding calls; independent review must verify both transformations before apply.

## Migration inventory

- `src/internal/cli/FsGuards.ts:104-133` — replace the class with the literal
  domain, class members, decoded union, and compatibility codec. Reuse existing
  `LiteralKit` and `$I`. Update JSDoc to show codec decoding or current reader
  output, replacing `.make` and `.exists` examples.
- `FsGuards.ts:691-734` — update helper documentation and return type. Missing
  prepared parent at721 and missing entry at726 construct missing. Retain
  symlink refusal at728-729. At731-734, non-file or failed `readFileString`
  constructs exists-not-text; successful read, including empty text, constructs
  exists-text. Preserve read error suppression into this success state.
- `commands/Yeet/internal/Ack.ts:418-433` — outer Effect.option failure or
  missing gives unacked/null. Exists-not-text gives acked/null; exists-text
  alone feeds receipt decoding. Preserve invalid receipt handling and expired
  waiver handling, which can return unacked with the decoded receipt retained.
- `commands/Yeet/internal/ProofLedger.ts:54-71` — missing returns zero malformed
  rows and empty rows; exists-not-text preserves the exact unreadable-file
  YeetCommandError, including file field; exists-text preserves complete-line
  filtering and malformed-row count.
- `ProofLedger.ts:79-98` — exists-not-text preserves the same append refusal.
  Missing has empty recovery prefix. Exists-text adds a newline exactly when
  nonempty text lacks a terminating newline. Keep encoding and append errors.
- `commands/Yeet/internal/ProofJobLauncher.ts:167-181` — missing returns None;
  exists-not-text retains `Job record is not a readable regular file.` through
  the current guardError wrapper. Exists-text feeds the record codec and all
  identity/checkout/unit-name/log-path checks unchanged.
- `ProofJobLauncher.ts:192-195,378-381,395-398` — these are guard-only reads for
  record lock, jobs-root guard, and prune candidates. Keep the call, services,
  and error mapping; discard any success case exactly as now. Do not reinterpret
  exists-not-text as a new error at these callers or delete the read because
  its result is unused: no-follow checks are its purpose.
- `commands/Yeet/Yeet.command.ts:831-837` — job logs selects contents only from
  exists-text, else empty string for either missing or exists-not-text. Preserve
  read-error wrapper, newline trimming, tail count, and Console.log output.
- `src/test/Cli.test-kit.ts:11` — wildcard still exposes the stable codec name
  and reader. No new root export or alias is required. All known in-repo
  constructor/property consumers migrate atomically.
- `test/yeet-ack.test.ts:150-222`, `test/proof-ledger.test.ts:322-339`, and
  `test/proof-job.test.ts:790-819,1304-1317` — retain unreadable, symlink,
  missing-log, normal-tail, and non-regular record contracts. Add the specific
  codec and reader cases below. Existing generic FsGuards coverage in
  `test/cli-kits.test.ts` does not directly test this carrier today.

Graft exhaustive search covers five source files; a caller-edge query could
not resolve this Effect.fn symbol, so it provides no completeness evidence.
The source grep plus test-kit/barrel and test searches provide the inventory
above. Re-run this discovery against current main before implementation.

## Guard-deletion accounting

Delete the three old `.make` constructions' exists writes and their paired
Option coordination. Replace Ack's `!guardedRead.value.exists` and result
contents Option flatMap, ProofLedger load's `!read.exists` then None guard,
append's `read.exists && O.isNone(read.contents)` plus Option match,
ProofJobLauncher rawRead's !exists/None sequence and `.contents.value`, and
jobLogs' contents Option fallback with exhaustive outcome handling. Parsing a
receipt still yields an independent Option and retains its own checks.

The compatibility decoder owns one boundary check for the old incoherent
false/Some pair; no producer or normal reader reconstructs that pair. No
existing decoder guard is falsely claimed removed. The outer Ack
Effect.option, symlink/containment/inspection guards, guard-only calls, job
identity validation, waiver expiration, ledger newline checks, write hardening,
and provenance writer remain. They address independent facts, not this
carrier's coherence. Private decoded union constructors make the fourth
internal state unrepresentable rather than relocating its Boolean bag.

## Encoded-side impact

Preserve the old schema's **Effect Option-valued** encoded fields and absence
rules: `{ exists: false, contents: O.none() }`,
`{ exists: true, contents: O.none() }`, and
`{ exists: true, contents: O.some(text) }`. These are not newly claimed JSON
objects containing plain `_tag` fields. The local Effect Schema.Option encoded
type is Option of the inner encoded type, and the baseline encode probe confirms
runtime Option values. Both keys remain required; neither omission nor null is
silently introduced. Keep empty strings and arbitrary accepted string content.

The incoherent fourth tuple is rejected deliberately by the reviewed design,
not treated as a legitimate fourth filesystem outcome. Do not silently collapse
it into missing. No ack receipt, proof ledger row, job record, log file, CLI
output, or persisted path is re-encoded by this migration. Class instances,
constructors, and decoded property access migrate as allowed by the campaign's
atomic decoded-shape rider. This Tier 1 internal carrier still retains its
exported encoded projection as a bounded compatibility choice; no blanket
encoded-change permission is inferred. Apply the release policy to the final
implementation diff.

## Test impact

Add direct reader tests for missing parent and entry, directory/non-file,
successful empty/nonempty text, injected string-read failure, and target/parent
symlink refusal. Read failure must remain exists-not-text; inspection failure
must remain typed failure. Add codec decode/encode round trips for all three
legal encoded forms, key presence and Option runtime identity, preservation of
empty text, and rejection of false/Some. Test decoded union construction and
exhaustive consumer behavior without relying on transformed-codec case helpers.

Retain Ack missing/error, unreadable, invalid receipt, expired waiver, and
readable receipt behavior. Retain ledger parse, malformed/truncated final row,
append recovery, directory refusal, and error text. Retain proof job malformed
and identity-invalid records, non-regular file refusal, lock/list/prune
no-follow behavior, and job log empty/missing/non-file/read-failure output plus
newline/tail semantics. Run focused suites and full
`bun run beep quality package-verify @beep/repo-cli` when implemented. No package
suite or implementation validation ran during this P2 audit; the private probe
is bounded baseline evidence only.

## Risk

Land schema and every result consumer atomically. Collapsing exists-not-text
into missing would incorrectly unack receipts or silently replace unreadable
ledgers; treating guard-only or log reads as stricter would alter unrelated
behavior. Preserve the exported encoded projection and test its actual Option
representation. No implementation begins before replacement independent P3
review and GATE 2 evidence.
