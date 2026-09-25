# IdCitation inheritance P2 audit

HEAD: `0be1f13d62fa00cb65e34ff69ec99043380f8d81`. No canonical/product changes.

## Exact input bindings
- Private `inventory-before.jsonl`: `b276f0b0ffccccc39779394df44c219945a091dd5fdea8513daa66049ffc6ed5`
- Private `decisions-before.md`: `b9ad90280aa8b82394d221b6941427100c47536c53cf15496d5b15c12914d4eb`
- Private `historical-row.json`: `ff59e57ab9e9c753b466f889452ffae8769c392959dec314317c25f0df02f7ee`
- `goals/boolean-creep/data/r31-law-owner-holds.json`: `7cbe7672b22d89925f48ece3f57b8175bc233bcdc22555af7379d9e6736857fa`
- `packages/law-practice/domain/src/values/Citation/Citation.models.ts`: `2340f0a39f198015de6ee023df62bb3774f4cd97341001d74bdd8707e016742c`
- `packages/law-practice/domain/src/values/CitationBase/CitationBase.model.ts`: `3b9077514cae683d5df5c6e60b6ca6f5fd3c89913750141e58a40126c333a175`
- `packages/law-practice/domain/src/values/CitationId/CitationId.model.ts`: `0d7b44e07365d123c19e0369becf7e64325aee8d3725c4a3c5286f8479e1a09c`
- `packages/law-practice/domain/test/LawPracticeDomain.test.ts`: `75de8b4619c393d8c42d9a732dd26ba5b0d1533dc7f503dcaa7d0c05f9945359`
- `packages/law-practice/domain/src/values/Citation/index.ts`: `8955498eca7d2966b6c0a93a308044562a75d70cdc643dc788ef53c500ad10d1`
- `packages/law-practice/domain/src/values/index.ts`: `89babdc4117152d6c4e7975510d4559f77e221d95c0d39bcaccfce824294af37`
- `packages/law-practice/domain/src/index.ts`: `872bfc0852da9303cb94348c2a958558c4a0798963ea78d05092acc0155ee082`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`
- `packages/foundation/modeling/schema/src/SchemaUtils/withKeyDefaults.ts`: `6e2246a3facb44a9f1b59f7f235044fe0f43bae06a71940e280a8bf7773fa7fd`

## Findings

Full cluster8/5, independent inFootnote24/15. Explicit index implication820 and stable-ID referent828 establish inherited provenance; ID-only permission is the user ruling, not a claim from private producer reachability. HistoricalD1 refuted by one-way implication. No existing runtime coherence guard; replacing three-field representation and comment-only invariant is actual design accounting. Public flat codec required; defaults and complete recursive payload retained. Effect Class.extend is only Struct/fields, so design separates canonical class from public codec, with explicit construction/outer-union tests required.

Source search found only model and LawPracticeDomain test direct consumers in packages, none in apps. Wildcard exports still carry public surface. No runtime tests, implementation, package proof or independent review claimed.

## Outputs
- Private `proposed-design.md`: `f4c98640f24269503a10ca84916db9b35b44ed04d0b6ffe23b67406d2ecada9f`
- Private `proposed-row.json`: `bd9b317201137defda7969e824ab0b975dc72205faba117ff30e3c5c2a730bfa`
- Private `projections.json`: `1ff5b34d51e9551d6e264aeb8d84aa9737c1eb4ffa5e832d68464f1218c7450f`

Graft: three successful retrievals and one no-hit app scan, estimated90,556 tokens saved.
