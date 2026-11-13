# Photo-face cache input review

Reviewed by Codex GPT-6.1 Sol on 2026-11-13 against the current main-based
photo-face lane. The complete `beep cache audit` output names ten blocking
configuration-drift rows, all belonging to `@beep/repo-cli`:

- `@beep/repo-cli#build`
- `@beep/repo-cli#check`
- `@beep/repo-cli#docgen`
- `@beep/repo-cli#doctest`
- `@beep/repo-cli#lint`
- `@beep/repo-cli#lint:deprecated-apis`
- `@beep/repo-cli#lint:jsdoc`
- `@beep/repo-cli#lint:laws`
- `@beep/repo-cli#test`
- `@beep/repo-cli#test:property`

Each row's reviewed input change is the package manifest. This lane removes
`python/photo-face/**` and its exclusion patterns from `files`, removes the
package-owned `beep:lint:python` and `beep:test:python` implementation hooks,
adds the catalog dependencies `onnxruntime-node` and `fflate`, and includes the
authored photo-face guide and CVLFace license notice. The package-scripts
writer regenerated the remaining task aliases. No remaining task command,
cache flag, environment declaration, input glob or output declaration changes.
The manifest's exact bytes re-key these ten task observations.

The root catalog adds onnxruntime-node 1.31.1 and the lockfile resolves the
native dependency. The existing sharp and fflate catalog pins are reused.
The audit also reports an advisory `configuration-source-drift: turbo.json`;
this lane does not change turbo.json, and the request grants no new task qualification.

The baseline writer additionally identified `//` as an unreviewed changed
subject. Its legitimate input change is the root package manifest: the catalog
adds only onnxruntime-node 1.31.1. The request therefore covers exactly `//` and
`@beep/repo-cli`, and retains the current baseline's scope,
profile and epoch verbatim, and changes no qualification or exception. Its
`previous` field hashes the exact baseline text, and its evidence digest hashes
this file's exact bytes. Re-recording accounts for changed inputs; it does not
claim tests or hosted checks passed.
