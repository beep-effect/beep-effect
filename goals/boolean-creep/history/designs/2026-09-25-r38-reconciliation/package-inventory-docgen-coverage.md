# package-inventory-docgen-coverage

**Current source-forward binding (P2 only)**

Revalidated against HEAD `4509872869eb87071250c67717769260f850bcf5` and merged main
`d68f1a11dd41579660a6c72f3d3e060d6b61352d`, after the R30 packet commit
`578b25de24f325a7240ed5321d708531c6d55536`. Native continuation uses
`gpt-6-astra` / `xhigh`; it preserves the original job provenance below.
This is a bounded source rebind, not another design or a P3 approval.
The canonical inventory at admission was 738 records /146 qualified, SHA256
`ea376cff64c549eb542d8bc4dc10c5aec519246b0f20a6720a8f9ad5c64a98d1`.

The full eight-section design below is retained byte for byte from the canonical
packet at this HEAD. Its prior source header and numbered locators describe
main `bed30c6adf3beed7de8538209fbdc84d26a3b8ce`. Apply the following exact
source-location mappings when reading it against d68; these mappings and the
current preservation notes govern this rebind. Equal source slices, full source
copies, consumer search, dependency bindings, and proposal hashes are frozen in
the private `pre-r31-main-d68-quality-designs` handoff. No product test or
independent review ran, and source implementation remains pending.

| Retained locator file | Exact current mapping |
| --- | --- |
| `Quality.command.ts` | Old1–2074 stays identical; old2075–2081 maps +10; old2085–3938 maps +11. The only changed prior lines2082–2084 belong to local Effect plugin resolution, not these designs. |

All other source/test/barrel locators in this design remain unchanged.

Qualification and target remain 16/10, derived/persisted tagged union,
designed/Tier2. JSDocDocumentationInventory.ts, JSDocRatchet.ts, both artifact
and detector fixture files, and the test facade are byte-identical. The row is
retained exactly; all declaration/evidence anchors still name the same lines.
Only its cross-file command consumer moves: old2972–3021→current2983–3032,
old3173–3214→current3184–3225. Current writer call is3013, current mirror logging
3026–3028, and CLI mirror flags3198–3205. All referenced command source slices
remain byte-identical after +11.

Retain the complete decoded builder/API migration and exact ten-output legacy
projection, including missing-package FFFF versus missing-config FFFT, all
eight configured payload choices, unchanged exact JSON comparisons, primary
then mirror write order, optional-path errors and same-scan byte identity.
The unrelated sibling-tsconfig plugin-resolution change at2075–2095 grants no
change to this owner and no guard-deletion credit. Tier2 compatibility and
independent P3 requirements remain exactly as in the retained design.

**Retained design and original provenance**

Native P2 refresh bound to HEAD `e7b1e907726421c7d2a2e1cdd140280df47f2353` and immutable main
`bed30c6adf3beed7de8538209fbdc84d26a3b8ce`, compared with main
`3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`. Prepared by Codex
`gpt-6-astra` / `xhigh` under the user's current AGENTS instructions.
Status remains `designed`; cardinality remains 16/10. Tier 2: singleton persisted-boundary implementation with explicit compatibility proof.
This document supplies no implementation or independent P3 approval.
Short source paths are relative to `packages/tooling/tool/cli/src/commands/Quality/`;
`src/` and `test/` paths are relative to the CLI package.

## Current shape

The actual object-literal data cluster is `PackageInventory.docgenCoverage`,
constructed at `internal/JSDocDocumentationInventory.ts:1313–1318` (anchor1314)
and1336–1341. `PackageInventory`151–177 currently types that nested value as
`JsonRecord` at160. The broad JSON type is not itself the eligibility proof:
the two real object constructors co-carry four Boolean values.

Resolved packages probe docgen.json at1273; probe failure falls back to false.
When present the file is read at1274; otherwise the analyzer uses {}. Description
and example enforcement compare exact true, while version compares not-false
at1315–1317. A missing configuration therefore emits FFFT in order
(hasDocgenConfig, enforceDescriptions, enforceExamples, enforceVersion).
Missing workspace metadata uses a separate writer1325–1358 and emits FFFF.
Required status/path/counts are preserved payloads, not extra Boolean axes.

The exported builder1557–1626 returns the full Inventory. The writer1634–1677
formats JSONC and Markdown; new optional mirror paths at272–273 copy the same
rendered strings to CI outputs1669–1670. The test facade exports both builder
and writer at `src/test/Quality.test-kit.ts:70`. The decoded builder return is
observable even though the defining module's package subpath is blocked.

## Cardinality gap

| Supported source state | Encoded Boolean tuple | Count |
| --- | --- | --- |
| Missing workspace metadata | FFFF | 1 |
| Resolved package without config | FFFT | 1 |
| Configured package | T plus all eight enforcement tuples | 8 |

Four physical Boolean values give16 representable tuples, ten legal output
states. Six absent-config tuples requiring descriptions or examples true cannot
be produced. All configured combinations have concrete accepted JSONC witnesses:
set each of the three Boolean keys explicitly to the desired value. The exact
true/not-false comparisons impose no cross-key restriction. Missing/other JSON
values retain their current coercion/default behavior; do not narrow the raw
JSONC input to only Boolean fields while refactoring the output.

This is an E4 ordered-flag relation within an actual four-Boolean cluster.
The finite count includes the independent configured bits rather than flattening
them away. It is not a one-Boolean/required-enum or invented payload-predicate case.

## Target schema

Define one private annotated `DocgenCoverage` tagged union in the existing
inventory module: missing-package, missing-config, and configured with required
independent enforceDescriptions/enforceExamples/enforceVersion Boolean payloads.
Use the repository schema-first tagged-class building blocks with schema-owned
tags and a derived union type; .make inputs must not redundantly supply S.tag
fields. No new package, service or general configuration abstraction. Keep the
three configured Boolean domains; enumerating eight configured literals is waste.

Change the internal PackageInventory docgenCoverage field to the honest union.
Keep the other complete fields and Inventory envelope unchanged. Both currently
intersect JsonRecord at151/189; remove or split only the JSON-compatibility
intersection needed to represent decoded schema classes without pretending the
new tagged class already is the legacy artifact. Give the encoded projection
its own exact four-key schema/derived shape or typed object. Do not cast the
new model to the old JsonRecord, broaden fields to unknown, or redesign unrelated
inventory models as part of this change.

Choose missing-config from the existing probe result and configured only after
successful reading. Preserve source-directory default, exclusion processing and
filesystem errors. Confine the three exact comparisons to configured construction.
The read/no-read distinction remains real IO; use the honest case to replace the
empty-object sentinel without changing listSourceFiles or analysis behavior.
Missing metadata constructs missing-package with all other sentinels unchanged.

At the writer boundary, exhaustively project each union to the exact legacy
flat object: missing-package FFFF; missing-config FFFT; configured T plus its
three payloads. Project the complete package collection once before formatJsonc.
Never add a tag to persisted JSONC or reconstruct presence checks at every
consumer. Keep the exported builder's honest decoded union return; migrate its
source-only test clients and document the change. The writer and all encoded
files preserve their public contracts.

## Migration inventory

| Source / consumer | Migration and preservation |
| --- | --- |
| `internal/JSDocDocumentationInventory.ts:151–177,189–194` | Type the decoded nested carrier with the private union and explicitly separate its legacy JSON projection. Preserve complete package and inventory payloads. |
| `:1263–1280,1302–1323` | Construct missing-config/configured once; preserve failed-exists fallback, conditional read, exact field comparisons, source-directory/exclude defaults, package analysis, ordering and counts. |
| `:1325–1358` | Construct missing-package; retain <unresolved>, missing-workspace-metadata, srcDir=src, zero counts/rule defaults and empty module/export arrays. |
| `:1391–1425,1485–1548` | Totals and Markdown intentionally do not consume docgenCoverage. Keep bytes and all other field reads unchanged. |
| `:1557–1626` | Exported builder retains options, error/service requirements, generatedAt, topology, labs/ecosystem filtering, tracked-source filtering and complete returned metadata. The nested decoded union is an explicit API change through the test facade. |
| `:1634–1677` | Project only for artifact JSONC, format once, render Markdown once; preserve primary write order followed by JSON mirror then Markdown mirror. Return original primary paths and totals only. |
| `:265–279,1679–1696` | Preserve optional mirror paths and omission/default semantics, undefined no-op, recursive mirror-parent creation and path-specific typed mkdir/write errors. Do not add path restrictions, disallow coincident paths, or swallow errors. |
| `Quality.command.ts:2972–3021,3173–3214` | Preserve primary/mirror path resolution, getSomesStruct omission, --ci-output-json/--ci-output-markdown flags, same-scan writer call, typed command mapping and each successful mirror log. |
| `internal/JSDocRatchet.ts:273–286` | Existing encoded reader consumes totals from whichever inventory path is selected; no decoder or ratchet change. The mirrored JSONC remains the same scan as the primary. |
| `src/test/Quality.test-kit.ts:70`; package exports63/68 | Existing source-only wildcard already exposes builder/writer. Keep package export map; add only minimal direct schema test access through the existing facade if necessary. |
| `test/quality-artifact-generators.test.ts:171–265`; `test/jsdoc-inventory-detector-fixes.test.ts:158–172` | Preserve real fixture writers, output bytes, controlled timestamp and counts. New mirror fixture207–232 requires byte equality for both artifacts. |

Graft and exhaustive source/test search find no other direct docgenCoverage
reader; the decoded builder is still an exposure even without direct field
reads today. Encoded totals/Markdown and whole-artifact consumers remain. Keep
the tracked standards inventory and CI mirror contracts; generated artifacts
receive no hand editing. Regeneration/drift proof occurs only at implementation.

## Guard-deletion accounting

Remove hasDocgenConfig as stored decoded state and both four-Boolean constructor
bags1313–1318/1336–1341. Replace the read-or-empty-object sentinel1274 with honest
missing/configured construction. The filesystem existence observation and
read/no-read branch are retained IO decisions, not eliminated behavior. Keep
srcDir and exclude defaults for missing config explicitly and unchanged.

Configured's three exact Boolean projections remain required independent policy
values. Add exactly one exhaustive legacy projection, including their four
encoded keys; retaining those encoded keys is required compatibility rather
than a failed decoded refactor. No totals/Markdown guard or new mirror optional
path guard is removed. Do not claim removal of the mirror writer or unrelated
payload/status predicates.

## Encoded-side impact

Tier2 compatibility requires all ten outputs to retain the same four keys,
Boolean values, key order, package/topological order, JSONC format, final newline,
generatedAt/provenance and surrounding full payloads. Missing config remains
version-enabled FFFT; missing package remains FFFF. No tag/version bump or
new discriminator appears. Markdown remains byte-identical and omits coverage.

The new writer behavior is binding: primary JSONC first, primary Markdown next,
then optional JSON mirror and Markdown mirror from the same already-rendered
strings. A failed earlier write prevents later writes. Each mirror creates its
parent and retains typed path-specific failures; undefined skips that mirror.
Do not rescan, reformat per output, normalize paths differently, or change
coincident-path behavior. Return fields remain primary outputJsonPath,
outputMarkdownPath and totals, with no newly returned mirror fields.

The builder's decoded union is a distinct TypeScript API migration through the
source-only test facade. It is not serialized compatibility and cannot be
hidden behind a claim that all models are private. No external SDK mirror or
runtime request restriction is introduced.

## Test impact

Use existing repository fixtures to cover missing metadata, missing config and
all eight explicit configured combinations. Assert the decoded case and exact
four-key projected JSONC, particularly FFFT versus FFFF. Preserve non-Boolean or
omitted raw values under the existing exact comparisons; malformed JSONC and
read failures keep their original behavior. Derive schema checks from the
production model; do not make an invented generic decoder the input contract.

Keep topology, labs/ecosystem and tracked-source exclusions, generatedAt control,
counts, Markdown and artifact drift tests. Extend the mirror fixture207–232
across representative missing/configured cases and ensure every artifact's
bytes match its primary. Cover each omitted mirror independently and mkdir/
write failures without changing partial-write ordering. Test the exported
builder's new decoded result through the existing alias and preserve writer
result fields. No browser QA applies.

At implementation run focused generator/detector/ratchet tests, deterministic
artifact drift proof and required repo-CLI package verification, then the
canonical Yeet gates for a singleton Tier2 PR. P2 ran none of those commands.

## Risk

This owner remains16/10. Main risks are collapsing the two missing cases,
narrowing raw config semantics, retaining a dishonest JsonRecord intersection,
leaking a tag into JSONC, or breaking new mirror byte identity/order. Land both
constructors, typed decoded/encoded separation, exported builder migration and
one exact legacy projection atomically. Upstream's mirror addition is preserved
behavior, not campaign implementation credit. Independent P3 remains pending.
