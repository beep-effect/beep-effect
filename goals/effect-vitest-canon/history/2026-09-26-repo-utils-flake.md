# Repo-utils isolated missing-path controls — 2026-09-26

Six original missing-path cases now include positive controls in their existing
coherent memory filesystem fixtures: readJson, modifyFile, existsOrThrow,
walkFiles, exists and workspace-manifest decoding. All original path operands,
error strings, false/empty results and case names remain. The workspace positive
uses a no-workspaces manifest and returns before native glob discovery; it does
not combine memory files with native glob scanning.

The earlier scope checkpoint established isolation. This phase adds positive
discrimination and does not receive duplicate credit for resource fixes. All
73 original assertions are retained in order, with seven additive assertions;
original fixture writes, native subjects and deadlines remain unchanged.
The other 29 flake no-findings remain bounded source-review judgments.

Full package verification exited 0: audit 8.6 seconds and docgen 5.7 seconds.
Focused Node proof exited 0 with exactly six expected cases passed and no
failed, missing or unexpected names. Two initial selectors matched zero cases;
both were rejected by the count guard and receive no proof credit. No production
counterexample occurred, and no retries, sleeps or deadline increases were added.

Observability, final whole-package timings and inventory reconciliation remain.
