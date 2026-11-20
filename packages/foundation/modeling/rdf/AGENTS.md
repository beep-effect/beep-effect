# @beep/rdf

Pure RDF and linked-data value models for the repo.

- This is a `foundation/modeling` package.
- Keep it domain-safe: no capability, driver, tooling, app, slice, server,
  table, UI, or live Layer dependencies.
- Use schema-first models and `$RdfId` identities.
- `@beep/semantic-web` may re-export this package for compatibility, but this
  package must not import `@beep/semantic-web`.
- Vocabulary term lists are not hand-written here. A namespace and its terms
  are declared in the `@beep/identity` registry shards; the generated term
  modules under `src/Vocab/generated/` read them from `@beep/identity/Registry`.
  Re-acquire a pinned namespace with
  `bun run beep sync-data-to-ts --target pinned-vocabularies`, which also
  writes `src/Vocab/generated/namespace-pins.data.json`.
