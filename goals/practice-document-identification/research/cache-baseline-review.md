# Record the cache baseline for the new `@beep/practice-identify` app

The document identification tooling (`goals/practice-document-identification`)
adds one workspace, `apps/practice-identify`, scaffolded with
`bun run beep create-package practice-identify --type app --app-kind service`,
and a `DocumentIdentification` slice inside the existing
`@beep/law-practice-use-cases` and `@beep/law-practice-server` workspaces.

`beep quality cache-policy` blocks on eleven computations:

```text
BLOCK configuration-drift: @beep/law-practice-server#build
BLOCK configuration-drift: @beep/law-practice-server#check
BLOCK configuration-drift: @beep/law-practice-server#lint:deprecated-apis
BLOCK configuration-drift: @beep/law-practice-server#test
BLOCK unreviewed-expansion: @beep/practice-identify#build
BLOCK unreviewed-expansion: @beep/practice-identify#check
BLOCK unreviewed-expansion: @beep/practice-identify#lint
BLOCK unreviewed-expansion: @beep/practice-identify#lint:deprecated-apis
BLOCK unreviewed-expansion: @beep/practice-identify#lint:jsdoc
BLOCK unreviewed-expansion: @beep/practice-identify#lint:laws
BLOCK unreviewed-expansion: @beep/practice-identify#test
```

The seven `@beep/practice-identify` computations are the generated tasks of a
service app: the scripts block is the generator's
(`bun run beep lint package-scripts --check` reports no drift), with the HTTP
`dev` script removed because the app is a command line. Its workspace
dependencies are `@beep/identity`, `@beep/law-practice-server`,
`@beep/law-practice-use-cases`, `@beep/schema`, and `@beep/uspto`.

The four `@beep/law-practice-server` computations drift because the server
workspace gains dependency edges for the new slice (`@beep/uspto` and the
`@noble/hashes` runtime) and its `tsconfig.json` / `tsconfig.check.json`
include the slice's directories. No command text, output declaration,
environment key, or cache flag changes on any of them.

No other existing computation changes. The scope, profile, and epoch stay as
recorded; the qualification ledger is untouched and no qualification is
granted.

Recorded on the v2 baseline with the review stamped on the two subjects
`@beep/practice-identify` and `@beep/law-practice-server`; every other
subject's review is carried forward unchanged.
