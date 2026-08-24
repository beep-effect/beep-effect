---
"@beep/repo-cli": patch
---

Revive the changeset gate: `beep quality changeset-status` now enforces its
in-process per-package rule on every non-lab-only change set, counting only
changesets added in the since-range, and never spawns the stock changesets CLI
(whose v3 `privatePackages` default made stock status vacuous for this
all-private workspace). The repo-sanity lane gains an unconditional
`changeset-graph` validation step, and the mechanically unreachable general
release workflow is retired.
