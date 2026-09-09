# Instance

- id: `skills-patch-series-presence`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Skills/Skills.schemas.ts:721`
- symbol: `SkillPatches`
- members: `required`, `series`
- evidence: E3 at `Skills.service.ts:762-788` — `required` is derived from the same ordered series' nonemptiness; E2 at `Skills.render.ts:174-176` reads the pair as that relation.

# Current shape

The exported wire schema stores a boolean beside an ordered patch array. The read-only provenance command constructs either an empty series with the stable empty-set hash or a nonempty series and computed patch-set hash. JSON rendering emits the lock-shaped entry but does not write repository state.

# Cardinality gap

Boolean times series emptiness represents four tuples; two are legal: no patches and a nonempty patch series.

# Target schema

Define `SkillPatchSeriesDisposition` as a named LiteralKit with `none` and `required`, then define tagged cases. The `none` case fixes `patchSetHash` to the existing SHA-256 empty-input digest and owns no series; `required` owns a nonempty ordered `series` and its computed patch-set hash. Keep `SkillPatches` as the exported transformed schema and preserve the legacy `{ required, patchSetHash, series }` projection exactly. Reuse existing `SkillPatch`, `Sha256Hex`, and encode/decode helpers; add no generic presence abstraction.

# Migration inventory

- `Skills.schemas.ts:691-728,1073-1100,1496-1545` — replace the pair, retain guards/codecs and update examples.
- `Skills.service.ts:424-455,740-799` — preserve patch byte construction, order, labels, ownership, hashes, empty-set digest, and select the case from the resulting series.
- `Skills.render.ts:88-92,169-192` — encode the legacy lock-shaped JSON and match disposition for the unchanged summary text.
- `Skills.command.ts:1014` — no behavior change; it prints the selected JSON or text renderer.
- `test/skills-provenance.test.ts:125-174,176-224` — retain block/document round trips, byte-identical fixture encoding, drift and no-drift behavior, and no-write assertions.

# Guard-deletion accounting

Delete the `required` field, its nonempty derivation write, renderer ternary, schema-guard examples, and tests that coordinate it with length. Replace the renderer branch with a tagged match. Keep series emptiness inside patch construction because it determines the empty-set digest versus rendered patch bytes.

# Encoded-side impact

Tier 2 wire compatibility is exact: `none` encodes false with `[]`; `required` encodes true with the unchanged ordered array. Preserve `patchSetHash`, patch text hashes, labels, owner/drop-condition fields, and full `skills provenance --json` bytes. The command remains read-only and neither creates `patches/` nor writes `skills-lock.json`.

# Test impact

Add codec cases for both legal projections and rejection of the two crossed tuples. Retain exact lock fixture round trips, JSON output, summary text, empty-set digest, text/binary/symlink drift, patch order/content/hash, and filesystem no-write checks.

# Risk and sequencing

Land as a singleton Tier 2 migration after the Tier 1 packet batch. The main risk is changing lock-shaped JSON or patch ordering; compare encoded fixture bytes, not only decoded equality.
