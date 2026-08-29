# P3 summary

## Converted scope

- Schema pilot: 6 files, 33 inventory export entries (29 owning declarations, 4 re-export edges).
- Docgen pilot: 2 files, 11 entries (4 owning declarations, 7 re-export edges).
- ApplicationNumber pilot: 2 files, 3 entries (2 owning declarations, 1 re-export edge).
- Carrier migration: 127 legacy `@example` tags across the 4 required files (84 + 11 + 1 + 32).
- Carrier fence audit: all 127 code-fence payloads are byte-identical to the staged pre-P3 versions.
- Every requested source entry is resolved in the full tracked-source inventory; no legacy carrier was left unmigrated.

## Exemplary hover symbols

- `SemanticVersion`: When-to-use, validation details, SemVer-suffix gotcha, observable acceptance/rejection Example.
- `encodeUnknownEffect`: boundary-focused use case, option precedence, typed-input gotcha, observable Effect Example.
- `program`: workflow use case, concurrency/proof details, focused-run gotcha, observable Effect Example.
- `ApplicationNumber`: ST.13 boundary use, format details, presentation-metadata gotcha, observable validation Example.

## Inventory and baseline

- Kind-aware presence is active: runtime exports require section-or-tag Example; pure type exports require prose only.
- Source scanning uses unbounded shared GitExec `git ls-files`; untracked scratch files are excluded.
- Full 131-package direct-generator proof: 2,310 modules, 15,193 exports, `missingExportExamples=0`.
- Final baseline regenerated: zero Example baseline; final-tree totals include `undescribed-see=22` and `forbidden-remarks=474`.

## Verification

- GREEN: CLI inventory tests, 14/14; tooling CLI check.
- GREEN: full package docgen for schema/html/utils/docgen/law; 2,533 examples typechecked.
- GREEN: focused checks for schema, html, utils, docgen, CLI, and law-practice domain.
- GREEN: direct ratchet comparison (`tracked=20`, `increased=0`); requested P3 files have zero cleanup findings.
- GREEN: `git diff --check`; non-JSDoc source text unchanged in every documentation target.
- BLOCKED: CLI inventory, CLI ratchet, and repo `docgen:local` crash before dispatch with
  `error: Duplicate discriminant: embed` at `packages/foundation/modeling/md/src/Md.model.ts:2857:4`.
- User/concurrent WIP cleanup findings: Id.ts, PnLocal.ts, Lexical.codec.ts, Md.html.ts, Md.model.ts,
  Session.values.ts, Session.file-store.ts, OntologyToolHandlers.ts, Session.document.tsx,
  Session.explorer.tsx, Session.tree.ts, and Session.sparql.ts. No listed file was edited in P3.
