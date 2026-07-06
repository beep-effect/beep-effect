# Reviewer Roles

Read-only reviewer/critic panel for the quality-review-fix loop (Phase 2).
Each reviewer receives the initiative summary, base commit, changed-surface
list, source-of-truth list, and the inventory item format from
`templates.md`.

## Reviewer Contract

Every reviewer must:

- stay read-only
- cite source standards and concrete file/command evidence
- classify each finding as `blocking`, `non-blocking`, `question`, or `note`
- distinguish changed-scope blockers from historical repo debt
- include suggested fixes and acceptance commands
- return `0 required findings` when no blockers remain

## Roles

1. Quality Gate Reviewer
   - Checks the quality commands, failed lanes, warnings, docgen, generated
     config drift, package metadata, and repo sanity.

2. Architecture Boundary Reviewer
   - Checks package home, dependency direction, canonical subpaths, slice vs
     shared vs foundation vs drivers vs tooling routing, package README policy,
     and shared-kernel promotion records.

3. Schema And Domain Reviewer
   - Checks schema-first models, `S.Class`, annotations, same-name schema/type
     exports, `LiteralKit`, `OptionFrom*`, schema defaults/transforms, entity
     invariants, and table projection rules.
   - Suggested skill: `$schema-first-development`.

4. Effect Law Reviewer
   - Checks A/O/P/R/S aliases, typed errors, no unsafe TypeScript, no native
     runtime helpers in domain logic, `Effect.fn`, `Context.Service`, `Layer`,
     `Config`, `Redacted`, `Path`, `HttpClient`, resource handling, retries,
     timeouts, and concurrency.
   - Suggested skill: `$effect-first-development`.

5. Error Boundary Reviewer
   - Checks driver/internal errors die in adapters, port errors die in
     use-cases, public action errors die in protocol handlers, server-only vs
     public exports are separated, and dropped technical detail is logged at
     the translation boundary.

6. Testing Reviewer
   - Checks slice isolation, `@effect/vitest`, port stubs, contract tests,
     type/dtslint coverage, package-alias imports from tests, targeted coverage,
     and no `bun test` usage for repo tests.

7. Observability Reviewer
   - Checks span-per-boundary, `<slice>.<concept>.<action>` naming,
     domain-semantic vs technical attributes, low-cardinality attributes, no
     secrets/PII, logging vs tracing vs console, and error-translation logs.

8. Documentation And API Reviewer
   - Checks public exports, JSDoc/TSDoc, compilable examples, lowercase
     `@category`, `@since`, useful conditional tags, package READMEs, docs that
     match behavior, and doctrine updates when code changed architecture.
   - Suggested skill: `$jsdoc-annotation-specialist`.

9. Reuse And Duplication Reviewer
   - Checks duplication, missed existing modules, and proposed abstractions.
     Rejects vague `common`, `core`, `utils`, or `lib` gravity. Enforces
     `foundation/capability` only after the specific-home-first routing test and
     at least two named consumers.

10. Evolution And Deprecation Reviewer
    - Checks deprecation windows, feature-flag lifetime, migration notes,
      shared contract versioning, removal triggers, and whether a
      `DECISIONS.md` entry or package promotion record is actually warranted.
