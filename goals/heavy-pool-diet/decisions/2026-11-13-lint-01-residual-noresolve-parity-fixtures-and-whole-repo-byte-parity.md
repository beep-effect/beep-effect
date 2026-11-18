---
title: "LINT-01 residual: noResolve parity fixtures and whole-repo byte parity"
date: 2026-11-13
kind: checkpoint
lane: "test/heavy-pool-diet-noresolve-fixtures"
pullRequest: 3301
reversal: "Revert this PR's squash commit; the fixtures and the parity record disappear and the inventory is unchanged."
---

PLAN slice 4 pays the LINT-01 gate items #3019 left unpaid. The inventory gains an internal
`JSDocInventoryProgramOptions` argument that defaults to the production `{ noResolve: true }`; it has no CLI
flag or env var. `jsdoc-inventory-noresolve-parity.test.ts` adds merged-namespace and module-augmentation
fixtures and reuses the star-export, local named re-export and overload fixtures, which now live in
`test/jsdoc-inventory-fixtures.ts`. It asserts that the inventory built with `noResolve: true` strictly equals
the inventory built with `noResolve: false`, and that both match an explicit 25-row listing. It also asserts
that the resolving program really loads the augmented package. A whole-repo run with resolution forced on
produced byte-identical jsonc and md minus `generatedAt` across 196 packages. The production wall time was
2:11 against 10:22. Digests, commands and timings are in
`history/2026-11-13-lint-01-noresolve-parity.md`. No real difference between the modes was found, so the
lever's gate holds. Namespace members are not scored as separate entries today, and the listing pins that.
The hosted JSDoc Ratchet timing goes into the same history file.
