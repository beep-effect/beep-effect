### sol-2-1

- file: scratchpad/effected/toml/internal/semantic.ts:68
- class: schema   severity: required
- standard: D5; standards/effect-laws-v1.md law 19; standards/effect-first-development.md EF-12b   evidence: `Provenance` remains a handwritten seven-member string union. It is reused by `SemNode.kind` and `makeNode`, and matched exhaustively in `navigateHeaderPrefix`. The round-1 `r-match-provenance` repair fixed dispatch; this finding concerns the separate, still type-only domain definition. The four green law gates do not enforce schema provenance for literal type aliases.
- failure: The semantic engine’s named provenance domain has no schema authority, identity metadata or schema-derived type, contrary to the required LiteralKit representation for named internal literal domains.
- fix: Define a module-local, `$I`-annotated `Provenance = LiteralKit([...])` containing the same seven strings, and derive the existing type with `typeof Provenance.Type`. Keep node construction and matching behavior unchanged.

### sol-2-2

- file: scratchpad/effected/toml/TomlFormat.ts:420
- class: schema   severity: required
- standard: D5; standards/effect-laws-v1.md law 19; standards/effect-first-development.md EF-12b   evidence: `ResTable.origin` declares the five-case domain `"root" | "explicit" | "implicit" | "dotted" | "element"` inline. It is reused through `ResTable["origin"]` in `mkTable` and controls insertion acceptance and key-path rendering in `insertEdit`. No schema defines this domain; the green gates do not detect this type-only representation.
- failure: The formatter’s reused table-origin domain lacks the mandated schema source of truth and canonical metadata. Its cases exist solely in a handwritten property union.
- fix: Introduce a module-local, `$I`-annotated LiteralKit for these five origins, and derive `ResTable.origin` from its `.Type`. Preserve the existing origin strings, mutations and insertion rules.

### sol-2-3

- file: scratchpad/effected/toml/TomlDateTime.ts:238
- class: schema   severity: required
- standard: scratchpad/EFFECTED_PORT_GOAL.md operator step 4, requiring annotations on fields and schemas; D5   evidence: `offsetMinutes` is still declared as bare `S.Int.check(S.isBetween({ minimum: -1439, maximum: 1439 }))`, without a field annotation. The shared date/time fields repaired under round-1 `r-metadata-model` now have `annotateKey` descriptions; this separately declared field does not. Compilation and docgen can pass without checking field-description completeness.
- failure: The exported `TomlOffsetDateTime` schema omits field metadata explaining the offset’s units, sign convention and zero-offset behavior, leaving the mandatory field-annotation work incomplete.
- fix: Add a meaningful `annotateKey({ description: ... })` to `offsetMinutes`, describing the signed UTC offset in minutes and that zero renders as `Z`. Retain the existing integer constraint and bounds.

REQUIRED: 3
BACKLOG: 0

