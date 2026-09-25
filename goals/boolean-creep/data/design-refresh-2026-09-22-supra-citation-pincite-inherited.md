# Supra P2 audit

Source: `0be1f13d62fa00cb65e34ff69ec99043380f8d81`.

Independent source inspection confirms complete8/5; no source changes or P3 credit. User decision snapshot governs ID-only. Finite legal tuples:000,100,101,110,111. Model annotations1067/1075 support implication; fixture639 supports100. Full own/base fields and recursive namespace/union edges inspected. Graft scoped SupraCitation and pinciteInheritedFrom found model/test consumers; external consumers are not exhaustively known. Local Effect decodeTo5388 and Class.extend14423 contracts checked. No runtime codec prototype was run.

## Input hashes

- `input-inventory.jsonl`: `1c0bef1c344060c1275619945d052ca5cc7b4414f48dd9f4a9c09c619477d355`
- `input-DECISIONS.md`: `b9ad90280aa8b82394d221b6941427100c47536c53cf15496d5b15c12914d4eb`
- `goals/boolean-creep/designs/id-citation-pincite-inherited.md`: `f4c98640f24269503a10ca84916db9b35b44ed04d0b6ffe23b67406d2ecada9f`
- `goals/boolean-creep/data/r31-law-owner-holds.json`: `7cbe7672b22d89925f48ece3f57b8175bc233bcdc22555af7379d9e6736857fa`
- `packages/law-practice/domain/src/values/Citation/Citation.models.ts`: `2340f0a39f198015de6ee023df62bb3774f4cd97341001d74bdd8707e016742c`
- `packages/law-practice/domain/src/values/CitationBase/CitationBase.model.ts`: `3b9077514cae683d5df5c6e60b6ca6f5fd3c89913750141e58a40126c333a175`
- `packages/law-practice/domain/test/LawPracticeDomain.test.ts`: `75de8b4619c393d8c42d9a732dd26ba5b0d1533dc7f503dcaa7d0c05f9945359`
- `packages/law-practice/domain/src/values/Citation/index.ts`: `8955498eca7d2966b6c0a93a308044562a75d70cdc643dc788ef53c500ad10d1`
- `.repos/effect/packages/effect/SCHEMA.md`: `4ad8e16a92cbefc9c7cc9759f982645a6a4802fdb18eb2b5f7755f2d30f652a9`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`

## Output hashes

- `proposed-design.md`: `a4888213ed060f06c9de4a91d078a773b152d0a4079cc2fe9ee297ba4b809b16`
- `proposed-row.json`: `6f8bcd84b52b7633f46744ee4c8334279259aa2ca8ceb82ba8c7098aeca3fa81`

Graft estimated saving:35,735 tokens across2calls. Parent owns canonical integration.
