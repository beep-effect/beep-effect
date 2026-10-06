# Record the cache baseline for the new `@beep/practice-mail-tagging` app

The mail-tagging entrypoint (`goals/practice-mail-tagging`, PR 3) adds one
workspace, `apps/practice-mail-tagging`, scaffolded with
`bun run beep create-package practice-mail-tagging --type app --app-kind service`.
A new workspace brings new computations into the projection.
`beep quality cache-policy` blocks on the seven that carry a cache policy:

```text
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#build
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#check
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#lint
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#lint:deprecated-apis
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#lint:jsdoc
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#lint:laws
BLOCK unreviewed-expansion: @beep/practice-mail-tagging#test
```

Every one of them is the generated task of a service app: the scripts block
is the generator's (`bun run beep lint package-scripts --check` reports no
drift), with the HTTP `dev` script removed because the app is a command line.
No existing computation changes its command text, input glob, output
declaration, environment key, or cache flag. The app's workspace dependencies
are `@beep/box`, `@beep/duckdb`, `@beep/identity`, `@beep/law-practice-domain`,
`@beep/law-practice-server`, `@beep/law-practice-use-cases`, `@beep/m365`, and
`@beep/schema`; no other package gains a dependency edge.

Accept the seven `@beep/practice-mail-tagging` computations in the
configuration baseline. This review grants no runtime qualification. Retain
the current lint scope, profile, and epoch; the qualification ledger is
untouched.

Recorded on the v2 baseline with the review stamped on the single subject
`@beep/practice-mail-tagging`; every other subject's review is carried
forward unchanged.
