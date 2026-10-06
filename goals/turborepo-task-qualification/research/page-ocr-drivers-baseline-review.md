# Re-record the baseline after adding the `@beep/tesseract` and `@beep/poppler` drivers

The corpus page OCR work adds two driver packages, both scaffolded with
`bun run beep create-package --family drivers`: `@beep/tesseract` (page
recognition, installed language models, script detection) and
`@beep/poppler` (PDF page counting and page rendering). Their generated
scripts blocks are untouched (`bun run beep lint package-scripts --check`
reports 0 drifting manifests).

What moves in the projection:

- **Sixteen new computations.** `build`, `check`, `docgen`, `lint`,
  `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws` and `test` for each new
  package. They carry the same task definitions, inputs, outputs and cache
  flags as every other generated driver package (for example `@beep/tika`).
- **`@beep/repo-cli`.** Six computations (`build`, `check`, `doctest`,
  `lint:deprecated-apis`, `test`, `test:property`) re-hash because the package
  gains two workspace dependencies (`@beep/poppler`, `@beep/tesseract`), which
  changes its dependency edges. No command text, input glob, output
  declaration, environment key or cache flag changed.
- **`//#lint:policy-fingerprint`.** The tool-owned policy fingerprint inputs in
  `turbo.json` gain the two packages' `package.json` and `src/**` globs, as
  `bun run beep lint policy-fingerprint --write` regenerates them for any new
  package. The `turbo.json` projection source digest moves with it.

Accept the new and re-hashed computations in the legacy configuration
baseline. This review grants no runtime qualification. Retain the current
identity/types/fc-runs/test-runner lint scope, `local-linux-x64-bun1.4.2`
profile and `qualification-v2` epoch; the qualification ledger is untouched.
