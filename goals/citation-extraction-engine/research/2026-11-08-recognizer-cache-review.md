# Recognizer dependency cache review — 2026-11-08

Subject: @beep/law-practice-server. Reviewer: Codex GPT-6.1-Sol, medium.
The actual cache audit reports exactly these five configuration drifts:

- `@beep/law-practice-server#build`
- `@beep/law-practice-server#check`
- `@beep/law-practice-server#doctest`
- `@beep/law-practice-server#lint:deprecated-apis`
- `@beep/law-practice-server#test`

The server manifest adds `@beep/eyecite: workspace:*`; source, check and test
project references add that driver. Script commands, cache flags, output globs,
environment declarations and qualification scope are unchanged. The new driver
remains explicitly uncached. No qualification, exception row or cache activation
is granted by this review.

Build/check/doctest/test now resolve the new recognizer dependency and its
upstream build. Deprecated-API lint reads the changed TypeScript dependency
program. These are real input/graph changes; this request does not hide a test
failure. The 34 focused tests and full server source/test types pass; blocking
package laws pass. Hosted broad proof remains pending.

Exact reviewed current input bytes (SHA-256):

- `packages/law-practice/server/package.json`:
  `59cf65c39dd6e4d20f1d7dd1aaab31920a2b5b0d92d6a0fba0acc394c62c1ee6`
- `packages/law-practice/server/tsconfig.json`:
  `6f0ceacc3ede2249449780d656ad25b65afcadb5103164731c5cccc32d8e2096`
- `packages/law-practice/server/tsconfig.check.json`:
  `a4d20ca7bbb3a5eaf9173fd621305fb2d99472c8d0edff582f995ae98bd274a2`
- `packages/law-practice/server/test/tsconfig.json`:
  `b8c39192c851567ce307d8b80725c429b5e050a92d80a78c98e23b993886ce74`
- `packages/drivers/eyecite/package.json`:
  `e9da9c28882dcb7040c9d9cc2375fbc4a6edd0e1dcb9eb51fdd68ff8b43037e9`

## Earlier new-workspace source drift included by the baseline verifier

Subject `@beep/eyecite` is the new driver workspace. Its eight inherited task
slots are explicitly uncached, not granted reuse or qualification:

- `@beep/eyecite#build`: new workspace task, cache false.
- `@beep/eyecite#check`: new workspace task, cache false.
- `@beep/eyecite#docgen`: new workspace task, cache false.
- `@beep/eyecite#lint`: new workspace task, cache false.
- `@beep/eyecite#lint:deprecated-apis`: new workspace task, cache false.
- `@beep/eyecite#lint:jsdoc`: new workspace task, cache false.
- `@beep/eyecite#lint:laws`: new workspace task, cache false.
- `@beep/eyecite#test`: new workspace task, cache false.

Subject `//` has review-only source drift from adding the driver workspace and
catalog pin to the root manifest and regenerating the root-package projection.
Root task commands, global input paths, outputs and environment declarations are
unchanged. The bytes of an existing global input legitimately changed; this
review does not suppress unrelated failures or qualify any root task.

Additional exact reviewed input bytes (SHA-256):

- `package.json`:
  `f035133073c50da2ed5376997bee8cd5c94bf4ad731fa567ebd18432ba4bc38a`
- `standards/root-package.projection.generated.json`:
  `5ae3c15a835b35c8d68f750855e1adcbde1038b76ac5572be831ed7015808929`
- `packages/drivers/eyecite/package.json`:
  `e9da9c28882dcb7040c9d9cc2375fbc4a6edd0e1dcb9eb51fdd68ff8b43037e9`
- `packages/drivers/eyecite/turbo.json`:
  `79f75a5991e21248a9bad352212ee7f26a773a52132aae01cf152fa460f83aee`

## Review refresh after hosted CI and main integration

The three workspace dependency specifiers now use `workspace:^`, as required by
Syncpack. The dependency graph and task commands remain the same. The bytes
above describe the original review; these current manifest hashes supersede
those two manifest entries for this refresh. No qualification is added.

Main integration also adds MemoryStats.schemas.ts and MemoryStats.service.ts to
the existing inputs of `@beep/repo-cli#lint:policy-fingerprint:shared`. This
main-owned input correction is recorded as subject `@beep/repo-cli`; its command,
cache flag, outputs and environment are unchanged. The root Turbo source hash
changes for this explicit two-input addition. No other task-setting change is
introduced by this refresh.

The driver's devDependencies are also alphabetized for Sherif. This changes only
manifest ordering, not dependency versions, graph edges or task behavior.

Refreshed exact input bytes (SHA-256):

- `packages/drivers/eyecite/package.json`:
  `3eaf9757db429f2fffad0ea6accab07f15a008455f4b6426affefbfa50af2c23`
- `packages/law-practice/server/package.json`:
  `41fd20481e22937291b8469f054d7b4ad633f4e1e58d882a0afa8c6f222724b9`
- `turbo.json`:
  `166b31fcbc0338bbfd3084701e5927a84efc103ac9f41e7b2c0027c027926b0f`
