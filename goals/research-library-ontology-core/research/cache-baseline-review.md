# Cache baseline review: research library ontology core (2026-11-06)

Reviewer: Claude Opus 5.5 (`feat/research-library-ontology-core`). No
qualification is granted.

## `@beep/repo-cli`

`package.json` adds five workspace dependencies: `@beep/ontology`,
`@beep/semantic-web`, `@beep/shacl`, `@beep/oxigraph` and `@beep/n3`. They
back the research library's ontology render, SHACL verification and SPARQL views.
`tsconfig-sync` added the matching project references in `tsconfig.json`,
`tsconfig.check.json` and `test/tsconfig.json`, and the boundary projection in
`standards/fallow.boundaries.generated.jsonc`.

As a result, the `build`, `check`, `doctest`, `lint:deprecated-apis`, `test` and
`test:property` tasks gain the five `#build` upstream edges. That is the drift
`bun run beep quality cache-policy` reports. Nothing else about these tasks
changes: no flag, output, environment or input-glob change, and no custom cache flag.
The new source and test files, including the replay fixtures under
`test/fixtures/research-library-replay/`, already fall inside the existing
`src/**` and `test/**` inputs.
