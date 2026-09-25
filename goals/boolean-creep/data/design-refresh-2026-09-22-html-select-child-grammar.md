# Select child grammar P2 audit

Source SHA: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`.
Qualification remains4/3, derived/internal/Tier1; status designed.
Immutable starting inventory SHA-256: `22189fe9ecc326fadf0bb1d0743b903e297894acfb8aadd853b4f4a9e8826917`.

## Findings

- Anchors moved1923-1932; old source bindings superseded.
- Existing design omitted precise text/foreign exclusion: they cause separate contentModel diagnostics, not select-order invalidity.
- Preserve content-before-order and descendant traversal order; full output assertions needed beyond hasRule coverage.
- Existing HtmlChildGrammar is a profile discriminator, not a reusable outcome domain. Use a separate private LiteralKit; no generic classifier.
- Shared only the LiteralKit import with sibling DL/datalist proposals; no product changes.

## Commands and evidence

Graft targeted select query, tests query, classifier-reuse query and callers depth all. Read exact source spans and select fixtures; inspected public exports and changeset ignore configuration.
Bun --eval executed probe.ts from repository root, exit0. Abstract predicate comparison9,331 cases; real public API21 cases. This is sample/bounded proof, not exhaustive arbitrary-tree or package proof.

## SHA-256 bindings

- `packages/foundation/modeling/html/src/Html.conformance.ts`: `7a9ca39b11ca3f85d426f826392150d4874d2a34c63c1b0f689906f676e3eac2`
- `packages/foundation/modeling/html/src/Html.meta.ts`: `d5b6c9bc9230bcf22679e517d70f707d98709f1e40c5c6c8a507b6ac9cfe2b1c`
- `packages/foundation/modeling/html/src/index.ts`: `95dedf64877863567cd2ded17968a5e55b644c85e230d5eb4a7c2ceec4d2eace`
- `packages/foundation/modeling/html/package.json`: `d4162bc5309948a0d6debcecd9c297a3b538d5612ea6e482eba00ce24e4cfc48`
- `packages/foundation/modeling/html/test/Html.coverage-matrix.test.ts`: `0db5336ab1f8da499653009fb5c550dda7c2073ebd10fee2cfa2e224c3743008`
- `packages/foundation/modeling/html/test/Html.form-control.test.ts`: `029468fcbbe3c6f99be3404675fd211960d24e6d4148d35b07c90071072a86e9`
- `.changeset/config.json`: `fcdf5d2784987bbf86e0f05c61a636c2ff1fefd6f5f1cd34332715edf427106e`
- `input-inventory.jsonl`: `22189fe9ecc326fadf0bb1d0743b903e297894acfb8aadd853b4f4a9e8826917`
- `input-row.json`: `b1f010eb15bf8f44a3c199e18effac9ced1855aef111bac12a99edaad7f2f68f`
- `input-design.md`: `c62d0a18d49ff059e914c160bcff0f9bf595c1410dd5e96e7dace06a30489ff2`
- `proposed-design.md`: `a6a35c0b9bf4921efc80273e40ef04eb138e9f7af859a02b8eba5cdfc525ac60`
- `proposed-row.json`: `b1e1b9a07ecc81691e96474b121a63d7371d7dfb126400c5adfb91ce701c1df3`
- `probe.ts`: `1b231bbccff41d2cfd94ff65500c2c4c9dcd9bd8b96ecedc5fc98bd66bbd06fe`
- `probe.stdout.json`: `5545113733669d47a51e9a7118568c756fd126ebb0af54018d8339e4aa0f7b6d`
- `probe.stderr.txt`: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

No tracked edits, implementation, package verification, P3, GATE2 or census credit.
Graft estimated savings137272 tokens across4 calls.

Parent integration: verified input hashes; starting inventory is preserved at `history/inventory/2026-09-22-pre-html-refresh.jsonl` and previous design at `history/designs/2026-09-22-pre-refresh-html-select-child-grammar.md`. Source qualification checked against the owner's current grammar branch. No independent P3 credit.
Parent correction: changeset-ignore absence does not itself establish a release-policy requirement.
