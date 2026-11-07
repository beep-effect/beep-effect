# Production helper configuration

The remaining default helper configurations now load from a production asset
without test imports. A maintainer exporter authenticates thirteen original
source files at the pinned eyecite commit before projecting configuration only.
It preserves post/pre-case metadata, plain/HTML naming, stop words, law/journal
metadata, pin/supra patterns, generated-reference templates/name exclusions and
HTML discovery. Original cases, snapshots and test machinery are excluded.
Free Law Project BSD-2-Clause attribution remains in the loader and root notice.

## Source data and calendar capture

The production asset is 127,091 bytes with SHA-256
231c08c796c44dcc0a0d278b03798c29dfadcd2debda09c8b7fff6a6334e40c3.
A fresh export is byte-identical. The exporter checks every source byte seal
and oracle commit, then emits producer and input seals. Native carriers use
Base64 only because the existing Effect Schema Uint8Array JSON codec derives
that representation. No private runtime byte decoder is introduced.

Static configuration schemas derive from existing runtime schema fields. Only
highestValidYear is omitted from the five temporal helper schemas and source
projection. The normal installer reuses makeCitationMetadataYear, capturing
Effect Clock and CurrentTimeZone once and installing the same cutoff in
post/pre-case, law, journal and pin configuration. Fixture dates cannot become
a frozen production clock. Existing validated edition bindings are supplied
separately from the authenticated parser catalog.

## Shared upstream loading

The existing bounded native asset reader is extracted into Asset.ts, preserving
Effect FileSystem.stream, Stream.runCollect and Bytes.concat. Native WASM
compilation retains its existing snapshot/digest/ABI checks. The shared JSON
loader authenticates exact length and digest before the supplied schema codec.
It reads at most the sealed length plus one and checks length before buffer
concatenation. Catalog/helper owners retain their own closed errors; paths,
patterns and underlying filesystem causes are not exposed.

The tokenizer fixture now installs production helper configuration alongside
the production parser catalog. Document extraction uses its production HTML
discovery configuration. Existing connected raw/semantic/verified extraction
and registered full integration therefore exercise these assets.

## Verification

Focused helper/catalog tests pass four tests in 6.52 seconds. Every installed
loop field, native byte value, binding, template, exclusion and court table
compares with the independent existing fixture readers through the complete
configuration schema equivalence. HTML discovery compares independently.
Changing the installing clock from 2026 to 2040 gives all five new helpers a
2041 cutoff while the prior configuration remains unchanged. Installation
starts no native child. Changed, truncated, appended and absent files refuse.

Connected helper/catalog/verified-extraction regression initially passes six
tests in 31.96 seconds, including original complete plain/Unicode/HTML models
and verified source/primary/full-span evidence on Bun and Node. Final replay
against the consolidated loader passes six tests in 26.84 seconds. Package lint,
type checking and declaration generation pass. Blocking package laws and
codec lint pass. Scoped scans show no new asset complexity or clone findings;
the existing documentRequest estimated-coverage finding is unchanged. Hosted
coverage and checks remain authoritative.

Hosted Fallow passes on prior head 76b46398e1 (Check run 42262373886,
job 128045510999). Secret Scanning on that head uses base-pinned policy and
finds the public parser source digest. Independent main-based PR #2786
publishes exact catalog/helper digest/path/detector exceptions for review.
The helper finding is its public reference-token.json source SHA-256,
independently recomputed by the exporter. Local controls
preserve detection for changed digests and other paths, and the candidate
configuration scans the entire citation range without findings. The dependent
hosted gate requires merging that policy into main, then merging main here.
The protection against self-approved scanner exceptions is unchanged.

```sh
python goals/citation-extraction-engine/ops/export-helper-configurations.py \
  --check
python goals/citation-extraction-engine/ops/export-helper-configurations.py \
  --output .beep/helper-reproduction.data
cmp .beep/helper-reproduction.data \
  packages/law-practice/server/assets/citation/helper-configurations.data
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationHelperConfigurations.test.ts \
  test/CitationParserCatalog.test.ts test/CitationVerifiedExtraction.test.ts
```

Complete engine artifact production, default ports and public request/error/
service/Layer remain open, as do final document integration, additional
components/footnotes, transforms, broad host/subclass/equality/mutation/alias
behavior, full accounting and whole-engine safety/scaling. All eleven
representation laws, four fidelity questions and fifteen unfinished proof rows
remain open; this wave neither changes scope nor claims goal completion.
