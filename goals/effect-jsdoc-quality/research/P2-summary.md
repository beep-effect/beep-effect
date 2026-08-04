# P2 summary

## Inventory rules

- `undescribed-see`: every `@see` has a `{@link ...}` followed by a purpose phrase.
- `multiple-description-paragraphs`: a new-style block has exactly one lead paragraph.
- `leading-blank`: a new-style lead does not begin with a blank-padded fragment.
- `trailing-blank`: a new-style lead does not end with a blank-padded fragment.
- `invalid-heading`: a new-style lead does not begin with a Markdown heading.
- `section-out-of-order`: When to use, Details, and Gotchas follow canonical order.
- `duplicate-section`: non-Example sections appear at most once.
- `empty-section`: every present section contains non-empty body content.
- `section-after-example`: only Example sections may follow the first Example.
- `invalid-when-to-use-prefix`: When to use opens with `Use to|when|as|with`.
- `malformed-example`: every Example is titled and contains exactly one TypeScript fence.
- `duplicate-example`: Example titles are unique within one documentation block.
- `loose-ts-fence`: TypeScript fences occur only inside Example sections.
- `forbidden-remarks`: `@remarks` is retired and reported by the inventory.
- All section parsing masks fences found by docgen's `extractFencedCodeBlocks`; no second fence parser was added.

## Binding conflict

- Kind-aware Example presence was implemented and measured, then omitted under the SPEC stop rule: it found 13 value exports without either carrier (11 committed `SchemaUtils/encoders.ts` helpers and 2 unrelated untracked temporary exports), while DECISIONS requires a zero baseline and P2 forbids package-doc edits. `requiredExportTags` now covers `@category` and `@since`; the presence total remains zero rather than baselining a false exception.

## Gate and fixture

- Cleanup-on-touch lives in `Quality/internal/JSDocRatchet.ts`; `bun run beep quality jsdoc-ratchet` unions `origin/main...HEAD` with staged, unstaged, and untracked paths and fails changed `packages/**/src/*.{ts,tsx}` files containing `@remarks` or `@example`.
- Direct gate proof: aggregate-matched temporary baseline passed, then cleanup-on-touch rejected 13 changed file/tag findings.
- Fixture: `packages/tooling/tool/docgen/test/fixtures/section-example/`; `Core.test.ts` runs docgen and verifies its real `tsc --noEmit --project` path through a marker wrapper.

## Baseline totals

- `undescribed-see=23`, `multiple-description-paragraphs=68`, `leading-blank=0`, `trailing-blank=0`, `invalid-heading=0`.
- `section-out-of-order=0`, `duplicate-section=0`, `empty-section=85`, `section-after-example=0`, `invalid-when-to-use-prefix=4`.
- `malformed-example=85`, `duplicate-example=0`, `loose-ts-fence=0`, `forbidden-remarks=477`, `missingExportExamples=0`.

## Verification

- GREEN — `npx vitest run packages/tooling/tool/docgen/test/Core.test.ts`: 12 passed.
- GREEN — `bun run --cwd packages/tooling/tool/docgen check`.
- GREEN — `bun run --cwd packages/tooling/tool/cli check`.
- GREEN — `git diff --check`.
- RED — `bun run beep quality jsdoc-inventory`: unrelated current `Md.model.ts` startup failure, `Duplicate discriminant: embed`; the earlier P2 inventory run completed over 132 packages and supplied the baselines above.
