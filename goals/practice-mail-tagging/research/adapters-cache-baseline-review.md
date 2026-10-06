# Re-record the cache baseline after `@beep/law-practice-server` gained two driver dependencies

The mail-tagging adapters (`goals/practice-mail-tagging`, PR 2) add
`@beep/m365` and `@beep/box` as `workspace:^` dependencies of
`packages/law-practice/server/package.json`: the Outlook mailbox adapter is
built over the `M365` service and the document store over the `Box` service.

The projection records each task's dependency edges, so the re-record moves
the configuration of the `@beep/law-practice-server` computations.
`beep quality cache-policy` blocks on the four that carry a cache policy
(`build`, `check`, `lint:deprecated-apis`, `test`). No command text, input
glob, output declaration, environment key, or cache flag changed for any of
them, and no scripts block changed (`bun run beep lint package-scripts
--check` reports no drift). The only change is the two added workspace
dependency edges.

Accept the re-recorded `@beep/law-practice-server` configuration in the
legacy configuration baseline. This review grants no runtime qualification.
Retain the current lint scope, profile, and epoch; the qualification ledger
is untouched.
