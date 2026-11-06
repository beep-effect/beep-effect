# Production parser catalog loading

The default extractor catalog and frozen publication records now load from a
production asset without importing a test schema, fixture or test helper. The
asset is a complete runtime projection of sealed oracle data, excluding test
cases and test execution machinery. It retains all 6,805 extractor occurrences,
6,805 compiler descriptors, 2,533 edition bindings and 2,430 original reporter
payloads. Exact/variation order, multiplicity, source ordinals and
hash/equality parameters are preserved.

## Source and seals

The exporter first validates canonical-tokenizer.json SHA-256
7f624597ee68176326cd8252a9858acd48faa7be27f1dc3e986119140a4080f3, then
validates every input seal it names: operation-cases, extractor-recipes,
extractor-selection and regex-program-facts. Every source pin is the original
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e. Original extractor payload SHA-256
8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c is checked
independently, as is every frozen reporter/edition payload reference. Recipe
value/reference tables expand losslessly; descriptor selection follows original
first occurrence. Nothing is inferred from a reporter alias.

The runtime artifact is parser-catalog.data, containing canonical JSON data
with producer/input hashes. It is 10,337,697 bytes with SHA-256
9d6b0866a5f9857b5e64277c12e123f2b0047e6d34dc52ea89e1160c486f6cd6. A fresh
export is byte-identical. Exporter --check compares the complete source
projection and checks the runtime loader's byte/hash seals. The server
package's existing assets/citation packaging includes the file. The exact
generated file is excluded from prose spelling checks; runtime seals, schemas
and independent complete comparisons validate its contents. Code and authored
provenance stay checked. The secret scanner mistook the public
canonical-tokenizer input digest for an API key; an exact digest/path/detector
exception preserves all other values and rules. Source attribution is Free Law
Project, BSD-2-Clause, retained in THIRD_PARTY_NOTICES.md and the runtime
loader header.

The asset explicitly retains Python 3.11.15, hash seed 0 and the
captured-source-runtime profile. This does not claim fresh-process hash
production or qualify other runtime hash profiles. Its catalog fingerprint is
not yet a complete engine artifact fingerprint.

## Runtime ownership

The loader uses Effect FileSystem.stream with bytesToRead set to the sealed
length plus one, and bounded chunks. It collects through Effect Stream and
Bytes; no unbounded readFile or custom stream/parser transport is introduced.
Exact length and SHA-256 checks precede JSON decoding. Extra bytes and
truncation never become successful partial data. Missing assets and I/O
failures become closed, source-free catalog failures without paths or nested
driver causes.

The runtime JSON codec derives from the existing canonical tokenizer metadata
and newly named existing frozen-bundle schema, retaining exact BigInt hashes.
Existing frozen-publication and tokenizer-catalog owners then validate every
publication payload and extractor pattern/profile relation. Data authentication
does not itself grant worker execution authority; existing isolated regex
admission and execution guards still apply.

## Verification

The focused catalog suite passes two tests in 3.30 seconds. It compares every
metadata row and the complete resulting tokenizer configuration with the
independently loaded sealed fixture path, and every frozen record with the
original artifact corpus. Installation starts no native child. Corruption
controls refuse changed bytes, truncation, appended data and an absent file.

The connected tokenizer fixture now installs the production catalog and
provides its frozen owner to downstream extraction. All registered full replays
therefore exercise this path. Focused catalog, frozen-publication and
verified-extraction regression passes ten tests across three files in 25.75
seconds. Plain, Unicode and actual HTML input replay on Bun and Node, comparing
original complete models, verified source lineage and primary/full-span
evidence. Native exit/capacity checks remain in place. The full 36-document
hosted replay stays pending.

Package lint/type/test checks, declaration generation, blocking package laws,
codec-compilation lint and scoped complexity/clone checks pass for this change.
The isolated scan's estimated coverage is not authoritative hosted coverage.
Hosted Fallow passes on preceding head
992a06fc3ab0175e14c10d345f7b423aabdf5129, Check run 42258360823, job
128031661704. Hosted confirmation of this wave remains pending.

```sh
python goals/citation-extraction-engine/ops/export-parser-catalog.py --check
python goals/citation-extraction-engine/ops/export-parser-catalog.py \
  --output .beep/parser-catalog-reproduction.data
cmp .beep/parser-catalog-reproduction.data \
  packages/law-practice/server/assets/citation/parser-catalog.data
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationParserCatalog.test.ts \
  test/CitationFrozenEditions.test.ts test/CitationVerifiedExtraction.test.ts
```

Remaining helper-pattern/configuration assets, complete engine artifact
production, default captured ports and the public request/error/service/Layer
remain required. Final detached/document integration, other
components/footnotes, transforms, broad host/subclass/equality/mutation/alias
behavior, exhaustive accounting and whole-engine safety/scaling remain open.
All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open without a semantic waiver or goal-completion claim.
