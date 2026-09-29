# R44 lanes `r44-foundation-schema-a-m` and `r44-foundation-schema-n-z`: independent reconciliation

Machine-readable companion: `r44-schema-independent.json`. That file has per-file hashes for all 270 files.

## Bindings

- Source is `862327c74e`; main and the merge base are both `8c16e648527a`. `packages/` has no diff against main. The only working-tree change is the round's untracked sweep directory.
- The seed (`3bb91f7f…`) is byte-equal to `data/inventory.jsonl` at HEAD.
- Lane map `49f953e6…`, frozen inputs `48306ccc…`, admission receipt `a6d055cf…`.
- All 270 assigned files match their `frozen-inputs` hashes:

| Lane | Files | Aggregate SHA-256 over sorted `path\tsha` |
|---|---|---|
| a-m | 188 `.ts` | `dc1aca6c…41c1a7` |
| n-z | 82 `.ts` | `e9b6d9cd…a8ca60` |

- The disk walk under the lane areas equals the included files, plus the two excluded `internal/test/*.test-kit.ts` files in a-m.

| Artifact | a-m | n-z |
|---|---|---|
| Prompt `.md` | `bf547894…` | `d395b2d0…` |
| Receipt | `f801969f…` | `eb85206f…` |
| Transcript (matches receipt) | `4c2b4775…` | `dc614c93…` |
| Validation log (`0 records`) | `6813e9e9…` | `6813e9e9…` |
| Raw report | 0 bytes, `e3b0c442…` | 0 bytes, `e3b0c442…` |

## Result

| Lane | Coverage | New qualified | New census | Classification changes | Metadata corrections |
|---|---|---|---|---|---|
| a-m | **Accepted with one census addition.** The raw report is incomplete. | 0 | 1 (D1) | 0 | 0 |
| n-z | **Accepted.** | 0 | 0 | 0 | 4 (kind only) |

## Scanner runs

Neither scanner's work is sufficient coverage by itself, so I did my own coverage.

- **a-m** ran 70 greps (20 of them head-limited) and read 15 of 188 lane files. It claimed full coverage with no drift. It read `Csv.schema.ts:140-219` but did not record the `ParserOptions.new({...})` carrier there.
- **n-z** ran 100 greps (6 head-limited) and read 13 of 82 lane files. Its classifications are correct, but its "no drift" claim misses four kind corrections.
- Each scanner wrote only an empty report. The transcripts were summarized by counts only.

## Coverage method

This covers all 270 files, not a sample.

1. **Explicit pass.** Searched for `S.Boolean`, `BoolKeyDefault*`, `: boolean`, `Option<boolean>`, `key: true|false` and `S.Literal(true|false)`. That gave 202 hits, each listed and read and grouped by scope.
2. **Inferred-local pass.** Found Boolean-shaped `const`/`let` right-hand sides, including multi-line ones, grouped by function. I also listed every `let` in both lanes.
3. **Object-literal pass.** Found Boolean-valued properties, and ran a key-based pass for constructed objects that forward two or more known Boolean members. The key-based pass found the unseeded carrier.
4. **Owner reads.** Read every multi-Boolean owner, and every single-Boolean owner that might have inherited Booleans, in context. Traced writers and readers with graft and `rg`.

## New census record (a-m, D1, not qualified)

- **Proposed ID:** `r44-foundation-schema-a-m-csv-normalize-parser-options-args`
- **Location:** `Csv/Csv.schema.ts:202`, `normalizeParserOptions`, kind `object-literal`
- **Carrier:** the actual `ParserOptions.new({...})` argument object at :198-211.
- **Members:** `ignoreEmpty` :202, `ltrim` :203, `rtrim` :206, `strictColumnHandling` :209, `trim` :210.
- **Why D1:** each value copies one of the independent `CsvCodecOptions` toggles (`csv-codec-options-toggles`, D1). Readers apply the trim > ltrim > rtrim precedence (`CsvParser.parser.ts:46-60`) and read `ignoreEmpty` (:390) independently.
- **Precedent:** the r28 forwarding carriers `runglob-shared-glob-options` and `bun-glob-scan-options` were recorded the same way.
- **Action:** the parent should add this record, or reject it with a written reason.

## Kind corrections (n-z; parent observation 1 CONFIRMED)

All four sites are actual object literals. Classification is unaffected.

| Seed | Change | Object |
|---|---|---|
| `xml-parser-sdk-flags` | `type-literal` → `object-literal` | `new XMLParser({` at `Xml.ts:25`; first Boolean at :26 |
| `with-codec-statics-install-on-owned-schema` | `type-literal` → `object-literal` | `rebuild` descriptor opening at :347; first Boolean at :349 |
| `with-statics-attach-statics` | `type-literal` → `object-literal` | `annotate` descriptor opening at :43; first Boolean at :47 |
| `r2-foundation-static-descriptors-mode` | `type-literal` → `object-literal` | returned strict data descriptor at :77 (the accessor variant is at :78) |

## ParserOptions getter ruling (parent observation 2)

**Result: the stable D1 stays. No qualification and no cluster expansion.**

- **Complete owner.** `ParserOptions` has 8 stored Booleans (:139, :141, :154-156, :161-163) plus 2 Boolean getters (:198, :202), 10 in total. The recall precondition is met, so recall does not exclude any minimal cluster.
  - `comment` (:150) is `Option<string>`.
  - `maxRows` (:166) is `NonNegativeInt`.
  - `headers` (:157) is `Option<boolean | array | fn>`, a union payload.
  - None of these three is a Boolean member.
- **Eligibility.** The getters are eligible, but only as computed derived values. They are accessor properties that readers access directly, not callables, not `S.is` guards and not handles. They are not stored state: they are absent from `.fields` and `.Encoded`, and they have no constructor input and no writer.
- **Minimal E3 `{supportsComments, comment}` fails the gate.**
  - `supportsComments` ≡ `O.isSome(this.comment)` (:199), so the two cannot disagree.
  - The joint domain has 2 representable states, and both are legal. There is no gap, and DECISIONS #1 requires a gap plus evidence.
  - The rider for derived instances ("keep the source type in the view") is already satisfied.
  - Guard-deletion accounting would be empty. The only readers are the test assertions at :22, :32, :52 and :55; production reads `comment` directly (`CsvParser.parser.ts:368`). A design that deletes nothing is misqualified.
- **`limitRows`** is `maxRows > 0`. No binary axis is invented for `maxRows`. `Csv.schema.ts:234` re-derives the same predicate itself; that is predicate duplication, not Boolean creep.
- **The pair.** `supportsComments` and `limitRows` project two independent config fields. Fixtures cover false/false and true/true. The mixed cases follow from setting only one of the two fields, and no guard excludes them.
- **Optional, outside this campaign:** a crispen pass could delete the two getters, since neither has a production consumer.

## Conformance scope check (parent observation 3 CONFIRMED)

For `r3-foundation-invariant-enforcement-channels`:

- **Source.** Lines :275-295 are unchanged since the design-audit checkout `7440cb8c`. The design cites the eight locals at :276-283, and they are still there.
- **Cardinality.** 256 representable tuples and 32 computed tuples.
- **Enumeration.** I enumerated all 32 vectors:
  - The acceptance classes are 15/1/6/7/3.
  - 17 vectors are accepted for at least one decidability.
  - 46 of the 160 vector/decidability pairs are accepted.
- **Six enforcement kinds.** There are six enforcement variants (:120-127), and the guards observe five of them. A nonempty test-only array therefore produces the all-false vector.
  - `test/Conformance.test.ts:196-199` has a `localRuntime` + test-only case, which is rejected.
  - This matches the design's `rejectsAll` = 14 contradictions + 1 test-only.
- **Preserve:**
  - the filter's identifier, title, description and message (:304-308);
  - the six encoded tags and payloads;
  - array order and dedupe;
  - no new disposition field.
- This is a scope check only; it gives no P3 credit.

## Per-seed dispositions (18, all upheld)

JSON `seedDispositions` has the writers, readers and public contract for each ID.

**a-m (11)**

| Seed | Class | Evidence |
|---|---|---|
| `json-schema-node-keywords` | D2 | :212/:245/:252/:253 are Option Booleans mirroring the Draft 2020-12 keywords. No guard relates readOnly and writeOnly. `SubSchema` and the `$vocabulary` record are schema values, not Boolean members. |
| `csv-codec-options-toggles` | D1 | Class at :51; members at :54 and :67-70. Readers apply a precedence chain, and all combinations are handled. |
| `force-https-redirect-config-flags` | D1 | Members at :42-43. The serializer emits each token separately (:168-169). The review adds no preload⇒includeSubDomains restriction. |
| `jsonc-parser-sdk-flags` | D2 | Object at :54, members at :55-56. |
| `literalkit-attach-helper-descriptors` | D1 | :620-622 |
| `literalkit-readonly-property` | D1 | :820-822 |
| `mapped-literalkit-attach-helper-descriptors` | D1 | :212-214 |
| `mapped-literalkit-make-directional-kit-readonly-property` | D1 | :234-236 |
| `mapped-literalkit-readonly-property` | D1 | :364-366 |
| `r3-foundation-invariant-enforcement-channels` | qualified (designed) | See the Conformance scope check above. |
| `r24-…-file-type-checker-ebml-evidence` | D1 | Members at :164-165. `evidence.length > 1` → none (:197), so both-true is handled explicitly. |

**n-z (7)**

| Seed | Class | Evidence |
|---|---|---|
| `parser-options-csv-toggles` | D1 | `objectMode`, `renameHeaders` and `discardUnmappedColumns` have no src reader (ported fast-csv surface). |
| `xml-parser-sdk-flags` | D2 | Needs the kind correction above. |
| `with-codec-statics-install-on-owned-schema` | D1 | Needs the kind correction above. |
| `with-statics-attach-statics` | D1 | Needs the kind correction above. |
| `r2-foundation-static-descriptors-mode` | D1 | Needs the kind correction above. |
| `r24-…-parser-options-derived-gates` | D1 | See the ParserOptions ruling above. |
| `r25-…-semver-prerelease-numeric-flags` | D1 | Members at :510-511; branches at :513/:523/:526/:529 handle all four combinations. |

## Out-of-net source notes (no records)

- **CSP option struct.** It has one Boolean, `reportOnly`. `sandbox` is a `true | token` sentinel with no false value.
- **SecureHeaderOptions.** Its 13 options are false-or-config or Boolean-or-tuple sentinels with no Boolean members of their own. The same applies to the ExpectCt and ForceHttpsRedirect `Option` unions.
- **Jsonl `JsonlChunkParseResult`.** One Boolean (`done`) plus a nullable `error`, so it fails the ≥2 precondition.
- **Single-Boolean owners:**
  - `isDark` in three classes
  - `excludeSimilarTypes`
  - `unsigned`
  - `tagFilter`
  - `exact` in the two parse-options objects
- **Callable predicates.** About 70 of them; ineligible.
- **Function flag parameters.** Excluded: `Csv` :163, `Graph.transforms` :118, `FileTypeChecker` :268.
- **Array or Option pairs.** For example missing/extra headers and missing/unexpected literals; these are not Booleans.
- **Lone latch.** `CsvParser` :135 `foundClosingQuote`.

**One observation, not a finding:** with `ltrim && rtrim && !trim`, `normalizeColumn` applies only `trimStart`, following fast-csv precedence. Every combination is still specified behavior, so D1 stands.

There are no unresolved owner or contract questions.

## Claims not made and side effects

This reviews two lanes only.

**Not claimed:** round completion, a dry round or dry-streak credit, P3, design ratification, or implementation approval.

**Not done:**
- no source, inventory, design or frozen-input edits;
- no tests, builds or installs;
- no git mutations, provider calls, subagents or runtime changes.

**Scratch files:** I wrote three read-only helper scripts to `/dev/shm` and deleted them after use. I also created one transient helper in this directory and deleted it before writing the deliverables.
