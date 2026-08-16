---
"@beep/repo-cli": minor
---

Add `beep delete-package`: complete leaf-package deletion driven by the new
private RegistrationGeometry model (ten-kind registration-surface schema,
forward/inverse/inspect interpreters). The command scans reverse dependents
(manifest + import + authored-reference, including identity-accessor
importers), enforces the hard-refuse table (`--force` never overrides
dependents), prints the schema-versioned inverse plan before mutating,
removes identity/workspace/changeset/tree state, reconstructs derived
configs via tsconfig-sync, refreshes the lockfile, regenerates baselines,
and finishes with a declared-vs-actual doctor pass. `--check` doubles as a
residue doctor for previously deleted names, and the identity-registry lint
now detects orphaned composers and exports.
