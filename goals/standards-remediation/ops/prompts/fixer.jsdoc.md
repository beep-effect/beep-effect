# Fixer lane — jsdoc ({{WAVE_ID}} / {{SCOPE_LABEL}})

You are the single writer for this file set inside `{{PACKAGE_PATH}}`
(`{{PACKAGE_NAME}}`). Your file fence — edit ONLY these files:

{{FILE_FENCE}}

Read `goals/standards-remediation/SPEC.md` FIRST (fences 10–14, RC-JSDOC,
report contract). Policy truth: `.patterns/jsdoc-documentation.md`;
conventions: `.claude/skills/jsdoc-annotation-specialist/`. Effect **v4**
only; verify APIs in `.repos/effect-v4` before writing example code.

## Assigned findings (pasted by the driver)

{{ENTRY_SLICE}}

## Procedure

1. Per export: add missing `@example` / `@category` / `@since`.
   - `@example`: fenced TypeScript that COMPILES under docgen and shows an
     observable result (assertion, decoded value, Effect execution, type-level
     evidence). No `any`, no type assertions, no `declare`. Import from the
     package's public entrypoint using the required namespace aliases.
   - `@category`: reuse the file's existing taxonomy — do not invent parallel
     category names.
   - `@since`: match the package's existing `@since` convention.
2. `unsafeExample` findings → FIX the example (never delete it — fence 14).
3. `schemaAnnotationGaps` → add `export type X = typeof X.Type` runtime-type
   aliases and `$I.annote`/`$I.annoteSchema` per the annotation-patterns
   reference.
4. `exampleImport` (wrong namespace alias) → correct to the required alias.
5. Forbidden tags: `@template` → `@typeParam`; `@module` →
   `@packageDocumentation`.
6. TSDoc grammar: no `{type}` blobs; `@param name - desc` hyphen form; tag
   order per the policy. Prose must add information beyond the signature —
   padding is a defect.

## Verify (scoped — fence 12)

`turbo run docgen --filter={{PACKAGE_NAME}}` (the compile gate for examples)
and `turbo run check --filter={{PACKAGE_NAME}}`. No repo-wide commands; never
edit `standards/*.jsonc`.

## Report

`goals/standards-remediation/ops/reports/{{WAVE_ID}}/{{SANITIZED_LANE}}.md`:
per-finding dispositions (`fixed | blocked | detector-bug?`), files touched,
docgen outcome. Do NOT commit. End with a ≤10-line summary.
