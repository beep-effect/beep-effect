# Foundation grammar and descriptor design refresh — 2026-09-08

Source reviewed: packet HEAD `7440cb8c4302ce64b87860069a464bafbf65f576`; inspected corpus matches `origin/main` at `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

## Designs

- `designs/html-select-child-grammar.md` — verified the only writer/reader in `Html.conformance.ts:1911-1922`. The private traditional/customizable/invalid literal preserves empty and script-supporting-only traditional precedence and the exact parent-path `elementOrder` diagnostic.
- `designs/html-dl-child-grammar.md` — verified description-list logic at `Html.conformance.ts:1768-1822`. The empty/direct/wrapped/invalid literal absorbs the separate empty guard while preserving significant-text rejection, nested wrapper validation, surrounding content-model ownership, and diagnostic order.
- `designs/langextract-minimal-fold-segment-kind.md` — verified regex writer and sole match at `Alignment.behavior.ts:118,177-209`. The private literal preserves capture precedence, UTF-16 offsets, Unicode lowercase expansion, optional-hyphen tokens, and raw source slices.
- `designs/r2-foundation-unique-match-search.md` — traced exact/lesser/minimal-fold construction, merge control, precedence reader, model cycle, tests, and barrel. The cycle-free model leaf reuses one set of none/unique/ambiguous cases and adds exhausted only for minimal fold. It preserves exact/lesser ambiguity fallthrough and minimal-fold ambiguity/exhaustion fail-closed behavior with the shared budget.
- `designs/organization-tenant-placement-bits.md` — whole-repo search found only declarations, package JSDoc, and `Organization.test.ts`. The option literal preserves both valid placements, represents both current false invalid results as `None`, and leaves identifier, nullable-parent, model decoding, persistence, and existing decode errors unchanged.
- `designs/r3-arch-ecosystem-internal-pg-timestamp-timezone.md` — traced descriptor definition, generic, constructor, runtime guard, Carrier/table inference, public combinator, fixtures, unit and bundle tests. The design reuses `ident`, preserves the public function flag and true/string defaults, and projects the required boolean only to the external Drizzle builder.

## Evidence and scope findings

All six qualified clusters remain supported by their cited E1-E4 source evidence. None reduces to an excluded function-parameter-only record. The PostgreSQL public `timestamp({ withTimezone })` option remains out of scope and unchanged; only the correlated stored descriptor field is removed. No encoded/persisted compatibility codec is required for any of the six.

## Verification

Targeted `rg`, numbered source reads, tests, and barrel searches covered all named writers and readers. `bun goals/boolean-creep/ops/validate-designs.ts` passes with `design coverage OK: 103 qualified ids`; scoped `git diff --check` also passes.

No product source, tests, inventory/status, dependencies, generated files, or Git references were changed.
