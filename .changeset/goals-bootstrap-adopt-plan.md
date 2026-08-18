---
"@beep/repo-cli": minor
---

Workstream E phase 0 of goals/knowledge-surface-automation: `beep goals bootstrap --plan` and
`beep goals adopt <slug> --plan`, the read-only materialization-plan slice. A pure
`compileMaterializationPlan` maps a decoded `BootstrapInput` through phase-archetype constructors
(`standard-delivery`, `report-first`) to a content-addressed `MaterializationPlan` carrying every
path, ownership boundary, payload byte, digest, and validation requirement; adoption splits into a
read-only `readPacketSnapshot` and a pure `compileAdoptionPlan` that retains authored files,
preserves the manifest byte-for-byte while enumerating its unmodeled top-level keys, reports absent
authored artifacts instead of inventing them, and records the archetype plus `goals/_template`
snapshot hash it measured against. No writer exists in this slice: `--plan` is the only mode, plans
are golden-tested and hash-pinned (`goal-plan/v1:<sha256>`), and the self-hosting pilot adoption of
the knowledge-surface-automation packet compiles with zero authored-file creations.
