# Statutes range P2 audit

HEAD `0be1f13d62fa00cb65e34ff69ec99043380f8d81`. Private only.

## Input hashes
- `input-inventory.jsonl`: `22f6452596f96f7e5a0545ddcddb751ae5518fe3553e260c4338b52af59e7343`
- `input-design.md`: `c7a6b8b19d3454772b698ad362734d307d3612aad29ee1ae9451878b1f47ed14`
- `input-decisions.md`: `b9ad90280aa8b82394d221b6941427100c47536c53cf15496d5b15c12914d4eb`
- `packages/law-practice/domain/src/values/StatutesAtLargeCitation/StatutesAtLargeCitation.model.ts`: `c16507c8b6ea8559e0ed6215918823af6f348daa9cfec3a72477b02c06c69e31`
- `packages/law-practice/domain/src/values/StatutesAtLargeCitation/index.ts`: `87d937da6ca0520e0b8ea01783632a2b83fc96a7d53fe7a21df9e3d62f4e2f6f`
- `packages/law-practice/domain/src/values/Citation/Citation.models.ts`: `2340f0a39f198015de6ee023df62bb3774f4cd97341001d74bdd8707e016742c`
- `packages/law-practice/domain/src/values/CitationBase/CitationBase.model.ts`: `3b9077514cae683d5df5c6e60b6ca6f5fd3c89913750141e58a40126c333a175`
- `packages/law-practice/domain/src/values/index.ts`: `89babdc4117152d6c4e7975510d4559f77e221d95c0d39bcaccfce824294af37`
- `packages/law-practice/domain/src/index.ts`: `872bfc0852da9303cb94348c2a958558c4a0798963ea78d05092acc0155ee082`
- `packages/law-practice/domain/test/LawPracticeDomain.test.ts`: `75de8b4619c393d8c42d9a732dd26ba5b0d1533dc7f503dcaa7d0c05f9945359`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`

## Contract and source findings
4/3 retained from documented end-for-range semantics74/79; true/None explicitly preserved by fixture660-665. No new ordering/start-presence inference. Independent footnote yields12/9. Producer absence is not proof; annotations supply implication. Full source has no extra range reader. Public codec and recursive union callers require compatibility preservation.

## Corrections
Refreshed test/union anchors, removed stale Docket-only bounded arbitrary claim, fixed local Effect API lines/direction and helper statics order. Full common/own payload enumerated. Actual schema-derived arbitrary generator is current Effect Arbitrary; existing roundtrip acceptance alone cannot establish contradictory domain legality.

## Verification scope
Graft exhaustive37hits9symbols5files; initial over-specific symbol missed then broadened per skill. Finite4tuple3legal asserted; eight headings. No source/canonical changes, runtime proof, package verification or P3 credit. Graft27,641 tokens saved.

## Output hashes
- `proposed-design.md`: `c3a911074f50d5aa076aa5ba0c50cb5b1b4c0937644d7f5785de1687b6054f1d`
- `proposed-row.json`: `13cccd879cb309cfe90ad366b7cb328cb525a08fb56e085c1b1deed930bdb800`
- `finite-projection.json`: `f4467edec2bffaaeb8ed3c93d44d3246c0fda4ffa9ae59afbfe23ae50c48474f`
