# Instance

- id: `package-inventory-docgen-coverage`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1312`
- symbol: `PackageInventory.docgenCoverage`
- members: `hasDocgenConfig`, `enforceDescriptions`, `enforceExamples`, `enforceVersion`
- evidence: E4 at `JSDocDocumentationInventory.ts:1271-1272,1311-1316`
  — absent config substitutes `{}`, forcing descriptions/examples false and
  version true; the missing-package writer separately emits all false.

# Current shape

For a resolved workspace package, the analyzer probes `docgen.json`, reads it
only when present, and projects three independent configuration toggles.
Descriptions and examples are enabled only by exact true; version is enabled
unless exact false. A missing configuration therefore emits false/false/false/
true. A package name missing from workspace metadata is produced by a separate
writer and emits all four false.

When a configuration exists, the three enforcement values are independent and
all eight combinations are supported by optional Boolean configuration keys.
The complete `PackageInventory` is written to the tracked JSONC inventory. The
Markdown summary does not render `docgenCoverage`.

# Cardinality gap

Four booleans expose sixteen tuples. Ten are supported:

- `missing-package`: false/false/false/false;
- `missing-config`: false/false/false/true;
- `configured`: true with all eight combinations of descriptions, examples,
  and version enforcement.

The other six false-config tuples require descriptions or examples true and
cannot be produced. Missing package and missing config must remain distinct;
the latter retains the default-on version policy.

# Target schema

Define a private `DocgenCoverage` tagged union with:

- `missing-package`;
- `missing-config`;
- `configured { enforceDescriptions, enforceExamples, enforceVersion }`.

The three configured booleans remain independent payload because their eight
combinations are legitimate policy. At the JSONC artifact boundary, project
the union back to the exact existing flat object with `hasDocgenConfig` and the
three enforcement keys. Keep this projection local to the inventory writer;
do not create an application-wide generic configuration helper or enumerate
the eight configured combinations as literals.

# Migration inventory

- `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:151-177`
  — type `PackageInventory.docgenCoverage` with the private honest union during
  analysis and define the exact legacy artifact projection.
- `JSDocDocumentationInventory.ts:1261-1277` — select missing-config when the
  probe is false and configured only after a real `docgen.json` read. Preserve
  source directory and exclude defaults and all filesystem error behavior.
- `JSDocDocumentationInventory.ts:1300-1321` — construct configured coverage
  from exact-true descriptions/examples and not-false version semantics.
- `JSDocDocumentationInventory.ts:1323-1356` — construct missing-package and
  retain unresolved path, status, zero counts, empty module/export arrays, and
  rule-count defaults.
- `JSDocDocumentationInventory.ts:1389-1423` — no totals change; coverage does
  not contribute to aggregate counts.
- `JSDocDocumentationInventory.ts:1483-1545` — retain Markdown output exactly;
  it intentionally omits the coverage object.
- `JSDocDocumentationInventory.ts:1596-1623` — preserve topological package
  order and the missing-metadata versus resolved-package writer selection.
- `JSDocDocumentationInventory.ts:1632-1669` — project each coverage union to
  the legacy flat object before `formatJsonc`; preserve JSONC formatting,
  package/key order, generated metadata, output paths, and typed write errors.
- `packages/tooling/tool/cli/test/quality-artifact-generators.test.ts:171-233`
  and `jsdoc-inventory-detector-fixes.test.ts:158-172` — retain exact JSONC and
  Markdown generation and expand synthetic package fixtures across the
  supported coverage cases.
- Checked-in `standards/jsdoc-documentation.inventory.jsonc` is generated output
  and receives no hand edit in the implementation PR.

Targeted search found no reader of `docgenCoverage` outside the generated JSONC
artifact; package-summary Markdown and totals use other `PackageInventory`
fields.

# Guard-deletion accounting

Delete the persisted-analysis `hasDocgenConfig` Boolean, its read-or-empty-object
ternary, and the four parallel object writes in both package producers. One
union constructor owns missing package, missing config, or configured payload.
Keep the three configured Boolean projections because they are independent
supported policy values, but confine them to the configured case. Add one
exhaustive artifact projection rather than recreating presence guards at each
reader.

# Encoded-side impact

Tier 2 persisted compatibility is required. The internal union must project to
the exact prior `docgenCoverage` object for all ten cases before
`formatJsonc`: the same four keys, Boolean values, key order, indentation, and
surrounding package order. The checked-in
`standards/jsdoc-documentation.inventory.jsonc` and CI copies must remain
byte-stable for unchanged source. No discriminator may appear in the artifact.
Markdown output remains byte-identical because it does not render this field.

# Test impact

Build focused inventory-generator fixtures for missing workspace metadata, missing
`docgen.json`, and all eight configured enforcement combinations. Assert the
honest internal case and exact projected four-key JSON object, especially the
false/false/false/true missing-config default and all-false missing-package
sentinel. Reject or make unconstructable the six false-config combinations with
descriptions or examples true. Retain malformed JSONC/read failures, package
topological order, Markdown bytes, generated-at control, and full checked-in
artifact drift coverage. No browser QA applies.

# Risk and sequencing

Tier 2 derived-to-persisted-boundary refactor. The principal risks are merging
missing package with missing config, changing version's default-on semantics,
constraining the three legitimate configured toggles, or leaking the new tag
into the artifact. Land the internal union and exact legacy projection
atomically. The defining inventory schema, generated-artifact expectations,
and callers were rechecked at the exact source SHA above.
