# Instance

- id: `runners-bake-freshness`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:304`
- symbol: `BakeCheckReport`
- members: `lockfileMatches`, `bunArchiveMatches`, `bunVersionMatches`, `fresh`, `actualLockfileSha256`, `actualBunArchiveSha256`, `actualBunVersion`
- evidence: E4 at `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:757-785` — each match bit is `Option.exists(actual, equalsExpected)`, and `fresh` is their conjunction.

# Current shape

`BakeCheckReport` stores three expected runner-image inputs, three optional actual AMI-tag values, three match booleans, and an overall `fresh` boolean. `checkBake` is the sole production writer. It decodes the two SHA tags, reads the Bun-version tag, compares each actual with its expected value, then writes `fresh` as the conjunction.

Each probe therefore has three meaningful outcomes: missing actual, present mismatch, or present match. A match requires both actual presence and equality with the expected payload. The overall flag adds no independent information. The three probes remain independent, so one tag may match while another is missing or stale.

The report is a public repo-CLI schema exported with `BakeCheckReportJson`. `runners bake --check --json` encodes it, the human renderer reads lockfile/Bun-version/overall status, and the command exits unsuccessfully when the overall result is stale. No repository caller decodes `BakeCheckReportJson`; its documented use is command output.

# Cardinality gap

At the census abstraction, four booleans plus three actual-presence bits expose 128 combinations. Exactly 27 are coherent: each of the three probes independently selects missing, mismatch, or match, and overall freshness is true only when all three match.

For each probe:

| actual | match | state |
| --- | --- | --- |
| absent | false | missing |
| present and unequal to expected | false | mismatch |
| present and equal to expected | true | match |

Absent/true is impossible, and present values must agree with the named match state. Crossing the three probe states gives 27 rows. Only match/match/match encodes `fresh: true`; the other 26 encode false.

# Target schema

Define a private parameterized schema constructor for one `BakeProbeResult` with three cases:

- `missing { expected }`;
- `mismatch { expected, actual }`;
- `match { value }`.

Instantiate it with `Sha256Hex` for lockfile and Bun archive and `S.NonEmptyString` for Bun version. The match case owns one value because expected and actual are proven equal; the legacy encoder duplicates it into both old fields. Define the decoded `BakeCheckReport` with `amiId`, `lockfile`, `bunArchive`, and `bunVersion` probe results. Derive overall freshness by checking whether all three cases are `match`; do not store a fourth decoded field.

Keep a private legacy encoded schema with the exact existing seven cluster keys and neighboring fields. Connect it to the honest decoded report with one named full-report transformation. Decoding validates actual presence, actual-versus-expected equality, each match bit, and the overall conjunction. Encoding projects the three cases back to the old expected/actual/match fields and derives `fresh`. Reuse `Sha256Hex`, `JsonStringCodec`, existing schema helpers, and schema-derived case guards; do not enumerate 27 combination literals or create three copy-pasted union definitions.

# Migration inventory

- `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts:1-20` — reuse existing schema imports and add only the transformation helper required by the local codec.
- `Runners.schemas.ts:279-321` — replace the flat public decoded class with the three typed probe results while preserving `amiId`, documentation, and the public `BakeCheckReport` name.
- `Runners.schemas.ts:323-337` — retain `BakeCheckReportJson = JsonStringCodec(BakeCheckReport)` over the transformed schema so command JSON remains unchanged.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:739-760` — retain first-image tag selection, exact tag keys, invalid-SHA-to-missing behavior, and string payloads.
- `Runners.service.ts:761-785` — construct each probe case from its expected and actual values and remove all four Boolean locals/properties. Preserve `Sha256Hex` and string equivalence semantics.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:59-68` — render lockfile and Bun-version freshness from their cases and derive the exact overall yes/no text. Continue omitting a separate Bun-archive line.
- `Runners.command.ts:82-88,118-131` — retain the JSON encoder/error mapping and derive command success from all three match cases.
- `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:183-191` and `commands/Runners/index.ts:30-40` — keep the service result and public barrel routed through the same `BakeCheckReport` owner.
- `packages/tooling/tool/cli/test/runners-bake.test.ts:69-107` — migrate the coherent fresh/stale service fixtures to probe cases without changing their encoded values.
- `runners-bake.test.ts:263-301,339-415` — preserve mode conflict, human/JSON check output, stale exit, and live scripted-service freshness behavior; add full schema compatibility tables.

Targeted repository and barrel searches found no additional writer, reader, or decoder of the report or its seven correlated fields.

# Guard-deletion accounting

Delete the three `*Matches` locals, the stored `fresh` conjunction, all seven correlated decoded fields, the renderer's three Boolean reads/ternaries, and the command's direct `result.fresh` guard. The three probe unions become the sole coherence owners; one derived all-match check supplies display and exit behavior. Keep tag presence/decoding and equality comparisons inside the constructors because they classify real external observations rather than recreating returned Boolean aliases.

# Encoded-side impact

Tier 2 exact compatibility codec. For all 27 coherent reports, compare the new codec's canonical encoded object and JSON string with the old codec's output. Preserve field names and order, `OptionFromOptionalKey` omission, SHA/string bytes, `amiId`, all expected values, all actual values, three match booleans, and `fresh`.

The old structural schema could parse 101 incoherent combinations, but no writer, fixture, documentation, or decoder consumer gives those payloads contractual meaning. The new full-report decoder rejects an absent/true probe, a match bit that contradicts actual equality, or a `fresh` bit that contradicts the three matches. It must not silently normalize such input. The public documented all-match example and both test fixtures remain exact compatibility rows.

# Test impact

Generate the 27 coherent probe combinations with valid synthetic digests and version strings. For every row, prove decoded cases, exact old/new canonical encoding, optional-key omission, match bits, and derived overall freshness. Add rejection tests for each incoherence class: missing actual with true match, equal actual with false match, unequal actual with true match, and contradictory overall freshness. Ensure schema-derived arbitraries generate all 27 case combinations rather than only all-equal fixture shapes.

Retain command tests for exact human output, JSON output, stale typed error and exit, first-image/no-image behavior, malformed SHA tags becoming missing, a stale version payload, AWS parsing errors, and successful live service check. No browser QA applies.

# Risk and sequencing

Tier 2 wire-schema refactor. Land schema, transformation, service writer, renderer, barrel, and tests atomically. The main risks are erasing mismatch payloads, treating malformed SHA text as a mismatch instead of the existing missing result, changing key order or optional omission, trusting redundant legacy booleans over the values, or narrowing generated tests to the single production all-match row. The full 27-row compatibility matrix is the release gate.
