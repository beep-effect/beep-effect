---
"@beep/repo-cli": patch
---

Switch every package `tsconfig.check.json` to the reference-keeping shape and
make the repo CLI own it.

`references` is not inherited through `extends`, so the `"references": []`
line every check overlay carried made `tsgo -p tsconfig.check.json`
re-typecheck upstream packages from source. `beep tsconfig-sync` gains the
`package-check-references` section that mirrors each package's canonical
`tsconfig.json` references into its overlay (drift under `--check`, writer
under `--write`), `beep lint tsconfig-overlay` drops `module` /
`moduleResolution` from the allowlist and fails an overlay whose references
drift from its `tsconfig.json`, scaffolds emit the post-switch overlay, and
`beep quality check-census` refuses an unbuilt tree instead of measuring
TS6305 noise. Quality-lane audit D3.
