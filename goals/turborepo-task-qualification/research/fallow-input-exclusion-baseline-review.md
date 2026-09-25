# Exclude fallow residue from every `$TURBO_DEFAULT$` task input set

A fallow audit leaves an untracked `.fallow/` directory inside the package it
scans, with its own `*` gitignore. Git honors that file, but Turbo's
`$TURBO_DEFAULT$` walk hashed `.fallow/.gitignore` anyway: on 2026-09-24 two
clean checkouts at the same commit disagreed on seven `transit` hashes
(`@beep/schema`, `@beep/pglite`, `@beep/rdf`, `@beep/shared-domain`,
`@beep/test-utils`, `@beep/documents-domain`, `@beep/effect-drizzle`) and on
every task downstream of them, because one checkout carried that residue.

`turbo.json` now excludes `!.fallow/**` beside `!.beep/**` in every root task that
hashes `$TURBO_DEFAULT$` (the three tasks that had neither negation gain both),
the identity package's own `turbo.json` does the same, and the root `.gitignore`
ignores `.fallow/`. The
reviewed baseline recorded the input sets without that negation, so
`beep quality cache-policy` reports `configuration-drift` for every package
computation. No command, cache flag, output declaration, dependency edge or
global configuration changed; the drift is one added input negation per task,
which narrows the hashed set to files that belong to the package.

Accept the narrowed input sets in the legacy configuration baseline. This
review grants no runtime qualification. Retain the identity/types scope,
`local-linux-x64-bun1.4.2` profile and `qualification-v2` epoch; the
qualification ledger is untouched.
