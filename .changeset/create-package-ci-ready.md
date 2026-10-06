---
"@beep/repo-cli": patch
---

Make a package from `beep create-package` pass hosted CI as created. The Lint
and Test Unit partition proof places a package the curated table does not name
in a bin chosen by a stable hash of its name, so no table edit is needed.
`beep tsconfig-sync` (`config-sync`) now also regenerates
`vitest.aliases.generated.json` and `standards/fallow.boundaries.generated.jsonc`
and reports both as drift in `--check`, including when only a workspace
dependency edge changed. The library scaffold ships a real test, declares
`bun-types`, and documents `VERSION` with an example; the service scaffold
compiles and passes against the installed Effect, documents its exports, and
uses `it.layer` in its health test.
